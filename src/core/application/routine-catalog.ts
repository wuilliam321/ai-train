import type {
  Repetitions,
  RoutineExerciseId,
  RoutineId,
  RoutineVariantId,
  Seconds,
} from "../domain/primitives";
import type {
  Laterality,
  RepetitionTarget,
  Routine,
  RoutineDraft,
  RoutineExerciseDraft,
  RoutineExercisePrescription,
  RoutineSetDraft,
  RoutineStatus,
  RoutineSummary,
  RoutineVariant,
  RoutineVariantDraft,
  SetType,
} from "../domain/routine";
import type { ExerciseRepository, RoutineRepository } from "../ports";
import type {
  ApplicationResult,
  ListRoutinesQuery,
  RoutineCatalog,
  UpdateRoutineInput,
} from "./contracts";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import { failure, success } from "./result";
import type { ApplicationError } from "./result";

const setTypes: readonly SetType[] = ["warmup", "normal", "drop", "failure"];
const lateralities: readonly Laterality[] = ["bilateral", "unilateral", "alternating"];

const validationError = (field: string): ApplicationError => ({
  code: "validation",
  details: { field },
});

const conflictError = (name: string): ApplicationError => ({
  code: "conflict",
  details: { name },
});

const notFoundError = (routineId: RoutineId): ApplicationError => ({
  code: "not_found",
  details: { routineId },
});

const persistenceError = (code: string): ApplicationError => ({
  code: "persistence",
  details: { code },
});

const normalizedName = (name: string): string => name.trim();

const hasUniqueValues = <Value>(values: readonly Value[]): boolean =>
  new Set(values).size === values.length;

const hasUniqueNames = (names: readonly string[]): boolean =>
  new Set(names.map((name) => normalizedName(name).toLocaleLowerCase())).size === names.length;

const hasValidRepetitions = (value: Repetitions): boolean =>
  Number.isInteger(value) && value > 0;

const hasValidTarget = (target: RepetitionTarget): boolean => {
  if (target.kind === "exact") {
    return hasValidRepetitions(target.repetitions);
  }

  return (
    target.kind === "range" &&
    hasValidRepetitions(target.minimum) &&
    hasValidRepetitions(target.maximum) &&
    target.minimum <= target.maximum
  );
};

const hasValidSet = (set: RoutineSetDraft): boolean =>
  setTypes.includes(set.type) && hasValidTarget(set.repetitions);

const hasValidRest = (restSeconds: Seconds | undefined): boolean =>
  restSeconds === undefined || (Number.isInteger(restSeconds) && restSeconds >= 0);

const hasValidExercise = (exercise: RoutineExerciseDraft): boolean =>
  exercise.sets.length > 0 &&
  exercise.sets.every(hasValidSet) &&
  lateralities.includes(exercise.laterality) &&
  hasValidRest(exercise.restSeconds);

const hasValidVariant = (variant: RoutineVariantDraft): boolean =>
  normalizedName(variant.name).length > 0 &&
  variant.exercises.length > 0 &&
  hasUniqueValues(variant.exercises.map((exercise) => exercise.exerciseId)) &&
  variant.exercises.every(hasValidExercise);

const hasValidVariants = (variants: readonly RoutineVariantDraft[]): boolean =>
  variants.length > 0 && hasUniqueNames(variants.map((variant) => variant.name)) && variants.every(hasValidVariant);

const isSameName = (left: string, right: string): boolean =>
  left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;

const isPersisted = <Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: { readonly code: string } },
): result is { readonly ok: true; readonly value: Value } => result.ok;

export class RoutineCatalogService implements RoutineCatalog {
  private readonly exercises: ExerciseRepository;
  private readonly routines: RoutineRepository;
  private readonly clock: TrainingOrchestratorDependencies["clock"];
  private readonly ids: TrainingOrchestratorDependencies["ids"];

  constructor(
    dependencies: Pick<TrainingOrchestratorDependencies, "exercises" | "routines" | "clock" | "ids">,
  ) {
    this.exercises = dependencies.exercises;
    this.routines = dependencies.routines;
    this.clock = dependencies.clock;
    this.ids = dependencies.ids;
  }

