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
