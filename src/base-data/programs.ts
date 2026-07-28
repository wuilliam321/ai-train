import type { ProgramDraft, Routine } from "../core";

const names = {
  lower: "Lower Body Squat and Lunge",
  posterior: "Lower Body Posterior Chain",
  backChest: "Back and Chest Strength",
  backBiceps: "Back and Biceps Foundation",
  shoulders: "Shoulders and Triceps Foundation",
} as const;

const draft = (name: string, routineNames: readonly string[], routines: readonly Routine[]): ProgramDraft | null => {
  const sessions = routineNames.map((routineName) => {
    const routine = routines.find((candidate) => candidate.name === routineName);
    const variant = routine?.variants.find((candidate) => candidate.name === "Gym") ?? routine?.variants[0];
    return routine === undefined || variant === undefined ? null : { routineId: routine.id, variantId: variant.id };
  });
  return sessions.some((session) => session === null) ? null : { name, weeks: 8, sessions: sessions as NonNullable<typeof sessions[number]>[], goals: [] };
};

export const resolveBasePrograms = (routines: readonly Routine[]): readonly ProgramDraft[] => [
  draft("Base 3 días", [names.lower, names.backChest, names.shoulders], routines),
  draft("Base 4 días", [names.lower, names.posterior, names.backChest, names.shoulders], routines),
  draft("Base 5 días", [names.lower, names.posterior, names.backBiceps, names.backChest, names.shoulders], routines),
].filter((program): program is ProgramDraft => program !== null);
