import type {
  Exercise,
  ExerciseDraft,
  ExercisePatch,
  ExerciseStatus,
} from "../domain/exercise";
import type {
  DashboardSummary,
  ExerciseProgress,
  WorkoutSummary,
} from "../domain/insights";
import type {
  DateRange,
  ExerciseId,
  Page,
  PageRequest,
  Repetitions,
  RoutineId,
  RoutineVariantId,
  Seconds,
  WorkoutExerciseId,
  WorkoutSessionId,
  WorkoutSetId,
  Weight,
} from "../domain/primitives";
import type {
  Routine,
  RoutineDraft,
  RoutinePatch,
  RoutineStatus,
  RoutineSummary,
  SetType,
} from "../domain/routine";
import type {
  ActiveWorkoutSession,
  CompletedWorkoutSession,
  Effort,
  PreviousSetReference,
  RestPeriod,
  WorkoutSession,
} from "../domain/workout";
import type { ApplicationError, Result } from "./result";
import type { Program, ProgramCycle, ProgramDraft, ProgramPatch, ProgramProgress } from "../domain/program";
import type { ProgramId } from "../domain/primitives";

export type ApplicationResult<Value> = Promise<
  Result<Value, ApplicationError>
>;

export interface ListExercisesQuery {
  readonly search?: string;
  readonly status?: ExerciseStatus;
}

export interface UpdateExerciseInput {
  readonly exerciseId: ExerciseId;
  readonly patch: ExercisePatch;
}

export interface ExerciseCatalog {
  createExercise(draft: ExerciseDraft): ApplicationResult<Exercise>;
  getExercise(exerciseId: ExerciseId): ApplicationResult<Exercise>;
  updateExercise(input: UpdateExerciseInput): ApplicationResult<Exercise>;
  archiveExercise(exerciseId: ExerciseId): ApplicationResult<Exercise>;
  restoreExercise(exerciseId: ExerciseId): ApplicationResult<Exercise>;
  listExercises(query?: ListExercisesQuery): ApplicationResult<readonly Exercise[]>;
}

export interface ListRoutinesQuery {
  readonly search?: string;
  readonly status?: RoutineStatus;
}

export interface UpdateRoutineInput {
  readonly routineId: RoutineId;
  readonly patch: RoutinePatch;
}

export interface RoutineCatalog {
  createRoutine(draft: RoutineDraft): ApplicationResult<Routine>;
  getRoutine(routineId: RoutineId): ApplicationResult<Routine>;
  updateRoutine(input: UpdateRoutineInput): ApplicationResult<Routine>;
  archiveRoutine(routineId: RoutineId): ApplicationResult<Routine>;
  restoreRoutine(routineId: RoutineId): ApplicationResult<Routine>;
  listRoutines(query?: ListRoutinesQuery): ApplicationResult<readonly RoutineSummary[]>;
  suggestRoutine(): ApplicationResult<RoutineSummary | null>;
}

export type StartWorkoutInput =
  | {
      readonly source: "empty";
    }
  | {
      readonly source: "routine";
      readonly routineId: RoutineId;
      readonly variantId: RoutineVariantId;
      readonly programSessionId?: import("../domain/primitives").ProgramSessionId;
    };

export interface ProgramManagement {
  createProgram(draft: ProgramDraft): ApplicationResult<Program>;
  getProgram(programId: ProgramId): ApplicationResult<Program>;
  updateProgram(input: { readonly programId: ProgramId; readonly patch: ProgramPatch }): ApplicationResult<Program>;
  listPrograms(): ApplicationResult<readonly Program[]>;
  startProgram(programId: ProgramId): ApplicationResult<ProgramCycle>;
  getProgramProgress(): ApplicationResult<ProgramProgress | null>;
  skipNextProgramSession(): ApplicationResult<ProgramProgress>;
  startNextProgramWorkout(): ApplicationResult<ActiveWorkoutSession>;
  duplicateProgramCycle(): ApplicationResult<ProgramCycle>;
}

export interface AddWorkoutExerciseInput {
  readonly exerciseId: ExerciseId;
  readonly position?: number;
}

export interface MoveWorkoutExerciseInput {
  readonly workoutExerciseId: WorkoutExerciseId;
  readonly position: number;
}

