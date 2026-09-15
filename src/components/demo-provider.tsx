"use client";
import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useSyncExternalStore,
} from "react";
import { DEMO_MODE } from "@/lib/config";
import { initialDemo, type DemoState } from "@/lib/demo";
import type { ActionResult, Profile } from "@/lib/types";
let sessionUser: Profile | null = null;
const KEY = "circles-demo-v2";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("circles-demo", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("circles-demo", callback);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(KEY) || JSON.stringify(initialDemo);
  } catch {
    return JSON.stringify(initialDemo);
  }
}
function parse(raw: string): DemoState {
  try {
    const stored = JSON.parse(raw);
    return stored &&
      Array.isArray(stored.memberships) &&
      Array.isArray(stored.events)
      ? { ...initialDemo, ...stored }
      : initialDemo;
  } catch {
    return initialDemo;
  }
}
export function updateDemo(
  update: (state: DemoState) => DemoState,
): ActionResult {
  try {
    const next = update({ ...parse(snapshot()), user: sessionUser });
    localStorage.setItem(KEY, JSON.stringify({ ...next, user: null }));
    window.dispatchEvent(new Event("circles-demo"));
    return { ok: true, message: "Saved in this browser." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Browser storage is unavailable.",
    };
  }
}
const Context = createContext({
  state: initialDemo,
  ready: false,
  isDemo: DEMO_MODE,
});
export function DemoProvider({
  children,
  user,
}: {
  children: React.ReactNode;
  user: Profile | null;
}) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const state = useMemo(() => ({ ...parse(raw), user }), [raw, user]);
  useEffect(() => {
    sessionUser = user;
    return () => {
      sessionUser = null;
    };
  }, [user]);
  return (
    <Context.Provider value={{ state, ready: !!raw, isDemo: DEMO_MODE }}>
      {children}
    </Context.Provider>
  );
}
export const useDemo = () => useContext(Context);
