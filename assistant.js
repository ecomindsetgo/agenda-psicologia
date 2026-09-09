/* Asistente IA administrativo - Agenda Psicología Pro+
   Gemini recibe SOLO la pregunta del usuario para clasificar la intención.
   Los datos administrativos se procesan localmente en el navegador.
   Nunca se envían historias, notas, diagnósticos ni motivos de consulta.
*/
(function () {
  'use strict';

  const KEY_NAME = 'agenda_pro_gemini_api_key';
  const MODEL = 'gemini-2.0-flash';

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

  function money(amount, currency) {
    const n = Number(amount || 0).toFixed(2);
    return currency === 'USD' ? '$' + n : 'S/ ' + n;
  }

  function normalizeQuestion(q) {
    return q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function localIntent(q) {
    const x = normalizeQuestion(q);
    if (/manana/.test(x)) return 'tomorrow';
    if (/hoy/.test(x)) return 'today';
    if (/esta semana|semana/.test(x)) return 'week';
    if (/este mes|mes/.test(x)) return 'month';
    if (/cancelad|anulad/.test(x)) return 'cancelled';
    if (/ingres|cobrad|recaud|dinero|gan(e|é|e)|pago/.test(x)) return 'income';
    if (/a que hora|hora.*cita|cita.*hora/.test(x)) return 'patient_time';
    if (/quien|pacientes|tienen cita/.test(x)) return 'people';
    if (/cuantas|cantidad|numero|numero de|total.*cita|citas/.test(x)) return 'count';
    return 'help';
  }

  async function classifyWithGemini(question) {
    const key = localStorage.getItem(KEY_NAME);
    if (!key) return null;
    const prompt = `Clasifica esta pregunta administrativa de una agenda de psicología en UNA sola categoría. NO solicites ni devuelvas datos de pacientes. Categorías permitidas: today, tomorrow, week, month, cancelled, income, patient_time, people, count, help. Responde únicamente con la categoría. Pregunta: ${question}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 10 } })
    });
    if (!response.ok) throw new Error('Gemini respondió con HTTP ' + response.status);
    const data = await response.json();
    const text = (((data.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || '';
    const allowed = ['today','tomorrow','week','month','cancelled','income','patient_time','people','count','help'];
    return allowed.includes(text.trim().toLowerCase()) ? text.trim().toLowerCase() : null;
  }

  function answer(intent, question) {
    const data = getData();
    const all = Array.isArray(data.appointments) ? data.appointments : [];
    const today = todayLima();
    let list = all.filter(a => a && a.date);
    let title = '';

    if (intent === 'today' || intent === 'people' || intent === 'count') {
      list = list.filter(a => a.date === today && isActiveAppointment(a));
      title = 'Citas de hoy';
    } else if (intent === 'tomorrow') {
      const date = addDays(today, 1);
      list = list.filter(a => a.date === date && isActiveAppointment(a));
      title = 'Citas de mañana';
    } else if (intent === 'week') {
      const [start, end] = getWeekRange(today);
      list = list.filter(a => a.date >= start && a.date < end && isActiveAppointment(a));
      title = 'Citas de esta semana';
    } else if (intent === 'month' || intent === 'income') {
      const [start, end] = getMonthRange(today);
      list = list.filter(a => a.date >= start && a.date < end && isActiveAppointment(a));
      title = 'Citas de este mes';
    } else if (intent === 'cancelled') {
      list = list.filter(a => /cancel|anulad/i.test(String(a.status || '')));
      title = 'Citas canceladas';
    } else if (intent === 'patient_time') {
      const words = normalizeQuestion(question).split(/\s+/).filter(w => w.length > 2 && !['quien','tiene','cita','hora','que','a','para','el','la','de'].includes(w));
      const matches = words.length ? list.filter(a => words.some(w => normalizeQuestion(a.patientName).includes(w))) : [];
      if (!matches.length) return '<div class="assistant-title">🔎 No encontré una coincidencia.</div><div>Prueba con el nombre del paciente, por ejemplo: “¿A qué hora tiene cita María?”</div>';
      return '<div class="assistant-title">🕐 Horario encontrado</div><ul class="assistant-list">' + matches.slice(0, 10).map(a => `<li><b>${escapeHtml(a.patientName)}</b>: ${escapeHtml(a.time || 'sin hora')} — ${formatDate(a.date)}</li>`).join('') + '</ul>';
    } else if (intent === 'help') {
      return '<div class="assistant-title">🤖 Puedo ayudarte con la agenda</div><div>Prueba: “¿Cuántas citas tengo hoy?”, “¿Quiénes tienen cita mañana?”, “¿Cuánto ingresé este mes?” o “¿Cuántas citas canceladas tuve?”</div>';
    }

    if (intent === 'income') {
      const byCurrency = {};
      list.forEach(a => { const c = a.currency === 'USD' ? 'USD' : 'PEN'; byCurrency[c] = (byCurrency[c] || 0) + Number(a.cost || 0); });
      const parts = Object.keys(byCurrency).map(c => money(byCurrency[c], c));
      return `<div class="assistant-title">💰 ${title}</div><div class="assistant-total">${parts.length ? parts.join(' + ') : 'S/ 0.00'}</div><div class="mt-1 text-slate-500">Basado en las citas no canceladas del periodo.</div>`;
    }

    if (intent === 'cancelled') {
      return `<div class="assistant-title">❌ ${title}</div><div class="assistant-total">${list.length}</div>${list.length ? '<ul class="assistant-list">' + list.slice(0, 20).map(a => `<li>${formatDate(a.date)} ${escapeHtml(a.time || '')} — ${escapeHtml(a.patientName)}</li>`).join('') + '</ul>' : '<div>No hay citas canceladas registradas.</div>'}`;
    }

    if (intent === 'people') {
      return `<div class="assistant-title">👥 ${title}</div><div class="assistant-total">${list.length} cita(s)</div>${list.length ? '<ul class="assistant-list">' + list.slice().sort((a,b) => String(a.time).localeCompare(String(b.time))).map(a => `<li><b>${escapeHtml(a.patientName)}</b> — ${escapeHtml(a.time || 'sin hora')}</li>`).join('') + '</ul>' : '<div>No hay citas registradas.</div>'}`;
    }

    return `<div class="assistant-title">📅 ${title}</div><div class="assistant-total">${list.length}</div>${list.length ? '<ul class="assistant-list">' + list.slice().sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).slice(0, 30).map(a => `<li><b>${escapeHtml(a.patientName)}</b> — ${formatDate(a.date)} ${escapeHtml(a.time || '')}</li>`).join('') + '</ul>' : '<div>No hay citas registradas para ese periodo.</div>'}`;
  }

  async function askAssistant() {
    const input = $('assistant-question');
    const question = input ? input.value.trim() : '';
    if (!question) { setStatus('Escribe una pregunta primero.', 'error'); return; }
    const btn = $('assistant-send-btn');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    setStatus('Consultando…', 'info');
    try {
      let intent = localIntent(question);
      try {
        const aiIntent = await classifyWithGemini(question);
        if (aiIntent) intent = aiIntent;
      } catch (e) {
        console.warn('[Asistente] Gemini no disponible; usando interpretación local.', e);
      }
      setAnswer(answer(intent, question));
      setStatus('Consulta procesada localmente. Gemini solo interpretó la pregunta.', 'ok');
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

  window.openAssistantModal = openAssistantModal;
  window.closeAssistantModal = closeAssistantModal;
  window.openGeminiConfig = openGeminiConfig;
  window.saveGeminiKey = saveGeminiKey;
  window.clearGeminiKey = clearGeminiKey;
  window.askAssistant = askAssistant;
  window.askAssistantExample = askAssistantExample;
  window.addEventListener('DOMContentLoaded', updateConfigState);
})();
