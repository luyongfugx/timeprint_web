import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";

import { reviewSchema } from "../src/lib/error-reviews/contracts";
import { normalizeFirebaseEvent } from "../src/lib/error-reviews/firebase";

import { firebaseReviewClient } from "./lib/firebase-review-client";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: error-reviews:firebase -- draft.json [--max-samples 25]");
  const bytes = await readFile(file);
  if (bytes.length > 2 * 1024 * 1024) throw new Error("Draft too large");
  const draft = JSON.parse(bytes.toString("utf8"));
  const report = reviewSchema.parse({ ...draft, reviewed: true });
  if (report.firebaseCoverage || report.evidence.some((e) => e.source === "firebase"))
    throw new Error("Firebase already collected; reuse this draft, do not repeatedly expand sampling");
  const idx = process.argv.indexOf("--max-samples");
  const max = idx < 0 ? 25 : Number(process.argv[idx + 1]);
  if (!Number.isInteger(max) || max < 3 || max > 300 || report.evidence.length + max > 300)
    throw new Error("Combined source sample budget must be <= 300; Firebase budget >= 3");
  const key = process.env.ERROR_REVIEW_HASH_KEY;
  if (!key || key.length < 32) throw new Error("Configure ERROR_REVIEW_HASH_KEY");
  const blank = () => ({
    listed: 0,
    downloaded: 0,
    failed: 0,
    excluded: 0,
    unparsed: 0,
    limited: false,
    listingComplete: true,
    notes: [] as string[],
  });
  const coverage = { android: blank(), ios: blank() };
  const tasks = [
    { platform: "android" as const, type: "FATAL" },
    { platform: "android" as const, type: "ANR" },
    { platform: "ios" as const, type: "FATAL" },
  ];
  const clients = new Map<string, Awaited<ReturnType<typeof firebaseReviewClient>> | null>();
  const ids = new Set(report.evidence.map((e) => e.id));
  for (const [index, task] of tasks.entries()) {
    const c = coverage[task.platform];
    const credentialPath =
      process.env[`ERROR_REVIEW_FIREBASE_${task.platform.toUpperCase()}_CREDENTIALS`] ??
      process.env.ERROR_REVIEW_FIREBASE_CREDENTIALS ??
      "";
    if (!clients.has(credentialPath)) {
      try {
        clients.set(credentialPath, await firebaseReviewClient(credentialPath));
      } catch {
        clients.set(credentialPath, null);
      }
    }
    const client = clients.get(credentialPath);
    if (!client) {
      c.listingComplete = false;
      c.notes.push(`${task.type} 凭证或 OAuth 初始化失败；未采集，不能判定零错误。`);
      continue;
    }
    const resource = process.env[`ERROR_REVIEW_FIREBASE_${task.platform.toUpperCase()}_RESOURCE`];
    if (!resource) {
      c.listingComplete = false;
      c.notes.push(`${task.type} 未配置 Firebase app resource`);
      continue;
    }
    const limit = Math.floor(max / 3) + (index < max % 3 ? 1 : 0);
    try {
      const filters = {
        "filter.interval.startTime": report.window.start,
        "filter.interval.endTime": report.window.end,
        "filter.issue.errorTypes": task.type,
      };
      const summary = await client(resource + "/reports/topIssues", { ...filters, pageSize: String(limit) });
      if (summary.groups !== undefined && !Array.isArray(summary.groups)) throw new Error("Invalid issue response");
      const groups = summary.groups ?? [];
      if (summary.nextPageToken || groups.length > limit) {
        c.limited = true;
        c.listingComplete = false;
      }
      const events: unknown[] = [];
      for (const group of groups.slice(0, limit)) {
        const issueId = group.issue?.id;
        if (typeof issueId !== "string" || !issueId) {
          c.unparsed++;
          c.listingComplete = false;
          continue;
        }
        try {
          const data = await client(resource + "/events", {
            ...filters,
            pageSize: "1",
            "filter.issue.id": issueId,
            readMask:
              "name,eventTime,platform,issue,installationUuid,sessionId,version,device,operatingSystem,threads,exceptions",
          });
          if (!Array.isArray(data.events) && data.events !== undefined) throw new Error("Invalid events response");
          const rows = data.events ?? [];
          c.listed += rows.length;
          c.downloaded += rows.length;
          if (data.nextPageToken || rows.length > 1) {
            c.limited = true;
            c.listingComplete = false;
          }
          events.push(...rows.slice(0, 1));
        } catch {
          c.failed++;
          c.listingComplete = false;
        }
      }
      c.notes.push(
        `${task.type} 最多 ${limit} 个 issue，每个取窗口内最新 1 份；listed 仅为返回事件数，不是 Firebase 总量。`,
      );
      for (const raw of events.slice(0, limit)) {
        try {
          const e = normalizeFirebaseEvent(raw, task.platform, resource, report.date, key);
          if (!e) {
            c.excluded++;
            continue;
          }
          if (!ids.has(e.id)) {
            ids.add(e.id);
            report.evidence.push(e);
          }
        } catch {
          c.unparsed++;
          c.listingComplete = false;
        }
      }
    } catch (e) {
      c.failed++;
      c.listingComplete = false;
      c.notes.push(
        `${task.type} ${e instanceof Error && e.message.startsWith("Crashlytics HTTP") ? e.message : "采集失败"}；不能据此认定无错误。`,
      );
    }
  }
  const output = {
    ...report,
    runId: randomUUID(),
    generatedAt: new Date().toISOString(),
    reviewed: false,
    firebaseCoverage: coverage,
  };
  output.notes.push(
    "Firebase 覆盖 Android crash/ANR 和 iOS crash，未采集 non-fatal；最近事件抽样，不代表全量。COS 与 Firebase 标识/指纹隔离，不能相加当作独立用户或故障数。需重新审核本草稿再发布。",
  );
  reviewSchema.parse({ ...output, reviewed: true });
  const path = resolve(dirname(file), `firebase-${output.runId}.json`);
  await writeFile(path, JSON.stringify(output, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ path, coverage, totalSamples: output.evidence.length }, null, 2));
}
main().catch(() => {
  console.error(
    "Firebase collection failed: check configuration, input schema and sample budget; no report published.",
  );
  process.exitCode = 1;
});
