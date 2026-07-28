import type { MuscleGroup } from "./exercise";
import type {
  DateRange,
  ExerciseId,
  ISODateTime,
  RoutineId,
  Weight,
  WeightUnit,
  WorkoutSessionId,
} from "./primitives";

export interface TrainingVolume {
  readonly amount: number;
  readonly unit: WeightUnit;
}

export interface MuscleVolume {
  readonly muscle: MuscleGroup;
  readonly volume: readonly TrainingVolume[];
}

export interface WorkoutSummary {
  readonly id: WorkoutSessionId;
  readonly routineId?: RoutineId;
  readonly routineName?: string;
  readonly startedAt: ISODateTime;
  readonly completedAt: ISODateTime;
  readonly completedSetCount: number;
  readonly volume: readonly TrainingVolume[];
}

export interface DashboardSummary {
  readonly period: DateRange;
  readonly workoutCount: number;
  readonly completedSetCount: number;
  readonly volume: readonly TrainingVolume[];
  readonly muscleDistribution: readonly MuscleVolume[];
  readonly lastWorkout?: WorkoutSummary;
}

export interface ExerciseProgressPoint {
  readonly recordedAt: ISODateTime;
  readonly bestWeight: Weight;
  readonly estimatedOneRepMax: Weight;
  readonly volume: readonly TrainingVolume[];
}

export interface ExerciseProgress {
  readonly exerciseId: ExerciseId;
  readonly period: DateRange;
  readonly points: readonly ExerciseProgressPoint[];
}
