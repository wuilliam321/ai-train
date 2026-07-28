import { describe, expect, it } from "vitest";
import { TrainingOrchestrator } from "../../src/core";
import { WorkoutLifecycleService } from "../../src/core/application/workout-lifecycle";
import { ExerciseCatalogService } from "../../src/core/application/exercise-catalog";
import { failure, success } from "../../src/core/application/result";
import type {
  ExerciseDraft,
  ISODateTime,
  PersistenceResult,
  Repetitions,
  Seconds,
  Weight,
  WeightAmount,
  WorkoutRepository,
  WorkoutRepositoryQuery,
} from "../../src/core";
import { createTrainingEnvironment, TestClock } from "../support/training-environment";

const startedAt = "2026-07-28T12:00:00.000Z" as ISODateTime;
const completedAt = "2026-07-28T13:00:00.000Z" as ISODateTime;
const weight: Weight = { amount: 100 as WeightAmount, unit: "kg" };

const squat: ExerciseDraft = {
  name: "Back Squat",
  primaryMuscles: ["quadriceps"],
  defaultRestSeconds: 180 as Seconds,
};

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

const saveUnavailableWorkouts = (workouts: WorkoutRepository): WorkoutRepository => ({
  findWorkout: (workoutSessionId) => workouts.findWorkout(workoutSessionId),
  findActiveWorkout: () => workouts.findActiveWorkout(),
  listWorkouts: (query) => workouts.listWorkouts(query),
  saveWorkout: async () => failure({ code: "unavailable" }),
});

const createCompletedWorkout = async () => {
  const clock = new TestClock(startedAt);
  const environment = createTrainingEnvironment(clock);
  const catalog = new ExerciseCatalogService(environment);
  const workouts = new TrainingOrchestrator(environment);
  const exercise = await catalog.createExercise(squat);

  if (!exercise.ok) {
    throw new Error("Expected exercise creation");
  }

  await workouts.startWorkout({ source: "empty" });
  const addedExercise = await workouts.addWorkoutExercise({ exerciseId: exercise.value.id });

  if (!addedExercise.ok) {
    throw new Error("Expected workout exercise");
  }

  const addedSet = await workouts.addWorkoutSet({
    workoutExerciseId: addedExercise.value.exercises[0]!.id,
    type: "normal",
  });

  if (!addedSet.ok) {
    throw new Error("Expected workout set");
  }

  await workouts.completeWorkoutSet({
    workoutSetId: addedSet.value.exercises[0]!.sets[0]!.id,
    weight,
    repetitions: 8 as Repetitions,
  });
  clock.set(completedAt);
  return { clock, environment, workouts };
};

describe("workout lifecycle", () => {
  it("finishes and discards workouts while publishing one snapshot for each saved change", async () => {
    const { environment, workouts } = await createCompletedWorkout();
    const snapshots: unknown[] = [];
    const unsubscribe = workouts.subscribe((snapshot) => snapshots.push(snapshot));
    const finished = await workouts.finishWorkout();

    expect(finished).toMatchObject({
      ok: true,
      value: { status: "completed", completedAt },
    });

    if (!finished.ok) {
      throw new Error("Expected completed workout");
    }

    expect(snapshots).toEqual([{ activeWorkout: null, restPeriod: null }]);
    expect(await workouts.getActiveWorkout()).toEqual({ ok: true, value: null });
    expect(await workouts.getWorkoutSession(finished.value.id)).toEqual(finished);
    expect(await workouts.listWorkoutSessions({ limit: 1 })).toEqual({
      ok: true,
      value: {
        items: [{
          id: finished.value.id,
          startedAt,
          completedAt,
          completedSetCount: 1,
          volume: [],
        }],
      },
    });
    expect(await workouts.startWorkout({ source: "empty" })).toMatchObject({ ok: true });
    expect(await workouts.discardWorkout()).toEqual({ ok: true, value: undefined });
    unsubscribe();
    expect(snapshots).toEqual([
      { activeWorkout: null, restPeriod: null },
      expect.objectContaining({ activeWorkout: expect.any(Object), restPeriod: null }),
      { activeWorkout: null, restPeriod: null },
    ]);
    expect(await new TrainingOrchestrator(environment).getActiveWorkout()).toEqual({ ok: true, value: null });
  });

  it("returns typed lifecycle and history errors", async () => {
    const environment = createTrainingEnvironment(new TestClock(startedAt));
    const workouts = new TrainingOrchestrator(environment);
    expect(await new WorkoutLifecycleService({ workouts: unavailableWorkouts(), clock: new TestClock(startedAt) }).finishWorkout()).toMatchObject({ ok: false, error: { code: "persistence" } });

    expect(await workouts.finishWorkout()).toEqual({ ok: false, error: { code: "no_active_workout" } });
    expect(await workouts.discardWorkout()).toEqual({ ok: false, error: { code: "no_active_workout" } });
    expect(await workouts.listWorkoutSessions({ limit: 0 })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "query" } },
    });
    expect(await workouts.listWorkoutSessions({
      limit: 1,
      cursor: "",
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "query" } } });
    expect(await workouts.listWorkoutSessions({
      limit: 1,
      period: { from: completedAt, to: startedAt },
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "query" } } });
    expect(await workouts.getWorkoutSession("missing" as never)).toEqual({
      ok: false,
      error: { code: "not_found", details: { workoutSessionId: "missing" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: unavailableWorkouts(),
    }).finishWorkout()).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: unavailableWorkouts(),
    }).listWorkoutSessions({ limit: 1 })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: unavailableWorkouts(),
    }).getWorkoutSession("missing" as never)).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    await workouts.startWorkout({ source: "empty" });
    const savingFails = new TrainingOrchestrator({
      ...environment,
      workouts: saveUnavailableWorkouts(environment.workouts),
    });

    expect(await savingFails.finishWorkout()).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await savingFails.discardWorkout()).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
  });

  it("forwards a stable cursor and period while summarizing routine workouts", async () => {
    const { environment, workouts } = await createCompletedWorkout();
    const completed = await workouts.finishWorkout();

    if (!completed.ok) {
      throw new Error("Expected completed workout");
    }

    const routineWorkout = {
      ...completed.value,
      routine: {
        id: "routine" as never,
        name: "Full Body",
        variantId: "variant" as never,
        variantName: "Gym",
      },
    };
    let received: WorkoutRepositoryQuery | undefined;
    const pagedWorkouts: WorkoutRepository = {
      findWorkout: (workoutSessionId) => environment.workouts.findWorkout(workoutSessionId),
      findActiveWorkout: () => environment.workouts.findActiveWorkout(),
      listWorkouts: async (query) => {
        received = query;
        return success({ items: [routineWorkout], nextCursor: "next" });
      },
      saveWorkout: (workout) => environment.workouts.saveWorkout(workout),
    };

    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: pagedWorkouts,
    }).listWorkoutSessions({
      limit: 1,
      cursor: "cursor",
      period: { from: startedAt, to: completedAt },
    })).toEqual({
      ok: true,
      value: {
        items: [{
          id: completed.value.id,
          routineId: "routine",
          routineName: "Full Body",
          startedAt,
          completedAt,
          completedSetCount: 1,
          volume: [],
        }],
        nextCursor: "next",
      },
    });
    expect(received).toEqual({
      limit: 1,
      cursor: "cursor",
      completedFrom: startedAt,
      completedTo: completedAt,
    });
  });
});
