"use client";
import type { ActionResult } from "../types";
import type { DemoAccount } from "./demo-accounts";
export async function signInDemo(
  account: DemoAccount,
  key?: string,
): Promise<ActionResult> {
  try {
    const response = await fetch("/api/demo/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, ...(key ? { key } : {}) }),
    });
    return await response.json();
  } catch {
    return { ok: false, message: "Could not sign in. Please try again." };
  }
}
