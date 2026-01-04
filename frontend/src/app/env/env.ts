import "server-only";

import * as v from "valibot";

const EnvSchema = v.object({
  OPENAI_API_KEY: v.pipe(v.string(), v.minLength(1)),
  CLERK_SECRET_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
});

export type Env = v.InferOutput<typeof EnvSchema>;

export function getEnv(): Env {
  return v.parse(EnvSchema, {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
}
