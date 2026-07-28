import type { ActiveWorkoutSession, PreviousSetReference, RestPeriod } from "../domain/workout";
import type {
  AddWorkoutExerciseInput,
  AddWorkoutSetInput,
  ApplicationResult,
  CompleteWorkoutSetInput,
  MoveWorkoutExerciseInput,
  PreviousSetReferencesQuery,
  SetRestDurationInput,
  StartWorkoutInput,
  UpdateWorkoutSetInput,
} from "./contracts";
import type { WorkoutExerciseId, WorkoutSetId } from "../domain/primitives";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import { ActiveWorkoutService } from "./active-workout";
import { WorkoutExecutionService } from "./workout-execution";
import { RestManagementService } from "./rest-management";
import { TrainingHistoryService } from "./training-history";

export class TrainingOrchestrator {
  private readonly activeWorkouts: ActiveWorkoutService;
  private readonly execution: WorkoutExecutionService;
  private readonly rests: RestManagementService;
  private readonly history: TrainingHistoryService;

  constructor(dependencies: TrainingOrchestratorDependencies) {
    this.activeWorkouts = new ActiveWorkoutService(dependencies);
    this.execution = new WorkoutExecutionService(dependencies);
    this.rests = new RestManagementService(dependencies);
    this.history = new TrainingHistoryService(dependencies);
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
}
