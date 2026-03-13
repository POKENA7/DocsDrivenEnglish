import "server-only";

import { z } from "zod";

import { ApiError } from "@/server/quiz/errors";

const stringArrayJsonSchema = z.array(z.string());

function createInvalidJsonColumnError(columnName: string): ApiError {
  return new ApiError("INTERNAL", `${columnName} の保存形式が不正です`);
}

export function parseJsonColumn<TSchema extends z.ZodTypeAny>(input: {
  columnName: string;
  raw: string;
  schema: TSchema;
}): z.infer<TSchema> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input.raw) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw createInvalidJsonColumnError(input.columnName);
    }

    throw error;
  }

  const result = input.schema.safeParse(parsed);
  if (!result.success) {
    throw createInvalidJsonColumnError(input.columnName);
  }

  return result.data;
}

export function parseStringArrayColumn(input: { columnName: string; raw: string }): string[] {
  return parseJsonColumn({
    columnName: input.columnName,
    raw: input.raw,
    schema: stringArrayJsonSchema,
  });
}
