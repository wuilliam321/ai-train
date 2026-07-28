<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { TrainingOrchestrator } from "../core";
import type { Exercise, RoutineSummary } from "../core";

const props = defineProps<{
  readonly training: TrainingOrchestrator;
}>();

const exercises = ref<readonly Exercise[]>([]);
const routines = ref<readonly RoutineSummary[]>([]);
const error = ref<string | null>(null);

const loadCatalog = async (): Promise<void> => {
  const [loadedExercises, loadedRoutines] = await Promise.all([
    props.training.listExercises({ status: "active" }),
    props.training.listRoutines({ status: "active" }),
  ]);

  if (!loadedExercises.ok || !loadedRoutines.ok) {
    error.value = "No se pudo leer el catálogo local.";
    return;
  }

  exercises.value = loadedExercises.value;
  routines.value = loadedRoutines.value;
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

    <section aria-labelledby="routines-title">
      <h2 id="routines-title">Rutinas</h2>
      <ul v-if="routines.length" class="card-list">
        <li v-for="routine in routines" :key="routine.id">
          <strong>{{ routine.name }}</strong>
          <span>{{ routine.variantCount }} variantes</span>
        </li>
      </ul>
      <p v-else class="empty-state">No hay rutinas disponibles.</p>
    </section>

    <section aria-labelledby="exercises-title">
      <h2 id="exercises-title">Ejercicios</h2>
      <ul v-if="exercises.length" class="exercise-list">
        <li v-for="exercise in exercises" :key="exercise.id">
          <strong>{{ exercise.name }}</strong>
          <span>{{ exercise.primaryMuscles.join(", ") }}</span>
        </li>
      </ul>
      <p v-else class="empty-state">No hay ejercicios disponibles.</p>
    </section>
  </main>
</template>
