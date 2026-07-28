import type {
  Clock,
  ExerciseRepository,
  IdGenerator,
  RoutineRepository,
  TrainingChangePublisher,
  WorkoutHistoryReader,
  WorkoutRepository,
} from "../ports";

export interface TrainingOrchestratorDependencies {
  readonly exercises: ExerciseRepository;
  readonly routines: RoutineRepository;
  readonly workouts: WorkoutRepository;
  readonly history: WorkoutHistoryReader;
  readonly events: TrainingChangePublisher;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
