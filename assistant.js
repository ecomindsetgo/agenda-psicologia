/* Asistente IA administrativo - Agenda Psicología Pro+
   Funciones:
   - Agenda diaria/semanal/mensual y próxima cita.
   - Espacios libres según el horario operativo del consultorio.
   - Consultas por paciente: próximas citas e historial administrativo.
   - Ingresos reales, pendientes y proyección.
   - Reportes por rango, rentabilidad, demanda, asistencia/cancelación.
   - Pacientes nuevos mes actual vs. mes anterior.

   PRIVACIDAD:
   Gemini se usa solo para clasificar preguntas genéricas.
   Las consultas que puedan contener nombres de pacientes se resuelven
   localmente y NO se envían a Gemini. Nunca se leen historias clínicas
   ni notas clínicas.
*/
(function () {
  'use strict';

  const KEY_NAME = 'agenda_pro_gemini_api_key';
  const APP_VERSION = '2026.09.09.6';
  const MODEL = 'gemini-2.0-flash';
  const HORARIO_SLOTS = ['10:00','11:00','12:00','16:00','17:00','18:00','19:00'];
  const HORARIO_DAYS = ['lunes','martes','miercoles','jueves','viernes','sabado'];
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
    if (!key) { alert('Pega primero tu API Key de Gemini.'); return; }
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
    setStatus('Clave eliminada. El asistente seguirá funcionando con interpretación local.', 'info');
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
    if (type === 'ok') el.classList.add('bg-emerald-50','text-emerald-700','border','border-emerald-200');
    else if (type === 'error') el.classList.add('bg-rose-50','text-rose-700','border','border-rose-200');
    else el.classList.add('bg-slate-50','text-slate-600','border','border-slate-200');
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
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function todayLima() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone:'America/Lima', year:'numeric', month:'2-digit', day:'2-digit'
    }).format(new Date());
  }
  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  }
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-PE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
  }
  function getMonthRange(dateStr) {
    const ym = dateStr.slice(0,7);
    const start = ym + '-01';
    const d = new Date(start + 'T12:00:00');
    d.setMonth(d.getMonth()+1);
    return [start,d.toISOString().slice(0,10)];
  }
  function getWeekRange(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1-day;
    d.setDate(d.getDate()+mondayOffset);
    const start = d.toISOString().slice(0,10);
    return [start,addDays(start,7)];
  }
  function getPreviousWeekRange(dateStr) {
    const [start] = getWeekRange(dateStr);
    const prevStart = addDays(start,-7);
    return [prevStart,start];
  }
  function getPreviousMonthRange(dateStr) {
    const first = dateStr.slice(0,7) + '-01';
    const d = new Date(first + 'T12:00:00');
    d.setDate(0);
    const end = addDays(d.toISOString().slice(0,10),1);
    const prev = new Date(end + 'T12:00:00');
    prev.setDate(1);
    return [prev.toISOString().slice(0,10),end];
  }
  function getData() {
    try {
      if (typeof window.getAgendaAdminSnapshot === 'function') return window.getAgendaAdminSnapshot();
    } catch (e) { console.error(e); }
    return {appointments:[],patients:[]};
  }
  function isCancelled(a) {
    return /(cancel|anulad)/.test(normalizeQuestion(a.status || ''));
  }
  function isRescheduled(a) {
    return /(reprogram|reagend)/.test(normalizeQuestion(a.status || ''));
  }
  function isActiveAppointment(a) { return !isCancelled(a); }
  function isCompleted(a) { return normalizeQuestion(a.status || '') === 'completada' || /complet/.test(normalizeQuestion(a.status || '')); }
  function isPaid(a) { return normalizeQuestion(a.paymentStatus || '') === 'pagado'; }
  function isPendingPayment(a) { return normalizeQuestion(a.paymentStatus || '') === 'pendiente'; }
  function money(amount,currency) {
    const n = Number(amount || 0).toFixed(2);
    return currency === 'USD' ? '$' + n : 'S/ ' + n;
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
    return keys.length ? keys.map(c => money(byCurrency[c],c)).join(' + ') : 'S/ 0.00';
  }
  function normalizeQuestion(q) {
    return String(q || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
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
      const start = parseDateOnly(explicit[0]), end = parseDateOnly(explicit[1]);
      if (start && end) return {start,end,label:`del ${formatDate(start)} al ${formatDate(end)}`};
    }
    const months = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
    let m = q.match(new RegExp('(?:del|desde|entre)\\s+(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(' + months + ')(?:\\s+de\\s+(\\d{4}))?\\s+(?:al|hasta|y)\\s+(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(' + months + ')(?:\\s+de\\s+(\\d{4}))?'));
    if (m) {
      const year = Number(m[3] || m[6] || new Date().getFullYear());
      const start = parseDateOnly(`${m[1]} de ${m[2]}`,year);
      const end = parseDateOnly(`${m[4]} de ${m[5]}`,Number(m[6] || year));
      if (start && end) return {start,end,label:`del ${formatDate(start)} al ${formatDate(end)}`};
    }
    m = q.match(new RegExp('(?:del|entre)\\s+(\\d{1,2})\\s+(?:al|y)\\s+(\\d{1,2})\\s+de\\s+(' + months + ')(?:\\s+de\\s+(\\d{4}))?'));
    if (m) {
      const year = Number(m[4] || new Date().getFullYear());
      const start = parseDateOnly(`${m[1]} de ${m[3]}`,year);
      const end = parseDateOnly(`${m[2]} de ${m[3]}`,year);
      if (start && end) return {start,end,label:`del ${formatDate(start)} al ${formatDate(end)}`};
    }
    // Formato mixto: una fecha con barras/guiones y otra en palabras (p.ej. "del 07/09/2026 al 3 de octubre").
    if (explicit && explicit.length === 1) {
      const slashDate = parseDateOnly(explicit[0]);
      const year = slashDate ? Number(slashDate.slice(0,4)) : new Date().getFullYear();
      const wm = q.match(new RegExp('(?:al|hasta|y)\\s+(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(' + months + ')(?:\\s+(?:de\\s+)?(\\d{4}))?'));
      if (wm && slashDate) {
        const otherDate = parseDateOnly(`${wm[1]} de ${wm[2]}`, Number(wm[3] || year));
        if (otherDate) {
          const [start,end] = slashDate <= otherDate ? [slashDate,otherDate] : [otherDate,slashDate];
          return {start,end,label:`del ${formatDate(start)} al ${formatDate(end)}`};
        }
      }
    }
    return null;
  }

  function findPatient(question, patients, appointments) {
    const q = normalizeQuestion(question);
    // Primero coincidencia exacta de nombre completo, luego tokens significativos.
    const sorted = (patients || []).slice().sort((a,b) => String(b.name||'').length - String(a.name||'').length);
    for (const p of sorted) {
      const name = normalizeQuestion(p.name);
      if (name && q.includes(name)) return p;
    }
    // También permite consultas con solo nombre/apellido cuando no hay ambigüedad.
    const candidates = [];
    sorted.forEach(p => {
      const tokens = normalizeQuestion(p.name).split(/\s+/).filter(t => t.length >= 3);
      const hits = tokens.filter(t => q.includes(t));
      if (hits.length >= Math.min(2,tokens.length) || (tokens.length === 1 && hits.length === 1)) candidates.push({p,hits:hits.length});
    });
    candidates.sort((a,b)=>b.hits-a.hits);
    return candidates.length ? candidates[0].p : null;
  }

  function questionLooksPatientSpecific(q, data) {
    const x = normalizeQuestion(q);
    if (/(paciente|historial|ultima sesion|ultimo|proxima.*cita|pendiente.*confirmad|dias.*cita)/.test(x)) {
      const p = findPatient(q,data.patients || [],data.appointments || []);
      if (p) return true;
    }
    return !!findPatient(q,data.patients || [],data.appointments || []);
  }

  function localIntent(q) {
    const x = normalizeQuestion(q);
    if (/espacio|hueco|disponible|libre/.test(x) && /(tarde|hoy|emergencia)/.test(x)) return 'availability';
    if (/historial|ultima sesion|cuando fue.*ultima|ultima.*cita|proxima.*confirmada|pendiente.*proxima|que dias.*cita/.test(x)) return 'patient_history';
    if (/paciente nuevo|pacientes nuevos|nuevos.*pacientes/.test(x)) return 'new_patients';
    if (/asistencia|asistieron|asistencias|cancelacion|cancelaciones|reprogramacion|reprogramaciones/.test(x)) return 'attendance';
    if (/demanda|mayor demanda|dia.*mas.*cita|horario.*mas.*cita|horarios.*mayor/.test(x)) return 'demand';
    if (/mas rentable|mas ingresos|rentable/.test(x)) return 'profitability';
    if (/proxima cita|siguiente cita|a que hora.*proxima/.test(x)) return 'next';
    if (/proyec|esperad|estimad|previs|voy a (ganar|cobrar|recibir)|puedo (ganar|cobrar)/.test(x)) return 'projection';
    if (/pendient|por cobrar|sin pagar|no pagad|debo cobrar|falta cobrar/.test(x)) return 'pending';
    if (/ingres|dinero|gane|cuanto.*cobre|cuanto.*recibi|cuanto.*me.*pagaron|recaudad|cobrad|efectiv/.test(x)) return 'real_income';
    if (/mana/.test(x)) return 'tomorrow';
    if (/hoy/.test(x)) return 'today';
    if (/semana pasada/.test(x)) return 'previous_week';
    if (/esta semana|semana/.test(x)) return 'week';
    if (/mes pasado/.test(x)) return 'previous_month';
    if (/este mes|mes/.test(x)) return 'month';
    if (/cancelad|anulad/.test(x)) return 'cancelled';
    if (/a que hora|hora.*cita|cita.*hora/.test(x)) return 'patient_time';
    if (/quien|pacientes|nombres/.test(x)) return 'people';
    if (/cuantas|cantidad|numero|total.*cita|sesiones/.test(x)) return 'count';
    return 'help';
  }

  async function classifyWithGemini(question) {
    const key = localStorage.getItem(KEY_NAME);
    if (!key) return null;
    const prompt = `Clasifica esta pregunta administrativa en UNA categoría. No extraigas nombres ni datos personales. Categorías: today,tomorrow,week,previous_week,month,previous_month,cancelled,real_income,pending,projection,next,patient_time,people,count,availability,patient_history,new_patients,attendance,demand,profitability,range,help. Responde solo la categoría. Pregunta: ${question}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0,maxOutputTokens:10}})
    });
    if (!response.ok) throw new Error('Gemini respondió con HTTP ' + response.status);
    const data = await response.json();
    const text = (((data.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || '';
    const allowed = ['today','tomorrow','week','previous_week','month','previous_month','cancelled','real_income','pending','projection','next','patient_time','people','count','availability','patient_history','new_patients','attendance','demand','profitability','range','help'];
    return allowed.includes(text.trim().toLowerCase()) ? text.trim().toLowerCase() : null;
  }

  // Cuando la pregunta no calza en ninguna categoría fija, se envía a Gemini
  // un snapshot administrativo ANONIMIZADO (sin nombres, sin patientId) junto
  // con la pregunta real, para que Gemini calcule la respuesta él mismo sobre
  // datos reales en vez de limitarse a clasificar la pregunta.
  function buildAnonymizedSnapshot(data, today) {
    const windowStart = addDays(today, -185); // ~6 meses atrás
    const windowEnd = addDays(today, 95);      // ~3 meses adelante
    const appts = (data.appointments || [])
      .filter(a => a && a.date && a.date >= windowStart && a.date <= windowEnd)
      .map(a => ({
        date: a.date, time: a.time || '', status: a.status || 'pendiente',
        cost: Number(a.cost || 0), currency: a.currency === 'USD' ? 'USD' : 'PEN',
        paymentStatus: a.paymentStatus || 'pendiente', modality: a.modality || ''
      }));
    const patientCounts = { total: (data.patients || []).length };
    return { appts, patientCounts, windowStart, windowEnd };
  }

  async function answerWithGeminiData(question, data, today) {
    const key = localStorage.getItem(KEY_NAME);
    if (!key) return null;
    const snap = buildAnonymizedSnapshot(data, today);
    const prompt = `Eres el asistente administrativo de un consultorio de psicología en Perú. Responde SOLO con JSON válido, sin markdown ni backticks, con este formato exacto:
{"titulo":"...", "total":"...", "detalle":"..."}
Reglas:
- "titulo": encabezado corto de 3-6 palabras con un emoji relevante al inicio.
- "total": el número o cifra principal que responde la pregunta (si es dinero, usa "S/" para PEN y "$" para USD; si hay ambas monedas, sepáralas con " + "). Si la pregunta no pide una cifra, deja "total" vacío.
- "detalle": explicación breve (máx. 2 frases) de cómo se calculó, en español, sin inventar datos que no estén en la lista de citas.
- Nunca inventes nombres de pacientes, diagnósticos, historias clínicas ni datos que no aparezcan aquí; si la pregunta pide algo así, dilo en "detalle" y deja "total" vacío.
- Los campos de cada cita son: date (YYYY-MM-DD), time (HH:MM), status (pendiente/confirmada/completada/atendida/cancelada/reprogramada), cost (número), currency (PEN o USD), paymentStatus (pagado/pendiente), modality (presencial/virtual).
- Las citas con status cancelada NO deben contarse como ingresos reales ni como ingresos proyectados, salvo que la pregunta pida explícitamente algo sobre cancelaciones.
- "Ingresos reales" = suma de cost donde paymentStatus es pagado. "Proyección/ingresos esperados" = suma de cost de citas futuras (date >= hoy) que no estén canceladas, sin importar si ya están pagadas.
- Hoy es ${today}. Solo tienes datos de citas entre ${snap.windowStart} y ${snap.windowEnd}; si la pregunta necesita fechas fuera de ese rango, dilo en "detalle".
- Total de pacientes registrados (sin nombres): ${snap.patientCounts.total}.
Lista de citas (JSON): ${JSON.stringify(snap.appts)}
Pregunta del usuario: ${question}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 400 } })
    });
    if (!response.ok) throw new Error('Gemini respondió con HTTP ' + response.status);
    const data2 = await response.json();
    let text = (((data2.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || '';
    text = text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { throw new Error('Respuesta de Gemini no fue JSON válido'); }
    if (!parsed || typeof parsed !== 'object') throw new Error('Respuesta de Gemini vacía');
    const titulo = escapeHtml(parsed.titulo || '🤖 Respuesta');
    const total = parsed.total ? `<div class="assistant-total">${escapeHtml(parsed.total)}</div>` : '';
    const detalle = parsed.detalle ? `<div class="mt-1">${escapeHtml(parsed.detalle)}</div>` : '';
    return `<div class="assistant-title">${titulo}</div>${total}${detalle}<div class="mt-2 text-xs text-slate-500">Calculado por IA sobre tus citas (sin nombres de pacientes ni datos clínicos).</div>`;
  }

  function getPeriod(question,today) {
    const x = normalizeQuestion(question);
    if (/semana pasada/.test(x)) return {range:getPreviousWeekRange(today),label:'de la semana pasada'};
    if (/mes pasado/.test(x)) return {range:getPreviousMonthRange(today),label:'del mes pasado'};
    if (/semana/.test(x)) return {range:getWeekRange(today),label:'de esta semana'};
    if (/hoy/.test(x)) return {range:[today,addDays(today,1)],label:'de hoy'};
    if (/mana/.test(x)) return {range:[addDays(today,1),addDays(today,2)],label:'de mañana'};
    if (/mes/.test(x)) return {range:getMonthRange(today),label:'de este mes'};
    return {range:getMonthRange(today),label:'de este mes'};
  }

  function periodList(all,start,end,activeOnly=true) {
    return all.filter(a => a && a.date && a.date >= start && a.date < end && (!activeOnly || isActiveAppointment(a)));
  }

  function renderAppointmentList(list, includeDate) {
    const sorted = list.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,80);
    if (!sorted.length) return '<div>No hay citas registradas para ese periodo.</div>';
    return '<ul class="assistant-list">' + sorted.map(a =>
      `<li>${includeDate ? formatDate(a.date)+' — ' : ''}<b>${escapeHtml(a.patientName)}</b> — ${escapeHtml(a.time || 'sin hora')}${a.status ? ` <span class="text-slate-400">(${escapeHtml(a.status)})</span>` : ''}</li>`
    ).join('') + '</ul>';
  }

  function answer(intent,question) {
    const data = getData();
    const all = Array.isArray(data.appointments) ? data.appointments : [];
    const patients = Array.isArray(data.patients) ? data.patients : [];
    const today = todayLima();
    const valid = all.filter(a=>a && a.date);

    if (intent === 'today' || intent === 'people' || intent === 'count') {
      const list = valid.filter(a=>a.date===today && isActiveAppointment(a));
      if (intent === 'people') {
        return `<div class="assistant-title">👥 Agenda de hoy</div><div class="assistant-total">${list.length} cita(s)</div>${renderAppointmentList(list,false)}`;
      }
      return `<div class="assistant-title">📅 Citas de hoy</div><div class="assistant-total">${list.length}</div>${renderAppointmentList(list,false)}`;
    }

    if (intent === 'tomorrow') {
      const date=addDays(today,1), list=valid.filter(a=>a.date===date && isActiveAppointment(a));
      return `<div class="assistant-title">🗓️ Citas de mañana</div><div class="assistant-total">${list.length}</div>${renderAppointmentList(list,false)}`;
    }

    if (intent === 'week' || intent === 'previous_week' || intent === 'month' || intent === 'previous_month') {
      const p = intent==='previous_week' ? getPreviousWeekRange(today) :
                intent==='previous_month' ? getPreviousMonthRange(today) :
                intent==='week' ? getWeekRange(today) : getMonthRange(today);
      const label = intent==='previous_week' ? 'esta semana pasada' :
                    intent==='previous_month' ? 'el mes pasado' :
                    intent==='week' ? 'esta semana' : 'este mes';
      const list=periodList(valid,p[0],p[1],true);
      return `<div class="assistant-title">📅 Citas ${label}</div><div class="assistant-total">${list.length}</div>${renderAppointmentList(list,true)}`;
    }

    if (intent === 'next') {
      const nowMs = Date.now();
      const upcoming=valid.filter(a=>isActiveAppointment(a) && (a.date>today || (a.date===today && String(a.time||'99:99') >= limaTime()))).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
      if (!upcoming.length) return '<div class="assistant-title">⏰ Próxima cita</div><div>No tienes citas futuras registradas.</div>';
      const a=upcoming[0];
      return `<div class="assistant-title">⏰ Próxima cita</div><div class="assistant-total">${formatDate(a.date)} · ${escapeHtml(a.time || 'sin hora')}</div><div><b>${escapeHtml(a.patientName)}</b> · ${a.modality==='virtual'?'💻 Virtual':'🏢 Presencial'}</div>`;
    }

    if (intent === 'availability') {
      const qn=normalizeQuestion(question);
      let targetDate=today;
      if (/mana/.test(qn)) targetDate=addDays(today,1);
      const isToday=targetDate===today;
      const now=limaTime();
      const afternoon=HORARIO_SLOTS.filter(t=>parseInt(t,10)>=16);
      const occupied=valid.filter(a=>a.date===targetDate && isActiveAppointment(a)).map(a=>String(a.time||'').slice(0,5));
      let free=afternoon.filter(t=>!occupied.includes(t));
      if (isToday) free=free.filter(t=>t>now);
      return `<div class="assistant-title">🟢 Espacios libres ${isToday?'esta tarde':`el ${formatDate(targetDate)}`}</div><div class="assistant-total">${free.length} espacio(s)</div>${free.length ? '<ul class="assistant-list">'+free.map(t=>`<li>🕐 <b>${t}</b> — disponible</li>`).join('')+'</ul>' : '<div>No encuentro huecos disponibles en los horarios de la tarde configurados (16:00–19:00).</div>'}<div class="mt-2 text-xs text-slate-500">Horario operativo considerado: ${HORARIO_SLOTS.join(', ')}.</div>`;
    }

    if (intent === 'patient_history') {
      const p=findPatient(question,patients,valid);
      if (!p) return '<div class="assistant-title">🔎 Paciente no identificado</div><div>Escribe el nombre o apellido del paciente. La búsqueda se realiza localmente.</div>';
      const appts=valid.filter(a=>String(a.patientId||'')===String(p.id) || normalizeQuestion(a.patientName)===normalizeQuestion(p.name))
        .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
      const upcoming=appts.filter(a=>isActiveAppointment(a) && (a.date>today || (a.date===today && String(a.time||'99:99')>=limaTime())));
      const qn=normalizeQuestion(question);
      const futureOnly=/proxima|pendiente|confirmad|dias.*cita/.test(qn);
      const list=futureOnly ? upcoming : appts;
      if (!list.length) return `<div class="assistant-title">👤 ${escapeHtml(p.name)}</div><div>No encuentro citas ${futureOnly?'próximas':'registradas'} para este paciente.</div>`;
      const last=appts.filter(a=>a.date<=today).slice(-1)[0];
      return `<div class="assistant-title">👤 ${escapeHtml(p.name)}</div><div class="text-slate-500">${appts.length} cita(s) registradas · ${upcoming.length} próxima(s)</div>${last ? `<div class="mt-2">Última cita registrada: <b>${formatDate(last.date)}</b> a las <b>${escapeHtml(last.time||'sin hora')}</b> (${escapeHtml(last.status||'pendiente')}).</div>` : ''}<details class="mt-2" open><summary class="cursor-pointer font-semibold">Ver citas</summary>${renderAppointmentList(list,true)}</details>`;
    }

    if (intent === 'patient_time') {
      const p=findPatient(question,patients,valid);
      const matches=p ? valid.filter(a=>(String(a.patientId||'')===String(p.id) || normalizeQuestion(a.patientName)===normalizeQuestion(p.name)) && isActiveAppointment(a)) :
        valid.filter(a=>normalizeQuestion(question).split(/\s+/).some(w=>w.length>2 && normalizeQuestion(a.patientName).includes(w)));
      if (!matches.length) return '<div class="assistant-title">🔎 No encontré una coincidencia</div><div>Prueba con el nombre del paciente.</div>';
      return `<div class="assistant-title">🕐 Horario encontrado</div>${renderAppointmentList(matches,true)}`;
    }

    if (intent === 'cancelled') {
      const list=valid.filter(isCancelled);
      return `<div class="assistant-title">❌ Citas canceladas</div><div class="assistant-total">${list.length}</div>${renderAppointmentList(list,true)}`;
    }

    if (intent === 'range') {
      const range=parseDateRange(question);
      if (!range) return '<div class="assistant-title">📅 Rango no reconocido</div><div>Usa, por ejemplo: “¿Cuánto ingresé del 01/09/2026 al 15/09/2026?”</div>';
      const list=valid.filter(a=>a.date>=range.start && a.date<=range.end && isActiveAppointment(a));
      const qn=normalizeQuestion(question);
      if (/proyec|esperad|estimad|previs|voy a (ganar|cobrar|recibir)|puedo (ganar|cobrar)/.test(qn)) {
        const projection=list.filter(a=>!isCompleted(a) && a.date>=today);
        return `<div class="assistant-title">📈 Proyección ${escapeHtml(range.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(projection))}</div><div>${projection.length} cita(s) futuras consideradas.</div>${renderAppointmentList(projection,true)}`;
      }
      if (/pendient|por cobrar|sin pagar|no pagad|falta cobrar/.test(qn)) {
        const pending=list.filter(isPendingPayment);
        return `<div class="assistant-title">⏳ Pendiente por cobrar ${escapeHtml(range.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(pending))}</div><div>${pending.length} cita(s) pendientes de pago.</div>${renderAppointmentList(pending,true)}`;
      }
      const paid=list.filter(isPaid);
      return `<div class="assistant-title">💰 Ingresos reales ${escapeHtml(range.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(paid))}</div><div>${paid.length} pago(s) registrados como pagados.</div>`;
    }

    if (intent === 'real_income' || intent === 'pending' || intent === 'projection') {
      const p=getPeriod(question,today);
      const list=periodList(valid,p.range[0],p.range[1],true);
      if (intent==='real_income') {
        const paid=list.filter(isPaid);
        return `<div class="assistant-title">💰 Ingresos reales ${p.label}</div><div class="assistant-total">${formatTotals(sumByCurrency(paid))}</div><div>${paid.length} pago(s) efectivamente registrados como pagados.</div>`;
      }
      if (intent==='pending') {
        const pending=list.filter(isPendingPayment);
        return `<div class="assistant-title">⏳ Pendiente por cobrar ${p.label}</div><div class="assistant-total">${formatTotals(sumByCurrency(pending))}</div><div>${pending.length} cita(s) con pago pendiente.</div>${renderAppointmentList(pending,true)}`;
      }
      const future=list.filter(a=>a.date>=today && !isCompleted(a));
      return `<div class="assistant-title">📈 Proyección de ingresos ${p.label}</div><div class="assistant-total">${formatTotals(sumByCurrency(future))}</div><div>${future.length} cita(s) pendientes/futuras consideradas.</div>`;
    }

    if (intent === 'new_patients') {
      const [thisStart,thisEnd]=getMonthRange(today);
      const [prevStart,prevEnd]=getPreviousMonthRange(today);
      function patientCreatedDate(p) {
        if (p.createdAt) return String(p.createdAt).slice(0,10);
        const ap=valid.filter(a=>String(a.patientId||'')===String(p.id) || normalizeQuestion(a.patientName)===normalizeQuestion(p.name)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
        return ap[0] ? ap[0].date : '';
      }
      const current=patients.filter(p=>{const d=patientCreatedDate(p); return d>=thisStart && d<thisEnd;});
      const previous=patients.filter(p=>{const d=patientCreatedDate(p); return d>=prevStart && d<prevEnd;});
      return `<div class="assistant-title">👥 Pacientes nuevos</div><div class="grid grid-cols-2 gap-2 mt-2"><div class="bg-indigo-50 rounded-xl p-3"><div class="text-xs text-slate-500">Este mes</div><div class="text-xl font-black text-indigo-700">${current.length}</div></div><div class="bg-slate-100 rounded-xl p-3"><div class="text-xs text-slate-500">Mes pasado</div><div class="text-xl font-black text-slate-700">${previous.length}</div></div></div><div class="mt-2 text-slate-500">${current.length-previous.length >= 0 ? 'Aumento' : 'Disminución'} de ${Math.abs(current.length-previous.length)} paciente(s) frente al mes pasado.</div>`;
    }

    if (intent === 'attendance') {
      const p=getPeriod(question,today);
      const list=valid.filter(a=>a.date>=p.range[0] && a.date<p.range[1]);
      const completed=list.filter(isCompleted).length;
      const cancelled=list.filter(isCancelled).length;
      const rescheduled=list.filter(isRescheduled).length;
      const denominator=completed+cancelled+rescheduled;
      const rate=denominator ? (completed/denominator*100).toFixed(1) : '0.0';
      return `<div class="assistant-title">📊 Asistencia ${p.label}</div><div class="assistant-total">${rate}%</div><div class="mt-2">Atendidas: <b>${completed}</b> · Canceladas: <b>${cancelled}</b> · Reprogramadas: <b>${rescheduled}</b></div><div class="mt-1 text-xs text-slate-500">El porcentaje usa como base las citas con estado atendida/completada, cancelada o reprogramada. Si una reprogramación no se registra con ese estado, no puede distinguirse automáticamente.</div>`;
    }

    if (intent === 'demand' || intent === 'profitability') {
      const [start,end]=getMonthRange(today);
      const list=valid.filter(a=>a.date>=start && a.date<end && isActiveAppointment(a));
      const byDay={}, byTime={};
      list.forEach(a=>{
        const d=new Date(a.date+'T12:00:00');
        const day=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][d.getDay()];
        byDay[day]=(byDay[day]||0)+1;
        const t=String(a.time||'sin hora').slice(0,5);
        byTime[t]=(byTime[t]||0)+1;
      });
      const topDay=Object.entries(byDay).sort((a,b)=>b[1]-a[1])[0];
      const topTime=Object.entries(byTime).sort((a,b)=>b[1]-a[1])[0];
      const byRevenue={};
      list.filter(isPaid).forEach(a=>{
        byRevenue[a.date]=(byRevenue[a.date]||0);
        byRevenue[a.date] += Number(a.cost||0);
      });
      const topRevenue=Object.entries(byRevenue).sort((a,b)=>b[1]-a[1])[0];
      if (intent==='profitability') {
        return `<div class="assistant-title">💰 Día más rentable del mes</div>${topRevenue ? `<div class="assistant-total">${formatTotals(sumByCurrency(list.filter(a=>a.date===topRevenue[0] && isPaid)))}</div><div>${formatDate(topRevenue[0])} — ingresos cobrados.</div>` : '<div>No hay pagos registrados como pagados este mes.</div>'}<div class="mt-3 text-slate-500">También puedo identificar el día con más citas si preguntas por demanda.</div>`;
      }
      return `<div class="assistant-title">📈 Mayor demanda del mes</div><div><b>Día:</b> ${topDay ? escapeHtml(topDay[0])+' ('+topDay[1]+' citas)' : 'sin datos'}</div><div><b>Horario:</b> ${topTime ? escapeHtml(topTime[0])+' ('+topTime[1]+' citas)' : 'sin datos'}</div>`;
    }

    if (intent === 'help') {
      const configured = !!localStorage.getItem(KEY_NAME);
      const extra = configured
        ? '<div class="mt-2 text-slate-500">No reconocí esta pregunta con mis categorías fijas y tampoco pude calcularla con IA en este momento. Intenta reformularla o usa una de estas:</div>'
        : '<div class="mt-2 text-slate-500">Configura tu API de Gemini (⚙️) para que también pueda responder preguntas libres (comparaciones, proyecciones personalizadas, etc.) además de estas:</div>';
      return `<div class="assistant-title">🤖 Asistente IA administrativo</div><div>Puedo consultar agenda, disponibilidad, pacientes, ingresos y estadísticas.</div><ul class="assistant-list"><li>“¿Cuáles son mis citas de hoy?”</li><li>“¿Qué pacientes tengo esta semana?”</li><li>“¿Tengo un espacio libre esta tarde?”</li><li>“¿A qué hora es mi próxima cita y con quién?”</li><li>“¿Qué días tiene cita María esta semana?”</li><li>“¿Cuál es el historial de citas de María?”</li><li>“¿Cuánto ingresé del 1 al 15 de septiembre?”</li><li>“¿Qué pacientes tienen pagos pendientes?”</li><li>“¿Cuál fue el día más rentable este mes?”</li><li>“¿Qué horario tiene mayor demanda?”</li><li>“¿Cuántos pacientes nuevos tengo este mes comparado con el anterior?”</li><li>“¿Cuál es mi porcentaje de asistencia y cancelaciones?”</li></ul>${extra}`;
    }

    return '<div class="assistant-title">ℹ️ Consulta no disponible</div><div>Prueba una de las preguntas sugeridas.</div>';
  }

  function limaTime() {
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
    const h=parts.find(p=>p.type==='hour')?.value || '00';
    const m=parts.find(p=>p.type==='minute')?.value || '00';
    return `${h}:${m}`;
  }

  function speakAnswer() {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setStatus('Este navegador no admite lectura por voz. Prueba Chrome o Edge.','error'); return false;
    }
    const text=lastAnswerText || (($('assistant-answer')||{}).innerText||'');
    if (!text.trim()) { setStatus('Primero realiza una consulta.','info'); return false; }
    try {
      const synth=window.speechSynthesis; synth.cancel();
      const utterance=new SpeechSynthesisUtterance(text.replace(/\s+/g,' ').trim());
      utterance.lang='es-PE'; utterance.rate=1; utterance.pitch=1; utterance.volume=1;
      utterance.onstart=()=>setStatus('🔊 Reproduciendo la respuesta por voz.','ok');
      utterance.onend=()=>setStatus('✅ Respuesta terminada.','ok');
      utterance.onerror=e=>setStatus('No se pudo reproducir la voz ('+(e.error||'error')+'). Toca “Leer respuesta” nuevamente.','error');
      synth.speak(utterance);
      setTimeout(()=>{try{if(synth.paused)synth.resume();}catch(_){}},120);
      return true;
    } catch(e) { setStatus('No se pudo iniciar la lectura por voz.','error'); return false; }
  }
  function stopAnswerVoice() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setStatus('🔇 Lectura por voz detenida.','info');
  }
  function toggleAutoVoice() {
    autoSpeak=!autoSpeak;
    const btn=$('assistant-auto-voice-btn');
    if(btn){btn.textContent=autoSpeak?'🔊 Voz automática: ON':'🔇 Voz automática: OFF';btn.classList.toggle('bg-emerald-50',autoSpeak);btn.classList.toggle('text-emerald-700',autoSpeak);}
    if(!autoSpeak) stopAnswerVoice();
  }
  let recognition=null, isListening=false;
  function toggleAssistantVoice() {
    voiceQueryActive=true;
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){setStatus('Tu navegador no admite dictado por voz. Usa Google Chrome o Microsoft Edge.','error');return;}
    if(isListening&&recognition){recognition.stop();return;}
    recognition=new SpeechRecognition();
    recognition.lang='es-PE'; recognition.continuous=false; recognition.interimResults=true; isListening=true; updateVoiceButton();
    setStatus('🎙️ Escuchando… habla ahora.','info');
    let finalText='';
    recognition.onresult=event=>{
      let interim='';
      for(let i=event.resultIndex;i<event.results.length;i++){const text=event.results[i][0].transcript;if(event.results[i].isFinal)finalText+=text;else interim+=text;}
      const input=$('assistant-question'); if(input)input.value=(finalText+interim).trim();
    };
    recognition.onend=()=>{
      isListening=false;updateVoiceButton();
      if(finalText.trim()){const input=$('assistant-question');if(input)input.value=finalText.trim();setTimeout(()=>askAssistant(),250);}
      else setStatus('No pude captar la pregunta. Inténtalo nuevamente.','info');
    };
    recognition.onerror=event=>{isListening=false;updateVoiceButton();setStatus(event.error==='not-allowed'?'Debes permitir el acceso al micrófono en el navegador.':'No se pudo usar el micrófono: '+event.error,'error');};
    recognition.start();
  }
  function updateVoiceButton() {
    const btn=$('assistant-voice-btn');if(!btn)return;
    btn.textContent=isListening?'⏹️':'🎙️';btn.title=isListening?'Detener dictado':'Hablar';btn.setAttribute('aria-label',isListening?'Detener dictado':'Hablar');
    btn.classList.toggle('bg-rose-100',isListening);btn.classList.toggle('text-rose-700',isListening);
  }
  async function askAssistant() {
    const input=$('assistant-question'), question=input?input.value.trim():'';
    if(!question){setStatus('Escribe una pregunta primero.','error');return;}
    const btn=$('assistant-send-btn');if(btn){btn.disabled=true;btn.textContent='…';}
    setStatus('Consultando…','info');
    try {
      const data=getData();
      const patientSpecific=questionLooksPatientSpecific(question,data);
      let intent=parseDateRange(question)?'range':localIntent(question);
      // Nunca mandar a Gemini una pregunta que contenga o pueda identificar un paciente.
      if(!patientSpecific) {
        try {
          const aiIntent=await classifyWithGemini(question);
          if(aiIntent && !parseDateRange(question)) intent=aiIntent;
        } catch(e){console.warn('[Asistente] Gemini no disponible; usando interpretación local.',e);}
      }
      let answerHtml=answer(intent,question);
      let usedGeminiData=false;
      // Si ninguna categoría fija reconoció la pregunta, y no identifica a un
      // paciente, se intenta calcular la respuesta con Gemini sobre datos
      // administrativos anonimizados en vez de mostrar "consulta no disponible".
      if (intent === 'help' && !patientSpecific && localStorage.getItem(KEY_NAME)) {
        try {
          const today=todayLima();
          const aiAnswer=await answerWithGeminiData(question,data,today);
          if (aiAnswer) { answerHtml=aiAnswer; usedGeminiData=true; }
        } catch(e){ console.warn('[Asistente] No se pudo calcular con Gemini sobre datos; se muestra ayuda local.',e); }
      }
      setAnswer(answerHtml);
      const answerEl=$('assistant-answer');lastAnswerText=answerEl?answerEl.innerText:'';
      setStatus(patientSpecific?'Consulta procesada localmente para proteger datos del paciente.':(usedGeminiData?'Consulta calculada con IA sobre datos administrativos anonimizados (sin nombres).':'Consulta procesada. Los datos de agenda se procesan localmente.'),'ok');
      const wasVoiceQuery=voiceQueryActive;
      if(autoSpeak)setTimeout(()=>speakAnswer(),80);
      if(wasVoiceQuery)setStatus('✅ Consulta por voz procesada. Reproduciendo respuesta… si el navegador la bloquea, toca “Leer respuesta”.','ok');
      voiceQueryActive=false;
    } catch(e){console.error(e);setStatus('No se pudo procesar la consulta: '+e.message,'error');}
    finally{if(btn){btn.disabled=false;btn.textContent='➤';}}
  }
  function askAssistantExample(text){const input=$('assistant-question');if(input)input.value=text;askAssistant();}
  console.info('[Asistente IA] versión',APP_VERSION);
  window.openAssistantModal=openAssistantModal;
  window.closeAssistantModal=closeAssistantModal;
  window.openGeminiConfig=openGeminiConfig;
  window.saveGeminiKey=saveGeminiKey;
  window.clearGeminiKey=clearGeminiKey;
  window.askAssistant=askAssistant;
  window.toggleAssistantVoice=toggleAssistantVoice;
  window.askAssistantExample=askAssistantExample;
  window.speakAnswer=speakAnswer;
  window.stopAnswerVoice=stopAnswerVoice;
  window.toggleAutoVoice=toggleAutoVoice;
  window.addEventListener('DOMContentLoaded',updateConfigState);
})();
