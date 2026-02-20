import type { SWRConfiguration } from "swr";

class ApiClientError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(args: { status: number; message: string; body?: unknown }) {
    super(args.message);
    this.name = "ApiClientError";
    this.status = args.status;
    this.body = args.body;
  }
}

function getMessageFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;

  const record = body as Record<string, unknown>;
  const message = record.message;
  return typeof message === "string" ? message : null;
}

async function readJsonSafely(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function unwrapJson<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }

  const body = await readJsonSafely(res);
  const message = getMessageFromBody(body) ?? `Request failed (${res.status})`;

  throw new ApiClientError({ status: res.status, message, body });
}

export async function rpcJson<T>(request: Promise<Response>): Promise<T> {
  const res = await request;
  return unwrapJson<T>(res);
}

export const swrCommonConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  shouldRetryOnError: true,
  onErrorRetry: (error, _key, _config, revalidate, ctx) => {
    const retryCount = ctx.retryCount;

    if (error instanceof ApiClientError) {
      if (error.status >= 400 && error.status < 500) return;
    }

    if (retryCount >= 2) return;

    const delayMs = 400 * 2 ** retryCount;
    setTimeout(() => {
      revalidate({ retryCount: retryCount + 1 });
    }, delayMs);
  },
};
