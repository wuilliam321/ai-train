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

const maxRestSeconds = ref(60);
const showRestSettings = ref(false);

const remainingSeconds = computed(() => rest.value === null ? 0 : Math.max(0, Math.ceil((Date.parse(rest.value.endsAt) - now.value) / 1000)));

watch(rest, (newRest, oldRest) => {
  if (newRest && (!oldRest || newRest.endsAt !== oldRest.endsAt)) {
    maxRestSeconds.value = Math.max(1, Math.ceil((Date.parse(newRest.endsAt) - Date.now()) / 1000));
    showRestSettings.value = false;
  }
});

const visualExercises = computed(() => {
  return props.workout.exercises.map((exercise, index) => ({ exercise, index })).sort((a, b) => {
    const aCompleted = a.exercise.sets.length > 0 && a.exercise.sets.every(s => s.status !== 'pending');
    const bCompleted = b.exercise.sets.length > 0 && b.exercise.sets.every(s => s.status !== 'pending');
    if (aCompleted && !bCompleted) return 1;
    if (!aCompleted && bCompleted) return -1;
    return a.index - b.index;
  });
});

const visualSets = (exercise: any) => {
  return exercise.sets.map((set: any, index: number) => ({ set, index })).sort((a: any, b: any) => {
    const aCompleted = a.set.status !== 'pending';
    const bCompleted = b.set.status !== 'pending';
    if (aCompleted && !bCompleted) return 1;
    if (!aCompleted && bCompleted) return -1;
    return a.index - b.index;
  });
};

const adjustValue = (set: WorkoutSet, field: 'weight' | 'repetitions', amount: number) => {
  const entry = entryFor(set);
  const current = Number(entry[field]) || 0;
  let newValue = current + amount;
  if (field === 'repetitions') {
    newValue = Math.max(1, Math.round(newValue));
  } else {
    newValue = Math.max(0, newValue);
  }
  entry[field] = newValue.toString();
};

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

  for (const exercise of workout.exercises) {
    exercise.sets.forEach((set, setPosition) => {
      if (set.status === "pending") {
        const entry = setEntries[set.id];
        const refList = references.value[exercise.exercise.id];
        const ref = refList?.find((r) => r.setPosition === setPosition);
        if (entry && ref) {
          if (!entry.weight || entry.weight === "0") {
            entry.weight = ref.weight.amount.toString();
          }
          if (!entry.repetitions || entry.repetitions === "0") {
            entry.repetitions = ref.repetitions.toString();
          }
        }
      }
    });
  }
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
  showRestSettings.value = false;
};

