import type { Exercise } from "../domain/exercise";
import type { SetType } from "../domain/routine";
import type {
  ActiveWorkoutSession,
  Effort,
  ExerciseSnapshot,
  WorkoutExercise,
  WorkoutSet,
} from "../domain/workout";
import type {
  WorkoutExerciseId,
  WorkoutSetId,
} from "../domain/primitives";
import type { ExerciseRepository, WorkoutRepository } from "../ports";
import type {
  AddWorkoutExerciseInput,
  AddWorkoutSetInput,
  ApplicationResult,
  CompleteWorkoutSetInput,
  MoveWorkoutExerciseInput,
  UpdateWorkoutSetInput,
} from "./contracts";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import { failure, success } from "./result";
import type { ApplicationError } from "./result";

const setTypes: readonly SetType[] = ["warmup", "normal", "drop", "failure"];

const persistenceError = (code: string): ApplicationError => ({
  code: "persistence",
  details: { code },
});

const validationError = (field: string): ApplicationError => ({
  code: "validation",
  details: { field },
});

const notFoundError = (identifier: "exerciseId" | "workoutExerciseId" | "workoutSetId", value: string): ApplicationError => ({
  code: "not_found",
  details: { [identifier]: value },
});

const conflictError = (workoutSetId: WorkoutSetId): ApplicationError => ({
  code: "conflict",
  details: { workoutSetId },
});

const noActiveWorkoutError = (): ApplicationError => ({
  code: "no_active_workout",
});

const isPersisted = <Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: { readonly code: string } },
): result is { readonly ok: true; readonly value: Value } => result.ok;

const isPosition = (position: number, length: number, allowEnd: boolean): boolean =>
  Number.isInteger(position) && position >= 0 && position < length + (allowEnd ? 1 : 0);

const isValidWeight = (weight: NonNullable<WorkoutSet["weight"]>): boolean =>
  Number.isFinite(weight.amount) && weight.amount >= 0 && (weight.unit === "kg" || weight.unit === "lb");

const isValidEffort = (effort: Effort): boolean =>
  (effort.kind === "rpe" && Number.isFinite(effort.value) && effort.value >= 1 && effort.value <= 10) ||
  (effort.kind === "rir" && Number.isInteger(effort.value) && effort.value >= 0 && effort.value <= 10);

const isValidRepetitions = (repetitions: number): boolean =>
  Number.isInteger(repetitions) && repetitions > 0;

const insertAt = <Value>(items: readonly Value[], item: Value, position: number): readonly Value[] => [
  ...items.slice(0, position),
  item,
  ...items.slice(position),
];

const removeAt = <Value>(items: readonly Value[], position: number): readonly Value[] => [
  ...items.slice(0, position),
  ...items.slice(position + 1),
];

export class WorkoutExecutionService {
  private readonly exercises: ExerciseRepository;
  private readonly workouts: WorkoutRepository;
  private readonly clock: TrainingOrchestratorDependencies["clock"];
  private readonly ids: TrainingOrchestratorDependencies["ids"];

  constructor(
    dependencies: Pick<TrainingOrchestratorDependencies, "exercises" | "workouts" | "clock" | "ids">,
  ) {
    this.exercises = dependencies.exercises;
    this.workouts = dependencies.workouts;
    this.clock = dependencies.clock;
    this.ids = dependencies.ids;
  }

  async addWorkoutExercise(input: AddWorkoutExerciseInput): ApplicationResult<ActiveWorkoutSession> {
    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    const exercise = await this.exercises.findExercise(input.exerciseId);

    if (!isPersisted(exercise)) {
      return failure(persistenceError(exercise.error.code));
    }

    if (exercise.value === null) {
      return failure(notFoundError("exerciseId", input.exerciseId));
    }

    if (exercise.value.status !== "active") {
      return failure(validationError("exerciseId"));
    }

    const position = input.position ?? active.value.exercises.length;

    if (!isPosition(position, active.value.exercises.length, true)) {
      return failure(validationError("position"));
    }

    const workout: ActiveWorkoutSession = {
      ...active.value,
      exercises: insertAt(active.value.exercises, this.createWorkoutExercise(exercise.value), position),
    };

    return this.save(workout);
  }

