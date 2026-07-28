import { describe, expect, it } from "vitest";
import { ExerciseCatalogService } from "../../src/core/application/exercise-catalog";
import { failure } from "../../src/core/application/result";
import type {
  ExerciseDraft,
  ExerciseRepository,
  ISODateTime,
  PersistenceResult,
  Seconds,
} from "../../src/core";
import { createTrainingEnvironment, TestClock } from "../support/training-environment";

const startedAt = "2026-07-28T12:00:00.000Z" as ISODateTime;
const updatedAt = "2026-07-28T12:05:00.000Z" as ISODateTime;

const squat: ExerciseDraft = {
  name: "  Back Squat  ",
  primaryMuscles: ["quadriceps", "glutes"],
  secondaryMuscles: ["abdominals"],
  defaultRestSeconds: 180 as Seconds,
  notes: "Low bar",
};

const createCatalog = () => {
  const clock = new TestClock(startedAt);
  return {
    catalog: new ExerciseCatalogService(createTrainingEnvironment(clock)),
    clock,
  };
};

const unavailableExercises = (): ExerciseRepository => {
  const unavailable = <Value>(): PersistenceResult<Value> =>
    Promise.resolve(failure({ code: "unavailable" }));

  return {
    findExercise: unavailable,
    listExercises: unavailable,
    saveExercise: unavailable,
  };
};

const saveUnavailableExercises = (
  exercises: ExerciseRepository,
): ExerciseRepository => ({
  findExercise: (exerciseId) => exercises.findExercise(exerciseId),
  listExercises: (query) => exercises.listExercises(query),
  saveExercise: async () => failure({ code: "unavailable" }),
});

const listUnavailableExercises = (
  exercises: ExerciseRepository,
): ExerciseRepository => ({
  findExercise: (exerciseId) => exercises.findExercise(exerciseId),
  listExercises: async () => failure({ code: "unavailable" }),
  saveExercise: (exercise) => exercises.saveExercise(exercise),
});

