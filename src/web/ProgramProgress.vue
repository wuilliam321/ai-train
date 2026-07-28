<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { Program, ProgramProgress, Routine, RoutineSummary, RoutineVariantId, TrainingOrchestrator } from "../core";

const props = defineProps<{ readonly training: TrainingOrchestrator }>();
const emit = defineEmits<{ readonly started: [workout: import("../core").ActiveWorkoutSession] }>();
const programs = ref<readonly Program[]>([]);
const routines = ref<readonly RoutineSummary[]>([]);
const progress = ref<ProgramProgress | null>(null);
const error = ref<string | null>(null);
const programName = ref("");
const weeks = ref(8);
const routineId = ref<string>("");
const selectedRoutine = ref<Routine | null>(null);
const variantId = ref<RoutineVariantId | null>(null);

const load = async (): Promise<void> => {
  const [listed, active, availableRoutines] = await Promise.all([props.training.listPrograms(), props.training.getProgramProgress(), props.training.listRoutines({ status: "active" })]);
  if (!listed.ok || !active.ok || !availableRoutines.ok) { error.value = "No se pudieron leer los programas locales."; return; }
  programs.value = listed.value; progress.value = active.value; routines.value = availableRoutines.value;
  if (routineId.value === "") routineId.value = routines.value[0]?.id ?? "";
};
const start = async (id: Program["id"]): Promise<void> => { const result = await props.training.startProgram(id); if (!result.ok) { error.value = "No se pudo iniciar el programa."; return; } await load(); };
const next = async (): Promise<void> => {
  const result = await props.training.startNextProgramWorkout();
  if (!result.ok) {
    error.value = "No se pudo iniciar la próxima sesión.";
    return;
  }
  emit("started", result.value);
};
const skip = async (): Promise<void> => { const result = await props.training.skipNextProgramSession(); if (!result.ok) error.value = "No se pudo omitir la sesión."; else progress.value = result.value; };
const duplicate = async (): Promise<void> => { const result = await props.training.duplicateProgramCycle(); if (!result.ok) { error.value = "No se pudo repetir el ciclo."; return; } await load(); };
const selectRoutine = async (): Promise<void> => {
  const result = await props.training.getRoutine(routineId.value as import("../core").RoutineId);
  if (!result.ok) { error.value = "No se pudo abrir la rutina."; return; }
  selectedRoutine.value = result.value;
  variantId.value = result.value.variants[0]?.id ?? null;
};
const create = async (): Promise<void> => {
  if (selectedRoutine.value === null || selectedRoutine.value.id !== routineId.value || variantId.value === null) await selectRoutine();
  if (selectedRoutine.value === null || variantId.value === null) return;
  const result = await props.training.createProgram({ name: programName.value, weeks: weeks.value, sessions: [{ routineId: selectedRoutine.value.id, variantId: variantId.value }], goals: [] });
  if (!result.ok) { error.value = "No se pudo crear el programa."; return; }
  programName.value = "";
  await load();
};
onMounted(() => { void load(); });
</script>
<template>
  <section aria-labelledby="program-title"><header><p class="eyebrow">Plan local</p><h2 id="program-title">Programa</h2></header>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>
    <template v-if="progress"><p>{{ progress.cycle.programName }} · {{ progress.completedSessions }}/{{ progress.plannedSessions }} sesiones · adherencia {{ Math.round(progress.adherence * 100) }}%</p><p v-if="progress.nextSession">Semana {{ progress.nextSession.week }}, sesión {{ progress.nextSession.position + 1 }}</p><p v-else>Informe final · {{ progress.cycle.goals.filter((goal) => goal.achieved).length }}/{{ progress.cycle.goals.length }} metas alcanzadas.</p><button v-if="progress.nextSession" type="button" @click="next">Iniciar próxima sesión</button><button v-if="progress.nextSession" type="button" class="secondary-action" @click="skip">Omitir sesión</button><button v-else type="button" @click="duplicate">Repetir ciclo</button><ul class="card-list"><li v-for="goal in progress.cycle.goals" :key="goal.exerciseId"><strong>{{ goal.exerciseId }}</strong><span>{{ goal.achieved ? "Meta alcanzada" : "En progreso" }}</span><span v-if="goal.recommendedWeight">Siguiente: {{ goal.recommendedWeight.amount }} {{ goal.recommendedWeight.unit }}</span></li></ul></template>
    <template v-else><p class="empty-state">Elige un programa para ordenar tu próxima rutina y medir adherencia.</p><ul class="card-list"><li v-for="program in programs" :key="program.id"><strong>{{ program.name }}</strong><span>{{ program.weeks }} semanas · {{ program.sessions.length }} días por semana</span><button type="button" @click="start(program.id)">Iniciar programa</button></li></ul><form class="field" @submit.prevent="create"><label>Nombre <input v-model="programName" required /></label><label>Semanas <input v-model.number="weeks" type="number" min="1" required /></label><label>Rutina <select v-model="routineId" required @change="selectRoutine"><option v-for="routine in routines" :key="routine.id" :value="routine.id">{{ routine.name }}</option></select></label><label v-if="selectedRoutine">Equipo <select v-model="variantId"><option v-for="variant in selectedRoutine.variants" :key="variant.id" :value="variant.id">{{ variant.name }}</option></select></label><button type="submit">Crear programa propio</button></form></template>
  </section>
</template>
