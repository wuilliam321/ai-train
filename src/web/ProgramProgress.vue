<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { ActiveWorkoutSession, Exercise, ISODateTime, Program, ProgramCycleSession, ProgramProgress, ProgramSessionId, Routine, RoutineId, RoutineVariantId, TrainingOrchestrator, WorkoutSummary } from "../core";

interface PlannedDay {
  readonly routineId: RoutineId;
  readonly variantId: RoutineVariantId;
}

const props = defineProps<{
  readonly training: TrainingOrchestrator;
  readonly workout: ActiveWorkoutSession | null;
  readonly compact: boolean;
}>();
const emit = defineEmits<{
  readonly started: [workout: import("../core").ActiveWorkoutSession];
  readonly continueWorkout: [sessionId?: ProgramSessionId];
  readonly editRoutine: [routineId: RoutineId];
}>();
const programs = ref<readonly Program[]>([]);
const routines = ref<readonly Routine[]>([]);
const exercises = ref<readonly Exercise[]>([]);
const progress = ref<ProgramProgress | null>(null);
const error = ref<string | null>(null);
const programName = ref("");
const weeks = ref(8);
const plannedDays = ref<readonly PlannedDay[]>([]);
const selectedSessionId = ref<string | null>(null);
const selectedWeek = ref<number | null>(null);
const lastWorkout = ref<WorkoutSummary | null>(null);
const busy = ref(false);
const loading = ref(true);

const routineFor = (routineId: RoutineId): Routine | undefined =>
  routines.value.find((routine) => routine.id === routineId);

const routineName = (routineId: RoutineId): string => routineFor(routineId)?.name ?? "Rutina no disponible";

const selectedSession = computed(() => progress.value?.cycle.sessions.find((session) => session.id === selectedSessionId.value));

const selectedVariant = computed(() => {
  const session = selectedSession.value;
  return session === undefined ? undefined : routineFor(session.routineId)?.variants.find((variant) => variant.id === session.variantId);
});

const selectedExercises = computed(() => selectedVariant.value?.exercises.map((entry) => ({
  name: exercises.value.find((exercise) => exercise.id === entry.exerciseId)?.name ?? entry.exerciseId,
  sets: entry.sets.length,
})) ?? []);

const currentSession = computed(() => {
  if (progress.value?.cycle.status !== "active") return undefined;
  return progress.value.cycle.sessions.find((session) => session.status === "started") ?? progress.value.nextSession;
});

const followingSession = computed(() => {
  if (progress.value?.cycle.status !== "active") return undefined;
  const currentId = props.workout ? props.workout.programSessionId : currentSession.value?.id;
  return progress.value.cycle.sessions.find((session) => session.status === "pending" && session.id !== currentId);
});

const currentName = computed(() => {
  if (props.workout) return props.workout.routine?.name ?? "Entrenamiento libre";
  return currentSession.value ? routineName(currentSession.value.routineId) : null;
});

const weeksInCycle = computed(() => [...new Set(progress.value?.cycle.sessions.map((session) => session.week) ?? [])]);
const visibleWeek = computed(() => selectedWeek.value ?? currentSession.value?.week ?? weeksInCycle.value.at(-1) ?? 1);
const visibleSessions = computed(() => progress.value?.cycle.sessions.filter((session) => session.week === visibleWeek.value) ?? []);
const hasActiveCycle = computed(() => progress.value?.cycle.status === "active");
const sessionLabel = (session: ProgramCycleSession): string => `Sesión ${session.position + 1} · Semana ${session.week}`;
const formatDate = (value: string): string => new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(value));

const statusLabel = (status: ProgramCycleSession["status"]): string => ({
  pending: "pendiente",
  started: "en curso",
  completed: "completada",
  skipped: "omitida",
})[status];

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
  loading.value = true;
  const [listed, current, activeRoutines, archivedRoutines, availableExercises, dashboard] = await Promise.all([
    props.training.listPrograms(),
    props.training.getProgramProgress(),
    props.training.listRoutines({ status: "active" }),
    props.training.listRoutines({ status: "archived" }),
    props.training.listExercises({ status: "active" }),
    props.training.getDashboard({ from: "0001-01-01T00:00:00.000Z" as ISODateTime, to: "9999-12-31T23:59:59.999Z" as ISODateTime }),
  ]);
  loading.value = false;
  if (!dashboard.ok || !listed.ok || !current.ok || !activeRoutines.ok || !archivedRoutines.ok || !availableExercises.ok) {
    error.value = "No se pudo cargar el programa.";
    return;
  }
  const details = await Promise.all([...activeRoutines.value, ...archivedRoutines.value].map((routine) => props.training.getRoutine(routine.id)));
  if (details.some((routine) => !routine.ok)) {
    error.value = "No se pudieron cargar las rutinas.";
    return;
  }
  error.value = null;
  lastWorkout.value = dashboard.value.lastWorkout ?? null;
  programs.value = listed.value;
  progress.value = current.value;
  routines.value = details.filter((routine): routine is { readonly ok: true; readonly value: Routine } => routine.ok).map((routine) => routine.value);
  exercises.value = availableExercises.value;
  if (selectedSessionId.value !== null && !current.value?.cycle.sessions.some((session) => session.id === selectedSessionId.value)) {
    selectedSessionId.value = null;
  }
  if (plannedDays.value.length === 0) addDay();
};

