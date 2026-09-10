# Agenda de Psicología Pro+ — Asistente IA administrativo

## Qué se agregó
- Botón y modal `🤖 Asistente IA`.
- Consultas de citas, horarios, cancelaciones e ingresos.
- Gemini se usa únicamente para clasificar la pregunta.
- Firestore se procesa localmente en el navegador.
- No se envían a Gemini historias clínicas, diagnósticos, motivos de consulta, tratamientos, notas clínicas ni datos de `clinicalHistories`/`clinicalNotes`.
- Si Gemini no está disponible, existe un clasificador local de respaldo.

## Intents que reconoce (2026.09.10.1)
- **Citas por periodo:** hoy, ayer, mañana, esta semana, semana pasada, este mes, mes pasado, o un rango explícito de fechas ("del 1 al 15 de septiembre", "01/09/2026 al 15/09/2026").
- **Próxima cita:** "¿a qué hora es mi próxima cita?", "¿a qué hora empieza la primera cita de mañana?".
- **Espacios libres:** "¿tengo citas libres hoy?", "¿tengo espacios libres esta semana?" — compara contra la grilla de horarios (`SLOT_TIMES` en `assistant.js`, debe coincidir con `HORARIO_SLOTS` de `app.js`), respetando que el domingo está cerrado y el sábado solo atiende en la mañana.
- **Día más ocupado:** "¿qué día tengo más citas esta semana/este mes?".
- **Finanzas:** ingresos reales (solo `paymentStatus: pagado`), pendiente por cobrar (con lista de pacientes que deben, no solo el total), proyección (cobrado + pendiente), y comparación de ingresos reales vs. el periodo anterior ("¿cómo van mis ingresos comparado con el mes pasado?").
- **Estado de la cita:** "¿tengo citas sin confirmar?" (status `pendiente`, distinto de pago pendiente) y "¿qué tareas o pagos quedan pendientes hoy/esta semana?" (combina ambos).
- **Sinónimos aceptados:** ingresos/ganancias/facturación/dinero/pago para finanzas; citas/reservas/agenda para citas.
- Un rango de fechas explícito dentro del texto (ej. "del 1 al 15 de septiembre") siempre tiene prioridad sobre la clasificación de Gemini, para que no lo reinterprete como una consulta genérica de mes.

## Configurar Gemini
1. Crea una API key de Gemini desde Google AI Studio/Google Cloud.
2. Abre la Agenda de Psicología Pro+ e inicia sesión.
3. Abre `🤖 Asistente IA` → `⚙️ Configurar API de Gemini`.
4. Pega la clave y pulsa Guardar.
5. La clave se almacena solo en el `localStorage` de ese navegador.

### Seguridad importante
La llamada a Gemini se hace desde el navegador porque esta versión está pensada para empezar sin backend de pago. Por eso la API key no es un secreto fuerte: puede quedar expuesta al cliente. Para reducir riesgo, restringe la clave por dominio HTTP referrer en Google Cloud/AI Studio y aplica límites de uso.

## Archivos modificados
- `index.html`: interfaz del asistente y carga de `assistant.js`.
- `app.js`: puente seguro que expone exclusivamente un snapshot administrativo de citas.
- `style.css`: estilos del asistente.
- `assistant.js`: integración Gemini + cálculos locales + fallback.

## Nota de privacidad
El asistente nunca consulta ni transmite `state.histories` o `state.notes`. El puente solo devuelve:
`date`, `time`, `patientName`, `status`, `cost`, `currency`, `paymentStatus`, `modality` e `id` de las citas.
Gemini no recibe ni siquiera ese snapshot: recibe solo la pregunta y la fecha actual para clasificarla.
