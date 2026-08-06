<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import type { Exercise, ExerciseId, MuscleGroup, Routine, RoutineDraft, RoutineId, RoutineSummary, Seconds, TrainingOrchestrator } from "../core";

const props = defineProps<{
  readonly training: TrainingOrchestrator;
  readonly routineToEdit?: RoutineId | null;
}>();

const emit = defineEmits<{
  changed: [];
}>();

const activeExercises = ref<readonly Exercise[]>([]);
const archivedExercises = ref<readonly Exercise[]>([]);
const activeRoutines = ref<readonly RoutineSummary[]>([]);
const archivedRoutines = ref<readonly RoutineSummary[]>([]);
const editingExercise = ref<Exercise | null>(null);
const routineText = ref("");
const editingRoutineId = ref<RoutineId | null>(null);
const error = ref<string | null>(null);
const message = ref<string | null>(null);
const exerciseName = ref("");
const primaryMuscles = ref("");
const secondaryMuscles = ref("");
const restSeconds = ref("90");
const notes = ref("");
const exerciseEditor = ref<HTMLElement | null>(null);

const asMuscles = (value: string): readonly MuscleGroup[] => value.split(",")
  .map((muscle) => muscle.trim())
  .filter((muscle) => muscle.length > 0) as readonly MuscleGroup[];

const resetExercise = (): void => {
  editingExercise.value = null;
  exerciseName.value = "";
  primaryMuscles.value = "";
  secondaryMuscles.value = "";
  restSeconds.value = "90";
  notes.value = "";
};

const exerciseForm = (exercise: Exercise): void => {
  editingExercise.value = exercise;
  exerciseName.value = exercise.name;
  primaryMuscles.value = exercise.primaryMuscles.join(", ");
  secondaryMuscles.value = exercise.secondaryMuscles.join(", ");
  restSeconds.value = exercise.defaultRestSeconds.toString();
  notes.value = exercise.notes ?? "";
  void nextTick(() => exerciseEditor.value?.scrollIntoView({ behavior: "smooth", block: "start" }));
};

const load = async (): Promise<void> => {
  const [activeExerciseResult, archivedExerciseResult, activeRoutineResult, archivedRoutineResult] = await Promise.all([
    props.training.listExercises({ status: "active" }),
    props.training.listExercises({ status: "archived" }),
    props.training.listRoutines({ status: "active" }),
    props.training.listRoutines({ status: "archived" }),
  ]);

  if (!activeExerciseResult.ok || !archivedExerciseResult.ok || !activeRoutineResult.ok || !archivedRoutineResult.ok) {
    error.value = "No se pudo leer el catálogo local.";
    return;
  }

  activeExercises.value = activeExerciseResult.value;
  archivedExercises.value = archivedExerciseResult.value;
  activeRoutines.value = activeRoutineResult.value;
  archivedRoutines.value = archivedRoutineResult.value;
};

const saveExercise = async (): Promise<void> => {
  const duration = Number(restSeconds.value);

  if (!Number.isInteger(duration) || duration < 0) {
    error.value = "El descanso debe ser un número entero de segundos.";
    return;
  }

  const draft = {
    name: exerciseName.value,
    primaryMuscles: asMuscles(primaryMuscles.value),
    secondaryMuscles: asMuscles(secondaryMuscles.value),
    defaultRestSeconds: duration as Seconds,
    ...(notes.value.trim().length === 0 ? {} : { notes: notes.value.trim() }),
  };
  const result = editingExercise.value === null
    ? await props.training.createExercise(draft)
    : await props.training.updateExercise({ exerciseId: editingExercise.value.id, patch: draft });

  if (!result.ok) {
    error.value = "No se pudo guardar el ejercicio. Revisa sus datos.";
    return;
  }

  message.value = "Ejercicio guardado.";
  error.value = null;
  resetExercise();
  await load();
  emit("changed");
};

const changeExerciseStatus = async (exerciseId: ExerciseId, archive: boolean): Promise<void> => {
  const result = archive ? await props.training.archiveExercise(exerciseId) : await props.training.restoreExercise(exerciseId);

  if (!result.ok) {
    error.value = "No se pudo cambiar el estado del ejercicio.";
    return;
  }

  await load();
  emit("changed");
};

const draftFromRoutine = (routine: Routine): RoutineDraft => ({
  name: routine.name,
  variants: routine.variants.map((variant) => ({
    name: variant.name,
    exercises: variant.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sets: exercise.sets,
      laterality: exercise.laterality,
      ...(exercise.restSeconds === undefined ? {} : { restSeconds: exercise.restSeconds }),
      ...(exercise.notes === undefined ? {} : { notes: exercise.notes }),
    })),
  })),
});

const startRoutine = async (routineId?: RoutineId): Promise<void> => {
  const routine = routineId === undefined ? null : await props.training.getRoutine(routineId);

  if (routine !== null && !routine.ok) {
    error.value = "No se pudo abrir la rutina.";
    return;
  }

  const exerciseId = activeExercises.value[0]?.id;

  if (routine === null && exerciseId === undefined) {
    error.value = "Crea un ejercicio antes de crear una rutina.";
    return;
  }

  const draft = routine === null ? {
    name: "Nueva rutina",
    variants: [{
      name: "Principal",
      exercises: [{
        exerciseId,
        sets: [{ type: "normal" as const, repetitions: { kind: "exact" as const, repetitions: 8 as never } }],
        laterality: "bilateral" as const,
      }],
    }],
  } : draftFromRoutine(routine.value);
  editingRoutineId.value = routineId ?? null;
  routineText.value = JSON.stringify(draft, null, 2);
};

