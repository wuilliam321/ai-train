import type { ExerciseId } from "../domain/primitives";
import type { PreviousSetReference } from "../domain/workout";
import type { WorkoutHistoryReader, WorkoutRepository } from "../ports";
import type { ApplicationResult, PreviousSetReferencesQuery } from "./contracts";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import { failure, success } from "./result";
import type { ApplicationError } from "./result";

const persistenceError = (code: string): ApplicationError => ({
  code: "persistence",
  details: { code },
});

const validationError = (field: string): ApplicationError => ({
  code: "validation",
  details: { field },
});

const isPersisted = <Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: { readonly code: string } },
): result is { readonly ok: true; readonly value: Value } => result.ok;

const isValidLimit = (limit: number): boolean => Number.isInteger(limit) && limit > 0;

export class TrainingHistoryService {
  private readonly workouts: WorkoutRepository;
  private readonly history: WorkoutHistoryReader;
  private readonly clock: TrainingOrchestratorDependencies["clock"];

  constructor(dependencies: Pick<TrainingOrchestratorDependencies, "workouts" | "history" | "clock">) {
    this.workouts = dependencies.workouts;
    this.history = dependencies.history;
    this.clock = dependencies.clock;
  }

  async getPreviousSetReferences(
    query: PreviousSetReferencesQuery,
  ): ApplicationResult<readonly PreviousSetReference[]> {
    if (!isValidLimit(query.limit)) {
      return failure(validationError("limit"));
    }

    const active = await this.workouts.findActiveWorkout();

    if (!isPersisted(active)) {
      return failure(persistenceError(active.error.code));
    }

    const found = await this.history.findPreviousSets({
      exerciseId: query.exerciseId as ExerciseId,
      before: active.value?.startedAt ?? this.clock.now(),
      limit: query.limit,
    });
    return isPersisted(found) ? success(found.value) : failure(persistenceError(found.error.code));
  }
}