const start = async (id: Program["id"]): Promise<void> => {
  if (busy.value) return;
  busy.value = true;
  const result = await props.training.startProgram(id);
  busy.value = false;
  if (!result.ok) {
    error.value = "No se pudo iniciar el programa.";
    return;
  }
  selectedWeek.value = null;
  await load();
};

const startSession = async (sessionId?: string): Promise<void> => {
  if (busy.value || props.workout !== null) return;
  busy.value = true;
  const result = await props.training.startNextProgramWorkout(sessionId as import("../core").ProgramSessionId | undefined);
  busy.value = false;
  if (!result.ok) {
    error.value = "No se pudo iniciar la sesión.";
    return;
  }
  emit("started", result.value);
};

const selectSession = (session: ProgramCycleSession): void => {
  selectedSessionId.value = selectedSessionId.value === session.id ? null : session.id;
};

const skip = async (): Promise<void> => {
  if (busy.value) return;
  busy.value = true;
  const result = await props.training.skipNextProgramSession();
  busy.value = false;
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
watch(() => props.workout?.id, () => { selectedWeek.value = null; void load(); });
</script>

<template>
  <section :class="{ 'journey-compact': compact }" aria-labelledby="program-title" :aria-busy="loading">
    <header v-if="!compact"><p class="eyebrow">Tu entrenamiento</p><h2 id="program-title">Programa</h2></header>
    <h2 v-else id="program-title" class="eyebrow">Tu secuencia</h2>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>
    <p v-if="loading && !progress" role="status">Cargando tu entrenamiento…</p>

    <div class="training-journey" aria-label="Continuidad del entrenamiento">
      <article class="journey-previous" aria-labelledby="previous-title">
        <h3 id="previous-title" class="eyebrow">{{ compact ? "Último" : "Último entrenamiento" }}</h3>
        <template v-if="lastWorkout">
          <strong>{{ lastWorkout.routineName ?? "Entrenamiento libre" }}</strong>
          <span>{{ formatDate(lastWorkout.completedAt) }} · Series completadas: {{ lastWorkout.completedSetCount }}</span>
        </template>
        <p v-else>Aún no registraste entrenamientos.</p>
      </article>
      <article class="active-card journey-current" aria-labelledby="current-title">
        <h3 id="current-title" class="eyebrow">{{ workout || currentSession?.status === 'started' ? 'En curso' : 'Para entrenar ahora' }}</h3>
        <template v-if="currentName">
          <strong>{{ currentName }}</strong>
          <span v-if="currentSession && (!workout || workout.programSessionId === currentSession.id)">{{ sessionLabel(currentSession) }}</span>
          <template v-if="!compact">
            <button v-if="workout || currentSession?.status === 'started'" type="button" :disabled="busy" @click="emit('continueWorkout', workout ? workout.programSessionId : currentSession?.id)">Continuar sesión</button>
            <template v-else-if="currentSession">
              <button type="button" :disabled="busy" @click="startSession(currentSession.id)">Iniciar próxima</button>
              <button type="button" class="secondary-action" :disabled="busy" @click="skip">Omitir esta sesión</button>
            </template>
          </template>
        </template>
        <p v-else-if="progress?.cycle.status === 'completed'">Ciclo completado. Puedes repetirlo.</p>
        <p v-else>Elige un programa abajo.</p>
      </article>
      <article class="journey-next" aria-labelledby="following-title">
        <h3 id="following-title" class="eyebrow">Después</h3>
        <template v-if="followingSession">
          <strong>{{ routineName(followingSession.routineId) }}</strong>
          <span>{{ sessionLabel(followingSession) }}</span>
        </template>
        <p v-else-if="currentSession">Esta sesión cierra el ciclo.</p>
        <p v-else>Elige tu siguiente programa.</p>
      </article>
    </div>

    <template v-if="!compact">
      <template v-if="progress">
        <p>{{ programs.find((program) => program.id === progress?.cycle.programId)?.name ?? progress.cycle.programName }} · {{ progress.completedSessions }}/{{ progress.plannedSessions }} sesiones completadas</p>
        <p v-if="progress.cycle.status === 'abandoned'">Ciclo cerrado. Tu historial se conserva.</p>
        <template v-else-if="progress.cycle.status === 'completed'">
          <p>Informe final · {{ progress.cycle.goals.filter((goal) => goal.achieved).length }}/{{ progress.cycle.goals.length }} metas alcanzadas.</p>
          <button type="button" :disabled="busy || workout !== null" @click="duplicate">Repetir ciclo</button>
        </template>
        <template v-else>
          <p>Sigue esta secuencia. Si faltas un día, retoma donde quedaste.</p>
          <section aria-labelledby="program-sessions-title">
            <h3 id="program-sessions-title">Secuencia del programa</h3>
            <label class="field">Semana
              <select :value="visibleWeek" @change="selectedWeek = Number(($event.target as HTMLSelectElement).value); selectedSessionId = null">
                <option v-for="week in weeksInCycle" :key="week" :value="week">Semana {{ week }}</option>
              </select>
            </label>
            <ol class="card-list program-sequence">
              <li v-for="session in visibleSessions" :key="session.id" :aria-current="currentSession?.id === session.id ? 'step' : undefined">
                <span>{{ sessionLabel(session) }} · {{ statusLabel(session.status) }}</span>
                <strong>{{ routineName(session.routineId) }}</strong>
                <span v-if="session.completedAt">Completada el {{ formatDate(session.completedAt) }}</span>
                <button type="button" class="secondary-action" :aria-expanded="selectedSessionId === session.id" :aria-controls="`session-${session.id}`" @click="selectSession(session)">{{ selectedSessionId === session.id ? 'Ocultar' : 'Ver ejercicios' }}</button>
                <section v-if="selectedSessionId === session.id" :id="`session-${session.id}`" aria-label="Contenido de la sesión">
                  <ul v-if="selectedVariant" class="history-sets">
                    <li v-for="(exercise, index) in selectedExercises" :key="index"><span>{{ exercise.sets }} series</span><strong>{{ exercise.name }}</strong></li>
                  </ul>
                  <p v-else class="empty-state">Rutina no disponible.</p>
                  <div class="inline-actions">
                    <button v-if="session.status === 'pending'" type="button" :disabled="busy || workout !== null || currentSession?.status === 'started'" @click="startSession(session.id)">Entrenar esta sesión</button>
                    <button v-if="session.status === 'started'" type="button" :disabled="busy" @click="emit('continueWorkout', session.id)">Continuar sesión</button>
                    <button v-if="selectedVariant" type="button" class="secondary-action" @click="emit('editRoutine', session.routineId)">Editar rutina</button>
                  </div>
                </section>
              </li>
            </ol>
          </section>
          <details class="program-options">
            <summary>Opciones del programa</summary>
            <button type="button" class="secondary-action" :disabled="busy" @click="abandon">Cambiar programa</button>
          </details>
        </template>
        <ul v-if="progress.cycle.goals.length" class="card-list">
          <li v-for="goal in progress.cycle.goals" :key="goal.exerciseId">
            <strong>{{ exercises.find((exercise) => exercise.id === goal.exerciseId)?.name ?? goal.exerciseId }}</strong><span>{{ goal.achieved ? "Meta alcanzada" : "En progreso" }}</span>
            <span v-if="goal.recommendedWeight">Siguiente: {{ goal.recommendedWeight.amount }} {{ goal.recommendedWeight.unit }}</span>
          </li>
        </ul>
      </template>

      <template v-if="!hasActiveCycle && !loading">
        <h3>Elige tu programa</h3>
        <ul class="card-list">
          <li v-for="program in programs" :key="program.id">
            <strong>{{ program.name }}</strong><span>{{ program.weeks }} semanas · {{ program.sessions.length }} sesiones por semana</span>
            <ol class="program-days">
              <li v-for="(session, index) in program.sessions" :key="index">
                <span>Sesión {{ index + 1 }}</span>
                <strong>{{ routineName(session.routineId) }}</strong>
              </li>
            </ol>
            <button type="button" :disabled="busy || workout !== null" @click="start(program.id)">Iniciar programa</button>
          </li>
        </ul>
        <details class="program-options">
          <summary>Crear otro programa</summary>
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

        </details>
      </template>
    </template>
  </section>
</template>
