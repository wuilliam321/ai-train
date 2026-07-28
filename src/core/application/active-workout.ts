import type { Exercise } from "../domain/exercise";
import type {
  Routine,
  RoutineExercisePrescription,
  RoutineVariant,
} from "../domain/routine";
import type {
  ActiveWorkoutSession,
  ExerciseSnapshot,
  RoutineSnapshot,
  WorkoutExercise,
  WorkoutSet,
} from "../domain/workout";
import type {
  RoutineId,
  RoutineVariantId,
  WorkoutExerciseId,
  WorkoutSessionId,
  WorkoutSetId,
} from "../domain/primitives";
import type { ExerciseRepository, RoutineRepository, WorkoutRepository } from "../ports";
import type { ApplicationResult, StartWorkoutInput } from "./contracts";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import { failure, success } from "./result";
import type { ApplicationError } from "./result";

const persistenceError = (code: string): ApplicationError => ({
  code: "persistence",
  details: { code },
});

const conflictError = (workoutSessionId: WorkoutSessionId): ApplicationError => ({
  code: "conflict",
  details: { workoutSessionId },
});

const routineNotFoundError = (routineId: RoutineId): ApplicationError => ({
  code: "not_found",
  details: { routineId },
});

const variantNotFoundError = (variantId: RoutineVariantId): ApplicationError => ({
  code: "not_found",
  details: { variantId },
});

const exerciseNotFoundError = (exerciseId: string): ApplicationError => ({
  code: "not_found",
  details: { exerciseId },
});

const validationError = (field: string): ApplicationError => ({
  code: "validation",
  details: { field },
});

const isPersisted = <Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: { readonly code: string } },
): result is { readonly ok: true; readonly value: Value } => result.ok;

export class ActiveWorkoutService {
  private readonly exercises: ExerciseRepository;
  private readonly routines: RoutineRepository;
  private readonly workouts: WorkoutRepository;
  private readonly clock: TrainingOrchestratorDependencies["clock"];
  private readonly ids: TrainingOrchestratorDependencies["ids"];

  constructor(
    dependencies: Pick<TrainingOrchestratorDependencies, "exercises" | "routines" | "workouts" | "clock" | "ids">,
  ) {
    this.exercises = dependencies.exercises;
    this.routines = dependencies.routines;
    this.workouts = dependencies.workouts;
    this.clock = dependencies.clock;
    this.ids = dependencies.ids;
  }

  async startWorkout(input: StartWorkoutInput): ApplicationResult<ActiveWorkoutSession> {
    const active = await this.getActiveWorkout();

    if (!active.ok) {
      return active;
    }

    if (active.value !== null) {
      return failure(conflictError(active.value.id));
    }

    const content = input.source === "empty" ? success({ exercises: [] }) : await this.createRoutineContent(input);

    if (!content.ok) {
      return content;
    }

    const workout: ActiveWorkoutSession = {
      id: this.ids.generate<WorkoutSessionId>(),
      ...content.value,
      status: "active",
      startedAt: this.clock.now(),
      ...(input.source === "routine" && input.programSessionId !== undefined
        ? { programSessionId: input.programSessionId }
        : {}),
    };

    const saved = await this.workouts.saveWorkout(workout);
    return isPersisted(saved) ? success(workout) : failure(persistenceError(saved.error.code));
  }

  async getActiveWorkout(): ApplicationResult<ActiveWorkoutSession | null> {
    const active = await this.workouts.findActiveWorkout();
    return isPersisted(active) ? success(active.value) : failure(persistenceError(active.error.code));
  }

  private async createRoutineContent(
    input: Extract<StartWorkoutInput, { readonly source: "routine" }>,
  ): Promise<{ readonly ok: true; readonly value: { readonly routine: RoutineSnapshot; readonly exercises: readonly WorkoutExercise[] } } | { readonly ok: false; readonly error: ApplicationError }> {
    const routine = await this.findRoutine(input.routineId);

    if (!routine.ok) {
      return routine;
    }

    if (routine.value.status !== "active") {
      return failure(validationError("routineId"));
    }

    const variant = routine.value.variants.find((candidate) => candidate.id === input.variantId);

    if (variant === undefined) {
      return failure(variantNotFoundError(input.variantId));
    }

    const exercises: WorkoutExercise[] = [];

    for (const prescription of variant.exercises) {
      const exercise = await this.findExercise(prescription.exerciseId);

      if (!exercise.ok) {
        return exercise;
      }

      exercises.push(this.createWorkoutExercise(exercise.value, prescription));
    }

    return success({
      routine: this.createRoutineSnapshot(routine.value, variant),
      exercises,
    });
  }

  private async findRoutine(
    routineId: RoutineId,
  ): Promise<{ readonly ok: true; readonly value: Routine } | { readonly ok: false; readonly error: ApplicationError }> {
    const routine = await this.routines.findRoutine(routineId);

    if (!isPersisted(routine)) {
      return failure(persistenceError(routine.error.code));
    }

    return routine.value === null ? failure(routineNotFoundError(routineId)) : success(routine.value);
  }

  private async findExercise(
    exerciseId: Exercise["id"],
  ): Promise<{ readonly ok: true; readonly value: Exercise } | { readonly ok: false; readonly error: ApplicationError }> {
    const exercise = await this.exercises.findExercise(exerciseId);

    if (!isPersisted(exercise)) {
      return failure(persistenceError(exercise.error.code));
    }

    return exercise.value === null ? failure(exerciseNotFoundError(exerciseId)) : success(exercise.value);
  }

  private createWorkoutExercise(
    exercise: Exercise,
    prescription: RoutineExercisePrescription,
  ): WorkoutExercise {
    return {
      id: this.ids.generate<WorkoutExerciseId>(),
      exercise: this.createExerciseSnapshot(exercise),
      sets: prescription.sets.map((set) => this.createWorkoutSet(set)),
      restSeconds: prescription.restSeconds ?? exercise.defaultRestSeconds,
      ...(prescription.notes === undefined ? {} : { notes: prescription.notes }),
    };
  }

  private createExerciseSnapshot(exercise: Exercise): ExerciseSnapshot {
    return {
      id: exercise.id,
      name: exercise.name,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
    };
  }

  private createRoutineSnapshot(routine: Routine, variant: RoutineVariant): RoutineSnapshot {
    return {
      id: routine.id,
      name: routine.name,
      variantId: variant.id,
      variantName: variant.name,
    };
  }

  private createWorkoutSet(set: RoutineExercisePrescription["sets"][number]): WorkoutSet {
    return {
      id: this.ids.generate<WorkoutSetId>(),
      type: set.type,
      target: set.repetitions,
      status: "pending",
    };
  }
}
