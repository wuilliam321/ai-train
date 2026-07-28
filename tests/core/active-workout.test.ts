import { describe, expect, it } from "vitest";
import { ExerciseCatalogService } from "../../src/core/application/exercise-catalog";
import { RoutineCatalogService } from "../../src/core/application/routine-catalog";
import { failure, success } from "../../src/core/application/result";
import { TrainingOrchestrator } from "../../src/core";
import type {
  ExerciseDraft,
  ExerciseRepository,
  ISODateTime,
  PersistenceResult,
  Repetitions,
  RoutineDraft,
  RoutineRepository,
  Seconds,
  WorkoutRepository,
} from "../../src/core";
import { createTrainingEnvironment, TestClock } from "../support/training-environment";

const startedAt = "2026-07-28T12:00:00.000Z" as ISODateTime;

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

const unavailableRoutines = (): RoutineRepository => {
  const unavailable = <Value>(): PersistenceResult<Value> =>
    Promise.resolve(failure({ code: "unavailable" }));

  return {
    findRoutine: unavailable,
    listRoutines: unavailable,
    saveRoutine: unavailable,
  };
};

const unavailableExercises = (): ExerciseRepository => {
  const unavailable = <Value>(): PersistenceResult<Value> =>
    Promise.resolve(failure({ code: "unavailable" }));

  return {
    findExercise: unavailable,
    listExercises: unavailable,
    saveExercise: unavailable,
  };
};

const missingExercises = (): ExerciseRepository => ({
  findExercise: async () => success(null),
  listExercises: async () => success([]),
  saveExercise: async () => success(undefined),
});

const saveUnavailableWorkouts = (workouts: WorkoutRepository): WorkoutRepository => ({
  findWorkout: (workoutSessionId) => workouts.findWorkout(workoutSessionId),
  findActiveWorkout: () => workouts.findActiveWorkout(),
  listWorkouts: (query) => workouts.listWorkouts(query),
  saveWorkout: async () => failure({ code: "unavailable" }),
});

const createServices = () => {
  const environment = createTrainingEnvironment(new TestClock(startedAt));
  return {
    environment,
    exercises: new ExerciseCatalogService(environment),
    routines: new RoutineCatalogService(environment),
    workouts: new TrainingOrchestrator(environment),
  };
};

const createRoutine = async (
  exercises: ExerciseCatalogService,
  routines: RoutineCatalogService,
) => {
  const createdSquat = await exercises.createExercise(squat);
  const createdRow = await exercises.createExercise(row);

  if (!createdSquat.ok || !createdRow.ok) {
    throw new Error("Expected exercise creation");
  }

  const draft: RoutineDraft = {
    name: "Full Body",
    variants: [{
      name: "Gym",
      exercises: [{
        exerciseId: createdSquat.value.id,
        sets: [{ type: "warmup", repetitions: { kind: "exact", repetitions: 8 as Repetitions } }],
        laterality: "bilateral",
        restSeconds: 90 as Seconds,
        notes: "Controlled descent",
      }, {
        exerciseId: createdRow.value.id,
        sets: [{
          type: "normal",
          repetitions: { kind: "range", minimum: 6 as Repetitions, maximum: 8 as Repetitions },
        }],
        laterality: "bilateral",
      }],
    }],
  };
  const routine = await routines.createRoutine(draft);

  if (!routine.ok) {
    throw new Error("Expected routine creation");
  }

  return routine.value;
};

describe("active workout", () => {
  it("starts an empty workout and recovers it from the persisted aggregate", async () => {
    const { environment, workouts } = createServices();
    const started = await workouts.startWorkout({ source: "empty" });

    expect(started).toMatchObject({
      ok: true,
      value: { id: "id-1", exercises: [], status: "active", startedAt },
    });

    if (!started.ok) {
      throw new Error("Expected workout creation");
    }

    const recovered = await new TrainingOrchestrator(environment).getActiveWorkout();

    expect(recovered).toEqual(started);
    expect(await workouts.startWorkout({ source: "empty" })).toEqual({
      ok: false,
      error: { code: "conflict", details: { workoutSessionId: started.value.id } },
    });
  });

  it("captures a routine variant as an independent active workout snapshot", async () => {
    const { exercises, routines, workouts } = createServices();
    const routine = await createRoutine(exercises, routines);
    const started = await workouts.startWorkout({
      source: "routine",
      routineId: routine.id,
      variantId: routine.variants[0]!.id,
    });

    expect(started).toMatchObject({
      ok: true,
      value: {
        routine: { id: routine.id, name: "Full Body", variantName: "Gym" },
        exercises: [{
          exercise: { name: "Back Squat" },
          restSeconds: 90,
          notes: "Controlled descent",
          sets: [{ type: "warmup", target: { kind: "exact", repetitions: 8 }, status: "pending" }],
        }, {
          exercise: { name: "Barbell Row" },
          restSeconds: 120,
          sets: [{ type: "normal", target: { kind: "range", minimum: 6, maximum: 8 }, status: "pending" }],
        }],
      },
    });
  });

  it("returns typed errors without creating an invalid active workout", async () => {
    const { environment, exercises, routines, workouts } = createServices();
    const routine = await createRoutine(exercises, routines);

    expect(await workouts.startWorkout({
      source: "routine",
      routineId: "missing" as typeof routine.id,
      variantId: routine.variants[0]!.id,
    })).toEqual({
      ok: false,
      error: { code: "not_found", details: { routineId: "missing" } },
    });
    expect(await workouts.startWorkout({
      source: "routine",
      routineId: routine.id,
      variantId: "missing" as never,
    })).toEqual({
      ok: false,
      error: { code: "not_found", details: { variantId: "missing" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: unavailableWorkouts(),
    }).getActiveWorkout()).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: unavailableWorkouts(),
    }).startWorkout({ source: "empty" })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      workouts: saveUnavailableWorkouts(environment.workouts),
    }).startWorkout({ source: "empty" })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      routines: unavailableRoutines(),
    }).startWorkout({
      source: "routine",
      routineId: routine.id,
      variantId: routine.variants[0]!.id,
    })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      exercises: unavailableExercises(),
    }).startWorkout({
      source: "routine",
      routineId: routine.id,
      variantId: routine.variants[0]!.id,
    })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await new TrainingOrchestrator({
      ...environment,
      exercises: missingExercises(),
    }).startWorkout({
      source: "routine",
      routineId: routine.id,
      variantId: routine.variants[0]!.id,
    })).toEqual({
      ok: false,
      error: { code: "not_found", details: { exerciseId: routine.variants[0]!.exercises[0]!.exerciseId } },
    });
    expect(await routines.archiveRoutine(routine.id)).toMatchObject({ ok: true });
    expect(await workouts.startWorkout({
      source: "routine",
      routineId: routine.id,
      variantId: routine.variants[0]!.id,
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "routineId" } },
    });
  });
});
