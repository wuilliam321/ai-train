<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import type {
  ActiveWorkoutSession,
  ApplicationResult,
  Effort,
  Exercise,
  PreviousSetReference,
  Repetitions,
  RestPeriod,
  Seconds,
  SetType,
  TrainingOrchestrator,
  WeightAmount,
  WorkoutSet,
} from "../core";

const props = defineProps<{
  readonly training: TrainingOrchestrator;
  readonly workout: ActiveWorkoutSession;
  readonly availableExercises: readonly Exercise[];
}>();

const emit = defineEmits<{
  updated: [workout: ActiveWorkoutSession];
  discard: [];
  finish: [];
}>();

interface SetEntry {
  weight: string;
  repetitions: string;
  effortKind: "none" | "rpe" | "rir";
  effortValue: string;
  type: SetType;
}

const setEntries = reactive<Record<string, SetEntry>>({});
const references = ref<Record<string, readonly PreviousSetReference[]>>({});
const rest = ref<RestPeriod | null>(null);
const now = ref(Date.now());
const restDuration = ref("60");
const exerciseToAdd = ref(props.availableExercises[0]?.id ?? "");
const error = ref<string | null>(null);
const busy = ref(false);

const target = (set: WorkoutSet): string => {
  if (set.target === undefined) {
    return "Sin objetivo";
  }

  return set.target.kind === "exact" ? `${set.target.repetitions} repeticiones` : `${set.target.minimum}–${set.target.maximum} repeticiones`;
};

const entryFor = (set: WorkoutSet): SetEntry => setEntries[set.id] ?? {
  weight: set.weight?.amount.toString() ?? "",
  repetitions: set.repetitions?.toString() ?? "",
  effortKind: set.effort?.kind ?? "none",
  effortValue: set.effort?.value.toString() ?? "",
  type: set.type,
};

const syncEntries = (workout: ActiveWorkoutSession): void => {
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      setEntries[set.id] = entryFor(set);
    }
  }
};

const refreshReferences = async (workout: ActiveWorkoutSession): Promise<void> => {
  const exerciseIds = [...new Set(workout.exercises.map((exercise) => exercise.exercise.id))];
  const loaded = await Promise.all(exerciseIds.map(async (exerciseId) => [
    exerciseId,
    await props.training.getPreviousSetReferences({ exerciseId, limit: 20 }),
  ] as const));
  references.value = Object.fromEntries(loaded.flatMap(([exerciseId, result]) => result.ok ? [[exerciseId, result.value]] : []));
};

const refreshRest = async (): Promise<void> => {
  const period = await props.training.getRestPeriod();

  if (period.ok) {
    rest.value = period.value;
  }
};

const update = async (pending: ApplicationResult<ActiveWorkoutSession>): Promise<void> => {
  const result = await pending;

  if (!result.ok) {
    error.value = "No se pudo guardar el cambio.";
    return;
  }

  error.value = null;
  emit("updated", result.value);
  syncEntries(result.value);
  await Promise.all([refreshReferences(result.value), refreshRest()]);
};

const referenceFor = (exerciseId: string, position: number): PreviousSetReference | null =>
  references.value[exerciseId]?.find((reference) => reference.setPosition === position) ?? null;

const formatReference = (reference: PreviousSetReference | null): string => reference === null
  ? "Sin referencia previa"
  : `${reference.weight.amount} ${reference.weight.unit} × ${reference.repetitions}`;

const completeSet = async (set: WorkoutSet): Promise<void> => {
  const entry = entryFor(set);
  const weight = Number(entry.weight);
  const repetitions = Number(entry.repetitions);

  if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(repetitions) || repetitions < 1) {
    error.value = "Ingresa peso y repeticiones válidos.";
    return;
  }

  const effortValue = Number(entry.effortValue);
  const effort: Effort | undefined = entry.effortKind === "none" ? undefined : {
    kind: entry.effortKind,
    value: effortValue,
  };
  busy.value = true;
  const result = props.training.completeWorkoutSet({
    workoutSetId: set.id,
    weight: { amount: weight as WeightAmount, unit: "kg" },
    repetitions: repetitions as Repetitions,
    ...(effort === undefined ? {} : { effort }),
  });
  busy.value = false;
  await update(result);
};

const saveSetType = async (set: WorkoutSet): Promise<void> => {
  const entry = entryFor(set);
  await update(props.training.updateWorkoutSet({ workoutSetId: set.id, type: entry.type }));
};

const reopenSet = async (set: WorkoutSet): Promise<void> => {
  await update(props.training.reopenWorkoutSet(set.id));
};

const addSet = async (workoutExerciseId: string): Promise<void> => {
  await update(props.training.addWorkoutSet({ workoutExerciseId: workoutExerciseId as never, type: "normal" }));
};

const removeSet = async (set: WorkoutSet): Promise<void> => {
  await update(props.training.removeWorkoutSet(set.id));
};

const moveSet = async (workoutSetId: string, position: number): Promise<void> => {
  await update(props.training.moveWorkoutSet({ workoutSetId: workoutSetId as never, position }));
};

const addExercise = async (): Promise<void> => {
  if (exerciseToAdd.value.length === 0) {
    return;
  }

  await update(props.training.addWorkoutExercise({ exerciseId: exerciseToAdd.value as never }));
};

const moveExercise = async (workoutExerciseId: string, position: number): Promise<void> => {
  await update(props.training.moveWorkoutExercise({ workoutExerciseId: workoutExerciseId as never, position }));
};

const removeExercise = async (workoutExerciseId: string): Promise<void> => {
  await update(props.training.removeWorkoutExercise(workoutExerciseId as never));
};

