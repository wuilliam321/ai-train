# Plan global

## Estado del producto

| Fase | Estado | Resultado |
| --- | --- | --- |
| 0. Contratos del núcleo | completed | Dominio, fachada `TrainingOrchestrator` y puertos independientes de infraestructura. |
| 1. Núcleo funcional | in_progress | Casos de uso completos y verificables mediante adaptadores en memoria. |
| 2. Persistencia local | pending | Datos locales atómicos, recuperables y operables sin red. |
| 3. Datos base | pending | Ejercicios y rutinas iniciales normalizados desde `current-routines`. |
| 4. Aplicación Vue offline | pending | Adaptador web/PWA rápido para ejecutar entrenamientos. |
| 5. Experiencia completa | pending | Gestión visual, historial, dashboard y progreso. |
| 6. Validación y entrega | pending | Rendimiento, respaldo, pruebas end-to-end y distribución. |

`ROADMAP.md` detalla exclusivamente la fase activa. Al cerrar una fase, se actualiza esta tabla y se reemplaza el roadmap por el de la siguiente.

## Fase 0 — Contratos del núcleo

Completada.

- DTOs de ejercicios, rutinas, sesiones, descanso, historial y analíticas.
- Capacidades públicas agrupadas bajo `TrainingOrchestrator`.
- Puertos para repositorios, historial, reloj e identificadores.
- TypeScript estricto y barrel público único.

## Fase 1 — Núcleo funcional

Objetivo: operar una bitácora completa sin UI ni persistencia definitiva, únicamente a través de `TrainingOrchestrator` y adaptadores en memoria.

- Fundamentos, validación y entorno de pruebas.
- Catálogo de ejercicios y rutinas.
- Inicio, recuperación y ejecución de entrenamientos.
- Descanso y referencia histórica inline.
- Cierre, historial y eventos.
- Volumen efectivo y distribución muscular.
- Simulación longitudinal determinista.

La secuencia, aceptación y estado de estas entregas viven en `ROADMAP.md`.

## Fase 2 — Persistencia local

Objetivo: sustituir los adaptadores en memoria por almacenamiento local sin cambiar el núcleo ni sus contratos públicos.

- Elegir el adaptador local según restricciones del runtime Vue/PWA.
- Persistir atómicamente catálogo, rutinas, sesión activa, descanso e historial.
- Recuperar datos y sesión activa después de reiniciar la aplicación.
- Gestionar datos corruptos, respaldo y restauración local.
- Medir la ruta crítica offline.

## Fase 3 — Datos base

Objetivo: convertir el material de `current-routines` en ejercicios y rutinas iniciales validados.

- Extraer, revisar y normalizar los datos de origen.
- Cargarlos mediante los contratos públicos del núcleo.
- Probar la carga de forma repetible.

`season` es solo parte del nombre de los archivos de origen y no pertenece al dominio.

## Fase 4 — Aplicación Vue offline

Objetivo: ofrecer los flujos del núcleo en una PWA móvil, sin conexión y con mínima fricción.

- Crear el adaptador Vue sobre `TrainingOrchestrator`.
- Configurar instalación PWA y disponibilidad offline.
- Permitir iniciar una rutina y registrar una serie en menos de cinco segundos.
- Mostrar referencias inline y descanso flotante durante la ejecución.

## Fase 5 — Experiencia completa

Objetivo: exponer visualmente todas las capacidades ya existentes del núcleo.

- Gestión de ejercicios y rutinas.
- Historial de sesiones.
- Dashboard de volumen y distribución muscular.
- Progreso por ejercicio.
- Accesibilidad, navegación móvil y recuperación ante cierres.

## Fase 6 — Validación y entrega

Objetivo: entregar una aplicación local fiable y medible.

- Pruebas end-to-end offline.
- Medición de rendimiento, tamaño y tiempo de arranque.
- Exportación y respaldo local.
- Documentación mínima de uso y distribución.

## Decisiones aplazadas

- Fórmula y presentación del 1RM estimado.
- Algoritmo de sugerencia automática de rutinas.
- Sincronización, autenticación, multiusuario, comunidad, wearables, calorías, videos y recomendaciones avanzadas.
