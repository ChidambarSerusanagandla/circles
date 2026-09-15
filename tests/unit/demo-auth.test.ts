import { describe, expect, it } from "vitest";
import {
  issueDemoSession,
  readDemoToken,
  signToken,
  validInternalKey,
  verifyToken,
} from "../../src/lib/auth/demo-token";
import { demoAccounts } from "../../src/lib/auth/demo-accounts";
import { configureDemoGroup, initialDemo } from "../../src/lib/demo";
import { demoGroups, uid } from "../../src/lib/seed-data";
import { profileInput } from "../../src/lib/rules";

const secret = "a-test-only-session-secret-with-32-characters";
const internalKey = "a-separate-test-only-internal-access-key";
const now = Date.UTC(2026, 8, 14, 12);
const lifetime = 8 * 60 * 60 * 1000;

describe("signed demo identity", () => {
  it("verifies an issued HMAC session and its expiry boundary", () => {
    const token = issueDemoSession("reader", secret, undefined, now);
    expect(readDemoToken(token, secret, now + lifetime - 1)).toEqual({
      account: "reader",
      user: demoAccounts.reader.user,
      internal: false,
    });
    expect(readDemoToken(token, secret, now + lifetime)).toBeNull();
    expect(readDemoToken(token, secret, now + lifetime + 1)).toBeNull();
  });
  it("rejects tampering with the account in the signed body", () => {
    const token = issueDemoSession("reader", secret, undefined, now);
    const [body, signature] = token.split(".");
    const forged = Buffer.from(
      Buffer.from(body, "base64url")
        .toString()
        .replace('"reader"', '"internal"'),
    ).toString("base64url");
    expect(readDemoToken(`${forged}.${signature}`, secret, now)).toBeNull();
  });
  it("rejects a changed signature and a wrong signing secret", () => {
    const token = issueDemoSession("internal", secret, undefined, now);
    const [body, signature] = token.split(".");
    const changed = (signature[0] === "a" ? "b" : "a") + signature.slice(1);
    expect(readDemoToken(`${body}.${changed}`, secret, now)).toBeNull();
    expect(readDemoToken(token, "another-secret", now)).toBeNull();
  });
  it.each([
    undefined,
    "",
    "missing-signature",
    ".missing-body",
    "body.signature.extra",
    "a".repeat(2049),
  ])("rejects missing or malformed token %s", (token) =>
    expect(readDemoToken(token, secret, now)).toBeNull(),
  );
  it("rejects extra separators or invalid signature characters", () => {
    const token = issueDemoSession("reader", secret, undefined, now);
    expect(verifyToken(`${token}.`, secret)).toBeNull();
    expect(verifyToken(`${token}!`, secret)).toBeNull();
  });
  it.each([
    "not-json",
    JSON.stringify({
      account: "superuser",
      name: "Reader",
      handle: "reader",
      expires: now + lifetime,
    }),
    JSON.stringify({
      account: "reader",
      name: "Reader",
      handle: "reader",
      expires: now + lifetime,
      internal: true,
    }),
    JSON.stringify({
      account: "reader",
      name: "Reader",
      handle: "reader",
      expires: now + lifetime,
      id: uid(901),
    }),
  ])(
    "rejects invalid or privilege-bearing payloads even if signed",
    (payload) => {
      expect(readDemoToken(signToken(payload, secret), secret, now)).toBeNull();
    },
  );
  it.each(["owner", "reader", "creator"] as const)(
    "does not give a regular %s internal privileges",
    (account) => {
      const token = issueDemoSession(account, secret, undefined, now);
      expect(readDemoToken(token, secret, now)).toMatchObject({
        account,
        internal: false,
      });
    },
  );
  it("recognizes the separately issued internal session", () => {
    const token = issueDemoSession("internal", secret, undefined, now);
    expect(readDemoToken(token, secret, now)).toEqual({
      account: "internal",
      internal: true,
      user: demoAccounts.internal.user,
    });
  });
  it("keeps identity fixed to the account while accepting profile edits", () => {
    const token = issueDemoSession(
      "reader",
      secret,
      {
        id: demoAccounts.internal.user.id,
        display_name: "Updated Reader",
        handle: "new_reader",
      },
      now,
    );
    expect(readDemoToken(token, secret, now)).toEqual({
      account: "reader",
      internal: false,
      user: {
        ...demoAccounts.reader.user,
        display_name: "Updated Reader",
        handle: "new_reader",
      },
    });
  });
  it("accepts a cleared optional handle in a valid session", () => {
    const token = issueDemoSession(
      "reader",
      secret,
      { ...demoAccounts.reader.user, handle: null },
      now,
    );
    expect(readDemoToken(token, secret, now)?.user.handle).toBeNull();
  });
});

