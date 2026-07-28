export type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};

export type Result<Value, Error> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | {
      readonly ok: false;
      readonly error: Error;
    };

export type ExerciseId = Brand<string, "ExerciseId">;
export type RoutineId = Brand<string, "RoutineId">;
export type RoutineVariantId = Brand<string, "RoutineVariantId">;
export type RoutineExerciseId = Brand<string, "RoutineExerciseId">;
export type WorkoutSessionId = Brand<string, "WorkoutSessionId">;
export type WorkoutExerciseId = Brand<string, "WorkoutExerciseId">;
export type WorkoutSetId = Brand<string, "WorkoutSetId">;
export type ProgramId = Brand<string, "ProgramId">;
export type ProgramCycleId = Brand<string, "ProgramCycleId">;
export type ProgramSessionId = Brand<string, "ProgramSessionId">;
export type EntityId =
  | ExerciseId
  | RoutineId
  | RoutineVariantId
  | RoutineExerciseId
  | WorkoutSessionId
  | WorkoutExerciseId
  | WorkoutSetId
  | ProgramId
  | ProgramCycleId
  | ProgramSessionId;

export type ISODateTime = Brand<string, "ISODateTime">;
export type Seconds = Brand<number, "Seconds">;
export type Repetitions = Brand<number, "Repetitions">;
export type WeightAmount = Brand<number, "WeightAmount">;

export type WeightUnit = "kg" | "lb";

export interface Weight {
  readonly amount: WeightAmount;
  readonly unit: WeightUnit;
}

export interface DateRange {
  readonly from: ISODateTime;
  readonly to: ISODateTime;
}

export interface PageRequest {
  readonly cursor?: string;
  readonly limit: number;
}

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly nextCursor?: string;
}

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
