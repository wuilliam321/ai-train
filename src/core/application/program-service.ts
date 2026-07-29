import type { CompletedWorkoutSession, WorkoutSet } from "../domain/workout";
import type { Program, ProgramCycle, ProgramDraft, ProgramGoalProgress, ProgramPatch, ProgramProgress } from "../domain/program";
import type { ProgramCycleId, ProgramId, ProgramSessionId, Weight } from "../domain/primitives";
import type { ProgramRepository } from "../ports";
import type { TrainingOrchestratorDependencies } from "./dependencies";
import type { ApplicationError } from "./result";
import type { ApplicationResult } from "./contracts";
import { failure, success } from "./result";

const applicationError = (
  code: ApplicationError["code"],
  field?: string,
): ApplicationError => ({
  code,
  ...(field === undefined ? {} : { details: { field } }),
});

const isPersisted = <Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: { readonly code: string } },
): result is { readonly ok: true; readonly value: Value } => result.ok;

const sameUnit = (left: Weight, right: Weight): boolean => left.unit === right.unit;

const validDraft = (draft: ProgramDraft): boolean =>
  draft.name.trim().length > 0 &&
  Number.isInteger(draft.weeks) &&
  draft.weeks >= 1 &&
  draft.sessions.length > 0 &&
  draft.goals.every((goal) =>
    sameUnit(goal.targetWeight, goal.increment) &&
    goal.targetWeight.amount > 0 &&
    goal.increment.amount > 0,
  );

export class ProgramService {
  private readonly programs: ProgramRepository;
  private readonly clock: TrainingOrchestratorDependencies["clock"];
  private readonly ids: TrainingOrchestratorDependencies["ids"];

  constructor(dependencies: Pick<TrainingOrchestratorDependencies, "programs" | "clock" | "ids">) {
    this.programs = dependencies.programs;
    this.clock = dependencies.clock;
    this.ids = dependencies.ids;
  }

  async createProgram(draft: ProgramDraft): ApplicationResult<Program> {
    if (!validDraft(draft)) {
      return failure(applicationError("validation", "program"));
    }

    const now = this.clock.now();
    const program: Program = {
      ...draft,
      id: this.ids.generate<ProgramId>(),
      createdAt: now,
      updatedAt: now,
    };
    const saved = await this.programs.saveProgram(program);
    return isPersisted(saved) ? success(program) : failure(applicationError("persistence"));
  }

  async getProgram(programId: ProgramId): ApplicationResult<Program> {
    const found = await this.programs.findProgram(programId);

    if (!isPersisted(found)) {
      return failure(applicationError("persistence"));
    }

    return found.value === null
      ? failure(applicationError("not_found", "programId"))
      : success(found.value);
  }

  async updateProgram(programId: ProgramId, patch: ProgramPatch): ApplicationResult<Program> {
    const found = await this.getProgram(programId);

    if (!found.ok) {
      return found;
    }

    const draft: ProgramDraft = { ...found.value, ...patch };

    if (!validDraft(draft)) {
      return failure(applicationError("validation", "program"));
    }

    const program: Program = { ...found.value, ...draft, updatedAt: this.clock.now() };
    const saved = await this.programs.saveProgram(program);
    return isPersisted(saved) ? success(program) : failure(applicationError("persistence"));
  }

  async listPrograms(): ApplicationResult<readonly Program[]> {
    const listed = await this.programs.listPrograms();
    return isPersisted(listed) ? success(listed.value) : failure(applicationError("persistence"));
  }

  async startProgram(programId: ProgramId): ApplicationResult<ProgramCycle> {
    const active = await this.programs.findActiveProgramCycle();

    if (!isPersisted(active)) {
      return failure(applicationError("persistence"));
    }

    if (active.value !== null) {
      return failure(applicationError("conflict", "programCycle"));
    }

    const found = await this.getProgram(programId);

    if (!found.ok) {
      return found;
    }

    const cycle = this.createCycle(found.value);
    const saved = await this.programs.saveProgramCycle(cycle);
    return isPersisted(saved) ? success(cycle) : failure(applicationError("persistence"));
  }