const cancelRest = async (): Promise<void> => {
  const result = await props.training.cancelRest();

  if (!result.ok) {
    error.value = "No se pudo cancelar el descanso.";
    return;
  }

  rest.value = null;
  showRestSettings.value = false;
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

    <aside v-if="rest" class="rest-timer-fixed" aria-live="polite">
      <div class="rest-timer-progress" :style="{ width: `${Math.min(100, (remainingSeconds / maxRestSeconds) * 100)}%` }"></div>
      <div class="rest-timer-content">
        <strong class="rest-timer-text">Descanso: {{ remainingSeconds }} s</strong>
        <div class="rest-timer-actions">
          <button type="button" class="icon-action" @click="showRestSettings = !showRestSettings">⚙️</button>
          <button type="button" class="icon-action" @click="cancelRest">❌</button>
        </div>
      </div>
      <div v-if="showRestSettings" class="rest-timer-settings">
        <label class="compact-field">Segundos <input v-model="restDuration" inputmode="numeric" type="number" min="0" /></label>
        <button type="button" class="secondary-action" @click="adjustRest">Ajustar</button>
      </div>
    </aside>

    <article v-for="exItem in visualExercises" :key="exItem.exercise.id" class="exercise-card">
      <header class="exercise-header">
        <div>
          <h3>{{ exItem.exercise.exercise.name }}</h3>
          <span>{{ exItem.exercise.restSeconds }} s de descanso</span>
        </div>
        <div class="inline-actions">
          <button type="button" class="icon-action" :disabled="exItem.index === 0" @click="moveExercise(exItem.exercise.id, exItem.index - 1)">↑</button>
          <button type="button" class="icon-action" :disabled="exItem.index === workout.exercises.length - 1" @click="moveExercise(exItem.exercise.id, exItem.index + 1)">↓</button>
          <button type="button" class="icon-action" @click="removeExercise(exItem.exercise.id)">×</button>
        </div>
      </header>

      <div v-for="setItem in visualSets(exItem.exercise)" :key="setItem.set.id" class="set-card">
        <div class="set-heading">
          <div class="inline-actions">
            <strong>Serie {{ setItem.index + 1 }}</strong>
            <button type="button" class="icon-action" :disabled="setItem.index === 0" @click="moveSet(setItem.set.id, setItem.index - 1)">↑</button>
            <button type="button" class="icon-action" :disabled="setItem.index === exItem.exercise.sets.length - 1" @click="moveSet(setItem.set.id, setItem.index + 1)">↓</button>
          </div>
          <span>{{ target(setItem.set) }}</span>
          <span>{{ formatReference(referenceFor(exItem.exercise.exercise.id, setItem.index)) }}</span>
        </div>
        
        <template v-if="setItem.set.status === 'pending'">
          <div class="set-fields">
            <div class="stepper-row">
              <label class="compact-field">
                Tipo
                <select v-model="entryFor(setItem.set).type" @change="saveSetType(setItem.set)">
                  <option value="warmup">Calentamiento</option>
                  <option value="normal">Normal</option>
                  <option value="drop">Descendente</option>
                  <option value="failure">Fallo</option>
                </select>
              </label>
              <label class="compact-field">
                Esfuerzo
                <select v-model="entryFor(setItem.set).effortKind">
                  <option value="none">—</option>
                  <option value="rpe">RPE</option>
                  <option value="rir">RIR</option>
                </select>
              </label>
              <label v-if="entryFor(setItem.set).effortKind !== 'none'" class="compact-field">
                Valor
                <input v-model="entryFor(setItem.set).effortValue" inputmode="decimal" type="number" min="0" max="10" step="1" />
              </label>
            </div>
            
            <div class="stepper-group">
              <span class="stepper-label">kg</span>
              <div class="stepper-controls">
                <button type="button" @click="adjustValue(setItem.set, 'weight', -5)">-5</button>
                <button type="button" @click="adjustValue(setItem.set, 'weight', -1)">-1</button>
                <input v-model="entryFor(setItem.set).weight" inputmode="decimal" type="number" min="0" step="0.5" />
                <button type="button" @click="adjustValue(setItem.set, 'weight', 1)">+1</button>
                <button type="button" @click="adjustValue(setItem.set, 'weight', 5)">+5</button>
              </div>
            </div>

            <div class="stepper-group">
              <span class="stepper-label">Reps</span>
              <div class="stepper-controls">
                <button type="button" @click="adjustValue(setItem.set, 'repetitions', -5)">-5</button>
                <button type="button" @click="adjustValue(setItem.set, 'repetitions', -1)">-1</button>
                <input v-model="entryFor(setItem.set).repetitions" inputmode="numeric" type="number" min="1" step="1" />
                <button type="button" @click="adjustValue(setItem.set, 'repetitions', 1)">+1</button>
                <button type="button" @click="adjustValue(setItem.set, 'repetitions', 5)">+5</button>
              </div>
            </div>
          </div>
          <div class="inline-actions">
            <button type="button" class="complete-action" :disabled="busy" @click="completeSet(setItem.set)">Completar</button>
            <button type="button" class="secondary-action" @click="removeSet(setItem.set)">Eliminar</button>
          </div>
        </template>
        <div v-else class="inline-actions">
          <strong>Completada: {{ setItem.set.weight.amount }} {{ setItem.set.weight.unit }} × {{ setItem.set.repetitions }}</strong>
          <button type="button" class="secondary-action" @click="reopenSet(setItem.set)">Reabrir</button>
        </div>
      </div>
      <button type="button" class="secondary-action" @click="addSet(exItem.exercise.id)">Añadir serie</button>
    </article>

    <section class="add-exercise" aria-labelledby="add-exercise-title">
      <h3 id="add-exercise-title">Añadir ejercicio</h3>
      <div class="inline-actions"><select v-model="exerciseToAdd"><option v-for="exercise in availableExercises" :key="exercise.id" :value="exercise.id">{{ exercise.name }}</option></select><button type="button" @click="addExercise">Añadir</button></div>
    </section>
  </section>
</template>
