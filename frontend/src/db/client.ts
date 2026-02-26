import "server-only";

import type { D1Database } from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export function createDb(db: D1Database) {
  return drizzle(db, { schema });
}

export function getDb() {
  const { env } = getCloudflareContext();
  const db = (env as Record<string, unknown>).DB;
  if (!db) throw new Error("D1 database binding (DB) is not available");
  return createDb(db as D1Database);
}
