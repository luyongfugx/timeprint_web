import { readFile } from "node:fs/promises";
import { createDatabase } from "./lib/prisma.mjs";
const db = createDatabase();
try {
  const statements = (await readFile(new URL("../mysql/migrations/002_admin_login.sql", import.meta.url), "utf8"))
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await db.$executeRawUnsafe(statement);
  console.log("Administrator tables initialized. Existing passwords and account status were preserved.");
} catch {
  console.error("Administrator initialization failed; check database access and schema.");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
