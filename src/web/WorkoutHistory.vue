<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { CompletedWorkoutSession, TrainingOrchestrator, WorkoutSummary } from "../core";

const props = defineProps<{
  readonly training: TrainingOrchestrator;
}>();

const sessions = ref<readonly WorkoutSummary[]>([]);
const nextCursor = ref<string | undefined>(undefined);
const selected = ref<CompletedWorkoutSession | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const pageSize = 20;

const load = async (cursor?: string): Promise<void> => {
  loading.value = true;
  const result = await props.training.listWorkoutSessions({ limit: pageSize, ...(cursor === undefined ? {} : { cursor }) });
  loading.value = false;

  if (!result.ok) {
    error.value = "No se pudo cargar el historial local.";
    return;
  }

  sessions.value = cursor === undefined ? result.value.items : [...sessions.value, ...result.value.items];
  nextCursor.value = result.value.nextCursor;
};

const open = async (summary: WorkoutSummary): Promise<void> => {
  const result = await props.training.getWorkoutSession(summary.id);

  if (!result.ok || result.value.status !== "completed") {
    error.value = "No se pudo abrir esta sesión.";
    return;
  }

  selected.value = result.value;
};

const formatDate = (value: string): string => new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="history" aria-labelledby="history-title">
    <header><p class="eyebrow">Registro local</p><h2 id="history-title">Historial</h2></header>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>

    <template v-if="selected">
      <div class="inline-actions"><h3>{{ selected.routine?.name ?? "Entrenamiento vacío" }}</h3><button type="button" class="secondary-action" @click="selected = null">Volver</button></div>
      <p>{{ formatDate(selected.completedAt) }}</p>
      <article v-for="exercise in selected.exercises" :key="exercise.id" class="exercise-card">
        <h3>{{ exercise.exercise.name }}</h3>
        <ul class="history-sets"><li v-for="(set, position) in exercise.sets" :key="set.id"><span>Serie {{ position + 1 }} · {{ set.type }}</span><strong v-if="set.status === 'completed'">{{ set.weight.amount }} {{ set.weight.unit }} × {{ set.repetitions }}</strong><span v-else>Pendiente al cerrar</span></li></ul>
      </article>
    </template>

    <template v-else>
      <ul v-if="sessions.length" class="card-list"><li v-for="session in sessions" :key="session.id"><strong>{{ session.routineName ?? "Entrenamiento vacío" }}</strong><span>{{ formatDate(session.completedAt) }} · {{ session.completedSetCount }} series</span><button type="button" class="secondary-action" @click="open(session)">Ver detalle</button></li></ul>
      <p v-else-if="!loading" class="empty-state">Aún no hay entrenamientos finalizados.</p>
      <button v-if="nextCursor" type="button" class="secondary-action" :disabled="loading" @click="load(nextCursor)">Cargar más</button>
    </template>
  </section>
</template>
