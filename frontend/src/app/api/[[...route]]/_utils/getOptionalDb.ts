import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createDb } from "@/db/client";

export function getOptionalDb() {
  try {
    const { env } = getCloudflareContext();
    const db = (env as Record<string, unknown>).DB;
    if (!db) return null;
    return createDb(db as import("@cloudflare/workers-types").D1Database);
  } catch {
    return null;
  }
}
