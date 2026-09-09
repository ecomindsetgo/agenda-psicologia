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

Para la mayoría de preguntas (las que calzan en una categoría fija: hoy, semana, mes,
ingresos, pendientes, próxima cita, etc.), Gemini solo recibe la pregunta y la fecha
actual para clasificarla; el cálculo real ocurre 100% en el navegador con los datos
completos (incluye `patientName`).

Preguntas que identifican a un paciente (por nombre) SIEMPRE se resuelven localmente
y nunca se envían a Gemini, sin excepción.

### Cambio en 2026.09.09.6 — respuestas libres con IA
Cuando una pregunta NO identifica a un paciente y tampoco calza en ninguna categoría
fija, el asistente ahora envía a Gemini un snapshot administrativo **anonimizado**
(sin `patientName`, sin `patientId`, sin `id`; solo `date`, `time`, `status`, `cost`,
`currency`, `paymentStatus`, `modality` de citas entre ~6 meses atrás y ~3 meses
adelante, más el conteo total de pacientes) junto con la pregunta real, para que
Gemini calcule la respuesta directamente (proyecciones personalizadas,
comparaciones, preguntas fuera de las categorías predefinidas, etc.).

Esto es un cambio de modelo de privacidad respecto a versiones anteriores: antes
Gemini nunca recibía datos de citas, ahora sí recibe cifras y fechas de citas
(sin identidad de pacientes) cuando la pregunta lo requiere. Si no quieres que
esto ocurra nunca, no configures la API Key de Gemini (⚙️) — sin clave, el
asistente sigue funcionando solo con el clasificador e interpretación local, y
las preguntas fuera de las categorías fijas mostrarán el mensaje de ayuda en
vez de consultarse con IA.


## Funciones ampliadas — versión 2026.09.09.5
El asistente ahora entiende consultas administrativas sobre:
- agenda de hoy, mañana, semana actual, semana pasada, mes actual y mes pasado;
- próxima cita y paciente;
- huecos disponibles de esta tarde según los slots operativos 16:00–19:00;
- citas de un paciente, próxima cita e historial administrativo de citas;
- ingresos cobrados, pagos pendientes y proyección;
- rangos de fechas;
- día más rentable y mayor demanda por día/horario;
- pacientes nuevos del mes frente al mes anterior;
- porcentaje de asistencia, cancelaciones y reprogramaciones cuando esos estados existen.

### Privacidad mejorada
Las preguntas que contienen o identifican un paciente se procesan localmente y no se envían a Gemini. El puente administrativo expone solamente nombre, identificador y fecha de alta del paciente, además de los campos administrativos de las citas. No expone DNI, teléfono, fecha de nacimiento, historias clínicas ni notas clínicas.

## Funciones ampliadas — versión 2026.09.09.6
- Corregido: "proyectar/proyección" ahora se reconoce en cualquier conjugación (antes solo
  coincidía con "proyecc-" o "proyectad-", por lo que "¿cuánto puedo **proyectar**?" no
  activaba la proyección y devolvía ingresos ya cobrados en su lugar).
- Reconoce rangos de fechas con "entre X y Y" además de "del X al Y" / "desde X hasta Y",
  incluyendo combinaciones de fecha con barras (07/09/2026) y fecha en palabras (3 de octubre).
- Nueva vía de respaldo: preguntas que no calzan en ninguna categoría fija ya no muestran
  siempre "consulta no disponible" — si hay una API Key de Gemini configurada y la pregunta
  no identifica a un paciente, se calculan con IA sobre un snapshot anonimizado de citas
  (ver nota de privacidad abajo).
