<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import type { TrainingOrchestrator } from "../core";
import type { ActiveWorkoutSession, Exercise, ProgramSessionId, Routine, RoutineId, RoutineSummary, RoutineVariantId } from "../core";
import ActiveWorkout from "./ActiveWorkout.vue";
import CatalogManager from "./CatalogManager.vue";
import WorkoutHistory from "./WorkoutHistory.vue";
import TrainingMetrics from "./TrainingMetrics.vue";
import BackupManager from "./BackupManager.vue";
import ProgramProgress from "./ProgramProgress.vue";
import type { WebTrainingBackup } from "./training-application";

const props = defineProps<{
  readonly training: TrainingOrchestrator;
  readonly backup: WebTrainingBackup;
}>();

const exercises = ref<readonly Exercise[]>([]);
const routines = ref<readonly RoutineSummary[]>([]);
const selectedRoutine = ref<Routine | null>(null);
const selectedVariantId = ref<RoutineVariantId | null>(null);
const activeWorkout = ref<ActiveWorkoutSession | null>(null);
const error = ref<string | null>(null);
const busy = ref(false);
const loadingCatalog = ref(false);
const view = ref<"routines" | "program" | "manage" | "history" | "metrics" | "backup" | "workout">("program");
const isMenuOpen = ref(false);
const routineToEdit = ref<RoutineId | null>(null);
const routineEditorOpen = ref(false);
const lastSelectionKey = "train-app:last-routine";

interface LastRoutineSelection {
  readonly routineId: RoutineId;
  readonly variantId: RoutineVariantId;
}

const changeView = (newView: typeof view.value) => {
  view.value = newView;
  if (newView !== "routines") {
    routineToEdit.value = null;
    routineEditorOpen.value = false;
  }
  isMenuOpen.value = false;
  void nextTick(() => window.scrollTo({ top: 0, behavior: "instant" }));
};

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const editRoutine = (routineId: RoutineId): void => {
  routineToEdit.value = routineId;
  routineEditorOpen.value = true;
  changeView("routines");
};

const createRoutine = (): void => {
  routineToEdit.value = null;
  routineEditorOpen.value = true;
  changeView("routines");
};

const selectedVariant = computed(() => selectedRoutine.value?.variants.find(
  (variant) => variant.id === selectedVariantId.value,
) ?? null);

const selectedVariantExercises = computed(() => {
  if (!selectedVariant.value) return [];
  return selectedVariant.value.exercises.map((ex) => {
    const exerciseDef = exercises.value.find((e) => e.id === ex.exerciseId);
    return {
      name: exerciseDef?.name ?? ex.exerciseId,
      sets: ex.sets.length,
    };
  });
});

const readLastSelection = (): LastRoutineSelection | null => {
  try {
    const serialized = window.localStorage.getItem(lastSelectionKey);

    if (serialized === null) {
      return null;
    }

    const value: unknown = JSON.parse(serialized);

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }

    const { routineId, variantId } = value as Record<string, unknown>;
    return typeof routineId === "string" && routineId.length > 0 && typeof variantId === "string" && variantId.length > 0
      ? { routineId: routineId as RoutineId, variantId: variantId as RoutineVariantId }
      : null;
  } catch {
    return null;
  }
};

const saveLastSelection = (selection: LastRoutineSelection): void => {
  try {
    window.localStorage.setItem(lastSelectionKey, JSON.stringify(selection));
  } catch {
    return;
  }
};

const selectRoutine = async (routineId: RoutineId, preferredVariantId?: RoutineVariantId): Promise<void> => {
  error.value = null;
  const routine = await props.training.getRoutine(routineId);

  if (!routine.ok) {
    error.value = "No se pudo abrir la rutina seleccionada.";
    return;
  }

  selectedRoutine.value = routine.value;
  selectedVariantId.value = routine.value.variants.some((variant) => variant.id === preferredVariantId)
    ? preferredVariantId!
    : routine.value.variants[0]?.id ?? null;
};

const chooseRoutine = async (routineId: RoutineId): Promise<void> => {
  await selectRoutine(routineId);
  await nextTick();
  const startButton = document.getElementById(`start-${routineId}`);
  startButton?.focus({ preventScroll: true });
  startButton?.scrollIntoView({ block: "nearest" });
};

