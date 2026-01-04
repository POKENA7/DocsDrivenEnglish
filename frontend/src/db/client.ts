import "server-only";

import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export function createDb(db: D1Database) {
  return drizzle(db, { schema });
}
