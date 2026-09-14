import { PrismaClient } from "@prisma/client";
import { databaseURL } from "./database-config.mjs";
export { databaseURL, databaseConfigured } from "./database-config.mjs";

export function createDatabase() {
  return new PrismaClient({
    datasources: { db: { url: databaseURL() } },
    log: [],
    transactionOptions: { maxWait: 30_000, timeout: 30_000 },
  });
}
