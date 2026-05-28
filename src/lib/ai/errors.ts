export type AIClientErrorKind = "timeout" | "malformed" | "upstream" | "config";

export class AIClientError extends Error {
  readonly kind: AIClientErrorKind;
  readonly cause?: unknown;

  constructor(kind: AIClientErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "AIClientError";
    this.kind = kind;
    this.cause = cause;
  }
}
