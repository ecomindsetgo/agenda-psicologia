/* Asistente IA - Agenda Psicología Pro+
   Consultas administrativas: Gemini recibe SOLO la pregunta para clasificar la intención;
   los datos de agenda se procesan localmente. Nunca se envían historias existentes.
   Modo Historia Clínica (opt-in): se envía a Gemini ÚNICAMENTE el texto/audio que la
   profesional dicta o adjunta en ese momento, para ordenarlo en los campos de la ficha.
   Nada se guarda automáticamente: la profesional revisa y pulsa "Guardar Historia Clínica".
*/
(function () {
  'use strict';

  const KEY_NAME = 'agenda_pro_gemini_api_key';
  const APP_VERSION = '2026.10.01.3';
  const MODEL = localStorage.getItem('agenda_pro_gemini_model') || 'gemini-3.8-flash';
  let lastAnswerText = '';
  let voiceQueryActive = false;
  let autoSpeak = true;
  let chatStarted = false;
  let fabGreetShown = false;

  // Memoria conversacional ligera para preguntas de seguimiento.
  const conversation = {
    lastQuestion: '',
    lastIntent: '',
    lastPatient: '',
    lastAnswerAt: 0
  };
  function hasFollowUpMarker(q) {
    const x = normalizeQuestion(q);
    return /^(y|y que|y cuanto|y cuánto|y cuales|y cuáles|y la proxima|y la próxima|y el siguiente|y ayer|y manana|y mañana|y hoy|y este mes|y esta semana|tambien|también)/.test(x);
  }
  function rememberConversation(question, intent) {
    conversation.lastQuestion = question || '';
    conversation.lastIntent = intent || '';
    conversation.lastAnswerAt = Date.now();
    try {
      const data = getData();
      const names = (data.patients || []).map(p => String(p.name || '').trim()).filter(Boolean)
        .sort((a,b) => b.length - a.length);
      const qn = normalizeQuestion(question);
      const hit = names.find(n => qn.includes(normalizeQuestion(n)));
      if (hit) conversation.lastPatient = hit;
    } catch (_) {}
  }


  function $(id) { return document.getElementById(id); }

  function specialistName() {
    try {
      if (typeof window.getAgendaSpecialistFirstName === 'function') {
        return window.getAgendaSpecialistFirstName() || '';
      }
    } catch (e) { /* noop */ }
    return '';
  }

  function scrollChatToBottom() {
    const chat = $('assistant-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  // Añade un mensaje del asistente (izquierda) al hilo de conversación.
  function appendBotMessage(html) {
    const chat = $('assistant-chat');
    if (!chat) return;
    const row = document.createElement('div');
    row.className = 'chat-row chat-row-bot';
    row.innerHTML = `<div class="chat-avatar">🤖</div><div class="chat-bubble chat-bubble-bot">${html}</div>`;
    chat.appendChild(row);
    lastAnswerText = row.innerText;
    scrollChatToBottom();
    return row;
  }

  // Añade un mensaje del usuario (derecha) al hilo de conversación.
  function appendUserMessage(text) {
    const chat = $('assistant-chat');
    if (!chat) return;
    const row = document.createElement('div');
    row.className = 'chat-row chat-row-user';
    row.innerHTML = `<div class="chat-bubble chat-bubble-user">${escapeHtml(text)}</div>`;
    chat.appendChild(row);
    scrollChatToBottom();
  }

  // Indicador de "escribiendo…" mientras se procesa la consulta, para que
  // se sienta como una conversación real y no como un formulario.
  function showTyping() {
    const chat = $('assistant-chat');
    if (!chat) return null;
    const row = document.createElement('div');
    row.className = 'chat-row chat-row-bot';
    row.id = 'assistant-typing-row';
    row.innerHTML = `<div class="chat-avatar">🤖</div><div class="chat-bubble chat-bubble-bot chat-typing"><span></span><span></span><span></span></div>`;
    chat.appendChild(row);
    scrollChatToBottom();
    return row;
  }

  function hideTyping() {
    const row = $('assistant-typing-row');
    if (row) row.remove();
  }

  function greetingMessage() {
    const name = specialistName();
    const hello = name ? `Hola ${escapeHtml(name)} 👋` : 'Hola 👋';
    return `<div class="assistant-title">${hello}</div><div>Soy tu asistente personal de la agenda. Puedo revisar tus citas, pacientes, horarios libres e ingresos al instante. ¿En qué puedo ayudarte hoy?</div><div class="mt-2 text-[11px] text-slate-400">🔒 Para consultas de agenda solo uso fechas, nombres y montos, y nunca leo tus historias existentes. Si activas «Dictar historia clínica», únicamente lo que dictes o adjuntes en ese momento se envía a Gemini para ordenarlo en la ficha.</div>`;
  }

  // Muestra el saludo inicial solo una vez por sesión de chat (mientras el
  // hilo esté vacío), igual que cuando abres un chat de WhatsApp por primera vez.
  function ensureGreeting() {
    const chat = $('assistant-chat');
    if (!chat) return;
    if (chatStarted || chat.children.length) return;
    chatStarted = true;
    appendBotMessage(greetingMessage());
  }

  function openAssistantModal() {
    const modal = $('assistant-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    updateConfigState();
    hideFabGreetBubble();
    const badge = $('assistant-fab-badge');
    if (badge) badge.classList.add('hidden');
    ensureGreeting();
    const q = $('assistant-question');
    if (q) setTimeout(() => q.focus(), 150);
  }

  function closeAssistantModal() {
    const modal = $('assistant-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.style.zIndex = '';
  }

  // Burbuja tipo "widget de WhatsApp" que aparece sola una vez, invitando a
  // abrir el chat, con el nombre de la profesional si está disponible.
  function showFabGreetBubble() {
    if (fabGreetShown) return;
    const modal = $('assistant-modal');
    if (modal && !modal.classList.contains('hidden')) return; // ya está abierto
    const bubble = $('assistant-fab-greet');
    if (!bubble) return;
    const name = specialistName();
    bubble.querySelector('span').textContent = name
      ? `Hola ${name}, soy tu asistente personal. ¿En qué puedo ayudarte hoy?`
      : 'Hola, soy tu asistente personal. ¿En qué puedo ayudarte hoy?';
    bubble.classList.remove('hidden');
    fabGreetShown = true;
    const badge = $('assistant-fab-badge');
    if (badge) badge.classList.remove('hidden');
  }

  function hideFabGreetBubble() {
    const bubble = $('assistant-fab-greet');
    if (bubble) bubble.classList.add('hidden');
  }

  function openGeminiConfig() {
    const box = $('gemini-config-box');
    if (!box) return;
    box.classList.toggle('hidden');
    const input = $('gemini-api-key');
    if (input) input.value = localStorage.getItem(KEY_NAME) || '';
    updateConfigState();
  }

  function saveGeminiKey() {
    const input = $('gemini-api-key');
    const key = input ? input.value.trim() : '';
    if (!key) {
      alert('Pega primero tu API Key de Gemini.');
      return;
    }
    localStorage.setItem(KEY_NAME, key);
    updateConfigState();
    setStatus('✅ API de Gemini guardada en este navegador.', 'ok');
    const box = $('gemini-config-box');
    if (box) box.classList.add('hidden');
  }

  function clearGeminiKey() {
    localStorage.removeItem(KEY_NAME);
    const input = $('gemini-api-key');
    if (input) input.value = '';
    updateConfigState();
    setStatus('Clave eliminada de este navegador. El asistente seguirá funcionando con interpretación local básica.', 'info');
  }

  function updateConfigState() {
    const el = $('assistant-config-state');
    if (!el) return;
    el.textContent = localStorage.getItem(KEY_NAME) ? '● Gemini configurado' : '○ Gemini no configurado';
  }

  function setStatus(text, type) {
    const el = $('assistant-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'text-xs rounded-xl p-3';
    if (type === 'ok') el.classList.add('bg-emerald-50', 'text-emerald-700', 'border', 'border-emerald-200');
    else if (type === 'error') el.classList.add('bg-rose-50', 'text-rose-700', 'border', 'border-rose-200');
    else el.classList.add('bg-slate-50', 'text-slate-600', 'border', 'border-slate-200');
    el.classList.remove('hidden');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function todayLima() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  // Hora actual en Lima como "HH:MM", para saber si una cita de hoy ya pasó.
  function limaNowTime() {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour12: false, hour: '2-digit', minute: '2-digit' }).format(new Date());
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Convierte "HH:MM" (24h) a un formato hablado tipo "10:00 a. m.", más
  // natural tanto para leer en pantalla como para la lectura por voz.
  function formatTime12(time) {
    if (!time) return 'sin hora';
    const parts = String(time).split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) || 0;
    if (Number.isNaN(h)) return String(time);
    const d = new Date(2000, 0, 1, h, m);
    return new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  }

  // Renderiza una lista de citas evitando repetir la fecha en cada línea
  // cuando todas las citas del resultado caen en el mismo día: la fecha se
  // muestra una sola vez en el título y cada ítem queda solo con nombre y
  // hora. Si el resultado abarca varias fechas (p. ej. un rango de días),
  // sí se conserva la fecha por ítem porque ahí es información necesaria.
  function apptListHtml(list, opts) {
    opts = opts || {};
    const emoji = opts.emoji || '📅';
    const emptyMsg = opts.emptyMsg || 'No hay citas registradas para ese periodo.';
    const limit = opts.limit || 30;
    const sorted = (list || []).slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    if (!sorted.length) {
      return `<div class="assistant-title">${emoji} ${escapeHtml(opts.title || '')}</div><div>${escapeHtml(emptyMsg)}</div>`;
    }
    const dates = Array.from(new Set(sorted.map(a => a.date)));
    const sameDate = dates.length === 1;
    const fullTitle = sameDate ? `${opts.title} ${formatDate(dates[0])}` : opts.title;
    const shown = sorted.slice(0, limit);
    const items = shown.map(a => sameDate
      ? `<li><b>${escapeHtml(a.patientName)}</b> — ${escapeHtml(formatTime12(a.time))}</li>`
      : `<li><b>${escapeHtml(a.patientName)}</b> — ${formatDate(a.date)}, ${escapeHtml(formatTime12(a.time))}</li>`
    ).join('');
    return `<div class="assistant-title">${emoji} ${escapeHtml(fullTitle)}</div><div class="assistant-total">${sorted.length} cita(s)</div><ul class="assistant-list">${items}</ul>`;
  }

  function getMonthRange(dateStr) {
    const ym = dateStr.slice(0, 7);
    const start = ym + '-01';
    const d = new Date(start + 'T12:00:00');
    d.setMonth(d.getMonth() + 1);
    return [start, d.toISOString().slice(0, 10)];
  }

  function getWeekRange(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + mondayOffset);
    const start = d.toISOString().slice(0, 10);
    return [start, addDays(start, 7)];
  }

  function getPrevWeekRange(dateStr) {
    const [start] = getWeekRange(dateStr);
    const prevStart = addDays(start, -7);
    return [prevStart, start];
  }

  function getPrevMonthRange(dateStr) {
    const [start] = getMonthRange(dateStr);
    const anchor = addDays(start, -1); // último día del mes anterior
    return getMonthRange(anchor);
  }

  function getData() {
    try {
      if (typeof window.getAgendaAdminSnapshot === 'function') return window.getAgendaAdminSnapshot();
    } catch (e) { console.error(e); }
    return { appointments: [], patients: [] };
  }

  function isActiveAppointment(a) {
    const s = String(a.status || '').toLowerCase();
    return !/(cancel|anulad|no asist|no_show)/.test(s);
  }

  // "pendiente" en el campo status = pendiente de atención/confirmación (no completada, no cancelada).
  function isUnconfirmed(a) {
    return String(a.status || '').toLowerCase() === 'pendiente';
  }

  function money(amount, currency) {
    const n = Number(amount || 0).toFixed(2);
    return currency === 'USD' ? '$' + n : 'S/ ' + n;
  }

  function normalizeQuestion(q) {
    return q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // Debe reflejar la misma grilla de horarios usada en el calendario semanal
  // (HORARIO_SLOTS / HORARIO_DAYS en app.js). Si esos horarios cambian allí,
  // actualízalos también aquí para que "citas libres" sea exacto.
  const SLOT_TIMES = ['10:00', '11:00', '12:00', '16:00', '17:00', '18:00', '19:00'];
  const AFTERNOON_EVENING_SLOTS = ['16:00', '17:00', '18:00', '19:00'];

  // Horarios disponibles para un día dado: domingo cerrado, sábado solo mañana.
  function daySlots(dateStr) {
    const dow = new Date(dateStr + 'T12:00:00').getDay(); // 0=domingo … 6=sábado
    if (dow === 0) return [];
    if (dow === 6) return SLOT_TIMES.filter(s => !AFTERNOON_EVENING_SLOTS.includes(s));
    return SLOT_TIMES.slice();
  }

  function localIntent(q) {
    const x = normalizeQuestion(q);
    if (parseDateRange(q)) return 'range';

    // Saludos y cortesía, para que se sienta como una conversación real.
    if (/^\s*(hola|buen(os|as)\s*(dias|tardes|noches)?|hey|hi|que tal)\s*[!.,¡¿?]*\s*$/.test(x)) return 'greeting';
    if (/\b(gracias|muchas gracias|te lo agradezco)\b/.test(x)) return 'thanks';
    if (/quien eres|que eres|que puedes hacer|en que me puedes ayudar|para que sirves/.test(x)) return 'help';

    // Estado de confirmación/atención: "sin confirmar", "por confirmar".
    if (/sin confirmar|no confirmad|por confirmar|falta.*confirmar/.test(x)) return 'unconfirmed';

    // Combinación de tareas + pagos pendientes para un periodo.
    if (/tareas?.*pendient|pendient.*(tareas|por hacer)|que.*queda.*pendiente/.test(x)) return 'pending_tasks';

    // Comparación de ingresos entre periodos.
    if (/comparad|comparacion.*ingres|respecto al mes pasado|como van.*ingres/.test(x)) return 'compare';

    // Próxima/primera cita o turno (por hora), antes que otros patrones más genéricos.
    // Incluye variantes con "turno" y frases tipo "¿quién sigue?" que la gente
    // usa a diario en consultorio, no solo "próxima cita".
    if (/proxima cita|siguiente cita|primera cita|proximo turno|siguiente turno|proximo paciente|siguiente paciente|que paciente (sigue|viene|esta)|quien (sigue|es el siguiente|viene ahora)|a que hora.*(empieza|inicia|es).*(primera|proxima|siguiente)/.test(x)) return 'next';

    // Último paciente atendido / última cita ya pasada.
    if (/ultimo paciente|ultima cita( atendida)?|quien fue mi ultimo/.test(x)) return 'last_done';

    // Cantidad de pacientes distintos (no de citas) en un periodo.
    if (/cuantos pacientes (distintos|diferentes|unicos)|cuantos pacientes (atendi|tengo en total|he atendido)/.test(x)) return 'unique_patients';

    // Seguimiento conversacional: "¿y cuánto cobré?", "¿y ayer?", etc.
    if (hasFollowUpMarker(q) && conversation.lastIntent) {
      if (/ayer/.test(x)) return 'yesterday';
      if (/manana/.test(x)) return 'tomorrow';
      if (/proxima|siguiente/.test(x)) return 'next';
      if (/cob(r|re)|ingres|pago|dinero/.test(x)) return 'real_income';
      if (/debe|pendient|por cobrar/.test(x)) return 'pending';
      if (/espacio|libre|disponible/.test(x)) return 'free';
      if (/cuantas|citas|agenda/.test(x)) return conversation.lastIntent === 'range' ? 'range' : 'count';
    }

    // Citas que todavía quedan hoy.
    if (/(cuantas|cu[aá]ntas|que|qu[eé])?.*(citas?|turnos?|pacientes?).*(quedan|faltan|restan)/.test(x) ||
        /(quedan|faltan|restan).*(citas?|turnos?|pacientes?)/.test(x)) return 'remaining_today';

    // Resumen administrativo de un paciente concreto.
    if (/(resumen|estado|informacion|información|historial de citas|cuantas|cuántas).*(paciente|cliente)/.test(x) ||
        /(citas|pagos|debe|pendiente).*(paciente|cliente)/.test(x)) return 'patient_summary';

    // Espacios/horarios libres.
    if (/libre|disponible|espacios? libres?|huecos? libres?|cupos? libres?/.test(x)) return 'free';

    // Día con más citas / día más ocupado.
    if (/dia.*mas citas|que dia.*mas|dia con mas citas|dia mas ocupado|mas ocupado/.test(x)) return 'busiest';

    // Finanzas: se distinguen ingresos realmente cobrados, pendientes y proyección.
    if (/proyec|esperad|estimad|cuanto.*voy.*ingres|cuanto.*ingres.*futuro/.test(x)) return 'projection';
    if (/pendient|por cobrar|sin pagar|no pagad|debo cobrar|falta cobrar|quien.*deb|clientes?.*deb|pacientes?.*deb/.test(x)) return 'pending';
    if (/ingres.*real|ingreso real|recaudad|cobrad|cobrado|efectiv|cuanto.*cobre|cuanto.*recibi|cuanto.*me.*pagaron/.test(x)) return 'real_income';
    if (/ingres|dinero|gane|gan(e|é|e)|pago|factur/.test(x)) return 'real_income';

    if (/\bayer\b/.test(x)) return 'yesterday';
    if (/\bmanana\b/.test(x)) return 'tomorrow';
    if (/hoy/.test(x)) return 'today';
    if (/semana pasada|la semana anterior/.test(x)) return 'last_week';
    if (/esta semana|semana/.test(x)) return 'week';
    if (/mes pasado|el mes anterior/.test(x)) return 'last_month';
    if (/este mes|mes/.test(x)) return 'month';
    if (/cancelad|anulad/.test(x)) return 'cancelled';
    if (/a que hora|hora.*cita|cita.*hora/.test(x)) return 'patient_time';
    if (/quien|pacientes|tienen cita/.test(x)) return 'people';
    if (/cuantas|cantidad|numero|numero de|total.*cita|citas|reservas?|agenda|turnos?/.test(x)) return 'count';
    return 'help';
  }

  function parseDateOnly(value, defaultYear) {
    if (!value) return null;
    const v = normalizeQuestion(value).trim();
    let m = v.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    m = v.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    const months = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
    m = v.match(/(\d{1,2})\s+de\s+([a-z]+)/);
    if (m && months[m[2]]) return `${defaultYear || new Date().getFullYear()}-${String(months[m[2]]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    return null;
  }

  function parseDateRange(question) {
    const q = normalizeQuestion(question);
    const today = todayLima();
    const currentYear = today.slice(0,4);
    const explicit = q.match(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{4})?\b/g);
    if (explicit && explicit.length >= 2) {
      const full = s => {
        const p=s.split(/[\/-]/);
        return p.length===2 ? parseDateOnly(`${p[0]}/${p[1]}/${currentYear}`) : parseDateOnly(s);
      };
      const start=full(explicit[0]), end=full(explicit[1]);
      if(start && end) return {start,end,label:`del ${formatDate(start)} al ${formatDate(end)}`};
    }
    const months='enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
    let m=q.match(new RegExp('del\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+('+months+')(?:\\s+de\\s+(\\d{4}))?'));
    if(m){
      const y=Number(m[4]||currentYear), start=parseDateOnly(`${m[1]} de ${m[3]}`,y), end=parseDateOnly(`${m[2]} de ${m[3]}`,y);
      if(start&&end)return{start,end,label:`del ${formatDate(start)} al ${formatDate(end)}`};
    }
    m=q.match(new RegExp('(?:del|desde)\\s+(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?('+months+')(?:\\s+de\\s+(\\d{4}))?\\s+(?:al|hasta)\\s+(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?('+months+')(?:\\s+de\\s+(\\d{4}))?'));
    if(m){
      const y1=Number(m[3]||currentYear), y2=Number(m[6]||m[3]||currentYear);
      const start=parseDateOnly(`${m[1]} de ${m[2]}`,y1);
      // La expresión tiene día final en m[4], mes final en m[5].
      const finalEnd=parseDateOnly(`${m[4]} de ${m[5]}`,y2);
      if(start&&finalEnd)return{start,end:finalEnd,label:`del ${formatDate(start)} al ${formatDate(finalEnd)}`};
    }
    m=q.match(/\bdel\s+(\d{1,2})\s+al\s+(\d{1,2})\b/);
    if(m && !new RegExp(months).test(q)){
      const ym=today.slice(0,7), start=`${ym}-${String(m[1]).padStart(2,'0')}`, end=`${ym}-${String(m[2]).padStart(2,'0')}`;
      return{start,end,label:`del ${formatDate(start)} al ${formatDate(end)}`};
    }
    m=q.match(/\b(?:ultimos|últimos)\s+(\d{1,3})\s+dias?\b/);
    if(m){const n=Math.max(1,Math.min(365,Number(m[1])));return{start:addDays(today,-(n-1)),end:today,label:`de los últimos ${n} días`};}
    m=q.match(/\b(?:proximos|próximos)\s+(\d{1,3})\s+dias?\b/);
    if(m){const n=Math.max(1,Math.min(365,Number(m[1])));return{start:today,end:addDays(today,n-1),label:`de los próximos ${n} días`};}
    return null;
  }

  // Resuelve un rango de fechas ("hoy", "ayer", "mañana", "esta/la semana pasada",
  // "este mes/el mes pasado") a partir de las palabras de la pregunta. Si no hay
  // ninguna palabra de fecha, usa defaultUnit ('today' | 'week' | 'month').
  function resolveScope(question, defaultUnit) {
    const x = normalizeQuestion(question);
    const today = todayLima();
    if (/\bayer\b/.test(x)) {
      const d = addDays(today, -1);
      return { start: d, end: addDays(d, 1), label: 'de ayer' };
    }
    if (/\bmanana\b/.test(x)) {
      const d = addDays(today, 1);
      return { start: d, end: addDays(d, 1), label: 'de mañana' };
    }
    if (/hoy/.test(x)) {
      return { start: today, end: addDays(today, 1), label: 'de hoy' };
    }
    if (/semana pasada|la semana anterior/.test(x)) {
      const [start, end] = getPrevWeekRange(today);
      return { start, end, label: 'de la semana pasada' };
    }
    if (/esta semana|semana/.test(x)) {
      const [start, end] = getWeekRange(today);
      return { start, end, label: 'de esta semana' };
    }
    if (/mes pasado|el mes anterior/.test(x)) {
      const [start, end] = getPrevMonthRange(today);
      return { start, end, label: 'del mes pasado' };
    }
    if (/este mes|mes/.test(x)) {
      const [start, end] = getMonthRange(today);
      return { start, end, label: 'de este mes' };
    }
    if (defaultUnit === 'week') {
      const [start, end] = getWeekRange(today);
      return { start, end, label: 'de esta semana' };
    }
    if (defaultUnit === 'today') {
      return { start: today, end: addDays(today, 1), label: 'de hoy' };
    }
    const [start, end] = getMonthRange(today);
    return { start, end, label: 'de este mes' };
  }

  /* ── Llamada robusta a Gemini ─────────────────────────────────────────
     - 503/500/504 (saturación): reintenta con espera y luego prueba modelos de respaldo.
     - 429 (límite de uso) y 404 (modelo inexistente): prueba el siguiente modelo.
     - 400/401/402/403: falla de inmediato con un mensaje claro en español. */
  const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

  function friendlyGeminiError(status, detail) {
    const d = detail ? ' (' + detail + ')' : '';
    if (status === 402) return 'Tu clave de Gemini se quedó sin crédito. Revisa la facturación en AI Studio o usa una clave nueva en ⚙️ Gemini.' + d;
    if (status === 401 || status === 403) return 'Gemini rechazó la clave. Verifica que esté bien copiada y activa en ⚙️ Gemini.' + d;
    if (status === 400) return 'Gemini no pudo procesar esta solicitud (HTTP 400).' + d;
    if (status === 429) return 'Llegaste al límite de uso gratuito de Gemini. Espera unos minutos e inténtalo de nuevo.' + d;
    if (status === 404) return 'El modelo de Gemini configurado no está disponible en tu cuenta.' + d;
    if (status === 500 || status === 503 || status === 504) return 'Gemini está saturado en este momento. Inténtalo de nuevo en un minuto.' + d;
    return 'Gemini respondió con HTTP ' + status + '.' + d;
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function callGemini(body, opts) {
    opts = opts || {};
    const key = localStorage.getItem(KEY_NAME);
    if (!key) throw new Error('Configura tu clave de Gemini (botón ⚙️ Gemini, abajo) para usar esta función.');
    const models = opts.fallback === false ? [MODEL] : [MODEL].concat(FALLBACK_MODELS.filter(m => m !== MODEL));
    const retries = opts.retries == null ? 2 : opts.retries;
    let lastStatus = 0, lastDetail = '';
    for (const model of models) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        let response;
        try {
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
          });
        } catch (netErr) {
          throw new Error('No hay conexión con Gemini. Revisa tu internet e inténtalo de nuevo.');
        }
        if (response.ok) {
          if (model !== MODEL) console.info('[Asistente] Usando modelo de respaldo:', model);
          return response.json();
        }
        lastStatus = response.status;
        lastDetail = '';
        try { const err = await response.json(); lastDetail = (err && err.error && err.error.message) || ''; } catch (_) {}
        if ([400, 401, 402, 403].includes(lastStatus)) throw new Error(friendlyGeminiError(lastStatus, lastDetail));
        if ([500, 503, 504].includes(lastStatus) && attempt < retries) { await sleep(1500 * (attempt + 1)); continue; }
        break; // 404, 429 o reintentos agotados: pasar al siguiente modelo
      }
    }
    throw new Error(friendlyGeminiError(lastStatus, lastDetail));
  }

  async function classifyWithGemini(question) {
    const key = localStorage.getItem(KEY_NAME);
    if (!key) return null;
    const allowed = ['today','tomorrow','yesterday','week','last_week','month','last_month','cancelled',
      'real_income','pending','pending_tasks','projection','compare','patient_time','next','free','busiest',
      'unconfirmed','people','count','range','help','greeting','thanks','last_done','unique_patients','remaining_today','patient_summary'];
    const prompt = `Eres un clasificador de intención para una agenda de psicología. No respondas la pregunta: solo elige UNA categoría. La aplicación calculará la respuesta localmente con los datos administrativos.
Reglas: rango explícito de fechas = range; cuánto cobré/recibí/ingresé = real_income; deuda/pendiente/por cobrar = pending; proyección/esperado = projection; cuántas citas quedan/restan = remaining_today; nombre de paciente + resumen/citas/pagos = patient_summary; siguiente/próxima = next; espacios libres = free; comparado con = compare.
No inventes datos. Categorías permitidas: ${allowed.join(', ')}.
Responde únicamente con la categoría.
Pregunta: ${question}`;
    const data = await callGemini({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 10 } }, { retries: 0, fallback: false });
    const text = (((data.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || '';
    return allowed.includes(text.trim().toLowerCase()) ? text.trim().toLowerCase() : null;
  }

  function sumByCurrency(items) {
    const out = {};
    (items || []).forEach(a => {
      const c = a.currency === 'USD' ? 'USD' : 'PEN';
      out[c] = (out[c] || 0) + Number(a.cost || 0);
    });
    return out;
  }

  function formatTotals(byCurrency) {
    const keys = Object.keys(byCurrency || {});
    return keys.length ? keys.map(c => money(byCurrency[c], c)).join(' + ') : 'S/ 0.00';
  }

  function isPaid(a) {
    return String(a.paymentStatus || '').toLowerCase() === 'pagado';
  }

  function isPendingPayment(a) {
    return String(a.paymentStatus || '').toLowerCase() === 'pendiente';
  }

  // Lista de citas/pacientes con pago pendiente, para responder "¿qué clientes me deben?".
  function pendingDetailHtml(pending) {
    const detail = pending.slice()
      .sort((a, b) => String(a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
      .slice(0, 15)
      .map(a => `<li>${formatDate(a.date)} — <b>${escapeHtml(a.patientName)}</b>: ${money(a.cost || 0, a.currency === 'USD' ? 'USD' : 'PEN')}</li>`)
      .join('');
    return detail ? `<ul class="assistant-list mt-2">${detail}</ul>` : '';
  }

  // Agrupa citas activas por fecha y devuelve [[fecha, cantidad], ...] ordenado desc.
  function busiestDays(list) {
    const counts = {};
    (list || []).forEach(a => { counts[a.date] = (counts[a.date] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  function answer(intent, question) {
    const data = getData();
    const all = Array.isArray(data.appointments) ? data.appointments : [];
    const today = todayLima();
    let list = all.filter(a => a && a.date);
    let title = '';

    // Proyección = citas futuras/no canceladas cuyo importe representa el cobro esperado.
    // Ingreso real = únicamente paymentStatus === "pagado".
    // Pendiente = paymentStatus === "pendiente", independientemente de que esté completada.
    if (intent === 'today' || intent === 'people' || intent === 'count') {
      list = list.filter(a => a.date === today && isActiveAppointment(a));
      title = 'Citas de hoy';
    } else if (intent === 'yesterday') {
      const date = addDays(today, -1);
      list = list.filter(a => a.date === date && isActiveAppointment(a));
      title = 'Citas de ayer';
    } else if (intent === 'tomorrow') {
      const date = addDays(today, 1);
      list = list.filter(a => a.date === date && isActiveAppointment(a));
      title = 'Citas de mañana';
    } else if (intent === 'week') {
      const [start, end] = getWeekRange(today);
      list = list.filter(a => a.date >= start && a.date < end && isActiveAppointment(a));
      title = 'Citas de esta semana';
    } else if (intent === 'last_week') {
      const [start, end] = getPrevWeekRange(today);
      list = list.filter(a => a.date >= start && a.date < end && isActiveAppointment(a));
      title = 'Citas de la semana pasada';
    } else if (intent === 'month') {
      const [start, end] = getMonthRange(today);
      list = list.filter(a => a.date >= start && a.date < end && isActiveAppointment(a));
      title = 'Citas de este mes';
    } else if (intent === 'last_month') {
      const [start, end] = getPrevMonthRange(today);
      list = list.filter(a => a.date >= start && a.date < end && isActiveAppointment(a));
      title = 'Citas del mes pasado';
    } else if (intent === 'range') {
      const range = parseDateRange(question);
      if (!range) return '<div class="assistant-title">📅 Rango no reconocido</div><div>Usa, por ejemplo: “¿Cuánto ingresé del 01/09/2026 al 10/09/2026?”</div>';
      list = list.filter(a => a.date >= range.start && a.date <= range.end && isActiveAppointment(a));
      title = `Periodo ${range.label}`;
      const qn = normalizeQuestion(question);
      if (/proyec|esperad|estimad/.test(qn)) {
        // IMPORTANTE: cuando el usuario proporciona un rango explícito, se respeta
        // TODO el rango. No se vuelve a aplicar 'hoy' como límite inferior.
        // Esto evita perder citas de los primeros días del rango (p.ej. 07/09).
        // PROYECCIÓN TOTAL = todo el valor económico del periodo: incluye
        // citas ya cobradas/pagadas y citas aún pendientes de cobro.
        // No incluye citas canceladas, anuladas o no asistidas.
        // Esto permite que una consulta como “proyección del 07/09 al 03/10”
        // refleje tanto lo ya cobrado como lo que todavía se espera cobrar.
        const projection = list.filter(isActiveAppointment);
        const totals = sumByCurrency(projection);
        const detail = projection.slice().sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time))
          .slice(0, 80)
          .map(a => `<li>${formatDate(a.date)} ${escapeHtml(a.time || '')} — <b>${escapeHtml(a.patientName)}</b>: ${money(a.cost || 0, a.currency === 'USD' ? 'USD' : 'PEN')}</li>`).join('');
        return `<div class="assistant-title">📈 Proyección ${escapeHtml(range.label)}</div><div class="assistant-total">${formatTotals(totals)}</div><div class="mt-1 text-slate-500">${projection.length} cita(s) consideradas: cobradas + pendientes dentro de todo el rango indicado.</div>${detail ? `<details class="mt-2"><summary class="cursor-pointer font-semibold">Ver detalle</summary><ul class="assistant-list mt-2">${detail}</ul></details>` : ''}`;
      }
      if (/pendient|por cobrar|sin pagar|no pagad|falta cobrar|quien.*deb|clientes?.*deb|pacientes?.*deb/.test(qn)) {
        const pending = list.filter(isPendingPayment);
        return `<div class="assistant-title">⏳ Pendiente ${escapeHtml(range.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(pending))}</div><div class="mt-1 text-slate-500">${pending.length} cita(s) pendientes de pago.</div>${pendingDetailHtml(pending)}`;
      }
      // Solo se asume que preguntan por ingresos si usan palabras de dinero.
      // Si no, es una pregunta de cantidad/lista de citas del periodo (ej.
      // "¿Cuántas citas hubo entre el 1 y el 15?") y se muestra el conteo.
      if (/ingres|dinero|gane|gan(e|é|e)|cobrad|recaudad|factur|efectiv|pago/.test(qn)) {
        const paid = list.filter(isPaid);
        return `<div class="assistant-title">💰 Ingresos reales ${escapeHtml(range.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(paid))}</div><div class="mt-1 text-slate-500">${paid.length} pago(s) registrado(s) como pagado.</div>`;
      }
      return apptListHtml(list, { title });
    } else if (intent === 'real_income' || intent === 'pending' || intent === 'projection') {
      const scope = resolveScope(question, 'month');
      title = scope.label;
      list = list.filter(a => a.date >= scope.start && a.date < scope.end && isActiveAppointment(a));

      if (intent === 'real_income') {
        const paid = list.filter(isPaid);
        return `<div class="assistant-title">💰 Ingresos reales ${escapeHtml(title)}</div><div class="assistant-total">${formatTotals(sumByCurrency(paid))}</div><div class="mt-1 text-slate-500">${paid.length} pago(s) efectivamente registrado(s).</div>`;
      }
      if (intent === 'pending') {
        const pending = list.filter(isPendingPayment);
        return `<div class="assistant-title">⏳ Pendiente por cobrar ${escapeHtml(title)}</div><div class="assistant-total">${formatTotals(sumByCurrency(pending))}</div><div class="mt-1 text-slate-500">${pending.length} cita(s) con pago pendiente.</div>${pendingDetailHtml(pending)}`;
      }
      // Proyección total: suma lo ya cobrado y lo pendiente dentro del periodo.
      // Las citas canceladas/no asistidas quedan fuera.
      const projection = list.filter(isActiveAppointment);
      return `<div class="assistant-title">📈 Proyección de ingresos ${escapeHtml(title)}</div><div class="assistant-total">${formatTotals(sumByCurrency(projection))}</div><div class="mt-1 text-slate-500">${projection.length} cita(s) consideradas: cobradas + pendientes.</div>`;
    } else if (intent === 'compare') {
      const qn = normalizeQuestion(question);
      const useWeek = /semana/.test(qn);
      let curStart, curEnd, prevStart, prevEnd, curLabel, prevLabel;
      if (useWeek) {
        [curStart, curEnd] = getWeekRange(today);
        [prevStart, prevEnd] = getPrevWeekRange(today);
        curLabel = 'esta semana'; prevLabel = 'la semana pasada';
      } else {
        [curStart, curEnd] = getMonthRange(today);
        [prevStart, prevEnd] = getPrevMonthRange(today);
        curLabel = 'este mes'; prevLabel = 'el mes pasado';
      }
      const curPaid = all.filter(a => a && a.date >= curStart && a.date < curEnd && isPaid(a));
      const prevPaid = all.filter(a => a && a.date >= prevStart && a.date < prevEnd && isPaid(a));
      const curTotals = sumByCurrency(curPaid);
      const prevTotals = sumByCurrency(prevPaid);
      const curPen = curTotals.PEN || 0;
      const prevPen = prevTotals.PEN || 0;
      const diff = curPen - prevPen;
      const pct = prevPen > 0 ? ((diff / prevPen) * 100).toFixed(1) : null;
      const arrow = diff > 0 ? '📈' : (diff < 0 ? '📉' : '➖');
      return `<div class="assistant-title">${arrow} Comparación de ingresos reales</div>` +
        `<div><b>${escapeHtml(curLabel)}:</b> ${formatTotals(curTotals)} (${curPaid.length} pago(s))</div>` +
        `<div><b>${escapeHtml(prevLabel)}:</b> ${formatTotals(prevTotals)} (${prevPaid.length} pago(s))</div>` +
        `<div class="mt-1 text-slate-500">Diferencia en soles: ${diff >= 0 ? '+' : ''}S/ ${diff.toFixed(2)}${pct !== null ? ' (' + (diff >= 0 ? '+' : '') + pct + '%)' : ''}. Si manejas montos en USD, revisa el detalle por separado arriba.</div>`;
    } else if (intent === 'next') {
      const qn = normalizeQuestion(question);
      let candidates = all.filter(a => a && a.date && isActiveAppointment(a));
      let label = 'Tu próxima cita';
      if (/\bmanana\b/.test(qn)) {
        const d = addDays(today, 1);
        candidates = candidates.filter(a => a.date === d);
        label = 'Primera cita de mañana';
      } else if (/hoy/.test(qn) && /primera/.test(qn)) {
        candidates = candidates.filter(a => a.date === today);
        label = 'Primera cita de hoy';
      } else {
        const nowTime = limaNowTime();
        candidates = candidates.filter(a => a.date > today || (a.date === today && (a.time || '00:00') >= nowTime));
      }
      candidates = candidates.slice().sort((a, b) => String(a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      const next = candidates[0];
      if (!next) return `<div class="assistant-title">🕐 ${escapeHtml(label)}</div><div>No encontré citas próximas para ese periodo.</div>`;
      return `<div class="assistant-title">🕐 ${escapeHtml(label)}</div><div class="assistant-total">${escapeHtml(next.time || 'sin hora')}</div><div class="mt-1 text-slate-500">${formatDate(next.date)} — ${escapeHtml(next.patientName)}</div>`;
    } else if (intent === 'free') {
      const scope = resolveScope(question, 'today');
      const days = [];
      for (let d = scope.start; d < scope.end; d = addDays(d, 1)) days.push(d);
      const rows = days.map(d => {
        const slots = daySlots(d);
        const free = slots.filter(s => !all.some(a => a.date === d && isActiveAppointment(a) && a.time && a.time.slice(0, 5) === s));
        return { date: d, slots, free };
      });
      if (rows.length === 1) {
        const r = rows[0];
        if (!r.slots.length) return `<div class="assistant-title">🟢 Espacios libres ${escapeHtml(scope.label)}</div><div>Ese día no hay atención (consultorio cerrado).</div>`;
        return `<div class="assistant-title">🟢 Espacios libres ${escapeHtml(scope.label)}</div><div class="assistant-total">${r.free.length} de ${r.slots.length} horario(s)</div>${r.free.length ? '<ul class="assistant-list">' + r.free.map(s => `<li>${s}</li>`).join('') + '</ul>' : '<div>No hay horarios libres ese día.</div>'}`;
      }
      const totalFree = rows.reduce((s, r) => s + r.free.length, 0);
      return `<div class="assistant-title">🟢 Espacios libres ${escapeHtml(scope.label)}</div><div class="assistant-total">${totalFree} horario(s) libres en total</div><ul class="assistant-list">${rows.map(r => r.slots.length ? `<li>${formatDate(r.date)}: <b>${r.free.length}</b> libre(s) de ${r.slots.length}</li>` : `<li>${formatDate(r.date)}: cerrado</li>`).join('')}</ul>`;
    } else if (intent === 'busiest') {
      const qn = normalizeQuestion(question);
      const useMonth = /mes/.test(qn);
      const [start, end] = useMonth ? getMonthRange(today) : getWeekRange(today);
      const label = useMonth ? 'este mes' : 'esta semana';
      const scoped = all.filter(a => a && a.date && a.date >= start && a.date < end && isActiveAppointment(a));
      const ranking = busiestDays(scoped);
      if (!ranking.length) return `<div class="assistant-title">📊 Día con más citas (${escapeHtml(label)})</div><div>No hay citas registradas en ese periodo.</div>`;
      const max = ranking[0][1];
      const top = ranking.filter(r => r[1] === max);
      return `<div class="assistant-title">📊 Día con más citas (${escapeHtml(label)})</div><div class="assistant-total">${top.map(r => formatDate(r[0])).join(', ')} — ${max} cita(s)</div><ul class="assistant-list">${ranking.slice(0, 7).map(r => `<li>${formatDate(r[0])}: ${r[1]} cita(s)</li>`).join('')}</ul>`;
    } else if (intent === 'unconfirmed') {
      const qn = normalizeQuestion(question);
      let scoped = all.filter(a => a && a.date && isUnconfirmed(a));
      let label = 'próximas';
      if (/hoy|manana|semana|mes/.test(qn)) {
        const scope = resolveScope(question, 'today');
        scoped = scoped.filter(a => a.date >= scope.start && a.date < scope.end);
        label = scope.label;
      } else {
        scoped = scoped.filter(a => a.date >= today);
      }
      return apptListHtml(scoped, {
        emoji: '📝',
        title: `Citas sin confirmar (${label})`,
        emptyMsg: 'No hay citas pendientes de confirmar/atender en ese periodo.',
        limit: 20
      });
    } else if (intent === 'pending_tasks') {
      const scope = resolveScope(question, 'today');
      const scoped = all.filter(a => a && a.date && a.date >= scope.start && a.date < scope.end && isActiveAppointment(a));
      const unconfirmed = scoped.filter(isUnconfirmed);
      const paymentPending = scoped.filter(isPendingPayment);
      let html = `<div class="assistant-title">🧾 Pendientes ${escapeHtml(scope.label)}</div>` +
        `<div><b>${unconfirmed.length}</b> cita(s) sin confirmar/atender.</div>` +
        `<div><b>${paymentPending.length}</b> cita(s) con pago pendiente (${formatTotals(sumByCurrency(paymentPending))}).</div>`;
      if (unconfirmed.length) html += '<div class="mt-2 font-semibold">Sin confirmar:</div><ul class="assistant-list">' + unconfirmed.slice(0, 15).map(a => `<li>${formatDate(a.date)} ${escapeHtml(a.time || '')} — ${escapeHtml(a.patientName)}</li>`).join('') + '</ul>';
      if (paymentPending.length) html += '<div class="mt-2 font-semibold">Pago pendiente:</div>' + pendingDetailHtml(paymentPending);
      return html;
    } else if (intent === 'remaining_today') {
      const nowTime = limaNowTime();
      const remaining = all.filter(a => a && a.date === today && isActiveAppointment(a) &&
        String(a.time || '23:59').slice(0,5) >= nowTime)
        .sort((a,b) => String(a.time||'').localeCompare(String(b.time||'')));
      return `<div class="assistant-title">⏳ Citas que quedan hoy</div><div class="assistant-total">${remaining.length} cita(s)</div>` +
        (remaining.length ? `<ul class="assistant-list">${remaining.map(a => `<li><b>${escapeHtml(a.patientName)}</b> — ${escapeHtml(formatTime12(a.time))}</li>`).join('')}</ul>` :
        '<div>No quedan citas pendientes de atención para hoy.</div>');
    } else if (intent === 'patient_summary') {
      const qn = normalizeQuestion(question);
      const dataPatients = Array.isArray(data.patients) ? data.patients : [];
      let patientName = conversation.lastPatient || '';
      const hit = dataPatients.map(p => String(p.name || '').trim()).filter(Boolean)
        .sort((a,b)=>b.length-a.length).find(n => qn.includes(normalizeQuestion(n)));
      if (hit) patientName = hit;
      if (!patientName) {
        const candidate = all.map(a => a.patientName).filter(Boolean)
          .find(n => qn.split(/\s+/).some(w => w.length > 2 && normalizeQuestion(n).includes(w)));
        patientName = candidate || '';
      }
      if (!patientName) return `<div class="assistant-title">👤 Paciente no identificado</div><div>Indícame el nombre del paciente para revisar sus citas y pagos administrativos.</div>`;
      const rows = all.filter(a => a && normalizeQuestion(a.patientName) === normalizeQuestion(patientName));
      const activeRows = rows.filter(isActiveAppointment);
      const paidRows = rows.filter(isPaid);
      const pendingRows = rows.filter(isPendingPayment);
      const next = activeRows.filter(a => a.date > today || (a.date === today && String(a.time||'23:59').slice(0,5) >= limaNowTime()))
        .sort((a,b)=>String(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')))[0];
      return `<div class="assistant-title">👤 Resumen administrativo: ${escapeHtml(patientName)}</div>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <div class="assistant-kpi"><strong>${rows.length}</strong><span>Citas registradas</span></div>
          <div class="assistant-kpi"><strong>${activeRows.length}</strong><span>Citas activas</span></div>
          <div class="assistant-kpi"><strong>${formatTotals(sumByCurrency(paidRows))}</strong><span>Pagado</span></div>
          <div class="assistant-kpi"><strong>${formatTotals(sumByCurrency(pendingRows))}</strong><span>Pendiente</span></div>
        </div>
        ${next ? `<div class="mt-3 text-slate-500">Próxima cita: <b>${formatDate(next.date)}</b> — ${escapeHtml(formatTime12(next.time))}</div>` : '<div class="mt-3 text-slate-500">No tiene una próxima cita activa registrada.</div>'}
        ${rows.length ? `<details class="mt-3"><summary class="cursor-pointer font-semibold">Ver citas</summary>${apptListHtml(rows,{title:'Citas del paciente',limit:20})}</details>` : ''}`;
    } else if (intent === 'patient_time') {
      const words = normalizeQuestion(question).split(/\s+/).filter(w => w.length > 2 && !['quien','tiene','cita','hora','que','a','para','el','la','de'].includes(w));
      const matches = words.length ? list.filter(a => words.some(w => normalizeQuestion(a.patientName).includes(w))) : [];
      if (!matches.length) return '<div class="assistant-title">🔎 No encontré una coincidencia.</div><div>Prueba con el nombre del paciente, por ejemplo: “¿A qué hora tiene cita María?”</div>';
      return '<div class="assistant-title">🕐 Horario encontrado</div><ul class="assistant-list">' + matches.slice(0, 10).map(a => `<li><b>${escapeHtml(a.patientName)}</b>: ${escapeHtml(a.time || 'sin hora')} — ${formatDate(a.date)}</li>`).join('') + '</ul>';
    } else if (intent === 'cancelled') {
      list = all.filter(a => a && a.date && String(a.status || '').toLowerCase() === 'cancelada');
      return apptListHtml(list, {
        emoji: '❌',
        title: 'Citas canceladas',
        emptyMsg: 'No hay citas canceladas registradas.',
        limit: 20
      });
    } else if (intent === 'help') {
      const name = specialistName();
      return `<div class="assistant-title">🤖 Puedo ayudarte con la agenda${name ? ', ' + escapeHtml(name) : ''}</div><div>Ejemplos: “¿Cuántas citas tengo esta semana?”, “¿Qué paciente sigue?”, “¿Tengo espacios libres hoy?”, “¿A qué hora es mi próxima cita?”, “¿Qué día tengo más citas este mes?”, “¿Cuánto ingresé realmente este mes?”, “¿Cuánto tengo pendiente por cobrar?”, “¿Qué clientes me deben?”, “¿Tengo citas sin confirmar?”, “¿Cómo van mis ingresos comparado con el mes pasado?”, “¿Cuál es mi proyección de ingresos este mes?”, “¿Cuántos pacientes distintos atendí este mes?” o “¿Cuántas citas tuve del 1 al 10?”.</div>`;
    } else if (intent === 'greeting') {
      return greetingMessage();
    } else if (intent === 'thanks') {
      return '<div class="assistant-title">🤖 ¡De nada!</div><div>Aquí estoy si necesitas revisar algo más de tu agenda.</div>';
    } else if (intent === 'last_done') {
      const past = all.filter(a => a && a.date && isActiveAppointment(a) &&
        (a.date < today || (a.date === today && (a.time || '00:00') < limaNowTime())));
      past.sort((a, b) => String(b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
      const last = past[0];
      if (!last) return '<div class="assistant-title">🕐 Última cita</div><div>Todavía no encuentro citas anteriores registradas.</div>';
      return `<div class="assistant-title">🕐 Tu última cita</div><div class="assistant-total">${escapeHtml(last.patientName)}</div><div class="mt-1 text-slate-500">${formatDate(last.date)} — ${escapeHtml(formatTime12(last.time))}</div>`;
    } else if (intent === 'unique_patients') {
      const scope = resolveScope(question, 'month');
      const scoped = all.filter(a => a && a.date && a.date >= scope.start && a.date < scope.end && isActiveAppointment(a));
      const names = Array.from(new Set(scoped.map(a => (a.patientName || '').trim()).filter(Boolean)));
      return `<div class="assistant-title">👥 Pacientes distintos ${escapeHtml(scope.label)}</div><div class="assistant-total">${names.length} paciente(s)</div><div class="mt-1 text-slate-500">${scoped.length} cita(s) en total en ese periodo.</div>`;
    }

    if (intent === 'people') {
      return apptListHtml(list, { emoji: '👥', title, emptyMsg: 'No hay citas registradas.' });
    }

    return apptListHtml(list, { emoji: '📅', title });
  }

  function speakAnswer() {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setStatus('Este navegador no admite lectura por voz. Prueba Chrome o Edge.', 'error');
      return false;
    }
    const bubbles = document.querySelectorAll('#assistant-chat .chat-bubble-bot');
    const lastBubble = bubbles.length ? bubbles[bubbles.length - 1] : null;
    const text = lastAnswerText || (lastBubble ? lastBubble.innerText : '');
    if (!text.trim()) {
      setStatus('Primero realiza una consulta.', 'info');
      return false;
    }
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      // Antes, los saltos de línea entre cada cita (uno por <li>/<div>) se
      // borraban al colapsar todos los espacios en uno solo, así que la voz
      // leía todo seguido sin pausas. Ahora cada salto de línea se convierte
      // en un punto para que el lector de voz haga una pausa natural entre
      // cada cita, fecha u otro dato de la lista.
      const paused = text
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('. ')
        .replace(/([.:,;])\s*\./g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
      // En móviles, especialmente iPhone/iPad, es más fiable crear la voz
      // inmediatamente dentro de la interacción del usuario.
      const utterance = new SpeechSynthesisUtterance(paused);
      utterance.lang = 'es-PE';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onstart = () => setStatus('🔊 Reproduciendo la respuesta por voz.', 'ok');
      utterance.onend = () => setStatus('✅ Respuesta terminada.', 'ok');
      utterance.onerror = (e) => setStatus('No se pudo reproducir la voz (' + (e.error || 'error') + '). Toca “Leer respuesta” nuevamente.', 'error');
      synth.speak(utterance);
      // Algunos navegadores móviles pausan la síntesis recién iniciada.
      setTimeout(() => { try { if (synth.paused) synth.resume(); } catch (_) {} }, 120);
      return true;
    } catch (e) {
      setStatus('No se pudo iniciar la lectura por voz. Toca “Leer respuesta” nuevamente.', 'error');
      return false;
    }
  }

  function stopAnswerVoice() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setStatus('🔇 Lectura por voz detenida.', 'info');
  }

  function toggleAutoVoice() {
    autoSpeak = !autoSpeak;
    const btn = $('assistant-auto-voice-btn');
    if (btn) {
      btn.textContent = autoSpeak ? '🔊 Voz automática: ON' : '🔇 Voz automática: OFF';
      btn.classList.toggle('bg-emerald-50', autoSpeak);
      btn.classList.toggle('text-emerald-700', autoSpeak);
    }
    if (!autoSpeak) stopAnswerVoice();
  }

  let recognition = null;
  let isListening = false;

  function toggleAssistantVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('Tu navegador no admite dictado por voz. Usa Google Chrome o Microsoft Edge.', 'error');
      return;
    }
    if (clinicalMode) { toggleClinicalDictation(SpeechRecognition); return; }
    voiceQueryActive = true;
    if (isListening && recognition) { recognition.stop(); return; }

    recognition = new SpeechRecognition();
    recognition.lang = 'es-PE';
    recognition.continuous = false;
    recognition.interimResults = true;
    isListening = true;
    updateVoiceButton();
    setStatus('🎙️ Escuchando… habla ahora.', 'info');

    let finalText = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += text; else interim += text;
      }
      const input = $('assistant-question');
      if (input) input.value = (finalText + interim).trim();
    };
    recognition.onend = () => {
      isListening = false;
      updateVoiceButton();
      if (finalText.trim()) {
        const input = $('assistant-question');
        if (input) input.value = finalText.trim();
        setTimeout(() => askAssistant(), 250);
      } else {
        setStatus('No pude captar la pregunta. Inténtalo nuevamente.', 'info');
      }
    };
    recognition.onerror = (event) => {
      isListening = false;
      updateVoiceButton();
      const msg = event.error === 'not-allowed' ? 'Debes permitir el acceso al micrófono en el navegador.' : 'No se pudo usar el micrófono: ' + event.error;
      setStatus(msg, 'error');
    };
    recognition.start();
  }

  function updateVoiceButton() {
    const btn = $('assistant-voice-btn');
    if (!btn) return;
    btn.textContent = isListening ? '⏹️' : '🎙️';
    btn.title = isListening ? 'Detener dictado' : 'Hablar';
    btn.setAttribute('aria-label', isListening ? 'Detener dictado' : 'Hablar');
    btn.classList.toggle('bg-rose-100', isListening);
    btn.classList.toggle('text-rose-700', isListening);
  }

  async function askAssistant() {
    const input = $('assistant-question');
    const question = input ? input.value.trim() : '';
    if (!question) { setStatus('Escribe una pregunta primero.', 'error'); return; }
    ensureGreeting();
    appendUserMessage(question);
    if (input) input.value = '';
    const btn = $('assistant-send-btn');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    showTyping();
    try {
      if (pendingClinical) { hideTyping(); await continuePendingClinical(question); return; }
      if (clinicalMode || isClinicalCommand(question)) { hideTyping(); await handleClinicalInput({ text: question }); return; }
      // Un rango explícito siempre tiene prioridad sobre la clasificación IA.
      // Así Gemini no puede convertir '07/09 al 03/10' en una consulta genérica de mes.
      let intent = parseDateRange(question) ? 'range' : localIntent(question);
      try {
        const aiIntent = await classifyWithGemini(question);
        if (aiIntent && !parseDateRange(question)) intent = aiIntent;
      } catch (e) {
        console.warn('[Asistente] Gemini no disponible; usando interpretación local.', e);
      }
      rememberConversation(question, intent);
      const answerHtml = answer(intent, question);
      // Pequeña pausa para que la respuesta se sienta conversacional en vez
      // de aparecer de golpe; el cálculo real ya terminó, esto es solo UX.
      await new Promise(res => setTimeout(res, 260));
      hideTyping();
      appendBotMessage(answerHtml);
      const el = $('assistant-status');
      if (el) el.classList.add('hidden');
      const wasVoiceQuery = voiceQueryActive;
      if (autoSpeak) setTimeout(() => speakAnswer(), 80);
      if (wasVoiceQuery) setStatus('✅ Consulta por voz procesada. Si el navegador bloquea el audio, toca “Leer respuesta”.', 'ok');
      voiceQueryActive = false;
    } catch (e) {
      console.error(e);
      hideTyping();
      appendBotMessage('<div class="assistant-title">⚠️ No pude procesar eso</div><div>' + escapeHtml(e.message || 'Ocurrió un error inesperado.') + '</div>');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '➤'; }
    }
  }

  function askAssistantExample(text) {
    const input = $('assistant-question');
    if (input) input.value = text;
    askAssistant();
  }


  /* =====================================================================
     HISTORIA CLÍNICA ASISTIDA POR IA
     La profesional dicta, escribe o adjunta un audio; Gemini lo ordena en
     los campos de la ficha. Se rellena el formulario abierto (sin guardar).
     ===================================================================== */
  const HC_CONSENT_KEY = 'agenda_pro_hc_ai_consent_v1';
  const HC_MAX_AUDIO_BYTES = 14 * 1024 * 1024; // el límite de la petición inline es ~20 MB (base64 +33%)
  let clinicalMode = false;
  let clinicalPatientId = '';
  let pendingClinical = null; // { text, audio } esperando que se indique el paciente
  let clinicalListening = false;
  let clinicalUserStopped = false;
  let clinicalRecognition = null;

  const HC_FIELDS = [
    { key: 'motivo', id: 'hc-motivo', label: 'Motivo de consulta' },
    { key: 'problema', id: 'hc-problema', label: 'Problema actual' },
    { key: 'impacto', id: 'hc-impacto', label: 'Impacto en su vida' },
    { key: 'historiaPersonal', id: 'hc-historia-personal', label: 'Historia personal relevante' },
    { key: 'vinculos', id: 'hc-vinculos', label: 'Vínculos y relaciones' },
    { key: 'tecnicas', id: 'hc-tecnicas', label: 'Técnicas e instrumentos' },
    { key: 'conducta', id: 'hc-conducta', label: 'Observación de conducta' },
    { key: 'hipotesis', id: 'hc-hipotesis', label: 'Hipótesis / conclusiones' },
    { key: 'recomendaciones', id: 'hc-recomendaciones', label: 'Recomendaciones' },
    { key: 'tareas', id: 'hc-tareas', label: 'Tareas / acuerdos' },
    { key: 'frecuencia', id: 'hc-frecuencia', label: 'Frecuencia', short: true },
    { key: 'enfoque', id: 'hc-enfoque', label: 'Enfoque', short: true },
    { key: 'duracion', id: 'hc-duracion', label: 'Duración sugerida', short: true },
    { key: 'ocupacion', id: 'hc-occupation', label: 'Ocupación', short: true },
    { key: 'estadoCivil', id: 'hc-civil-status', label: 'Estado civil', select: true }
  ];

  function isClinicalCommand(q) {
    const x = normalizeQuestion(q);
    return /\b(anota|anotar|registra|registrar|llena|llenar|completa|completar|agrega|agregar|actualiza|actualizar|escribe|redacta)\b.*\b(historia|evolucion|ficha)\b/.test(x)
      || /^\s*(historia clinica|evolucion|ficha clinica)\s+(de|del|para)\b/.test(x)
      || /\bdictar?\b.*\bhistoria\b/.test(x);
  }

  function patientById(id) {
    return (getData().patients || []).find(p => String(p.id) === String(id)) || null;
  }

  // Busca un paciente nombrado en el texto: nombre completo, o nombre + apellido, o nombre único.
  function findPatientInText(text) {
    const patients = (getData().patients || []).filter(p => p && p.name);
    const qn = normalizeQuestion(text || '');
    const full = patients
      .filter(p => qn.includes(normalizeQuestion(p.name)))
      .sort((a, b) => b.name.length - a.name.length);
    if (full.length) return { patient: full[0] };
    const words = new Set(qn.split(/[^a-z0-9]+/).filter(w => w.length > 2));
    const scored = patients.map(p => {
      const tokens = normalizeQuestion(p.name).split(/[^a-z0-9]+/).filter(w => w.length > 3);
      return { p, score: tokens.filter(t => words.has(t)).length };
    }).filter(x => x.score > 0);
    if (!scored.length) return null;
    const best = Math.max.apply(null, scored.map(x => x.score));
    const top = scored.filter(x => x.score === best);
    if (top.length === 1) return { patient: top[0].p };
    return { ambiguous: top.map(x => x.p) };
  }

  function openClinicalPatientId() {
    const modal = $('clinical-history-modal');
    if (!modal || modal.style.display !== 'flex') return '';
    const el = $('hc-patient-id');
    return el ? String(el.value || '') : '';
  }

  function updateClinicalBar() {
    const bar = $('assistant-clinical-bar');
    const sub = $('assistant-subtitle');
    const q = $('assistant-question');
    const p = clinicalPatientId ? patientById(clinicalPatientId) : null;
    if (bar) {
      bar.classList.toggle('hidden', !clinicalMode);
      const name = bar.querySelector('[data-role="patient"]');
      if (name) name.textContent = p ? p.name : 'se indicará en el mensaje';
    }
    if (sub) sub.textContent = clinicalMode ? 'Modo historia clínica · el contenido se envía a Gemini' : 'En línea · solo datos administrativos';
    if (q) q.placeholder = clinicalMode ? 'Dicta o escribe lo trabajado en la sesión…' : 'Escribe tu pregunta…';
  }

  function startClinicalMode(patientId) {
    clinicalMode = true;
    pendingClinical = null;
    clinicalPatientId = patientId ? String(patientId) : '';
    updateClinicalBar();
    ensureGreeting();
    const p = clinicalPatientId ? patientById(clinicalPatientId) : null;
    appendBotMessage(`<div class="assistant-title">🩺 Modo historia clínica</div><div>${p ? 'Paciente: <b>' + escapeHtml(p.name) + '</b>. ' : 'Indica el paciente en tu mensaje (por ejemplo: «María López: …»). '}Dicta con 🎙️, escribe, o adjunta un audio con 📎. Completaré los campos de la ficha y tú revisas antes de guardar.</div>`);
    const q = $('assistant-question');
    if (q) setTimeout(() => q.focus(), 100);
  }

  function cancelClinicalMode() {
    clinicalMode = false;
    clinicalPatientId = '';
    pendingClinical = null;
    if (clinicalListening && clinicalRecognition) { clinicalUserStopped = true; try { clinicalRecognition.stop(); } catch (_) {} }
    updateClinicalBar();
  }

  // Abre el chat por encima de la ficha clínica ya abierta, con el paciente preseleccionado.
  function openAssistantForClinical(patientId) {
    openAssistantModal();
    const modal = $('assistant-modal');
    if (modal) modal.style.zIndex = '10000';
    startClinicalMode(patientId || openClinicalPatientId());
  }

  function ensureClinicalConsent() {
    if (localStorage.getItem(HC_CONSENT_KEY) === 'yes') return true;
    const ok = confirm('El modo Historia Clínica envía a Gemini (Google) el texto o audio que dictes o adjuntes, solo para ordenarlo en la ficha. Las consultas de agenda siguen resolviéndose en tu navegador.\n\nÚsalo únicamente si cuentas con el consentimiento informado del paciente para este tratamiento de sus datos.\n\n¿Continuar?');
    if (ok) localStorage.setItem(HC_CONSENT_KEY, 'yes');
    return ok;
  }

  function buildClinicalPrompt(hasAudio) {
    const keys = HC_FIELDS.map(f => '"' + f.key + '"').join(', ');
    return `Eres un asistente de redacción clínica para una psicóloga. ${hasAudio ? 'Recibirás un audio (dictado de la profesional o grabación de una sesión)' : 'Recibirás un texto dictado o escrito por la profesional'} con información de un paciente. Tu tarea es ordenar SOLO lo que se dijo dentro de los campos de una historia clínica psicológica.
Devuelve únicamente un objeto JSON con estas claves de tipo texto: ${keys}; y la clave "evolucion", un objeto con "fecha" (AAAA-MM-DD), "sesion" y "texto".
Reglas estrictas:
- Usa únicamente información presente en el contenido. NO inventes, NO completes con suposiciones y NO propongas diagnósticos: "hipotesis" solo si la profesional los formuló explícitamente.
- Si un campo no se menciona, devuélvelo como "" (cadena vacía).
- Redacta en español, en tercera persona, con tono clínico profesional y conciso, fiel a lo dicho; elimina muletillas y repeticiones.
- "estadoCivil" debe ser exactamente uno de: Soltera(o), Casada(o), Viuda(o), Separada(o), Conviviente; o "".
- "evolucion.texto" resume lo ocurrido en la sesión descrita (temas tratados, intervenciones, respuesta del paciente, acuerdos). Déjalo "" si el contenido son solo datos generales de la historia y no describe una sesión concreta.
- "evolucion.fecha": la fecha indicada o, si no se menciona, ${todayLima()}. "evolucion.sesion": por ejemplo "Sesión 3" solo si se menciona; si no, "".
- Responde solo con el JSON, sin comentarios ni markdown.`;
  }

  function parseJsonLoose(raw) {
    let t = String(raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(t); } catch (_) {}
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a !== -1 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) {} }
    throw new Error('No pude interpretar la respuesta de Gemini. Inténtalo de nuevo.');
  }

  async function extractClinicalWithGemini(content) {
    const key = localStorage.getItem(KEY_NAME);
    if (!key) throw new Error('Configura tu clave de Gemini (botón ⚙️ Gemini, abajo) para usar esta función.');
    const parts = [{ text: buildClinicalPrompt(!!content.audio) }];
    if (content.text) parts.push({ text: 'CONTENIDO:\n' + content.text });
    if (content.audio) parts.push({ inline_data: { mime_type: content.audio.mime, data: content.audio.data } });
    const data = await callGemini({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' }
    });
    const raw = (((data.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || '').join('') || '';
    if (!raw) throw new Error('Gemini no devolvió contenido. Prueba con un texto o audio más claro.');
    return parseJsonLoose(raw);
  }

  function markAiField(el) {
    if (!el) return;
    el.style.boxShadow = '0 0 0 2px #a78bfa';
    el.addEventListener('input', () => { el.style.boxShadow = ''; }, { once: true });
  }

  function clinicalHasContent(data) {
    if (!data || typeof data !== 'object') return false;
    const anyField = HC_FIELDS.some(f => typeof data[f.key] === 'string' && data[f.key].trim());
    const ev = data.evolucion;
    return anyField || !!(ev && typeof ev.texto === 'string' && ev.texto.trim());
  }

  // Rellena el formulario de la historia clínica SIN guardar. Nunca borra ni pisa lo ya escrito:
  // en textos largos añade debajo; en campos cortos solo rellena si están vacíos.
  function applyClinicalToForm(patient, data) {
    const modal = $('clinical-history-modal');
    const openId = openClinicalPatientId();
    if (String(openId) !== String(patient.id)) {
      if (openId && !confirm('Tienes abierta la historia de otro paciente. Si continúas se cerrará sin guardar sus cambios pendientes. ¿Continuar?')) return null;
      if (typeof window.openClinicalHistory !== 'function') throw new Error('No encontré la ventana de Historia Clínica en la página.');
      window.openClinicalHistory(patient.id);
    }
    if (openClinicalPatientId() !== String(patient.id)) throw new Error('No se pudo abrir la historia clínica del paciente.');

    const stamp = todayLima().split('-').reverse().join('/');
    const filled = [], skipped = [], marked = [];
    HC_FIELDS.forEach(f => {
      const el = $(f.id);
      const val = typeof data[f.key] === 'string' ? data[f.key].trim() : '';
      if (!el || !val) return;
      const current = String(el.value || '').trim();
      const same = normalizeQuestion(current) === normalizeQuestion(val);
      if (f.select) {
        const opt = Array.from(el.options).find(o => normalizeQuestion(o.text) === normalizeQuestion(val));
        if (!opt) return;
        if (!current) { el.value = opt.value; filled.push(f.label); marked.push(el); markAiField(el); }
        else if (!same) skipped.push(f.label);
        return;
      }
      if (!current) { el.value = val; filled.push(f.label); marked.push(el); markAiField(el); return; }
      if (f.short) { if (!same) skipped.push(f.label); return; }
      if (!normalizeQuestion(current).includes(normalizeQuestion(val))) {
        el.value = current + '\n\n[Añadido con IA · ' + stamp + ']\n' + val;
        filled.push(f.label + ' (añadido al final)'); marked.push(el); markAiField(el);
      }
    });

    let noteAdded = false;
    const ev = data.evolucion || {};
    const evText = typeof ev.texto === 'string' ? ev.texto.trim() : '';
    if (evText && typeof window.newClinicalNote === 'function') {
      window.newClinicalNote({});
      const cards = document.querySelectorAll('#clinical-notes-container > div');
      const card = cards[cards.length - 1];
      if (card) {
        card.querySelector('.note-date').value = /^\d{4}-\d{2}-\d{2}$/.test(String(ev.fecha || '')) ? ev.fecha : todayLima();
        card.querySelector('.note-session').value = (ev.sesion && String(ev.sesion).trim()) || ('Sesión ' + cards.length);
        const ta = card.querySelector('.note-text');
        ta.value = evText;
        markAiField(ta);
        marked.push(card);
        noteAdded = true;
      }
    }

    // Aviso dentro de la ficha para que la revisión sea evidente.
    const body = modal.querySelector('.overflow-y-auto');
    if (body) {
      const old = $('hc-ai-banner'); if (old) old.remove();
      const banner = document.createElement('div');
      banner.id = 'hc-ai-banner';
      banner.className = 'mb-4 p-3 rounded-xl border border-violet-200 bg-violet-50 text-violet-800 text-sm flex items-start justify-between gap-3';
      banner.innerHTML = '<div>✨ <b>Completado con IA.</b> Revisa los campos resaltados en violeta' + (noteAdded ? ' y la nueva evolución al final' : '') + '; aún <b>no está guardado</b>. Pulsa «Guardar Historia Clínica» cuando estés conforme.</div><button type="button" class="text-violet-500 hover:text-violet-800 text-lg leading-none" onclick="this.parentElement.remove()">×</button>';
      body.insertBefore(banner, body.firstChild);
      body.scrollTop = 0;
      if (marked[0]) setTimeout(() => { try { marked[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {} }, 300);
    }
    return { filled, skipped, noteAdded };
  }

  async function runClinicalFill(patient, content) {
    if (!ensureClinicalConsent()) {
      appendBotMessage('Entendido, no envié nada a Gemini. Puedes escribir la historia manualmente en la ficha.');
      return;
    }
    showTyping();
    let data;
    try {
      data = await extractClinicalWithGemini(content);
    } catch (e) {
      console.error(e);
      hideTyping();
      appendBotMessage('<div class="assistant-title">⚠️ No pude procesar el contenido</div><div>' + escapeHtml(e.message || 'Error inesperado.') + '</div>');
      return;
    }
    hideTyping();
    if (!clinicalHasContent(data)) {
      appendBotMessage('No encontré información clínica que pueda ordenar en ese contenido. Cuéntame un poco más (motivo, situación actual, lo trabajado en sesión…).');
      return;
    }
    let result;
    try { result = applyClinicalToForm(patient, data); }
    catch (e) { console.error(e); appendBotMessage('⚠️ ' + escapeHtml(e.message || 'No pude abrir la ficha.')); return; }
    if (!result) { appendBotMessage('Cancelado. No modifiqué ninguna ficha.'); pendingClinical = content; clinicalPatientId = ''; return; }

    const lines = [];
    if (result.filled.length) lines.push('<b>Campos:</b> ' + result.filled.map(escapeHtml).join(', '));
    if (result.noteAdded) lines.push('<b>Nueva evolución</b> agregada.');
    if (result.skipped.length) lines.push('No sobrescribí (ya tenían otro valor): ' + result.skipped.map(escapeHtml).join(', '));
    appendBotMessage('<div class="assistant-title">✅ Ficha de ' + escapeHtml(patient.name) + ' completada (sin guardar)</div><div>' + (lines.join('<br>') || 'No había cambios nuevos.') + '</div><div class="mt-2 text-[11px] text-slate-500">Revisa y pulsa «Guardar Historia Clínica».</div>');
    cancelClinicalMode();
    setTimeout(closeAssistantModal, 1100);
  }

  async function handleClinicalInput(content) {
    const text = (content.text || '').trim();
    let patient = null;
    if (clinicalPatientId) patient = patientById(clinicalPatientId);
    if (!patient) {
      const r = findPatientInText(text);
      if (r && r.ambiguous) {
        pendingClinical = content;
        appendBotMessage('Hay varios pacientes que coinciden: <b>' + r.ambiguous.map(p => escapeHtml(p.name)).join('</b>, <b>') + '</b>. Escribe el nombre completo del paciente (o «cancelar»).');
        return;
      }
      if (r && r.patient) patient = r.patient;
    }
    if (!patient) {
      const openId = openClinicalPatientId();
      if (openId) patient = patientById(openId);
    }
    if (!patient) {
      if (!clinicalMode && !content.audio && text.split(/\s+/).length < 8) {
        startClinicalMode('');
        return;
      }
      pendingClinical = content;
      appendBotMessage('¿De qué paciente es? Escribe su nombre completo (o «cancelar»).');
      return;
    }
    // Orden corto sin contenido, p. ej. «historia clínica de María»: entra al modo y espera el dictado.
    if (!clinicalMode && !content.audio && text.split(/\s+/).length < 8) {
      startClinicalMode(patient.id);
      return;
    }
    clinicalPatientId = String(patient.id);
    await runClinicalFill(patient, content);
  }

  async function continuePendingClinical(question) {
    if (/^\s*(cancelar|cancela|olvidalo|olvídalo|no)\s*[.!]?\s*$/i.test(question)) {
      pendingClinical = null;
      appendBotMessage('Listo, descarté ese contenido. No se envió nada a Gemini.');
      return;
    }
    const r = findPatientInText(question);
    if (!r || !r.patient) {
      appendBotMessage(r && r.ambiguous
        ? 'Sigue habiendo más de una coincidencia: ' + r.ambiguous.map(p => escapeHtml(p.name)).join(', ') + '. Escribe el nombre completo.'
        : 'No encontré ese paciente en tu lista. Escribe su nombre tal como aparece en la agenda (o «cancelar»).');
      return;
    }
    const content = pendingClinical;
    pendingClinical = null;
    clinicalPatientId = String(r.patient.id);
    await runClinicalFill(r.patient, content);
  }

  // ---- Audio adjunto ----
  const AUDIO_MIME_BY_EXT = { mp3: 'audio/mp3', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
    m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', aiff: 'audio/aiff', webm: 'audio/webm' };

  function guessAudioMime(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (AUDIO_MIME_BY_EXT[ext]) return AUDIO_MIME_BY_EXT[ext];
    if (file.type === 'audio/mpeg') return 'audio/mp3';
    return file.type || 'audio/ogg';
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(new Error('No pude leer el archivo de audio.'));
      r.readAsDataURL(file);
    });
  }

  function pickAssistantAudio() {
    const input = $('assistant-audio-input');
    if (input) input.click();
  }

  async function handleAssistantAudio(inputEl) {
    const file = inputEl && inputEl.files && inputEl.files[0];
    if (inputEl) inputEl.value = '';
    if (!file) return;
    if (file.size > HC_MAX_AUDIO_BYTES) {
      setStatus('El audio pesa ' + (file.size / 1048576).toFixed(1) + ' MB y el máximo es 14 MB. Recórtalo o expórtalo en menor calidad.', 'error');
      return;
    }
    ensureGreeting();
    const q = $('assistant-question');
    const extra = q ? q.value.trim() : '';
    if (q) q.value = '';
    appendUserMessage('🎧 ' + file.name + ' (' + (file.size / 1048576).toFixed(1) + ' MB)' + (extra ? ' — ' + extra : ''));
    if (pendingClinical) {
      // Si ya había contenido esperando paciente, el nombre puede venir en el texto acompañante.
      const r = findPatientInText(extra);
      if (!r || !r.patient) { appendBotMessage('Primero indícame el paciente del contenido anterior (o «cancelar»).'); return; }
    }
    showTyping();
    try {
      const audio = { mime: guessAudioMime(file), data: await fileToBase64(file), name: file.name };
      hideTyping();
      await handleClinicalInput({ text: extra, audio });
    } catch (e) {
      hideTyping();
      appendBotMessage('⚠️ ' + escapeHtml(e.message || 'No pude procesar el audio.'));
    }
  }

  // ---- Dictado largo (modo clínico): continuo, sin enviar solo ----
  function toggleClinicalDictation(SR) {
    if (clinicalListening) {
      clinicalUserStopped = true;
      try { clinicalRecognition.stop(); } catch (_) {}
      return;
    }
    clinicalUserStopped = false;
    clinicalListening = true;
    isListening = true;
    updateVoiceButton();
    setStatus('🎙️ Dictando… habla con calma. Pulsa ⏹️ al terminar y luego ➤ para enviar.', 'info');
    const input = $('assistant-question');
    const startSession = () => {
      const base = input ? input.value.trim() : '';
      let finalText = '';
      const rec = new SR();
      clinicalRecognition = rec;
      rec.lang = 'es-PE';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += t; else interim += t;
        }
        if (input) input.value = (base + ' ' + finalText + interim).trim();
      };
      rec.onend = () => {
        // Chrome corta el reconocimiento tras silencios: se reanuda hasta que la profesional lo detenga.
        if (!clinicalUserStopped && clinicalMode) { try { startSession(); return; } catch (_) {} }
        clinicalListening = false;
        isListening = false;
        updateVoiceButton();
        setStatus('Dictado detenido. Revisa el texto y pulsa ➤ para enviarlo.', 'info');
      };
      rec.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        clinicalUserStopped = true;
        setStatus(event.error === 'not-allowed' ? 'Debes permitir el acceso al micrófono en el navegador.' : 'No se pudo usar el micrófono: ' + event.error, 'error');
      };
      rec.start();
    };
    startSession();
  }

  window.startClinicalMode = startClinicalMode;
  window.cancelClinicalMode = cancelClinicalMode;
  window.openAssistantForClinical = openAssistantForClinical;
  window.pickAssistantAudio = pickAssistantAudio;
  window.handleAssistantAudio = handleAssistantAudio;

  console.info('[Asistente IA] versión', APP_VERSION);
  window.openAssistantModal = openAssistantModal;
  window.closeAssistantModal = closeAssistantModal;
  window.openGeminiConfig = openGeminiConfig;
  window.saveGeminiKey = saveGeminiKey;
  window.clearGeminiKey = clearGeminiKey;
  window.askAssistant = askAssistant;
  window.toggleAssistantVoice = toggleAssistantVoice;
  window.askAssistantExample = askAssistantExample;
  window.speakAnswer = speakAnswer;
  window.stopAnswerVoice = stopAnswerVoice;
  window.toggleAutoVoice = toggleAutoVoice;
  window.hideFabGreetBubble = hideFabGreetBubble;
  window.addEventListener('DOMContentLoaded', () => {
    updateConfigState();
    // Igual que un widget de WhatsApp: a los pocos segundos de cargar la
    // agenda (ya con sesión iniciada) aparece una burbuja invitando a usar
    // el asistente, sin ser intrusiva y solo una vez por sesión.
    setTimeout(showFabGreetBubble, 3500);
  });
})();
