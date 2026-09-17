import nextEnv from "@next/env";
import { readFileSync, readdirSync, unlinkSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { createCleanupClient, cleanup } from "./cleanup.mjs";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const args = process.argv.slice(2);
function value(name) {
  const position = args.indexOf(name);
  return position < 0 ? undefined : args[position + 1];
}
const projectRef =
  value("--project-ref") || process.env.E2E_SUPABASE_PROJECT_REF;
const dryRun = !args.includes("--apply");
const runs = resolve(".e2e-runs");

function journalPath(input) {
  const path = resolve(input);
  const rel = relative(runs, path);
  if (
    !rel ||
    rel.startsWith("..") ||
    isAbsolute(rel) ||
    !path.endsWith(".json")
  )
    throw new Error(
      "Recovery journals must be JSON files inside this repository's .e2e-runs directory.",
    );
  return path;
}
function listJournals(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listJournals(path);
    return entry.isFile() && path.endsWith(".json") ? [journalPath(path)] : [];
  });
}
try {
  const allowed = new Set([
    "--project-ref",
    "--apply",
    "--journal",
    "--recover",
  ]);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error("Unknown cleanup argument.");
    if (args[i] === "--project-ref" || args[i] === "--journal") {
      if (!args[++i] || args[i].startsWith("--"))
        throw new Error("Missing cleanup argument value.");
    }
  }
  if (args.includes("--recover") && value("--journal"))
    throw new Error("Choose --recover or --journal, not both.");
  const db = createCleanupClient(projectRef);
  const journals = value("--journal")
    ? [journalPath(value("--journal"))]
    : args.includes("--recover")
      ? listJournals(runs)
      : [];
  if (args.includes("--recover") || value("--journal")) {
    for (const path of journals) {
      const journal = JSON.parse(readFileSync(path, "utf8"));
      if (journal.version !== 1 || journal.projectRef !== projectRef)
        throw new Error(
          "Recovery journal version/project mismatch; nothing further deleted.",
        );
      const summary = await cleanup(db, {
        ...journal,
        projectRef,
        legacy: false,
        dryRun,
      });
      console.log(
        JSON.stringify(
          { projectRef, journal: relative(runs, path), ...summary },
          null,
          2,
        ),
      );
      if (!dryRun) unlinkSync(path);
    }
    console.log(`Inspected ${journals.length} recovery journal(s).`);
  } else {
    console.log(
      JSON.stringify(
        {
          projectRef,
          ...(await cleanup(db, { projectRef, legacy: true, dryRun })),
        },
        null,
        2,
      ),
    );
    console.log(
      "Historical unmarked visitor analytics/assignments and shared Inbox threads are preserved.",
    );
  }
} catch (error) {
  // Error messages from our module contain operation names only, never raw SDK errors.
  console.error(
    error instanceof Error && error.message.startsWith("E2E cleanup")
      ? error.message
      : "Cleanup stopped. Check the explicit project ref, private environment, journal and configuration; no raw credentials or response details are printed.",
  );
  process.exitCode = 1;
}
