// Run with Node 24 --env-file=.env.local --conditions=react-server --import tsx.
// Maintenance uses database authorization and deployed signed uploads; COS secrets stay on the server.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, renameSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createDatabase } from "./lib/prisma.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const apply = args.includes("--apply");
const limit = Number(option("--limit", "1000"));
const concurrency = Number(option("--concurrency", "12"));
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) throw new Error("Invalid concurrency");
const origin = new URL(option("--origin", "https://wm.timeprint.net")).origin;
if (!["https://wm.timeprint.net", "https://team.timeprint.net"].includes(origin))
  throw new Error("Unsupported API origin");
if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error("Invalid limit");
const reportPath = option("--report");
const idsFile = option("--ids-file");
const selectedIDs = idsFile ? JSON.parse(readFileSync(idsFile, "utf8")) : null;
if (
  selectedIDs !== null &&
  (!Array.isArray(selectedIDs) ||
    !selectedIDs.length ||
    selectedIDs.length > 10000 ||
    selectedIDs.some((id) => typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)))
)
  throw new Error("--ids-file must contain a non-empty JSON array of template UUIDs");
const reason = option(
  "--reason",
  "Restore previously public legacy shares to v2 discovery, authorized by project owner on 2026-09-14.",
);
if (apply && (!reportPath || !option("--admin-email"))) throw new Error("Apply requires --report and --admin-email");
if (reportPath && existsSync(reportPath)) throw new Error("Use a new report path to preserve prior checkpoints");
const db = createDatabase();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const { fetchLegacy } = await import("../src/lib/templates/legacy-assets.ts");
const { imageMetadata } = await import("../src/lib/templates/asset-service.ts");
const { parsePayload, mapImages, payloadBytes } = await import("../src/lib/templates/payload.ts");
const { attachLegacy } = await import("../src/lib/templates/transactions.ts");
const { database } = await import("../src/lib/prisma.ts");
const { MAX_SESSION_BYTES } = await import("../src/lib/templates/contracts.ts");
process.env.TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS ??= "wm-1330977225.cos.ap-singapore.myqcloud.com";
async function seal(entry, admin) {
  const sid = randomUUID(),
    token = randomBytes(32).toString("base64url");
  // Isolated administrative import session; ordinary client session limits are unchanged.
  await db.$executeRawUnsafe(
    "INSERT INTO template_upload_sessions(id,actor_hash,client_request_id,visibility,purpose,token_hash) VALUES (?,?,?,'public','template',?)",
    sid,
    hash(`maintenance:${admin}`),
    randomUUID(),
    hash(token),
  );
  entry.uploadSessionID = sid;
  save();
  const api = async (path, body) => {
    const response = await fetch(`${origin}/api/applink/v2/upload-sessions/${sid}/${path}`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(65_000),
      headers: { "Content-Type": "application/json", "X-Template-Upload-Token": token },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw Object.assign(new Error("Upload API failed"), { code: data?.error?.code ?? `HTTP_${response.status}` });
    return data;
  };
  let total = 0;
  const saveAsset = async (bytes, kind) => {
    total += bytes.length;
    if (total > MAX_SESSION_BYTES) throw Object.assign(new Error("Session too large"), { code: "PAYLOAD_TOO_LARGE" });
    const mime = kind === "payload" ? "application/json" : (await imageMetadata(bytes)).mime;
    const a = await api("assets", {
      clientAssetID: randomUUID(),
      kind,
      contentType: mime,
      byteLength: bytes.length,
      sha256: hash(bytes),
    });
    const url = new URL(a.uploadURL);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "wm-1330977225.cos.ap-singapore.myqcloud.com" ||
      !url.pathname.startsWith("/template-assets-v2/staging/")
    )
      throw new Error("Unexpected storage target");
    const uploaded = await fetch(url, {
      method: "PUT",
      headers: a.uploadHeaders,
      body: bytes,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!uploaded.ok) throw Object.assign(new Error("COS upload failed"), { code: `COS_${uploaded.status}` });
    return a;
  };
  const cover = await saveAsset(await fetchLegacy(entry.before.cover_image_url, "cover"), "cover");
  const payload = parsePayload(await fetchLegacy(entry.before.json_download_url, "payload"), "public");
  payload.coverUrl = cover.assetReferenceURL;
  const saved = new Map();
  await mapImages(payload, async (url, kind) => {
    if (kind === "cover") return cover.assetReferenceURL;
    if (!saved.has(url)) saved.set(url, (await saveAsset(await fetchLegacy(url, "logo"), "logo")).assetReferenceURL);
    return saved.get(url);
  });
  const json = await saveAsset(payloadBytes(payload), "payload");
  await api("complete", { coverAssetID: cover.assetID, payloadAssetID: json.assetID });
  await attachLegacy(entry.before.id, sid, new Date(entry.before.updated_at).toISOString(), {
    admin,
    reason,
  });
}
const report = { startedAt: new Date().toISOString(), origin, apply, records: [] };
const save = () => {
  if (!reportPath) return;
  const path = resolve(reportPath);
  writeFileSync(
    `${path}.tmp`,
    JSON.stringify(report, (_, v) => (typeof v === "bigint" ? String(v) : v), 2),
    { mode: 0o600 },
  );
  renameSync(`${path}.tmp`, path);
};
try {
  let records = await db.$queryRawUnsafe(
    `SELECT id,share_code,updated_at,visibility,discovery_state,status,expire_time,
    cover_asset_id,payload_asset_id,cover_width,cover_height,payload_sha256,cover_image_url,json_download_url
    FROM watermarks_share_links WHERE contract_version=1 AND visibility IS NULL AND discovery_state='held'
    AND status=0 AND removed_at IS NULL AND (expire_time IS NULL OR expire_time=0 OR expire_time>UNIX_TIMESTAMP())
    ${selectedIDs ? `AND id IN (${selectedIDs.map(() => "?").join(",")})` : ""}
    ORDER BY created_at DESC,id DESC LIMIT ${limit}`,
    ...(selectedIDs ?? []),
  );
  const retryReport = option("--retry-report");
  if (retryReport) {
    const failed = new Set(
      JSON.parse(readFileSync(retryReport, "utf8"))
        .records.filter((entry) => ["failed", "uncertain"].includes(entry.outcome))
        .map((entry) => entry.before.id),
    );
    records = records.filter((record) => failed.has(record.id));
  }
  report.records = records.map((before) => ({ before, outcome: "pending" }));
  save();
  console.log(JSON.stringify({ eligible: records.length, apply }));
  if (apply && records.length) {
    const account = await db.admin_accounts.findUnique({ where: { email: option("--admin-email").toLowerCase() } });
    if (!account?.enabled || account.role !== "admin") throw new Error("An enabled administrator is required");
    let offset = 0,
      completed = 0;
    await Promise.all(
      Array.from({ length: Math.min(concurrency, records.length) }, async () => {
        while (offset < report.records.length) {
          const entry = report.records[offset++];
          try {
            await seal(entry, account.id);
            entry.outcome = "published";
          } catch (error) {
            entry.outcome = "failed";
            entry.error = error.code ?? "NETWORK_OR_RESOURCE_FAILURE";
          }
          // Confirm committed state even if the response was lost.
          const [current] = await db.$queryRawUnsafe(
            "SELECT visibility,discovery_state,cover_asset_id,payload_asset_id,status,expire_time FROM watermarks_share_links WHERE id=?",
            entry.before.id,
          );
          if (
            current?.visibility === "public" &&
            current.discovery_state === "eligible" &&
            current.cover_asset_id &&
            current.payload_asset_id
          )
            entry.outcome = "published";
          entry.after = current;
          completed++;
          save();
          if (completed % 10 === 0 || completed === records.length)
            console.log(
              JSON.stringify({
                completed,
                total: records.length,
                published: report.records.filter((e) => e.outcome === "published").length,
                failed: report.records.filter((e) => ["failed", "uncertain"].includes(e.outcome)).length,
              }),
            );
        }
      }),
    );
  }
  report.finishedAt = new Date().toISOString();
  save();
  if (apply && report.records.some((entry) => entry.outcome !== "published")) process.exitCode = 2;
} catch {
  console.error("Migration stopped; inspect the checkpoint report before resuming.");
  process.exitCode = 1;
} finally {
  await database().$disconnect();
  await db.$disconnect();
}