const saveRoutine = async (): Promise<void> => {
  let draft: RoutineDraft;

  try {
    draft = JSON.parse(routineText.value) as RoutineDraft;
  } catch {
    error.value = "La estructura de la rutina debe ser JSON válido.";
    return;
  }

  const result = editingRoutineId.value === null
    ? await props.training.createRoutine(draft)
    : await props.training.updateRoutine({ routineId: editingRoutineId.value, patch: draft });

  if (!result.ok) {
    error.value = "No se pudo guardar la rutina. Revisa variantes, ejercicios, series, objetivos y descansos.";
    return;
  }

  message.value = "Rutina guardada.";
  error.value = null;
  editingRoutineId.value = null;
  routineText.value = "";
  await load();
  emit("changed");
};

const changeRoutineStatus = async (routineId: RoutineId, archive: boolean): Promise<void> => {
  const result = archive ? await props.training.archiveRoutine(routineId) : await props.training.restoreRoutine(routineId);

  if (!result.ok) {
    error.value = "No se pudo cambiar el estado de la rutina.";
    return;
  }

  await load();
  emit("changed");
};

onMounted(() => {
  void load();
});

watch(() => props.routineToEdit, (routineId) => {
  if (routineId !== null && routineId !== undefined) void startRoutine(routineId);
}, { immediate: true });
</script>

<template>
  <section class="manager" aria-labelledby="manager-title">
    <header><p class="eyebrow">Configuración local</p><h2 id="manager-title">Catálogo y rutinas</h2></header>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>
    <p v-if="message" class="success" role="status">{{ message }}</p>

    <form ref="exerciseEditor" class="editor-card" @submit.prevent="saveExercise">
      <h3>{{ editingExercise ? "Editar ejercicio" : "Nuevo ejercicio" }}</h3>
      <label class="field">Nombre <input v-model="exerciseName" required /></label>
      <label class="field">Músculos principales <input v-model="primaryMuscles" placeholder="chest, triceps" required /></label>
      <label class="field">Músculos secundarios <input v-model="secondaryMuscles" placeholder="shoulders" /></label>
      <label class="field">Descanso (s) <input v-model="restSeconds" type="number" min="0" required /></label>
      <label class="field">Notas <input v-model="notes" /></label>
      <div class="inline-actions"><button type="submit">Guardar ejercicio</button><button v-if="editingExercise" type="button" class="secondary-action" @click="resetExercise">Cancelar</button></div>
    </form>

    <section><h3>Ejercicios activos</h3><ul class="card-list"><li v-for="exercise in activeExercises" :key="exercise.id"><strong>{{ exercise.name }}</strong><span>{{ exercise.primaryMuscles.join(", ") }}</span><div class="inline-actions"><button type="button" class="secondary-action" @click="exerciseForm(exercise)">Editar</button><button type="button" class="secondary-action" @click="changeExerciseStatus(exercise.id, true)">Archivar</button></div></li></ul></section>
    <section v-if="archivedExercises.length"><h3>Ejercicios archivados</h3><ul class="card-list"><li v-for="exercise in archivedExercises" :key="exercise.id"><strong>{{ exercise.name }}</strong><button type="button" class="secondary-action" @click="changeExerciseStatus(exercise.id, false)">Restaurar</button></li></ul></section>

    <section class="manager-heading"><h3>Rutinas</h3><button type="button" @click="startRoutine()">Nueva rutina</button></section>
    <ul class="card-list"><li v-for="routine in activeRoutines" :key="routine.id"><strong>{{ routine.name }}</strong><span>{{ routine.variantCount }} variantes</span><div class="inline-actions"><button type="button" class="secondary-action" @click="startRoutine(routine.id)">Editar estructura</button><button type="button" class="secondary-action" @click="changeRoutineStatus(routine.id, true)">Archivar</button></div></li></ul>
    <section v-if="archivedRoutines.length"><h3>Rutinas archivadas</h3><ul class="card-list"><li v-for="routine in archivedRoutines" :key="routine.id"><strong>{{ routine.name }}</strong><button type="button" class="secondary-action" @click="changeRoutineStatus(routine.id, false)">Restaurar</button></li></ul></section>

    <form v-if="routineText" class="editor-card" @submit.prevent="saveRoutine">
      <h3>{{ editingRoutineId ? "Editar rutina" : "Nueva rutina" }}</h3>
      <p>La estructura contiene variantes, ejercicios, series, objetivo de repeticiones, lateralidad, descanso y notas.</p>
      <textarea v-model="routineText" rows="20" spellcheck="false" aria-label="Estructura de rutina" />
      <div class="inline-actions"><button type="submit">Guardar rutina</button><button type="button" class="secondary-action" @click="routineText = ''; editingRoutineId = null">Cancelar</button></div>
    </form>
  </section>
</template>
