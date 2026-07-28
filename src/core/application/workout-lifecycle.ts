import type { CompletedWorkoutSession } from "../domain/workout";
import type { WorkoutRepository } from "../ports";
import type { ApplicationResult } from "./contracts";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import { failure, success } from "./result";
import type { ApplicationError } from "./result";

const persistenceError = (code: string): ApplicationError => ({
  code: "persistence",
  details: { code },
});

const noActiveWorkoutError = (): ApplicationError => ({
  code: "no_active_workout",
});

const isPersisted = <Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: { readonly code: string } },
): result is { readonly ok: true; readonly value: Value } => result.ok;

export class WorkoutLifecycleService {
  private readonly workouts: WorkoutRepository;
  private readonly clock: TrainingOrchestratorDependencies["clock"];

  constructor(dependencies: Pick<TrainingOrchestratorDependencies, "workouts" | "clock">) {
    this.workouts = dependencies.workouts;
    this.clock = dependencies.clock;
  }

  async finishWorkout(): ApplicationResult<CompletedWorkoutSession> {
    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    const { restPeriod: _restPeriod, ...workout } = active.value;
    const completed: CompletedWorkoutSession = {
      ...workout,
      status: "completed",
      completedAt: this.clock.now(),
    };
    const saved = await this.workouts.saveWorkout(completed);
    return isPersisted(saved) ? success(completed) : failure(persistenceError(saved.error.code));
  }

  async discardWorkout(): ApplicationResult<void> {
    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    const { restPeriod: _restPeriod, ...workout } = active.value;
    const discarded = {
      ...workout,
      status: "discarded" as const,
      discardedAt: this.clock.now(),
    };
    const saved = await this.workouts.saveWorkout(discarded);
    return isPersisted(saved) ? success(undefined) : failure(persistenceError(saved.error.code));
  }

  private async findActiveWorkout() {
    const active = await this.workouts.findActiveWorkout();

    if (!isPersisted(active)) {
      return failure(persistenceError(active.error.code));
    }

    return active.value === null ? failure(noActiveWorkoutError()) : success(active.value);
  }
}
