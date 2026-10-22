# Fase 9 — Rutinas y continuidad del entrenamiento

Estado: `completed`.

- [x] Elegir, consultar e iniciar una rutina en su misma tarjeta, sin saltos de scroll.
- [x] Mostrar último entrenamiento, sesión actual y siguiente durante el programa y el entrenamiento.
- [x] Secuencia con nombres musculares, semana visible y contenido inline; regreso al programa al terminar.
- [x] Nuevo JSON y guía sin la denominación anterior; importación y recuperación offline verificadas.
- [x] Pruebas de navegación móvil, continuidad entre semanas y `pnpm build` en verde.

# Fase 8 — Sesiones visibles y programa del audio

Estado: `completed`.

- [x] Recuperar y validar la sesión al continuar; explicar sesiones ausentes y entrenamientos sin ejercicios.
- [x] Programa torso/pierna de cuatro días basado en `train.mp3`, con gemelos y abdomen como complementos.
- [x] JSON importable, transcripción y guía breve de uso.
- [x] Regresión de UI y `pnpm build` en verde.

# Fase 7 — Programas y progreso dirigido

Estado: `completed`.

Objetivo: añadir programas como agregado del núcleo, con ciclos flexibles de ocho semanas, adherencia y metas por ejercicio. Vue solo consume los contratos de `TrainingOrchestrator`.

- [x] Dominio, puerto y fachada pública para programas y ciclos.
- [x] Programas base de 3, 4 y 5 días.
- [x] Persistencia versionada, migración e importación totalmente validadas.
- [x] Ejecución transaccional de sesión programada y cierre de ciclo.
- [x] Gestión visual de programas propios, selección Gym/Casa e informe final.
- [x] Pruebas completas y `pnpm build` en verde.

## Roadmap previo completado

Las fases 0–7 están completadas. La aplicación incluye núcleo independiente, persistencia local, datos base, PWA offline, gestión visual, historial, métricas, respaldo, programas dirigidos y validación end-to-end.

Las decisiones futuras requieren una nueva fase explícita:

- Sincronización, cuentas y multiusuario.
- Fórmula y presentación de 1RM.
- Sugerencias automáticas de rutinas.
- Backend, comunidad, wearables, calorías, videos o recomendaciones avanzadas.
