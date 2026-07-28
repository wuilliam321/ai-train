import { describe, expect, it } from "vitest";
import { createWebStorageTrainingEnvironment } from "../../src/adapters/web-storage";
import type { WebStorage } from "../../src/adapters/web-storage";
import { TrainingOrchestrator } from "../../src/core";
import type { ISODateTime, Repetitions, Seconds, WeightAmount } from "../../src/core";
import { SequentialIdGenerator, TestClock } from "../support/training-environment";

const startedAt = "2026-07-28T12:00:00.000Z" as ISODateTime;
const completedAt = "2026-07-28T13:00:00.000Z" as ISODateTime;

class MemoryWebStorage implements WebStorage {
  private readonly values = new Map<string, string>();
  private failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error("storage unavailable");
    }

    this.values.set(key, value);
  }

  setFailWrites(value: boolean): void {
    this.failWrites = value;
  }

  keys(): readonly string[] {
    return [...this.values.keys()];
  }
}

const createEnvironment = (storage: WebStorage, clock = new TestClock(startedAt)) => {
  const environment = createWebStorageTrainingEnvironment({
    storage,
    key: "test-train-app",
    clock,
    ids: new SequentialIdGenerator(),
  });
  return { environment, clock };
};

describe("web storage persistence", () => {
  it("recovers active rest, closed history and metrics after rebuilding the browser adapter", async () => {
    const storage = new MemoryWebStorage();
    const { environment, clock } = createEnvironment(storage);
    const training = new TrainingOrchestrator(environment.dependencies);
    const exercise = await training.createExercise({
      name: "Back Squat",
      primaryMuscles: ["quadriceps"],
      defaultRestSeconds: 180 as Seconds,
    });

    if (!exercise.ok) {
      throw new Error("Expected exercise creation");
    }

    const active = await training.startWorkout({ source: "empty" });

    if (!active.ok) {
      throw new Error("Expected active workout");
    }

    const withExercise = await training.addWorkoutExercise({ exerciseId: exercise.value.id });

    if (!withExercise.ok) {
      throw new Error("Expected workout exercise");
    }

    const withSet = await training.addWorkoutSet({ workoutExerciseId: withExercise.value.exercises[0]!.id, type: "normal" });

    if (!withSet.ok) {
      throw new Error("Expected workout set");
    }

    const completed = await training.completeWorkoutSet({
      workoutSetId: withSet.value.exercises[0]!.sets[0]!.id,
      weight: { amount: 100 as WeightAmount, unit: "kg" },
      repetitions: 8 as Repetitions,
    });

    if (!completed.ok) {
      throw new Error("Expected completed set");
    }

    const rebuilt = createEnvironment(storage, clock);
    const recovered = new TrainingOrchestrator(rebuilt.environment.dependencies);
    expect(await recovered.getActiveWorkout()).toEqual({ ok: true, value: completed.value });
    expect(await recovered.getRestPeriod()).toEqual({ ok: true, value: completed.value.restPeriod! });

    clock.set(completedAt);
    expect(await recovered.finishWorkout()).toMatchObject({ ok: true, value: { status: "completed" } });
    expect(await recovered.getPreviousSetReferences({ exerciseId: exercise.value.id, limit: 1 })).toMatchObject({
      ok: true,
      value: [{ exerciseId: exercise.value.id, repetitions: 8 }],
    });
    expect(await recovered.getDashboard({ from: startedAt, to: "2026-07-29T00:00:00.000Z" as ISODateTime })).toMatchObject({
      ok: true,
      value: { volume: [{ unit: "kg", amount: 800 }] },
    });
  });

  it("preserves the document on write failure and recovers a corrupt document", async () => {
    const storage = new MemoryWebStorage();
    const { environment } = createEnvironment(storage);
    const training = new TrainingOrchestrator(environment.dependencies);
    expect(await training.createExercise({ name: "Squat", primaryMuscles: ["quadriceps"], defaultRestSeconds: 60 as Seconds })).toMatchObject({ ok: true });
    const before = await environment.exportData();

    storage.setFailWrites(true);
    expect(await training.createExercise({ name: "Row", primaryMuscles: ["back"], defaultRestSeconds: 60 as Seconds })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    storage.setFailWrites(false);
    expect(await environment.exportData()).toBe(before);
    expect(await environment.importData('{"version":2}')).toEqual({ ok: false, error: { code: "corrupt_data" } });
    expect(await environment.exportData()).toBe(before);

    storage.setItem("test-train-app", "not json");
    const recovered = createEnvironment(storage);
    expect(await new TrainingOrchestrator(recovered.environment.dependencies).getActiveWorkout()).toEqual({ ok: true, value: null });
    expect(storage.keys().some((key) => key.startsWith("test-train-app.corrupt-"))).toBe(true);
  });
});
