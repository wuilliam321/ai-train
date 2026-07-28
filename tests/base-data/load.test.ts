import { describe, expect, it } from "vitest";
import { baseDataCounts, loadBaseData } from "../../src/base-data/load";
import { TrainingOrchestrator } from "../../src/core";
import type { ISODateTime, Seconds } from "../../src/core";
import { TestClock, createTrainingEnvironment } from "../support/training-environment";

const now = "2026-07-28T12:00:00.000Z" as ISODateTime;

describe("base data loader", () => {
  it("loads through the public facade once and is idempotent thereafter", async () => {
    const training = new TrainingOrchestrator(createTrainingEnvironment(new TestClock(now)));

    expect(await loadBaseData(training)).toEqual({
      ok: true,
      value: {
        createdExercises: baseDataCounts.exercises,
        restoredExercises: 0,
        createdRoutines: baseDataCounts.routines,
      },
    });

    const exercises = await training.listExercises();
    const routines = await training.listRoutines();

    expect(exercises).toMatchObject({ ok: true, value: { length: baseDataCounts.exercises } });
    expect(routines).toMatchObject({ ok: true, value: { length: baseDataCounts.routines } });

    expect(await loadBaseData(training)).toEqual({
      ok: true,
      value: {
        createdExercises: 0,
        restoredExercises: 0,
        createdRoutines: 0,
      },
    });
  });

  it("restores an archived base exercise instead of creating a duplicate", async () => {
    const training = new TrainingOrchestrator(createTrainingEnvironment(new TestClock(now)));
    const created = await training.createExercise({
      name: "Deadlift",
      primaryMuscles: ["hamstrings", "glutes"],
      secondaryMuscles: ["back"],
      defaultRestSeconds: 120 as Seconds,
    });

    if (!created.ok) {
      throw new Error("Expected exercise creation");
    }

    expect(await training.archiveExercise(created.value.id)).toMatchObject({ ok: true });
    const loaded = await loadBaseData(training);

    expect(loaded).toMatchObject({ ok: true, value: { restoredExercises: 1 } });
    expect(await training.getExercise(created.value.id)).toMatchObject({
      ok: true,
      value: { id: created.value.id, status: "active" },
    });
  });
});
