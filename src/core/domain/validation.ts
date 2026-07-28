import type {
  DateRange,
  ISODateTime,
  PageRequest,
  Repetitions,
  Result,
  Seconds,
  Weight,
  WeightAmount,
  WeightUnit,
} from "./primitives";
import type { Effort } from "./workout";

export type ValidationIssue =
  | { readonly code: "invalid_datetime" }
  | { readonly code: "invalid_date_range" }
  | { readonly code: "invalid_seconds" }
  | { readonly code: "invalid_repetitions" }
  | { readonly code: "invalid_weight_amount" }
  | { readonly code: "invalid_weight_unit" }
  | { readonly code: "invalid_effort" }
  | { readonly code: "invalid_page_request" };

const valid = <Value>(value: Value): Result<Value, never> => ({ ok: true, value });

const invalid = <Code extends ValidationIssue["code"]>(
  code: Code,
): Result<never, Extract<ValidationIssue, { readonly code: Code }>> => ({
  ok: false,
  error: { code } as Extract<ValidationIssue, { readonly code: Code }>,
});

export const asISODateTime = (
  value: string,
): Result<ISODateTime, ValidationIssue> => {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    return invalid("invalid_datetime");
  }

  return valid(value as ISODateTime);
};

export const asSeconds = (value: number): Result<Seconds, ValidationIssue> => {
  if (!Number.isInteger(value) || value < 0) {
    return invalid("invalid_seconds");
  }

  return valid(value as Seconds);
};

export const asRepetitions = (
  value: number,
): Result<Repetitions, ValidationIssue> => {
  if (!Number.isInteger(value) || value < 1) {
    return invalid("invalid_repetitions");
  }

  return valid(value as Repetitions);
};

export const asWeightAmount = (
  value: number,
): Result<WeightAmount, ValidationIssue> => {
  if (!Number.isFinite(value) || value < 0) {
    return invalid("invalid_weight_amount");
  }

  return valid(value as WeightAmount);
};

export const asWeight = (
  amount: number,
  unit: string,
): Result<Weight, ValidationIssue> => {
  const weightAmount = asWeightAmount(amount);

  if (!weightAmount.ok) {
    return weightAmount;
  }

  if (unit !== "kg" && unit !== "lb") {
    return invalid("invalid_weight_unit");
  }

  return valid({ amount: weightAmount.value, unit: unit as WeightUnit });
};

export const asEffort = (
  kind: string,
  value: number,
): Result<Effort, ValidationIssue> => {
  if (kind === "rpe" && Number.isFinite(value) && value >= 1 && value <= 10) {
    return valid({ kind, value });
  }

  if (kind === "rir" && Number.isInteger(value) && value >= 0 && value <= 10) {
    return valid({ kind, value });
  }

  return invalid("invalid_effort");
};

export const asDateRange = (
  from: string,
  to: string,
): Result<DateRange, ValidationIssue> => {
  const start = asISODateTime(from);
  const end = asISODateTime(to);

  if (!start.ok || !end.ok || start.value >= end.value) {
    return invalid("invalid_date_range");
  }

  return valid({ from: start.value, to: end.value });
};

export const asPageRequest = (
  limit: number,
  cursor?: string,
): Result<PageRequest, ValidationIssue> => {
  if (!Number.isInteger(limit) || limit < 1 || (cursor !== undefined && cursor.length === 0)) {
    return invalid("invalid_page_request");
  }

  return cursor === undefined ? valid({ limit }) : valid({ limit, cursor });
};
