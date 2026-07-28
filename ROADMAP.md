# Fase 6 — Validación y entrega

## Regla de avance

Se valida la PWA como adaptador del núcleo sin introducir reglas nuevas, backend ni sincronización. Toda entrega mantiene TypeScript estricto, `pnpm build` verde y cobertura total del núcleo. Solo puede haber una feature `in_progress`.

| Estado | Feature | Entrega verificable |
| --- | --- | --- |
| in_progress | F29. Pruebas end-to-end offline | Recorrido de instalación, entrenamiento y recuperación validado en navegador sin red. |
| pending | F30. Rendimiento y tamaño | Presupuesto de arranque y distribución medido y documentado. |
| pending | F31. Respaldo y documentación | Exportación/importación accesible, guía breve y distribución local preparada. |

## F29 — Pruebas end-to-end offline

- Ejecutar el recorrido de primera carga, instalación, inicio, registro de serie, descanso, recarga y cierre en un navegador real.
- Repetirlo sin conexión tras la primera carga y comprobar que la sesión y los datos locales se conservan.
- Probar los estados de almacenamiento no disponible y recuperación sin perder el documento válido.

Aceptación: el flujo principal funciona desde una PWA instalada sin red y sus datos se recuperan tras recargar.

## F30 — Rendimiento y tamaño

- Medir tiempo de arranque, interacción inicial y tamaño del paquete de producción en un dispositivo móvil de referencia.
- Corregir cuellos de botella demostrados sin cambiar contratos ni adelantar infraestructura.
- Documentar presupuesto y resultados reproducibles.

Aceptación: el arranque y el primer inicio de entrenamiento cumplen el objetivo de fricción mínima con métricas registradas.

## F31 — Respaldo y documentación

- Exponer exportación e importación del documento versionado desde la interfaz, validando antes de reemplazar datos locales.
- Documentar uso local, instalación, recuperación, respaldo y límites de producto.
- Preparar la distribución estática de la PWA sin introducir servidores ni cuentas.

Aceptación: un usuario puede instalar, respaldar, restaurar y entender la aplicación local sin asistencia externa.

## Límites

- No se añaden sincronización, cuentas, backend, comunidad, wearables ni recomendaciones automáticas.
- La fórmula y presentación de 1RM siguen pendientes de una decisión explícita.
