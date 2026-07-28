import type { ExerciseId } from "./primitives";
import type {
  ISODateTime,
  Repetitions,
  RoutineExerciseId,
  RoutineId,
  RoutineVariantId,
  Seconds,
} from "./primitives";

export type SetType = "warmup" | "normal" | "drop" | "failure";
export type Laterality = "bilateral" | "unilateral" | "alternating";

export type RepetitionTarget =
  | {
      readonly kind: "exact";
      readonly repetitions: Repetitions;
    }
  | {
      readonly kind: "range";
      readonly minimum: Repetitions;
      readonly maximum: Repetitions;
    };

export interface RoutineSetPrescription {
  readonly type: SetType;
  readonly repetitions: RepetitionTarget;
}

export interface RoutineExercisePrescription {
  readonly id: RoutineExerciseId;
  readonly exerciseId: ExerciseId;
  readonly sets: readonly RoutineSetPrescription[];
  readonly laterality: Laterality;
  readonly restSeconds?: Seconds;
  readonly notes?: string;
}

export interface RoutineVariant {
  readonly id: RoutineVariantId;
  readonly name: string;
  readonly exercises: readonly RoutineExercisePrescription[];
}

export type RoutineStatus = "active" | "archived";

export interface Routine {
  readonly id: RoutineId;
  readonly name: string;
  readonly variants: readonly RoutineVariant[];
  readonly status: RoutineStatus;
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
}

export interface RoutineSetDraft {
  readonly type: SetType;
  readonly repetitions: RepetitionTarget;
}

export interface RoutineExerciseDraft {
  readonly exerciseId: ExerciseId;
  readonly sets: readonly RoutineSetDraft[];
  readonly laterality: Laterality;
  readonly restSeconds?: Seconds;
  readonly notes?: string;
}

export interface RoutineVariantDraft {
  readonly name: string;
  readonly exercises: readonly RoutineExerciseDraft[];
}

export interface RoutineDraft {
  readonly name: string;
  readonly variants: readonly RoutineVariantDraft[];
}

export interface RoutinePatch {
  readonly name?: string;
  readonly variants?: readonly RoutineVariantDraft[];
}

export interface RoutineSummary {
  readonly id: RoutineId;
  readonly name: string;
  readonly variantCount: number;
  readonly status: RoutineStatus;
}
