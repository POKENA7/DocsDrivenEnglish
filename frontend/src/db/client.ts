import "server-only";

import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import * as schema from "./schema";

export function createDb(db: D1Database) {
  return drizzle(db, { schema });
}

export function getOptionalDb(): ReturnType<typeof createDb> | null {
  try {
    const { env } = getCloudflareContext();
    const db = (env as Record<string, unknown>).DB;
    if (!db) return null;
    return createDb(db as D1Database);
  } catch {
    return null;
  }
}
