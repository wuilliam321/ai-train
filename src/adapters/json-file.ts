import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { failure, success } from "../core/application/result";
import type { TrainingOrchestratorDependencies } from "../core/application/dependencies";
import type { Exercise } from "../core/domain/exercise";
import type { EntityId, ExerciseId, ISODateTime, Page, RoutineId, WorkoutSessionId } from "../core/domain/primitives";
import type { Routine } from "../core/domain/routine";
import type { ActiveWorkoutSession, PreviousSetReference, WorkoutSession } from "../core/domain/workout";
import type {
  Clock,
  ExerciseRepository,
  ExerciseRepositoryQuery,
  IdGenerator,
  PersistenceResult,
  RoutineRepository,
  RoutineRepositoryQuery,
  TrainingChangeListener,
  TrainingChangePublisher,
  TrainingChangeSnapshot,
  WorkoutHistoryReader,
  WorkoutRepository,
  WorkoutRepositoryQuery,
} from "../core/ports";

const documentVersion = 1;
const defaultPath = "data/train-app.json";

interface TrainingDocument {
  readonly version: typeof documentVersion;
  readonly exercises: readonly Exercise[];
  readonly routines: readonly Routine[];
  readonly workouts: readonly WorkoutSession[];
  readonly history: readonly PreviousSetReference[];
}

export interface JsonFileSystem {
  readFile(path: string, encoding: "utf8"): Promise<string>;
  mkdir(path: string, options: { readonly recursive: true }): Promise<string | undefined>;
  writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
}

export interface JsonFileTrainingEnvironmentOptions {
  readonly path?: string;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly fileSystem?: JsonFileSystem;
}

export interface JsonFileTrainingEnvironment {
  readonly dependencies: TrainingOrchestratorDependencies;
  exportData(): Promise<string>;
  importData(serialized: string): PersistenceResult<void>;
}

const emptyDocument = (): TrainingDocument => ({
  version: documentVersion,
  exercises: [],
  routines: [],
  workouts: [],
  history: [],
});

const nodeFileSystem: JsonFileSystem = { readFile, mkdir, writeFile, rename, copyFile };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const has = (value: Record<string, unknown>, key: string): boolean => Object.hasOwn(value, key);
const isIdentifier = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isDateTime = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const isSeconds = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isRepetitions = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1;
const isWeight = (value: unknown): boolean => isRecord(value) &&
  typeof value.amount === "number" && Number.isFinite(value.amount) && value.amount >= 0 &&
  (value.unit === "kg" || value.unit === "lb");
const isEffort = (value: unknown): boolean => isRecord(value) &&
  ((value.kind === "rpe" && typeof value.value === "number" && value.value >= 1 && value.value <= 10) ||
  (value.kind === "rir" && Number.isInteger(value.value) && (value.value as number) >= 0 && (value.value as number) <= 10));
const muscles = new Set([
  "abdominals", "abductors", "adductors", "back", "biceps", "calves", "chest", "forearms", "glutes",
  "hamstrings", "neck", "quadriceps", "shoulders", "traps", "triceps",
]);
const isMuscles = (value: unknown): boolean => Array.isArray(value) && value.every((muscle) => typeof muscle === "string" && muscles.has(muscle));
const isTarget = (value: unknown): boolean => isRecord(value) &&
  ((value.kind === "exact" && isRepetitions(value.repetitions)) ||
  (value.kind === "range" && isRepetitions(value.minimum) && isRepetitions(value.maximum) && value.minimum <= value.maximum));
const isSetType = (value: unknown): boolean => value === "warmup" || value === "normal" || value === "drop" || value === "failure";
const isOptional = (value: Record<string, unknown>, key: string, validator: (candidate: unknown) => boolean): boolean =>
  !has(value, key) || validator(value[key]);

const isExercise = (value: unknown): boolean => isRecord(value) &&
  isIdentifier(value.id) && typeof value.name === "string" && value.name.trim().length > 0 &&
  isMuscles(value.primaryMuscles) && isMuscles(value.secondaryMuscles) && isSeconds(value.defaultRestSeconds) &&
  (value.status === "active" || value.status === "archived") && isDateTime(value.createdAt) && isDateTime(value.updatedAt) &&
  isOptional(value, "notes", (notes) => typeof notes === "string");

