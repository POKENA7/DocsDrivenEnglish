import "server-only";

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "UPSTREAM_FETCH_FAILED"
  | "UPSTREAM_PARSE_FAILED"
  | "INTERNAL";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: ContentfulStatusCode;

  constructor(code: ApiErrorCode, status: ContentfulStatusCode, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function messageForApiError(error: ApiError): string {
  if (error.message && error.message.trim().length > 0) return error.message;

  switch (error.code) {
    case "BAD_REQUEST":
      return "リクエストが不正です";
    case "UNAUTHORIZED":
      return "ログインが必要です";
    case "UPSTREAM_FETCH_FAILED":
      return "ドキュメントの取得に失敗しました";
    case "UPSTREAM_PARSE_FAILED":
      return "ドキュメントの解析に失敗しました";
    case "INTERNAL":
      return "サーバーエラーが発生しました";
    default:
      return "サーバーエラーが発生しました";
  }
}

export function toErrorResponse(c: Context, error: unknown) {
  if (error instanceof ApiError) {
    return c.json({ message: messageForApiError(error) }, error.status);
  }

  return c.json({ message: "サーバーエラーが発生しました" }, 500);
}
