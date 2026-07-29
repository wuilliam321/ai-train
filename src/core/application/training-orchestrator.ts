import type { ActiveWorkoutSession, CompletedWorkoutSession, PreviousSetReference, RestPeriod, WorkoutSession } from "../domain/workout";
import type {
  AddWorkoutExerciseInput,
  AddWorkoutSetInput,
  ApplicationResult,
  CompleteWorkoutSetInput,
  ExerciseCatalog,
  ExerciseProgressQuery,
  ListExercisesQuery,
  ListRoutinesQuery,
  ListWorkoutSessionsQuery,
  MoveWorkoutExerciseInput,
  MoveWorkoutSetInput,
  PreviousSetReferencesQuery,
  RoutineCatalog,
  SetRestDurationInput,
  StartWorkoutInput,
  TrainingOrchestrator as TrainingOrchestratorContract,
  UpdateExerciseInput,
  UpdateWorkoutSetInput,
  UpdateRoutineInput,
} from "./contracts";
import type { Page, ExerciseId, WorkoutExerciseId, WorkoutSessionId, WorkoutSetId } from "../domain/primitives";
import type { WorkoutRepository } from "../ports";
import type { DashboardSummary, ExerciseProgress, WorkoutSummary } from "../domain/insights";
import type { DateRange } from "../domain/primitives";
import type { Exercise, ExerciseDraft } from "../domain/exercise";
import type { Routine, RoutineDraft, RoutineSummary } from "../domain/routine";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import { ActiveWorkoutService } from "./active-workout";
import { WorkoutExecutionService } from "./workout-execution";
import { RestManagementService } from "./rest-management";
import { TrainingHistoryService } from "./training-history";
import { WorkoutLifecycleService } from "./workout-lifecycle";
import { TrainingMetricsService } from "./training-metrics";
import { ExerciseCatalogService } from "./exercise-catalog";
import { RoutineCatalogService } from "./routine-catalog";
import { ProgramService } from "./program-service";
import { ProgressService } from "./progress-service";
import type { Program, ProgramCycle, ProgramDraft, ProgramPatch, ProgramProgress } from "../domain/program";
import type { ProgramId } from "../domain/primitives";

class PublishingWorkoutRepository implements WorkoutRepository {
  private readonly workouts: WorkoutRepository;
  private readonly events: TrainingOrchestratorDependencies["events"];

  constructor(workouts: WorkoutRepository, events: TrainingOrchestratorDependencies["events"]) {
    this.workouts = workouts;
    this.events = events;
  }

  findWorkout(workoutSessionId: Parameters<WorkoutRepository["findWorkout"]>[0]) {
    return this.workouts.findWorkout(workoutSessionId);
  }

  findActiveWorkout() {
    return this.workouts.findActiveWorkout();
  }

  listWorkouts(query: Parameters<WorkoutRepository["listWorkouts"]>[0]) {
    return this.workouts.listWorkouts(query);
  }

  async saveWorkout(workout: Parameters<WorkoutRepository["saveWorkout"]>[0]) {
    const saved = await this.workouts.saveWorkout(workout);

    if (saved.ok) {
      const activeWorkout = workout.status === "active" ? workout : null;
      this.events.publish({
        activeWorkout,
        restPeriod: activeWorkout?.restPeriod ?? null,
      });
    }

    return saved;
  }
}

export class TrainingOrchestrator implements TrainingOrchestratorContract {
  private readonly exercises: ExerciseCatalog;
  private readonly routines: RoutineCatalog;
  private readonly activeWorkouts: ActiveWorkoutService;
  private readonly execution: WorkoutExecutionService;
  private readonly rests: RestManagementService;
  private readonly history: TrainingHistoryService;
  private readonly lifecycle: WorkoutLifecycleService;
  private readonly metrics: TrainingMetricsService;
  private readonly programs: ProgramService;
  private readonly progress: ProgressService;
  private readonly events: TrainingOrchestratorDependencies["events"];

  constructor(dependencies: TrainingOrchestratorDependencies) {
    const scopedDependencies = {
      ...dependencies,
      workouts: new PublishingWorkoutRepository(dependencies.workouts, dependencies.events),
    };

    this.exercises = new ExerciseCatalogService(scopedDependencies);
    this.routines = new RoutineCatalogService(scopedDependencies);
    this.activeWorkouts = new ActiveWorkoutService(scopedDependencies);
    this.execution = new WorkoutExecutionService(scopedDependencies);
    this.rests = new RestManagementService(scopedDependencies);
    this.history = new TrainingHistoryService(scopedDependencies);
    this.lifecycle = new WorkoutLifecycleService(scopedDependencies);
    this.metrics = new TrainingMetricsService(scopedDependencies);
    this.programs = new ProgramService(scopedDependencies);
    this.progress = new ProgressService(scopedDependencies);
    this.events = dependencies.events;
  }

