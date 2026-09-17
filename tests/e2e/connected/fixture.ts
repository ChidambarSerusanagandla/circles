import { test as base } from "@playwright/test";
import { TestRun } from "./run-journal";

export { expect } from "@playwright/test";
export const test = base.extend({
  context: [
    async ({ context, baseURL }, provide, info) => {
      const run = new TestRun(info);
      try {
        await run.addContext(context, baseURL!);
        await provide(context);
      } finally {
        await run.finish();
      }
    },
    { scope: "test", timeout: 90_000 },
  ],
});
