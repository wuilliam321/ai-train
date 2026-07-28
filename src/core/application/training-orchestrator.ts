import type { ActiveWorkoutSession } from "../domain/workout";
import type { ApplicationResult, StartWorkoutInput } from "./contracts";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import { ActiveWorkoutService } from "./active-workout";

export class TrainingOrchestrator {
  private readonly activeWorkouts: ActiveWorkoutService;

  constructor(dependencies: TrainingOrchestratorDependencies) {
    this.activeWorkouts = new ActiveWorkoutService(dependencies);
  }

  startWorkout(input: StartWorkoutInput): ApplicationResult<ActiveWorkoutSession> {
    return this.activeWorkouts.startWorkout(input);
  }

  getActiveWorkout(): ApplicationResult<ActiveWorkoutSession | null> {
    return this.activeWorkouts.getActiveWorkout();
  }
}
