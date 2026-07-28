import { success } from "../../src/core/application/result";
import type {
  Clock,
  Exercise,
  ExerciseId,
  ExerciseRepository,
  ExerciseRepositoryQuery,
  IdGenerator,
  ISODateTime,
  Page,
  PersistenceResult,
  Routine,
  RoutineId,
  RoutineRepository,
  RoutineRepositoryQuery,
  TrainingOrchestratorDependencies,
  WorkoutHistoryReader,
  WorkoutRepository,
  WorkoutRepositoryQuery,
  WorkoutSession,
  WorkoutSessionId,
  TrainingChangePublisher,
  TrainingChangeSnapshot,
  Program,
  ProgramCycle,
  ProgramRepository,
  ProgramId,
  ProgramCycleId,
  ActiveWorkoutSession,
  PreviousSetReference,
  PreviousSetQuery,
} from "../../src/core";

export class TestClock implements Clock {
  private current: ISODateTime;

  constructor(current: ISODateTime) {
    this.current = current;
  }

  now(): ISODateTime {
    return this.current;
  }

  set(current: ISODateTime): void {
    this.current = current;
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private sequence = 0;

  generate<Identifier>(): Identifier {
    this.sequence += 1;
    return `id-${this.sequence}` as Identifier;
  }
}

class InMemoryExerciseRepository implements ExerciseRepository {
  private readonly exercises = new Map<ExerciseId, Exercise>();

  async findExercise(exerciseId: ExerciseId): PersistenceResult<Exercise | null> {
    return success(this.exercises.get(exerciseId) ?? null);
  }

  async listExercises(
    query?: ExerciseRepositoryQuery,
  ): PersistenceResult<readonly Exercise[]> {
    const matches = [...this.exercises.values()].filter((exercise) =>
      (query?.status === undefined || exercise.status === query.status) &&
      (query?.search === undefined || exercise.name.includes(query.search)),
    );

    return success(matches);
  }

  async saveExercise(exercise: Exercise): PersistenceResult<void> {
    this.exercises.set(exercise.id, exercise);
    return success(undefined);
  }
}

class InMemoryRoutineRepository implements RoutineRepository {
  private readonly routines = new Map<RoutineId, Routine>();

  async findRoutine(routineId: RoutineId): PersistenceResult<Routine | null> {
    return success(this.routines.get(routineId) ?? null);
  }

  async listRoutines(
    query?: RoutineRepositoryQuery,
  ): PersistenceResult<readonly Routine[]> {
    const matches = [...this.routines.values()].filter((routine) =>
      (query?.status === undefined || routine.status === query.status) &&
      (query?.search === undefined || routine.name.includes(query.search)),
    );

    return success(matches);
  }

  async saveRoutine(routine: Routine): PersistenceResult<void> {
    this.routines.set(routine.id, routine);
    return success(undefined);
  }
}

class InMemoryProgramRepository implements ProgramRepository {
  private readonly programs = new Map<ProgramId, Program>();
  private readonly cycles = new Map<ProgramCycleId, ProgramCycle>();
  async findProgram(id: ProgramId): PersistenceResult<Program | null> { return success(this.programs.get(id) ?? null); }
  async listPrograms(): PersistenceResult<readonly Program[]> { return success([...this.programs.values()]); }
  async saveProgram(program: Program): PersistenceResult<void> { this.programs.set(program.id, program); return success(undefined); }
  async findActiveProgramCycle(): PersistenceResult<ProgramCycle | null> { return success([...this.cycles.values()].find((cycle) => cycle.status === "active") ?? null); }
  async findLatestProgramCycle(): PersistenceResult<ProgramCycle | null> { return success([...this.cycles.values()].at(-1) ?? null); }
  async findProgramCycle(id: ProgramCycleId): PersistenceResult<ProgramCycle | null> { return success(this.cycles.get(id) ?? null); }
  async saveProgramCycle(cycle: ProgramCycle): PersistenceResult<void> { this.cycles.set(cycle.id, cycle); return success(undefined); }
  async saveCompletedWorkoutAndProgramCycle(_workout: import("../../src/core").CompletedWorkoutSession, cycle: ProgramCycle): PersistenceResult<void> { this.cycles.set(cycle.id, cycle); return success(undefined); }
}

class InMemoryWorkoutRepository implements WorkoutRepository {
  private readonly workouts = new Map<WorkoutSessionId, WorkoutSession>();

  async findWorkout(
    workoutSessionId: WorkoutSessionId,
  ): PersistenceResult<WorkoutSession | null> {
    return success(this.workouts.get(workoutSessionId) ?? null);
  }

  async findActiveWorkout(): PersistenceResult<ActiveWorkoutSession | null> {
    const workout = [...this.workouts.values()].find(
      (candidate): candidate is ActiveWorkoutSession => candidate.status === "active",
    );

    return success(workout ?? null);
  }

  async listWorkouts(
    query: WorkoutRepositoryQuery,
  ): PersistenceResult<Page<WorkoutSession>> {
    return success({ items: [...this.workouts.values()].slice(0, query.limit) });
  }

  async saveWorkout(workout: WorkoutSession): PersistenceResult<void> {
    this.workouts.set(workout.id, workout);
    return success(undefined);
  }
}

class EmptyWorkoutHistoryReader implements WorkoutHistoryReader {
  async findPreviousSets(
    _query: PreviousSetQuery,
  ): PersistenceResult<readonly PreviousSetReference[]> {
    return success([]);
  }
}

class InMemoryTrainingChangePublisher implements TrainingChangePublisher {
  private readonly listeners = new Set<(snapshot: TrainingChangeSnapshot) => void>();

  publish(snapshot: TrainingChangeSnapshot): void {
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  subscribe(listener: (snapshot: TrainingChangeSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const createTrainingEnvironment = (
  clock: Clock,
): TrainingOrchestratorDependencies => ({
  exercises: new InMemoryExerciseRepository(),
  routines: new InMemoryRoutineRepository(),
  programs: new InMemoryProgramRepository(),
  workouts: new InMemoryWorkoutRepository(),
  history: new EmptyWorkoutHistoryReader(),
  events: new InMemoryTrainingChangePublisher(),
  clock,
  ids: new SequentialIdGenerator(),
});
