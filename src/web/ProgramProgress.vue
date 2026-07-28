<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { Program, ProgramProgress, Routine, RoutineId, RoutineVariantId, TrainingOrchestrator } from "../core";

interface PlannedDay {
  readonly routineId: RoutineId;
  readonly variantId: RoutineVariantId;
}

const props = defineProps<{ readonly training: TrainingOrchestrator }>();
const emit = defineEmits<{ readonly started: [workout: import("../core").ActiveWorkoutSession] }>();
const programs = ref<readonly Program[]>([]);
const routines = ref<readonly Routine[]>([]);
const progress = ref<ProgramProgress | null>(null);
const error = ref<string | null>(null);
const programName = ref("");
const weeks = ref(8);
const plannedDays = ref<readonly PlannedDay[]>([]);

const routineFor = (routineId: RoutineId): Routine | undefined =>
  routines.value.find((routine) => routine.id === routineId);

const addDay = (): void => {
  const routine = routines.value[0];
  const variant = routine?.variants[0];
  if (routine === undefined || variant === undefined) return;
  plannedDays.value = [...plannedDays.value, { routineId: routine.id, variantId: variant.id }];
};

const changeDayRoutine = (index: number, routineId: RoutineId): void => {
  const variant = routineFor(routineId)?.variants[0];
  if (variant === undefined) return;
  plannedDays.value = plannedDays.value.map((day, position) =>
    position === index ? { routineId, variantId: variant.id } : day,
  );
};

const changeDayVariant = (index: number, variantId: RoutineVariantId): void => {
  plannedDays.value = plannedDays.value.map((day, position) =>
    position === index ? { ...day, variantId } : day,
  );
};

const removeDay = (index: number): void => {
  if (plannedDays.value.length === 1) return;
  plannedDays.value = plannedDays.value.filter((_, position) => position !== index);
};

const load = async (): Promise<void> => {
  const [listed, current, available] = await Promise.all([
    props.training.listPrograms(),
    props.training.getProgramProgress(),
    props.training.listRoutines({ status: "active" }),
  ]);
  if (!listed.ok || !current.ok || !available.ok) {
    error.value = "No se pudieron leer los programas locales.";
    return;
  }
  const details = await Promise.all(available.value.map((routine) => props.training.getRoutine(routine.id)));
  if (details.some((routine) => !routine.ok)) {
    error.value = "No se pudieron abrir las rutinas locales.";
    return;
  }
  programs.value = listed.value;
  progress.value = current.value;
  routines.value = details.filter((routine): routine is { readonly ok: true; readonly value: Routine } => routine.ok).map((routine) => routine.value);
  if (plannedDays.value.length === 0) addDay();
};

const start = async (id: Program["id"]): Promise<void> => {
  const result = await props.training.startProgram(id);
  if (!result.ok) {
    error.value = "No se pudo iniciar el programa.";
    return;
  }
  await load();
};

const next = async (): Promise<void> => {
  const result = await props.training.startNextProgramWorkout();
  if (!result.ok) {
    error.value = "No se pudo iniciar la próxima sesión.";
    return;
  }
  emit("started", result.value);
};

const skip = async (): Promise<void> => {
  const result = await props.training.skipNextProgramSession();
  if (!result.ok) error.value = "No se pudo omitir la sesión.";
  else progress.value = result.value;
};

const abandon = async (): Promise<void> => {
  const result = await props.training.abandonProgramCycle();
  if (!result.ok) {
    error.value = "Finaliza o descarta la sesión en curso antes de cambiar de programa.";
    return;
  }
  await load();
};

const duplicate = async (): Promise<void> => {
  const result = await props.training.duplicateProgramCycle();
  if (!result.ok) {
    error.value = "No se pudo repetir el ciclo.";
    return;
  }
  await load();
};

const create = async (): Promise<void> => {
  const result = await props.training.createProgram({
    name: programName.value,
    weeks: weeks.value,
    sessions: plannedDays.value,
    goals: [],
  });
  if (!result.ok) {
    error.value = "Revisa el nombre, las semanas y los días del programa.";
    return;
  }
  programName.value = "";
  plannedDays.value = [];
  await load();
};

onMounted(() => { void load(); });
</script>

