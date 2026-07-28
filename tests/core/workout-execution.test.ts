import { describe, expect, it } from "vitest";
import { TrainingOrchestrator } from "../../src/core";
import { ExerciseCatalogService } from "../../src/core/application/exercise-catalog";
import { failure } from "../../src/core/application/result";
import type {
  ExerciseDraft,
  ExerciseRepository,
  ISODateTime,
  PersistenceResult,
  Repetitions,
  Seconds,
  Weight,
  WeightAmount,
  WorkoutRepository,
} from "../../src/core";
import { createTrainingEnvironment, TestClock } from "../support/training-environment";

const startedAt = "2026-07-28T12:00:00.000Z" as ISODateTime;
const weight: Weight = { amount: 100 as WeightAmount, unit: "kg" };

const squat: ExerciseDraft = {
  name: "Back Squat",
  primaryMuscles: ["quadriceps"],
  defaultRestSeconds: 180 as Seconds,
};

const row: ExerciseDraft = {
  name: "Barbell Row",
  primaryMuscles: ["back"],
  defaultRestSeconds: 120 as Seconds,
};

const createServices = () => {
  const environment = createTrainingEnvironment(new TestClock(startedAt));
  return {
    environment,
    catalog: new ExerciseCatalogService(environment),
    workouts: new TrainingOrchestrator(environment),
  };
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

const unavailableExercises = (): ExerciseRepository => {
  const unavailable = <Value>(): PersistenceResult<Value> =>
    Promise.resolve(failure({ code: "unavailable" }));

  return {
    findExercise: unavailable,
    listExercises: unavailable,
    saveExercise: unavailable,
  };
};

describe("workout execution", () => {
  it("records a workout by editing its exercises and sets", async () => {
    const { catalog, workouts } = createServices();
    const createdSquat = await catalog.createExercise(squat);
    const createdRow = await catalog.createExercise(row);

    if (!createdSquat.ok || !createdRow.ok) {
      throw new Error("Expected exercise creation");
    }

    expect(await workouts.startWorkout({ source: "empty" })).toMatchObject({ ok: true });
    const addedSquat = await workouts.addWorkoutExercise({ exerciseId: createdSquat.value.id });

    if (!addedSquat.ok) {
      throw new Error("Expected workout exercise");
    }

    const squatExercise = addedSquat.value.exercises[0]!;
    const addedRow = await workouts.addWorkoutExercise({ exerciseId: createdRow.value.id, position: 0 });

    expect(addedRow).toMatchObject({
      ok: true,
      value: { exercises: [{ exercise: { name: "Barbell Row" } }, { exercise: { name: "Back Squat" } }] },
    });
    const moved = await workouts.moveWorkoutExercise({
      workoutExerciseId: squatExercise.id,
      position: 0,
    });

    expect(moved).toMatchObject({ ok: true });

    if (!moved.ok) {
      throw new Error("Expected moved workout exercise");
    }

    expect(moved.value.exercises[0]!.id).toBe(squatExercise.id);

    const addedSet = await workouts.addWorkoutSet({
      workoutExerciseId: squatExercise.id,
      type: "normal",
    });

    if (!addedSet.ok) {
      throw new Error("Expected workout set");
    }

    const set = addedSet.value.exercises[0]!.sets[0]!;
    const updated = await workouts.updateWorkoutSet({
      workoutSetId: set.id,
      type: "failure",
      weight,
      repetitions: 8 as Repetitions,
      effort: { kind: "rpe", value: 9 },
    });

    expect(updated).toMatchObject({ ok: true });

    if (!updated.ok) {
      throw new Error("Expected updated workout set");
    }

    expect(updated.value.exercises[0]!.sets[0]).toMatchObject({
      type: "failure",
      weight,
      repetitions: 8,
      effort: { kind: "rpe", value: 9 },
    });
    const cleared = await workouts.updateWorkoutSet({
      workoutSetId: set.id,
      weight: null,
      repetitions: null,
      effort: null,
    });

    expect(cleared).toMatchObject({ ok: true });

    if (!cleared.ok) {
      throw new Error("Expected cleared workout set");
    }

    expect(cleared.value.exercises[0]!.sets[0]).toMatchObject({ type: "failure" });
    expect(cleared.value.exercises[0]!.sets[0]).not.toHaveProperty("weight");
    expect(await workouts.updateWorkoutSet({
      workoutSetId: set.id,
      type: "normal",
    })).toMatchObject({ ok: true });
    const completed = await workouts.completeWorkoutSet({
      workoutSetId: set.id,
      weight,
      repetitions: 8 as Repetitions,
      effort: { kind: "rir", value: 1 },
    });

    expect(completed).toMatchObject({ ok: true });

    if (!completed.ok) {
      throw new Error("Expected completed workout set");
    }

    expect(completed.value.exercises[0]!.sets[0]).toMatchObject({
      status: "completed",
      completedAt: startedAt,
      effort: { kind: "rir", value: 1 },
    });
    const reopened = await workouts.reopenWorkoutSet(set.id);

    expect(reopened).toMatchObject({ ok: true });

    if (!reopened.ok) {
      throw new Error("Expected reopened workout set");
    }

    expect(reopened.value.exercises[0]!.sets[0]).toMatchObject({
      status: "pending",
      weight,
      repetitions: 8,
    });
    const secondSet = await workouts.addWorkoutSet({
      workoutExerciseId: squatExercise.id,
      type: "warmup",
      position: 0,
    });

    if (!secondSet.ok) {
      throw new Error("Expected second workout set");
    }

    const movedSet = await workouts.moveWorkoutSet({
      workoutSetId: set.id,
      position: 0,
    });

    expect(movedSet).toMatchObject({ ok: true });

    if (!movedSet.ok) {
      throw new Error("Expected moved workout set");
    }

    expect(movedSet.value.exercises[0]!.sets[0]!.id).toBe(set.id);

    expect(await workouts.updateWorkoutSet({
      workoutSetId: set.id,
      weight: { amount: 100 as WeightAmount, unit: "lb" },
    })).toMatchObject({ ok: true });

    const removedSet = await workouts.removeWorkoutSet(secondSet.value.exercises[0]!.sets[0]!.id);

    expect(removedSet).toMatchObject({ ok: true });

    if (!removedSet.ok) {
      throw new Error("Expected removed workout set");
    }

    expect(removedSet.value.exercises[0]!.sets[0]!.id).toBe(set.id);
    const active = await workouts.getActiveWorkout();

    if (!active.ok || active.value === null) {
      throw new Error("Expected active workout");
    }

    const removedExercise = await workouts.removeWorkoutExercise(active.value.exercises[1]!.id);

    expect(removedExercise).toMatchObject({ ok: true });

    if (!removedExercise.ok) {
      throw new Error("Expected removed workout exercise");
    }

    expect(removedExercise.value.exercises).toHaveLength(1);
    expect(removedExercise.value.exercises[0]!.id).toBe(squatExercise.id);
  });

  it("rejects invalid execution commands without changing the active workout", async () => {
    const missingExerciseId = "missing-exercise" as never;
    const missingWorkoutExerciseId = "missing-workout-exercise" as never;
    const missingWorkoutSetId = "missing-workout-set" as never;
    const withoutActive = createServices().workouts;

    expect(await withoutActive.addWorkoutExercise({ exerciseId: missingExerciseId })).toEqual({
      ok: false,
      error: { code: "no_active_workout" },
    });
    expect(await withoutActive.moveWorkoutExercise({
      workoutExerciseId: missingWorkoutExerciseId,
      position: 0,
    })).toEqual({ ok: false, error: { code: "no_active_workout" } });
    expect(await withoutActive.removeWorkoutExercise(missingWorkoutExerciseId)).toEqual({
      ok: false,
      error: { code: "no_active_workout" },
    });
    expect(await withoutActive.addWorkoutSet({
      workoutExerciseId: missingWorkoutExerciseId,
      type: "normal",
    })).toEqual({ ok: false, error: { code: "no_active_workout" } });
    expect(await withoutActive.moveWorkoutSet({
      workoutSetId: missingWorkoutSetId,
      position: 0,
    })).toEqual({ ok: false, error: { code: "no_active_workout" } });
    expect(await withoutActive.updateWorkoutSet({ workoutSetId: missingWorkoutSetId })).toEqual({
      ok: false,
      error: { code: "no_active_workout" },
    });
    expect(await withoutActive.removeWorkoutSet(missingWorkoutSetId)).toEqual({
      ok: false,
      error: { code: "no_active_workout" },
    });
    expect(await withoutActive.completeWorkoutSet({
      workoutSetId: missingWorkoutSetId,
      weight,
      repetitions: 8 as Repetitions,
    })).toEqual({ ok: false, error: { code: "no_active_workout" } });
    expect(await withoutActive.reopenWorkoutSet(missingWorkoutSetId)).toEqual({
      ok: false,
      error: { code: "no_active_workout" },
    });

    const { environment, catalog, workouts } = createServices();
    const createdExercise = await catalog.createExercise(squat);

    if (!createdExercise.ok) {
      throw new Error("Expected exercise creation");
    }

    expect(await workouts.startWorkout({ source: "empty" })).toMatchObject({ ok: true });
    expect(await workouts.addWorkoutExercise({ exerciseId: missingExerciseId })).toEqual({
      ok: false,
      error: { code: "not_found", details: { exerciseId: "missing-exercise" } },
    });
    expect(await catalog.archiveExercise(createdExercise.value.id)).toMatchObject({ ok: true });
    expect(await workouts.addWorkoutExercise({ exerciseId: createdExercise.value.id })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "exerciseId" } },
    });
    expect(await catalog.restoreExercise(createdExercise.value.id)).toMatchObject({ ok: true });
    expect(await workouts.addWorkoutExercise({
      exerciseId: createdExercise.value.id,
      position: -1,
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "position" } } });
    const addedExercise = await workouts.addWorkoutExercise({ exerciseId: createdExercise.value.id });

    if (!addedExercise.ok) {
      throw new Error("Expected workout exercise");
    }

    const workoutExerciseId = addedExercise.value.exercises[0]!.id;
    expect(await workouts.moveWorkoutExercise({
      workoutExerciseId: missingWorkoutExerciseId,
      position: 0,
    })).toEqual({
      ok: false,
      error: { code: "not_found", details: { workoutExerciseId: "missing-workout-exercise" } },
    });
    expect(await workouts.moveWorkoutExercise({ workoutExerciseId, position: 1 })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "position" } },
    });
    expect(await workouts.removeWorkoutExercise(missingWorkoutExerciseId)).toEqual({
      ok: false,
      error: { code: "not_found", details: { workoutExerciseId: "missing-workout-exercise" } },
    });
    expect(await workouts.addWorkoutSet({
      workoutExerciseId,
      type: "invalid" as never,
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "type" } } });
    expect(await workouts.addWorkoutSet({
      workoutExerciseId: missingWorkoutExerciseId,
      type: "normal",
    })).toEqual({
      ok: false,
      error: { code: "not_found", details: { workoutExerciseId: "missing-workout-exercise" } },
    });
    expect(await workouts.addWorkoutSet({
      workoutExerciseId,
      type: "normal",
      position: 1,
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "position" } } });
    const addedSet = await workouts.addWorkoutSet({ workoutExerciseId, type: "normal" });

    if (!addedSet.ok) {
      throw new Error("Expected workout set");
    }

    const workoutSetId = addedSet.value.exercises[0]!.sets[0]!.id;
    expect(await workouts.moveWorkoutSet({
      workoutSetId: missingWorkoutSetId,
      position: 0,
    })).toEqual({
      ok: false,
      error: { code: "not_found", details: { workoutSetId: "missing-workout-set" } },
    });
    expect(await workouts.moveWorkoutSet({ workoutSetId, position: 1 })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "position" } },
    });
    expect(await workouts.updateWorkoutSet({
      workoutSetId,
      type: "invalid" as never,
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "type" } } });
    expect(await workouts.updateWorkoutSet({
      workoutSetId,
      weight: { amount: -1 as WeightAmount, unit: "kg" },
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "weight" } } });
    expect(await workouts.updateWorkoutSet({
      workoutSetId,
      repetitions: 0 as Repetitions,
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "repetitions" } } });
    expect(await workouts.updateWorkoutSet({
      workoutSetId,
      effort: { kind: "rpe", value: 11 },
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "effort" } } });
    expect(await workouts.updateWorkoutSet({ workoutSetId: missingWorkoutSetId })).toEqual({
      ok: false,
      error: { code: "not_found", details: { workoutSetId: "missing-workout-set" } },
    });
    expect(await workouts.removeWorkoutSet(missingWorkoutSetId)).toEqual({
      ok: false,
      error: { code: "not_found", details: { workoutSetId: "missing-workout-set" } },
    });
    expect(await workouts.completeWorkoutSet({
      workoutSetId,
      weight: { amount: -1 as WeightAmount, unit: "kg" },
      repetitions: 8 as Repetitions,
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "weight" } } });
    expect(await workouts.completeWorkoutSet({
      workoutSetId,
      weight,
      repetitions: 0 as Repetitions,
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "repetitions" } } });
    expect(await workouts.completeWorkoutSet({
      workoutSetId,
      weight,
      repetitions: 8 as Repetitions,
      effort: { kind: "rir", value: 1.5 },
    })).toEqual({ ok: false, error: { code: "validation", details: { field: "effort" } } });
    expect(await workouts.completeWorkoutSet({
      workoutSetId: missingWorkoutSetId,
      weight,
      repetitions: 8 as Repetitions,
    })).toEqual({
      ok: false,
      error: { code: "not_found", details: { workoutSetId: "missing-workout-set" } },
    });
    expect(await workouts.reopenWorkoutSet(missingWorkoutSetId)).toEqual({
      ok: false,
      error: { code: "not_found", details: { workoutSetId: "missing-workout-set" } },
    });
    expect(await workouts.reopenWorkoutSet(workoutSetId)).toEqual({
      ok: false,
      error: { code: "conflict", details: { workoutSetId } },
    });
    expect(await workouts.completeWorkoutSet({
      workoutSetId,
      weight,
      repetitions: 8 as Repetitions,
    })).toMatchObject({ ok: true });
    expect(await workouts.updateWorkoutSet({ workoutSetId })).toEqual({
      ok: false,
      error: { code: "conflict", details: { workoutSetId } },
    });
    expect(await workouts.completeWorkoutSet({
      workoutSetId,
      weight,
      repetitions: 8 as Repetitions,
    })).toEqual({
      ok: false,
      error: { code: "conflict", details: { workoutSetId } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      exercises: unavailableExercises(),
    }).addWorkoutExercise({ exerciseId: createdExercise.value.id })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: unavailableWorkouts(),
    }).removeWorkoutExercise(workoutExerciseId)).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: saveUnavailableWorkouts(environment.workouts),
    }).removeWorkoutSet(workoutSetId)).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
  });
});
