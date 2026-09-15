import assert from "node:assert/strict";
const base = process.env.ACCESS_TEST_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Use this demo access smoke check against localhost only.");
if (!process.env.DEMO_INTERNAL_ACCESS_KEY)
  throw new Error("Provide the configured local DEMO_INTERNAL_ACCESS_KEY.");
let checks = 0;
const check = (actual, expected) => {
  assert.equal(actual, expected);
  checks++;
};
async function login(account, key) {
  return fetch(base + "/api/demo/session", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ account, ...(key ? { key } : {}) }),
  });
}
for (const account of [
  null,
  "owner",
  "reader",
  "creator",
  "priya",
  "arjun",
  "internal",
]) {
  let cookie = "";
  if (account) {
    const response = await login(
      account,
      account === "internal" ? process.env.DEMO_INTERNAL_ACCESS_KEY : undefined,
    );
    check(response.status, 200);
    cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    check(cookie.includes("circles_demo_session="), true);
  }
  for (const path of ["/internal/growth", "/experiments"]) {
    const response = await fetch(base + path, {
      headers: { cookie },
      redirect: "manual",
    });
    check(
      response.status,
      account === "internal" ? (path === "/experiments" ? 307 : 200) : 404,
    );
    const body = await response.text();
    check(
      body.includes("A little more context?"),
      account === "internal" && path === "/internal/growth",
    );
  }
  if (account === "owner") {
    const body = await (
      await fetch(base + "/profile", { headers: { cookie } })
    ).text();
    check(body.includes("Chidambar Rao Serusanagandla"), true);
  }
}
check(
  (await login("internal", "incorrect-key-with-enough-characters")).status,
  403,
);
check(
  (
    await fetch(base + "/api/demo/session", {
      method: "POST",
      headers: {
        Origin: "https://example.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ account: "owner" }),
    })
  ).status,
  403,
);
const forged = await fetch(base + "/internal/growth", {
  headers: { cookie: "circles_demo_session=forged.invalid" },
});
check(forged.status, 404);
const discover = await (await fetch(base)).text();
const nav =
  discover.match(/<nav[^>]*aria-label="Main navigation"[\s\S]*?<\/nav>/)?.[0] ||
  "";
check(
  /Discover/.test(nav) &&
    /Groups/.test(nav) &&
    /Inbox/.test(nav) &&
    /Profile/.test(nav),
  true,
);
check(/Experiments|Growth|Admin/.test(nav), false);
check(
  /access premium|Join · \$|Premium<|payment is collected/.test(discover),
  false,
);
console.log(
  `Local HTTP access checks: ${checks} passed. No credentials printed.`,
);
