import { describe, expect, it } from "vitest";
import { ExerciseCatalogService } from "../../src/core/application/exercise-catalog";
import { RoutineCatalogService } from "../../src/core/application/routine-catalog";
import { failure } from "../../src/core/application/result";
import type {
  ExerciseDraft,
  ExerciseRepository,
  ISODateTime,
  PersistenceResult,
  Repetitions,
  RoutineDraft,
  RoutineRepository,
  Seconds,
} from "../../src/core";
import { createTrainingEnvironment, TestClock } from "../support/training-environment";

const startedAt = "2026-07-28T12:00:00.000Z" as ISODateTime;
const updatedAt = "2026-07-28T12:05:00.000Z" as ISODateTime;

const squat: ExerciseDraft = {
  name: "Back Squat",
  primaryMuscles: ["quadriceps"],
  defaultRestSeconds: 180 as Seconds,
};

const row: ExerciseDraft = {
  name: "Barbell Row",
  primaryMuscles: ["back"],
  defaultRestSeconds: 120 as Seconds,
};

const createCatalogs = () => {
  const clock = new TestClock(startedAt);
  const environment = createTrainingEnvironment(clock);
  return {
    clock,
    environment,
    exercises: new ExerciseCatalogService(environment),
    routines: new RoutineCatalogService(environment),
  };
};

const unavailableRoutines = (): RoutineRepository => {
  const unavailable = <Value>(): PersistenceResult<Value> =>
    Promise.resolve(failure({ code: "unavailable" }));

  return {
    findRoutine: unavailable,
    listRoutines: unavailable,
    saveRoutine: unavailable,
  };
};

const saveUnavailableRoutines = (
  routines: RoutineRepository,
): RoutineRepository => ({
  findRoutine: (routineId) => routines.findRoutine(routineId),
  listRoutines: (query) => routines.listRoutines(query),
  saveRoutine: async () => failure({ code: "unavailable" }),
});

const listUnavailableRoutines = (
  routines: RoutineRepository,
): RoutineRepository => ({
  findRoutine: (routineId) => routines.findRoutine(routineId),
  listRoutines: async () => failure({ code: "unavailable" }),
  saveRoutine: (routine) => routines.saveRoutine(routine),
});

const unavailableExercises = (): ExerciseRepository => {
  const unavailable = <Value>(): PersistenceResult<Value> =>
    Promise.resolve(failure({ code: "unavailable" }));

  return {
    findExercise: unavailable,
    listExercises: unavailable,
    saveExercise: unavailable,
  };
};

const routineDraft = (squatId: string, rowId: string): RoutineDraft => ({
  name: "  Full Body  ",
  variants: [
    {
      name: " Gym ",
      exercises: [
        {
          exerciseId: squatId as never,
          sets: [
            {
              type: "warmup",
              repetitions: { kind: "exact", repetitions: 8 as Repetitions },
            },
            {
              type: "normal",
              repetitions: {
                kind: "range",
                minimum: 6 as Repetitions,
                maximum: 8 as Repetitions,
              },
            },
          ],
          laterality: "bilateral",
          restSeconds: 180 as Seconds,
          notes: "Controlled descent",
        },
        {
          exerciseId: rowId as never,
          sets: [
            {
              type: "normal",
              repetitions: { kind: "exact", repetitions: 10 as Repetitions },
            },
          ],
          laterality: "bilateral",
        },
      ],
    },
  ],
});

