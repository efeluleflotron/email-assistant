import { openai } from "@ai-sdk/openai";
import { AIClientError } from "../errors";
import type { AIProvider } from "./types";

export const openaiProvider: AIProvider = {
  name: "openai",
  defaultModel: () => process.env.OPENAI_MODEL || "gpt-4.1-mini",
  model: (id) => openai(id),
  assertAuth() {
    if (!process.env.OPENAI_API_KEY) {
      throw new AIClientError(
        "config",
        "OPENAI_API_KEY missing. Create one at https://platform.openai.com/api-keys (billing is OpenAI-direct, no Vercel account needed).",
      );
    }
  },
};
