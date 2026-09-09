/* Asistente IA administrativo - Agenda Psicología Pro+
   Gemini recibe SOLO la pregunta del usuario para clasificar la intención.
   Los datos administrativos se procesan localmente en el navegador.
   Nunca se envían historias, notas, diagnósticos ni motivos de consulta.
*/
(function () {
  'use strict';

  const KEY_NAME = 'agenda_pro_gemini_api_key';
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
    if (parseDateRange(q)) return 'range';

    // Finanzas: se distinguen ingresos realmente cobrados, pendientes y proyección.
    if (/proyecc|proyectad|esperad|estimad|cuanto.*voy.*ingres|cuanto.*ingres.*futuro/.test(x)) return 'projection';
    if (/pendient|por cobrar|sin pagar|no pagad|debo cobrar|falta cobrar/.test(x)) return 'pending';
    if (/ingres.*real|ingreso real|recaudad|cobrad|cobrado|efectiv|cuanto.*cobre|cuanto.*recibi|cuanto.*me.*pagaron/.test(x)) return 'real_income';
    if (/ingres|dinero|gane|gan(e|é|e)|pago/.test(x)) return 'real_income';

    if (/mana/.test(x)) return 'tomorrow';
    if (/hoy/.test(x)) return 'today';
    if (/esta semana|semana/.test(x)) return 'week';
    if (/este mes|mes/.test(x)) return 'month';
    if (/cancelad|anulad/.test(x)) return 'cancelled';
    if (/a que hora|hora.*cita|cita.*hora/.test(x)) return 'patient_time';
    if (/quien|pacientes|tienen cita/.test(x)) return 'people';
    if (/cuantas|cantidad|numero|numero de|total.*cita|citas/.test(x)) return 'count';
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

  async function classifyWithGemini(question) {
    const key = localStorage.getItem(KEY_NAME);
    if (!key) return null;
    const prompt = `Clasifica esta pregunta administrativa de una agenda de psicología en UNA sola categoría. NO solicites ni devuelvas datos de pacientes. Categorías permitidas: today, tomorrow, week, month, cancelled, real_income, pending, projection, patient_time, people, count, range, help. Responde únicamente con la categoría. Pregunta: ${question}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 10 } })
    });
    if (!response.ok) throw new Error('Gemini respondió con HTTP ' + response.status);
    const data = await response.json();
    const text = (((data.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || '';
    const allowed = ['today','tomorrow','week','month','cancelled','real_income','pending','projection','patient_time','people','count','range','help'];
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
    } else if (intent === 'tomorrow') {
      const date = addDays(today, 1);
      list = list.filter(a => a.date === date && isActiveAppointment(a));
      title = 'Citas de mañana';
    } else if (intent === 'week') {
      const [start, end] = getWeekRange(today);
      list = list.filter(a => a.date >= start && a.date < end && isActiveAppointment(a));
      title = 'Citas de esta semana';
    } else if (intent === 'month') {
      const [start, end] = getMonthRange(today);
      list = list.filter(a => a.date >= start && a.date < end && isActiveAppointment(a));
      title = 'Citas de este mes';
    } else if (intent === 'range') {
      const range = parseDateRange(question);
      if (!range) return '<div class="assistant-title">📅 Rango no reconocido</div><div>Usa, por ejemplo: “¿Cuánto ingresé del 01/09/2026 al 10/09/2026?”</div>';
      list = list.filter(a => a.date >= range.start && a.date <= range.end && isActiveAppointment(a));
      title = `Periodo ${range.label}`;
      const qn = normalizeQuestion(question);
      if (/proyecc|proyectad|esperad|estimad/.test(qn)) {
        const future = list.filter(a => a.date >= today);
        return `<div class="assistant-title">📈 Proyección ${escapeHtml(range.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(future))}</div><div class="mt-1 text-slate-500">${future.length} cita(s) futuras/no canceladas.</div>`;
      }
      if (/pendient|por cobrar|sin pagar|no pagad|falta cobrar/.test(qn)) {
        const pending = list.filter(isPendingPayment);
        return `<div class="assistant-title">⏳ Pendiente ${escapeHtml(range.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(pending))}</div><div class="mt-1 text-slate-500">${pending.length} cita(s) pendientes de pago.</div>`;
      }
      const paid = list.filter(isPaid);
      return `<div class="assistant-title">💰 Ingresos reales ${escapeHtml(range.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(paid))}</div><div class="mt-1 text-slate-500">${paid.length} pago(s) registrado(s) como pagado.</div>`;
    } else if (intent === 'real_income' || intent === 'pending' || intent === 'projection') {
      let [start, end] = getMonthRange(today);
      title = 'este mes';
      if (/semana/.test(normalizeQuestion(question))) {
        [start, end] = getWeekRange(today);
        title = 'esta semana';
      } else if (/hoy/.test(normalizeQuestion(question))) {
        start = today; end = addDays(today, 1); title = 'de hoy';
      } else if (/mana/.test(normalizeQuestion(question))) {
        start = addDays(today, 1); end = addDays(today, 2); title = 'de mañana';
      }
      list = list.filter(a => a.date >= start && a.date < end && isActiveAppointment(a));

      if (intent === 'real_income') {
        const paid = list.filter(isPaid);
        return `<div class="assistant-title">💰 Ingresos reales ${title}</div><div class="assistant-total">${formatTotals(sumByCurrency(paid))}</div><div class="mt-1 text-slate-500">${paid.length} pago(s) efectivamente registrado(s).</div>`;
      }
      if (intent === 'pending') {
        const pending = list.filter(isPendingPayment);
        return `<div class="assistant-title">⏳ Pendiente por cobrar ${title}</div><div class="assistant-total">${formatTotals(sumByCurrency(pending))}</div><div class="mt-1 text-slate-500">${pending.length} cita(s) con pago pendiente.</div>`;
      }
      const future = list.filter(a => a.date >= today);
      return `<div class="assistant-title">📈 Proyección de ingresos ${title}</div><div class="assistant-total">${formatTotals(sumByCurrency(future))}</div><div class="mt-1 text-slate-500">${future.length} cita(s) futuras/no canceladas consideradas.</div>`;
    } else if (intent === 'patient_time') {
      const words = normalizeQuestion(question).split(/\s+/).filter(w => w.length > 2 && !['quien','tiene','cita','hora','que','a','para','el','la','de'].includes(w));
      const matches = words.length ? list.filter(a => words.some(w => normalizeQuestion(a.patientName).includes(w))) : [];
      if (!matches.length) return '<div class="assistant-title">🔎 No encontré una coincidencia.</div><div>Prueba con el nombre del paciente, por ejemplo: “¿A qué hora tiene cita María?”</div>';
      return '<div class="assistant-title">🕐 Horario encontrado</div><ul class="assistant-list">' + matches.slice(0, 10).map(a => `<li><b>${escapeHtml(a.patientName)}</b>: ${escapeHtml(a.time || 'sin hora')} — ${formatDate(a.date)}</li>`).join('') + '</ul>';
    } else if (intent === 'cancelled') {
      list = all.filter(a => a && a.date && String(a.status || '').toLowerCase() === 'cancelada');
      return `<div class="assistant-title">❌ Citas canceladas</div><div class="assistant-total">${list.length}</div>${list.length ? '<ul class="assistant-list">' + list.slice(0, 20).map(a => `<li>${formatDate(a.date)} ${escapeHtml(a.time || '')} — ${escapeHtml(a.patientName)}</li>`).join('') + '</ul>' : '<div>No hay citas canceladas registradas.</div>'}`;
    } else if (intent === 'help') {
      return '<div class="assistant-title">🤖 Puedo ayudarte con la agenda</div><div>Ejemplos: “¿Cuántas citas tengo esta semana?”, “¿Cuánto ingresé realmente este mes?”, “¿Cuánto tengo pendiente por cobrar?”, “¿Cuál es mi proyección de ingresos este mes?” o “¿Cuánto ingresé del 01/09/2026 al 09/09/2026?”.</div>';
    }

    if (intent === 'people') {
      return `<div class="assistant-title">👥 ${title}</div><div class="assistant-total">${list.length} cita(s)</div>${list.length ? '<ul class="assistant-list">' + list.slice().sort((a,b) => String(a.time).localeCompare(String(b.time))).map(a => `<li><b>${escapeHtml(a.patientName)}</b> — ${escapeHtml(a.time || 'sin hora')}</li>`).join('') + '</ul>' : '<div>No hay citas registradas.</div>'}`;
    }

    return `<div class="assistant-title">📅 ${title}</div><div class="assistant-total">${list.length}</div>${list.length ? '<ul class="assistant-list">' + list.slice().sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).slice(0, 30).map(a => `<li><b>${escapeHtml(a.patientName)}</b> — ${formatDate(a.date)} ${escapeHtml(a.time || '')}</li>`).join('') + '</ul>' : '<div>No hay citas registradas para ese periodo.</div>'}`;
  }

  function speakAnswer() {
    if (!('speechSynthesis' in window)) {
      setStatus('Tu navegador no admite lectura por voz.', 'error');
      return;
    }
    window.speechSynthesis.cancel();
    const text = lastAnswerText || (($('assistant-answer') || {}).innerText || '');
    if (!text.trim()) {
      setStatus('Primero realiza una consulta.', 'info');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').trim());
    utterance.lang = 'es-PE';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
    setStatus('🔊 Reproduciendo la respuesta por voz.', 'ok');
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
      let intent = localIntent(question);
      try {
        const aiIntent = await classifyWithGemini(question);
        if (aiIntent) intent = aiIntent;
      } catch (e) {
        console.warn('[Asistente] Gemini no disponible; usando interpretación local.', e);
      }
      const answerHtml = answer(intent, question);
      setAnswer(answerHtml);
      const answerEl = $('assistant-answer');
      lastAnswerText = answerEl ? answerEl.innerText : '';
      setStatus('Consulta procesada localmente. Gemini solo interpretó la pregunta.', 'ok');
      if (autoSpeak || voiceQueryActive) setTimeout(() => speakAnswer(), 120);
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
