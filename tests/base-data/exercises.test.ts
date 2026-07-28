import { describe, expect, it } from "vitest";
import { baseExercises } from "../../src/base-data/exercises";
import { TrainingOrchestrator } from "../../src/core";
import type { ISODateTime } from "../../src/core";
import { TestClock, createTrainingEnvironment } from "../support/training-environment";

const now = "2026-07-28T12:00:00.000Z" as ISODateTime;

describe("base exercises", () => {
  it("contains a normalized catalog accepted by the public facade", async () => {
    const training = new TrainingOrchestrator(createTrainingEnvironment(new TestClock(now)));
    const created = await Promise.all(baseExercises.map((exercise) => training.createExercise(exercise)));

    expect(created.every((result) => result.ok)).toBe(true);
    const listed = await training.listExercises();

    if (!listed.ok) {
      throw new Error("Expected base exercise catalog");
    }

    expect(listed.value.map((exercise) => exercise.name)).toEqual(baseExercises.map((exercise) => exercise.name));
  });
});
