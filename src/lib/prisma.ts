import "server-only";
import type { PrismaClient } from "@prisma/client";

import { createDatabase, databaseConfigured } from "../../scripts/lib/prisma.mjs";

import { unavailable } from "./templates/errors";

const shared = globalThis as unknown as { timeprintPrisma?: PrismaClient };

// Lazy initialization allows builds and capabilities checks without DB secrets.
// Reuse the pool across Next.js development reloads.
export function database(): PrismaClient {
  if (!databaseConfigured()) unavailable();
  return (shared.timeprintPrisma ??= createDatabase());
}
