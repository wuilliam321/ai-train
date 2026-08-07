<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { TrainingOrchestrator } from "../core";
import type { ActiveWorkoutSession, Exercise, Routine, RoutineId, RoutineSummary, RoutineVariantId } from "../core";
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
  view.value = "workout";
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
  view.value = "workout";
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
  view.value = "routines";
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
  view.value = "routines";
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

    <ActiveWorkout v-if="activeWorkout && view === 'workout'" :training="training" :workout="activeWorkout" :available-exercises="exercises" @updated="activeWorkout = $event" @discard="discardWorkout" @finish="finishWorkout" />

    <CatalogManager v-else-if="view === 'routines' && routineEditorOpen" :training="training" :routine-to-edit="routineToEdit" :create-routine="routineToEdit === null" routines-only @changed="routineEditorOpen = false; routineToEdit = null; loadCatalog" @close-routine-editor="routineEditorOpen = false; routineToEdit = null" />

    <template v-else-if="view === 'routines'">
      <section aria-labelledby="routines-title">
        <div class="manager-heading"><h2 id="routines-title">Rutinas</h2><button type="button" @click="createRoutine">Nueva rutina</button></div>
        <section v-if="selectedRoutine" aria-labelledby="selection-title" class="active-card">
          <p class="eyebrow">Rutina elegida</p>
          <h3 id="selection-title">{{ selectedRoutine.name }}</h3>
          <label class="field">
            Variante
            <select v-model="selectedVariantId">
              <option v-for="variant in selectedRoutine.variants" :key="variant.id" :value="variant.id">{{ variant.name }}</option>
            </select>
          </label>
          <div v-if="selectedVariantExercises.length">
            <h4 class="eyebrow" style="margin-bottom: 0.5rem">Ejercicios</h4>
            <ul class="history-sets">
              <li v-for="(ex, index) in selectedVariantExercises" :key="index">
                <span>{{ ex.sets }} series</span>
                <strong>{{ ex.name }}</strong>
              </li>
            </ul>
          </div>
          <button type="button" :disabled="busy || !selectedVariant" @click="startRoutine">Iniciar rutina</button>
          <button type="button" class="secondary-action" @click="editRoutine(selectedRoutine.id)">Editar rutina</button>
        </section>
        <ul v-if="routines.length" class="card-list">
          <li v-for="routine in routines" :key="routine.id">
            <strong>{{ routine.name }}</strong>
            <span>{{ routine.variantCount }} variantes</span>
            <button type="button" class="secondary-action" :aria-pressed="selectedRoutine?.id === routine.id" @click="selectRoutine(routine.id)">{{ selectedRoutine?.id === routine.id ? "Rutina elegida" : "Elegir rutina" }}</button>
          </li>
        </ul>
        <p v-else class="empty-state">No hay rutinas disponibles.</p>
      </section>

      <section aria-labelledby="empty-title">
        <h2 id="empty-title">Sin rutina</h2>
        <button type="button" class="secondary-action" :disabled="busy" @click="startEmptyWorkout">Iniciar entrenamiento vacío</button>
      </section>
    </template>

    <ProgramProgress v-if="view === 'program'" :training="training" @started="activeWorkout = $event; view = 'workout'" @edit-routine="editRoutine" />

    <CatalogManager v-if="view === 'manage'" :training="training" @changed="loadCatalog" />
    <WorkoutHistory v-if="view === 'history'" :training="training" />
    <TrainingMetrics v-if="view === 'metrics'" :training="training" :exercises="exercises" />
    <BackupManager v-if="view === 'backup'" :backup="backup" :training="training" />
  </main>
</template>
