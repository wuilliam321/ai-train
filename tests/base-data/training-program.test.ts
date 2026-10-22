import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createWebStorageTrainingEnvironment } from "../../src/adapters/web-storage";
import { loadBaseData } from "../../src/base-data/load";
import { TrainingOrchestrator } from "../../src/core";
import type { Repetitions, WeightAmount } from "../../src/core";

it("imports the audio program and persists four nonempty training days with all seventeen exercises", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const environment = createWebStorageTrainingEnvironment({ storage });
  const serialized = readFileSync(new URL("../../docs/programa-entrenamiento.json", import.meta.url), "utf8");
  expect(serialized).not.toMatch(/simple/i);
  expect(await environment.importData(serialized)).toEqual({ ok: true, value: undefined });
  let training = new TrainingOrchestrator(environment.dependencies);
  const exerciseNames = new Set<string>();

  for (let day = 0; day < 4; day += 1) {
    const started = await training.startNextProgramWorkout();
    if (!started.ok) throw new Error("Expected scheduled workout");
    expect(started.value.exercises.length).toBeGreaterThanOrEqual(5);
    for (const exercise of started.value.exercises) {
      exerciseNames.add(exercise.exercise.name);
      expect(exercise.sets.length).toBeGreaterThanOrEqual(2);
      expect(exercise.sets.every((set) => set.target?.kind === "range")).toBe(true);
    }
    const set = started.value.exercises[0]!.sets[0]!;
    expect(await training.completeWorkoutSet({
      workoutSetId: set.id,
      weight: { amount: 20 as WeightAmount, unit: "kg" },
      repetitions: 8 as Repetitions,
    })).toMatchObject({ ok: true });
    training = new TrainingOrchestrator(createWebStorageTrainingEnvironment({ storage }).dependencies);
    const recovered = await training.getActiveWorkout();
    if (!recovered.ok || recovered.value === null) throw new Error("Expected recovered workout");
    expect(recovered.value.id).toBe(started.value.id);
    expect(recovered.value.exercises[0]!.sets[0]).toMatchObject({ id: set.id, status: "completed" });
    expect(await training.finishWorkout()).toMatchObject({ ok: true });
  }

  expect(exerciseNames.size).toBe(17);
  expect(await training.getProgramProgress()).toMatchObject({
    ok: true, value: { completedSessions: 4, plannedSessions: 32 },
  });
});


it("renames the previous seeded program without duplicating routines or losing its active workout", async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const environment = createWebStorageTrainingEnvironment({ storage });
  const document = JSON.parse(readFileSync(new URL("../../docs/programa-entrenamiento.json", import.meta.url), "utf8"));
  const oldNames = ["Simple · Torso A", "Simple · Pierna A", "Simple · Torso B", "Simple · Pierna B"];
  const routineIds = document.routines.map((routine: { id: string }, index: number) => {
    document.routines[index].name = oldNames[index];
    return routine.id;
  });
  document.programs[0].name = "Simple · Torso/Pierna 4 días";
  document.programCycles[0].programName = document.programs[0].name;
  expect(await environment.importData(JSON.stringify(document))).toMatchObject({ ok: true });
  const training = new TrainingOrchestrator(environment.dependencies);
  const started = await training.startNextProgramWorkout();
  if (!started.ok) throw new Error("Expected previous workout");
  expect(await loadBaseData(training)).toMatchObject({ ok: true });
  const programs = await training.listPrograms();
  if (!programs.ok) throw new Error("Expected programs");
  expect(programs.value.filter((program) => program.name === "Fuerza e hipertrofia · 4 días")).toHaveLength(1);
  expect(programs.value.some((program) => program.name.includes("Simple"))).toBe(false);
  const routines = await training.listRoutines();
  if (!routines.ok) throw new Error("Expected routines");
  expect(routines.value.filter((routine) => routineIds.includes(routine.id))).toHaveLength(4);
  expect(routines.value.some((routine) => routine.name.includes("Simple"))).toBe(false);
  expect(await training.getActiveWorkout()).toEqual(started);
  expect(await training.getProgramProgress()).toMatchObject({ ok: true, value: { completedSessions: 0 } });
  expect(await loadBaseData(training)).toMatchObject({ ok: true, value: { createdPrograms: 0, createdRoutines: 0 } });
});
