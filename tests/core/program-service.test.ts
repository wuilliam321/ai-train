import { describe, expect, it } from "vitest";
import { TrainingOrchestrator } from "../../src/core";
import { ProgramService } from "../../src/core/application/program-service";
import { failure, success } from "../../src/core/application/result";
import type { EntityId, ISODateTime, ProgramDraft, ProgramRepository, Repetitions, Seconds, WeightAmount } from "../../src/core";
import { TestClock, createTrainingEnvironment } from "../support/training-environment";

const now = "2026-07-28T12:00:00.000Z" as ISODateTime;

const setup = async () => {
  const training = new TrainingOrchestrator(createTrainingEnvironment(new TestClock(now)));
  const exercise = await training.createExercise({ name: "Press", primaryMuscles: ["chest"], defaultRestSeconds: 60 as Seconds });
  if (!exercise.ok) throw new Error("Expected exercise");
  const routine = await training.createRoutine({ name: "A", variants: [{ name: "Gym", exercises: [{ exerciseId: exercise.value.id, sets: [{ type: "normal", repetitions: { kind: "range", minimum: 8 as Repetitions, maximum: 10 as Repetitions } }], laterality: "bilateral" }] }] });
  if (!routine.ok) throw new Error("Expected routine");
  const draft: ProgramDraft = { name: "Programa", weeks: 1, sessions: [{ routineId: routine.value.id, variantId: routine.value.variants[0]!.id }], goals: [{ exerciseId: exercise.value.id, repetitions: { kind: "range", minimum: 8 as Repetitions, maximum: 10 as Repetitions }, targetWeight: { amount: 105 as WeightAmount, unit: "kg" }, increment: { amount: 5 as WeightAmount, unit: "kg" } }] };
  return { training, draft };
};

