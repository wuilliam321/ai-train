import type { JsonValue, Result } from "../domain/primitives";

export type { Result } from "../domain/primitives";

export type ApplicationErrorCode =
  | "validation"
  | "not_found"
  | "conflict"
  | "no_active_workout"
  | "persistence";

export interface ApplicationError {
  readonly code: ApplicationErrorCode;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

export const success = <Value>(value: Value): Result<Value, never> => ({
  ok: true,
  value,
});

export const failure = <Error>(error: Error): Result<never, Error> => ({
  ok: false,
  error,
});
