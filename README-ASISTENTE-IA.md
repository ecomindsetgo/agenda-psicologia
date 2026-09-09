# Agenda de Psicología Pro+ — Asistente IA administrativo

## Qué se agregó
- Botón y modal `🤖 Asistente IA`.
- Consultas de citas, horarios, cancelaciones e ingresos.
- Gemini se usa únicamente para clasificar la pregunta.
- Firestore se procesa localmente en el navegador.
- No se envían a Gemini historias clínicas, diagnósticos, motivos de consulta, tratamientos, notas clínicas ni datos de `clinicalHistories`/`clinicalNotes`.
- Si Gemini no está disponible, existe un clasificador local de respaldo.

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
