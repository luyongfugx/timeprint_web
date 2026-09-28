import { randomUUID } from "node:crypto";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";

import COS from "cos-nodejs-sdk-v5";

import { normalizeLog, stratifiedObjects, type LogObject, type Evidence } from "../src/lib/error-reviews/collect";
import { reviewWindow, yesterday } from "../src/lib/error-reviews/contracts";

const args = process.argv.slice(2);
function option(key: string, fallback: string) {
  const i = args.indexOf(key);
  return i < 0 ? fallback : (args[i + 1] ?? fallback);
}
async function main() {
  const date = option("--date", yesterday());
  const window = reviewWindow(date);
  if (date > yesterday()) throw new Error("Only completed Asia/Shanghai days can be reviewed.");
  const max = Number(option("--max-samples", "50"));
  if (!Number.isInteger(max) || max < 2 || max > 300)
    throw new Error("Sample limit must be 2–300 (combined platforms).");
  const key = process.env.ERROR_REVIEW_HASH_KEY ?? "";
  if (key.length < 32)
    throw new Error(
      "Configure ERROR_REVIEW_HASH_KEY (at least 32 characters) for consistent private device deduplication.",
    );
  const SecretId = process.env.ERROR_REVIEW_COS_SECRET_ID;
  const SecretKey = process.env.ERROR_REVIEW_COS_SECRET_KEY;
  if (!SecretId || !SecretKey)
    throw new Error("Configure read-only ERROR_REVIEW_COS_SECRET_ID / ERROR_REVIEW_COS_SECRET_KEY.");
  const cos = new COS({
    SecretId,
    SecretKey,
    ...(process.env.ERROR_REVIEW_COS_SESSION_TOKEN
      ? { SecurityToken: process.env.ERROR_REVIEW_COS_SESSION_TOKEN }
      : {}),
    Protocol: "https:",
    Timeout: 15000,
  });
  const sources = {
    android: {
      Bucket: process.env.ERROR_REVIEW_ANDROID_BUCKET ?? "timeprintandroid-1330977225",
      Region: process.env.ERROR_REVIEW_ANDROID_REGION ?? "ap-singapore",
    },
    ios: {
      Bucket: process.env.ERROR_REVIEW_IOS_BUCKET ?? "tplog-1330977225",
      Region: process.env.ERROR_REVIEW_IOS_REGION ?? "ap-singapore",
    },
  };
  const coverage = {
    android: {
      listed: 0,
      downloaded: 0,
      failed: 0,
      excluded: 0,
      unparsed: 0,
      limited: false,
      listingComplete: true,
      notes: [] as string[],
    },
    ios: {
      listed: 0,
      downloaded: 0,
      failed: 0,
      excluded: 0,
      unparsed: 0,
      limited: false,
      listingComplete: true,
      notes: [] as string[],
    },
  };
  const inventory: LogObject[] = [];
  for (const platform of ["android", "ios"] as const) {
    const seen = new Set<string>();
    let pages = 0;
    // Folder dates are client-generated. Adjacent dates cover timezone differences.
    for (const shift of [0, -1, 1]) {
      const folderDate = new Date(Date.parse(`${date}T00:00:00Z`) + shift * 86400_000)
        .toISOString()
        .slice(0, 10)
        .replaceAll("-", "");
      let marker = "";
      try {
        while (true) {
          if (++pages > 30 || seen.size >= 20000) {
            coverage[platform].listingComplete = false;
            break;
          }
          const response = await new Promise<COS.GetBucketResult>((ok, bad) =>
            cos.getBucket(
              { ...sources[platform], Prefix: `${platform}_err_log_${folderDate}/`, Marker: marker, MaxKeys: 1000 },
              (error, data) => (error ? bad(error) : ok(data)),
            ),
          );
          for (const o of response.Contents ?? [])
            if (!seen.has(o.Key) && o.Key.endsWith(".txt")) {
              if (seen.size >= 20000) {
                coverage[platform].listingComplete = false;
                break;
              }
              seen.add(o.Key);
              coverage[platform].listed++;
              inventory.push({ platform, key: o.Key, size: Number(o.Size), modified: o.LastModified });
            }
          if (String(response.IsTruncated) !== "true") break;
          if (!response.NextMarker || response.NextMarker === marker) throw new Error("Pagination stalled");
          marker = response.NextMarker;
        }
      } catch {
        coverage[platform].listingComplete = false;
        coverage[platform].notes.push(`目录 ${platform}_err_log_${folderDate} 扫描失败，不能据此判断该端无错误。`);
      }
    }
  }
  const queues = Object.fromEntries(
    (["android", "ios"] as const).map((p) => {
      const all = inventory.filter((o) => o.platform === p);
      const eligible = all.filter((o) => o.size > 0 && o.size <= 128 * 1024);
      if (eligible.length !== all.length)
        coverage[p].notes.push(`${all.length - eligible.length} 个空文件或大于 128 KiB 的对象未下载。`);
      // Review-day folders first; adjacent folders remain explicitly partial under the shared budget.
      const main = `${p}_err_log_${date.replaceAll("-", "")}/`;
      return [
        p,
        [
          ...stratifiedObjects(eligible.filter((o) => o.key.startsWith(main))),
          ...stratifiedObjects(eligible.filter((o) => !o.key.startsWith(main))),
        ],
      ];
    }),
  ) as Record<"android" | "ios", LogObject[]>;
  let attempted = 0;
  let bytes = 0;
  const evidence: Evidence[] = [];
  const ids = new Set<string>();
  download: while (attempted < max && bytes < 20 * 1024 * 1024 && (queues.android.length || queues.ios.length)) {
    for (const platform of ["android", "ios"] as const) {
      if (attempted >= max || bytes >= 20 * 1024 * 1024) break;
      const o = queues[platform].shift();
      if (!o) continue;
      if (bytes + o.size > 20 * 1024 * 1024) {
        queues[platform].unshift(o);
        break download;
      }
      attempted++;
      try {
        const data = await new Promise<COS.GetObjectResult>((ok, bad) =>
          cos.getObject(
            {
              ...sources[platform],
              Key: o.key,
              Range: `bytes=0-${Math.min(128 * 1024, 20 * 1024 * 1024 - bytes) - 1}`,
            },
            (error, result) => (error ? bad(error) : ok(result)),
          ),
        );
        const body = Buffer.isBuffer(data.Body) ? data.Body : Buffer.from(String(data.Body));
        bytes += body.length;
        if (body.length !== o.size) throw new Error("Object changed or truncated during download");
        coverage[platform].downloaded++;
        const normalized = normalizeLog(o, body.toString("utf8"), date, key);
        if (normalized.unparsed) coverage[platform].unparsed++;
        if (!normalized.evidence) coverage[platform].excluded++;
        else if (!ids.has(normalized.evidence.id)) {
          ids.add(normalized.evidence.id);
          evidence.push(normalized.evidence);
        }
      } catch {
        coverage[platform].failed++;
      }
    }
  }
  for (const p of ["android", "ios"] as const) coverage[p].limited = queues[p].length > 0;
  const folder = resolve(option("--out", `.error-reviews/${date}/${randomUUID()}`));
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await chmod(folder, 0o700);
  const draft = {
    schemaVersion: 1,
    runId: randomUUID(),
    date,
    timezone: "Asia/Shanghai",
    window,
    generatedAt: new Date().toISOString(),
    reviewed: false,
    summary: "待人工/技能分析后填写",
    notes: [
      "分层抽样，不是故障率；双端设备不能跨平台合并。",
      "仅覆盖 *_err_log_ 日期目录；旧式 API 分目录日志及反馈 runtime 日志不在本轮自动采集范围。",
    ],
    coverage,
    evidence,
    findings: [],
  };
  await writeFile(resolve(folder, "review.json"), JSON.stringify(draft, null, 2), { mode: 0o600 });
  console.log(
    JSON.stringify({ directory: folder, date, attempted, bytes, samples: evidence.length, coverage }, null, 2),
  );
}
main().catch((e) => {
  console.error(
    e instanceof Error && /Configure|Sample limit|Only completed|日期/.test(e.message)
      ? e.message
      : "Collection failed; inspect configuration and retry. No report was published.",
  );
  process.exitCode = 1;
});
