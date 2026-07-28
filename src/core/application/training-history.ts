import type { WorkoutSummary } from "../domain/insights";
import type { ExerciseId, Page, WorkoutSessionId } from "../domain/primitives";
import type { CompletedWorkoutSession, PreviousSetReference, WorkoutSession } from "../domain/workout";
import type { WorkoutHistoryReader, WorkoutRepository } from "../ports";
import type {
  ApplicationResult,
  ListWorkoutSessionsQuery,
  PreviousSetReferencesQuery,
} from "./contracts";
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

const isValidPeriod = (period: ListWorkoutSessionsQuery["period"]): boolean =>
  period === undefined || period.from < period.to;

const completedSetCount = (workout: CompletedWorkoutSession): number =>
  workout.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.status === "completed").length,
    0,
  );

const toSummary = (workout: CompletedWorkoutSession): WorkoutSummary => ({
  id: workout.id,
  ...(workout.routine === undefined ? {} : { routineId: workout.routine.id, routineName: workout.routine.name }),
  startedAt: workout.startedAt,
  completedAt: workout.completedAt,
  completedSetCount: completedSetCount(workout),
  volume: [],
});

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

  async listWorkoutSessions(
    query: ListWorkoutSessionsQuery,
  ): ApplicationResult<Page<WorkoutSummary>> {
    if (!isValidLimit(query.limit) || !isValidPeriod(query.period) || (query.cursor !== undefined && query.cursor.length === 0)) {
      return failure(validationError("query"));
    }

    const listed = await this.workouts.listWorkouts({
      limit: query.limit,
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.period === undefined ? {} : {
        completedFrom: query.period.from,
        completedTo: query.period.to,
      }),
    });

    if (!isPersisted(listed)) {
      return failure(persistenceError(listed.error.code));
    }

    return success({
      items: listed.value.items.filter(
        (workout): workout is CompletedWorkoutSession => workout.status === "completed",
      ).map(toSummary),
      ...(listed.value.nextCursor === undefined ? {} : { nextCursor: listed.value.nextCursor }),
    });
  }

  async getWorkoutSession(workoutSessionId: WorkoutSessionId): ApplicationResult<WorkoutSession> {
    const found = await this.workouts.findWorkout(workoutSessionId);

    if (!isPersisted(found)) {
      return failure(persistenceError(found.error.code));
    }

    return found.value === null ? failure({ code: "not_found", details: { workoutSessionId } }) : success(found.value);
  }
}
