import { Hono } from "hono";
import { handle } from "hono/vercel";

import { toErrorResponse } from "./errors";
import historyApp from "./history";
import quizApp from "./quiz";

const app = new Hono().basePath("/");

const routes = app
  .route("/quiz", quizApp)
  .route("/history", historyApp)
  .onError((err, c) => toErrorResponse(c, err));

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
export type AppType = typeof routes;
