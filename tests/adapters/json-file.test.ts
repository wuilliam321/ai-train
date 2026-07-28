import { mkdtemp, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ExerciseCatalogService } from "../../src/core/application/exercise-catalog";
import { TrainingOrchestrator } from "../../src/core";
import type { ISODateTime, Repetitions, Seconds, WeightAmount } from "../../src/core";
import { createJsonFileTrainingEnvironment } from "../../src/adapters/json-file";
import type { JsonFileSystem } from "../../src/adapters/json-file";
import { SequentialIdGenerator, TestClock } from "../support/training-environment";

const startedAt = "2026-07-28T12:00:00.000Z" as ISODateTime;
const completedAt = "2026-07-28T13:00:00.000Z" as ISODateTime;

const createPath = async (): Promise<string> => join(await mkdtemp(join(tmpdir(), "train-app-")), "train-app.json");

const createEnvironment = async (path: string, clock = new TestClock(startedAt)) => {
  const environment = await createJsonFileTrainingEnvironment({
    path,
    clock,
    ids: new SequentialIdGenerator(),
  });
  return { environment, clock };
};

const createCompletedWorkout = async (path: string) => {
  const { environment, clock } = await createEnvironment(path);
  const catalog = new ExerciseCatalogService(environment.dependencies);
  const workouts = new TrainingOrchestrator(environment.dependencies);
  const exercise = await catalog.createExercise({
    name: "Back Squat",
    primaryMuscles: ["quadriceps"],
    defaultRestSeconds: 180 as Seconds,
  });

  if (!exercise.ok) {
    throw new Error("Expected exercise creation");
  }

  const active = await workouts.startWorkout({ source: "empty" });
  if (!active.ok) {
    throw new Error("Expected active workout");
  }

  const withExercise = await workouts.addWorkoutExercise({ exerciseId: exercise.value.id });
  if (!withExercise.ok) {
    throw new Error("Expected workout exercise");
  }

  const withSet = await workouts.addWorkoutSet({
    workoutExerciseId: withExercise.value.exercises[0]!.id,
    type: "normal",
  });
  if (!withSet.ok) {
    throw new Error("Expected workout set");
  }

  const completed = await workouts.completeWorkoutSet({
    workoutSetId: withSet.value.exercises[0]!.sets[0]!.id,
    weight: { amount: 100 as WeightAmount, unit: "kg" },
    repetitions: 8 as Repetitions,
  });
  if (!completed.ok) {
    throw new Error("Expected completed set");
  }

  clock.set(completedAt);
  const finished = await workouts.finishWorkout();
  if (!finished.ok) {
    throw new Error("Expected finished workout");
  }

  return { environment, exercise: exercise.value, finished: finished.value };
};

describe("JSON file persistence", () => {
  it("recovers active rest, closed history and metrics after rebuilding the adapter", async () => {
    const path = await createPath();
    const { environment, clock } = await createEnvironment(path);
    const catalog = new ExerciseCatalogService(environment.dependencies);
    const workouts = new TrainingOrchestrator(environment.dependencies);
    const exercise = await catalog.createExercise({
      name: "Back Squat",
      primaryMuscles: ["quadriceps"],
      defaultRestSeconds: 180 as Seconds,
    });

    if (!exercise.ok) {
      throw new Error("Expected exercise creation");
    }

    const active = await workouts.startWorkout({ source: "empty" });
    if (!active.ok) {
      throw new Error("Expected active workout");
    }
    const withExercise = await workouts.addWorkoutExercise({ exerciseId: exercise.value.id });
    if (!withExercise.ok) {
      throw new Error("Expected workout exercise");
    }
    const withSet = await workouts.addWorkoutSet({ workoutExerciseId: withExercise.value.exercises[0]!.id, type: "normal" });
    if (!withSet.ok) {
      throw new Error("Expected workout set");
    }
    const completed = await workouts.completeWorkoutSet({
      workoutSetId: withSet.value.exercises[0]!.sets[0]!.id,
      weight: { amount: 100 as WeightAmount, unit: "kg" },
      repetitions: 8 as Repetitions,
    });
    if (!completed.ok) {
      throw new Error("Expected completed set");
    }

    const rebuilt = await createEnvironment(path, clock);
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

  it("keeps the principal file intact when its temporary write fails", async () => {
    const path = await createPath();
    const original = await createEnvironment(path);
    const catalog = new ExerciseCatalogService(original.environment.dependencies);
    const created = await catalog.createExercise({ name: "Squat", primaryMuscles: ["quadriceps"], defaultRestSeconds: 60 as Seconds });
    expect(created.ok).toBe(true);
    const before = await readFile(path, "utf8");
    const fileSystem: JsonFileSystem = {
      readFile,
      mkdir: async () => undefined,
      writeFile: async () => Promise.reject(new Error("disk full")),
      rename,
      copyFile: async () => undefined,
    };
    const failing = await createJsonFileTrainingEnvironment({ path, fileSystem });
    const failed = await new ExerciseCatalogService(failing.dependencies).createExercise({
      name: "Row",
      primaryMuscles: ["back"],
      defaultRestSeconds: 60 as Seconds,
    });
    expect(failed).toEqual({ ok: false, error: { code: "persistence", details: { code: "unavailable" } } });
    expect(await readFile(path, "utf8")).toBe(before);
  });

  it("backs up corruption and rejects incompatible imports without replacing current data", async () => {
    const path = await createPath();
    const created = await createCompletedWorkout(path);
    const exported = await created.environment.exportData();
    expect(await created.environment.importData('{"version":2}')).toEqual({ ok: false, error: { code: "corrupt_data" } });
    expect(await created.environment.exportData()).toBe(exported);

    await writeFile(path, "not json", "utf8");
    const recovered = await createEnvironment(path);
    expect(await new TrainingOrchestrator(recovered.environment.dependencies).getActiveWorkout()).toEqual({ ok: true, value: null });
    expect((await readdir(join(path, ".."))).some((name) => name.startsWith("train-app.json.corrupt-"))).toBe(true);
  });
});