  createExercise(draft: ExerciseDraft): ApplicationResult<Exercise> {
    return this.exercises.createExercise(draft);
  }

  getExercise(exerciseId: ExerciseId): ApplicationResult<Exercise> {
    return this.exercises.getExercise(exerciseId);
  }

  updateExercise(input: UpdateExerciseInput): ApplicationResult<Exercise> {
    return this.exercises.updateExercise(input);
  }

  archiveExercise(exerciseId: ExerciseId): ApplicationResult<Exercise> {
    return this.exercises.archiveExercise(exerciseId);
  }

  restoreExercise(exerciseId: ExerciseId): ApplicationResult<Exercise> {
    return this.exercises.restoreExercise(exerciseId);
  }

  listExercises(query?: ListExercisesQuery): ApplicationResult<readonly Exercise[]> {
    return this.exercises.listExercises(query);
  }

  createRoutine(draft: RoutineDraft): ApplicationResult<Routine> {
    return this.routines.createRoutine(draft);
  }

  getRoutine(routineId: Parameters<RoutineCatalog["getRoutine"]>[0]): ApplicationResult<Routine> {
    return this.routines.getRoutine(routineId);
  }

  updateRoutine(input: UpdateRoutineInput): ApplicationResult<Routine> {
    return this.routines.updateRoutine(input);
  }

  archiveRoutine(routineId: Parameters<RoutineCatalog["archiveRoutine"]>[0]): ApplicationResult<Routine> {
    return this.routines.archiveRoutine(routineId);
  }

  restoreRoutine(routineId: Parameters<RoutineCatalog["restoreRoutine"]>[0]): ApplicationResult<Routine> {
    return this.routines.restoreRoutine(routineId);
  }

  listRoutines(query?: ListRoutinesQuery): ApplicationResult<readonly RoutineSummary[]> {
    return this.routines.listRoutines(query);
  }

  suggestRoutine(): ApplicationResult<RoutineSummary | null> {
    return this.routines.suggestRoutine();
  }

  startWorkout(input: StartWorkoutInput): ApplicationResult<ActiveWorkoutSession> {
    return this.activeWorkouts.startWorkout(input);
  }

  getActiveWorkout(): ApplicationResult<ActiveWorkoutSession | null> {
    return this.activeWorkouts.getActiveWorkout();
  }

  addWorkoutExercise(input: AddWorkoutExerciseInput): ApplicationResult<ActiveWorkoutSession> {
    return this.execution.addWorkoutExercise(input);
  }

  moveWorkoutExercise(input: MoveWorkoutExerciseInput): ApplicationResult<ActiveWorkoutSession> {
    return this.execution.moveWorkoutExercise(input);
  }

  removeWorkoutExercise(workoutExerciseId: WorkoutExerciseId): ApplicationResult<ActiveWorkoutSession> {
    return this.execution.removeWorkoutExercise(workoutExerciseId);
  }

  addWorkoutSet(input: AddWorkoutSetInput): ApplicationResult<ActiveWorkoutSession> {
    return this.execution.addWorkoutSet(input);
  }

  moveWorkoutSet(input: MoveWorkoutSetInput): ApplicationResult<ActiveWorkoutSession> {
    return this.execution.moveWorkoutSet(input);
  }

  updateWorkoutSet(input: UpdateWorkoutSetInput): ApplicationResult<ActiveWorkoutSession> {
    return this.execution.updateWorkoutSet(input);
  }

  removeWorkoutSet(workoutSetId: WorkoutSetId): ApplicationResult<ActiveWorkoutSession> {
    return this.execution.removeWorkoutSet(workoutSetId);
  }

  completeWorkoutSet(input: CompleteWorkoutSetInput): ApplicationResult<ActiveWorkoutSession> {
    return this.execution.completeWorkoutSet(input);
  }

  reopenWorkoutSet(workoutSetId: WorkoutSetId): ApplicationResult<ActiveWorkoutSession> {
    return this.execution.reopenWorkoutSet(workoutSetId);
  }

