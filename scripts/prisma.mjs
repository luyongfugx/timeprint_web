import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { databaseURL, databaseConfigured } from "./lib/database-config.mjs";

const args = process.argv.slice(2);
// Generation/validation need a syntactically valid URL, but never connect.
const offline = args[0] === "generate" || args[0] === "validate" || args[0] === "format";
if (!offline && !databaseConfigured()) throw new Error("Configure the database before running Prisma CLI.");
const url = databaseConfigured() ? databaseURL() : "mysql://unused:unused@127.0.0.1:3306/unused";
const require = createRequire(import.meta.url);
const result = spawnSync(
  process.execPath,
  [join(dirname(require.resolve("prisma/package.json")), "build/index.js"), ...args],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || join(homedir(), ".cache", "timeprint-prisma"),
      DATABASE_URL: url,
    },
  },
);
if (result.error) throw new Error("Could not start Prisma CLI.");
process.exitCode = result.status ?? 1;
