import "server-only";
import { Prisma } from "@prisma/client";

import { database } from "../prisma";

import { TemplateError } from "./errors";

export { database } from "../prisma";
export type Connection = Prisma.TransactionClient;

// Existing SQL is trusted application code; all request values stay separate
// as MySQL placeholders, including dynamic IN lists. Never interpolate values.
export async function rows<T>(sql: string, values: unknown[] = [], conn?: Connection): Promise<T[]> {
  const result = await (conn ?? database()).$queryRawUnsafe(sql, ...values.map(sqlValue));
  return JSON.parse(
    JSON.stringify(result, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
  ) as T[];
}
export async function write(sql: string, values: unknown[] = [], conn?: Connection) {
  return (conn ?? database()).$executeRawUnsafe(sql, ...values.map(sqlValue));
}
export function isDuplicateKey(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || (error.code === "P2010" && String(error.meta?.code) === "1062"))
  );
}
export async function transaction<T>(work: (conn: Connection) => Promise<T>): Promise<T> {
  try {
    return await database().$transaction(async (conn) => {
      await conn.$executeRaw`SET time_zone = '+00:00'`;
      return work(conn);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (["P2034", "P2028", "P2024"].includes(error.code) ||
        (error.code === "P2010" && ["1205", "1213"].includes(String(error.meta?.code))))
    ) {
      throw new TemplateError("REQUEST_IN_PROGRESS", 409, "Please retry this request.", true);
    }
    throw error;
  }
}
export function parseJSON<T>(v: T | string): T {
  return typeof v === "string" ? (JSON.parse(v) as T) : v;
}

function sqlValue(v: unknown) {
  if (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean" ||
    v instanceof Date ||
    Buffer.isBuffer(v)
  )
    return v;
  throw new Error("Unsupported SQL parameter");
}
