<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { TrainingOrchestrator } from "../core";
import type { ActiveWorkoutSession, Exercise, Routine, RoutineId, RoutineSummary, RoutineVariantId } from "../core";
import ActiveWorkout from "./ActiveWorkout.vue";
import CatalogManager from "./CatalogManager.vue";

const props = defineProps<{
  readonly training: TrainingOrchestrator;
}>();

const exercises = ref<readonly Exercise[]>([]);
const routines = ref<readonly RoutineSummary[]>([]);
const selectedRoutine = ref<Routine | null>(null);
const selectedVariantId = ref<RoutineVariantId | null>(null);
const activeWorkout = ref<ActiveWorkoutSession | null>(null);
const error = ref<string | null>(null);
const busy = ref(false);
const view = ref<"routines" | "catalog" | "manage">("routines");
const lastSelectionKey = "train-app:last-routine";

interface LastRoutineSelection {
  readonly routineId: RoutineId;
  readonly variantId: RoutineVariantId;
}

const selectedVariant = computed(() => selectedRoutine.value?.variants.find(
  (variant) => variant.id === selectedVariantId.value,
) ?? null);

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
  const [loadedExercises, loadedRoutines, recoveredWorkout] = await Promise.all([
    props.training.listExercises({ status: "active" }),
    props.training.listRoutines({ status: "active" }),
    props.training.getActiveWorkout(),
  ]);

  if (!loadedExercises.ok || !loadedRoutines.ok || !recoveredWorkout.ok) {
    error.value = "No se pudo leer el catálogo local.";
    return;
  }

  exercises.value = loadedExercises.value;
  routines.value = loadedRoutines.value;
  activeWorkout.value = recoveredWorkout.value;
  const lastSelection = readLastSelection();

  if (lastSelection !== null) {
    await selectRoutine(lastSelection.routineId, lastSelection.variantId);
  }
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
  <main class="app-shell">
    <header class="app-header">
      <p class="eyebrow">Bitácora offline</p>
      <h1>Entrenar</h1>
      <p>Todo se guarda en este dispositivo.</p>
    </header>

    <p v-if="error" class="notice" role="alert">{{ error }}</p>

    <nav v-if="!activeWorkout" class="app-navigation" aria-label="Principal">
      <button type="button" :class="{ 'secondary-action': view !== 'routines' }" @click="view = 'routines'">Rutinas</button>
      <button type="button" :class="{ 'secondary-action': view !== 'catalog' }" @click="view = 'catalog'">Catálogo</button>
      <button type="button" :class="{ 'secondary-action': view !== 'manage' }" @click="view = 'manage'">Gestionar</button>
    </nav>

    <ActiveWorkout v-if="activeWorkout" :training="training" :workout="activeWorkout" :available-exercises="exercises" @updated="activeWorkout = $event" @discard="discardWorkout" @finish="finishWorkout" />

    <template v-else-if="view === 'routines'">
      <section aria-labelledby="routines-title">
      <h2 id="routines-title">Rutinas</h2>
      <ul v-if="routines.length" class="card-list">
        <li v-for="routine in routines" :key="routine.id">
          <strong>{{ routine.name }}</strong>
          <span>{{ routine.variantCount }} variantes</span>
          <button type="button" class="secondary-action" @click="selectRoutine(routine.id)">Elegir rutina</button>
        </li>
      </ul>
      <p v-else class="empty-state">No hay rutinas disponibles.</p>
      </section>

      <section v-if="selectedRoutine" aria-labelledby="selection-title">
        <h2 id="selection-title">{{ selectedRoutine.name }}</h2>
        <label class="field">
          Variante
          <select v-model="selectedVariantId">
            <option v-for="variant in selectedRoutine.variants" :key="variant.id" :value="variant.id">{{ variant.name }}</option>
          </select>
        </label>
        <button type="button" :disabled="busy || !selectedVariant" @click="startRoutine">Iniciar rutina</button>
      </section>

      <section aria-labelledby="empty-title">
        <h2 id="empty-title">Sin rutina</h2>
        <button type="button" class="secondary-action" :disabled="busy" @click="startEmptyWorkout">Iniciar entrenamiento vacío</button>
      </section>
    </template>

    <section v-if="!activeWorkout && view === 'catalog'" aria-labelledby="exercises-title">
      <h2 id="exercises-title">Ejercicios</h2>
      <ul v-if="exercises.length" class="exercise-list">
        <li v-for="exercise in exercises" :key="exercise.id">
          <strong>{{ exercise.name }}</strong>
          <span>{{ exercise.primaryMuscles.join(", ") }}</span>
        </li>
      </ul>
      <p v-else class="empty-state">No hay ejercicios disponibles.</p>
    </section>

    <CatalogManager v-if="!activeWorkout && view === 'manage'" :training="training" @changed="loadCatalog" />
  </main>
</template>
