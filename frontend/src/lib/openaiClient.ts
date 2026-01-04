import "server-only";

import OpenAI from "openai";

import { getEnv } from "@/app/env/env";

export const OPENAI_TIMEOUT_MS = 8_000;
export const OPENAI_MAX_OUTPUT_TOKENS = 800;

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const env = getEnv();
  cachedClient = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: OPENAI_TIMEOUT_MS,
  });

  return cachedClient;
}

export async function createOpenAIResponse(input: string, model: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    return await getOpenAIClient().responses.create({
      model,
      input,
      max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
