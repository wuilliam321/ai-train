# Roadmap activo — Núcleo funcional

## Regla de avance

Una feature se completa solo si funciona mediante `TrainingOrchestrator`, tiene tests legibles con adaptadores en memoria y pasa `pnpm build` con 100% de cobertura del código ejecutable. Solo puede haber una feature `in_progress`.

| Estado | Feature | Entrega funcional | Dependencia |
| --- | --- | --- | --- |
| completed | F0. Contratos | Interfaces públicas y puertos del núcleo. | — |
| completed | F1. Fundamentos | Dependencias del orquestador, validación y entorno determinista de pruebas. | F0 |
| in_progress | F2. Ejercicios | Crear, consultar, buscar, editar, archivar y restaurar ejercicios. | F1 |
| pending | F3. Rutinas | Crear, consultar, buscar, editar, archivar y restaurar rutinas y variantes. | F2 |
| pending | F4. Sesión activa | Iniciar desde vacío o rutina y recuperarla tras reconstruir el orquestador. | F3 |
| pending | F5. Ejecución | Editar ejercicios y series, completar y reabrir series. | F4 |
| pending | F6. Descanso y referencias | Descanso persistente y referencias inline por ejercicio y posición. | F5 |
| pending | F7. Cierre e historial | Finalizar, descartar, paginar historial y emitir snapshots. | F6 |
| pending | F8. Métricas | Dashboard, volumen efectivo, distribución muscular y progreso. | F7 |
| pending | F9. Simulación longitudinal | Dos años de entrenamiento determinista y verificación de rendimiento. | F8 |

## F1 — Fundamentos

- Ajustar contratos que impidan persistir descanso, mantener snapshots consistentes o aplazar métricas no definidas.
- Implementar validación explícita de primitivas y reglas de dominio.
- Configurar Vitest y cobertura V8 con umbral 100% para el código ejecutable del núcleo.
- Crear reloj controlable, IDs secuenciales y repositorios en memoria solo para pruebas.
- Construir el orquestador mediante dependencias explícitas, sin singletons.

Aceptación: un test puede construir las dependencias del orquestador, controlar el tiempo e inspeccionar datos persistidos en memoria sin red, esperas ni estado global.

## F2 — Ejercicios

- Validar nombres no vacíos, músculos, descanso y modificaciones.
- Conservar los ejercicios archivados para sesiones y rutinas existentes.
- Impedir añadir manualmente ejercicios archivados a nuevos entrenamientos o rutinas.

Aceptación: todos los comandos del catálogo devuelven valores o errores tipados y ninguna validación fallida persiste cambios.

## F3 — Rutinas

- Validar variantes, orden, ejercicios, tipos de serie, objetivos de repeticiones y descansos.
- Crear snapshots de rutina independientes de futuras modificaciones.
- Mantener `suggestRoutine()` en `null` hasta definir una programación explícita.

Aceptación: una rutina activa puede convertirse en una futura sesión sin depender de UI ni infraestructura.

## F4 — Sesión activa

- Impedir más de una sesión activa.
- Crear sesiones vacías y desde una variante de rutina.
- Capturar ejercicios, series y descanso resuelto en la sesión.
- Recuperar exactamente la sesión activa al reconstruir el orquestador.

Aceptación: iniciar y reabrir una sesión produce el mismo snapshot persistido.

## F5 — Ejecución

- Añadir, mover y eliminar ejercicios.
- Añadir, actualizar, eliminar, completar y reabrir series.
- Soportar calentamiento, normal, descendente y fallo; peso, repeticiones y RPE o RIR excluyentes.
- Validar antes de cada mutación y persistir el agregado completo de forma atómica.

Aceptación: un entrenamiento puede registrarse íntegramente y cada estado inválido devuelve un error tipado sin escritura.

## F6 — Descanso y referencias

- Iniciar o reemplazar el descanso al completar una serie.
- Calcular el restante desde el reloj; no persistir ticks.
- Ajustar, cancelar y recuperar descanso tras reconstruir el orquestador.
- Consultar referencias de sesiones anteriores por ejercicio y posición de serie, excluyendo la sesión activa.

Aceptación: avanzar el reloj modifica el tiempo restante sin escrituras adicionales.

## F7 — Cierre e historial

- Finalizar o descartar la sesión activa y eliminar su descanso.
- Consultar sesiones mediante intervalo `[from, to)` y cursor estable.
- Generar resúmenes de sesiones completadas.
- Emitir un único snapshot después de cada cambio persistido correctamente.

Aceptación: una sesión cerrada aparece en historial y deja de ser recuperable como activa.

## F8 — Métricas

- Calcular volumen efectivo como `peso × repeticiones` para normal, descendente y fallo.
- Excluir calentamientos del estímulo y mantener kg/lb separados.
- Repartir el volumen por igual entre músculos primarios y excluir secundarios.
- Exponer dashboard por intervalo y progreso con mejor peso y volumen.
- Aplazar 1RM estimado hasta elegir una fórmula.

Aceptación: las métricas de escenarios conocidos son exactas y no mezclan unidades.

## F9 — Simulación longitudinal

- Simular dos años: cinco entrenamientos semanales, cinco ejercicios y cuatro series por ejercicio.
- Usar reloj e IDs deterministas; no usar esperas ni red.
- Verificar recuperación, referencias, paginación, volumen, distribución y progreso en hitos conocidos.
- Mantener el cuerpo de la simulación por debajo de 500 ms en desarrollo, sin tests temporales frágiles.

Aceptación: la simulación completa mantiene cobertura total y confirma que el núcleo es apto para datos de meses y años.
