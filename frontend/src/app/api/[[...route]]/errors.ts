import "server-only";

import type { Context } from "hono";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "UPSTREAM_FETCH_FAILED"
  | "UPSTREAM_PARSE_FAILED"
  | "INTERNAL";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function toErrorResponse(c: Context, error: unknown) {
  if (error instanceof ApiError) {
    return c.json({ message: error.message }, error.status);
  }

  return c.json({ message: "Internal Server Error" }, 500);
}
