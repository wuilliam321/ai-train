import type { ExerciseId } from "./primitives";
import type { ISODateTime, ProgramCycleId, ProgramId, ProgramSessionId, RoutineId, RoutineVariantId, Weight } from "./primitives";
import type { RepetitionTarget } from "./routine";

export interface ProgramSessionDraft { readonly routineId: RoutineId; readonly variantId: RoutineVariantId; }
export interface ProgramGoalDraft { readonly exerciseId: ExerciseId; readonly repetitions: RepetitionTarget; readonly targetWeight: Weight; readonly increment: Weight; }
export interface ProgramDraft { readonly name: string; readonly weeks: number; readonly sessions: readonly ProgramSessionDraft[]; readonly goals: readonly ProgramGoalDraft[]; }
export type ProgramPatch = Partial<ProgramDraft>;
export interface Program extends ProgramDraft { readonly id: ProgramId; readonly createdAt: ISODateTime; readonly updatedAt: ISODateTime; }
export type ProgramSessionStatus = "pending" | "started" | "completed" | "skipped";
export interface ProgramCycleSession extends ProgramSessionDraft { readonly id: ProgramSessionId; readonly week: number; readonly position: number; readonly status: ProgramSessionStatus; }
export interface ProgramGoalProgress extends ProgramGoalDraft { readonly baseline?: Weight; readonly recommendedWeight?: Weight; readonly achieved: boolean; }
export type ProgramCycleStatus = "active" | "completed" | "abandoned";
export interface ProgramCycle { readonly id: ProgramCycleId; readonly programId: ProgramId; readonly programName: string; readonly status: ProgramCycleStatus; readonly startedAt: ISODateTime; readonly completedAt?: ISODateTime; readonly abandonedAt?: ISODateTime; readonly sessions: readonly ProgramCycleSession[]; readonly goals: readonly ProgramGoalProgress[]; }
export interface ProgramProgress { readonly cycle: ProgramCycle; readonly completedSessions: number; readonly skippedSessions: number; readonly plannedSessions: number; readonly adherence: number; readonly nextSession?: ProgramCycleSession; }
