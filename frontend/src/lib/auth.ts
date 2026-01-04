import "server-only";

import { auth } from "@clerk/nextjs/server";

import { ApiError } from "@/app/api/[[...route]]/errors";

export function getOptionalUserId(): string | null {
  const { userId } = auth();
  return userId ?? null;
}

export function requireUserId(): string {
  const { userId } = auth();
  if (!userId) {
    throw new ApiError("UNAUTHORIZED", 401, "Unauthorized");
  }
  return userId;
}
