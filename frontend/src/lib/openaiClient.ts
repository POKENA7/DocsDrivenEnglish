import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getEnv } from "@/app/env/env";

const OPENAI_TIMEOUT_MS = 90_000;
const OPENAI_MAX_OUTPUT_TOKENS = 2_048;

let cachedClient: OpenAI | null = null;

function isIncompleteResponse(response: {
  status?: string | null;
  incomplete_details: unknown | null;
}): boolean {
  return response.status === "incomplete" || response.incomplete_details !== null;
}

function parseFallbackOutputText(input: {
  rawText: string;
  schemaName: string;
  model: string;
  responseId: string;
}): unknown {
  try {
    return JSON.parse(input.rawText) as unknown;
  } catch (error) {
    console.log("[openai] responses.parse fallback JSON.parse failed", {
      schemaName: input.schemaName,
      model: input.model,
      responseId: input.responseId,
      rawTextHead: input.rawText.slice(0, 400),
    });
    throw error;
  }
}

function getOpenAIClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const env = getEnv();
  cachedClient = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: OPENAI_TIMEOUT_MS,
  });

  return cachedClient;
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

    console.log("[openai] response = ", response);

    if (response.output_parsed !== null) {
      console.log("[openai] responses.parse success", {
        schemaName,
        model: response.model,
        responseId: response.id,
      });
      return response.output_parsed;
    }

    if (isIncompleteResponse(response)) {
      console.log("[openai] responses.parse incomplete", {
        schemaName,
        model: response.model,
        responseId: response.id,
        status: response.status,
        incompleteDetails: response.incomplete_details,
        maxOutputTokens,
      });

      throw new Error("OpenAI response was incomplete (likely max_output_tokens reached)");
    }

    // NOTE: まれに SDK 側の都合で output_parsed が null になることがあるため、
    // output_text から JSON として復元して Zod で検証する。
    const rawText = response.output_text;
    if (!rawText) {
      throw new Error("OpenAI response.output_text is empty (output_parsed is null)");
    }

    const json = parseFallbackOutputText({
      rawText,
      schemaName,
      model: response.model,
      responseId: response.id,
    });
    const parsedByZod = schema.parse(json);

    console.log("[openai] responses.parse success (fallback)", {
      schemaName,
      model: response.model,
      responseId: response.id,
    });

    return parsedByZod;
  } finally {
    clearTimeout(timeoutId);
  }
}
