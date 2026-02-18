import { hc } from "hono/client";

import type { AppType } from "@/app/api/[[...route]]/app";

export type HonoRpcClient = {
  quiz: {
    session: {
      $post: (args: { json: { topic: string; mode: "word" | "reading" } }) => Promise<Response>;
    };
    answer: {
      $post: (args: {
        json: { sessionId: string; questionId: string; selectedIndex: number };
      }) => Promise<Response>;
    };
  };
  history: {
    summary: {
      $get: () => Promise<Response>;
    };
  };
};

export function createHonoRpcClient(baseUrl?: string) {
  return hc<AppType>(baseUrl ?? "") as unknown as HonoRpcClient;
}

export const honoRpcClient = createHonoRpcClient("/api");