describe("exercise catalog", () => {
  it("manages a custom exercise through its lifecycle", async () => {
    const { catalog, clock } = createCatalog();
    const bodyweight = await catalog.createExercise({
      name: "Pull Up",
      primaryMuscles: ["back"],
      defaultRestSeconds: 90 as Seconds,
    });
    const created = await catalog.createExercise(squat);

    expect(bodyweight).toMatchObject({
      ok: true,
      value: { secondaryMuscles: [] },
    });

    expect(created).toMatchObject({
      ok: true,
      value: {
        id: "id-2",
        name: "Back Squat",
        status: "active",
        createdAt: startedAt,
        updatedAt: startedAt,
      },
    });

    if (!created.ok) {
      throw new Error("Expected exercise creation");
    }

    expect(await catalog.getExercise(created.value.id)).toEqual(created);
    expect(await catalog.listExercises({ search: "Squat" })).toEqual({
      ok: true,
      value: [created.value],
    });

    clock.set(updatedAt);
    const updated = await catalog.updateExercise({
      exerciseId: created.value.id,
      patch: {
        name: "High Bar Squat",
        primaryMuscles: ["quadriceps"],
        secondaryMuscles: ["glutes"],
        defaultRestSeconds: 0 as Seconds,
        notes: null,
      },
    });

    expect(updated).toMatchObject({
      ok: true,
      value: {
        name: "High Bar Squat",
        primaryMuscles: ["quadriceps"],
        secondaryMuscles: ["glutes"],
        defaultRestSeconds: 0,
        updatedAt,
      },
    });

    expect(await catalog.archiveExercise(created.value.id)).toMatchObject({
      ok: true,
      value: { status: "archived", updatedAt },
    });
    expect(await catalog.listExercises({ status: "archived" })).toMatchObject({
      ok: true,
      value: [{ id: created.value.id }],
    });
    expect(await catalog.restoreExercise(created.value.id)).toMatchObject({
      ok: true,
      value: { status: "active" },
    });
  });

  it("rejects invalid, duplicate and missing exercises without changing the catalog", async () => {
    const { catalog } = createCatalog();
    const created = await catalog.createExercise(squat);

    if (!created.ok) {
      throw new Error("Expected exercise creation");
    }

    expect(await catalog.createExercise({ ...squat, name: "   " })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "name" } },
    });
    expect(await catalog.createExercise({ ...squat, name: "Front Squat", primaryMuscles: [] })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "muscles" } },
    });
    expect(await catalog.createExercise({
      ...squat,
      name: "Duplicate primary",
      primaryMuscles: ["quadriceps", "quadriceps"],
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "muscles" } },
    });
    expect(await catalog.createExercise({
      ...squat,
      name: "Duplicate secondary",
      secondaryMuscles: ["abdominals", "abdominals"],
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "muscles" } },
    });
    expect(await catalog.createExercise({
      ...squat,
      name: "Overlapping muscles",
      secondaryMuscles: ["quadriceps"],
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "muscles" } },
    });
    expect(await catalog.createExercise({
      ...squat,
      name: "Invalid rest",
      defaultRestSeconds: -1 as Seconds,
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "defaultRestSeconds" } },
    });
    expect(await catalog.createExercise({ ...squat, name: "back squat" })).toEqual({
      ok: false,
      error: { code: "conflict", details: { name: "back squat" } },
    });
    expect(await catalog.updateExercise({
      exerciseId: created.value.id,
      patch: { secondaryMuscles: ["quadriceps"] },
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "muscles" } },
    });
    expect(await catalog.updateExercise({
      exerciseId: created.value.id,
      patch: { name: " " },
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "name" } },
    });
    expect(await catalog.updateExercise({
      exerciseId: created.value.id,
      patch: { primaryMuscles: [] },
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "muscles" } },
    });
    expect(await catalog.updateExercise({
      exerciseId: created.value.id,
      patch: { secondaryMuscles: ["biceps", "biceps"] },
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "muscles" } },
    });
    expect(await catalog.updateExercise({
      exerciseId: created.value.id,
      patch: { defaultRestSeconds: -1 as Seconds },
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "defaultRestSeconds" } },
    });
    const second = await catalog.createExercise({ ...squat, name: "Front Squat" });

    if (!second.ok) {
      throw new Error("Expected second exercise creation");
    }

    expect(await catalog.updateExercise({
      exerciseId: created.value.id,
      patch: { name: "front squat" },
    })).toEqual({
      ok: false,
      error: { code: "conflict", details: { name: "front squat" } },
    });
    expect(await catalog.updateExercise({
      exerciseId: "missing" as typeof created.value.id,
      patch: {},
    })).toEqual({
      ok: false,
      error: { code: "not_found", details: { exerciseId: "missing" } },
    });
    expect(await catalog.getExercise("missing" as typeof created.value.id)).toEqual({
      ok: false,
      error: { code: "not_found", details: { exerciseId: "missing" } },
    });
    expect(await catalog.archiveExercise("missing" as typeof created.value.id)).toEqual({
      ok: false,
      error: { code: "not_found", details: { exerciseId: "missing" } },
    });
  });

  it("returns a typed persistence error when its repository is unavailable", async () => {
    const dependencies = createTrainingEnvironment(new TestClock(startedAt));
    const catalog = new ExerciseCatalogService({
      ...dependencies,
      exercises: unavailableExercises(),
    });

    expect(await catalog.createExercise(squat)).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await catalog.getExercise("missing" as never)).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await catalog.listExercises()).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
  });

  it("does not mutate when persistence fails during an update", async () => {
    const environment = createTrainingEnvironment(new TestClock(startedAt));
    const catalog = new ExerciseCatalogService(environment);
    const created = await catalog.createExercise(squat);

    if (!created.ok) {
      throw new Error("Expected exercise creation");
    }

    const saveUnavailableCatalog = new ExerciseCatalogService({
      ...environment,
      exercises: saveUnavailableExercises(environment.exercises),
    });
    const listUnavailableCatalog = new ExerciseCatalogService({
      ...environment,
      exercises: listUnavailableExercises(environment.exercises),
    });

    expect(await saveUnavailableCatalog.updateExercise({
      exerciseId: created.value.id,
      patch: { notes: "Changed" },
    })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await listUnavailableCatalog.updateExercise({
      exerciseId: created.value.id,
      patch: { notes: "Changed" },
    })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await catalog.getExercise(created.value.id)).toEqual(created);
  });
});
