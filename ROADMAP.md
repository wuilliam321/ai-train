# Fase 5 — Experiencia completa

## Regla de avance

La interfaz sigue siendo un adaptador reemplazable: consume exclusivamente `TrainingOrchestrator`, DTOs serializables y la composición web. No se traslada lógica de dominio a Vue ni se duplican agregados en stores visuales. Cada entrega conserva TypeScript estricto y `pnpm build` verde con cobertura total del núcleo y aplicación. Solo puede haber una feature `in_progress`.

| Estado | Feature | Entrega verificable |
| --- | --- | --- |
| completed | F25. Gestión visual del catálogo | Crear, editar, archivar y restaurar ejercicios y rutinas locales desde la interfaz. |
| completed | F26. Historial de sesiones | Consultar sesiones cerradas y su detalle con paginación local. |
| in_progress | F27. Dashboard y progreso | Presentar volumen, distribución muscular y progreso por ejercicio. |
| pending | F28. Refinamiento de experiencia | Accesibilidad ampliada, estados vacíos y navegación móvil de las capacidades completas. |

## F25 — Gestión visual del catálogo

- Añadir vistas de listado y detalle para ejercicios y rutinas, separadas de la sesión activa.
- Crear, actualizar, archivar y restaurar mediante los comandos públicos existentes.
- Editar variantes, ejercicios prescritos, objetivos, lateralidad y descanso de rutinas sin inventar un modelo paralelo.
- Validar la entrada antes del envío para dar feedback inmediato; el núcleo sigue siendo la autoridad de las reglas.

Aceptación: un atleta puede mantener su catálogo local completo sin abandonar la PWA ni alterar una sesión activa.

## F26 — Historial de sesiones

- Mostrar sesiones finalizadas paginadas mediante `listWorkoutSessions()`.
- Navegar al detalle inmutable de una sesión con ejercicios, series y volumen registrado.
- Ofrecer estados vacíos, errores recuperables y retorno a la sesión activa cuando exista.

Aceptación: el historial local permite revisar una sesión cerrada sin red y sin cargar datos de forma no acotada.

## F27 — Dashboard y progreso

- Presentar el dashboard de volumen efectivo y distribución muscular para un período elegido.
- Mostrar progreso por ejercicio con los datos que expone `getExerciseProgress()`.
- Definir la presentación de 1RM solo si se toma una decisión de producto explícita; no inferirla de forma automática.

Aceptación: el atleta puede entender su volumen y progreso local desde los DTOs de analítica ya disponibles.

## F28 — Refinamiento de experiencia

- Revisar navegación móvil, foco, etiquetas, contraste, objetivos táctiles y mensajes de error accionables.
- Completar estados de carga, vacíos y de recuperación en catálogo, historial y métricas.
- Verificar el recorrido integrado entre sesión activa, catálogo, historial y dashboard manteniendo la recuperación offline.

Aceptación: las capacidades de la aplicación son navegables y accesibles en móvil sin convertir la interfaz en una segunda capa de dominio.

## Límites

- No se añaden sincronización, cuentas, backend, comunidad, wearables ni recomendaciones automáticas.
- `suggestRoutine()` y la fórmula de 1RM permanecen aplazados hasta una decisión explícita.
- La entrega, medición, respaldo documentado y pruebas end-to-end de distribución pertenecen a Fase 6.
