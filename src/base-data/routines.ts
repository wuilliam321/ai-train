import type { ExerciseId, Repetitions, Seconds } from "../core/domain/primitives";
import type {
  Laterality,
  RoutineDraft,
  RoutineSetDraft,
  SetType,
} from "../core/domain/routine";

export interface BaseRoutineExercise {
  readonly exerciseName: string;
  readonly sets: readonly RoutineSetDraft[];
  readonly laterality: Laterality;
  readonly restSeconds?: Seconds;
  readonly notes?: string;
}

export interface BaseRoutineVariant {
  readonly name: string;
  readonly exercises: readonly BaseRoutineExercise[];
}

export interface BaseRoutine {
  readonly name: string;
  readonly variants: readonly BaseRoutineVariant[];
}

const exact = (repetitions: number) => ({
  kind: "exact" as const,
  repetitions: repetitions as Repetitions,
});

const range = (minimum: number, maximum: number) => ({
  kind: "range" as const,
  minimum: minimum as Repetitions,
  maximum: maximum as Repetitions,
});

const sets = (count: number, repetitions: number, type: SetType = "normal"): readonly RoutineSetDraft[] =>
  Array.from({ length: count }, () => ({ type, repetitions: exact(repetitions) }));

const prescribedSets = (
  repetitions: readonly number[],
  type: SetType = "normal",
): readonly RoutineSetDraft[] => repetitions.map((value) => ({ type, repetitions: exact(value) }));

const exercise = (
  exerciseName: string,
  setPrescriptions: readonly RoutineSetDraft[],
  laterality: Laterality = "bilateral",
  notes?: string,
): BaseRoutineExercise => ({
  exerciseName,
  sets: setPrescriptions,
  laterality,
  ...(notes === undefined ? {} : { notes }),
});

const gymHome = (
  gym: readonly BaseRoutineExercise[],
  home: readonly BaseRoutineExercise[],
): readonly BaseRoutineVariant[] => [
  { name: "Gym", exercises: gym },
  { name: "Casa", exercises: home },
];

const lowerBase = (squatRepetitions: number, lungeRepetitions: number, deadliftRepetitions: number) => [
  exercise("Squat", sets(4, squatRepetitions)),
  exercise("Lunge", sets(4, lungeRepetitions), "unilateral"),
  exercise("Deadlift", sets(4, deadliftRepetitions)),
  exercise("Sumo Deadlift", sets(4, deadliftRepetitions)),
];

const failureSets = (count: number): readonly RoutineSetDraft[] =>
  sets(count, 1, "failure");

