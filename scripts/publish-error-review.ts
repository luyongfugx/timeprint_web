import { readFile } from "node:fs/promises";

import { reviewSchema } from "../src/lib/error-reviews/contracts";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: error-reviews:publish -- path/to/review.json [--validate]");
  const bytes = await readFile(file);
  if (bytes.length > 2 * 1024 * 1024) throw new Error("Report exceeds 2 MiB");
  const report = reviewSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (process.argv.includes("--validate")) {
    console.log(`Validated ${report.date}: ${report.evidence.length} samples, ${report.findings.length} findings.`);
    return;
  }
  const origin = process.env.ERROR_REVIEW_WEB_ORIGIN;
  const token = process.env.ERROR_REVIEW_API_TOKEN;
  if (!origin || !token || token.length < 32)
    throw new Error(
      "Configure ERROR_REVIEW_WEB_ORIGIN / ERROR_REVIEW_API_TOKEN, or import the validated JSON in the admin page.",
    );
  const url = new URL("/api/admin/error-reviews", origin);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
    throw new Error("Use HTTPS (except localhost).");
  const res = await fetch(url, {
    method: "POST",
    redirect: "error",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(report),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Publish failed (${res.status}); keep runId unchanged when retrying.`);
  console.log(`Saved: ${new URL(`/dashboard/error-reviews?date=${report.date}&run=${report.runId}`, origin)}`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Publish failed");
  process.exitCode = 1;
});