  async progress(): ApplicationResult<ProgramProgress | null> {
    const latest = await this.programs.findLatestProgramCycle();
    return isPersisted(latest)
      ? success(latest.value === null ? null : this.asProgress(latest.value))
      : failure(applicationError("persistence"));
  }

  async abandon(): ApplicationResult<void> {
    const cycle = await this.activeCycle();
    if (!cycle.ok) return cycle;
    const saved = await this.programs.saveProgramCycle({
      ...cycle.value,
      status: "abandoned",
      abandonedAt: this.clock.now(),
    });
    return isPersisted(saved) ? success(undefined) : failure(applicationError("persistence"));
  }

  async skipNext(): ApplicationResult<ProgramProgress> {
    const cycle = await this.activeCycle();

    if (!cycle.ok) {
      return cycle;
    }

    const next = cycle.value.sessions.find((session) => session.status === "pending");

    if (next === undefined) {
      return failure(applicationError("validation", "nextSession"));
    }

    const updated = this.withSessionStatus(cycle.value, next.id, "skipped");
    const complete = this.completeIfFinished(updated);
    const saved = await this.programs.saveProgramCycle(complete);
    return isPersisted(saved) ? success(this.asProgress(complete)) : failure(applicationError("persistence"));
  }

  async startNext(sessionId?: ProgramSessionId): ApplicationResult<{ readonly routineId: string; readonly variantId: string; readonly programSessionId: ProgramSessionId }> {
    const cycle = await this.activeCycle();

    if (!cycle.ok) {
      return cycle;
    }

    const next = sessionId === undefined
      ? cycle.value.sessions.find((session) => session.status === "pending")
      : cycle.value.sessions.find((session) => session.id === sessionId);

    if (next === undefined || next.status !== "pending") {
      return failure(applicationError("validation", "nextSession"));
    }

    const saved = await this.programs.saveProgramCycle(this.withSessionStatus(cycle.value, next.id, "started"));
    return isPersisted(saved)
      ? success({ routineId: next.routineId, variantId: next.variantId, programSessionId: next.id })
      : failure(applicationError("persistence"));
  }

  async complete(workout: CompletedWorkoutSession): Promise<ApplicationResult<void>> {
    const completed = await this.completionCycle(workout);
    if (!completed.ok || completed.value === null) return completed.ok ? success(undefined) : completed;
    const saved = await this.programs.saveProgramCycle(completed.value);
    return isPersisted(saved) ? success(undefined) : failure(applicationError("persistence"));
  }

  async completionCycle(workout: CompletedWorkoutSession): Promise<ApplicationResult<ProgramCycle | null>> {
    if (workout.programSessionId === undefined) {
      return success(null);
    }

    const cycle = await this.activeCycle();

    if (!cycle.ok) {
      return cycle;
    }

    const session = cycle.value.sessions.find((candidate) => candidate.id === workout.programSessionId);

    if (session === undefined || session.status !== "started") {
      return failure(applicationError("not_found", "programSessionId"));
    }

    const completed = this.completeIfFinished({
      ...this.withSessionStatus(cycle.value, session.id, "completed"),
      goals: cycle.value.goals.map((goal) => this.advanceGoal(goal, workout)),
    });
    return success(completed);
  }

  async release(sessionId: ProgramSessionId): ApplicationResult<void> {
    const cycle = await this.activeCycle();
    if (!cycle.ok) return cycle;
    const session = cycle.value.sessions.find((candidate) => candidate.id === sessionId);
    if (session === undefined || session.status !== "started") return failure(applicationError("not_found", "programSessionId"));
    const saved = await this.programs.saveProgramCycle(this.withSessionStatus(cycle.value, sessionId, "pending"));
    return isPersisted(saved) ? success(undefined) : failure(applicationError("persistence"));
  }

  async saveCompletion(workout: CompletedWorkoutSession, cycle: ProgramCycle): ApplicationResult<void> {
    const saved = await this.programs.saveCompletedWorkoutAndProgramCycle(workout, cycle);
    return isPersisted(saved) ? success(undefined) : failure(applicationError("persistence"));
  }

