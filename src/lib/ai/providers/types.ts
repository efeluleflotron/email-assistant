import type { LanguageModel } from "ai";

export type AIProvider = {
  name: string;
  defaultModel(): string;
  model(id: string): LanguageModel;
  assertAuth(): void;
};
