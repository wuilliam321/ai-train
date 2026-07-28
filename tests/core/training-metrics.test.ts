import { describe, expect, it } from "vitest";
import { TrainingOrchestrator, success } from "../../src/core";
import { failure } from "../../src/core/application/result";
import type {
  CompletedWorkoutSession,
  ISODateTime,
  PersistenceResult,
  WorkoutRepository,
  WorkoutRepositoryQuery,
} from "../../src/core";
import { createTrainingEnvironment, TestClock } from "../support/training-environment";

const period = {
  from: "2026-07-01T00:00:00.000Z" as ISODateTime,
  to: "2026-08-01T00:00:00.000Z" as ISODateTime,
};

const first: CompletedWorkoutSession = {
  id: "first" as never,
  status: "completed",
  startedAt: "2026-07-10T12:00:00.000Z" as ISODateTime,
  completedAt: "2026-07-10T13:00:00.000Z" as ISODateTime,
  exercises: [{
    id: "first-exercise" as never,
    exercise: {
      id: "squat" as never,
      name: "Back Squat",
      primaryMuscles: ["quadriceps", "glutes"],
      secondaryMuscles: ["back"],
    },
    restSeconds: 180 as never,
    sets: [{
      id: "warmup" as never,
      status: "completed",
      type: "warmup",
      weight: { amount: 50 as never, unit: "kg" },
      repetitions: 10 as never,
      completedAt: "2026-07-10T12:10:00.000Z" as ISODateTime,
    }, {
      id: "normal" as never,
      status: "completed",
      type: "normal",
      weight: { amount: 100 as never, unit: "kg" },
      repetitions: 5 as never,
      completedAt: "2026-07-10T12:20:00.000Z" as ISODateTime,
    }, {
      id: "drop" as never,
      status: "completed",
      type: "drop",
      weight: { amount: 200 as never, unit: "lb" },
      repetitions: 3 as never,
      completedAt: "2026-07-10T12:30:00.000Z" as ISODateTime,
    }, {
      id: "lighter" as never,
      status: "completed",
      type: "normal",
      weight: { amount: 90 as never, unit: "kg" },
      repetitions: 1 as never,
      completedAt: "2026-07-10T12:40:00.000Z" as ISODateTime,
    }, {
      id: "heavier" as never,
      status: "completed",
      type: "normal",
      weight: { amount: 110 as never, unit: "kg" },
      repetitions: 1 as never,
      completedAt: "2026-07-10T12:50:00.000Z" as ISODateTime,
    }],
  }],
};

const second: CompletedWorkoutSession = {
  ...first,
  id: "second" as never,
  completedAt: "2026-07-11T13:00:00.000Z" as ISODateTime,
  routine: {
    id: "routine" as never,
    name: "Full Body",
    variantId: "variant" as never,
    variantName: "Gym",
  },
  exercises: [{
    ...first.exercises[0]!,
    sets: [{
      id: "failure" as never,
      status: "completed",
      type: "failure",
      weight: { amount: 110 as never, unit: "kg" },
      repetitions: 4 as never,
      completedAt: "2026-07-11T12:30:00.000Z" as ISODateTime,
    }],
  }],
};

const pagedWorkouts = (queries: WorkoutRepositoryQuery[]): WorkoutRepository => ({
  findWorkout: async () => success(null),
  findActiveWorkout: async () => success(null),
  listWorkouts: async (query) => {
    queries.push(query);
    return query.cursor === undefined
      ? success({ items: [first], nextCursor: "second" })
      : success({ items: [second] });
  },
  saveWorkout: async () => success(undefined),
});

const unavailableWorkouts = (): WorkoutRepository => {
  const unavailable = <Value>(): PersistenceResult<Value> =>
    Promise.resolve(failure({ code: "unavailable" }));

  return {
    findWorkout: unavailable,
    findActiveWorkout: unavailable,
    listWorkouts: unavailable,
    saveWorkout: unavailable,
  };
};

describe("training metrics", () => {
  it("calculates effective volume, muscle distribution and progress without mixing units", async () => {
    const queries: WorkoutRepositoryQuery[] = [];
    const environment = createTrainingEnvironment(new TestClock(period.from));
    const metrics = new TrainingOrchestrator({
      ...environment,
      workouts: pagedWorkouts(queries),
    });

    expect(await metrics.getDashboard(period)).toEqual({
      ok: true,
      value: {
        period,
        workoutCount: 2,
        completedSetCount: 6,
        volume: [{ amount: 1140, unit: "kg" }, { amount: 600, unit: "lb" }],
        muscleDistribution: [{
          muscle: "quadriceps",
          volume: [{ amount: 570, unit: "kg" }, { amount: 300, unit: "lb" }],
        }, {
          muscle: "glutes",
          volume: [{ amount: 570, unit: "kg" }, { amount: 300, unit: "lb" }],
        }],
        lastWorkout: {
          id: second.id,
          routineId: "routine",
          routineName: "Full Body",
          startedAt: second.startedAt,
          completedAt: second.completedAt,
          completedSetCount: 1,
          volume: [{ amount: 440, unit: "kg" }],
        },
      },
    });
    expect(await metrics.getExerciseProgress({
      exerciseId: "squat" as never,
      period,
    })).toEqual({
      ok: true,
      value: {
        exerciseId: "squat",
        period,
        points: [{
          recordedAt: first.completedAt,
          bestWeight: { amount: 110, unit: "kg" },
          volume: [{ amount: 700, unit: "kg" }],
        }, {
          recordedAt: first.completedAt,
          bestWeight: { amount: 200, unit: "lb" },
          volume: [{ amount: 600, unit: "lb" }],
        }, {
          recordedAt: second.completedAt,
          bestWeight: { amount: 110, unit: "kg" },
          volume: [{ amount: 440, unit: "kg" }],
        }],
      },
    });
    expect(queries).toEqual([
      { limit: 100, completedFrom: period.from, completedTo: period.to },
      { limit: 100, completedFrom: period.from, completedTo: period.to, cursor: "second" },
      { limit: 100, completedFrom: period.from, completedTo: period.to },
      { limit: 100, completedFrom: period.from, completedTo: period.to, cursor: "second" },
    ]);
    expect(await new TrainingOrchestrator(environment).getDashboard(period)).toEqual({
      ok: true,
      value: {
        period,
        workoutCount: 0,
        completedSetCount: 0,
        volume: [],
        muscleDistribution: [],
      },
    });
    const firstOnly: WorkoutRepository = {
      findWorkout: async () => success(null),
      findActiveWorkout: async () => success(null),
      listWorkouts: async () => success({ items: [first] }),
      saveWorkout: async () => success(undefined),
    };

    expect(await new TrainingOrchestrator({ ...environment, workouts: firstOnly }).getDashboard(period)).toMatchObject({
      ok: true,
      value: { lastWorkout: { id: first.id } },
    });
  });

  it("returns typed errors for invalid periods and unavailable history", async () => {
    const environment = createTrainingEnvironment(new TestClock(period.from));
    const metrics = new TrainingOrchestrator(environment);

    expect(await metrics.getDashboard({ from: period.to, to: period.from })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "period" } },
    });
    expect(await metrics.getExerciseProgress({
      exerciseId: "squat" as never,
      period: { from: period.to, to: period.from },
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "period" } } });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: unavailableWorkouts(),
    }).getDashboard(period)).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: unavailableWorkouts(),
    }).getExerciseProgress({ exerciseId: "squat" as never, period })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
  });
});
