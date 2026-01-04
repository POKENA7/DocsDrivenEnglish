import "server-only";

import { Hono } from "hono";

import { toErrorResponse } from "./errors";
import historyApp from "./history";
import quizApp from "./quiz";

export const apiApp = new Hono()
  .basePath("/api")
  .route("/quiz", quizApp)
  .route("/history", historyApp)
  .onError((err, c) => toErrorResponse(c, err));

export type AppType = typeof apiApp;
