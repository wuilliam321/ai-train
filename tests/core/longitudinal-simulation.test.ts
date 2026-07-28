import { describe, expect, it } from "vitest";
import { TrainingOrchestrator, success } from "../../src/core";
import type {
  ActiveWorkoutSession,
  CompletedWorkoutSession,
  ISODateTime,
  Page,
  PersistenceResult,
  PreviousSetQuery,
  PreviousSetReference,
  WorkoutHistoryReader,
  WorkoutRepository,
  WorkoutRepositoryQuery,
  WorkoutSession,
  WorkoutSessionId,
} from "../../src/core";
import { createTrainingEnvironment, TestClock } from "../support/training-environment";

const weeks = 104;
const workoutsPerWeek = 5;
const exercisesPerWorkout = 5;
const setsPerExercise = 4;
const firstWorkoutAt = Date.parse("2024-01-01T12:00:00.000Z");
const primaryMuscles = ["quadriceps", "back", "chest", "hamstrings", "shoulders"] as const;

const timestamp = (offsetDays: number): ISODateTime =>
  new Date(firstWorkoutAt + offsetDays * 86_400_000).toISOString() as ISODateTime;

class SimulationWorkouts implements WorkoutRepository {
  private readonly workouts = new Map<WorkoutSessionId, WorkoutSession>();

  constructor(workouts: readonly WorkoutSession[]) {
    for (const workout of workouts) {
      this.workouts.set(workout.id, workout);
    }
  }

  async findWorkout(workoutSessionId: WorkoutSessionId): PersistenceResult<WorkoutSession | null> {
    return success(this.workouts.get(workoutSessionId) ?? null);
  }

  async findActiveWorkout(): PersistenceResult<ActiveWorkoutSession | null> {
    const active = [...this.workouts.values()].find(
      (workout): workout is ActiveWorkoutSession => workout.status === "active",
    );
    return success(active ?? null);
  }

  async listWorkouts(query: WorkoutRepositoryQuery): PersistenceResult<Page<WorkoutSession>> {
    const completed = [...this.workouts.values()].filter((workout) =>
      workout.status === "completed" &&
      (query.completedFrom === undefined || workout.completedAt >= query.completedFrom) &&
      (query.completedTo === undefined || workout.completedAt < query.completedTo),
    );
    const start = query.cursor === undefined ? 0 : Number(query.cursor);
    const items = completed.slice(start, start + query.limit);
    const next = start + items.length;

    return success({
      items,
      ...(next < completed.length ? { nextCursor: String(next) } : {}),
    });
  }

  async saveWorkout(workout: WorkoutSession): PersistenceResult<void> {
    this.workouts.set(workout.id, workout);
    return success(undefined);
  }

  completed(): readonly CompletedWorkoutSession[] {
    return [...this.workouts.values()].filter(
      (workout): workout is CompletedWorkoutSession => workout.status === "completed",
    );
  }
}

class SimulationHistory implements WorkoutHistoryReader {
  private readonly workouts: SimulationWorkouts;

  constructor(workouts: SimulationWorkouts) {
    this.workouts = workouts;
  }

  async findPreviousSets(query: PreviousSetQuery): PersistenceResult<readonly PreviousSetReference[]> {
    const references = this.workouts.completed()
      .filter((workout) => workout.completedAt < query.before)
      .flatMap((workout) => workout.exercises.flatMap((exercise) => exercise.sets.flatMap((set, setPosition) =>
        set.status !== "completed" || exercise.exercise.id !== query.exerciseId ? [] : [{
          sessionId: workout.id,
          setId: set.id,
          exerciseId: exercise.exercise.id,
          setPosition,
          type: set.type,
          weight: set.weight,
          repetitions: set.repetitions,
          ...(set.effort === undefined ? {} : { effort: set.effort }),
          completedAt: set.completedAt,
        }],
      )))
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .slice(0, query.limit);

    return success(references);
  }
}

