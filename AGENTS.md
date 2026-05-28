<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI providers (modular)

We call AI providers **directly** via the `ai` SDK v6 — passing model instances (`openai("gpt-4.1-mini")`), not Gateway `"provider/model"` strings. No Vercel AI Gateway, no BYOK/Provider-Keys step.

- `AI_PROVIDER` selects a module under `src/lib/ai/providers/`. Each module owns its own key + model env. OpenAI module: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (default `gpt-4.1-mini`).
- `callModel` (`src/lib/ai/client.ts`) is provider-neutral: it resolves the active provider, asserts its auth, and runs the retry/timeout loop.
- To add a provider: implement `AIProvider` in a new `providers/<name>.ts`, register it in `providers/index.ts`, and install its `@ai-sdk/*` package.