const loadCatalog = async (): Promise<void> => {
  loadingCatalog.value = true;
  const [loadedExercises, loadedRoutines, recoveredWorkout] = await Promise.all([
    props.training.listExercises({ status: "active" }),
    props.training.listRoutines({ status: "active" }),
    props.training.getActiveWorkout(),
  ]);

  if (!loadedExercises.ok || !loadedRoutines.ok || !recoveredWorkout.ok) {
    error.value = "No se pudo leer el catálogo local.";
    loadingCatalog.value = false;
    return;
  }

  exercises.value = loadedExercises.value;
  routines.value = loadedRoutines.value;
  activeWorkout.value = recoveredWorkout.value;
  if (activeWorkout.value) view.value = "workout";
  const lastSelection = readLastSelection();

  if (lastSelection !== null) {
    await selectRoutine(lastSelection.routineId, lastSelection.variantId);
  }

  loadingCatalog.value = false;
};

const startRoutine = async (): Promise<void> => {
  if (selectedRoutine.value === null || selectedVariant.value === null) {
    return;
  }

  busy.value = true;
  error.value = null;
  const workout = await props.training.startWorkout({
    source: "routine",
    routineId: selectedRoutine.value.id,
    variantId: selectedVariant.value.id,
  });
  busy.value = false;

  if (!workout.ok) {
    error.value = "No se pudo iniciar el entrenamiento.";
    return;
  }

  saveLastSelection({ routineId: selectedRoutine.value.id, variantId: selectedVariant.value.id });
  activeWorkout.value = workout.value;
  changeView("workout");
};

const startEmptyWorkout = async (): Promise<void> => {
  busy.value = true;
  error.value = null;
  const workout = await props.training.startWorkout({ source: "empty" });
  busy.value = false;

  if (!workout.ok) {
    error.value = "No se pudo iniciar el entrenamiento vacío.";
    return;
  }

  activeWorkout.value = workout.value;
  changeView("workout");
};

const continueWorkout = async (sessionId?: ProgramSessionId): Promise<void> => {
  const recovered = await props.training.getActiveWorkout();
  if (!recovered.ok) {
    error.value = "No se pudo recuperar el entrenamiento activo. Reintenta.";
    return;
  }
  activeWorkout.value = recovered.value;
  if (recovered.value === null || (sessionId !== undefined && recovered.value.programSessionId !== sessionId)) {
    error.value = "No se encontró el entrenamiento activo. Cambia de programa para iniciar otro ciclo; el historial se conserva.";
    return;
  }
  error.value = null;
  changeView("workout");
};

const closeWorkout = (): void => {
  changeView("program");
};

const discardWorkout = async (): Promise<void> => {
  busy.value = true;
  const discarded = await props.training.discardWorkout();
  busy.value = false;

  if (!discarded.ok) {
    error.value = "No se pudo descartar el entrenamiento.";
    return;
  }

  activeWorkout.value = null;
  changeView("program");
};

const finishWorkout = async (): Promise<void> => {
  busy.value = true;
  const finished = await props.training.finishWorkout();
  busy.value = false;

  if (!finished.ok) {
    error.value = "No se pudo finalizar el entrenamiento.";
    return;
  }

  activeWorkout.value = null;
  changeView("program");
};

onMounted(() => {
  void loadCatalog();
});
</script>

