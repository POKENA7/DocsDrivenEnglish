import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getEnv } from "@/app/env/env";

export const OPENAI_TIMEOUT_MS = 8_000;
export const OPENAI_MAX_OUTPUT_TOKENS = 1_000;

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
  return createOpenAIResponseWithOptions(input, model);
}

export async function createOpenAIParsedText<TSchema extends z.ZodTypeAny>(
  input: string,
  model: string,
  schema: TSchema,
  schemaName: string,
  options?: {
    timeoutMs?: number;
    maxOutputTokens?: number;
  },
): Promise<z.infer<TSchema>> {
  const timeoutMs = options?.timeoutMs ?? OPENAI_TIMEOUT_MS;
  const maxOutputTokens = options?.maxOutputTokens ?? OPENAI_MAX_OUTPUT_TOKENS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await getOpenAIClient().responses.parse(
      {
        model,
        input: [{ role: "user", content: input }],
        max_output_tokens: maxOutputTokens,
        text: {
          format: zodTextFormat(schema, schemaName),
        },
      },
      { signal: controller.signal },
    );

    return response.output_parsed;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function createOpenAIResponseWithOptions(
  input: string,
  model: string,
  options?: {
    timeoutMs?: number;
    maxOutputTokens?: number;
  },
) {
  const timeoutMs = options?.timeoutMs ?? OPENAI_TIMEOUT_MS;
  const maxOutputTokens = options?.maxOutputTokens ?? OPENAI_MAX_OUTPUT_TOKENS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await getOpenAIClient().responses.create(
      {
        model,
        input,
        max_output_tokens: maxOutputTokens,
      },
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
