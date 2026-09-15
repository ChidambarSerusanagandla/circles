import { profiles, uid } from "../seed-data";
import type { Profile } from "../types";
export const ownerProfile: Profile = {
  id: uid(901),
  display_name: "Chidambar Rao Serusanagandla",
  handle: "chidambar",
};
export const readerProfile: Profile = {
  id: uid(900),
  display_name: "Alex Morgan",
  handle: "alex",
};
export const demoAccounts = {
  owner: { user: ownerProfile, internal: false },
  reader: { user: readerProfile, internal: false },
  creator: { user: { ...profiles[0], handle: "rahul" }, internal: false },
  priya: { user: profiles[2], internal: false },
  arjun: { user: profiles[1], internal: false },
  internal: { user: ownerProfile, internal: true },
};
export type DemoAccount = keyof typeof demoAccounts;
export const DEMO_ACCOUNT_KEYS = [
  "owner",
  "reader",
  "creator",
  "priya",
  "arjun",
  "internal",
] as const;
