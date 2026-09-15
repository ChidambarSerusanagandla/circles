import { z } from "zod";

export const inboxHandle = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, "").toLowerCase())
  .pipe(
    z
      .string()
      .regex(/^[a-z][a-z0-9_]{2,29}$/, "Enter a valid handle, such as @rahul."),
  );
export const inboxContent = z
  .string()
  .trim()
  .min(1, "Write a message first.")
  .max(2000, "Keep your message under 2,000 characters.");
export function participantPair(userId: string, peerId: string) {
  z.uuid().parse(userId);
  z.uuid().parse(peerId);
  if (userId === peerId) throw new Error("Choose another person to message.");
  return [userId, peerId].sort() as [string, string];
}