  async createRoutine(draft: RoutineDraft): ApplicationResult<Routine> {
    const invalidField = await this.validateDraft(draft);

    if (invalidField !== null) {
      return failure(invalidField);
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
    const routine: Routine = {
      id: this.ids.generate<RoutineId>(),
      name,
      variants: draft.variants.map((variant) => this.createVariant(variant)),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.save(routine);
  }

  async getRoutine(routineId: RoutineId): ApplicationResult<Routine> {
    const found = await this.routines.findRoutine(routineId);

    if (!isPersisted(found)) {
      return failure(persistenceError(found.error.code));
    }

    return found.value === null ? failure(notFoundError(routineId)) : success(found.value);
  }

  async updateRoutine(input: UpdateRoutineInput): ApplicationResult<Routine> {
    if (input.patch.name !== undefined && normalizedName(input.patch.name).length === 0) {
      return failure(validationError("name"));
    }

    if (input.patch.variants !== undefined) {
      const invalidField = await this.validateDraft({
        name: "routine",
        variants: input.patch.variants,
      });

      if (invalidField !== null) {
        return failure(invalidField);
      }
    }

    const current = await this.getRoutine(input.routineId);

    if (!current.ok) {
      return current;
    }

    const name = input.patch.name === undefined ? current.value.name : normalizedName(input.patch.name);
    const duplicate = await this.findDuplicateName(name, current.value.id);

    if (!duplicate.ok) {
      return failure(duplicate.error);
    }

    if (duplicate.value) {
      return failure(conflictError(name));
    }

    const routine: Routine = {
      ...current.value,
      name,
      variants: input.patch.variants === undefined
        ? current.value.variants
        : input.patch.variants.map((variant) => this.createVariant(variant)),
      updatedAt: this.clock.now(),
    };

    return this.save(routine);
  }

  async archiveRoutine(routineId: RoutineId): ApplicationResult<Routine> {
    return this.setStatus(routineId, "archived");
  }

  async restoreRoutine(routineId: RoutineId): ApplicationResult<Routine> {
    return this.setStatus(routineId, "active");
  }

  async listRoutines(query?: ListRoutinesQuery): ApplicationResult<readonly RoutineSummary[]> {
    const listed = await this.routines.listRoutines(query);

    if (!isPersisted(listed)) {
      return failure(persistenceError(listed.error.code));
    }

    return success(listed.value.map(this.toSummary));
  }

  async suggestRoutine(): ApplicationResult<RoutineSummary | null> {
    return success(null);
  }

  private async validateDraft(draft: RoutineDraft): Promise<ApplicationError | null> {
    if (normalizedName(draft.name).length === 0) {
      return validationError("name");
    }

    if (!hasValidVariants(draft.variants)) {
      return validationError("variants");
    }

    for (const exercise of draft.variants.flatMap((variant) => variant.exercises)) {
      const found = await this.exercises.findExercise(exercise.exerciseId);

      if (!isPersisted(found)) {
        return persistenceError(found.error.code);
      }

      if (found.value === null || found.value.status !== "active") {
        return validationError("exerciseId");
      }
    }

    return null;
  }

  private createVariant(draft: RoutineVariantDraft): RoutineVariant {
    return {
      id: this.ids.generate<RoutineVariantId>(),
      name: normalizedName(draft.name),
      exercises: draft.exercises.map((exercise) => this.createExercise(exercise)),
    };
  }

  private createExercise(draft: RoutineExerciseDraft): RoutineExercisePrescription {
    return {
      id: this.ids.generate<RoutineExerciseId>(),
      exerciseId: draft.exerciseId,
      sets: draft.sets,
      laterality: draft.laterality,
      ...(draft.restSeconds === undefined ? {} : { restSeconds: draft.restSeconds }),
      ...(draft.notes === undefined ? {} : { notes: draft.notes }),
    };
  }

  private async findDuplicateName(
    name: string,
    excludingId?: RoutineId,
  ): Promise<{ readonly ok: true; readonly value: boolean } | { readonly ok: false; readonly error: ApplicationError }> {
    const listed = await this.routines.listRoutines();

    if (!isPersisted(listed)) {
      return failure(persistenceError(listed.error.code));
    }

    return success(
      listed.value.some(
        (routine) => routine.id !== excludingId && isSameName(routine.name, name),
      ),
    );
  }

  private async save(routine: Routine): ApplicationResult<Routine> {
    const saved = await this.routines.saveRoutine(routine);

    return isPersisted(saved) ? success(routine) : failure(persistenceError(saved.error.code));
  }

  private async setStatus(
    routineId: RoutineId,
    status: RoutineStatus,
  ): ApplicationResult<Routine> {
    const current = await this.getRoutine(routineId);

    if (!current.ok) {
      return current;
    }

    return this.save({
      ...current.value,
      status,
      updatedAt: this.clock.now(),
    });
  }

  private toSummary(routine: Routine): RoutineSummary {
    return {
      id: routine.id,
      name: routine.name,
      variantCount: routine.variants.length,
      status: routine.status,
    };
  }
}
