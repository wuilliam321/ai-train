import type { ApplicationError, ExerciseId, Result, TrainingOrchestrator } from "../core";
import { baseExercises } from "./exercises";
import { baseRoutines, resolveBaseRoutines } from "./routines";

export interface BaseDataLoadResult {
  readonly createdExercises: number;
  readonly restoredExercises: number;
  readonly createdRoutines: number;
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

  return {
    ok: true,
    value: {
      createdExercises,
      restoredExercises,
      createdRoutines,
    },
  };
};

export const baseDataCounts = {
  exercises: baseExercises.length,
  routines: baseRoutines.length,
} as const;
