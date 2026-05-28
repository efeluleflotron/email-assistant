import { generateObject, APICallError } from "ai";
import type { z } from "zod";
import { AIClientError } from "./errors";
import { getProvider } from "./providers";

export type CallModelArgs<T> = {
  schema: z.ZodType<T>;
  prompt: string;
  system?: string;
  signal?: AbortSignal;
  model?: string;
  timeoutMs?: number;
  maxAttempts?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 3;

function combineSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) return timeout;
  return AbortSignal.any([timeout, external]);
}

function isRetryable(err: unknown): boolean {
  if (APICallError.isInstance(err)) {
    if (err.statusCode == null) return true;
    return err.statusCode >= 500 || err.statusCode === 408 || err.statusCode === 429;
  }
  if (err instanceof Error && err.name === "AbortError") return false;
  return false;
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
}

export async function callModel<T>({
  schema,
  prompt,
  system,
  signal,
  model,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: CallModelArgs<T>): Promise<T> {
  const provider = getProvider();
  provider.assertAuth();

  const modelId = model ?? provider.defaultModel();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { object } = await generateObject({
        model: provider.model(modelId),
        schema,
        prompt,
        system,
        abortSignal: combineSignals(timeoutMs, signal),
      });
      return object;
    } catch (err) {
      lastError = err;
      if (isTimeout(err)) {
        throw new AIClientError("timeout", `model call timed out after ${timeoutMs}ms`, err);
      }
      if (attempt === maxAttempts || !isRetryable(err)) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }

  if (
    lastError instanceof Error &&
    /schema|parse|invalid json|no object generated/i.test(lastError.message)
  ) {
    throw new AIClientError("malformed", lastError.message, lastError);
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new AIClientError("upstream", msg, lastError);
}
