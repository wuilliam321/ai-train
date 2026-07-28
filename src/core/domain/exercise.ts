import type {
  ExerciseId,
  ISODateTime,
  Seconds,
} from "./primitives";

export type MuscleGroup =
  | "abdominals"
  | "abductors"
  | "adductors"
  | "back"
  | "biceps"
  | "calves"
  | "chest"
  | "forearms"
  | "glutes"
  | "hamstrings"
  | "neck"
  | "quadriceps"
  | "shoulders"
  | "traps"
  | "triceps";

export type ExerciseStatus = "active" | "archived";

export interface Exercise {
  readonly id: ExerciseId;
  readonly name: string;
  readonly primaryMuscles: readonly MuscleGroup[];
  readonly secondaryMuscles: readonly MuscleGroup[];
  readonly defaultRestSeconds: Seconds;
  readonly notes?: string;
  readonly status: ExerciseStatus;
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
}

export interface ExerciseDraft {
  readonly name: string;
  readonly primaryMuscles: readonly MuscleGroup[];
  readonly secondaryMuscles?: readonly MuscleGroup[];
  readonly defaultRestSeconds: Seconds;
  readonly notes?: string;
}

export interface ExercisePatch {
  readonly name?: string;
  readonly primaryMuscles?: readonly MuscleGroup[];
  readonly secondaryMuscles?: readonly MuscleGroup[];
  readonly defaultRestSeconds?: Seconds;
  readonly notes?: string | null;
}
