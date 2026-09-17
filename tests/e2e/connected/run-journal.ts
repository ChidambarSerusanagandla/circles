import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import type { BrowserContext, Request, TestInfo } from "@playwright/test";
import { VISITOR_COOKIE } from "../../../src/lib/experiments/assignment";
import {
  signVisitor,
  visitorSecret,
} from "../../../src/lib/experiments/visitor";
import { cleanup, createCleanupClient } from "../../../scripts/e2e/cleanup.mjs";

export interface Journal {
  version: 1;
  id: string;
  runId: string;
  projectRef: string;
  createdAt: string;
  groupNames: string[];
  inboxTexts: string[];
  visitorIds: string[];
  thread?: { id: string; createdByTest: boolean; baselineUpdatedAt?: string };
}

const runs = new WeakMap<TestInfo, TestRun>();
const contexts = new WeakMap<BrowserContext, TestRun>();
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function runDirectory() {
  const id = process.env.E2E_RUN_ID;
  if (!id || !UUID.test(id))
    throw new Error("Missing valid connected E2E run ID");
  return path.resolve(".e2e-runs", id);
}

export function runFor(info: TestInfo) {
  const run = runs.get(info);
  if (!run) throw new Error("Connected tests must import test from ./fixture");
  return run;
}

export class TestRun {
  readonly journal: Journal;
  private pending = new Map<BrowserContext, Set<Request>>();
  private closed = new Set<BrowserContext>();
  private file: string;

  constructor(info?: TestInfo) {
    const projectRef = process.env.E2E_SUPABASE_PROJECT_REF;
    if (!projectRef) throw new Error("E2E_SUPABASE_PROJECT_REF is required");
    const id = randomUUID();
    this.file = path.join(runDirectory(), `${id}.json`);
    this.journal = {
      version: 1,
      id,
      runId: process.env.E2E_RUN_ID!,
      projectRef,
      createdAt: new Date().toISOString(),
      groupNames: [],
      inboxTexts: [],
      visitorIds: [],
    };
    if (info) runs.set(info, this);
  }

  private async save() {
    await mkdir(runDirectory(), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify(this.journal, null, 2), {
      mode: 0o600,
    });
    await rename(temporary, this.file);
  }

  async registerGroup(name: string) {
    this.journal.groupNames.push(name);
    await this.save();
  }

  async registerInboxText(text: string) {
    this.journal.inboxTexts.push(text);
    await this.save();
  }

  async registerThread(thread: NonNullable<Journal["thread"]>) {
    this.journal.thread = thread;
    await this.save();
  }

  async visitorCookie(baseURL: string) {
    const id = randomUUID();
    this.journal.visitorIds.push(id);
    // Journal the unsigned identity before any request can create analytics.
    await this.save();
    return {
      name: VISITOR_COOKIE,
      value: signVisitor(id, visitorSecret()),
      url: new URL(baseURL).origin,
      httpOnly: true,
      sameSite: "Lax" as const,
      secure: new URL(baseURL).protocol === "https:",
    };
  }

  async addContext(context: BrowserContext, baseURL: string) {
    contexts.set(context, this);
    const pending = new Set<Request>();
    this.pending.set(context, pending);
    context.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/events")
        pending.add(request);
    });
    context.on("requestfinished", (request) => pending.delete(request));
    context.on("requestfailed", (request) => pending.delete(request));
    await context.addCookies([await this.visitorCookie(baseURL)]);
  }

  async closeContext(context: BrowserContext) {
    if (this.closed.has(context)) return;
    this.closed.add(context);
    const pending = this.pending.get(context);
    const deadline = Date.now() + 5_000;
    while (pending?.size && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      const cookies = await context.cookies();
      const db = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          auth: { debug: false },
          cookies: { getAll: () => cookies, setAll: () => {} },
        },
      );
      // Revoke only this browser's session, never every session for a seeded user.
      if (
        cookies.some(
          (cookie) =>
            cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
        )
      ) {
        const { error } = await db.auth.signOut({ scope: "local" });
        if (error)
          throw new Error("Could not revoke a connected test's local session");
      }
    } finally {
      await context.close();
    }
  }

  async finish() {
    const closed = await Promise.allSettled(
      [...this.pending.keys()].map((context) => this.closeContext(context)),
    );
    // Cleanup still runs if a browser crashed or local session revocation failed.
    await cleanup(createCleanupClient(this.journal.projectRef), {
      ...this.journal,
      dryRun: false,
    });
    // Keep even successful journals for a final sweep after every worker exits.
    if (closed.some((result) => result.status === "rejected"))
      throw new Error(
        "Connected test browser teardown failed; database cleanup completed",
      );
  }
}

export async function closePerson(context: BrowserContext) {
  const run = contexts.get(context);
  if (!run) throw new Error("Untracked connected browser context");
  await run.closeContext(context);
}

export async function retryCurrentRunJournals() {
  const directory = runDirectory();
  const files = await readdir(directory).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );
  let failed = false;
  for (const file of files.filter(
    (file) => UUID.test(file.replace(/\.json$/, "")) && file.endsWith(".json"),
  )) {
    const location = path.join(directory, file);
    try {
      const journal = JSON.parse(await readFile(location, "utf8")) as Journal;
      if (
        journal.runId !== process.env.E2E_RUN_ID ||
        journal.projectRef !== process.env.E2E_SUPABASE_PROJECT_REF
      )
        throw new Error("Journal does not belong to this connected run");
      await cleanup(createCleanupClient(journal.projectRef), {
        ...journal,
        dryRun: false,
      });
      await unlink(location);
    } catch {
      failed = true;
    }
  }
  if (failed)
    throw new Error(
      "Connected E2E cleanup failed; recovery journals remain in .e2e-runs for explicit cleanup",
    );
}
