# Plan global

## Estado del producto

| Fase | Estado | Resultado |
| --- | --- | --- |
| 0. Contratos del núcleo | completed | Dominio, fachada `TrainingOrchestrator` y puertos independientes de infraestructura. |
| 1. Núcleo funcional | completed | Casos de uso completos y verificables mediante adaptadores en memoria. |
| 2. Persistencia local | completed | Adaptador JSON local atómico, recuperable y operable sin red. |
| 3. Datos base | completed | Ejercicios y rutinas iniciales normalizados, cargables y verificados desde `current-routines`. |
| 4. Aplicación offline | completed | PWA local instalable que inicia, ejecuta, recupera y finaliza entrenamientos sin red. |
| 5. Experiencia completa | in_progress | Gestión visual, historial, dashboard y progreso. |
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

- Implementar un adaptador de desarrollo configurable que usa `data/train-app.json` por defecto.
- Mantener un único documento versionado con catálogo, rutinas, sesiones e índice de historial.
- Persistir atómicamente mediante temporal en el mismo directorio y renombrado.
- Validar, recuperar y respaldar archivos corruptos al arrancar.
- Exportar e importar copias del documento versionado sin alterar datos ante una importación inválida.
- Verificar recuperación, atomicidad, corrupción, importación/exportación y simulación longitudinal con `pnpm build`.

## Fase 3 — Datos base

Objetivo: convertir el material de `current-routines` en ejercicios y rutinas iniciales validados.

- Extraer, revisar y normalizar los datos de origen.
- Cargarlos mediante los contratos públicos del núcleo.
- Probar la carga de forma repetible.

`season` es solo parte del nombre de los archivos de origen y no pertenece al dominio.

## Fase 4 — Aplicación offline

Objetivo: ofrecer los flujos del núcleo en una PWA móvil, sin conexión y con mínima fricción.

- Crear un adaptador de interfaz sobre `TrainingOrchestrator`; Vue es la implementación inicial, no una dependencia de la lógica.
- Configurar instalación PWA y disponibilidad offline.
- Permitir iniciar una rutina y registrar una serie en menos de cinco segundos.
- Mostrar referencias inline y descanso flotante durante la ejecución.

Precondiciones cumplidas: `TrainingOrchestrator` es la fachada pública completa y los datos base se cargan de forma repetible. La primera entrega de la fase crea la persistencia local apta para navegador; el adaptador JSON de desarrollo no se distribuye en la aplicación web. La interfaz es reemplazable: cualquier frontend consume exclusivamente DTOs y comandos de la fachada pública, sin alterar el núcleo, los contratos ni las reglas de negocio.

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
