import type {
  Exercise,
  ExerciseDraft,
  ExercisePatch,
  ExerciseStatus,
  MuscleGroup,
} from "../domain/exercise";
import type { ExerciseId, Seconds } from "../domain/primitives";
import type { ExerciseRepository } from "../ports";
import type {
  ExerciseCatalog,
  ListExercisesQuery,
  UpdateExerciseInput,
  ApplicationResult,
} from "./contracts";
import { failure, success } from "./result";
import type { ApplicationError } from "./result";
import type { TrainingOrchestratorDependencies } from "./dependencies";

const validationError = (field: string): ApplicationError => ({
  code: "validation",
  details: { field },
});

const conflictError = (name: string): ApplicationError => ({
  code: "conflict",
  details: { name },
});

const notFoundError = (exerciseId: ExerciseId): ApplicationError => ({
  code: "not_found",
  details: { exerciseId },
});

const persistenceError = (code: string): ApplicationError => ({
  code: "persistence",
  details: { code },
});

const normalizedName = (name: string): string => name.trim();

const hasUniqueMuscles = (muscles: readonly MuscleGroup[]): boolean =>
  new Set(muscles).size === muscles.length;

const hasValidMuscles = (
  primaryMuscles: readonly MuscleGroup[],
  secondaryMuscles: readonly MuscleGroup[],
): boolean =>
  primaryMuscles.length > 0 &&
  hasUniqueMuscles(primaryMuscles) &&
  hasUniqueMuscles(secondaryMuscles) &&
  !secondaryMuscles.some((muscle) => primaryMuscles.includes(muscle));

const hasValidRest = (restSeconds: Seconds): boolean =>
  Number.isInteger(restSeconds) && restSeconds >= 0;

const isSameName = (left: string, right: string): boolean =>
  left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;

const isValidDraft = (draft: ExerciseDraft): string | null => {
  if (normalizedName(draft.name).length === 0) {
    return "name";
  }

  if (!hasValidMuscles(draft.primaryMuscles, draft.secondaryMuscles ?? [])) {
    return "muscles";
  }

  return hasValidRest(draft.defaultRestSeconds) ? null : "defaultRestSeconds";
};

const isValidPatch = (patch: ExercisePatch): string | null => {
  if (patch.name !== undefined && normalizedName(patch.name).length === 0) {
    return "name";
  }

  if (
    patch.primaryMuscles !== undefined &&
    !hasValidMuscles(patch.primaryMuscles, patch.secondaryMuscles ?? [])
  ) {
    return "muscles";
  }

  if (patch.secondaryMuscles !== undefined && !hasUniqueMuscles(patch.secondaryMuscles)) {
    return "muscles";
  }

  if (patch.defaultRestSeconds !== undefined && !hasValidRest(patch.defaultRestSeconds)) {
    return "defaultRestSeconds";
  }

  return null;
};

const isPersisted = <Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: { readonly code: string } },
): result is { readonly ok: true; readonly value: Value } => result.ok;

export class ExerciseCatalogService implements ExerciseCatalog {
  private readonly exercises: ExerciseRepository;
  private readonly clock: TrainingOrchestratorDependencies["clock"];
  private readonly ids: TrainingOrchestratorDependencies["ids"];

  constructor(dependencies: Pick<TrainingOrchestratorDependencies, "exercises" | "clock" | "ids">) {
    this.exercises = dependencies.exercises;
    this.clock = dependencies.clock;
    this.ids = dependencies.ids;
  }

