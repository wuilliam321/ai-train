import type { ActiveWorkoutSession, CompletedWorkoutSession, PreviousSetReference, RestPeriod, WorkoutSession } from "../domain/workout";
import type {
  AddWorkoutExerciseInput,
  AddWorkoutSetInput,
  ApplicationResult,
  CompleteWorkoutSetInput,
  ListWorkoutSessionsQuery,
  MoveWorkoutExerciseInput,
  PreviousSetReferencesQuery,
  SetRestDurationInput,
  StartWorkoutInput,
  UpdateWorkoutSetInput,
} from "./contracts";
import type { Page, WorkoutExerciseId, WorkoutSessionId, WorkoutSetId } from "../domain/primitives";
import type { WorkoutRepository } from "../ports";
import type { WorkoutSummary } from "../domain/insights";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import { ActiveWorkoutService } from "./active-workout";
import { WorkoutExecutionService } from "./workout-execution";
import { RestManagementService } from "./rest-management";
import { TrainingHistoryService } from "./training-history";
import { WorkoutLifecycleService } from "./workout-lifecycle";

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

export class TrainingOrchestrator {
  private readonly activeWorkouts: ActiveWorkoutService;
  private readonly execution: WorkoutExecutionService;
  private readonly rests: RestManagementService;
  private readonly history: TrainingHistoryService;
  private readonly lifecycle: WorkoutLifecycleService;
  private readonly events: TrainingOrchestratorDependencies["events"];

  constructor(dependencies: TrainingOrchestratorDependencies) {
    const scopedDependencies = {
      ...dependencies,
      workouts: new PublishingWorkoutRepository(dependencies.workouts, dependencies.events),
    };

    this.activeWorkouts = new ActiveWorkoutService(scopedDependencies);
    this.execution = new WorkoutExecutionService(scopedDependencies);
    this.rests = new RestManagementService(scopedDependencies);
    this.history = new TrainingHistoryService(scopedDependencies);
    this.lifecycle = new WorkoutLifecycleService(scopedDependencies);
    this.events = dependencies.events;
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
    return this.lifecycle.finishWorkout();
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

  subscribe(listener: (snapshot: { readonly activeWorkout: ActiveWorkoutSession | null; readonly restPeriod: RestPeriod | null }) => void): () => void {
    return this.events.subscribe(listener);
  }
}