const createWorkouts = (): readonly CompletedWorkoutSession[] =>
  Array.from({ length: weeks * workoutsPerWeek }, (_, workoutIndex) => {
    const week = Math.floor(workoutIndex / workoutsPerWeek);
    const completedAt = timestamp(workoutIndex);
    const weight = 50 + week;

    return {
      id: `workout-${workoutIndex}` as never,
      status: "completed",
      startedAt: completedAt,
      completedAt,
      exercises: Array.from({ length: exercisesPerWorkout }, (_, exerciseIndex) => ({
        id: `workout-${workoutIndex}-exercise-${exerciseIndex}` as never,
        exercise: {
          id: `exercise-${exerciseIndex}` as never,
          name: `Exercise ${exerciseIndex + 1}`,
          primaryMuscles: [primaryMuscles[exerciseIndex]!],
          secondaryMuscles: [],
        },
        restSeconds: 120 as never,
        sets: Array.from({ length: setsPerExercise }, (_, setIndex) => ({
          id: `workout-${workoutIndex}-exercise-${exerciseIndex}-set-${setIndex}` as never,
          status: "completed" as const,
          type: "normal" as const,
          weight: { amount: weight as never, unit: "kg" as const },
          repetitions: 8 as never,
          completedAt,
        })),
      })),
    };
  });

describe("longitudinal simulation", () => {
  it("keeps two years of offline training recoverable, pageable and measurable in under 500 ms", async () => {
    const started = performance.now();
    const repository = new SimulationWorkouts(createWorkouts());
    const environment = createTrainingEnvironment(new TestClock(timestamp(weeks * workoutsPerWeek)));
    const workouts = new TrainingOrchestrator({
      ...environment,
      workouts: repository,
      history: new SimulationHistory(repository),
    });
    const period = { from: timestamp(0), to: timestamp(weeks * workoutsPerWeek) };
    const dashboard = await workouts.getDashboard(period);
    const progress = await workouts.getExerciseProgress({ exerciseId: "exercise-0" as never, period });
    const firstPage = await workouts.listWorkoutSessions({ limit: 50, period });

    if (!firstPage.ok || firstPage.value.nextCursor === undefined) {
      throw new Error("Expected first page");
    }

    const secondPage = await workouts.listWorkoutSessions({
      limit: 50,
      cursor: firstPage.value.nextCursor,
      period,
    });
    const active: ActiveWorkoutSession = {
      id: "active" as never,
      status: "active",
      startedAt: timestamp(weeks * workoutsPerWeek),
      exercises: [],
    };

    await repository.saveWorkout(active);
    const recovered = await new TrainingOrchestrator({
      ...environment,
      workouts: repository,
      history: new SimulationHistory(repository),
    }).getActiveWorkout();
    const references = await workouts.getPreviousSetReferences({
      exerciseId: "exercise-0" as never,
      limit: 1,
    });
    const elapsed = performance.now() - started;

    expect(dashboard).toEqual({
      ok: true,
      value: {
        period,
        workoutCount: 520,
        completedSetCount: 10_400,
        volume: [{ amount: 8_444_800, unit: "kg" }],
        muscleDistribution: ["quadriceps", "back", "chest", "hamstrings", "shoulders"].map((muscle) => ({
          muscle,
          volume: [{ amount: 1_688_960, unit: "kg" }],
        })),
        lastWorkout: {
          id: "workout-519",
          startedAt: timestamp(519),
          completedAt: timestamp(519),
          completedSetCount: 20,
          volume: [{ amount: 24_480, unit: "kg" }],
        },
      },
    });
    expect(progress).toEqual({
      ok: true,
      value: {
        exerciseId: "exercise-0",
        period,
        points: expect.arrayContaining([{
          recordedAt: timestamp(519),
          bestWeight: { amount: 153, unit: "kg" },
          volume: [{ amount: 4_896, unit: "kg" }],
        }]),
      },
    });
    expect(firstPage.value.items).toHaveLength(50);
    expect(secondPage).toMatchObject({ ok: true, value: { items: expect.any(Array) } });

    if (!secondPage.ok) {
      throw new Error("Expected second page");
    }

    expect(secondPage.value.items).toHaveLength(50);
    expect(recovered).toEqual({ ok: true, value: active });
    expect(references).toEqual({
      ok: true,
      value: [{
        sessionId: "workout-519",
        setId: "workout-519-exercise-0-set-0",
        exerciseId: "exercise-0",
        setPosition: 0,
        type: "normal",
        weight: { amount: 153, unit: "kg" },
        repetitions: 8,
        completedAt: timestamp(519),
      }],
    });
    expect(elapsed).toBeLessThan(500);
  });
});
