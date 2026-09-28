import { readFile } from "node:fs/promises";
import { createDatabase } from "./lib/prisma.mjs";
const sql = await readFile(new URL("../mysql/migrations/006_error_reviews.sql", import.meta.url), "utf8");
if (!process.argv.includes("--apply")) {
  console.log("Preflight: adds four error_review_* tables only. Run with --apply to create them; no existing table or data is changed.");
} else {
  const db = createDatabase();
  try {
    for (const statement of sql.replace(/^--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean))
      await db.$executeRawUnsafe(statement);
    console.log("Error review tables initialized.");
  } catch { console.error("Migration failed. Check database connectivity and CREATE permissions; retry is safe."); process.exitCode = 1; }
  finally { await db.$disconnect(); }
}
