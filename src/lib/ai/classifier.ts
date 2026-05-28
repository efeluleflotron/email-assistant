import { z } from "zod";
import { callModel } from "@/lib/ai/client";
import { CLASSIFY_PROMPT_V1 } from "@/lib/ai/prompts/classify";

export type ClassifyCategory = {
  id: string;
  name: string;
  description: string;
};

export type ClassifyInput = {
  subject: string;
  body: string;
  categories: ClassifyCategory[];
  maxLabels?: number;
};

export type ClassifyOutput = {
  categoryIds: string[];
};

const DEFAULT_MAX_LABELS = 3;

export async function classifyEmail(input: ClassifyInput): Promise<ClassifyOutput> {
  const maxLabels = input.maxLabels ?? DEFAULT_MAX_LABELS;

  if (input.categories.length === 0) {
    return { categoryIds: [] };
  }

  const allowedIds = input.categories.map((c) => c.id) as [string, ...string[]];

  const schema = z.object({
    categoryIds: z.array(z.enum(allowedIds)).max(maxLabels),
  });

  const result = await callModel({
    schema,
    system: CLASSIFY_PROMPT_V1.system,
    prompt: CLASSIFY_PROMPT_V1.buildUserMessage({
      subject: input.subject,
      body: input.body,
      categories: input.categories,
      maxLabels,
    }),
  });

  return { categoryIds: result.categoryIds };
}
