import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
} from "@playwright/test/reporter";

// Browser traces are disabled. Also redact failures: Playwright call logs can
// include locator.fill arguments even when the app itself never logs them.
export function redact(value: string) {
  let safe = value;
  for (const [name, secret] of Object.entries(process.env)) {
    if (
      /PASSWORD|SECRET|TOKEN|COOKIE|KEY/i.test(name) &&
      secret &&
      secret.length >= 8
    )
      for (const encoded of [
        secret,
        JSON.stringify(secret).slice(1, -1),
        encodeURIComponent(secret),
      ])
        safe = safe.split(encoded).join("[REDACTED]");
  }
  return safe
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[REDACTED TOKEN]",
    )
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[REDACTED KEY]")
    .replace(
      /((?:password|refresh_token|access_token|cookie|authorization)["']?\s*[:=]\s*)[^\r\n]+/gi,
      "$1[REDACTED]",
    );
}

export default class SafeReporter implements Reporter {
  private directory = "";
  private rows: {
    project: string;
    title: string;
    status: string;
    duration: number;
    errors: string[];
  }[] = [];
  onBegin(config: FullConfig, suite: Suite) {
    this.directory = config.projects[0].outputDir;
    console.log(
      `Running ${suite.allTests().length} ${config.metadata.mode} E2E tests`,
    );
  }
  onTestEnd(test: TestCase, result: TestResult) {
    const row = {
      project: test.parent.project()?.name || "",
      title: test.title,
      status: result.status,
      duration: result.duration,
      errors: result.errors.map((error) =>
        redact(error.stack || error.message || "Test failed"),
      ),
    };
    this.rows.push(row);
    console.log(redact(`[${row.project}] ${row.status}: ${row.title}`));
    for (const error of row.errors) console.log(error);
  }
  onStdOut(chunk: string | Buffer) {
    process.stdout.write(redact(chunk.toString()));
  }
  onStdErr(chunk: string | Buffer) {
    process.stderr.write(redact(chunk.toString()));
  }
  onError(error: TestError) {
    console.error(redact(error.stack || error.message || "Runner failed"));
  }
  onEnd(result: FullResult) {
    const counts = { passed: 0, failed: 0, skipped: 0 };
    for (const row of this.rows) {
      if (row.status === "passed") counts.passed++;
      else if (row.status === "skipped") counts.skipped++;
      else counts.failed++;
    }
    console.log(JSON.stringify({ status: result.status, ...counts }));
    if (this.directory) {
      mkdirSync(this.directory, { recursive: true });
      writeFileSync(
        join(this.directory, "safe-results.json"),
        JSON.stringify(
          { status: result.status, counts, tests: this.rows },
          null,
          2,
        ),
      );
    }
  }
}
