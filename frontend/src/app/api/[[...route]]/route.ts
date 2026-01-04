import "server-only";

import { handle } from "hono/vercel";

import { apiApp } from "./app";

export const GET = handle(apiApp);
export const POST = handle(apiApp);
export const PUT = handle(apiApp);
export const PATCH = handle(apiApp);
export const DELETE = handle(apiApp);
export const OPTIONS = handle(apiApp);
