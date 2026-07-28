import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createJsonFileTrainingEnvironment } from "../../src/adapters/json-file";
import { baseRoutines } from "../../src/base-data/routines";
import { loadBaseData } from "../../src/base-data/load";
import { TrainingOrchestrator } from "../../src/core";
import type { ISODateTime } from "../../src/core";
import { SequentialIdGenerator, TestClock } from "../support/training-environment";

const now = "2026-07-28T12:00:00.000Z" as ISODateTime;

const createPath = async (): Promise<string> => join(await mkdtemp(join(tmpdir(), "train-app-base-data-")), "train-app.json");

describe("base data JSON verification", () => {
  it("recovers the complete catalog and every routine snapshot from disk", async () => {
    const path = await createPath();
    const clock = new TestClock(now);
    const ids = new SequentialIdGenerator();
    const firstEnvironment = await createJsonFileTrainingEnvironment({ path, clock, ids });
    let training = new TrainingOrchestrator(firstEnvironment.dependencies);
    const loaded = await loadBaseData(training);

    if (!loaded.ok) {
      throw new Error("Expected base data to load");
    }

    const rebuiltEnvironment = await createJsonFileTrainingEnvironment({ path, clock, ids });
    training = new TrainingOrchestrator(rebuiltEnvironment.dependencies);
    const exercises = await training.listExercises();
    const routineSummaries = await training.listRoutines();

    if (!exercises.ok || !routineSummaries.ok) {
      throw new Error("Expected recovered catalog");
    }

    const exerciseIds = new Set(exercises.value.map((exercise) => exercise.id));
    const routines = await Promise.all(routineSummaries.value.map(async (summary) => training.getRoutine(summary.id)));

    expect(routineSummaries.value).toHaveLength(baseRoutines.length);
    expect(routines.every((routine) => routine.ok)).toBe(true);

    const recoveredRoutines = routines.filter((routine) => routine.ok).map((routine) => routine.value);
    expect(recoveredRoutines.flatMap((routine) => routine.variants).every((variant) =>
      variant.exercises.every((exercise) => exerciseIds.has(exercise.exerciseId)),
    )).toBe(true);

    let startedVariants = 0;

    for (const routine of recoveredRoutines) {
      for (const variant of routine.variants) {
        const started = await training.startWorkout({
          source: "routine",
          routineId: routine.id,
          variantId: variant.id,
        });

        if (!started.ok) {
          throw new Error(`Expected ${routine.name} / ${variant.name} to start`);
        }

        const recoveredEnvironment = await createJsonFileTrainingEnvironment({ path, clock, ids });
        training = new TrainingOrchestrator(recoveredEnvironment.dependencies);

        expect(await training.getActiveWorkout()).toEqual({ ok: true, value: started.value });
        expect(started.value.routine).toEqual({
          id: routine.id,
          name: routine.name,
          variantId: variant.id,
          variantName: variant.name,
        });
        expect(started.value.exercises).toHaveLength(variant.exercises.length);
        expect(await training.discardWorkout()).toEqual({ ok: true, value: undefined });
        startedVariants += 1;
      }
    }

    expect(startedVariants).toBe(baseRoutines.reduce((total, routine) => total + routine.variants.length, 0));
  });
});
