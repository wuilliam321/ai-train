import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TrainingOrchestrator } from "../../src/core";
import type {
  CompletedWorkoutSession,
  ISODateTime,
  PreviousSetReference,
} from "../../src/core";
import { createJsonFileTrainingEnvironment } from "../../src/adapters/json-file";
import { SequentialIdGenerator, TestClock } from "../support/training-environment";

const weeks = 104;
const workoutsPerWeek = 5;
const exercisesPerWorkout = 5;
const setsPerExercise = 4;
const firstWorkoutAt = Date.parse("2024-01-01T12:00:00.000Z");
const primaryMuscles = ["quadriceps", "back", "chest", "hamstrings", "shoulders"] as const;

const timestamp = (offsetDays: number): ISODateTime =>
  new Date(firstWorkoutAt + offsetDays * 86_400_000).toISOString() as ISODateTime;

const createWorkouts = (): readonly CompletedWorkoutSession[] =>
  Array.from({ length: weeks * workoutsPerWeek }, (_, workoutIndex) => {
    const week = Math.floor(workoutIndex / workoutsPerWeek);
    const completedAt = timestamp(workoutIndex);
    const weight = 50 + week;

    return {
      id: `workout-${workoutIndex}` as never,
      status: "completed",
      startedAt: completedAt,
      completedAt,
      exercises: Array.from({ length: exercisesPerWorkout }, (_, exerciseIndex) => ({
        id: `workout-${workoutIndex}-exercise-${exerciseIndex}` as never,
        exercise: {
          id: `exercise-${exerciseIndex}` as never,
          name: `Exercise ${exerciseIndex + 1}`,
          primaryMuscles: [primaryMuscles[exerciseIndex]!],
          secondaryMuscles: [],
        },
        restSeconds: 120 as never,
        sets: Array.from({ length: setsPerExercise }, (_, setIndex) => ({
          id: `workout-${workoutIndex}-exercise-${exerciseIndex}-set-${setIndex}` as never,
          status: "completed" as const,
          type: "normal" as const,
          weight: { amount: weight as never, unit: "kg" as const },
          repetitions: 8 as never,
          completedAt,
        })),
      })),
    };
  });

const createReferences = (workouts: readonly CompletedWorkoutSession[]): readonly PreviousSetReference[] =>
  workouts.flatMap((workout) => workout.exercises.flatMap((exercise) => exercise.sets.flatMap((set, setPosition) =>
    set.status !== "completed" ? [] : [{
    sessionId: workout.id,
    setId: set.id,
    exerciseId: exercise.exercise.id,
    setPosition,
    type: set.type,
    weight: set.weight,
    repetitions: set.repetitions,
    completedAt: set.completedAt,
    }],
  )));

describe("longitudinal simulation", () => {
  it("keeps two years of offline training recoverable, pageable and measurable in under 500 ms", async () => {
    const started = performance.now();
    const completed = createWorkouts();
    const path = join(await mkdtemp(join(tmpdir(), "train-app-simulation-")), "train-app.json");
    const environment = await createJsonFileTrainingEnvironment({
      path,
      clock: new TestClock(timestamp(weeks * workoutsPerWeek)),
      ids: new SequentialIdGenerator(),
    });
    expect(await environment.importData(JSON.stringify({
      version: 1,
      exercises: [],
      routines: [],
      workouts: completed,
      history: createReferences(completed),
    }))).toEqual({ ok: true, value: undefined });
    const workouts = new TrainingOrchestrator(environment.dependencies);
    const period = { from: timestamp(0), to: timestamp(weeks * workoutsPerWeek) };
    const dashboard = await workouts.getDashboard(period);
    const progress = await workouts.getExerciseProgress({ exerciseId: "exercise-0" as never, period });
    const firstPage = await workouts.listWorkoutSessions({ limit: 50, period });

    if (!firstPage.ok || firstPage.value.nextCursor === undefined) {
      throw new Error("Expected first page");
    }

    const secondPage = await workouts.listWorkoutSessions({
      limit: 50,
      cursor: firstPage.value.nextCursor,
      period,
    });
    const active = await workouts.startWorkout({ source: "empty" });
    if (!active.ok) {
      throw new Error("Expected active workout");
    }
    const recoveredEnvironment = await createJsonFileTrainingEnvironment({ path });
    const recovered = await new TrainingOrchestrator(recoveredEnvironment.dependencies).getActiveWorkout();
    const references = await workouts.getPreviousSetReferences({
      exerciseId: "exercise-0" as never,
      limit: 1,
    });
    const elapsed = performance.now() - started;

    expect(dashboard).toEqual({
      ok: true,
      value: {
        period,
        workoutCount: 520,
        completedSetCount: 10_400,
        volume: [{ amount: 8_444_800, unit: "kg" }],
        muscleDistribution: ["quadriceps", "back", "chest", "hamstrings", "shoulders"].map((muscle) => ({
          muscle,
          volume: [{ amount: 1_688_960, unit: "kg" }],
        })),
        lastWorkout: {
          id: "workout-519",
          startedAt: timestamp(519),
          completedAt: timestamp(519),
          completedSetCount: 20,
          volume: [{ amount: 24_480, unit: "kg" }],
        },
      },
    });
    expect(progress).toEqual({
      ok: true,
      value: {
        exerciseId: "exercise-0",
        period,
        points: expect.arrayContaining([{
          recordedAt: timestamp(519),
          bestWeight: { amount: 153, unit: "kg" },
          volume: [{ amount: 4_896, unit: "kg" }],
        }]),
      },
    });
    expect(firstPage.value.items).toHaveLength(50);
    expect(secondPage).toMatchObject({ ok: true, value: { items: expect.any(Array) } });

    if (!secondPage.ok) {
      throw new Error("Expected second page");
    }

    expect(secondPage.value.items).toHaveLength(50);
    expect(recovered).toEqual(active);
    expect(references).toEqual({
      ok: true,
      value: [{
        sessionId: "workout-519",
        setId: "workout-519-exercise-0-set-0",
        exerciseId: "exercise-0",
        setPosition: 0,
        type: "normal",
        weight: { amount: 153, unit: "kg" },
        repetitions: 8,
        completedAt: timestamp(519),
      }],
    });
    expect(elapsed).toBeLessThan(500);
  });
});
