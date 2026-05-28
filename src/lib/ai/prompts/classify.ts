export type ClassifyPromptCategory = {
  id: string;
  name: string;
  description: string;
};

export type ClassifyPromptInput = {
  subject: string;
  body: string;
  categories: ClassifyPromptCategory[];
  maxLabels: number;
};

const SYSTEM = `You are an email classifier. You will receive an email (subject + body) and a closed list of user-defined categories, each with an id, a name, and a description.

Rules:
- Choose ONLY from the provided category ids. Never invent new ids, names, or labels.
- Return at most the configured maximum number of labels.
- If no category fits, return an empty list.
- Output must conform to the requested JSON schema. Do not include commentary.`;

function buildUserMessage(input: ClassifyPromptInput): string {
  const cats = input.categories
    .map((c) => `- id=${c.id} | name=${c.name} | description=${c.description}`)
    .join("\n");

  return [
    `MAX_LABELS=${input.maxLabels}`,
    "",
    "CATEGORIES:",
    cats,
    "",
    "EMAIL:",
    `Subject: ${input.subject}`,
    "Body:",
    input.body,
  ].join("\n");
}

export const CLASSIFY_PROMPT_V1 = {
  version: 1 as const,
  system: SYSTEM,
  buildUserMessage,
};
