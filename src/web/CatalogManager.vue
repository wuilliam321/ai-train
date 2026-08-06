<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import type { Exercise, ExerciseId, Laterality, MuscleGroup, Repetitions, Routine, RoutineDraft, RoutineId, RoutineSummary, Seconds, SetType, TrainingOrchestrator } from "../core";

const props = defineProps<{
  readonly training: TrainingOrchestrator;
  readonly routineToEdit?: RoutineId | null;
  readonly routinesOnly?: boolean;
}>();

const emit = defineEmits<{
  changed: [];
  closeRoutineEditor: [];
}>();

const activeExercises = ref<readonly Exercise[]>([]);
const archivedExercises = ref<readonly Exercise[]>([]);
const activeRoutines = ref<readonly RoutineSummary[]>([]);
const archivedRoutines = ref<readonly RoutineSummary[]>([]);
const editingExercise = ref<Exercise | null>(null);
const editingRoutineId = ref<RoutineId | null>(null);
const error = ref<string | null>(null);
const message = ref<string | null>(null);
const exerciseName = ref("");
const primaryMuscles = ref("");
const secondaryMuscles = ref("");
const restSeconds = ref("90");
const notes = ref("");
const exerciseEditor = ref<HTMLElement | null>(null);
const routineEditor = ref<HTMLElement | null>(null);
const routineName = ref("");
const routineVariants = ref<EditableVariant[]>([]);

interface EditableSet {
  type: SetType;
  targetKind: "exact" | "range";
  repetitions: number;
  minimum: number;
  maximum: number;
}

interface EditableExercise {
  exerciseId: ExerciseId;
  laterality: Laterality;
  restSeconds: string;
  notes: string;
  sets: EditableSet[];
}

interface EditableVariant {
  name: string;
  exercises: EditableExercise[];
}

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

const formFromRoutine = (routine: Routine): void => {
  routineName.value = routine.name;
  routineVariants.value = routine.variants.map((variant) => ({
    name: variant.name,
    exercises: variant.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      laterality: exercise.laterality,
      restSeconds: exercise.restSeconds?.toString() ?? "",
      notes: exercise.notes ?? "",
      sets: exercise.sets.map((set) => set.repetitions.kind === "exact" ? {
        type: set.type,
        targetKind: "exact",
        repetitions: set.repetitions.repetitions,
        minimum: 1,
        maximum: 1,
      } : {
        type: set.type,
        targetKind: "range",
        repetitions: 1,
        minimum: set.repetitions.minimum,
        maximum: set.repetitions.maximum,
      }),
    })),
  }));
};

const newExercise = (exerciseId: ExerciseId): EditableExercise => ({
  exerciseId,
  laterality: "bilateral",
  restSeconds: "",
  notes: "",
  sets: [{ type: "normal", targetKind: "exact", repetitions: 8, minimum: 8, maximum: 8 }],
});