  async createExercise(draft: ExerciseDraft): ApplicationResult<Exercise> {
    const invalidField = isValidDraft(draft);

    if (invalidField !== null) {
      return failure(validationError(invalidField));
    }

    const name = normalizedName(draft.name);
    const duplicate = await this.findDuplicateName(name);

    if (!duplicate.ok) {
      return failure(duplicate.error);
    }

    if (duplicate.value) {
      return failure(conflictError(name));
    }

    const timestamp = this.clock.now();
    const exercise: Exercise = {
      id: this.ids.generate<ExerciseId>(),
      name,
      primaryMuscles: draft.primaryMuscles,
      secondaryMuscles: draft.secondaryMuscles ?? [],
      defaultRestSeconds: draft.defaultRestSeconds,
      ...(draft.notes === undefined ? {} : { notes: draft.notes }),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return this.save(exercise);
  }

  async getExercise(exerciseId: ExerciseId): ApplicationResult<Exercise> {
    const found = await this.exercises.findExercise(exerciseId);

    if (!isPersisted(found)) {
      return failure(persistenceError(found.error.code));
    }

    return found.value === null ? failure(notFoundError(exerciseId)) : success(found.value);
  }

  async updateExercise(input: UpdateExerciseInput): ApplicationResult<Exercise> {
    const invalidField = isValidPatch(input.patch);

    if (invalidField !== null) {
      return failure(validationError(invalidField));
    }

    const current = await this.getExercise(input.exerciseId);

    if (!current.ok) {
      return current;
    }

    const exercise = this.applyPatch(current.value, input.patch);

    if (!hasValidMuscles(exercise.primaryMuscles, exercise.secondaryMuscles)) {
      return failure(validationError("muscles"));
    }

    const duplicate = await this.findDuplicateName(exercise.name, exercise.id);

    if (!duplicate.ok) {
      return failure(duplicate.error);
    }

    if (duplicate.value) {
      return failure(conflictError(exercise.name));
    }

    return this.save(exercise);
  }

  async archiveExercise(exerciseId: ExerciseId): ApplicationResult<Exercise> {
    return this.setStatus(exerciseId, "archived");
  }

  async restoreExercise(exerciseId: ExerciseId): ApplicationResult<Exercise> {
    return this.setStatus(exerciseId, "active");
  }

  async listExercises(query?: ListExercisesQuery): ApplicationResult<readonly Exercise[]> {
    const listed = await this.exercises.listExercises(query);

    return isPersisted(listed) ? success(listed.value) : failure(persistenceError(listed.error.code));
  }

  private applyPatch(exercise: Exercise, patch: ExercisePatch): Exercise {
    const name = patch.name === undefined ? exercise.name : normalizedName(patch.name);
    const primaryMuscles = patch.primaryMuscles ?? exercise.primaryMuscles;
    const secondaryMuscles = patch.secondaryMuscles ?? exercise.secondaryMuscles;
    const notes = patch.notes === undefined ? exercise.notes : patch.notes ?? undefined;

    return {
      ...exercise,
      name,
      primaryMuscles,
      secondaryMuscles,
      defaultRestSeconds: patch.defaultRestSeconds ?? exercise.defaultRestSeconds,
      ...(notes === undefined ? {} : { notes }),
      updatedAt: this.clock.now(),
    };
  }

  private async findDuplicateName(
    name: string,
    excludingId?: ExerciseId,
  ): Promise<{ readonly ok: true; readonly value: boolean } | { readonly ok: false; readonly error: ApplicationError }> {
    const listed = await this.exercises.listExercises();

    if (!isPersisted(listed)) {
      return failure(persistenceError(listed.error.code));
    }

    return success(
      listed.value.some(
        (exercise) => exercise.id !== excludingId && isSameName(exercise.name, name),
      ),
    );
  }

  private async save(exercise: Exercise): ApplicationResult<Exercise> {
    const saved = await this.exercises.saveExercise(exercise);

    return isPersisted(saved) ? success(exercise) : failure(persistenceError(saved.error.code));
  }

  private async setStatus(
    exerciseId: ExerciseId,
    status: ExerciseStatus,
  ): ApplicationResult<Exercise> {
    const current = await this.getExercise(exerciseId);

    if (!current.ok) {
      return current;
    }

    const exercise: Exercise = {
      ...current.value,
      status,
      updatedAt: this.clock.now(),
    };
    return this.save(exercise);
  }
}
