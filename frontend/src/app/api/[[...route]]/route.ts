import "server-only";

import { Hono } from "hono";
import { handle } from "hono/vercel";

import { toErrorResponse } from "./errors";
import historyApp from "./history";
import quizApp from "./quiz";

export const apiApp = new Hono()
  .basePath("/api")
  .route("/quiz", quizApp)
  .route("/history", historyApp)
  .onError((err, c) => toErrorResponse(c, err));

export const GET = handle(apiApp);
export const POST = handle(apiApp);
export const PUT = handle(apiApp);
export const PATCH = handle(apiApp);
export const DELETE = handle(apiApp);
export const OPTIONS = handle(apiApp);
export type AppType = typeof apiApp;
