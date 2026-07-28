import type { MuscleGroup } from "./exercise";
import type { RepetitionTarget, SetType } from "./routine";
import type {
  ExerciseId,
  ISODateTime,
  Repetitions,
  RoutineId,
  RoutineVariantId,
  Seconds,
  WorkoutExerciseId,
  WorkoutSessionId,
  WorkoutSetId,
  ProgramSessionId,
  Weight,
} from "./primitives";

export type Effort =
  | {
      readonly kind: "rpe";
      readonly value: number;
    }
  | {
      readonly kind: "rir";
      readonly value: number;
    };

export interface ExerciseSnapshot {
  readonly id: ExerciseId;
  readonly name: string;
  readonly primaryMuscles: readonly MuscleGroup[];
  readonly secondaryMuscles: readonly MuscleGroup[];
}

export interface WorkoutSetBase {
  readonly id: WorkoutSetId;
  readonly type: SetType;
  readonly target?: RepetitionTarget;
  readonly weight?: Weight;
  readonly repetitions?: Repetitions;
  readonly effort?: Effort;
}

export interface PendingWorkoutSet extends WorkoutSetBase {
  readonly status: "pending";
}

export interface CompletedWorkoutSet extends WorkoutSetBase {
  readonly status: "completed";
  readonly weight: Weight;
  readonly repetitions: Repetitions;
  readonly completedAt: ISODateTime;
}

export type WorkoutSet = PendingWorkoutSet | CompletedWorkoutSet;

export interface WorkoutExercise {
  readonly id: WorkoutExerciseId;
  readonly exercise: ExerciseSnapshot;
  readonly sets: readonly WorkoutSet[];
  readonly restSeconds: Seconds;
  readonly notes?: string;
}

export interface RoutineSnapshot {
  readonly id: RoutineId;
  readonly name: string;
  readonly variantId: RoutineVariantId;
  readonly variantName: string;
}

export interface WorkoutSessionBase {
  readonly id: WorkoutSessionId;
  readonly routine?: RoutineSnapshot;
  readonly exercises: readonly WorkoutExercise[];
  readonly startedAt: ISODateTime;
  readonly programSessionId?: ProgramSessionId;
}

export interface ActiveWorkoutSession extends WorkoutSessionBase {
  readonly status: "active";
  readonly restPeriod?: RestPeriod;
}

export interface CompletedWorkoutSession extends WorkoutSessionBase {
  readonly status: "completed";
  readonly completedAt: ISODateTime;
}

export interface DiscardedWorkoutSession extends WorkoutSessionBase {
  readonly status: "discarded";
  readonly discardedAt: ISODateTime;
}

export type WorkoutSession =
  | ActiveWorkoutSession
  | CompletedWorkoutSession
  | DiscardedWorkoutSession;

export interface RestPeriod {
  readonly sourceSetId: WorkoutSetId;
  readonly startedAt: ISODateTime;
  readonly endsAt: ISODateTime;
}

export interface PreviousSetReference {
  readonly sessionId: WorkoutSessionId;
  readonly setId: WorkoutSetId;
  readonly exerciseId: ExerciseId;
  readonly setPosition: number;
  readonly type: SetType;
  readonly weight: Weight;
  readonly repetitions: Repetitions;
  readonly effort?: Effort;
  readonly completedAt: ISODateTime;
}