<template>
  <section aria-labelledby="program-title">
    <header><p class="eyebrow">Plan local</p><h2 id="program-title">Programa</h2></header>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>

    <template v-if="progress">
      <p>{{ progress.cycle.programName }} · {{ progress.completedSessions }}/{{ progress.plannedSessions }} sesiones · adherencia {{ Math.round(progress.adherence * 100) }}%</p>
      <p v-if="progress.nextSession">Semana {{ progress.nextSession.week }}, sesión {{ progress.nextSession.position + 1 }}</p>
      <p v-else-if="progress.cycle.status === 'abandoned'">Ciclo abandonado. Puedes iniciar otro programa sin perder el historial registrado.</p>
      <p v-else>Informe final · {{ progress.cycle.goals.filter((goal) => goal.achieved).length }}/{{ progress.cycle.goals.length }} metas alcanzadas.</p>
      <div v-if="progress.nextSession" class="inline-actions">
        <button type="button" @click="next">Iniciar próxima sesión</button>
        <button type="button" class="secondary-action" @click="skip">Omitir sesión</button>
        <button type="button" class="secondary-action" @click="abandon">Cambiar programa</button>
      </div>
      <button v-if="!progress.nextSession && progress.cycle.status === 'completed'" type="button" @click="duplicate">Repetir ciclo</button>
      <ul class="card-list">
        <li v-for="goal in progress.cycle.goals" :key="goal.exerciseId">
          <strong>{{ goal.exerciseId }}</strong><span>{{ goal.achieved ? "Meta alcanzada" : "En progreso" }}</span>
          <span v-if="goal.recommendedWeight">Siguiente: {{ goal.recommendedWeight.amount }} {{ goal.recommendedWeight.unit }}</span>
        </li>
      </ul>
    </template>

    <template v-else><p class="empty-state">Elige un programa para ordenar tu próxima rutina y medir adherencia.</p></template>

    <template v-if="!progress || !progress.nextSession">
      <ul class="card-list">
        <li v-for="program in programs" :key="program.id">
          <strong>{{ program.name }}</strong><span>{{ program.weeks }} semanas · {{ program.sessions.length }} días por semana</span>
          <div style="margin-top: 0.5rem">
            <h4 class="eyebrow" style="margin-bottom: 0.5rem">Rutinas</h4>
            <ul class="history-sets">
              <li v-for="(session, index) in program.sessions" :key="index">
                <span>Día {{ index + 1 }}</span>
                <strong>{{ routineFor(session.routineId)?.name ?? "Rutina desconocida" }}</strong>
              </li>
            </ul>
          </div>
          <button type="button" @click="start(program.id)" style="margin-top: 0.5rem">Iniciar programa</button>
        </li>
      </ul>

      <form class="editor-card" @submit.prevent="create">
        <header><p class="eyebrow">Programa propio</p><h3>Diseña tu semana</h3><p>Agrega un día por cada sesión que quieras repetir cada semana.</p></header>
        <label class="field">Nombre <input v-model="programName" required /></label>
        <label class="field">Duración <input v-model.number="weeks" type="number" min="1" required /></label>
        <fieldset v-for="(day, index) in plannedDays" :key="index" class="editor-card">
          <legend>Día {{ index + 1 }}</legend>
          <label class="field">Rutina
            <select :value="day.routineId" @change="changeDayRoutine(index, ($event.target as HTMLSelectElement).value as RoutineId)">
              <option v-for="routine in routines" :key="routine.id" :value="routine.id">{{ routine.name }}</option>
            </select>
          </label>
          <label class="field">Equipo
            <select :value="day.variantId" @change="changeDayVariant(index, ($event.target as HTMLSelectElement).value as RoutineVariantId)">
              <option v-for="variant in routineFor(day.routineId)?.variants" :key="variant.id" :value="variant.id">{{ variant.name }}</option>
            </select>
          </label>
          <button type="button" class="secondary-action" :disabled="plannedDays.length === 1" @click="removeDay(index)">Quitar día</button>
        </fieldset>
        <button type="button" class="secondary-action" @click="addDay">Añadir otro día</button>
        <button type="submit" :disabled="plannedDays.length === 0">Crear programa propio</button>
      </form>
    </template>
  </section>
</template>