<template>
  <main id="main" class="app-shell" :aria-busy="loadingCatalog">
    <div class="mobile-top-bar">
      <button type="button" class="hamburger-btn" @click="toggleMenu" aria-label="Menú">☰</button>
      <span v-if="activeWorkout && view === 'workout'" class="mobile-title">Entrenando</span>
      <span v-else class="mobile-title">Bitácora offline</span>
    </div>

    <div :class="['app-header-nav', { 'is-open': isMenuOpen }]">
      <header class="app-header">
        <p class="eyebrow">Bitácora offline</p>
        <h1>Entrenar</h1>
        <p>Todo se guarda en este dispositivo.</p>
      </header>

      <nav class="app-navigation" aria-label="Principal">
        <button v-if="activeWorkout" type="button" :aria-current="view === 'workout' ? 'page' : undefined" :class="{ 'secondary-action': view !== 'workout' }" @click="changeView('workout')">En curso</button>
        <button type="button" :aria-current="view === 'program' ? 'page' : undefined" :class="{ 'secondary-action': view !== 'program' }" @click="changeView('program')">Programa</button>
        <button type="button" :aria-current="view === 'routines' ? 'page' : undefined" :class="{ 'secondary-action': view !== 'routines' }" @click="changeView('routines')">Rutinas</button>
        <button type="button" :aria-current="view === 'manage' ? 'page' : undefined" :class="{ 'secondary-action': view !== 'manage' }" @click="changeView('manage')">Gestionar</button>
        <button type="button" :aria-current="view === 'history' ? 'page' : undefined" :class="{ 'secondary-action': view !== 'history' }" @click="changeView('history')">Historial</button>
        <button type="button" :aria-current="view === 'metrics' ? 'page' : undefined" :class="{ 'secondary-action': view !== 'metrics' }" @click="changeView('metrics')">Progreso</button>
        <button type="button" :aria-current="view === 'backup' ? 'page' : undefined" :class="{ 'secondary-action': view !== 'backup' }" @click="changeView('backup')">Respaldo</button>
      </nav>
    </div>

    <div v-if="error" class="notice" role="alert"><span>{{ error }}</span><button type="button" class="secondary-action" @click="loadCatalog">Reintentar</button></div>
    <p v-if="loadingCatalog" class="empty-state" role="status">Cargando datos locales…</p>

    <ProgramProgress v-if="view === 'program' || view === 'workout'" :training="training" :workout="activeWorkout" :compact="view === 'workout'" @started="activeWorkout = $event; changeView('workout')" @continue-workout="continueWorkout" @edit-routine="editRoutine" />

    <ActiveWorkout v-if="activeWorkout && view === 'workout'" :training="training" :workout="activeWorkout" :available-exercises="exercises" @updated="activeWorkout = $event" @close="closeWorkout" @discard="discardWorkout" @finish="finishWorkout" />

    <CatalogManager v-else-if="view === 'routines' && routineEditorOpen" :training="training" :routine-to-edit="routineToEdit" :create-routine="routineToEdit === null" routines-only @changed="routineEditorOpen = false; routineToEdit = null; loadCatalog()" @close-routine-editor="routineEditorOpen = false; routineToEdit = null" />

    <template v-else-if="view === 'routines'">
      <section aria-labelledby="routines-title">
        <div class="manager-heading"><h2 id="routines-title">Rutinas</h2><button type="button" @click="createRoutine">Nueva rutina</button></div>
        <ul v-if="routines.length" class="card-list">
          <li v-for="routine in routines" :key="routine.id">
            <strong>{{ routine.name }}</strong>
            <span>{{ routine.variantCount }} variantes</span>
            <button type="button" class="secondary-action" :aria-expanded="selectedRoutine?.id === routine.id" :aria-controls="`selection-${routine.id}`" @click="chooseRoutine(routine.id)">{{ selectedRoutine?.id === routine.id ? "Rutina elegida" : "Elegir rutina" }}</button>
            <section v-if="selectedRoutine?.id === routine.id" :id="`selection-${routine.id}`" :aria-label="selectedRoutine.name" class="active-card">
              <label class="field">
                Variante
                <select v-model="selectedVariantId">
                  <option v-for="variant in selectedRoutine.variants" :key="variant.id" :value="variant.id">{{ variant.name }}</option>
                </select>
              </label>
              <button :id="`start-${routine.id}`" type="button" :disabled="busy || !selectedVariant || activeWorkout !== null" @click="startRoutine">Iniciar rutina</button>
              <button type="button" class="secondary-action" @click="editRoutine(selectedRoutine.id)">Editar rutina</button>
              <div v-if="selectedVariantExercises.length">
                <h4 class="eyebrow" style="margin-bottom: 0.5rem">Ejercicios</h4>
                <ul class="history-sets">
                  <li v-for="(ex, index) in selectedVariantExercises" :key="index">
                    <span>{{ ex.sets }} series</span>
                    <strong>{{ ex.name }}</strong>
                  </li>
                </ul>
              </div>
            </section>
          </li>
        </ul>
        <p v-else class="empty-state">No hay rutinas disponibles.</p>
      </section>

      <section aria-labelledby="empty-title">
        <h2 id="empty-title">Sin rutina</h2>
        <button type="button" class="secondary-action" :disabled="busy" @click="startEmptyWorkout">Iniciar entrenamiento vacío</button>
      </section>
    </template>


    <CatalogManager v-if="view === 'manage'" :training="training" @changed="loadCatalog" />
    <WorkoutHistory v-if="view === 'history'" :training="training" />
    <TrainingMetrics v-if="view === 'metrics'" :training="training" :exercises="exercises" />
    <BackupManager v-if="view === 'backup'" :backup="backup" :training="training" />
  </main>
</template>