  finishWorkout(): ApplicationResult<CompletedWorkoutSession> {
    return this.finishAndAdvanceProgram();
  }

  discardWorkout(): ApplicationResult<void> {
    return this.lifecycle.discardWorkout();
  }

  getRestPeriod(): ApplicationResult<RestPeriod | null> {
    return this.rests.getRestPeriod();
  }

  setRestDuration(input: SetRestDurationInput): ApplicationResult<RestPeriod> {
    return this.rests.setRestDuration(input);
  }

  cancelRest(): ApplicationResult<void> {
    return this.rests.cancelRest();
  }

  getPreviousSetReferences(
    query: PreviousSetReferencesQuery,
  ): ApplicationResult<readonly PreviousSetReference[]> {
    return this.history.getPreviousSetReferences(query);
  }

  listWorkoutSessions(query: ListWorkoutSessionsQuery): ApplicationResult<Page<WorkoutSummary>> {
    return this.history.listWorkoutSessions(query);
  }

  getWorkoutSession(workoutSessionId: WorkoutSessionId): ApplicationResult<WorkoutSession> {
    return this.history.getWorkoutSession(workoutSessionId);
  }

  getDashboard(period: DateRange): ApplicationResult<DashboardSummary> {
    return this.metrics.getDashboard(period);
  }

  getExerciseProgress(query: ExerciseProgressQuery): ApplicationResult<ExerciseProgress> {
    return this.metrics.getExerciseProgress(query);
  }

  createProgram(draft: ProgramDraft): ApplicationResult<Program> { return this.programs.createProgram(draft); }
  getProgram(programId: ProgramId): ApplicationResult<Program> { return this.programs.getProgram(programId); }
  updateProgram(input: { readonly programId: ProgramId; readonly patch: ProgramPatch }): ApplicationResult<Program> { return this.programs.updateProgram(input.programId, input.patch); }
  listPrograms(): ApplicationResult<readonly Program[]> { return this.programs.listPrograms(); }
  startProgram(programId: ProgramId): ApplicationResult<ProgramCycle> { return this.programs.startProgram(programId); }
  getProgramProgress(): ApplicationResult<ProgramProgress | null> { return this.programs.progress(); }
  resetProgress(): ApplicationResult<void> { return this.progress.reset(); }
  async abandonProgramCycle(): ApplicationResult<void> {
    const activeWorkout = await this.activeWorkouts.getActiveWorkout();
    if (!activeWorkout.ok) return activeWorkout;
    if (activeWorkout.value?.programSessionId !== undefined) return { ok: false, error: { code: "conflict", details: { field: "activeWorkout" } } };
    return this.programs.abandon();
  }
  skipNextProgramSession(): ApplicationResult<ProgramProgress> { return this.programs.skipNext(); }
  duplicateProgramCycle(): ApplicationResult<ProgramCycle> { return this.programs.duplicate(); }
  async startNextProgramWorkout(sessionId?: import("../domain/primitives").ProgramSessionId): ApplicationResult<ActiveWorkoutSession> {
    const next = await this.programs.startNext(sessionId);
    if (!next.ok) return next;
    const workout = await this.activeWorkouts.startWorkout({ source: "routine", routineId: next.value.routineId as Parameters<RoutineCatalog["getRoutine"]>[0], variantId: next.value.variantId as import("../domain/primitives").RoutineVariantId, programSessionId: next.value.programSessionId });
    if (workout.ok) return workout;
    const released = await this.programs.release(next.value.programSessionId);
    return released.ok ? workout : released;
  }
  private async finishAndAdvanceProgram(): ApplicationResult<CompletedWorkoutSession> {
    const completed = await this.lifecycle.prepareFinishedWorkout();

    if (!completed.ok) {
      return completed;
    }

    if (completed.value.programSessionId === undefined) return this.lifecycle.finishWorkout();
    const cycle = await this.programs.completionCycle(completed.value);
    if (!cycle.ok) return cycle;
    const saved = await this.programs.saveCompletion(completed.value, cycle.value as ProgramCycle);
    if (!saved.ok) return saved;
    this.events.publish({ activeWorkout: null, restPeriod: null });
    return completed;
  }

  subscribe(listener: (snapshot: { readonly activeWorkout: ActiveWorkoutSession | null; readonly restPeriod: RestPeriod | null }) => void): () => void {
    return this.events.subscribe(listener);
  }
}
