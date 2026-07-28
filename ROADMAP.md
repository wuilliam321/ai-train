# Fase 3 — Datos base y cierre de fachada

## Regla de avance

Cada entrega se verifica mediante `TrainingOrchestrator` y el adaptador JSON. `pnpm build` debe completar typecheck y cobertura al 100% del código ejecutable del núcleo y la aplicación. Solo puede haber una feature `in_progress`.

La Fase 4 no comienza hasta cerrar esta fase: Vue dependerá exclusivamente de la fachada pública y de una carga de datos base repetible.

| Estado | Feature | Entrega verificable |
| --- | --- | --- |
| completed | F14. Transcripción | Archivo revisable con la transcripción de las 23 imágenes de origen. |
| completed | F13.5. Cierre de fachada | `TrainingOrchestrator` expone todas las capacidades públicas de ejercicios y rutinas. |
| in_progress | F15. Catálogo de ejercicios | Datos normalizados de nombres, músculos, descansos y notas. |
| pending | F16. Catálogo de rutinas | Rutinas y variantes con orden, prescripciones y ambigüedades resueltas. |
| pending | F17. Cargador determinista | Carga idempotente que usa exclusivamente la fachada pública. |
| pending | F18. Verificación de datos base | Carga completa, inicio desde cada variante y `pnpm build` verde. |

## F14 — Transcripción

- Inventariar las imágenes de `current-routines`.
- Transcribir su contenido a material estructurado y revisable.

Aceptación: `TRANSCRIPTION.md` cubre las 23 imágenes y conserva las ambigüedades para resolverlas en los catálogos.

## F13.5 — Cierre de fachada

- Componer `ExerciseCatalogService` y `RoutineCatalogService` dentro de `TrainingOrchestrator`.
- Delegar todos los métodos declarados por `ExerciseCatalog` y `RoutineCatalog`: crear, consultar, editar, archivar, restaurar y listar; además de `suggestRoutine()`.
- Declarar y probar que el orquestador satisface su contrato público completo.
- Sustituir en las pruebas de integración y en el futuro cargador el uso directo de servicios internos por el orquestador.

Aceptación: un adaptador de entrada o cargador solo necesita `TrainingOrchestrator`; no importa servicios de aplicación internos ni repositorios.

## F15 — Catálogo de ejercicios

- Normalizar nombres para evitar duplicados y conservar una correspondencia con la transcripción.
- Asignar músculos primarios/secundarios, descanso por defecto y notas cuando existan.
- Resolver nombres ambiguos sin inventar ejercicios; mantener decisiones explícitas y revisables.

Aceptación: todos los ejercicios base son DTOs válidos y se crean mediante la fachada sin conflictos.

## F16 — Catálogo de rutinas

- Convertir cada día y modalidad real en rutinas y variantes con ejercicios ordenados.
- Especificar tipos de serie, objetivos de repeticiones, lateralidad, descanso y notas.
- Resolver variantes gym/casa, A/B, trabajo unilateral, fallo, calentamientos y ejercicios compuestos.
- `season` pertenece solo al origen: no aparece en nombres ni entidades del dominio.

Aceptación: cada prescripción referencia un ejercicio base existente y puede iniciar una sesión válida.

## F17 — Cargador determinista

- Crear un cargador reproducible para un documento vacío que use únicamente `TrainingOrchestrator`.
- No escribir directamente en el adaptador JSON ni depender de UI, red, reloj no determinista o estado global.
- Definir su comportamiento ante datos ya cargados para no crear duplicados.

Aceptación: dos ejecuciones controladas producen el mismo catálogo y las mismas rutinas sin duplicados.

## F18 — Verificación de datos base

- Ejecutar la carga completa sobre el adaptador JSON.
- Probar que cada variante base puede iniciar una sesión y conservar sus snapshots.
- Confirmar recuperación, catálogo consultable y ausencia de referencias huérfanas.
- Reparar la instalación local de dependencias hasta que `pnpm build` vuelva a ser la señal de entrega válida.

Aceptación: `pnpm build` pasa y los datos base están disponibles sin red desde el adaptador local.

## Límites

- No se implementa Vue, PWA, IndexedDB ni UI durante esta fase.
- No se modifica ninguna regla de dominio para acomodar el material fuente.
- La persistencia para navegador se aborda al iniciar Fase 4, después de estas precondiciones.
