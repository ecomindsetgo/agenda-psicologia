/* Asistente IA administrativo - Agenda Psicología Pro+
   Gemini recibe SOLO la pregunta del usuario para clasificar la intención.
   Los datos administrativos se procesan localmente en el navegador.
   Nunca se envían historias, notas, diagnósticos ni motivos de consulta.
*/
(function () {
  'use strict';

  const KEY_NAME = 'agenda_pro_gemini_api_key';
  const APP_VERSION = '2026.09.10.1';
  const MODEL = 'gemini-2.0-flash';
  let lastAnswerText = '';
  let voiceQueryActive = false;
  let autoSpeak = true;

  function $(id) { return document.getElementById(id); }

  function openAssistantModal() {
    const modal = $('assistant-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    updateConfigState();
    const q = $('assistant-question');
    if (q) setTimeout(() => q.focus(), 50);
  }

  function closeAssistantModal() {
    const modal = $('assistant-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
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

  function setAnswer(html) {
    const el = $('assistant-answer');
    if (!el) return;
    el.innerHTML = html;
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
    return { appointments: [] };
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

    // Estado de confirmación/atención: "sin confirmar", "por confirmar".
    if (/sin confirmar|no confirmad|por confirmar|falta.*confirmar/.test(x)) return 'unconfirmed';

    // Combinación de tareas + pagos pendientes para un periodo.
    if (/tareas?.*pendient|pendient.*(tareas|por hacer)|que.*queda.*pendiente/.test(x)) return 'pending_tasks';

    // Comparación de ingresos entre periodos.
    if (/comparad|comparacion.*ingres|respecto al mes pasado|como van.*ingres/.test(x)) return 'compare';

    // Próxima/primera cita (por hora), antes que el patrón genérico de "hora de la cita".
    if (/proxima cita|siguiente cita|primera cita|a que hora.*(empieza|inicia|es).*(primera|proxima|siguiente)/.test(x)) return 'next';

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
    if (/cuantas|cantidad|numero|numero de|total.*cita|citas|reservas?|agenda/.test(x)) return 'count';
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
    const explicit = q.match(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{4}\b/g);
    if (explicit && explicit.length >= 2) {
      const start = parseDateOnly(explicit[0]);
      const end = parseDateOnly(explicit[1]);
      if (start && end) return { start, end, label: `del ${formatDate(start)} al ${formatDate(end)}` };
    }
    // Ejemplos: "del 1 al 9 de septiembre", "desde el 1 de septiembre hasta el 9 de septiembre"
    const months = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
    let m = q.match(new RegExp('(?:del|desde)\\s+(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(' + months + ')\\s+(?:de\\s+)?(\\d{4})?\\s+(?:al|hasta)\\s+(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(' + months + ')(?:\\s+(?:de\\s+)?(\\d{4}))?'));
    if (m) {
      const year = Number(m[3] || m[6] || new Date().getFullYear());
      const start = parseDateOnly(`${m[1]} de ${m[2]}`, year);
      const end = parseDateOnly(`${m[4]} de ${m[5]}`, Number(m[6] || year));
      if (start && end) return { start, end, label: `del ${formatDate(start)} al ${formatDate(end)}` };
    }
    // Ejemplo abreviado: "del 1 al 9 de septiembre"
    m = q.match(new RegExp('del\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+(' + months + ')(?:\\s+de\\s+(\\d{4}))?'));
    if (m) {
      const year = Number(m[4] || new Date().getFullYear());
      const start = parseDateOnly(`${m[1]} de ${m[3]}`, year);
      const end = parseDateOnly(`${m[2]} de ${m[3]}`, year);
      if (start && end) return { start, end, label: `del ${formatDate(start)} al ${formatDate(end)}` };
    }
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

  async function classifyWithGemini(question) {
    const key = localStorage.getItem(KEY_NAME);
    if (!key) return null;
    const allowed = ['today','tomorrow','yesterday','week','last_week','month','last_month','cancelled',
      'real_income','pending','pending_tasks','projection','compare','patient_time','next','free','busiest',
      'unconfirmed','people','count','range','help'];
    const prompt = `Clasifica esta pregunta administrativa de una agenda de psicología en UNA sola categoría. NO solicites ni devuelvas datos de pacientes. Categorías permitidas: ${allowed.join(', ')}. Responde únicamente con la categoría. Pregunta: ${question}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 10 } })
    });
    if (!response.ok) throw new Error('Gemini respondió con HTTP ' + response.status);
    const data = await response.json();
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
      return `<div class="assistant-title">📅 ${escapeHtml(title)}</div><div class="assistant-total">${list.length}</div>${list.length ? '<ul class="assistant-list">' + list.slice().sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).slice(0, 30).map(a => `<li><b>${escapeHtml(a.patientName)}</b> — ${formatDate(a.date)} ${escapeHtml(a.time || '')}</li>`).join('') + '</ul>' : '<div>No hay citas registradas para ese periodo.</div>'}`;
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
      scoped = scoped.slice().sort((a, b) => String(a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      return `<div class="assistant-title">📝 Citas sin confirmar (${escapeHtml(label)})</div><div class="assistant-total">${scoped.length}</div>${scoped.length ? '<ul class="assistant-list">' + scoped.slice(0, 20).map(a => `<li>${formatDate(a.date)} ${escapeHtml(a.time || '')} — <b>${escapeHtml(a.patientName)}</b></li>`).join('') + '</ul>' : '<div>No hay citas pendientes de confirmar/atender en ese periodo.</div>'}`;
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
    } else if (intent === 'patient_time') {
      const words = normalizeQuestion(question).split(/\s+/).filter(w => w.length > 2 && !['quien','tiene','cita','hora','que','a','para','el','la','de'].includes(w));
      const matches = words.length ? list.filter(a => words.some(w => normalizeQuestion(a.patientName).includes(w))) : [];
      if (!matches.length) return '<div class="assistant-title">🔎 No encontré una coincidencia.</div><div>Prueba con el nombre del paciente, por ejemplo: “¿A qué hora tiene cita María?”</div>';
      return '<div class="assistant-title">🕐 Horario encontrado</div><ul class="assistant-list">' + matches.slice(0, 10).map(a => `<li><b>${escapeHtml(a.patientName)}</b>: ${escapeHtml(a.time || 'sin hora')} — ${formatDate(a.date)}</li>`).join('') + '</ul>';
    } else if (intent === 'cancelled') {
      list = all.filter(a => a && a.date && String(a.status || '').toLowerCase() === 'cancelada');
      return `<div class="assistant-title">❌ Citas canceladas</div><div class="assistant-total">${list.length}</div>${list.length ? '<ul class="assistant-list">' + list.slice(0, 20).map(a => `<li>${formatDate(a.date)} ${escapeHtml(a.time || '')} — ${escapeHtml(a.patientName)}</li>`).join('') + '</ul>' : '<div>No hay citas canceladas registradas.</div>'}`;
    } else if (intent === 'help') {
      return '<div class="assistant-title">🤖 Puedo ayudarte con la agenda</div><div>Ejemplos: “¿Cuántas citas tengo esta semana?”, “¿Tengo espacios libres hoy?”, “¿A qué hora es mi próxima cita?”, “¿Qué día tengo más citas este mes?”, “¿Cuánto ingresé realmente este mes?”, “¿Cuánto tengo pendiente por cobrar?”, “¿Qué clientes me deben?”, “¿Tengo citas sin confirmar?”, “¿Cómo van mis ingresos comparado con el mes pasado?”, “¿Cuál es mi proyección de ingresos este mes?” o “¿Cuánto ingresé del 01/09/2026 al 09/09/2026?”.</div>';
    }

    if (intent === 'people') {
      return `<div class="assistant-title">👥 ${title}</div><div class="assistant-total">${list.length} cita(s)</div>${list.length ? '<ul class="assistant-list">' + list.slice().sort((a,b) => String(a.time).localeCompare(String(b.time))).map(a => `<li><b>${escapeHtml(a.patientName)}</b> — ${escapeHtml(a.time || 'sin hora')}</li>`).join('') + '</ul>' : '<div>No hay citas registradas.</div>'}`;
    }

    return `<div class="assistant-title">📅 ${title}</div><div class="assistant-total">${list.length}</div>${list.length ? '<ul class="assistant-list">' + list.slice().sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).slice(0, 30).map(a => `<li><b>${escapeHtml(a.patientName)}</b> — ${formatDate(a.date)} ${escapeHtml(a.time || '')}</li>`).join('') + '</ul>' : '<div>No hay citas registradas para ese periodo.</div>'}`;
  }

  function speakAnswer() {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setStatus('Este navegador no admite lectura por voz. Prueba Chrome o Edge.', 'error');
      return false;
    }
    const text = lastAnswerText || (($('assistant-answer') || {}).innerText || '');
    if (!text.trim()) {
      setStatus('Primero realiza una consulta.', 'info');
      return false;
    }
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      // En móviles, especialmente iPhone/iPad, es más fiable crear la voz
      // inmediatamente dentro de la interacción del usuario.
      const utterance = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').trim());
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
    voiceQueryActive = true;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('Tu navegador no admite dictado por voz. Usa Google Chrome o Microsoft Edge.', 'error');
      return;
    }
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
    const btn = $('assistant-send-btn');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    setStatus('Consultando…', 'info');
    try {
      // Un rango explícito siempre tiene prioridad sobre la clasificación IA.
      // Así Gemini no puede convertir '07/09 al 03/10' en una consulta genérica de mes.
      let intent = parseDateRange(question) ? 'range' : localIntent(question);
      try {
        const aiIntent = await classifyWithGemini(question);
        if (aiIntent && !parseDateRange(question)) intent = aiIntent;
      } catch (e) {
        console.warn('[Asistente] Gemini no disponible; usando interpretación local.', e);
      }
      const answerHtml = answer(intent, question);
      setAnswer(answerHtml);
      const answerEl = $('assistant-answer');
      lastAnswerText = answerEl ? answerEl.innerText : '';
      setStatus('Consulta procesada localmente. Gemini solo interpretó la pregunta.', 'ok');
      const wasVoiceQuery = voiceQueryActive;
      if (autoSpeak) setTimeout(() => speakAnswer(), 80);
      if (wasVoiceQuery) setStatus('✅ Consulta por voz procesada. Reproduciendo respuesta… si el navegador la bloquea, toca “Leer respuesta”.', 'ok');
      voiceQueryActive = false;
    } catch (e) {
      console.error(e);
      setStatus('No se pudo procesar la consulta: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '➤'; }
    }
  }

  function askAssistantExample(text) {
    const input = $('assistant-question');
    if (input) input.value = text;
    askAssistant();
  }

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
  window.addEventListener('DOMContentLoaded', updateConfigState);
})();
