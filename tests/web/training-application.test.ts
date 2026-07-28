import { describe, expect, it } from "vitest";
import type { WebStorage } from "../../src/adapters/web-storage";
import { baseDataCounts } from "../../src/base-data/load";
import { createWebTrainingApplication } from "../../src/web/training-application";
import { SequentialIdGenerator, TestClock } from "../support/training-environment";
import type { ISODateTime } from "../../src/core";

const now = "2026-07-28T12:00:00.000Z" as ISODateTime;

class MemoryWebStorage implements WebStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class UnavailableWebStorage implements WebStorage {
  getItem(): string | null {
    throw new Error("storage unavailable");
  }

  setItem(): void {
    throw new Error("storage unavailable");
  }
}

const options = (storage: WebStorage) => ({
  storage,
  key: "test-train-app",
  clock: new TestClock(now),
  ids: new SequentialIdGenerator(),
});

describe("web training application", () => {
  it("loads base data on first opening and preserves it without duplicates after reopening", async () => {
    const storage = new MemoryWebStorage();
    const first = await createWebTrainingApplication(options(storage));

    expect(first).toMatchObject({
      initialization: {
        status: "ready",
        baseData: {
          createdExercises: baseDataCounts.exercises,
          restoredExercises: 0,
          createdRoutines: baseDataCounts.routines,
        },
      },
    });

    if (!("training" in first)) {
      throw new Error("Expected initialized training application");
    }

    expect(await first.training.listExercises()).toMatchObject({ ok: true, value: { length: baseDataCounts.exercises } });
    expect(await first.training.listRoutines()).toMatchObject({ ok: true, value: { length: baseDataCounts.routines } });

    const reopened = await createWebTrainingApplication(options(storage));
    expect(reopened).toMatchObject({
      initialization: {
        status: "ready",
        baseData: { createdExercises: 0, restoredExercises: 0, createdRoutines: 0 },
      },
    });
    expect(JSON.stringify(reopened.initialization)).toBe(JSON.stringify({
      status: "ready",
      baseData: { createdExercises: 0, restoredExercises: 0, createdRoutines: 0 },
    }));
  });

  it("reports unavailable storage without exposing an application facade", async () => {
    const application = await createWebTrainingApplication(options(new UnavailableWebStorage()));

    expect(application).toEqual({ initialization: { status: "storage_error" } });
    expect("training" in application).toBe(false);
  });
});