const remainingSeconds = computed(() => rest.value === null ? 0 : Math.max(0, Math.ceil((Date.parse(rest.value.endsAt) - now.value) / 1000)));

const adjustRest = async (): Promise<void> => {
  const duration = Number(restDuration.value);

  if (!Number.isInteger(duration) || duration < 0) {
    error.value = "El descanso debe ser un número entero de segundos.";
    return;
  }

  const result = await props.training.setRestDuration({ duration: duration as Seconds });

  if (!result.ok) {
    error.value = "No se pudo ajustar el descanso.";
    return;
  }

  rest.value = result.value;
};

const cancelRest = async (): Promise<void> => {
  const result = await props.training.cancelRest();

  if (!result.ok) {
    error.value = "No se pudo cancelar el descanso.";
    return;
  }

  rest.value = null;
};

let timer: number | undefined;

watch(() => props.workout, (workout) => {
  syncEntries(workout);
  void refreshReferences(workout);
  void refreshRest();
}, { immediate: true });

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now();
    void refreshRest();
  }, 1000);
});

onUnmounted(() => {
  if (timer !== undefined) {
    window.clearInterval(timer);
  }
});
</script>

<template>
  <section class="workout-session" aria-labelledby="active-title">
    <header class="session-header">
      <div>
        <p class="eyebrow">Entrenamiento activo</p>
        <h2 id="active-title">{{ workout.routine?.name ?? "Entrenamiento vacío" }}</h2>
      </div>
      <div class="inline-actions"><button type="button" class="secondary-action" :disabled="busy" @click="emit('discard')">Descartar</button><button type="button" :disabled="busy" @click="emit('finish')">Finalizar</button></div>
    </header>

    <p v-if="error" class="notice" role="alert">{{ error }}</p>

    <aside v-if="rest" class="rest-timer" aria-live="polite">
      <strong>Descanso: {{ remainingSeconds }} s</strong>
      <label class="compact-field">Segundos <input v-model="restDuration" inputmode="numeric" type="number" min="0" /></label>
      <div class="inline-actions">
        <button type="button" class="secondary-action" @click="adjustRest">Ajustar</button>
        <button type="button" class="secondary-action" @click="cancelRest">Cancelar</button>
      </div>
    </aside>

    <article v-for="(exercise, exercisePosition) in workout.exercises" :key="exercise.id" class="exercise-card">
      <header class="exercise-header">
        <div>
          <h3>{{ exercise.exercise.name }}</h3>
          <span>{{ exercise.restSeconds }} s de descanso</span>
        </div>
        <div class="inline-actions">
          <button type="button" class="icon-action" :disabled="exercisePosition === 0" @click="moveExercise(exercise.id, exercisePosition - 1)">↑</button>
          <button type="button" class="icon-action" :disabled="exercisePosition === workout.exercises.length - 1" @click="moveExercise(exercise.id, exercisePosition + 1)">↓</button>
          <button type="button" class="icon-action" @click="removeExercise(exercise.id)">×</button>
        </div>
      </header>

      <div v-for="(set, setPosition) in exercise.sets" :key="set.id" class="set-card">
        <div class="set-heading">
          <div class="inline-actions"><strong>Serie {{ setPosition + 1 }}</strong><button type="button" class="icon-action" :disabled="setPosition === 0" @click="moveSet(set.id, setPosition - 1)">↑</button><button type="button" class="icon-action" :disabled="setPosition === exercise.sets.length - 1" @click="moveSet(set.id, setPosition + 1)">↓</button></div>
          <span>{{ target(set) }}</span>
          <span>{{ formatReference(referenceFor(exercise.exercise.id, setPosition)) }}</span>
        </div>
        <template v-if="set.status === 'pending'">
          <div class="set-fields">
            <label class="compact-field">Tipo <select v-model="entryFor(set).type" @change="saveSetType(set)"><option value="warmup">Calentamiento</option><option value="normal">Normal</option><option value="drop">Descendente</option><option value="failure">Fallo</option></select></label>
            <label class="compact-field">kg <input v-model="entryFor(set).weight" inputmode="decimal" type="number" min="0" step="0.5" /></label>
            <label class="compact-field">Reps <input v-model="entryFor(set).repetitions" inputmode="numeric" type="number" min="1" step="1" /></label>
            <label class="compact-field">Esfuerzo <select v-model="entryFor(set).effortKind"><option value="none">—</option><option value="rpe">RPE</option><option value="rir">RIR</option></select></label>
            <label v-if="entryFor(set).effortKind !== 'none'" class="compact-field">Valor <input v-model="entryFor(set).effortValue" inputmode="decimal" type="number" min="0" max="10" step="1" /></label>
          </div>
          <div class="inline-actions"><button type="button" :disabled="busy" @click="completeSet(set)">Completar</button><button type="button" class="secondary-action" @click="removeSet(set)">Eliminar</button></div>
        </template>
        <div v-else class="inline-actions"><strong>Completada: {{ set.weight.amount }} {{ set.weight.unit }} × {{ set.repetitions }}</strong><button type="button" class="secondary-action" @click="reopenSet(set)">Reabrir</button></div>
      </div>
      <button type="button" class="secondary-action" @click="addSet(exercise.id)">Añadir serie</button>
    </article>

    <section class="add-exercise" aria-labelledby="add-exercise-title">
      <h3 id="add-exercise-title">Añadir ejercicio</h3>
      <div class="inline-actions"><select v-model="exerciseToAdd"><option v-for="exercise in availableExercises" :key="exercise.id" :value="exercise.id">{{ exercise.name }}</option></select><button type="button" @click="addExercise">Añadir</button></div>
    </section>
  </section>
</template>
