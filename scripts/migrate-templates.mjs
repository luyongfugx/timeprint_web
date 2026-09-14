import fs from "node:fs/promises";
import { createDatabase } from "./lib/prisma.mjs";
// Explicit CLI operation; never runs on app startup or in npm install hooks.
const apply = process.argv.includes("--apply");
const c = createDatabase();
try {
  const version = await c.$queryRawUnsafe("SELECT VERSION() AS version");
  if (!/^8\.|^9\./.test(version[0].version))
    throw new Error("MySQL 8.0.16+ is required; MariaDB and MySQL 5.7 have not been validated.");
  const columns = await c.$queryRawUnsafe(
    "SELECT COLUMN_NAME,COLUMN_TYPE,DATA_TYPE,EXTRA,COLUMN_DEFAULT,CHARACTER_SET_NAME,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='watermarks_share_links'",
  );
  const engine = await c.$queryRawUnsafe(
    "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='watermarks_share_links'",
  );
  let idType = "BIGINT UNSIGNED";
  if (columns.length) {
    if (engine[0]?.ENGINE !== "InnoDB") throw new Error("Existing table must use InnoDB for atomic publication.");
    const id = columns.find((c) => c.COLUMN_NAME === "id");
    if (
      !id ||
      !/^(tinyint|smallint|mediumint|int|bigint)(\(\d+\))?( unsigned)?$|^(var)?char\(\d+\)$/i.test(id.COLUMN_TYPE)
    )
      throw new Error("Unsupported existing ID type; review the baseline manually.");
    if (!id.EXTRA.includes("auto_increment") && id.COLUMN_DEFAULT == null)
      throw new Error("ID requires an existing server-side default or AUTO_INCREMENT.");
    idType =
      id.COLUMN_TYPE +
      (id.CHARACTER_SET_NAME ? ` CHARACTER SET ${id.CHARACTER_SET_NAME} COLLATE ${id.COLLATION_NAME}` : "");
    if (columns.some((c) => c.COLUMN_NAME === "contract_version"))
      throw new Error("Migration already applied or partially applied; inspect before retrying.");
    if (!columns.some((c) => c.COLUMN_NAME === "created_at" && ["datetime", "timestamp"].includes(c.DATA_TYPE)))
      throw new Error("Unverified legacy created_at type.");
    const conflicts = await c.$queryRawUnsafe(
      "SELECT COUNT(*) AS total FROM (SELECT UPPER(share_code) FROM watermarks_share_links GROUP BY UPPER(share_code) HAVING COUNT(*)>1) conflicts",
    );
    if (Number(conflicts[0].total))
      throw new Error("Duplicate share codes require manual historical ownership review.");
    const invalid = await c.$queryRawUnsafe(
      "SELECT COUNT(*) AS total FROM watermarks_share_links WHERE share_code IS NULL OR CHAR_LENGTH(share_code)>10 OR created_at IS NULL",
    );
    if (Number(invalid[0].total)) throw new Error("Invalid historical code/date requires review.");
  }
  console.log(
    JSON.stringify(
      {
        version: version[0].version,
        existingTable: columns.length > 0,
        columns: columns.map((c) => ({ name: c.COLUMN_NAME, type: c.COLUMN_TYPE })),
        idType,
        mode: apply ? "apply" : "preflight",
      },
      null,
      2,
    ),
  );
  if (apply) {
    const sql = (
      await fs.readFile(new URL("../mysql/migrations/001_template_platform.sql", import.meta.url), "utf8")
    ).replaceAll("{{TEMPLATE_ID_TYPE}}", idType);
    const statements = sql
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) await c.$executeRawUnsafe(statement);
    console.log("Template migration applied. Capabilities remain controlled by environment flags.");
  }
} catch (error) {
  console.error(
    error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientInitializationError"
      ? `Database operation failed (${error.code ?? "connection"}); check configuration and schema.`
      : error.message,
  );
  process.exitCode = 1;
} finally {
  await c.$disconnect();
}
