import type { ApplicationError, ExerciseId, Result, TrainingOrchestrator } from "../core";
import { baseExercises } from "./exercises";
import { baseRoutines, resolveBaseRoutines } from "./routines";
import { resolveBasePrograms } from "./programs";

export interface BaseDataLoadResult {
  readonly createdExercises: number;
  readonly restoredExercises: number;
  readonly createdRoutines: number;
  readonly createdPrograms: number;
}

const normalizedName = (name: string): string => name.trim().toLocaleLowerCase();

const asFailure = <Value>(error: ApplicationError): Result<Value, ApplicationError> => ({ ok: false, error });

const findByName = <Value extends { readonly name: string }>(
  values: readonly Value[],
  name: string,
): Value | undefined => values.find((value) => normalizedName(value.name) === normalizedName(name));

export const loadBaseData = async (
  training: TrainingOrchestrator,
): Promise<Result<BaseDataLoadResult, ApplicationError>> => {
  const listedExercises = await training.listExercises();

  if (!listedExercises.ok) {
    return asFailure(listedExercises.error);
  }

  const exercises = [...listedExercises.value];
  let createdExercises = 0;
  let restoredExercises = 0;

  for (const draft of baseExercises) {
    const existing = findByName(exercises, draft.name);

    if (existing === undefined) {
      const created = await training.createExercise(draft);

      if (!created.ok) {
        return asFailure(created.error);
      }

      exercises.push(created.value);
      createdExercises += 1;
      continue;
    }

    if (existing.status === "archived") {
      const restored = await training.restoreExercise(existing.id);

      if (!restored.ok) {
        return asFailure(restored.error);
      }

      const position = exercises.indexOf(existing);
      exercises[position] = restored.value;
      restoredExercises += 1;
    }
  }

  const exerciseIds = new Map<string, ExerciseId>(
    exercises.map((exercise) => [exercise.name, exercise.id]),
  );
  const listedRoutines = await training.listRoutines();

  if (!listedRoutines.ok) {
    return asFailure(listedRoutines.error);
  }

  let createdRoutines = 0;

  for (const draft of resolveBaseRoutines(exerciseIds)) {
    if (findByName(listedRoutines.value, draft.name) !== undefined) {
      continue;
    }

    const created = await training.createRoutine(draft);

    if (!created.ok) {
      return asFailure(created.error);
    }

    createdRoutines += 1;
  }

  const availableRoutines = await training.listRoutines({ status: "active" });
  if (!availableRoutines.ok) return asFailure(availableRoutines.error);
  const fullRoutines = await Promise.all(availableRoutines.value.map((routine) => training.getRoutine(routine.id)));
  if (fullRoutines.some((routine) => !routine.ok)) return asFailure({ code: "persistence" });
  const programs = await training.listPrograms();
  if (!programs.ok) return asFailure(programs.error);
  let createdPrograms = 0;
  for (const program of resolveBasePrograms(fullRoutines.filter((routine): routine is { readonly ok: true; readonly value: import("../core").Routine } => routine.ok).map((routine) => routine.value))) {
    if (findByName(programs.value, program.name) !== undefined) continue;
    const created = await training.createProgram(program);
    if (!created.ok) return asFailure(created.error);
    createdPrograms += 1;
  }

  return {
    ok: true,
    value: {
      createdExercises,
      restoredExercises,
      createdRoutines,
      createdPrograms,
    },
  };
};

export const baseDataCounts = {
  exercises: baseExercises.length,
  routines: baseRoutines.length,
  programs: 3,
} as const;
