import type {
  Clock,
  ExerciseRepository,
  IdGenerator,
  RoutineRepository,
  WorkoutHistoryReader,
  WorkoutRepository,
} from "../ports";

export interface TrainingOrchestratorDependencies {
  readonly exercises: ExerciseRepository;
  readonly routines: RoutineRepository;
  readonly workouts: WorkoutRepository;
  readonly history: WorkoutHistoryReader;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