export const baseRoutines: readonly BaseRoutine[] = [
  {
    name: "Lower Body Posterior Chain",
    variants: gymHome(
      [
        exercise("Deadlift", sets(4, 10)),
        exercise("Good Morning", sets(4, 15)),
        exercise("Cable Deadlift", sets(4, 15)),
        exercise("Standing Leg Curl", sets(4, 12), "unilateral"),
        exercise("Leg Curl", sets(4, 20)),
        exercise("Quadruped Kickback", sets(4, 20), "unilateral", "Completar todas las series de una pierna antes de cambiar."),
        exercise("Quadruped Hip Extension", sets(4, 20), "unilateral", "Completar todas las series de una pierna antes de cambiar."),
        exercise("Hip Abduction", sets(4, 20)),
      ],
      [
        exercise("Deadlift", sets(4, 20)),
        exercise("Good Morning", sets(4, 15)),
        exercise("Standing Hip Thrust", sets(4, 20)),
        exercise("Standing Leg Curl", sets(4, 12), "unilateral", "Alternativa: leg curl acostado unilateral."),
        exercise("Leg Curl", sets(4, 20)),
        exercise("Quadruped Kickback", sets(4, 20), "unilateral", "Completar todas las series de una pierna antes de cambiar."),
        exercise("Quadruped Hip Extension", sets(4, 20), "unilateral", "Completar todas las series de una pierna antes de cambiar."),
        exercise("Hip Abduction", sets(4, 20)),
      ],
    ),
  },
  {
    name: "Shoulders and Triceps Foundation",
    variants: gymHome(
      [
        exercise("Around the World", sets(3, 10), "bilateral", "Usar poco peso para preparar el músculo."),
        exercise("Shoulder Press", sets(4, 10)),
        exercise("Front Raise", sets(4, 10), "bilateral", "Con cable."),
        exercise("Upright Row", sets(4, 10)),
        exercise("Lateral Raise", sets(4, 10), "bilateral", "En máquina."),
        exercise("Rear Delt Fly", sets(4, 10)),
        exercise("Triceps Overhead Extension", sets(4, 20)),
        exercise("Triceps Kickback", sets(4, 20)),
      ],
      [
        exercise("Around the World", sets(3, 10), "bilateral", "Usar poco peso para preparar el músculo."),
        exercise("Shoulder Press", sets(4, 15)),
        exercise("Front Raise", sets(4, 20), "bilateral", "Con disco o mancuerna."),
        exercise("Upright Row", sets(4, 12)),
        exercise("Lateral Raise", sets(4, 12)),
        exercise("Rear Delt Fly", sets(4, 15)),
        exercise("Triceps Overhead Extension", sets(4, 20)),
        exercise("Triceps Kickback", sets(4, 20)),
      ],
    ),
  },
  {
    name: "Lower Body Squat and Lunge",
    variants: gymHome(
      [
        exercise("Squat", [
          ...sets(2, 20, "warmup"),
          ...sets(4, 10),
        ]),
        exercise("Step Up", sets(4, 10), "unilateral", "Añadir mancuernas cuando el movimiento esté dominado."),
        exercise("Walking Lunge", sets(3, 20), "alternating", "Las repeticiones representan pasos."),
        exercise("Sumo Squat", sets(4, 10), "bilateral", "Combinar cada serie con Crab Walk; banda opcional."),
        exercise("Crab Walk", sets(4, 10), "alternating", "Completar después de Sumo Squat en cada serie."),
        exercise("Leg Extension", sets(3, 10), "unilateral", "Una pierna, luego la otra y ambas con el doble de peso."),
        exercise("Hip Adduction", sets(4, 15)),
        exercise("Hip Abduction", sets(4, 15)),
      ],
      [
        exercise("Squat", [
          ...sets(2, 20, "warmup"),
          ...sets(4, 10),
        ]),
        exercise("Step Up", sets(4, 10), "unilateral", "Añadir mancuernas cuando el movimiento esté dominado."),
        exercise("Walking Lunge", sets(3, 20), "alternating", "Las repeticiones representan pasos."),
        exercise("Sumo Squat", sets(4, 20), "bilateral", "Combinar cada serie con Crab Walk; banda opcional."),
        exercise("Crab Walk", sets(4, 10), "alternating", "Completar después de Sumo Squat en cada serie."),
        exercise("Leg Extension", sets(3, 20), "unilateral", "Alternar pierna y sostener un segundo arriba."),
        exercise("Hip Adduction", sets(4, 20)),
        exercise("Hip Abduction", sets(4, 20)),
      ],
    ),
  },
  {
    name: "Back and Biceps Foundation",
    variants: gymHome(
      [
        exercise("Bent-Over Row", sets(4, 12), "bilateral", "Aguantar un segundo atrás."),
        exercise("Single-Arm Dumbbell Row", sets(4, 10), "unilateral"),
        exercise("Pullover", sets(4, 15)),
        exercise("Seated Row", sets(4, 12), "bilateral", "Aguantar un segundo atrás y volver lento."),
        exercise("Biceps Curl", sets(4, 15), "bilateral", "En polea."),
        exercise("Seated Biceps Curl", sets(4, 10)),
      ],
      [
        exercise("Bent-Over Row", sets(4, 10), "bilateral", "Con banda y aguante de un segundo atrás."),
        exercise("Single-Arm Dumbbell Row", sets(4, 20), "unilateral"),
        exercise("Pullover", sets(4, 10)),
        exercise("Seated Row", sets(4, 10), "bilateral", "Aguantar un segundo atrás y volver lento."),
        exercise("Biceps Curl", sets(4, 20)),
        exercise("Alternating Biceps Curl", sets(4, 15), "alternating"),
      ],
    ),
  },
  {
    name: "Back and Chest Strength",
    variants: [{
      name: "Principal",
      exercises: [
        exercise("Pull Up", failureSets(4), "bilateral", "Sin objetivo de repeticiones: completar al fallo."),
        exercise("Lat Pulldown", prescribedSets([20, 18, 15, 12]), "bilateral", "Aumentar el peso en cada serie."),
        exercise("Single-Arm Dumbbell Row", prescribedSets([20, 18, 15, 12]), "unilateral"),
        exercise("Bench Press", sets(4, 20)),
        exercise("Chest Fly", sets(4, 15)),
        exercise("Pec Deck", sets(4, 20)),
        exercise("Biceps Curl", [
          { type: "normal", repetitions: range(15, 20) },
          { type: "normal", repetitions: range(15, 20) },
          { type: "normal", repetitions: range(15, 20) },
        ]),
      ],
    }],
  },
  {
    name: "Lower Body Hip Thrust",
    variants: gymHome(
      [...lowerBase(12, 10, 10), exercise("Hip Thrust", sets(4, 10), "bilateral", "Añadir 10 pulsos y sostener 10 segundos arriba en cada serie.")],
      [...lowerBase(20, 15, 12), exercise("Hip Thrust", sets(4, 10), "bilateral", "Añadir 10 pulsos y sostener 10 segundos arriba en cada serie.")],
    ),
  },
  {
    name: "Lower Body Leg Extension",
    variants: gymHome(
      [...lowerBase(12, 10, 10), exercise("Leg Extension", sets(4, 10), "unilateral", "Completar 10 por pierna y 10 con ambas con el doble de peso.")],
      [...lowerBase(20, 15, 12), exercise("Leg Extension", sets(4, 10), "unilateral", "Completar 10 con pausa arriba y 10 rápidas por pierna.")],
    ),
  },
  {
    name: "Lower Body Kickback",
    variants: gymHome(
      [...lowerBase(12, 10, 10), exercise("Quadruped Kickback", sets(4, 10), "unilateral"), exercise("Hip Abduction", sets(4, 20)), exercise("Hip Adduction", sets(4, 20))],
      [...lowerBase(20, 15, 12), exercise("Quadruped Kickback", sets(4, 20), "unilateral"), exercise("Hip Abduction", sets(4, 20)), exercise("Hip Adduction", sets(4, 20))],
    ),
  },
  {
    name: "Chest Alternative",
    variants: [{
      name: "Principal",
      exercises: [
        exercise("Dip", failureSets(4), "bilateral", "Calentamiento al fallo."),
        exercise("Bench Press", sets(4, 12)),
        exercise("Incline Bench Press", sets(4, 15)),
        exercise("Push Up", failureSets(4), "bilateral", "Sin objetivo de repeticiones: completar al fallo."),
        exercise("Chest Fly", sets(4, 12)),
        exercise("Chest Press", sets(4, 10)),
        exercise("Incline Push Up", failureSets(3), "bilateral", "Sin objetivo de repeticiones: completar al fallo."),
        exercise("Decline Push Up", failureSets(3), "bilateral", "Sin objetivo de repeticiones: completar al fallo."),
      ],
    }],
  },
  {
    name: "Shoulders Triceps Volume",
    variants: [{
      name: "Principal",
      exercises: [
        exercise("Plate Rotation", sets(4, 20)),
        exercise("Around the World", sets(4, 20)),
        exercise("Front Raise with Twist", sets(4, 10)),
        exercise("Front Raise with Wrist Twist", sets(4, 10)),
        exercise("Lateral Raise Isometric", sets(4, 10), "alternating", "Mantener el brazo contrario arriba."),
        exercise("Lateral Raise to Side", sets(4, 10)),
        exercise("Shoulder Press with Pause", sets(4, 10)),
        exercise("Dip", sets(4, 25), "bilateral", "100 repeticiones totales; la fuente no fija su distribución, se resuelve en 4 series de 25."),
        exercise("Abdominal Exercise", sets(4, 25), "bilateral", "100 repeticiones totales; la fuente no fija su distribución, se resuelve en 4 series de 25."),
      ],
    }],
  },
  {
    name: "Back Biceps Volume",
    variants: gymHome(
      [
        exercise("Chin Up", sets(4, 10)),
        exercise("Pull Up", sets(4, 10)),
        exercise("Seated Row", sets(4, 12)),
        exercise("Single-Arm Dumbbell Row", sets(4, 10), "unilateral"),
        exercise("Supinated Bent-Over Row", sets(4, 10)),
        exercise("Hammer Curl", sets(4, 10)),
        exercise("Preacher Curl", sets(4, 10)),
        exercise("Abdominal Exercise", sets(4, 10)),
      ],
      [
        exercise("Chin Up", sets(4, 20)),
        exercise("Pull Up", sets(4, 20)),
        exercise("Seated Row", sets(4, 20)),
        exercise("Single-Arm Dumbbell Row", sets(4, 10), "unilateral"),
        exercise("Supinated Bent-Over Row", sets(4, 10)),
        exercise("Hammer Curl", sets(4, 12)),
        exercise("Preacher Curl", sets(4, 10)),
        exercise("Abdominal Exercise", sets(4, 10)),
      ],
    ),
  },
  {
    name: "Lower Body Hip Focus",
    variants: gymHome(
      [
        exercise("Hyperextension", sets(4, 20)),
        exercise("Hip Thrust", sets(4, 10)),
        exercise("Quadruped Kickback", sets(6, 10), "unilateral", "Completar todas las series de una pierna antes de cambiar."),
        exercise("Standing Kickback", sets(3, 10), "unilateral"),
        exercise("Sumo Squat", sets(4, 10), "bilateral", "Contar una repetición al dejar la mancuerna."),
        exercise("Deadlift", sets(4, 15)),
      ],
      [
        exercise("Standing Hip Thrust", sets(4, 20)),
        exercise("Hip Thrust", sets(4, 20)),
        exercise("Quadruped Kickback", sets(6, 10), "unilateral", "Completar todas las series de una pierna antes de cambiar."),
        exercise("Standing Kickback", sets(3, 20), "unilateral"),
        exercise("Sumo Squat", sets(4, 10), "bilateral", "Una bajada y un pulso cuentan como una repetición."),
        exercise("Deadlift", sets(4, 20)),
      ],
    ),
  },
  {
    name: "Back and Abs",
    variants: gymHome(
      [
        exercise("Close-Grip Lat Pulldown", sets(4, 10)),
        exercise("Wide-Grip Lat Pulldown", sets(4, 10)),
        exercise("Seated Row", sets(4, 12)),
        exercise("Single-Arm Lat Pulldown", sets(3, 15), "unilateral"),
        exercise("Pull Apart", sets(4, 10)),
        exercise("Pullover", sets(3, 10)),
        exercise("Face Pull", sets(3, 10)),
      ],
      [
        exercise("Close-Grip Lat Pulldown", sets(4, 10)),
        exercise("Wide-Grip Lat Pulldown", sets(4, 10)),
        exercise("Seated Row", sets(4, 10)),
        exercise("Single-Arm Lat Pulldown", sets(3, 10), "unilateral"),
        exercise("Pull Apart", sets(4, 10)),
        exercise("Pullover", sets(3, 10)),
        exercise("Face Pull", sets(3, 10)),
      ],
    ),
  },
  {
    name: "Arms and Abs",
    variants: gymHome(
      [
        exercise("Biceps Curl", sets(4, 12)),
        exercise("Barbell Curl", sets(4, 10)),
        exercise("Hammer Curl", sets(4, 10), "alternating"),
        exercise("Preacher Curl", sets(4, 12), "unilateral"),
        exercise("French Press", sets(4, 10)),
        exercise("Cable Triceps Extension", sets(4, 10)),
        exercise("Dip", failureSets(4), "bilateral", "Sin objetivo de repeticiones: completar al fallo."),
      ],
      [
        exercise("Biceps Curl", sets(4, 10)),
        exercise("Barbell Curl", sets(4, 10)),
        exercise("Hammer Curl", [
          { type: "normal", repetitions: range(10, 15) },
          { type: "normal", repetitions: range(10, 15) },
          { type: "normal", repetitions: range(10, 15) },
          { type: "normal", repetitions: range(10, 15) },
        ], "alternating"),
        exercise("Preacher Curl", [
          { type: "normal", repetitions: range(12, 15) },
          { type: "normal", repetitions: range(12, 15) },
          { type: "normal", repetitions: range(12, 15) },
          { type: "normal", repetitions: range(12, 15) },
        ], "unilateral"),
        exercise("French Press", [
          { type: "normal", repetitions: range(15, 20) },
          { type: "normal", repetitions: range(15, 20) },
          { type: "normal", repetitions: range(15, 20) },
          { type: "normal", repetitions: range(15, 20) },
        ]),
        exercise("Cable Triceps Extension", sets(4, 10), "bilateral", "10 repeticiones por lado."),
        exercise("Dip", failureSets(4), "bilateral", "Sin objetivo de repeticiones: completar al fallo."),
      ],
    ),
  },
  {
    name: "Lower Body Squat Volume",
    variants: gymHome(
      [
        exercise("Squat", sets(6, 15)),
        exercise("Static Lunge", sets(3, 10), "unilateral"),
        exercise("Leg Extension", sets(6, 10), "unilateral"),
        exercise("Step Up", sets(4, 10), "unilateral"),
        exercise("Hip Abduction", sets(4, 40)),
      ],
      [
        exercise("Squat", sets(6, 20)),
        exercise("Static Lunge", sets(3, 10), "unilateral"),
        exercise("Leg Extension", sets(6, 20), "unilateral"),
        exercise("Step Up", sets(4, 10), "unilateral"),
        exercise("Hip Abduction", sets(4, 40)),
      ],
    ),
  },
  {
    name: "Lower Body Hamstrings",
    variants: gymHome(
      [
        exercise("Prone Leg Curl", sets(4, 15)),
        exercise("Standing Leg Curl", sets(4, 10), "unilateral"),
        exercise("Hip Thrust", sets(4, 15)),
        exercise("Bulgarian Split Squat", sets(3, 10), "unilateral"),
        exercise("Leg Extension", sets(4, 20), "unilateral"),
        exercise("Sissy Squat", sets(4, 15)),
        exercise("Hip Abduction", sets(4, 20)),
      ],
      [
        exercise("Prone Leg Curl", sets(4, 20)),
        exercise("Standing Leg Curl", sets(4, 20), "unilateral"),
        exercise("Hip Thrust", sets(4, 20)),
        exercise("Bulgarian Split Squat", sets(3, 10), "unilateral"),
        exercise("Leg Extension", sets(4, 20), "unilateral"),
        exercise("Sissy Squat", sets(4, 20)),
        exercise("Hip Abduction", sets(4, 20)),
      ],
    ),
  },
  {
    name: "Shoulders Arms",
    variants: gymHome(
      [
        exercise("Shoulder Press with Pause", sets(4, 10), "unilateral"),
        exercise("Shoulder Press", sets(4, 10), "unilateral"),
        exercise("Front Raise with Twist", sets(4, 10), "alternating", "Elevación frontal alternada."),
        exercise("Front Raise", sets(4, 10)),
        exercise("Lateral Raise", sets(4, 12)),
        exercise("Lateral Raise Isometric", sets(4, 12)),
        exercise("Biceps Curl Isometric", sets(4, 10)),
        exercise("Biceps Curl", sets(4, 10)),
        exercise("Triceps Kickback", sets(4, 15)),
        exercise("Triceps Overhead Extension", sets(4, 15)),
      ],
      [
        exercise("Shoulder Press with Pause", sets(4, 10), "unilateral"),
        exercise("Shoulder Press", sets(4, 10), "unilateral"),
        exercise("Front Raise with Twist", sets(4, 20), "alternating", "Elevación frontal alternada."),
        exercise("Front Raise", sets(4, 20)),
        exercise("Lateral Raise", sets(4, 20)),
        exercise("Lateral Raise Isometric", sets(4, 15)),
        exercise("Biceps Curl Isometric", sets(4, 10)),
        exercise("Biceps Curl", sets(4, 10)),
        exercise("Triceps Kickback", sets(4, 15)),
        exercise("Triceps Overhead Extension", sets(4, 15)),
      ],
    ),
  },
  {
    name: "Shoulders",
    variants: gymHome(
      [
        exercise("Arnold Press", sets(4, 20)),
        exercise("Shoulder Press", sets(4, 10)),
        exercise("Front Raise", sets(4, 15), "bilateral", "Agarre neutral."),
        exercise("Front Raise with Twist", sets(4, 10)),
        exercise("Lateral Raise", sets(4, 10)),
        exercise("Lateral Raise Isometric", sets(4, 15), "bilateral", "Con codos flexionados."),
        exercise("Rear Delt Fly", sets(4, 20)),
      ],
      [
        exercise("Arnold Press", sets(4, 20)),
        exercise("Shoulder Press", sets(4, 20)),
        exercise("Front Raise", sets(4, 20), "bilateral", "Agarre neutral."),
        exercise("Front Raise with Twist", sets(4, 10)),
        exercise("Lateral Raise", sets(4, 20)),
        exercise("Lateral Raise Isometric", sets(4, 20), "bilateral", "Con codos flexionados."),
        exercise("Rear Delt Fly", sets(4, 20)),
      ],
    ),
  },
  {
    name: "Lower Body Tempo",
    variants: gymHome(
      [
        exercise("Squat", sets(4, 10), "bilateral", "Bajar y subir con cuenta de cinco."),
        exercise("Deadlift", sets(4, 10)),
        exercise("Lunge", sets(3, 10), "alternating", "Una zancada, una sentadilla y una zancada cuentan como una repetición; 10 de ida y 10 de vuelta."),
        exercise("Leg Press", prescribedSets([15, 12, 10, 8])),
        exercise("Side-to-Side Lunge", sets(4, 10), "unilateral"),
      ],
      [
        exercise("Squat", sets(4, 10), "bilateral", "Bajar y subir con cuenta de cinco."),
        exercise("Deadlift", sets(4, 20)),
        exercise("Lunge", sets(3, 10), "alternating", "Una zancada, una sentadilla, una zancada y una sentadilla cuentan como una repetición."),
        exercise("Leg Press", sets(4, 20), "unilateral"),
        exercise("Side-to-Side Lunge", sets(4, 10), "unilateral"),
      ],
    ),
  },
];

export const resolveBaseRoutines = (
  exerciseIds: ReadonlyMap<string, ExerciseId>,
): readonly RoutineDraft[] => baseRoutines.map((routine) => ({
  name: routine.name,
  variants: routine.variants.map((variant) => ({
    name: variant.name,
    exercises: variant.exercises.map((exerciseDefinition) => ({
      exerciseId: exerciseIds.get(exerciseDefinition.exerciseName) as ExerciseId,
      sets: exerciseDefinition.sets,
      laterality: exerciseDefinition.laterality,
      ...(exerciseDefinition.restSeconds === undefined ? {} : { restSeconds: exerciseDefinition.restSeconds }),
      ...(exerciseDefinition.notes === undefined ? {} : { notes: exerciseDefinition.notes }),
    })),
  })),
}));
