import { describe, expect, it } from "vitest";
import { baseExercises } from "../../src/base-data/exercises";
import { baseRoutines, resolveBaseRoutines } from "../../src/base-data/routines";
import { TrainingOrchestrator } from "../../src/core";
import type { ExerciseId, ISODateTime } from "../../src/core";
import { TestClock, createTrainingEnvironment } from "../support/training-environment";

const now = "2026-07-28T12:00:00.000Z" as ISODateTime;

describe("base routines", () => {
  it("resolve every prescription to the normalized catalog and starts every variant", async () => {
    const training = new TrainingOrchestrator(createTrainingEnvironment(new TestClock(now)));
    const exercises = await Promise.all(baseExercises.map((exercise) => training.createExercise(exercise)));
    const exerciseIds = new Map<string, ExerciseId>();

    for (const result of exercises) {
      if (!result.ok) {
        throw new Error("Expected base exercise catalog");
      }

      exerciseIds.set(result.value.name, result.value.id);
    }

    const drafts = resolveBaseRoutines(exerciseIds);

    expect(drafts).toHaveLength(baseRoutines.length);
    expect(drafts.flatMap((routine) => routine.variants).every((variant) =>
      variant.exercises.every((exercise) => exerciseIds.has(
        [...exerciseIds.entries()].find(([, id]) => id === exercise.exerciseId)?.[0] ?? "",
      )),
    )).toBe(true);

    for (const draft of drafts) {
      const created = await training.createRoutine(draft);

      if (!created.ok) {
        throw new Error(`Expected routine ${draft.name} to be valid`);
      }

      for (const variant of created.value.variants) {
        const started = await training.startWorkout({
          source: "routine",
          routineId: created.value.id,
          variantId: variant.id,
        });

        expect(started.ok).toBe(true);
        expect(started.ok && started.value.exercises).toHaveLength(variant.exercises.length);

        const discarded = await training.discardWorkout();
        expect(discarded.ok).toBe(true);
      }
    }
  });
});
