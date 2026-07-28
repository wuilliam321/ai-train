# Fase 4 — Aplicación Vue offline

## Regla de avance

La aplicación web depende exclusivamente de `TrainingOrchestrator`; no importa servicios internos, repositorios ni el adaptador JSON de Node. Cada entrega conserva TypeScript estricto y `pnpm build` verde con cobertura total del núcleo y aplicación. Solo puede haber una feature `in_progress`.

| Estado | Feature | Entrega verificable |
| --- | --- | --- |
| completed | F19. Persistencia web | Adaptador local para navegador, atómico por comando y recuperable al recargar. |
| in_progress | F20. Composición y carga web | Punto de entrada que crea el orquestador y carga datos base de forma idempotente. |
| pending | F21. Base Vue y PWA | Aplicación Vue instalable que abre y opera sin red tras la primera carga. |
| pending | F22. Inicio de entrenamiento | Selección de rutina/variante e inicio de sesión activa en menos de cinco segundos. |
| pending | F23. Ejecución de sesión | Registro de series, referencia previa inline y descanso flotante persistido. |
| pending | F24. Recuperación y entrega del flujo | Recuperación tras recarga, navegación mínima y verificación del flujo offline completo. |

## F19 — Persistencia web

- Implementar un adaptador de navegador para los puertos de ejercicios, rutinas, sesión, historial y eventos.
- Usar una tecnología disponible offline en navegador, sin `node:fs`, red, backend ni estado global oculto.
- Mantener la semántica del documento JSON: cambios atómicos por comando, validación al leer y recuperación segura ante datos corruptos.
- Definir exportación e importación local como JSON versionado sin acoplar el núcleo al formato ni a APIs del navegador.
- Probar recuperación de sesión activa, descanso, historial y fallo de escritura con dobles de las APIs web.

Aceptación: al reconstruir el adaptador web se recuperan el catálogo, la sesión activa y el descanso; el núcleo no cambia.

## F20 — Composición y carga web

- Crear el punto de composición web que instancia reloj, IDs, eventos, persistencia y `TrainingOrchestrator`.
- Ejecutar `loadBaseData()` sobre la fachada durante la inicialización, sin duplicar datos existentes.
- Exponer a Vue únicamente el orquestador y un estado de inicialización serializable.
- Separar el error recuperable de almacenamiento del estado de interfaz; no inventar un segundo modelo de dominio en Vue.

Aceptación: una apertura nueva deja disponibles ejercicios y rutinas base; una reapertura preserva los datos y no los duplica.

## F21 — Base Vue y PWA

- Añadir Vue, el punto de montaje y una estructura móvil mínima sin trasladar reglas de negocio al cliente visual.
- Configurar manifiesto, service worker y caché de recursos de aplicación para abrir sin red después de la primera carga.
- Mostrar estados de inicialización, almacenamiento no disponible y recuperación de datos de forma comprensible.
- Mantener la aplicación instalable sin introducir autenticación, backend ni sincronización.

Aceptación: la app instalada abre offline y puede consultar el catálogo local a través de la composición web.

## F22 — Inicio de entrenamiento

- Mostrar rutinas activas y sus variantes con acceso directo a la última selección cuando exista.
- Iniciar una rutina o una sesión vacía mediante `startWorkout()`.
- Presentar el estado de sesión activa y permitir descartarla de forma explícita.
- Medir el flujo principal para que iniciar una rutina habitual requiera como máximo dos interacciones después de abrir la app.

Aceptación: un atleta puede abrir la app e iniciar una rutina local en menos de cinco segundos sin red.

## F23 — Ejecución de sesión

- Representar ejercicios y series pendientes de la sesión activa con controles táctiles rápidos para peso, repeticiones, RPE/RIR y tipo de serie.
- Completar, reabrir, añadir, mover y eliminar series o ejercicios mediante la fachada pública.
- Consultar y mostrar la referencia histórica por ejercicio y posición de serie junto al registro.
- Mostrar el descanso calculado desde `getRestPeriod()` y permitir ajustarlo o cancelarlo; no persistir ticks de UI.
- Guardar cada interacción mediante los comandos existentes y mantener la sesión usable tras perder foco o conexión.

Aceptación: completar una serie persiste el resultado, muestra su referencia y activa el descanso correcto sin red.

## F24 — Recuperación y entrega del flujo

- Recuperar sesión activa, descanso y controles de la interfaz después de recargar, cerrar o reinstanciar la aplicación.
- Añadir navegación mínima entre entrenamiento activo, rutinas y catálogo, sin adelantar el dashboard ni el historial completo de Fase 5.
- Probar el recorrido offline: abrir, cargar datos, iniciar rutina, registrar serie, recargar y finalizar o descartar sesión.
- Confirmar accesibilidad básica táctil, mensajes de error accionables y `pnpm build` verde.

Aceptación: el flujo completo de entrenamiento funciona offline desde una instalación web y se recupera tras una recarga.

## Límites

- No se implementan sincronización, cuentas, backend, comunidad, wearables ni recomendaciones automáticas.
- `suggestRoutine()` y el 1RM estimado siguen aplazados: la UI permite elegir rutinas existentes y no presenta una recomendación inexistente.
- Gestión visual exhaustiva, historial, dashboard y progreso pertenecen a Fase 5.
