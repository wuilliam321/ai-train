import { describe, expect, it } from "vitest";
import {
  asDateRange,
  asEffort,
  asISODateTime,
  asPageRequest,
  asRepetitions,
  asSeconds,
  asWeight,
  asWeightAmount,
  failure,
  success,
} from "../../src/core";
import { createTrainingEnvironment, TestClock } from "../support/training-environment";

const date = "2026-07-28T12:00:00.000Z";
const laterDate = "2026-07-28T12:00:01.000Z";

describe("foundation validation", () => {
  it("accepts canonical primitive values", () => {
    expect(asISODateTime(date)).toEqual({ ok: true, value: date });
    expect(asSeconds(0)).toEqual({ ok: true, value: 0 });
    expect(asRepetitions(1)).toEqual({ ok: true, value: 1 });
    expect(asWeightAmount(0)).toEqual({ ok: true, value: 0 });
    expect(asWeight(70, "kg")).toEqual({
      ok: true,
      value: { amount: 70, unit: "kg" },
    });
    expect(asEffort("rpe", 8.5)).toEqual({ ok: true, value: { kind: "rpe", value: 8.5 } });
    expect(asEffort("rir", 2)).toEqual({ ok: true, value: { kind: "rir", value: 2 } });
    expect(asDateRange(date, laterDate)).toEqual({
      ok: true,
      value: { from: date, to: laterDate },
    });
    expect(asPageRequest(10)).toEqual({ ok: true, value: { limit: 10 } });
    expect(asPageRequest(10, "next")).toEqual({
      ok: true,
      value: { limit: 10, cursor: "next" },
    });
  });

  it("rejects malformed primitive values", () => {
    expect(asISODateTime("not-a-date")).toEqual({ ok: false, error: { code: "invalid_datetime" } });
    expect(asISODateTime("2026-07-28T12:00:00Z")).toEqual({ ok: false, error: { code: "invalid_datetime" } });
    expect(asSeconds(-1)).toEqual({ ok: false, error: { code: "invalid_seconds" } });
    expect(asSeconds(1.5)).toEqual({ ok: false, error: { code: "invalid_seconds" } });
    expect(asRepetitions(0)).toEqual({ ok: false, error: { code: "invalid_repetitions" } });
    expect(asRepetitions(1.5)).toEqual({ ok: false, error: { code: "invalid_repetitions" } });
    expect(asWeightAmount(-1)).toEqual({ ok: false, error: { code: "invalid_weight_amount" } });
    expect(asWeightAmount(Number.NaN)).toEqual({ ok: false, error: { code: "invalid_weight_amount" } });
    expect(asWeight(-1, "kg")).toEqual({ ok: false, error: { code: "invalid_weight_amount" } });
    expect(asWeight(70, "stone")).toEqual({ ok: false, error: { code: "invalid_weight_unit" } });
    expect(asEffort("rpe", 0)).toEqual({ ok: false, error: { code: "invalid_effort" } });
    expect(asEffort("rpe", 11)).toEqual({ ok: false, error: { code: "invalid_effort" } });
    expect(asEffort("rir", 1.5)).toEqual({ ok: false, error: { code: "invalid_effort" } });
    expect(asEffort("rir", 11)).toEqual({ ok: false, error: { code: "invalid_effort" } });
    expect(asEffort("other", 1)).toEqual({ ok: false, error: { code: "invalid_effort" } });
    expect(asDateRange("invalid", laterDate)).toEqual({ ok: false, error: { code: "invalid_date_range" } });
    expect(asDateRange(date, "invalid")).toEqual({ ok: false, error: { code: "invalid_date_range" } });
    expect(asDateRange(laterDate, date)).toEqual({ ok: false, error: { code: "invalid_date_range" } });
    expect(asPageRequest(0)).toEqual({ ok: false, error: { code: "invalid_page_request" } });
    expect(asPageRequest(1.5)).toEqual({ ok: false, error: { code: "invalid_page_request" } });
    expect(asPageRequest(1, "")).toEqual({ ok: false, error: { code: "invalid_page_request" } });
  });

  it("creates typed result values", () => {
    expect(success("ready")).toEqual({ ok: true, value: "ready" });
    expect(failure({ code: "validation" })).toEqual({
      ok: false,
      error: { code: "validation" },
    });
  });

  it("provides deterministic dependencies without global state", () => {
    const clock = new TestClock(date as ReturnType<typeof asISODateTime> extends { value: infer Value } ? Value : never);
    const environment = createTrainingEnvironment(clock);

    expect(environment.clock.now()).toBe(date);
    clock.set(laterDate as ReturnType<typeof asISODateTime> extends { value: infer Value } ? Value : never);
    expect(environment.clock.now()).toBe(laterDate);
    expect(environment.ids.generate()).toBe("id-1");
    expect(environment.ids.generate()).toBe("id-2");
  });
});
