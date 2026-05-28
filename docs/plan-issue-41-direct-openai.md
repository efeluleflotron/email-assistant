# Issue #41 (revisado) — Sistema modular de provedores de AI + OpenAI direto (sem Vercel Gateway)

> Substitui o `docs/plan-issue-41.md`. Aquele plano usava o **Vercel AI Gateway** em modo BYOK, que
> exige cadastrar cartão de crédito + créditos na Vercel. Não vamos mais usar o Gateway.

## Context

O scaffold do #41 (cliente OpenAI + classifier) já está escrito como arquivos untracked
(`src/lib/ai/openai.ts`, `classifier.ts`, `prompts/classify.ts`, `src/__tests__/classifier.test.ts`),
porém ligado ao **Vercel AI Gateway** (BYOK). Isso força billing na Vercel — o usuário não quer.

Dois objetivos desta revisão:

1. **Remover o Gateway** — chamar o provedor direto. No `ai` SDK v6, o Gateway só é usado quando se
   passa uma **string** de modelo (`"openai/gpt-5.4-mini"`); passando uma **instância** de modelo
   (`openai("gpt-4.1-mini")`), o SDK chama o provedor direto com a própria API key — sem Gateway,
   sem billing na Vercel.
2. **Modularizar** — provedores viram módulos plugáveis atrás de uma interface comum, então
   adicionar uma nova AI depois é só criar um arquivo. Default ativo agora: **OpenAI `gpt-4.1-mini`**
   (confirmado com o usuário). Construir a abstração + módulo OpenAI apenas; outros provedores depois.

A lógica de retry/backoff, `AIClientError`, schema zod com enum, o classifier e o teste mockado
permanecem intactos — muda só o wiring e a estrutura.

## Remoção da implementação do Vercel AI Gateway (explícito)

Todo artefato do Gateway abaixo é removido nesta PR — nada relacionado ao Gateway deve sobrar:

- **`src/lib/ai/openai.ts`** — o arquivo wrapper do gateway some. `assertGatewayAuth()`
  (`openai.ts:35-42`), o check de `VERCEL_OIDC_TOKEN`, a chamada por **string** de modelo
  (`model: resolvedModel`, linha 79) e o default `"openai/gpt-5.4-mini"` (linha 32) são removidos.
  As partes reutilizáveis são divididas em `client.ts` / `providers/openai.ts` / `errors.ts`
  (ver abaixo). Resultado: não existe mais um arquivo `openai.ts` na raiz de `src/lib/ai/`.
- **`.env.example`** — apagar o bloco `# --- AI Gateway (BYOK) ---` inteiro:
  `AI_GATEWAY_API_KEY`, os comentários de BYOK/Provider-Keys e o valor `OPENAI_MODEL=openai/...`
  com prefixo de barra.
- **`AGENTS.md`** — apagar a seção `# AI Gateway (BYOK)` por completo.
- **`docs/plan-issue-41.md`** — desatualizado (descreve o plano do Gateway). Opcional: apagar, ou
  manter e apontar o pivô na descrição da PR.

## Estrutura alvo

```
src/lib/ai/
  errors.ts            # AIClientError + AIClientErrorKind (extraído p/ provedores poderem lançar)
  client.ts            # callModel<T> — wrapper provider-neutral (retry, timeout, mapeamento de erro)
  providers/
    types.ts           # interface AIProvider
    index.ts           # registry + getProvider(name = AI_PROVIDER)
    openai.ts          # módulo OpenAI (dono de OPENAI_API_KEY + OPENAI_MODEL + default)
  prompts/classify.ts  # INALTERADO (provider-neutral)
  classifier.ts        # única mudança: import de callModel vindo de "@/lib/ai/client"
```

O antigo `src/lib/ai/openai.ts` é **dividido**: wrapper genérico → `client.ts`; binding específico do
OpenAI → `providers/openai.ts`; tipo de erro → `errors.ts`.

## Arquivos a criar

### `src/lib/ai/errors.ts`
Mover `AIClientErrorKind` e `AIClientError` para cá, verbatim do `openai.ts:4-16` (manter os kinds
`"timeout" | "malformed" | "upstream" | "config"`). Fica isolado para `client.ts` e os módulos de
provedor importarem sem ciclo.

### `src/lib/ai/providers/types.ts`
```ts
import type { LanguageModel } from "ai";
export type AIProvider = {
  name: string;
  defaultModel(): string;        // lê seu próprio env *_MODEL, com fallback hardcoded
  model(id: string): LanguageModel;
  assertAuth(): void;            // lança AIClientError("config", ...) se faltar a key env
};
```
(`LanguageModel` do `ai` aceita a instância retornada por `openai(id)`. Confirmar o tipo exato na
execução; se necessário, usar o tipo de retorno de `openai`.)

### `src/lib/ai/providers/openai.ts`
```ts
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
        "OPENAI_API_KEY ausente. Crie em https://platform.openai.com/api-keys (billing direto na OpenAI, sem conta Vercel).",
      );
    }
  },
};
```

### `src/lib/ai/providers/index.ts`
```ts
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
      `AI_PROVIDER desconhecido "${name}". Disponíveis: ${Object.keys(registry).join(", ")}.`,
    );
  }
  return provider;
}
```
*(Para adicionar um provedor depois: criar `providers/<name>.ts` implementando `AIProvider`,
registrar em `registry`, e `npm i` o pacote `@ai-sdk/*` correspondente.)*