export interface AddWorkoutSetInput {
  readonly workoutExerciseId: WorkoutExerciseId;
  readonly type: SetType;
  readonly position?: number;
}

export interface MoveWorkoutSetInput {
  readonly workoutSetId: WorkoutSetId;
  readonly position: number;
}

export interface UpdateWorkoutSetInput {
  readonly workoutSetId: WorkoutSetId;
  readonly type?: SetType;
  readonly weight?: Weight | null;
  readonly repetitions?: Repetitions | null;
  readonly effort?: Effort | null;
}

export interface CompleteWorkoutSetInput {
  readonly workoutSetId: WorkoutSetId;
  readonly weight: Weight;
  readonly repetitions: Repetitions;
  readonly effort?: Effort;
}

export interface WorkoutExecution {
  startWorkout(input: StartWorkoutInput): ApplicationResult<ActiveWorkoutSession>;
  getActiveWorkout(): ApplicationResult<ActiveWorkoutSession | null>;
  addWorkoutExercise(input: AddWorkoutExerciseInput): ApplicationResult<ActiveWorkoutSession>;
  moveWorkoutExercise(input: MoveWorkoutExerciseInput): ApplicationResult<ActiveWorkoutSession>;
  removeWorkoutExercise(workoutExerciseId: WorkoutExerciseId): ApplicationResult<ActiveWorkoutSession>;
  addWorkoutSet(input: AddWorkoutSetInput): ApplicationResult<ActiveWorkoutSession>;
  moveWorkoutSet(input: MoveWorkoutSetInput): ApplicationResult<ActiveWorkoutSession>;
  updateWorkoutSet(input: UpdateWorkoutSetInput): ApplicationResult<ActiveWorkoutSession>;
  removeWorkoutSet(workoutSetId: WorkoutSetId): ApplicationResult<ActiveWorkoutSession>;
  completeWorkoutSet(input: CompleteWorkoutSetInput): ApplicationResult<ActiveWorkoutSession>;
  reopenWorkoutSet(workoutSetId: WorkoutSetId): ApplicationResult<ActiveWorkoutSession>;
  finishWorkout(): ApplicationResult<CompletedWorkoutSession>;
  discardWorkout(): ApplicationResult<void>;
}

export interface SetRestDurationInput {
  readonly duration: Seconds;
}

export interface RestManagement {
  getRestPeriod(): ApplicationResult<RestPeriod | null>;
  setRestDuration(input: SetRestDurationInput): ApplicationResult<RestPeriod>;
  cancelRest(): ApplicationResult<void>;
}

export interface ListWorkoutSessionsQuery extends PageRequest {
  readonly period?: DateRange;
}

export interface PreviousSetReferencesQuery {
  readonly exerciseId: ExerciseId;
  readonly limit: number;
}

export interface ExerciseProgressQuery {
  readonly exerciseId: ExerciseId;
  readonly period: DateRange;
}

export interface TrainingHistory {
  listWorkoutSessions(query: ListWorkoutSessionsQuery): ApplicationResult<Page<WorkoutSummary>>;
  getWorkoutSession(workoutSessionId: WorkoutSessionId): ApplicationResult<WorkoutSession>;
  getPreviousSetReferences(query: PreviousSetReferencesQuery): ApplicationResult<readonly PreviousSetReference[]>;
  getDashboard(period: DateRange): ApplicationResult<DashboardSummary>;
  getExerciseProgress(query: ExerciseProgressQuery): ApplicationResult<ExerciseProgress>;
}

export interface TrainingSnapshot {
  readonly activeWorkout: ActiveWorkoutSession | null;
  readonly restPeriod: RestPeriod | null;
}

export type TrainingSnapshotListener = (snapshot: TrainingSnapshot) => void;
export type Unsubscribe = () => void;

export interface TrainingEvents {
  subscribe(listener: TrainingSnapshotListener): Unsubscribe;
}

export interface TrainingOrchestrator
  extends ExerciseCatalog,
    RoutineCatalog,
    WorkoutExecution,
    RestManagement,
    TrainingHistory,
    ProgramManagement,
    TrainingEvents {}
