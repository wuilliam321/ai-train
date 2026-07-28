import { describe, expect, it } from "vitest";
import { TrainingOrchestrator, success } from "../../src/core";
import { ExerciseCatalogService } from "../../src/core/application/exercise-catalog";
import { failure } from "../../src/core/application/result";
import type {
  ExerciseDraft,
  ISODateTime,
  PersistenceResult,
  PreviousSetQuery,
  PreviousSetReference,
  Repetitions,
  Seconds,
  Weight,
  WeightAmount,
  WorkoutHistoryReader,
  WorkoutRepository,
} from "../../src/core";
import { createTrainingEnvironment, TestClock } from "../support/training-environment";

const startedAt = "2026-07-28T12:00:00.000Z" as ISODateTime;
const oneMinuteLater = "2026-07-28T12:01:00.000Z" as ISODateTime;
const weight: Weight = { amount: 100 as WeightAmount, unit: "kg" };

const squat: ExerciseDraft = {
  name: "Back Squat",
  primaryMuscles: ["quadriceps"],
  defaultRestSeconds: 180 as Seconds,
};

class RecordingHistory implements WorkoutHistoryReader {
  readonly queries: PreviousSetQuery[] = [];
  private readonly references: readonly PreviousSetReference[];

  constructor(references: readonly PreviousSetReference[]) {
    this.references = references;
  }

  async findPreviousSets(query: PreviousSetQuery): PersistenceResult<readonly PreviousSetReference[]> {
    this.queries.push(query);
    return success(this.references);
  }
}

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

const unavailableHistory = (): WorkoutHistoryReader => ({
  findPreviousSets: async () => failure({ code: "unavailable" }),
});

const saveUnavailableWorkouts = (workouts: WorkoutRepository): WorkoutRepository => ({
  findWorkout: (workoutSessionId) => workouts.findWorkout(workoutSessionId),
  findActiveWorkout: () => workouts.findActiveWorkout(),
  listWorkouts: (query) => workouts.listWorkouts(query),
  saveWorkout: async () => failure({ code: "unavailable" }),
});

const createWorkoutWithSet = async () => {
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

  return {
    clock,
    environment,
    workouts,
    exerciseId: exercise.value.id,
    workoutSetId: addedSet.value.exercises[0]!.sets[0]!.id,
  };
};

describe("rest and history", () => {
  it("derives, adjusts, cancels and restores rest from the active aggregate", async () => {
    const { clock, workouts, workoutSetId } = await createWorkoutWithSet();
    const completed = await workouts.completeWorkoutSet({
      workoutSetId,
      weight,
      repetitions: 8 as Repetitions,
    });

    expect(completed).toMatchObject({
      ok: true,
      value: {
        restPeriod: {
          sourceSetId: workoutSetId,
          startedAt,
          endsAt: "2026-07-28T12:03:00.000Z",
        },
      },
    });
    expect(await workouts.getRestPeriod()).toEqual({
      ok: true,
      value: {
        sourceSetId: workoutSetId,
        startedAt,
        endsAt: "2026-07-28T12:03:00.000Z",
      },
    });
    clock.set(oneMinuteLater);
    expect(await workouts.setRestDuration({ duration: 30 as Seconds })).toEqual({
      ok: true,
      value: {
        sourceSetId: workoutSetId,
        startedAt,
        endsAt: "2026-07-28T12:01:30.000Z",
      },
    });
    expect(await workouts.cancelRest()).toEqual({ ok: true, value: undefined });
    expect(await workouts.getRestPeriod()).toEqual({ ok: true, value: null });
    expect(await workouts.cancelRest()).toEqual({ ok: true, value: undefined });
    expect(await workouts.setRestDuration({ duration: 30 as Seconds })).toEqual({
      ok: false,
      error: { code: "conflict", details: { resource: "restPeriod" } },
    });
    expect(await workouts.reopenWorkoutSet(workoutSetId)).toMatchObject({ ok: true });
    expect(await workouts.completeWorkoutSet({
      workoutSetId,
      weight,
      repetitions: 8 as Repetitions,
    })).toMatchObject({ ok: true });
    const active = await workouts.getActiveWorkout();

    if (!active.ok || active.value === null) {
      throw new Error("Expected active workout");
    }

    expect(await workouts.removeWorkoutExercise(active.value.exercises[0]!.id)).toMatchObject({ ok: true });
    expect(await workouts.getRestPeriod()).toEqual({ ok: true, value: null });
  });

  it("returns previous references before the active workout without reading its sets", async () => {
    const { environment, exerciseId } = await createWorkoutWithSet();
    const reference: PreviousSetReference = {
      sessionId: "previous-session" as never,
      setId: "previous-set" as never,
      exerciseId,
      setPosition: 0,
      type: "normal",
      weight,
      repetitions: 8 as Repetitions,
      completedAt: "2026-07-21T12:00:00.000Z" as ISODateTime,
    };
    const history = new RecordingHistory([reference]);
    const withHistory = new TrainingOrchestrator({ ...environment, history });

    expect(await withHistory.getPreviousSetReferences({ exerciseId, limit: 1 })).toEqual({
      ok: true,
      value: [reference],
    });
    expect(history.queries).toEqual([{ exerciseId, before: startedAt, limit: 1 }]);
  });

  it("returns typed rest and reference errors without persisting invalid changes", async () => {
    const { environment, workouts, exerciseId } = await createWorkoutWithSet();

    expect(await workouts.setRestDuration({ duration: -1 as Seconds })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "duration" } },
    });
    expect(await workouts.getPreviousSetReferences({ exerciseId, limit: 0 })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "limit" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: unavailableWorkouts(),
    }).getRestPeriod()).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: unavailableWorkouts(),
    }).getPreviousSetReferences({ exerciseId, limit: 1 })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      history: unavailableHistory(),
    }).getPreviousSetReferences({ exerciseId, limit: 1 })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: saveUnavailableWorkouts(environment.workouts),
    }).cancelRest()).toEqual({ ok: true, value: undefined });
    const withoutActive = createTrainingEnvironment(new TestClock(startedAt));
    const withoutActiveWorkouts = new TrainingOrchestrator(withoutActive);

    expect(await withoutActiveWorkouts.getRestPeriod()).toEqual({ ok: true, value: null });
    expect(await withoutActiveWorkouts.setRestDuration({ duration: 30 as Seconds })).toEqual({
      ok: false,
      error: { code: "no_active_workout" },
    });
    expect(await withoutActiveWorkouts.cancelRest()).toEqual({
      ok: false,
      error: { code: "no_active_workout" },
    });
    const noActiveHistory = new RecordingHistory([]);

    expect(await new TrainingOrchestrator({
      ...withoutActive,
      history: noActiveHistory,
    }).getPreviousSetReferences({ exerciseId, limit: 1 })).toEqual({ ok: true, value: [] });
    expect(noActiveHistory.queries).toEqual([{ exerciseId, before: startedAt, limit: 1 }]);
    const withRest = await createWorkoutWithSet();

    expect(await withRest.workouts.completeWorkoutSet({
      workoutSetId: withRest.workoutSetId,
      weight,
      repetitions: 8 as Repetitions,
    })).toMatchObject({ ok: true });
    expect(await new TrainingOrchestrator({
      ...withRest.environment,
      workouts: saveUnavailableWorkouts(withRest.environment.workouts),
    }).setRestDuration({ duration: 30 as Seconds })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...withRest.environment,
      workouts: saveUnavailableWorkouts(withRest.environment.workouts),
    }).cancelRest()).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
  });
});