## Arquivos a modificar

### `src/lib/ai/openai.ts` → renomear para `src/lib/ai/client.ts`
- Remover as definições de `AIClientError`/kind (agora em `errors.ts`) e importar de `./errors`.
- Remover `getDefaultModel()` e `assertGatewayAuth()`.
- Manter `CallModelArgs<T>`, as constantes, `combineSignals`, `isRetryable` (continua usando
  `APICallError` do `ai` — provider-agnostic), `isTimeout`, e todo o loop de retry + mapeamento
  malformed/upstream.
- Em `callModel`, trocar a auth de gateway + modelo-string pelo registry:
  ```ts
  const provider = getProvider();
  provider.assertAuth();
  const modelId = model ?? provider.defaultModel();
  // dentro do loop:
  const { object } = await generateObject({
    model: provider.model(modelId),
    schema, prompt, system,
    abortSignal: combineSignals(timeoutMs, signal),
  });
  ```
- `CallModelArgs.model?: string` continua sendo um override opcional (um **id** de modelo, ex.
  `"gpt-4.1"`), resolvido pelo provedor ativo.

### `src/lib/ai/classifier.ts`
- Uma linha: `import { callModel } from "@/lib/ai/openai";` → `from "@/lib/ai/client";`. Nada mais.

### `src/__tests__/classifier.test.ts`
- Atualizar as duas referências de `@/lib/ai/openai` para `@/lib/ai/client` (o `jest.mock(...)` na
  linha 7 e o `import` na linha 11). O corpo do teste fica igual — continua mockando `callModel`,
  então a troca de provedor não o afeta.

### `package.json`
- Adicionar `"@ai-sdk/openai": "^3.0.46"` (linha ai-v6; instalar via `npm i @ai-sdk/openai@ai-v6`).
  Seu peer de zod `^4.1.8` é satisfeito pelo `zod@^4.4.3` atual. `ai`/`zod` já estão presentes.

### `.env.example`
Substituir o bloco `# --- AI Gateway (BYOK) ---` por:
```
# --- AI ---
# Qual módulo de provedor usar (ver src/lib/ai/providers/). Disponíveis: openai.
AI_PROVIDER=openai

# --- OpenAI ---
# API key de https://platform.openai.com/api-keys (billing direto na OpenAI; sem créditos Vercel).
OPENAI_API_KEY=
# Id do modelo (sem prefixo "openai/"). Default: gpt-4.1-mini (barato p/ classification).
OPENAI_MODEL=gpt-4.1-mini
```

### `AGENTS.md`
Substituir a seção `# AI Gateway (BYOK)` por uma nota curta **"AI providers (modular)"**:
- Chamamos provedores de AI **direto** via `ai` SDK v6 (instâncias de modelo, não strings de
  Gateway). Sem Vercel AI Gateway, sem passo de BYOK/Provider-Keys.
- `AI_PROVIDER` seleciona um módulo em `src/lib/ai/providers/`; cada módulo é dono da própria key +
  env de modelo. Módulo OpenAI: `OPENAI_API_KEY` (obrigatório), `OPENAI_MODEL` (default
  `gpt-4.1-mini`).
- Para adicionar um provedor: implementar `AIProvider` em `providers/<name>.ts`, registrar em
  `providers/index.ts`, instalar o pacote `@ai-sdk/*`.

## Verification
- `npm i @ai-sdk/openai@ai-v6` funciona; lockfile atualiza.
- `npm test` — todos os testes existentes + `classifier.test.ts` passam (o teste mocka `callModel`).
- `npx tsc --noEmit` — limpo (verificar que `provider.model(id)` tipa contra o param `model` do
  `generateObject`; ajustar o retorno em `types.ts` se o tipo `LanguageModel` do `ai` for mais estrito).
- `npm run lint` — limpo.
- Sanity sem key: com `OPENAI_API_KEY` ausente, `callModel` lança `AIClientError("config", ...)` —
  não um 500 silencioso.
- Sanity de provedor inválido: `AI_PROVIDER=bogus` lança `AIClientError("config", ...)` claro.
- Smoke opcional ao vivo (precisa de key real em `.env.local`):
  `npx tsx -e "import('./src/lib/ai/classifier').then(m=>m.classifyEmail({subject:'Your invoice',body:'Please pay',categories:[{id:'fin',name:'Finance',description:'bills'},{id:'trv',name:'Travel',description:'trips'}]}).then(console.log))"`
  → esperar `{ categoryIds: ['fin'] }` e uma chamada real à OpenAI.

## Riscos / pontos para o reviewer
- **Compat AI SDK v6**: usar a linha `ai-v6` do `@ai-sdk/openai` (`^3.0.46`), não a `latest`.
- **Renome de arquivo**: `openai.ts` → `client.ts` muda o import em `classifier.ts` e no teste;
  garantir que nenhuma outra referência a `@/lib/ai/openai` sobrou (grep antes de commitar).
- **Conflito com #42**: segue valendo a suposição "closed-set, max 3 labels" do plano original;
  marcar como "v0, ajustável após #42".
