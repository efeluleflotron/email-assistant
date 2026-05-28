import { AIClientError } from "../errors";
import type { AIProvider } from "./types";
import { openaiProvider } from "./openai";

const registry: Record<string, AIProvider> = {
  [openaiProvider.name]: openaiProvider,
};

export function getProvider(name = process.env.AI_PROVIDER || "openai"): AIProvider {
  const provider = registry[name];
  if (!provider) {
    throw new AIClientError(
      "config",
      `Unknown AI_PROVIDER "${name}". Available: ${Object.keys(registry).join(", ")}.`,
    );
  }
  return provider;
}
