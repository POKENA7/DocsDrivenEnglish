import "server-only";

import { auth } from "@clerk/nextjs/server";

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("ログインが必要です");
  }
  return userId;
}
