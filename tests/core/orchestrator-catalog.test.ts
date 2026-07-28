import { describe, expect, it } from "vitest";
import { TrainingOrchestrator } from "../../src/core";
import type { ISODateTime, Repetitions, Seconds } from "../../src/core";
import { TestClock, createTrainingEnvironment } from "../support/training-environment";

const now = "2026-07-28T12:00:00.000Z" as ISODateTime;

describe("TrainingOrchestrator catalog facade", () => {
  it("exposes exercise and routine catalog commands without importing application services", async () => {
    const training = new TrainingOrchestrator(createTrainingEnvironment(new TestClock(now)));
    const exercise = await training.createExercise({
      name: "Back Squat",
      primaryMuscles: ["quadriceps"],
      defaultRestSeconds: 120 as Seconds,
    });

    if (!exercise.ok) {
      throw new Error("Expected exercise creation");
    }

    expect(await training.getExercise(exercise.value.id)).toEqual(exercise);
    expect(await training.updateExercise({
      exerciseId: exercise.value.id,
      patch: { notes: "Controlled descent" },
    })).toMatchObject({ ok: true, value: { notes: "Controlled descent" } });
    expect(await training.archiveExercise(exercise.value.id)).toMatchObject({ ok: true, value: { status: "archived" } });
    expect(await training.restoreExercise(exercise.value.id)).toMatchObject({ ok: true, value: { status: "active" } });
    expect(await training.listExercises({ search: "Squat" })).toMatchObject({
      ok: true,
      value: [{ id: exercise.value.id }],
    });

    const routine = await training.createRoutine({
      name: "Lower body",
      variants: [{
        name: "Gym",
        exercises: [{
          exerciseId: exercise.value.id,
          sets: [{ type: "normal", repetitions: { kind: "exact", repetitions: 8 as Repetitions } }],
          laterality: "bilateral",
        }],
      }],
    });

    if (!routine.ok) {
      throw new Error("Expected routine creation");
    }

    expect(await training.getRoutine(routine.value.id)).toEqual(routine);
    expect(await training.updateRoutine({ routineId: routine.value.id, patch: { name: "Lower" } })).toMatchObject({
      ok: true,
      value: { name: "Lower" },
    });
    expect(await training.archiveRoutine(routine.value.id)).toMatchObject({ ok: true, value: { status: "archived" } });
    expect(await training.restoreRoutine(routine.value.id)).toMatchObject({ ok: true, value: { status: "active" } });
    expect(await training.listRoutines({ search: "Lower" })).toMatchObject({
      ok: true,
      value: [{ id: routine.value.id, name: "Lower" }],
    });
    expect(await training.suggestRoutine()).toEqual({ ok: true, value: null });
  });
});
