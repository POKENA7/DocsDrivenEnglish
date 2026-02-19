import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getEnv } from "@/app/env/env";

export const OPENAI_TIMEOUT_MS = 90_000;
export const OPENAI_MAX_OUTPUT_TOKENS = 2_048;

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

    const outputParsed = response.output_parsed;
    if (outputParsed !== null) {
      console.log("[openai] responses.parse success", {
        schemaName,
        model: response.model,
        responseId: response.id,
      });
      return outputParsed;
    }

    const status = (response as unknown as { status?: string }).status;
    const incompleteDetails = (response as unknown as { incomplete_details?: unknown })
      .incomplete_details;
    if (status === "incomplete" || incompleteDetails) {
      console.log("[openai] responses.parse incomplete", {
        schemaName,
        model: response.model,
        responseId: response.id,
        status,
        incompleteDetails,
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

    let json: unknown;
    try {
      json = JSON.parse(rawText) as unknown;
    } catch (e) {
      console.log("[openai] responses.parse fallback JSON.parse failed", {
        schemaName,
        model: response.model,
        responseId: response.id,
        rawTextHead: rawText.slice(0, 400),
      });
      throw e;
    }
    const parsedByZod = schema.parse(json) as z.infer<TSchema>;

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
