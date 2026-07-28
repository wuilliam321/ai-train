import type {
  Clock,
  ExerciseRepository,
  IdGenerator,
  RoutineRepository,
  ProgramRepository,
  ProgressRepository,
  TrainingChangePublisher,
  WorkoutHistoryReader,
  WorkoutRepository,
} from "../ports";

export interface TrainingOrchestratorDependencies {
  readonly exercises: ExerciseRepository;
  readonly routines: RoutineRepository;
  readonly programs: ProgramRepository;
  readonly progress: ProgressRepository;
  readonly workouts: WorkoutRepository;
  readonly history: WorkoutHistoryReader;
  readonly events: TrainingChangePublisher;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
