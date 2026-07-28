import type { ActiveWorkoutSession } from "../domain/workout";
import type {
  AddWorkoutExerciseInput,
  AddWorkoutSetInput,
  ApplicationResult,
  CompleteWorkoutSetInput,
  MoveWorkoutExerciseInput,
  StartWorkoutInput,
  UpdateWorkoutSetInput,
} from "./contracts";
import type { WorkoutExerciseId, WorkoutSetId } from "../domain/primitives";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import { ActiveWorkoutService } from "./active-workout";
import { WorkoutExecutionService } from "./workout-execution";

export class TrainingOrchestrator {
  private readonly activeWorkouts: ActiveWorkoutService;
  private readonly execution: WorkoutExecutionService;

  constructor(dependencies: TrainingOrchestratorDependencies) {
    this.activeWorkouts = new ActiveWorkoutService(dependencies);
    this.execution = new WorkoutExecutionService(dependencies);
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
}
