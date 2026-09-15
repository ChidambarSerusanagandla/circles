import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/supabase/server", () => ({
  supabase: async () => ({
    auth: {
      signInWithPassword: mocks.signIn,
      signUp: mocks.signUp,
      signOut: mocks.signOut,
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/data", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/auth/demo-server", () => ({
  readDemoSession: vi.fn(),
  demoCookieOptions: vi.fn(),
}));

import { authenticate, signOut } from "../../src/app/auth/actions";

const input = {
  email: "logging-test@example.invalid",
  password: "test-only-password-never-log",
  display_name: "Logging test",
};
const session = {
  access_token: "test-only-access-token",
  refresh_token: "test-only-refresh-token",
};
// Deliberately sensitive error details must never reach logs or action results.
const sensitiveError = {
  message: input.password,
  payload: input,
  session,
  cookie: "test-only-session-cookie",
  key: "test-only-server-secret",
};
const methods = [
  "log",
  "info",
  "debug",
  "warn",
  "error",
  "trace",
  "dir",
  "table",
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of methods)
    vi.spyOn(console, method).mockImplementation(() => {});
});

afterEach(() => {
  try {
    // Check every call, not just matching strings: serialized/encoded payloads
    // and new password values must also fail this regression check.
    for (const method of methods)
      expect(console[method]).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

describe("connected auth keeps credentials out of logs", () => {
  it("signs in with the unchanged credentials and returns only a safe result", async () => {
    mocks.signIn.mockResolvedValue({ data: { session }, error: null });
    expect(await authenticate(input, false)).toEqual({
      ok: true,
      message: "Signed in. Welcome to Circles.",
    });
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it.each([false, true])(
    "does not log a returned auth error (signup=%s)",
    async (signup) => {
      (signup ? mocks.signUp : mocks.signIn).mockResolvedValue({
        data: { session: null },
        error: sensitiveError,
      });
      expect(await authenticate(input, signup)).toEqual({
        ok: false,
        message: signup
          ? "Could not create your account. Please check your details and try again."
          : "Email or password wasn’t recognized.",
      });
      expect(mocks.revalidate).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "does not log a thrown auth payload (signup=%s)",
    async (signup) => {
      (signup ? mocks.signUp : mocks.signIn).mockRejectedValue(sensitiveError);
      expect(await authenticate(input, signup)).toEqual({
        ok: false,
        message: "Authentication is unavailable. Please try again shortly.",
      });
    },
  );

  it.each([null, session])(
    "preserves signup confirmation/session behavior without logging",
    async (createdSession) => {
      mocks.signUp.mockResolvedValue({
        data: { session: createdSession },
        error: null,
      });
      expect(await authenticate(input, true)).toEqual({
        ok: true,
        message: createdSession
          ? "Signed in. Welcome to Circles."
          : "Check your email to confirm your account, then sign in.",
      });
      expect(mocks.signUp).toHaveBeenCalledWith({
        email: input.email,
        password: input.password,
        options: { data: { display_name: input.display_name } },
      });
    },
  );

  it("rejects invalid credentials without logging them or calling Supabase", async () => {
    const result = await authenticate({ ...input, password: "short" }, false);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("short");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it.each([null, sensitiveError])(
    "preserves sign-out behavior without logging session/error details",
    async (error) => {
      mocks.signOut.mockResolvedValue({ error });
      expect(await signOut()).toEqual(
        error
          ? { ok: false, message: "Could not sign out. Please try again." }
          : { ok: true, message: "You’ve signed out." },
      );
    },
  );
});
