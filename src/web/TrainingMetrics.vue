<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { DashboardSummary, Exercise, ExerciseId, ExerciseProgress, ISODateTime, TrainingOrchestrator } from "../core";

const props = defineProps<{
  readonly training: TrainingOrchestrator;
  readonly exercises: readonly Exercise[];
}>();

const today = new Date();
const earlier = new Date(today);
earlier.setDate(today.getDate() - 30);
const asDateInput = (value: Date): string => value.toISOString().slice(0, 10);
const start = ref(asDateInput(earlier));
const end = ref(asDateInput(today));
const selectedExerciseId = ref<ExerciseId | "">(props.exercises[0]?.id ?? "");
const dashboard = ref<DashboardSummary | null>(null);
const progress = ref<ExerciseProgress | null>(null);
const error = ref<string | null>(null);

const period = (): { from: ISODateTime; to: ISODateTime } | null => {
  const from = new Date(`${start.value}T00:00:00.000Z`);
  const to = new Date(`${end.value}T23:59:59.999Z`);

  return Number.isFinite(from.getTime()) && Number.isFinite(to.getTime()) && from < to
    ? { from: from.toISOString() as ISODateTime, to: to.toISOString() as ISODateTime }
    : null;
};

const formatVolume = (volume: readonly { readonly amount: number; readonly unit: string }[]): string =>
  volume.length === 0 ? "—" : volume.map((item) => `${Math.round(item.amount)} ${item.unit}`).join(" · ");

const load = async (): Promise<void> => {
  const selectedPeriod = period();

  if (selectedPeriod === null) {
    error.value = "El período seleccionado no es válido.";
    return;
  }

  const dashboardResult = await props.training.getDashboard(selectedPeriod);

  if (!dashboardResult.ok) {
    error.value = "No se pudieron calcular las métricas locales.";
    return;
  }

  dashboard.value = dashboardResult.value;
  progress.value = null;
  error.value = null;

  if (selectedExerciseId.value.length === 0) {
    return;
  }

  const exerciseId = selectedExerciseId.value;

  if (exerciseId === "") {
    return;
  }

  const progressResult = await props.training.getExerciseProgress({
    exerciseId,
    period: selectedPeriod,
  });

  if (progressResult.ok) {
    progress.value = progressResult.value;
  }
};

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="metrics" aria-labelledby="metrics-title">
    <header><p class="eyebrow">Analítica local</p><h2 id="metrics-title">Progreso</h2></header>
    <form class="editor-card" @submit.prevent="load">
      <label class="field">Desde <input v-model="start" type="date" required /></label>
      <label class="field">Hasta <input v-model="end" type="date" required /></label>
      <label class="field">Ejercicio <select v-model="selectedExerciseId"><option value="">Sin progreso por ejercicio</option><option v-for="exercise in exercises" :key="exercise.id" :value="exercise.id">{{ exercise.name }}</option></select></label>
      <button type="submit">Actualizar métricas</button>
    </form>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>

    <template v-if="dashboard">
      <div class="metric-grid"><article><span>Entrenamientos</span><strong>{{ dashboard.workoutCount }}</strong></article><article><span>Series completadas</span><strong>{{ dashboard.completedSetCount }}</strong></article><article><span>Volumen efectivo</span><strong>{{ formatVolume(dashboard.volume) }}</strong></article></div>
      <section><h3>Distribución muscular</h3><ul v-if="dashboard.muscleDistribution.length" class="card-list"><li v-for="item in dashboard.muscleDistribution" :key="item.muscle"><strong>{{ item.muscle }}</strong><span>{{ formatVolume(item.volume) }}</span></li></ul><p v-else class="empty-state">No hay volumen efectivo en este período.</p></section>
      <p v-if="dashboard.lastWorkout" class="empty-state">Último entrenamiento: {{ dashboard.lastWorkout.routineName ?? "Entrenamiento vacío" }}</p>
    </template>

    <section v-if="progress" aria-labelledby="exercise-progress-title"><h3 id="exercise-progress-title">Progreso por ejercicio</h3><ul v-if="progress.points.length" class="card-list"><li v-for="point in progress.points" :key="`${point.recordedAt}-${point.bestWeight.unit}`"><strong>{{ new Date(point.recordedAt).toLocaleDateString("es") }}</strong><span>Mejor peso: {{ point.bestWeight.amount }} {{ point.bestWeight.unit }}</span><span>Volumen: {{ formatVolume(point.volume) }}</span></li></ul><p v-else class="empty-state">No hay registros para este ejercicio en el período.</p></section>
  </section>
</template>