const isRoutineSet = (value: unknown): boolean => isRecord(value) && isSetType(value.type) && isTarget(value.repetitions);
const isRoutineExercise = (value: unknown): boolean => isRecord(value) &&
  isIdentifier(value.id) && isIdentifier(value.exerciseId) && Array.isArray(value.sets) && value.sets.every(isRoutineSet) &&
  (value.laterality === "bilateral" || value.laterality === "unilateral" || value.laterality === "alternating") &&
  isOptional(value, "restSeconds", isSeconds) && isOptional(value, "notes", (notes) => typeof notes === "string");
const isRoutine = (value: unknown): boolean => isRecord(value) &&
  isIdentifier(value.id) && typeof value.name === "string" && value.name.trim().length > 0 &&
  Array.isArray(value.variants) && value.variants.every((variant) => isRecord(variant) && isIdentifier(variant.id) &&
    typeof variant.name === "string" && Array.isArray(variant.exercises) && variant.exercises.every(isRoutineExercise)) &&
  (value.status === "active" || value.status === "archived") && isDateTime(value.createdAt) && isDateTime(value.updatedAt);

const isWorkoutSet = (value: unknown): boolean => isRecord(value) && isIdentifier(value.id) && isSetType(value.type) &&
  isOptional(value, "target", isTarget) && isOptional(value, "weight", isWeight) &&
  isOptional(value, "repetitions", isRepetitions) && isOptional(value, "effort", isEffort) &&
  ((value.status === "pending") || (value.status === "completed" && isWeight(value.weight) && isRepetitions(value.repetitions) && isDateTime(value.completedAt)));
const isWorkoutExercise = (value: unknown): boolean => isRecord(value) && isIdentifier(value.id) && isRecord(value.exercise) &&
  isIdentifier(value.exercise.id) && typeof value.exercise.name === "string" && isMuscles(value.exercise.primaryMuscles) &&
  isMuscles(value.exercise.secondaryMuscles) && Array.isArray(value.sets) && value.sets.every(isWorkoutSet) &&
  isSeconds(value.restSeconds) && isOptional(value, "notes", (notes) => typeof notes === "string");
const isRestPeriod = (value: unknown): boolean => isRecord(value) && isIdentifier(value.sourceSetId) &&
  isDateTime(value.startedAt) && isDateTime(value.endsAt) && value.startedAt <= value.endsAt;
const isWorkout = (value: unknown): boolean => isRecord(value) && isIdentifier(value.id) &&
  Array.isArray(value.exercises) && value.exercises.every(isWorkoutExercise) && isDateTime(value.startedAt) &&
  isOptional(value, "routine", (routine) => isRecord(routine) && isIdentifier(routine.id) && typeof routine.name === "string" &&
    isIdentifier(routine.variantId) && typeof routine.variantName === "string") &&
  ((value.status === "active" && isOptional(value, "restPeriod", isRestPeriod)) ||
  (value.status === "completed" && isDateTime(value.completedAt)) ||
  (value.status === "discarded" && isDateTime(value.discardedAt)));
const isReference = (value: unknown): boolean => isRecord(value) && isIdentifier(value.sessionId) && isIdentifier(value.setId) &&
  isIdentifier(value.exerciseId) && Number.isInteger(value.setPosition) && (value.setPosition as number) >= 0 &&
  isSetType(value.type) && isWeight(value.weight) && isRepetitions(value.repetitions) && isDateTime(value.completedAt) &&
  isOptional(value, "effort", isEffort);

const isDocument = (value: unknown): value is TrainingDocument =>
  isRecord(value) &&
  value.version === documentVersion &&
  Array.isArray(value.exercises) &&
  Array.isArray(value.routines) &&
  Array.isArray(value.workouts) &&
  Array.isArray(value.history) &&
  value.exercises.every(isExercise) &&
  value.routines.every(isRoutine) &&
  value.workouts.every(isWorkout) &&
  value.history.every(isReference);

