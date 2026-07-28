import type { ISODateTime, Seconds } from "../domain/primitives";
import type { ActiveWorkoutSession, RestPeriod } from "../domain/workout";
import type { WorkoutRepository } from "../ports";
import type { ApplicationResult, SetRestDurationInput } from "./contracts";
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

const noActiveWorkoutError = (): ApplicationError => ({
  code: "no_active_workout",
});

const noRestPeriodError = (): ApplicationError => ({
  code: "conflict",
  details: { resource: "restPeriod" },
});

const isPersisted = <Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: { readonly code: string } },
): result is { readonly ok: true; readonly value: Value } => result.ok;

const isValidDuration = (duration: Seconds): boolean =>
  Number.isInteger(duration) && duration >= 0;

const addSeconds = (startedAt: ISODateTime, seconds: Seconds): ISODateTime =>
  new Date(Date.parse(startedAt) + seconds * 1000).toISOString() as ISODateTime;

export class RestManagementService {
  private readonly workouts: WorkoutRepository;
  private readonly clock: TrainingOrchestratorDependencies["clock"];

  constructor(dependencies: Pick<TrainingOrchestratorDependencies, "workouts" | "clock">) {
    this.workouts = dependencies.workouts;
    this.clock = dependencies.clock;
  }

  async getRestPeriod(): ApplicationResult<RestPeriod | null> {
    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active.error.code === "no_active_workout" ? success(null) : active;
    }

    return success(active.value.restPeriod ?? null);
  }

  async setRestDuration(input: SetRestDurationInput): ApplicationResult<RestPeriod> {
    if (!isValidDuration(input.duration)) {
      return failure(validationError("duration"));
    }

    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    if (active.value.restPeriod === undefined) {
      return failure(noRestPeriodError());
    }

    const restPeriod: RestPeriod = {
      ...active.value.restPeriod,
      endsAt: addSeconds(this.clock.now(), input.duration),
    };
    const saved = await this.workouts.saveWorkout({ ...active.value, restPeriod });
    return isPersisted(saved) ? success(restPeriod) : failure(persistenceError(saved.error.code));
  }

  async cancelRest(): ApplicationResult<void> {
    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    if (active.value.restPeriod === undefined) {
      return success(undefined);
    }

    const { restPeriod: _restPeriod, ...withoutRestPeriod } = active.value;
    const saved = await this.workouts.saveWorkout(withoutRestPeriod);
    return isPersisted(saved) ? success(undefined) : failure(persistenceError(saved.error.code));
  }

  private async findActiveWorkout(): ApplicationResult<ActiveWorkoutSession> {
    const active = await this.workouts.findActiveWorkout();

    if (!isPersisted(active)) {
      return failure(persistenceError(active.error.code));
    }

    return active.value === null ? failure(noActiveWorkoutError()) : success(active.value);
  }
}