const createDraft = (): RoutineDraft => ({
  name: routineName.value,
  variants: routineVariants.value.map((variant) => ({
    name: variant.name,
    exercises: variant.exercises.map((exercise) => {
      const restSeconds = Number(exercise.restSeconds);
      return {
        exerciseId: exercise.exerciseId,
        laterality: exercise.laterality,
        sets: exercise.sets.map((set) => ({
          type: set.type,
          repetitions: set.targetKind === "exact"
            ? { kind: "exact", repetitions: Number(set.repetitions) as Repetitions }
            : { kind: "range", minimum: Number(set.minimum) as Repetitions, maximum: Number(set.maximum) as Repetitions },
        })),
        ...(exercise.restSeconds.trim().length === 0 ? {} : { restSeconds: restSeconds as Seconds }),
        ...(exercise.notes.trim().length === 0 ? {} : { notes: exercise.notes.trim() }),
      };
    }),
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

  if (routine === null) {
    if (exerciseId === undefined) return;
    routineName.value = "Nueva rutina";
    routineVariants.value = [{ name: "Principal", exercises: [newExercise(exerciseId)] }];
  } else {
    formFromRoutine(routine.value);
  }
  editingRoutineId.value = routineId ?? null;
  await nextTick();
  routineEditor.value?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const saveRoutine = async (): Promise<void> => {
  const draft = createDraft();

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
  routineName.value = "";
  routineVariants.value = [];
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

const cancelRoutine = (): void => {
  routineName.value = "";
  routineVariants.value = [];
  editingRoutineId.value = null;
  if (props.routinesOnly) emit("closeRoutineEditor");
};

const addVariant = (): void => {
  const exerciseId = activeExercises.value[0]?.id;
  if (exerciseId !== undefined) routineVariants.value.push({ name: `Variante ${routineVariants.value.length + 1}`, exercises: [newExercise(exerciseId)] });
};

const removeVariant = (index: number): void => {
  if (routineVariants.value.length > 1) routineVariants.value.splice(index, 1);
};

const addExercise = (variant: EditableVariant): void => {
  const exerciseId = activeExercises.value.find((exercise) => !variant.exercises.some((entry) => entry.exerciseId === exercise.id))?.id;
  if (exerciseId !== undefined) variant.exercises.push(newExercise(exerciseId));
};

const removeExercise = (variant: EditableVariant, index: number): void => {
  if (variant.exercises.length > 1) variant.exercises.splice(index, 1);
};

const addSet = (exercise: EditableExercise): void => {
  exercise.sets.push({ type: "normal", targetKind: "exact", repetitions: 8, minimum: 8, maximum: 8 });
};

const removeSet = (exercise: EditableExercise, index: number): void => {
  if (exercise.sets.length > 1) exercise.sets.splice(index, 1);
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
    <header><p class="eyebrow">{{ routinesOnly ? "Rutinas locales" : "Configuración local" }}</p><h2 id="manager-title">{{ routinesOnly ? "Rutinas" : "Catálogo y rutinas" }}</h2></header>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>
    <p v-if="message" class="success" role="status">{{ message }}</p>

    <template v-if="!routinesOnly">
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
    </template>

    <section class="manager-heading"><h3>Rutinas</h3><button type="button" @click="startRoutine()">Nueva rutina</button></section>
    <ul class="card-list"><li v-for="routine in activeRoutines" :key="routine.id"><strong>{{ routine.name }}</strong><span>{{ routine.variantCount }} variantes</span><div class="inline-actions"><button type="button" class="secondary-action" @click="startRoutine(routine.id)">Editar estructura</button><button type="button" class="secondary-action" @click="changeRoutineStatus(routine.id, true)">Archivar</button></div></li></ul>
    <section v-if="archivedRoutines.length"><h3>Rutinas archivadas</h3><ul class="card-list"><li v-for="routine in archivedRoutines" :key="routine.id"><strong>{{ routine.name }}</strong><button type="button" class="secondary-action" @click="changeRoutineStatus(routine.id, false)">Restaurar</button></li></ul></section>

    <form v-if="editingRoutineId !== null || routineVariants.length" ref="routineEditor" class="editor-card" @submit.prevent="saveRoutine">
      <h3>{{ editingRoutineId ? "Editar rutina" : "Nueva rutina" }}</h3>
      <label class="field">Nombre <input v-model="routineName" required /></label>
      <fieldset v-for="(variant, variantIndex) in routineVariants" :key="variantIndex" class="editor-card">
        <legend>Variante {{ variantIndex + 1 }}</legend>
        <label class="field">Nombre de variante <input v-model="variant.name" required /></label>
        <fieldset v-for="(exercise, exerciseIndex) in variant.exercises" :key="exerciseIndex" class="editor-card">
          <legend>Ejercicio {{ exerciseIndex + 1 }}</legend>
          <label class="field">Ejercicio
            <select v-model="exercise.exerciseId" required>
              <option v-for="availableExercise in activeExercises" :key="availableExercise.id" :value="availableExercise.id" :disabled="availableExercise.id !== exercise.exerciseId && variant.exercises.some((entry) => entry.exerciseId === availableExercise.id)">{{ availableExercise.name }}</option>
            </select>
          </label>
          <label class="field">Lateralidad
            <select v-model="exercise.laterality"><option value="bilateral">Bilateral</option><option value="unilateral">Unilateral</option><option value="alternating">Alternada</option></select>
          </label>
          <label class="field">Descanso (s, opcional) <input v-model="exercise.restSeconds" type="number" min="0" step="1" /></label>
          <label class="field">Notas <input v-model="exercise.notes" /></label>
          <fieldset v-for="(set, setIndex) in exercise.sets" :key="setIndex" class="editor-card">
            <legend>Serie {{ setIndex + 1 }}</legend>
            <label class="field">Tipo <select v-model="set.type"><option value="warmup">Calentamiento</option><option value="normal">Normal</option><option value="drop">Descendente</option><option value="failure">Fallo</option></select></label>
            <label class="field">Objetivo <select v-model="set.targetKind"><option value="exact">Repeticiones exactas</option><option value="range">Rango</option></select></label>
            <label v-if="set.targetKind === 'exact'" class="field">Repeticiones <input v-model.number="set.repetitions" type="number" min="1" step="1" required /></label>
            <template v-else>
              <label class="field">Mínimo <input v-model.number="set.minimum" type="number" min="1" step="1" required /></label>
              <label class="field">Máximo <input v-model.number="set.maximum" type="number" min="1" step="1" required /></label>
            </template>
            <button type="button" class="secondary-action" :disabled="exercise.sets.length === 1" @click="removeSet(exercise, setIndex)">Quitar serie</button>
          </fieldset>
          <div class="inline-actions"><button type="button" class="secondary-action" @click="addSet(exercise)">Añadir serie</button><button type="button" class="secondary-action" :disabled="variant.exercises.length === 1" @click="removeExercise(variant, exerciseIndex)">Quitar ejercicio</button></div>
        </fieldset>
        <div class="inline-actions"><button type="button" class="secondary-action" @click="addExercise(variant)">Añadir ejercicio</button><button type="button" class="secondary-action" :disabled="routineVariants.length === 1" @click="removeVariant(variantIndex)">Quitar variante</button></div>
      </fieldset>
      <button type="button" class="secondary-action" @click="addVariant">Añadir variante</button>
      <div class="inline-actions"><button type="submit">Guardar rutina</button><button type="button" class="secondary-action" @click="cancelRoutine">Cancelar</button></div>
    </form>
  </section>
</template>