  async moveWorkoutExercise(input: MoveWorkoutExerciseInput): ApplicationResult<ActiveWorkoutSession> {
    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    const currentPosition = active.value.exercises.findIndex((exercise) => exercise.id === input.workoutExerciseId);

    if (currentPosition === -1) {
      return failure(notFoundError("workoutExerciseId", input.workoutExerciseId));
    }

    if (!isPosition(input.position, active.value.exercises.length, false)) {
      return failure(validationError("position"));
    }

    const exercise = active.value.exercises[currentPosition]!;
    const withoutExercise = removeAt(active.value.exercises, currentPosition);
    const workout: ActiveWorkoutSession = {
      ...active.value,
      exercises: insertAt(withoutExercise, exercise, input.position),
    };

    return this.save(workout);
  }

  async removeWorkoutExercise(workoutExerciseId: WorkoutExerciseId): ApplicationResult<ActiveWorkoutSession> {
    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    const position = active.value.exercises.findIndex((exercise) => exercise.id === workoutExerciseId);

    if (position === -1) {
      return failure(notFoundError("workoutExerciseId", workoutExerciseId));
    }

    return this.save({
      ...active.value,
      exercises: removeAt(active.value.exercises, position),
    });
  }

  async addWorkoutSet(input: AddWorkoutSetInput): ApplicationResult<ActiveWorkoutSession> {
    if (!setTypes.includes(input.type)) {
      return failure(validationError("type"));
    }

    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    const exercisePosition = active.value.exercises.findIndex((exercise) => exercise.id === input.workoutExerciseId);

    if (exercisePosition === -1) {
      return failure(notFoundError("workoutExerciseId", input.workoutExerciseId));
    }

    const exercise = active.value.exercises[exercisePosition]!;
    const position = input.position ?? exercise.sets.length;

    if (!isPosition(position, exercise.sets.length, true)) {
      return failure(validationError("position"));
    }

    const updatedExercise: WorkoutExercise = {
      ...exercise,
      sets: insertAt(exercise.sets, this.createWorkoutSet(input.type), position),
    };

    return this.save({
      ...active.value,
      exercises: active.value.exercises.map((candidate, index) =>
        index === exercisePosition ? updatedExercise : candidate),
    });
  }

  async updateWorkoutSet(input: UpdateWorkoutSetInput): ApplicationResult<ActiveWorkoutSession> {
    const invalidField = this.invalidPatchField(input);

    if (invalidField !== null) {
      return failure(validationError(invalidField));
    }

    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    const location = this.findSet(active.value, input.workoutSetId);

    if (location === null) {
      return failure(notFoundError("workoutSetId", input.workoutSetId));
    }

    if (location.set.status !== "pending") {
      return failure(conflictError(input.workoutSetId));
    }

    return this.save(this.replaceSet(
      active.value,
      location.exercisePosition,
      location.setPosition,
      this.patchSet(location.set, input),
    ));
  }

  async removeWorkoutSet(workoutSetId: WorkoutSetId): ApplicationResult<ActiveWorkoutSession> {
    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    const location = this.findSet(active.value, workoutSetId);

    if (location === null) {
      return failure(notFoundError("workoutSetId", workoutSetId));
    }

    const exercise = active.value.exercises[location.exercisePosition]!;
    const updatedExercise: WorkoutExercise = {
      ...exercise,
      sets: removeAt(exercise.sets, location.setPosition),
    };

    return this.save({
      ...active.value,
      exercises: active.value.exercises.map((candidate, index) =>
        index === location.exercisePosition ? updatedExercise : candidate),
    });
  }

  async completeWorkoutSet(input: CompleteWorkoutSetInput): ApplicationResult<ActiveWorkoutSession> {
    if (!isValidWeight(input.weight)) {
      return failure(validationError("weight"));
    }

    if (!isValidRepetitions(input.repetitions)) {
      return failure(validationError("repetitions"));
    }

    if (input.effort !== undefined && !isValidEffort(input.effort)) {
      return failure(validationError("effort"));
    }

    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    const location = this.findSet(active.value, input.workoutSetId);

    if (location === null) {
      return failure(notFoundError("workoutSetId", input.workoutSetId));
    }

    if (location.set.status !== "pending") {
      return failure(conflictError(input.workoutSetId));
    }

    const set: WorkoutSet = {
      ...location.set,
      status: "completed",
      weight: input.weight,
      repetitions: input.repetitions,
      ...(input.effort === undefined ? {} : { effort: input.effort }),
      completedAt: this.clock.now(),
    };

    return this.save(this.replaceSet(active.value, location.exercisePosition, location.setPosition, set));
  }

