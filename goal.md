Actúa como un desarrollador Full-Stack experto en arquitecturas SPA (Single Page Application) utilizando React y Node.js, con gran experiencia en diseño de UI/UX "Mobile-First". 

Vamos a desarrollar desde cero una aplicación web progresiva (PWA) / SPA para el seguimiento de entrenamientos de fuerza e hipertrofia. El objetivo principal de la app es la fricción cero: el usuario debe poder llegar al gimnasio, abrir la app, seleccionar su rutina y empezar a registrar datos en menos de 5 segundos. 

Aquí están las directrices clave y el contexto del proyecto:

1. CONCEPTO Y FILOSOFÍA UX:
- Minimalista, intuitiva y orientada a la acción. Sin menús complejos ni opciones redundantes.
- Enfoque en la "Sobrecarga Progresiva Visual": mientras el usuario ejecuta un ejercicio, debe tener a la vista (inline) exactamente qué peso y repeticiones hizo en su sesión anterior para ese mismo ejercicio.

2. FLUJOS PRINCIPALES (Core Flows):
- Dashboard (Home): Un resumen rápido del volumen semanal, frecuencia, y botones grandes de "Iniciar Rutina" (con sugerencia automática basada en el último entrenamiento).
- Workout Execution: 
  - Selección rápida de la plantilla de rutina.
  - Lista de ejercicios donde se pueden añadir filas por serie (Sets).
  - Cada fila debe permitir registrar: Tipo de serie (Calentamiento, Normal, Fallo), Peso y Repeticiones.
  - Referencia visual inmediata del récord/sesión anterior justo debajo o al lado del input actual.
  - Temporizador de descanso flotante y automático al marcar un set como "completado".

3. STACK TECNOLÓGICO SUGERIDO:
- Frontend: React (Hooks, Context/Zustand para manejo del estado durante el entrenamiento para evitar latencia).
- Backend: Node.js con una base de datos relacional (SQLite para el prototipo inicial o PostgreSQL).
- Estilos: Tailwind CSS para una iteración rápida y diseño limpio.

4. MODELO DE DATOS INICIAL (A considerar):
- Entidades principales: Users, Routines (Plantillas), Exercises (Catálogo), Workout_Sessions (El entrenamiento instanciado), y Workout_Sets (Cada serie registrada con peso, reps, RPE y timestamp).

OBJETIVO INICIAL:
Para este primer paso, no escribas código de UI todavía. Basado en este contexto, quiero que:
1. Diseñes y me muestres el esquema de la base de datos (Modelo Entidad-Relación) para soportar esta lógica de rutinas, sesiones, ejercicios y series históricas.
2. Me propongas la estructura de carpetas y componentes de React para la vista de "Workout Execution" (la pantalla principal donde ocurre el entrenamiento).

Responde de manera directa, técnica y estructurada.
