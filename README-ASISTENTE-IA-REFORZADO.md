# Agenda Psicología Pro+ — Asistente IA reforzado

Base: agenda-psicologia-asistente-ia-login-v3
Referencia del asistente: agenda-psicologia-main (5)

Cambios principales:
- Se conserva la autenticación Firebase de la v3.
- Se reemplaza el asistente simplificado por la arquitectura conversacional de la versión anterior.
- Chat tipo asistente personal con saludo, historial de conversación y burbuja flotante.
- Dictado por voz y lectura de respuestas.
- Gemini opcional únicamente para clasificar la intención; la respuesta se calcula localmente.
- El puente de datos expone solo datos administrativos de citas, pacientes, pagos y modalidad.
- No se envían historias clínicas, notas, diagnósticos ni motivos de consulta al clasificador.
- Soporta hoy, ayer, mañana, semana, mes, semana/mes anterior y rangos personalizados.
- Soporta rangos como 03/09/2026 al 03/10/2026, del 1 al 10, del 1 al 9 de septiembre, últimos/próximos N días.
- Incluye seguimiento conversacional: "¿y cuánto cobré?", "¿y ayer?", "¿y la próxima?".
- Incluye citas restantes del día.
- Incluye resumen administrativo por paciente: citas, pagos, pendientes y próxima cita.
- Mantiene análisis de ingresos reales, pendientes, proyección, comparación, espacios libres, citas sin confirmar, día con mayor carga y pacientes distintos.
- Se conserva la estructura visual del asistente anterior.

Archivos relevantes:
- app.js: agenda/Firebase + puente seguro de datos administrativos.
- assistant.js: motor completo del asistente IA.
- index.html: interfaz del chat y botón flotante.
- style.css: estilos del chat y widget.


## IA con acciones reales — versión 2026.10.01.2

El asistente ahora admite instrucciones en lenguaje natural, además de las consultas administrativas existentes.

### Acciones disponibles
- Crear paciente (requiere nombre y teléfono).
- Agendar cita indicando paciente, fecha, hora, individual/pareja y presencial/virtual.
- Completar/actualizar campos de Historia Clínica con información proporcionada por la profesional.
- Agregar evolución clínica a la Historia Clínica.
- Consultar horarios, citas, pagos, ingresos y proyecciones mediante el motor local existente.

### Seguridad funcional
- Las acciones no se ejecutan directamente al interpretar el mensaje: primero se muestra un resumen y el botón **Confirmar y guardar**.
- La IA no debe inventar datos clínicos. Los campos sin información permanecen vacíos.
- Las tarifas de las citas se calculan mediante la lógica de precios existente en `app.js`, no por la IA.
- Las consultas administrativas siguen utilizando los datos locales actuales para evitar que Gemini invente cifras.
- La clave de Gemini continúa almacenándose localmente en el navegador en esta versión. Para producción, se recomienda migrarla a un backend/Cloud Function para no exponer la clave.

### Ejemplos
- “Agenda a Ana Torres mañana a las 5, individual presencial.”
- “Agenda a Pedro a las 7 virtual, atención de pareja.”
- “Registra la historia clínica de María: consulta por problemas de pareja, ansiedad y dificultad para dormir.”
- “Agrega una evolución a María: hoy trabajamos pensamientos automáticos y reestructuración cognitiva.”
- “¿Qué horarios tengo libres mañana?”
- “¿Cuánto tengo pendiente de cobro esta semana?”