describe("program cycles", () => {
  it("creates, starts, skips and reports a flexible program", async () => {
    const { training, draft } = await setup();
    const created = await training.createProgram(draft);
    if (!created.ok) throw new Error("Expected program");
    expect(await training.startProgram(created.value.id)).toMatchObject({ ok: true, value: { status: "active", sessions: [{ week: 1, position: 0, status: "pending" }] } });
    expect(await training.getProgramProgress()).toMatchObject({ ok: true, value: { plannedSessions: 1, completedSessions: 0, adherence: 0 } });
    expect(await training.skipNextProgramSession()).toMatchObject({ ok: true, value: { skippedSessions: 1 } });
  });

  it("captures a baseline, recommends the next load and completes the cycle", async () => {
    const { training, draft } = await setup();
    const created = await training.createProgram(draft);
    if (!created.ok) throw new Error("Expected program");
    await training.startProgram(created.value.id);
    const workout = await training.startNextProgramWorkout();
    if (!workout.ok) throw new Error("Expected workout");
    const set = workout.value.exercises[0]!.sets[0]!;
    await training.completeWorkoutSet({ workoutSetId: set.id, weight: { amount: 100 as WeightAmount, unit: "kg" }, repetitions: 10 as Repetitions });
    expect(await training.finishWorkout()).toMatchObject({ ok: true, value: { status: "completed" } });
    expect(await training.getProgramProgress()).toMatchObject({ ok: true, value: { cycle: { status: "completed", goals: [{ baseline: { amount: 100 }, recommendedWeight: { amount: 105 } }] } } });
    expect(await training.duplicateProgramCycle()).toMatchObject({ ok: true, value: { status: "active" } });
  });

  it("handles unavailable repositories and all goal outcomes", async () => {
    const repo = {
      findProgram: async () => failure({ code: "unavailable" }), listPrograms: async () => failure({ code: "unavailable" }), saveProgram: async () => failure({ code: "unavailable" }), findActiveProgramCycle: async () => failure({ code: "unavailable" }), findLatestProgramCycle: async () => failure({ code: "unavailable" }), findProgramCycle: async () => success(null), saveProgramCycle: async () => failure({ code: "unavailable" }), saveCompletedWorkoutAndProgramCycle: async () => failure({ code: "unavailable" }),
    };
    const service = new ProgramService({ programs: repo, clock: new TestClock(now), ids: { generate: () => "x" } } as never);
    expect(await service.listPrograms()).toMatchObject({ ok: false });
    expect(await service.startProgram("missing" as never)).toMatchObject({ ok: false });
    expect(await service.progress()).toMatchObject({ ok: false });
    expect(await service.skipNext()).toMatchObject({ ok: false });
    expect(await service.startNext()).toMatchObject({ ok: false });
    expect(await service.duplicate()).toMatchObject({ ok: false });
    expect(await service.createProgram({ name: "", weeks: 0, sessions: [], goals: [] })).toMatchObject({ ok: false });
    expect(await service.getProgram("missing" as never)).toMatchObject({ ok: false });
    expect(await service.updateProgram("missing" as never, {})).toMatchObject({ ok: false });
    expect(await service.complete({ programSessionId: "session" } as never)).toMatchObject({ ok: false });
    expect(await service.complete({} as never)).toMatchObject({ ok: true });
    const privateService = service as unknown as { advanceGoal: (goal: never, workout: never) => unknown; asProgress: (cycle: never) => unknown; completeIfFinished: (cycle: never) => unknown; withSessionStatus: (cycle: never, sessionId: never, status: never) => unknown };
    const goal = { exerciseId: "e", repetitions: { kind: "exact", repetitions: 1 }, targetWeight: { amount: 10, unit: "kg" }, increment: { amount: 1, unit: "kg" }, achieved: false };
    expect(privateService.advanceGoal(goal as never, { exercises: [] } as never)).toEqual(goal);
    const workout = (amount: number, repetitions: number) => ({ exercises: [{ exercise: { id: "e" }, sets: [{ status: "completed", type: "normal", weight: { amount, unit: "kg" }, repetitions }] }] });
    expect(privateService.advanceGoal(goal as never, { exercises: [{ exercise: { id: "e" }, sets: [{ status: "completed", type: "normal", weight: { amount: 11, unit: "kg" }, repetitions: 1 }, { status: "completed", type: "normal", weight: { amount: 10, unit: "kg" }, repetitions: 1 }] }] } as never)).toMatchObject({ achieved: true });
    expect(privateService.advanceGoal(goal as never, { exercises: [{ exercise: { id: "e" }, sets: [{ status: "completed", type: "normal", weight: { amount: 10, unit: "kg" }, repetitions: 1 }, { status: "completed", type: "normal", weight: { amount: 11, unit: "kg" }, repetitions: 1 }] }] } as never)).toMatchObject({ achieved: true });
    expect(privateService.advanceGoal({ ...goal, baseline: { amount: 8, unit: "kg" } } as never, workout(10, 1) as never)).toMatchObject({ baseline: { amount: 8 } });
    expect(privateService.advanceGoal({ ...goal, repetitions: { kind: "range", minimum: 1, maximum: 2 }, recommendedWeight: { amount: 7, unit: "kg" } } as never, workout(5, 1) as never)).toMatchObject({ recommendedWeight: { amount: 7 } });
    expect(privateService.asProgress({ sessions: [], goals: [], status: "completed" } as never)).toMatchObject({ adherence: 0 });
    expect(privateService.completeIfFinished({ sessions: [{ status: "skipped" }] } as never)).toMatchObject({ status: "completed" });
    expect(privateService.completeIfFinished({ sessions: [{ status: "started" }] } as never)).toMatchObject({ sessions: [{ status: "started" }] });
    expect(privateService.withSessionStatus({ sessions: [{ id: "first" }, { id: "second" }] } as never, "first" as never, "started" as never)).toMatchObject({ sessions: [{ status: "started" }, { id: "second" }] });
  });

  it("validates program edits and reports all program lifecycle errors", async () => {
    const { training, draft } = await setup();
    const created = await training.createProgram(draft);
    if (!created.ok) throw new Error("Expected program");

    expect(await training.getProgram(created.value.id)).toMatchObject({ ok: true, value: { id: created.value.id } });
    expect(await training.updateProgram({ programId: created.value.id, patch: { name: "Renombrado" } })).toMatchObject({ ok: true, value: { name: "Renombrado" } });
    expect(await training.updateProgram({ programId: created.value.id, patch: { weeks: 0 } })).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(await training.getProgram("missing" as never)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(await training.startProgram("missing" as never)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(await training.startProgram(created.value.id)).toMatchObject({ ok: true });
    expect(await training.startProgram(created.value.id)).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(await training.duplicateProgramCycle()).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("preserves program state when a later persistence operation fails", async () => {
    const { draft } = await setup();
    const sessions = [{ id: "session", routineId: draft.sessions[0]!.routineId, variantId: draft.sessions[0]!.variantId, week: 1, position: 0, status: "pending" }];
    let program = { ...draft, id: "program", createdAt: now, updatedAt: now } as never;
    let active: object | null = { id: "cycle", programId: "program", programName: draft.name, status: "active", startedAt: now, sessions, goals: [] };
    let latest = active;
    let failSaveProgram = false;
    let failSaveCycle = false;
    const repository: ProgramRepository = {
      findProgram: async () => success(program),
      listPrograms: async () => success([program]),
      saveProgram: async (value) => failSaveProgram ? failure({ code: "unavailable" }) : (program = value as never, success(undefined)),
      findActiveProgramCycle: async () => success(active as never),
      findLatestProgramCycle: async () => success(latest as never),
      findProgramCycle: async () => success(null),
      saveProgramCycle: async (value) => failSaveCycle ? failure({ code: "unavailable" }) : (active = value as never, latest = value as never, success(undefined)),
      saveCompletedWorkoutAndProgramCycle: async (_workout, value) => failSaveCycle ? failure({ code: "unavailable" }) : (active = value as never, latest = value as never, success(undefined)),
    };
    const service = new ProgramService({ programs: repository, clock: new TestClock(now), ids: { generate: <Identifier extends EntityId>() => "new" as Identifier } });

    failSaveProgram = true;
    expect(await service.createProgram(draft)).toMatchObject({ ok: false, error: { code: "persistence" } });
    failSaveProgram = false;
    expect(await service.updateProgram("program" as never, { name: "Nuevo" })).toMatchObject({ ok: true });
    failSaveProgram = true;
    expect(await service.updateProgram("program" as never, { name: "Otro" })).toMatchObject({ ok: false, error: { code: "persistence" } });

    active = null as never;
    failSaveCycle = true;
    expect(await service.startProgram("program" as never)).toMatchObject({ ok: false, error: { code: "persistence" } });
    active = { ...(latest as object), sessions };
    expect(await service.skipNext()).toMatchObject({ ok: false, error: { code: "persistence" } });
    expect(await service.startNext()).toMatchObject({ ok: false, error: { code: "persistence" } });
    active = { ...(active as object), sessions: [{ ...sessions[0], status: "started" }] };
    expect(await service.complete({ programSessionId: "session", exercises: [] } as never)).toMatchObject({ ok: false, error: { code: "persistence" } });

    failSaveCycle = false;
    active = null;
    expect(await service.skipNext()).toMatchObject({ ok: false, error: { code: "not_found" } });
    active = { ...(latest as object), sessions: [{ ...sessions[0], status: "started" }] };
    expect(await service.skipNext()).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(await service.startNext()).toMatchObject({ ok: false, error: { code: "validation" } });
    active = { ...(active as object), sessions: [{ ...sessions[0], status: "started" }] };
    expect(await service.complete({ programSessionId: "other", exercises: [] } as never)).toMatchObject({ ok: false, error: { code: "not_found" } });
    active = { ...(active as object), sessions: [{ ...sessions[0], status: "started" }] };
    expect(await service.complete({ programSessionId: "session", exercises: [] } as never)).toMatchObject({ ok: true });
    active = { ...(active as object), sessions: [{ ...sessions[0], status: "started" }] };
    expect(await service.release("session" as never)).toMatchObject({ ok: true });
    active = { ...(active as object), sessions: [{ ...sessions[0], status: "started" }] };
    failSaveCycle = true;
    expect(await service.release("session" as never)).toMatchObject({ ok: false, error: { code: "persistence" } });
    expect(await service.saveCompletion({} as never, active as never)).toMatchObject({ ok: false, error: { code: "persistence" } });
    failSaveCycle = false;
    expect(await service.saveCompletion({} as never, active as never)).toMatchObject({ ok: true });
    active = { ...(active as object), sessions: [{ ...sessions[0], status: "pending" }] };
    expect(await service.release("session" as never)).toMatchObject({ ok: false, error: { code: "not_found" } });
    active = null as never;
    expect(await service.release("session" as never)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(await service.progress()).toMatchObject({ ok: true, value: { cycle: { status: "completed" } } });
    latest = null as never;
    expect(await service.progress()).toMatchObject({ ok: true, value: null });
  });

  it("does not start a workout when the program cannot provide a next session", async () => {
    const environment = createTrainingEnvironment(new TestClock(now));
    const programs: ProgramRepository = {
      findProgram: async () => success(null),
      listPrograms: async () => success([]),
      saveProgram: async () => success(undefined),
      findActiveProgramCycle: async () => failure({ code: "unavailable" }),
      findLatestProgramCycle: async () => success(null),
      findProgramCycle: async () => success(null),
      saveProgramCycle: async () => success(undefined),
      saveCompletedWorkoutAndProgramCycle: async () => success(undefined),
    };
    const training = new TrainingOrchestrator({ ...environment, programs });
    expect(await training.startNextProgramWorkout()).toMatchObject({ ok: false, error: { code: "persistence" } });
  });

  it("releases a planned session if creating its workout fails", async () => {
    const { training, draft } = await setup();
    const program = await training.createProgram(draft);
    if (!program.ok) throw new Error("Expected program");
    await training.startProgram(program.value.id);
    await training.startWorkout({ source: "empty" });
    expect(await training.startNextProgramWorkout()).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(await training.getProgramProgress()).toMatchObject({ ok: true, value: { nextSession: { status: "pending" } } });
  });

  it("returns the program persistence error after completing a linked workout", async () => {
    const environment = createTrainingEnvironment(new TestClock(now));
    const programs: ProgramRepository = {
      findProgram: async () => success(null),
      listPrograms: async () => success([]),
      saveProgram: async () => success(undefined),
      findActiveProgramCycle: async () => failure({ code: "unavailable" }),
      findLatestProgramCycle: async () => success(null),
      findProgramCycle: async () => success(null),
      saveProgramCycle: async () => success(undefined),
      saveCompletedWorkoutAndProgramCycle: async () => success(undefined),
    };
    const training = new TrainingOrchestrator({ ...environment, programs });
    const exercise = await training.createExercise({ name: "Press", primaryMuscles: ["chest"], defaultRestSeconds: 60 as Seconds });
    if (!exercise.ok) throw new Error("Expected exercise");
    const routine = await training.createRoutine({ name: "A", variants: [{ name: "Gym", exercises: [{ exerciseId: exercise.value.id, sets: [{ type: "normal", repetitions: { kind: "exact", repetitions: 1 as Repetitions } }], laterality: "bilateral" }] }] });
    if (!routine.ok) throw new Error("Expected routine");
    const started = await training.startWorkout({ source: "routine", routineId: routine.value.id, variantId: routine.value.variants[0]!.id, programSessionId: "session" as never });
    if (!started.ok) throw new Error("Expected workout");
    expect(await training.finishWorkout()).toMatchObject({ ok: false, error: { code: "persistence" } });
  });

  it("keeps a linked workout active when its atomic program write fails", async () => {
    const environment = createTrainingEnvironment(new TestClock(now));
    const activeCycle = { id: "cycle", programId: "program", programName: "Programa", status: "active", startedAt: now, sessions: [{ id: "session", routineId: "routine", variantId: "variant", week: 1, position: 0, status: "started" }], goals: [] } as never;
    const programs: ProgramRepository = {
      findProgram: async () => success(null), listPrograms: async () => success([]), saveProgram: async () => success(undefined), findActiveProgramCycle: async () => success(activeCycle), findLatestProgramCycle: async () => success(activeCycle), findProgramCycle: async () => success(null), saveProgramCycle: async () => success(undefined), saveCompletedWorkoutAndProgramCycle: async () => failure({ code: "unavailable" }),
    };
    const training = new TrainingOrchestrator({ ...environment, programs });
    const exercise = await training.createExercise({ name: "Press", primaryMuscles: ["chest"], defaultRestSeconds: 60 as Seconds });
    if (!exercise.ok) throw new Error("Expected exercise");
    const routine = await training.createRoutine({ name: "A", variants: [{ name: "Gym", exercises: [{ exerciseId: exercise.value.id, sets: [{ type: "normal", repetitions: { kind: "exact", repetitions: 1 as Repetitions } }], laterality: "bilateral" }] }] });
    if (!routine.ok) throw new Error("Expected routine");
    await training.startWorkout({ source: "routine", routineId: routine.value.id, variantId: routine.value.variants[0]!.id, programSessionId: "session" as never });
    expect(await training.finishWorkout()).toMatchObject({ ok: false, error: { code: "persistence" } });
    expect(await training.getActiveWorkout()).toMatchObject({ ok: true, value: { status: "active" } });
  });

  it("returns the original workout failure when releasing a program session also fails", async () => {
    const environment = createTrainingEnvironment(new TestClock(now));
    const cycle = { id: "cycle", programId: "program", programName: "Programa", status: "active", startedAt: now, sessions: [{ id: "session", routineId: "missing", variantId: "missing", week: 1, position: 0, status: "pending" }], goals: [] } as never;
    let saves = 0;
    const programs: ProgramRepository = {
      findProgram: async () => success(null), listPrograms: async () => success([]), saveProgram: async () => success(undefined), findActiveProgramCycle: async () => success(cycle), findLatestProgramCycle: async () => success(cycle), findProgramCycle: async () => success(null), saveProgramCycle: async () => (++saves === 1 ? success(undefined) : failure({ code: "unavailable" })), saveCompletedWorkoutAndProgramCycle: async () => success(undefined),
    };
    const training = new TrainingOrchestrator({ ...environment, programs });
    expect(await training.startNextProgramWorkout()).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});
