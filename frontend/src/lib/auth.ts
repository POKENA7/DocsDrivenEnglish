import "server-only";

import { auth } from "@clerk/nextjs/server";

import { ApiError } from "@/app/api/[[...route]]/errors";

export async function getOptionalUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new ApiError("UNAUTHORIZED", 401, "Unauthorized");
  }
  return userId;
}