  async duplicate(): ApplicationResult<ProgramCycle> {
    const latest = await this.programs.findLatestProgramCycle();

    if (!isPersisted(latest)) {
      return failure(applicationError("persistence"));
    }

    if (latest.value === null || latest.value.status !== "completed") {
      return failure(applicationError("not_found", "programCycle"));
    }

    return this.startProgram(latest.value.programId);
  }

  private createCycle(program: Program): ProgramCycle {
    const sessions = Array.from({ length: program.weeks }, (_, week) =>
      program.sessions.map((session, position) => ({
        ...session,
        id: this.ids.generate<ProgramSessionId>(),
        week: week + 1,
        position,
        status: "pending" as const,
      })),
    ).flat();

    return {
      id: this.ids.generate<ProgramCycleId>(),
      programId: program.id,
      programName: program.name,
      status: "active",
      startedAt: this.clock.now(),
      sessions,
      goals: program.goals.map((goal) => ({ ...goal, achieved: false })),
    };
  }

  private async activeCycle(): ApplicationResult<ProgramCycle> {
    const cycle = await this.programs.findActiveProgramCycle();

    if (!isPersisted(cycle)) {
      return failure(applicationError("persistence"));
    }

    return cycle.value === null
      ? failure(applicationError("not_found", "programCycle"))
      : success(cycle.value);
  }

  private withSessionStatus(cycle: ProgramCycle, sessionId: ProgramSessionId, status: "pending" | "started" | "completed" | "skipped"): ProgramCycle {
    return {
      ...cycle,
      sessions: cycle.sessions.map((session) => session.id === sessionId ? { ...session, status } : session),
    };
  }

  private completeIfFinished(cycle: ProgramCycle): ProgramCycle {
    const finished = cycle.sessions.every((session) =>
      session.status === "completed" || session.status === "skipped",
    );

    return finished
      ? { ...cycle, status: "completed", completedAt: this.clock.now() }
      : cycle;
  }

  private advanceGoal(goal: ProgramGoalProgress, workout: CompletedWorkoutSession): ProgramGoalProgress {
    const sets = workout.exercises
      .filter((exercise) => exercise.exercise.id === goal.exerciseId)
      .flatMap((exercise) => exercise.sets.filter((set): set is Extract<WorkoutSet, { readonly status: "completed" }> =>
        set.status === "completed" && set.type === "normal",
      ));

    if (sets.length === 0) {
      return goal;
    }

    const best = sets.reduce((winner, set) => set.weight.amount > winner.weight.amount ? set : winner);
    const baseline = goal.baseline ?? best.weight;
    const maximum = goal.repetitions.kind === "exact"
      ? goal.repetitions.repetitions
      : goal.repetitions.maximum;
    const allAtMaximum = sets.every((set) =>
      set.repetitions >= maximum &&
      set.weight.unit === baseline.unit &&
      set.weight.amount >= baseline.amount,
    );
    const achieved = sets.every((set) =>
      set.repetitions >= maximum &&
      set.weight.unit === goal.targetWeight.unit &&
      set.weight.amount >= goal.targetWeight.amount,
    );
    const recommendedWeight = achieved || !allAtMaximum
      ? goal.recommendedWeight
      : {
          amount: Math.min(baseline.amount + goal.increment.amount, goal.targetWeight.amount) as Weight["amount"],
          unit: baseline.unit,
        };

    return {
      ...goal,
      ...(goal.baseline === undefined ? { baseline } : {}),
      achieved: goal.achieved || achieved,
      ...(recommendedWeight === undefined ? {} : { recommendedWeight }),
    };
  }

  private asProgress(cycle: ProgramCycle): ProgramProgress {
    const completedSessions = cycle.sessions.filter((session) => session.status === "completed").length;
    const skippedSessions = cycle.sessions.filter((session) => session.status === "skipped").length;
    const nextSession = cycle.status === "active"
      ? cycle.sessions.find((session) => session.status === "pending")
      : undefined;

    return {
      cycle,
      completedSessions,
      skippedSessions,
      plannedSessions: cycle.sessions.length,
      adherence: cycle.sessions.length === 0 ? 0 : completedSessions / cycle.sessions.length,
      ...(nextSession === undefined ? {} : { nextSession }),
    };
  }
}
