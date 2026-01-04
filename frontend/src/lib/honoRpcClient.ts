import { hc } from "hono/client";

import type { AppType } from "@/app/api/[[...route]]/route";

// export type HonoRpcClient = {
//   quiz: {
//     session: {
//       $post: (args: { json: { url: string; mode: "word" | "reading" } }) => Promise<Response>;
//     };
//     answer: {
//       $post: (args: {
//         json: { sessionId: string; questionId: string; selectedIndex: number };
//       }) => Promise<Response>;
//     };
//   };
//   history: {
//     summary: {
//       $get: () => Promise<Response>;
//     };
//   };
// };

export function createHonoRpcClient(baseUrl?: string) {
  return hc<AppType>(baseUrl ?? "");
}

// export const honoRpcClient = createHonoRpcClient();
export const honoRpcClient = hc<AppType>("/");
