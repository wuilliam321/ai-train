# Acuerdos del proyecto

## Objetivo

Construir una bitácora de fuerza e hipertrofia de fricción mínima, centrada en la sobrecarga progresiva visual. Debe permitir iniciar y registrar un entrenamiento en menos de cinco segundos, funcionar sin conexión y no depender de wearables, entrenadores ni servicios externos.

## Prioridad de requisitos

1. La petición vigente del usuario.
2. Este archivo.
3. `PLAN.md`.
4. `goal.md`, únicamente como contexto de producto.

Las referencias de `goal.md` a React, Node y una base relacional no son decisiones vigentes. El adaptador web futuro usará Vue.js; persistencia, backend y diseño visual se decidirán después.

## Arquitectura

- TypeScript estricto en todo el proyecto.
- Núcleo independiente de frameworks, red, UI y persistencia.
- Organización modular por dominio y capacidad, evitando capas o abstracciones sin un caso de uso real.
- Un `TrainingOrchestrator` es la fachada pública única para cualquier adaptador de entrada: Vue, CLI, webhook u otro.
- El orquestador coordina casos de uso; las reglas viven en el dominio y el acceso externo se realiza mediante puertos.
- Los contratos públicos usan DTOs serializables y no exponen tipos de Vue, SQL, JSON, HTTP ni librerías concretas.
- Persistencia, reloj, generación de identificadores y publicación de cambios son puertos reemplazables.
- Los adaptadores dependen del núcleo; el núcleo nunca depende de adaptadores.
- Una sesión activa es un agregado consistente y cada comando que la modifica se persiste de forma atómica.

## Producto

- Offline-first real: iniciar, registrar, consultar la referencia previa, usar el descanso y finalizar una sesión no requieren red.
- Rendimiento percibido antes que sofisticación: la sesión activa permanece en memoria y se guarda localmente tras cada cambio.
- La referencia histórica de peso y repeticiones se muestra inline por ejercicio y posición de serie.
- Tipos de serie iniciales: calentamiento, normal, descendente y fallo.
- Cada serie admite peso, repeticiones y, opcionalmente, RPE o RIR.
- Completar una serie inicia el descanso configurado para el ejercicio; el tiempo restante se deriva del reloj y no de ticks persistidos.
- Los ejercicios personalizados, rutinas, historial, volumen efectivo, 1RM estimado y distribución muscular forman parte del dominio previsto.
- `current-routines` será material de referencia para datos base futuros. `season` pertenece únicamente al nombre de las fuentes y nunca al dominio.
- Primera versión para un único atleta local. Autenticación, multiusuario, sincronización, comunidad, wearables, calorías, videos y recomendaciones automáticas avanzadas quedan fuera hasta una decisión explícita.

## Desarrollo

- Implementar por etapas y no adelantar UI, base de datos ni infraestructura.
- El plan global vive en `PLAN.md` y la fase activa con sus entregas verificables vive en `ROADMAP.md`.
- Implementar solo la feature marcada como `in_progress` en `ROADMAP.md`; no adelantar fases posteriores.
- Nombres explícitos, funciones pequeñas y código autoexplicativo.
- No escribir comentarios en el código. La documentación de arquitectura y producto sí vive en Markdown.
- Evitar duplicación, estados implícitos, singletons globales y dependencias innecesarias.
- Usar unidades, fechas, identificadores y errores explícitos; no usar valores mágicos.
- Los comandos validan antes de mutar y devuelven errores tipados, nunca mensajes como contrato.
- No añadir compatibilidad, migraciones o extensibilidad especulativa sin un caso concreto.

## Tests

- Mantener 100% de cobertura de líneas, ramas, funciones y sentencias sobre código ejecutable del núcleo y la aplicación.
- Escribir el mínimo número de tests que cubra el comportamiento completo.
- Los tests son especificaciones legibles de los casos de uso fundamentales y no contienen comentarios.
- Priorizar tests del orquestador con adaptadores en memoria; añadir tests unitarios aislados solo cuando reduzcan complejidad.
- Cada bug corregido exige un caso de regresión.
- No perseguir cobertura de archivos puramente declarativos ni de adaptadores generados.
- Ninguna etapa se considera completa si typecheck, tests y cobertura fallan.
- `pnpm build` es la verificación única de entrega: ejecuta typecheck y cobertura completa.

## Eficiencia

- Respuestas, documentos, código y diffs deben ser concisos y de alta señal.
- Leer solo el contexto necesario, reutilizar builders y fixtures, y evitar archivos ceremoniales.
- Medir antes de optimizar, salvo decisiones estructurales evidentes de la ruta crítica offline.