const decodeDocument = (serialized: string): TrainingDocument | null => {
  try {
    const parsed: unknown = JSON.parse(serialized);
    return isDocument(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const serializeDocument = (document: TrainingDocument): string | null => {
  const serialized = JSON.stringify(document);
  return decodeDocument(serialized) === null ? null : serialized;
};

const isMissingFile = (error: unknown): boolean =>
  isRecord(error) && error.code === "ENOENT";

const previousSets = (workouts: readonly WorkoutSession[]): readonly PreviousSetReference[] =>
  workouts.flatMap((workout) => workout.status !== "completed" ? [] : workout.exercises.flatMap((exercise) =>
    exercise.sets.flatMap((set, setPosition) => set.status !== "completed" ? [] : [{
      sessionId: workout.id,
      setId: set.id,
      exerciseId: exercise.exercise.id,
      setPosition,
      type: set.type,
      weight: set.weight,
      repetitions: set.repetitions,
      ...(set.effort === undefined ? {} : { effort: set.effort }),
      completedAt: set.completedAt,
    }]),
  ));

class JsonDocumentStore {
  private document: TrainingDocument;
  private readonly path: string;
  private readonly fileSystem: JsonFileSystem;

  private constructor(path: string, fileSystem: JsonFileSystem, document: TrainingDocument) {
    this.path = path;
    this.fileSystem = fileSystem;
    this.document = document;
  }

  static async open(path: string, fileSystem: JsonFileSystem): Promise<JsonDocumentStore> {
    try {
      const serialized = await fileSystem.readFile(path, "utf8");
      const document = decodeDocument(serialized);

      if (document !== null) {
        return new JsonDocumentStore(path, fileSystem, document);
      }

      await fileSystem.copyFile(path, `${path}.corrupt-${Date.now()}.json`);
      const store = new JsonDocumentStore(path, fileSystem, emptyDocument());
      if (!await store.persist(store.document)) {
        throw new Error("Unable to restore an empty training document");
      }
      return store;
    } catch (error) {
      if (isMissingFile(error)) {
        return new JsonDocumentStore(path, fileSystem, emptyDocument());
      }

      throw error;
    }
  }

  current(): TrainingDocument {
    return this.document;
  }

  async replace(document: TrainingDocument): Promise<boolean> {
    const persisted = await this.persist(document);

    if (persisted) {
      this.document = document;
    }

    return persisted;
  }

  private async persist(document: TrainingDocument): Promise<boolean> {
    const serialized = serializeDocument(document);

    if (serialized === null) {
      return false;
    }

    const temporaryPath = `${this.path}.${randomUUID()}.tmp`;

    try {
      await this.fileSystem.mkdir(dirname(this.path), { recursive: true });
      await this.fileSystem.writeFile(temporaryPath, serialized, "utf8");
      await this.fileSystem.rename(temporaryPath, this.path);
      return true;
    } catch {
      return false;
    }
  }
}

class JsonFileRepositories implements ExerciseRepository, RoutineRepository, WorkoutRepository, WorkoutHistoryReader {
  private readonly store: JsonDocumentStore;

  constructor(store: JsonDocumentStore) {
    this.store = store;
  }

  async findExercise(exerciseId: ExerciseId): PersistenceResult<Exercise | null> {
    return success(this.store.current().exercises.find((exercise) => exercise.id === exerciseId) ?? null);
  }

  async listExercises(query?: ExerciseRepositoryQuery): PersistenceResult<readonly Exercise[]> {
    return success(this.store.current().exercises.filter((exercise) =>
      (query?.status === undefined || exercise.status === query.status) &&
      (query?.search === undefined || exercise.name.includes(query.search)),
    ));
  }

  async saveExercise(exercise: Exercise): PersistenceResult<void> {
    return this.saveCollection("exercises", exercise, (item) => item.id === exercise.id);
  }

  async findRoutine(routineId: RoutineId): PersistenceResult<Routine | null> {
    return success(this.store.current().routines.find((routine) => routine.id === routineId) ?? null);
  }

  async listRoutines(query?: RoutineRepositoryQuery): PersistenceResult<readonly Routine[]> {
    return success(this.store.current().routines.filter((routine) =>
      (query?.status === undefined || routine.status === query.status) &&
      (query?.search === undefined || routine.name.includes(query.search)),
    ));
  }

  async saveRoutine(routine: Routine): PersistenceResult<void> {
    return this.saveCollection("routines", routine, (item) => item.id === routine.id);
  }

  async findWorkout(workoutSessionId: WorkoutSessionId): PersistenceResult<WorkoutSession | null> {
    return success(this.store.current().workouts.find((workout) => workout.id === workoutSessionId) ?? null);
  }

  async findActiveWorkout(): PersistenceResult<ActiveWorkoutSession | null> {
    return success(this.store.current().workouts.find(
      (workout): workout is ActiveWorkoutSession => workout.status === "active",
    ) ?? null);
  }

  async listWorkouts(query: WorkoutRepositoryQuery): PersistenceResult<Page<WorkoutSession>> {
    const workouts = this.store.current().workouts.filter((workout) =>
      workout.status === "completed" &&
      (query.completedFrom === undefined || workout.completedAt >= query.completedFrom) &&
      (query.completedTo === undefined || workout.completedAt < query.completedTo),
    );
    const start = query.cursor === undefined ? 0 : Number(query.cursor);

    if (!Number.isInteger(start) || start < 0) {
      return failure({ code: "corrupt_data" });
    }

    const items = workouts.slice(start, start + query.limit);
    const next = start + items.length;
    return success({ items, ...(next < workouts.length ? { nextCursor: String(next) } : {}) });
  }

  async saveWorkout(workout: WorkoutSession): PersistenceResult<void> {
    const workouts = replace(this.store.current().workouts, workout, (item) => item.id === workout.id);
    const document: TrainingDocument = { ...this.store.current(), workouts, history: previousSets(workouts) };
    return await this.store.replace(document) ? success(undefined) : failure({ code: "unavailable" });
  }

  async findPreviousSets(query: Parameters<WorkoutHistoryReader["findPreviousSets"]>[0]): PersistenceResult<readonly PreviousSetReference[]> {
    return success(this.store.current().history.filter((reference) =>
      reference.exerciseId === query.exerciseId && reference.completedAt < query.before,
    ).sort((left, right) => right.completedAt.localeCompare(left.completedAt)).slice(0, query.limit));
  }

  async exportData(): Promise<string> {
    return JSON.stringify(this.store.current());
  }

  async importData(serialized: string): PersistenceResult<void> {
    const document = decodeDocument(serialized);

    if (document === null) {
      return failure({ code: "corrupt_data" });
    }

    return await this.store.replace(document) ? success(undefined) : failure({ code: "unavailable" });
  }

  private async saveCollection<Item extends Exercise | Routine>(
    collection: "exercises" | "routines",
    item: Item,
    matches: (candidate: Item) => boolean,
  ): PersistenceResult<void> {
    const items = replace(this.store.current()[collection] as readonly Item[], item, matches);
    const document = { ...this.store.current(), [collection]: items } as TrainingDocument;
    return await this.store.replace(document) ? success(undefined) : failure({ code: "unavailable" });
  }
}

const replace = <Item>(items: readonly Item[], item: Item, matches: (candidate: Item) => boolean): readonly Item[] => {
  const index = items.findIndex(matches);
  return index === -1 ? [...items, item] : items.map((candidate, candidateIndex) => candidateIndex === index ? item : candidate);
};

class SystemClock implements Clock {
  now(): ISODateTime {
    return new Date().toISOString() as ISODateTime;
  }
}

class RandomIdGenerator implements IdGenerator {
  generate<Identifier extends EntityId>(): Identifier {
    return randomUUID() as Identifier;
  }
}

class InMemoryTrainingChangePublisher implements TrainingChangePublisher {
  private readonly listeners = new Set<TrainingChangeListener>();

  publish(snapshot: TrainingChangeSnapshot): void {
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  subscribe(listener: TrainingChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const createJsonFileTrainingEnvironment = async (
  options: JsonFileTrainingEnvironmentOptions = {},
): Promise<JsonFileTrainingEnvironment> => {
  const store = await JsonDocumentStore.open(options.path ?? defaultPath, options.fileSystem ?? nodeFileSystem);
  const repositories = new JsonFileRepositories(store);

  return {
    dependencies: {
      exercises: repositories,
      routines: repositories,
      workouts: repositories,
      history: repositories,
      events: new InMemoryTrainingChangePublisher(),
      clock: options.clock ?? new SystemClock(),
      ids: options.ids ?? new RandomIdGenerator(),
    },
    exportData: () => repositories.exportData(),
    importData: (serialized) => repositories.importData(serialized),
  };
};
