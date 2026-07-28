import type { Exercise, ExerciseStatus } from "./domain/exercise";
import type {
  ActiveWorkoutSession,
  CompletedWorkoutSession,
  PreviousSetReference,
  RestPeriod,
  WorkoutSession,
} from "./domain/workout";
import type {
  EntityId,
  ExerciseId,
  ISODateTime,
  JsonValue,
  Page,
  PageRequest,
  RoutineId,
  WorkoutSessionId,
} from "./domain/primitives";
import type { Routine, RoutineStatus } from "./domain/routine";
import type { Program, ProgramCycle } from "./domain/program";
import type { ProgramCycleId, ProgramId } from "./domain/primitives";
import type { Result } from "./application/result";

export type PersistenceErrorCode =
  | "unavailable"
  | "corrupt_data"
  | "write_conflict";

export interface PersistenceError {
  readonly code: PersistenceErrorCode;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

export type PersistenceResult<Value> = Promise<
  Result<Value, PersistenceError>
>;

export interface ExerciseRepositoryQuery {
  readonly search?: string;
  readonly status?: ExerciseStatus;
}

export interface ExerciseRepository {
  findExercise(exerciseId: ExerciseId): PersistenceResult<Exercise | null>;
  listExercises(query?: ExerciseRepositoryQuery): PersistenceResult<readonly Exercise[]>;
  saveExercise(exercise: Exercise): PersistenceResult<void>;
}

export interface RoutineRepositoryQuery {
  readonly search?: string;
  readonly status?: RoutineStatus;
}

export interface RoutineRepository {
  findRoutine(routineId: RoutineId): PersistenceResult<Routine | null>;
  listRoutines(query?: RoutineRepositoryQuery): PersistenceResult<readonly Routine[]>;
  saveRoutine(routine: Routine): PersistenceResult<void>;
}

export interface ProgramRepository {
  findProgram(programId: ProgramId): PersistenceResult<Program | null>;
  listPrograms(): PersistenceResult<readonly Program[]>;
  saveProgram(program: Program): PersistenceResult<void>;
  findActiveProgramCycle(): PersistenceResult<ProgramCycle | null>;
  findLatestProgramCycle(): PersistenceResult<ProgramCycle | null>;
  findProgramCycle(programCycleId: ProgramCycleId): PersistenceResult<ProgramCycle | null>;
  saveProgramCycle(cycle: ProgramCycle): PersistenceResult<void>;
  saveCompletedWorkoutAndProgramCycle(
    workout: CompletedWorkoutSession,
    cycle: ProgramCycle,
  ): PersistenceResult<void>;
}

export interface WorkoutRepositoryQuery extends PageRequest {
  readonly completedFrom?: ISODateTime;
  readonly completedTo?: ISODateTime;
}

export interface WorkoutRepository {
  findWorkout(workoutSessionId: WorkoutSessionId): PersistenceResult<WorkoutSession | null>;
  findActiveWorkout(): PersistenceResult<ActiveWorkoutSession | null>;
  listWorkouts(query: WorkoutRepositoryQuery): PersistenceResult<Page<WorkoutSession>>;
  saveWorkout(workout: WorkoutSession): PersistenceResult<void>;
}

export interface PreviousSetQuery {
  readonly exerciseId: ExerciseId;
  readonly before: ISODateTime;
  readonly limit: number;
}

export interface WorkoutHistoryReader {
  findPreviousSets(query: PreviousSetQuery): PersistenceResult<readonly PreviousSetReference[]>;
}

export interface TrainingChangeSnapshot {
  readonly activeWorkout: ActiveWorkoutSession | null;
  readonly restPeriod: RestPeriod | null;
}

export type TrainingChangeListener = (snapshot: TrainingChangeSnapshot) => void;
export type TrainingChangeUnsubscribe = () => void;

export interface TrainingChangePublisher {
  publish(snapshot: TrainingChangeSnapshot): void;
  subscribe(listener: TrainingChangeListener): TrainingChangeUnsubscribe;
}

export interface Clock {
  now(): ISODateTime;
}

export interface IdGenerator {
  generate<Identifier extends EntityId>(): Identifier;
}
