import { z } from "zod";
import { REACTIONS } from "./types";
export const groupInput = z.object({
  name: z.string().trim().min(3).max(80),
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(240),
  category: z.enum([
    "Roommates",
    "Friendship",
    "Comedy",
    "Relationships",
    "Career",
    "Travel",
  ]),
});
export const questionInput = z
  .string()
  .trim()
  .min(5, "Please write at least 5 characters.")
  .max(500);
export const messageInput = z
  .string()
  .trim()
  .min(1, "Write a message first.")
  .max(2000);
export const answerInput = z
  .string()
  .trim()
  .min(1, "Write an answer first.")
  .max(1400);
export const reactionInput = z.enum(REACTIONS);
export const uuidInput = z.uuid();
export const groupSettingsInput = groupInput.pick({
  name: true,
  description: true,
  category: true,
});
export const profileInput = z.object({
  display_name: z.string().trim().min(2).max(60),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (v) => v === "" || /^[a-z][a-z0-9_]{2,29}$/.test(v),
      "Use 3–30 letters, numbers or underscores, starting with a letter.",
    )
    .transform((v) => v || null),
});
export function requireIdentity(
  userId: string | null,
): asserts userId is string {
  if (!userId) throw new Error("Please sign in to continue.");
}
export function requireAdmin(userId: string | null, admins: string[]) {
  requireIdentity(userId);
  if (!admins.includes(userId))
    throw new Error("Only this circle’s creators can do that.");
}
