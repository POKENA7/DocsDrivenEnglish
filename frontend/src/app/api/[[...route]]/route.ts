import "server-only";

import { Hono } from "hono";
import { handle } from "hono/vercel";

import { toErrorResponse } from "./errors";
import { documentApp } from "./document";
import { historyApp } from "./history";
import { quizApp } from "./quiz";

export const apiApp = new Hono().basePath("/api");

apiApp.route("/document", documentApp);
apiApp.route("/quiz", quizApp);
apiApp.route("/history", historyApp);

apiApp.onError((err, c) => toErrorResponse(c, err));

export const GET = handle(apiApp);
export const POST = handle(apiApp);
export const PUT = handle(apiApp);
export const PATCH = handle(apiApp);
export const DELETE = handle(apiApp);
export const OPTIONS = handle(apiApp);
