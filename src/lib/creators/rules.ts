import { z } from "zod";
export const inviteHandleInput = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, "").toLowerCase())
  .pipe(
    z
      .string()
      .regex(/^[a-z][a-z0-9_]{2,29}$/, "Enter an existing user's handle."),
  );