describe("routine catalog", () => {
  it("manages a routine and its variants through their lifecycle", async () => {
    const { clock, exercises, routines } = createCatalogs();
    const createdSquat = await exercises.createExercise(squat);
    const createdRow = await exercises.createExercise(row);

    if (!createdSquat.ok || !createdRow.ok) {
      throw new Error("Expected exercise creation");
    }

    const created = await routines.createRoutine(routineDraft(createdSquat.value.id, createdRow.value.id));

    expect(created).toMatchObject({
      ok: true,
      value: {
        name: "Full Body",
        status: "active",
        variants: [{ name: "Gym", exercises: [{ restSeconds: 180, notes: "Controlled descent" }, {}] }],
        createdAt: startedAt,
      },
    });

    if (!created.ok) {
      throw new Error("Expected routine creation");
    }

    expect(await routines.getRoutine(created.value.id)).toEqual(created);
    expect(await routines.listRoutines({ search: "Body" })).toEqual({
      ok: true,
      value: [{ id: created.value.id, name: "Full Body", variantCount: 1, status: "active" }],
    });

    expect(await routines.updateRoutine({
      routineId: created.value.id,
      patch: {},
    })).toMatchObject({
      ok: true,
      value: { name: "Full Body", variants: created.value.variants },
    });

    clock.set(updatedAt);
    const updated = await routines.updateRoutine({
      routineId: created.value.id,
      patch: {
        name: "Upper and Lower",
        variants: [{
          name: "Home",
          exercises: [{
            exerciseId: createdRow.value.id,
            sets: [{
              type: "failure",
              repetitions: { kind: "exact", repetitions: 12 as Repetitions },
            }],
            laterality: "unilateral",
          }],
        }],
      },
    });

    expect(updated).toMatchObject({
      ok: true,
      value: {
        name: "Upper and Lower",
        variants: [{ name: "Home", exercises: [{ exerciseId: createdRow.value.id }] }],
        updatedAt,
      },
    });
    expect(await routines.archiveRoutine(created.value.id)).toMatchObject({
      ok: true,
      value: { status: "archived" },
    });
    expect(await routines.restoreRoutine(created.value.id)).toMatchObject({
      ok: true,
      value: { status: "active" },
    });
    expect(await routines.suggestRoutine()).toEqual({ ok: true, value: null });
  });

  it("rejects invalid, duplicate, archived and missing routine inputs", async () => {
    const { exercises, routines } = createCatalogs();
    const createdSquat = await exercises.createExercise(squat);
    const createdRow = await exercises.createExercise(row);

    if (!createdSquat.ok || !createdRow.ok) {
      throw new Error("Expected exercise creation");
    }

    const draft = routineDraft(createdSquat.value.id, createdRow.value.id);
    const created = await routines.createRoutine(draft);

    if (!created.ok) {
      throw new Error("Expected routine creation");
    }

    expect(await routines.createRoutine({ ...draft, name: " " })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "name" } },
    });
    expect(await routines.createRoutine({ ...draft, variants: [] })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "variants" } },
    });
    expect(await routines.createRoutine({
      ...draft,
      variants: [draft.variants[0]!, draft.variants[0]!],
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "variants" } },
    });
    expect(await routines.createRoutine({ ...draft, name: "full body" })).toEqual({
      ok: false,
      error: { code: "conflict", details: { name: "full body" } },
    });
    expect(await routines.updateRoutine({
      routineId: created.value.id,
      patch: { name: " " },
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "name" } },
    });
    expect(await routines.updateRoutine({
      routineId: created.value.id,
      patch: { variants: [] },
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "variants" } },
    });
    const second = await routines.createRoutine({ ...draft, name: "Upper" });

    if (!second.ok) {
      throw new Error("Expected second routine creation");
    }

    expect(await routines.updateRoutine({
      routineId: created.value.id,
      patch: { name: "upper" },
    })).toEqual({
      ok: false,
      error: { code: "conflict", details: { name: "upper" } },
    });
    expect(await routines.updateRoutine({
      routineId: "missing" as typeof created.value.id,
      patch: {},
    })).toEqual({
      ok: false,
      error: { code: "not_found", details: { routineId: "missing" } },
    });
    expect(await routines.getRoutine("missing" as typeof created.value.id)).toEqual({
      ok: false,
      error: { code: "not_found", details: { routineId: "missing" } },
    });
    expect(await routines.archiveRoutine("missing" as typeof created.value.id)).toEqual({
      ok: false,
      error: { code: "not_found", details: { routineId: "missing" } },
    });

    expect(await exercises.archiveExercise(createdRow.value.id)).toMatchObject({ ok: true });
    expect(await routines.createRoutine({
      ...draft,
      name: "Archived exercise",
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "exerciseId" } },
    });
    expect(await routines.createRoutine({
      ...draft,
      name: "Missing exercise",
      variants: [{
        ...draft.variants[0]!,
        exercises: [{ ...draft.variants[0]!.exercises[0]!, exerciseId: "missing" as never }],
      }],
    })).toEqual({
      ok: false,
      error: { code: "validation", details: { field: "exerciseId" } },
    });
  });

  it("returns typed persistence errors without saving a routine", async () => {
    const { environment, exercises } = createCatalogs();
    const createdSquat = await exercises.createExercise(squat);
    const createdRow = await exercises.createExercise(row);

    if (!createdSquat.ok || !createdRow.ok) {
      throw new Error("Expected exercise creation");
    }

    const unavailable = new RoutineCatalogService({
      ...environment,
      routines: unavailableRoutines(),
    });
    const saveUnavailable = new RoutineCatalogService({
      ...environment,
      routines: saveUnavailableRoutines(environment.routines),
    });
    const draft = routineDraft(createdSquat.value.id, createdRow.value.id);

    expect(await unavailable.createRoutine(draft)).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await unavailable.getRoutine("missing" as never)).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await unavailable.listRoutines()).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    expect(await saveUnavailable.createRoutine(draft)).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    const exerciseUnavailable = new RoutineCatalogService({
      ...environment,
      exercises: unavailableExercises(),
    });
    const listUnavailable = new RoutineCatalogService({
      ...environment,
      routines: listUnavailableRoutines(environment.routines),
    });

    expect(await exerciseUnavailable.createRoutine(draft)).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
    const created = await new RoutineCatalogService(environment).createRoutine(draft);

    if (!created.ok) {
      throw new Error("Expected routine creation");
    }

    expect(await listUnavailable.updateRoutine({
      routineId: created.value.id,
      patch: { name: "Changed" },
    })).toEqual({
      ok: false,
      error: { code: "persistence", details: { code: "unavailable" } },
    });
  });
});
