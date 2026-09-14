import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { createDatabase } from "./lib/prisma.mjs";

const file = process.argv[2];
if (!file || file.startsWith("--"))
  throw new Error("Usage: import-legacy-shares.mjs CSV_PATH [--apply-schema] [--apply]");
const parsed = spawnSync(
  "python3",
  [
    "-c",
    "import csv,json,sys\nwith open(sys.argv[1],encoding='utf-8-sig',newline='') as f: print(json.dumps(list(csv.DictReader(f))))",
    file,
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
if (parsed.status !== 0) throw new Error("Unable to parse CSV with Python 3.");
const source = JSON.parse(parsed.stdout);
assert.ok(source.length > 0, "CSV is empty");
const ids = new Set(),
  codes = new Set();
const fields = [
  "id",
  "watermark_name",
  "company_name",
  "cover_image_url",
  "json_download_url",
  "status",
  "created_at",
  "user_id",
  "share_code",
  "expire_time",
];
const input = source.map((r, index) => {
  const label = `CSV row ${index + 2}`;
  assert.deepEqual(Object.keys(r).sort(), [...fields].sort(), `${label}: unexpected columns`);
  assert.match(r.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, `${label}: expected UUID`);
  assert.ok(!ids.has(r.id), `${label}: duplicate ID`);
  ids.add(r.id);
  assert.match(r.share_code, /^(?:[A-Za-z0-9]{6}|[A-Za-z0-9]{8}|[A-Za-z0-9]{10})$/, `${label}: invalid share code`);
  assert.ok(!codes.has(r.share_code.toUpperCase()), `${label}: duplicate normalized code`);
  codes.add(r.share_code.toUpperCase());
  for (const [key, max] of [
    ["watermark_name", 255],
    ["company_name", 100],
    ["user_id", 128],
  ])
    assert.ok([...r[key]].length <= max, `${label}: field exceeds capacity`);
  for (const key of ["cover_image_url", "json_download_url"]) {
    const u = new URL(r[key]);
    assert.ok(["http:", "https:"].includes(u.protocol) && !u.username && !u.password, `${label}: invalid resource URL`);
  }
  assert.match(r.status, /^-?\d+$/, `${label}: invalid status`);
  assert.match(r.expire_time, /^\d+$/, `${label}: invalid expiry`);
  assert.ok(BigInt(r.expire_time) <= 9223372036854775807n, `${label}: expiry out of range`);
  assert.ok(Number(r.status) >= -2147483648 && Number(r.status) <= 2147483647, `${label}: status out of range`);
  assert.match(r.created_at, /(?:Z|[+-]\d\d(?::?\d\d)?)$/, `${label}: timezone missing`);
  const stamp = new Date(r.created_at.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  assert.ok(Number.isFinite(stamp.valueOf()), `${label}: invalid timestamp`);
  return { ...r, status: Number(r.status), expire_time: BigInt(r.expire_time).toString(), created_at: stamp };
});
const db = createDatabase();
const related = [
  "watermarks_share_links",
  "template_assets",
  "template_publish_requests",
  "template_uses",
  "template_reports",
  "template_requests",
];
try {
  const [{ name, version }] = await db.$queryRaw`SELECT DATABASE() AS name, VERSION() AS version`;
  assert.ok(name === "timeprint_share_wm" || name.endsWith("_test"), "Unexpected target database");
  for (const table of related) {
    const [{ total }] = await db.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM ${table}`);
    assert.equal(Number(total), 0, `Target table ${table} must be empty; refusing to overwrite data`);
  }
  const sourceSHA256 = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
  console.log(
    JSON.stringify({
      database: name,
      version,
      records: input.length,
      longNames: input.filter((x) => [...x.watermark_name].length > 100).length,
      sourceSHA256,
    }),
  );
  if (process.argv.includes("--apply-schema")) {
    const [id] =
      await db.$queryRaw`SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='watermarks_share_links' AND COLUMN_NAME='id'`;
    assert.equal(id.DATA_TYPE, "bigint", "UUID conversion requires the original empty bigint schema");
    const backup = join(homedir(), ".local/share/timeprint-backups", `legacy-import-${Date.now()}`);
    await mkdir(backup, { recursive: true, mode: 0o700 });
    const ddl = [];
    for (const table of related) {
      const [value] = await db.$queryRawUnsafe(`SHOW CREATE TABLE ${table}`);
      ddl.push(value["Create Table"] + ";");
    }
    for (const view of ["template_records", "template_asset_records"]) {
      const [value] = await db.$queryRawUnsafe(`SHOW CREATE VIEW ${view}`);
      ddl.push(value["Create View"] + ";");
    }
    await writeFile(join(backup, "before-schema.sql"), ddl.join("\n\n"), { mode: 0o600 });
    await writeFile(join(backup, "source.csv"), await readFile(file), { mode: 0o600 });
    const sql = await readFile(new URL("../mysql/migrations/003_legacy_uuid_ids.sql", import.meta.url), "utf8");
    for (const statement of sql
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.$executeRawUnsafe(statement);
    console.log("UUID schema conversion complete; backup:", backup);
  }
  if (process.argv.includes("--apply")) {
    const [id] =
      await db.$queryRaw`SELECT DATA_TYPE,CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='watermarks_share_links' AND COLUMN_NAME='id'`;
    assert.ok(id.DATA_TYPE === "char" && Number(id.CHARACTER_MAXIMUM_LENGTH) === 36, "Apply UUID migration first");
    await db.$transaction(
      async (tx) => {
        for (let i = 0; i < input.length; i += 50) {
          const batch = input.slice(i, i + 50);
          await tx.$executeRawUnsafe(
            `INSERT INTO watermarks_share_links (${fields.join(",")},contract_version,visibility,discovery_state) VALUES ${batch.map(() => "(?,?,?,?,?,?,?,?,?,?,1,NULL,'held')").join(",")}`,
            ...batch.flatMap((r) => fields.map((k) => r[k])),
          );
        }
        const result = await tx.$queryRawUnsafe(
          `SELECT ${fields.join(",")},contract_version,visibility,discovery_state FROM watermarks_share_links`,
        );
        assert.equal(result.length, input.length, "Imported count mismatch");
        const byID = new Map(result.map((r) => [r.id, r]));
        for (const original of input) {
          const stored = byID.get(original.id);
          assert.ok(stored, "Missing imported ID");
          for (const field of fields) {
            const expected = field === "created_at" ? original[field].toISOString() : String(original[field]);
            const actual = field === "created_at" ? stored[field].toISOString() : String(stored[field]);
            assert.equal(actual, expected, `Field verification failed: ${field}`);
          }
          assert.equal(stored.contract_version, 1);
          assert.equal(stored.visibility, null);
          assert.equal(stored.discovery_state, "held");
        }
      },
      { timeout: 120000, maxWait: 30000 },
    );
    console.log(`Imported and verified all ${input.length} records. Original IDs/codes/dates/status/URLs preserved.`);
  } else console.log("Data preflight only; no records inserted.");
} catch (e) {
  console.error(
    e.name?.startsWith("Prisma")
      ? `Database operation failed (${e.code ?? "connection"}); inspect before retrying.`
      : e.message,
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