  async reopenWorkoutSet(workoutSetId: WorkoutSetId): ApplicationResult<ActiveWorkoutSession> {
    const active = await this.findActiveWorkout();

    if (!active.ok) {
      return active;
    }

    const location = this.findSet(active.value, workoutSetId);

    if (location === null) {
      return failure(notFoundError("workoutSetId", workoutSetId));
    }

    if (location.set.status !== "completed") {
      return failure(conflictError(workoutSetId));
    }

    const { completedAt: _completedAt, ...set } = location.set;
    return this.save(this.replaceSet(active.value, location.exercisePosition, location.setPosition, {
      ...set,
      status: "pending",
    }));
  }

  private async findActiveWorkout(): ApplicationResult<ActiveWorkoutSession> {
    const active = await this.workouts.findActiveWorkout();

    if (!isPersisted(active)) {
      return failure(persistenceError(active.error.code));
    }

    return active.value === null ? failure(noActiveWorkoutError()) : success(active.value);
  }

  private async save(workout: ActiveWorkoutSession): ApplicationResult<ActiveWorkoutSession> {
    const saved = await this.workouts.saveWorkout(workout);
    return isPersisted(saved) ? success(workout) : failure(persistenceError(saved.error.code));
  }

  private createWorkoutExercise(exercise: Exercise): WorkoutExercise {
    return {
      id: this.ids.generate<WorkoutExerciseId>(),
      exercise: this.createExerciseSnapshot(exercise),
      sets: [],
      restSeconds: exercise.defaultRestSeconds,
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

  private createWorkoutSet(type: SetType): WorkoutSet {
    return {
      id: this.ids.generate<WorkoutSetId>(),
      type,
      status: "pending",
    };
  }

  private invalidPatchField(input: UpdateWorkoutSetInput): string | null {
    if (input.type !== undefined && !setTypes.includes(input.type)) {
      return "type";
    }

    if (input.weight !== undefined && input.weight !== null && !isValidWeight(input.weight)) {
      return "weight";
    }

    if (input.repetitions !== undefined && input.repetitions !== null && !isValidRepetitions(input.repetitions)) {
      return "repetitions";
    }

    if (input.effort !== undefined && input.effort !== null && !isValidEffort(input.effort)) {
      return "effort";
    }

    return null;
  }

  private patchSet(
    set: Extract<WorkoutSet, { readonly status: "pending" }>,
    input: UpdateWorkoutSetInput,
  ): WorkoutSet {
    const typed = input.type === undefined ? set : { ...set, type: input.type };
    const { weight: _weight, ...withoutWeight } = typed;
    const weighted = input.weight === null ? withoutWeight : input.weight === undefined ? typed : {
      ...typed,
      weight: input.weight,
    };
    const { repetitions: _repetitions, ...withoutRepetitions } = weighted;
    const repeated = input.repetitions === null ? withoutRepetitions : input.repetitions === undefined ? weighted : {
      ...weighted,
      repetitions: input.repetitions,
    };
    const { effort: _effort, ...withoutEffort } = repeated;
    return input.effort === null ? withoutEffort : input.effort === undefined ? repeated : {
      ...repeated,
      effort: input.effort,
    };
  }

  private findSet(
    workout: ActiveWorkoutSession,
    workoutSetId: WorkoutSetId,
  ): { readonly exercisePosition: number; readonly setPosition: number; readonly set: WorkoutSet } | null {
    for (const [exercisePosition, exercise] of workout.exercises.entries()) {
      const setPosition = exercise.sets.findIndex((set) => set.id === workoutSetId);

      if (setPosition !== -1) {
        return { exercisePosition, setPosition, set: exercise.sets[setPosition]! };
      }
    }

    return null;
  }

  private replaceSet(
    workout: ActiveWorkoutSession,
    exercisePosition: number,
    setPosition: number,
    set: WorkoutSet,
  ): ActiveWorkoutSession {
    return {
      ...workout,
      exercises: workout.exercises.map((exercise, index) => index === exercisePosition ? {
        ...exercise,
        sets: exercise.sets.map((candidate, candidateIndex) => candidateIndex === setPosition ? set : candidate),
      } : exercise),
    };
  }
}
