import type {
  DashboardSummary,
  ExerciseProgress,
  ExerciseProgressPoint,
  MuscleVolume,
  TrainingVolume,
  WorkoutSummary,
} from "../domain/insights";
import type { DateRange, ExerciseId, WeightUnit } from "../domain/primitives";
import type { CompletedWorkoutSession, WorkoutExercise, WorkoutSet } from "../domain/workout";
import type { WorkoutRepository } from "../ports";
import type { ApplicationResult, ExerciseProgressQuery } from "./contracts";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import { failure, success } from "./result";
import type { ApplicationError } from "./result";

const pageSize = 100;

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

const isValidPeriod = (period: DateRange): boolean => period.from < period.to;

const isEffectiveSet = (set: WorkoutSet): set is Extract<WorkoutSet, { readonly status: "completed" }> =>
  set.status === "completed" && set.type !== "warmup";

const toVolume = (set: Extract<WorkoutSet, { readonly status: "completed" }>): TrainingVolume => ({
  amount: set.weight.amount * set.repetitions,
  unit: set.weight.unit,
});

const totalByUnit = (volumes: readonly TrainingVolume[]): readonly TrainingVolume[] => {
  const totals = new Map<WeightUnit, number>();

  for (const volume of volumes) {
    totals.set(volume.unit, (totals.get(volume.unit) ?? 0) + volume.amount);
  }

  return [...totals.entries()].map(([unit, amount]) => ({ amount, unit }));
};

const completedSetCount = (workout: CompletedWorkoutSession): number =>
  workout.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.status === "completed").length,
    0,
  );

const effectiveSets = (exercise: WorkoutExercise): readonly Extract<WorkoutSet, { readonly status: "completed" }>[] =>
  exercise.sets.filter(isEffectiveSet);

const workoutVolumes = (workout: CompletedWorkoutSession): readonly TrainingVolume[] =>
  totalByUnit(workout.exercises.flatMap((exercise) => effectiveSets(exercise).map(toVolume)));

const toSummary = (workout: CompletedWorkoutSession): WorkoutSummary => ({
  id: workout.id,
  ...(workout.routine === undefined ? {} : { routineId: workout.routine.id, routineName: workout.routine.name }),
  startedAt: workout.startedAt,
  completedAt: workout.completedAt,
  completedSetCount: completedSetCount(workout),
  volume: workoutVolumes(workout),
});

const muscleDistribution = (workouts: readonly CompletedWorkoutSession[]): readonly MuscleVolume[] => {
  const totals = new Map<string, number>();

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      for (const set of effectiveSets(exercise)) {
        const amount = set.weight.amount * set.repetitions / exercise.exercise.primaryMuscles.length;

        for (const muscle of exercise.exercise.primaryMuscles) {
          const key = `${muscle}:${set.weight.unit}`;
          totals.set(key, (totals.get(key) ?? 0) + amount);
        }
      }
    }
  }

  const muscles = new Map<string, TrainingVolume[]>();

  for (const [key, amount] of totals) {
    const [muscle, unit] = key.split(":") as [string, WeightUnit];
    muscles.set(muscle, [...(muscles.get(muscle) ?? []), { amount, unit }]);
  }

  return [...muscles.entries()].map(([muscle, volume]) => ({ muscle: muscle as MuscleVolume["muscle"], volume }));
};

export class TrainingMetricsService {
  private readonly workouts: WorkoutRepository;

  constructor(dependencies: Pick<TrainingOrchestratorDependencies, "workouts">) {
    this.workouts = dependencies.workouts;
  }

  async getDashboard(period: DateRange): ApplicationResult<DashboardSummary> {
    if (!isValidPeriod(period)) {
      return failure(validationError("period"));
    }

    const workouts = await this.listCompletedWorkouts(period);

    if (!workouts.ok) {
      return workouts;
    }

    const lastWorkout = workouts.value.at(-1);
    return success({
      period,
      workoutCount: workouts.value.length,
      completedSetCount: workouts.value.reduce((total, workout) => total + completedSetCount(workout), 0),
      volume: totalByUnit(workouts.value.flatMap(workoutVolumes)),
      muscleDistribution: muscleDistribution(workouts.value),
      ...(lastWorkout === undefined ? {} : { lastWorkout: toSummary(lastWorkout) }),
    });
  }

  async getExerciseProgress(query: ExerciseProgressQuery): ApplicationResult<ExerciseProgress> {
    if (!isValidPeriod(query.period)) {
      return failure(validationError("period"));
    }

    const workouts = await this.listCompletedWorkouts(query.period);

    if (!workouts.ok) {
      return workouts;
    }

    return success({
      exerciseId: query.exerciseId,
      period: query.period,
      points: workouts.value.flatMap((workout) => this.progressPoints(workout, query.exerciseId)),
    });
  }

  private async listCompletedWorkouts(
    period: DateRange,
  ): Promise<{ readonly ok: true; readonly value: readonly CompletedWorkoutSession[] } | { readonly ok: false; readonly error: ApplicationError }> {
    const workouts: CompletedWorkoutSession[] = [];
    let cursor: string | undefined;

    do {
      const listed = await this.workouts.listWorkouts({
        limit: pageSize,
        completedFrom: period.from,
        completedTo: period.to,
        ...(cursor === undefined ? {} : { cursor }),
      });

      if (!isPersisted(listed)) {
        return failure(persistenceError(listed.error.code));
      }

      workouts.push(...listed.value.items.filter(
        (workout): workout is CompletedWorkoutSession => workout.status === "completed",
      ));
      cursor = listed.value.nextCursor;
    } while (cursor !== undefined);

    return success(workouts);
  }

  private progressPoints(
    workout: CompletedWorkoutSession,
    exerciseId: ExerciseId,
  ): readonly ExerciseProgressPoint[] {
    const sets = workout.exercises.filter((exercise) => exercise.exercise.id === exerciseId).flatMap(effectiveSets);
    const units = new Map<WeightUnit, Extract<WorkoutSet, { readonly status: "completed" }>[] >();

    for (const set of sets) {
      units.set(set.weight.unit, [...(units.get(set.weight.unit) ?? []), set]);
    }

    return [...units.values()].map((unitSets) => {
      const bestWeight = unitSets.reduce((best, set) => set.weight.amount > best.amount ? set.weight : best, unitSets[0]!.weight);

      return {
        recordedAt: workout.completedAt,
        bestWeight,
        volume: totalByUnit(unitSets.map(toVolume)),
      };
    });
  }
}