describe("separate internal access credential", () => {
  it("fails closed when the configured key is missing or too short", () => {
    expect(validInternalKey("", undefined)).toBe(false);
    expect(validInternalKey("short", "short")).toBe(false);
    expect(validInternalKey("a".repeat(23), "a".repeat(23))).toBe(false);
  });
  it("rejects the wrong key and accepts an exact sufficiently long key", () => {
    expect(validInternalKey("wrong-key", internalKey)).toBe(false);
    expect(validInternalKey(internalKey + " ", internalKey)).toBe(false);
    expect(validInternalKey(internalKey, internalKey)).toBe(true);
  });
});

describe("profile editing input", () => {
  it("normalizes display name and handle for storage", () => {
    expect(
      profileInput.parse({
        display_name: "  Chidambar Rao Serusanagandla  ",
        handle: "  Chidambar_2026  ",
      }),
    ).toEqual({
      display_name: "Chidambar Rao Serusanagandla",
      handle: "chidambar_2026",
    });
  });
  it("converts an empty optional handle to null", () => {
    expect(
      profileInput.parse({ display_name: "Reader", handle: "   " }).handle,
    ).toBeNull();
  });
  it.each(["ab", "1reader", "reader-name", "reader name", "a".repeat(31)])(
    "rejects invalid handle %s",
    (handle) => {
      expect(
        profileInput.safeParse({ display_name: "Reader", handle }).success,
      ).toBe(false);
    },
  );
  it("strips attempted identity and role edits", () => {
    expect(
      profileInput.parse({
        display_name: "Reader",
        handle: "reader",
        id: uid(901),
        internal: true,
      }),
    ).toEqual({ display_name: "Reader", handle: "reader" });
  });
});

describe("creator-only demo group settings", () => {
  const settings = {
    name: "Roommates at Breakfast",
    description: "Three roommates and a much earlier conversation.",
    category: "Roommates",
  };
  it("allows one of the group’s creators to edit only settings", () => {
    const state = { ...initialDemo, user: demoAccounts.creator.user };
    const result = configureDemoGroup(state, demoGroups[0], {
      ...settings,
      created_by: uid(901),
      admins: [demoAccounts.internal.user],
      access_type: "premium",
    });
    expect(result.groupSettings?.[demoGroups[0].id]).toEqual(settings);
    expect(result.groups).toEqual(state.groups);
    expect(demoGroups[0].created_by).toBe(demoAccounts.creator.user.id);
  });
  it.each(["reader", "owner", "internal"] as const)(
    "denies a %s without creator membership",
    (account) => {
      expect(() =>
        configureDemoGroup(
          { ...initialDemo, user: demoAccounts[account].user },
          demoGroups[0],
          settings,
        ),
      ).toThrow(/creators/i);
    },
  );
  it("denies an anonymous visitor and a creator of another group", () => {
    expect(() =>
      configureDemoGroup(initialDemo, demoGroups[0], settings),
    ).toThrow(/sign in/i);
    expect(() =>
      configureDemoGroup(
        { ...initialDemo, user: demoAccounts.creator.user },
        demoGroups[1],
        settings,
      ),
    ).toThrow(/creators/i);
  });
});
