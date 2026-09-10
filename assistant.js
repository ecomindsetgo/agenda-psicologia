/* Asistente Personal - Agenda Psicología Pro+
   Modo administrativo:
   - Los datos de citas se procesan SOLO en el navegador.
   - Gemini, si está configurado, recibe únicamente la pregunta para ayudar a clasificarla.
   - Nunca se envían historias clínicas, notas, diagnósticos, motivos de consulta ni tratamientos.
*/
(function () {
  'use strict';

  const KEY_NAME = 'agenda_pro_gemini_api_key';
  const APP_VERSION = '2026.09.10.10';
  const MODEL = 'gemini-2.0-flash';
  let lastAnswerText = '';
  let voiceQueryActive = false;
  let autoSpeak = true;
  let recognition = null;
  let isListening = false;

  function $(id){ return document.getElementById(id); }
  function normalizeQuestion(q){
    return String(q||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  function escapeHtml(v){
    return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function todayLima(){
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }
  function limaNowTime(){
    return new Intl.DateTimeFormat('en-GB',{timeZone:'America/Lima',hour12:false,hour:'2-digit',minute:'2-digit'}).format(new Date());
  }
  function addDays(dateStr,days){
    const d=new Date(dateStr+'T12:00:00'); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10);
  }
  function formatDate(dateStr){
    if(!dateStr) return '';
    return new Date(dateStr+'T12:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'});
  }
  function formatTime12(time){
    if(!time) return 'sin hora';
    const p=String(time).split(':'), h=parseInt(p[0],10), m=parseInt(p[1],10)||0;
    if(Number.isNaN(h)) return String(time);
    return new Intl.DateTimeFormat('es-PE',{hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(2000,0,1,h,m));
  }
  function money(amount,currency){ return (currency==='USD'?'$':'S/ ')+Number(amount||0).toFixed(2); }
  function isCancelled(a){ return /(cancel|anulad|no asist|no_show)/.test(String(a.status||'').toLowerCase()); }
  function isActiveAppointment(a){ return !!a && !isCancelled(a); }
  function isPaid(a){ return String(a.paymentStatus||'').toLowerCase()==='pagado'; }
  function isPendingPayment(a){ return String(a.paymentStatus||'').toLowerCase()==='pendiente'; }
  function isPendingAttention(a){ return String(a.status||'').toLowerCase()==='pendiente'; }
  function getData(){
    try { return typeof window.getAgendaAdminSnapshot==='function' ? window.getAgendaAdminSnapshot() : {appointments:[]}; }
    catch(e){ console.error(e); return {appointments:[]}; }
  }
  function allAppointments(){
    const a=getData().appointments;
    return Array.isArray(a)?a.filter(x=>x&&x.date):[];
  }
  function getMonthRange(ds){
    const start=ds.slice(0,7)+'-01', d=new Date(start+'T12:00:00'); d.setMonth(d.getMonth()+1);
    return [start,d.toISOString().slice(0,10)];
  }
  function getWeekRange(ds){
    const d=new Date(ds+'T12:00:00'), day=d.getDay(), off=day===0?-6:1-day;
    d.setDate(d.getDate()+off); const s=d.toISOString().slice(0,10); return [s,addDays(s,7)];
  }
  function getPrevWeekRange(ds){ const s=getWeekRange(ds)[0]; return [addDays(s,-7),s]; }
  function getPrevMonthRange(ds){ return getMonthRange(addDays(getMonthRange(ds)[0],-1)); }

  function parseDateOnly(v,defaultYear){
    const x=normalizeQuestion(v).trim(); let m=x.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    m=x.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    const months={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
    m=x.match(/(\d{1,2})\s+de\s+([a-z]+)/);
    if(m&&months[m[2]]) return `${defaultYear||new Date().getFullYear()}-${String(months[m[2]]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    return null;
  }
  function parseDateRange(q){
    const x=normalizeQuestion(q), explicit=x.match(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{4}\b/g);
    if(explicit&&explicit.length>=2){
      const s=parseDateOnly(explicit[0]),e=parseDateOnly(explicit[1]);
      if(s&&e) return {start:s,end:e,label:`del ${formatDate(s)} al ${formatDate(e)}`};
    }
    const months='enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
    let m=x.match(new RegExp('del\\s+(?:el\\s+)?(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+('+months+')(?:\\s+de\\s+(\\d{4}))?'));
    if(m){
      const y=Number(m[4]||new Date().getFullYear()),s=parseDateOnly(`${m[1]} de ${m[3]}`,y),e=parseDateOnly(`${m[2]} de ${m[3]}`,y);
      if(s&&e) return {start:s,end:e,label:`del ${formatDate(s)} al ${formatDate(e)}`};
    }
    m=x.match(new RegExp('(?:del|desde)\\s+(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?('+months+')\\s+(?:de\\s+)?(\\d{4})?\\s+(?:al|hasta)\\s+(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?('+months+')(?:\\s+(?:de\\s+)?(\\d{4}))?'));
    if(m){
      const y=Number(m[3]||m[6]||new Date().getFullYear()),s=parseDateOnly(`${m[1]} de ${m[2]}`,y),e=parseDateOnly(`${m[4]} de ${m[5]}`,Number(m[6]||y));
      if(s&&e) return {start:s,end:e,label:`del ${formatDate(s)} al ${formatDate(e)}`};
    }
    return null;
  }
  function resolveScope(q,def){
    const x=normalizeQuestion(q),t=todayLima();
    if(/\bayer\b/.test(x)){const d=addDays(t,-1);return{start:d,end:addDays(d,1),label:'de ayer'};}
    if(/\bmanana\b/.test(x)){const d=addDays(t,1);return{start:d,end:addDays(d,1),label:'de mañana'};}
    if(/\bhoy\b/.test(x))return{start:t,end:addDays(t,1),label:'de hoy'};
    if(/semana pasada|semana anterior/.test(x)){const r=getPrevWeekRange(t);return{start:r[0],end:r[1],label:'de la semana pasada'};}
    if(/esta semana|esta semana/.test(x)||(/\bsemana\b/.test(x)&&!(/proxima/.test(x)))){const r=getWeekRange(t);return{start:r[0],end:r[1],label:'de esta semana'};}
    if(/mes pasado|mes anterior/.test(x)){const r=getPrevMonthRange(t);return{start:r[0],end:r[1],label:'del mes pasado'};}
    if(/\bmes\b|este mes/.test(x)){const r=getMonthRange(t);return{start:r[0],end:r[1],label:'de este mes'};}
    if(def==='today')return{start:t,end:addDays(t,1),label:'de hoy'};
    if(def==='week'){const r=getWeekRange(t);return{start:r[0],end:r[1],label:'de esta semana'};}
    const r=getMonthRange(t);return{start:r[0],end:r[1],label:'de este mes'};
  }
  function rangeList(q,def){
    const r=parseDateRange(q); if(r) return r;
    return resolveScope(q,def);
  }
  function sumByCurrency(items){
    const o={}; (items||[]).forEach(a=>{const c=a.currency==='USD'?'USD':'PEN';o[c]=(o[c]||0)+Number(a.cost||0);}); return o;
  }
  function formatTotals(o){const k=Object.keys(o||{});return k.length?k.map(c=>money(o[c],c)).join(' + '):'S/ 0.00';}

  function apptListHtml(list,opts){
    opts=opts||{}; const sorted=(list||[]).slice().sort((a,b)=>String(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
    if(!sorted.length)return `<div class="assistant-title">${opts.emoji||'📅'} ${escapeHtml(opts.title||'')}</div><div>${escapeHtml(opts.emptyMsg||'No hay citas registradas para ese periodo.')}</div>`;
    const dates=[...new Set(sorted.map(a=>a.date))], same=dates.length===1, shown=sorted.slice(0,opts.limit||40);
    const title=same?`${opts.title||''} ${formatDate(dates[0])}`:opts.title||'Citas';
    const items=shown.map(a=>same?`<li><b>${escapeHtml(a.patientName)}</b> — ${escapeHtml(formatTime12(a.time))}${isPaid(a)?' · <span class="text-emerald-700">pagado</span>':isPendingPayment(a)?' · <span class="text-amber-700">pago pendiente</span>':''}</li>`:`<li><b>${escapeHtml(a.patientName)}</b> — ${formatDate(a.date)}, ${escapeHtml(formatTime12(a.time))}${isPaid(a)?' · <span class="text-emerald-700">pagado</span>':isPendingPayment(a)?' · <span class="text-amber-700">pago pendiente</span>':''}</li>`).join('');
    return `<div class="assistant-title">${opts.emoji||'📅'} ${escapeHtml(title)}</div><div class="assistant-total">${sorted.length} cita(s)</div><ul class="assistant-list">${items}</ul>${sorted.length>shown.length?`<div class="text-xs text-slate-500 mt-2">Mostrando ${shown.length} de ${sorted.length}.</div>`:''}`;
  }
  function pendingDetailHtml(list){
    const s=(list||[]).slice().sort((a,b)=>String(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))).slice(0,40);
    return s.length?`<ul class="assistant-list mt-2">${s.map(a=>`<li>${formatDate(a.date)} ${formatTime12(a.time)} — <b>${escapeHtml(a.patientName)}</b>: ${money(a.cost,a.currency)}</li>`).join('')}</ul>`:'';
  }
  function activeInRange(all,r){return all.filter(a=>a.date>=r.start&&a.date<=r.end&&isActiveAppointment(a));}

  // Grilla del calendario actual. Se usa solo para calcular espacios libres.
  const SLOT_TIMES=['10:00','11:00','12:00','16:00','17:00','18:00','19:00'];
  const AFTERNOON=['16:00','17:00','18:00','19:00'];
  function daySlots(d){const dow=new Date(d+'T12:00:00').getDay();if(dow===0)return[];if(dow===6)return SLOT_TIMES.filter(x=>!AFTERNOON.includes(x));return SLOT_TIMES.slice();}

  function extractName(q){
    const raw=String(q||'').replace(/[¿?¡!.,;:]/g,' ').trim();
    let s=raw.replace(/\b(a que hora|a que hora|que hora|cuando|cual es|cual|quien es|quien|dime|dame|para|tiene|tendria|hay|la|el|una|un|cita|proxima|siguiente|turno|paciente|hoy|manana|mañana|esta semana|este mes|por|de|del|en|a)\b/gi,' ');
    s=s.replace(/\b(la|el|una|un|cita|turno|paciente|hora)\b/gi,' ').replace(/\s+/g,' ').trim();
    return s;
  }
  function findPatientMatches(q,list){
    const name=normalizeQuestion(extractName(q));
    if(!name)return[];
    const words=name.split(/\s+/).filter(w=>w.length>=2);
    return list.filter(a=>{const pn=normalizeQuestion(a.patientName);return words.every(w=>pn.includes(w))||words.some(w=>pn.includes(w));});
  }

  function localIntent(q){
    const x=normalizeQuestion(q);
    if(parseDateRange(q))return'range';
    if(/(siguiente|proxima|proximo).*(turno|cita)|turno.*siguiente|quien.*sigue|quien.*siguiente|siguiente paciente|proxima paciente/.test(x))return'next';
    if(/sin confirmar|no confirmad|por confirmar|falta.*confirmar/.test(x))return'unconfirmed';
    if(/cancelad|anulad|no asist/.test(x)&&!/(cuantas|cantidad|total)/.test(x))return'cancelled';
    if(/espacios? libres?|horarios? libres?|huecos? libres?|cupos? libres?|disponibles?/.test(x))return'free';
    if(/dia.*mas|mas ocupado|dia con mas/.test(x))return'busiest';
    if(/comparad|comparacion.*ingres|respecto.*mes pasado|como van.*ingres/.test(x))return'compare';
    if(/proyec|estimad|esperad|cuanto.*voy.*ingres.*futuro/.test(x))return'projection';
    if(/pendient|por cobrar|sin pagar|no pagad|falta cobrar|quien.*deb|clientes?.*deb|pacientes?.*deb/.test(x))return'pending';
    if(/ingres|dinero|gane|gan(e|é|e)|recaudad|cobrad|factur|cuanto.*cobre|cuanto.*recibi|me.*pagaron/.test(x))return'real_income';
    if(/primer(a|o).*cita|primera.*atencion|primer turno/.test(x))return'first';
    if(/ultimo.*cita|ultima.*cita|ultimo turno|ultima atencion/.test(x))return'last';
    if(/promedio.*cita|promedio.*sesion|ticket.*promedio/.test(x))return'average';
    if(/presencial/.test(x)&&/(cuantas|cantidad|total|citas)/.test(x))return'modality';
    if(/virtual|online/.test(x)&&/(cuantas|cantidad|total|citas)/.test(x))return'modality';
    if(/(cuantas|cantidad|numero|total).*(cita|reserva|turno)|citas.*(tuve|tengo|hubo|total)|cuantos turnos/.test(x))return'count';
    if(/(quien|que paciente|paciente).*(cita|turno)|tienen cita|quienes.*hoy|quienes.*manana/.test(x))return'people';
    if(/a que hora|que hora|hora.*cita|cita.*hora|cuando.*cita/.test(x))return'patient_time';
    if(/hoy/.test(x))return'today';
    if(/manana/.test(x))return'tomorrow';
    if(/ayer/.test(x))return'yesterday';
    if(/semana pasada|semana anterior/.test(x))return'last_week';
    if(/esta semana|\bsemana\b/.test(x))return'week';
    if(/mes pasado|mes anterior/.test(x))return'last_month';
    if(/este mes|\bmes\b/.test(x))return'month';
    if(/tarea.*pendiente|que.*queda/.test(x))return'pending_tasks';
    return'help';
  }

  async function classifyWithGemini(question){
    const key=localStorage.getItem(KEY_NAME); if(!key)return null;
    const allowed=['today','tomorrow','yesterday','week','last_week','month','last_month','cancelled','real_income','pending','pending_tasks','projection','compare','patient_time','next','first','last','free','busiest','unconfirmed','people','count','range','average','modality','help'];
    const prompt=`Clasifica una pregunta administrativa de una agenda de psicología. Categorías: ${allowed.join(', ')}. No respondas datos ni nombres. Solo devuelve una categoría. Pregunta: ${question}`;
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0,maxOutputTokens:10}})});
    if(!r.ok)throw new Error('Gemini respondió con HTTP '+r.status);
    const d=await r.json(), text=((((d.candidates||[])[0]||{}).content||{}).parts||[])[0]?.text||'';
    const v=text.trim().toLowerCase(); return allowed.includes(v)?v:null;
  }

  function answer(intent,q){
    const all=allAppointments(), today=todayLima(), x=normalizeQuestion(q);
    let list=[],r,title;
    // Rangos explícitos: inclusivos, sin canceladas.
    if(intent==='range'){
      r=parseDateRange(q); if(!r)return'<div class="assistant-title">📅 Rango no reconocido</div><div>Prueba: “¿Cuántas citas tuve del 01/09/2026 al 10/09/2026?”</div>';
      list=activeInRange(all,r); title=`Periodo ${r.label}`;
      if(/proyec|estimad|esperad/.test(x)){
        return `<div class="assistant-title">📈 Proyección ${escapeHtml(r.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(list))}</div><div>${list.length} cita(s) consideradas, canceladas excluidas.</div>${pendingDetailHtml(list)}`;
      }
      if(/ingres|dinero|cobrad|recaudad|pago/.test(x)){
        const paid=list.filter(isPaid);return `<div class="assistant-title">💰 Ingresos reales ${escapeHtml(r.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(paid))}</div><div>${paid.length} pago(s) registrados como pagados.</div>`;
      }
      if(/pendient|por cobrar|sin pagar/.test(x)){
        const p=list.filter(isPendingPayment);return `<div class="assistant-title">⏳ Pendiente por cobrar ${escapeHtml(r.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(p))}</div>${pendingDetailHtml(p)}`;
      }
      return apptListHtml(list,{title});
    }

    if(intent==='next'){
      let c=all.filter(isActiveAppointment).filter(a=>a.date>today||(a.date===today&&(a.time||'')>=limaNowTime())).sort((a,b)=>String(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
      const n=c[0]; return n?`<div class="assistant-title">🕐 Siguiente turno</div><div class="assistant-total">${escapeHtml(n.patientName)}</div><div>${formatDate(n.date)} · ${escapeHtml(formatTime12(n.time))}</div><div class="mt-1 text-slate-500">Estado: ${escapeHtml(n.status||'pendiente')}</div>`:'<div class="assistant-title">🕐 Siguiente turno</div><div>No hay una cita futura o pendiente para mostrar.</div>';
    }
    if(intent==='first'||intent==='last'){
      r=rangeList(q,'today'); list=activeInRange(all,r).sort((a,b)=>String(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
      const a=intent==='first'?list[0]:list[list.length-1];
      return a?`<div class="assistant-title">🕐 ${intent==='first'?'Primera':'Última'} cita ${escapeHtml(r.label)}</div><div class="assistant-total">${escapeHtml(a.patientName)}</div><div>${formatDate(a.date)} · ${escapeHtml(formatTime12(a.time))}</div>`:`<div class="assistant-title">🕐 ${intent==='first'?'Primera':'Última'} cita</div><div>No hay citas activas ${escapeHtml(r.label)}.</div>`;
    }

    if(['today','tomorrow','yesterday','week','last_week','month','last_month','people','count','average','modality','patient_time'].includes(intent)){
      r=rangeList(q,intent==='week'||intent==='last_week'?'week':intent==='month'||intent==='last_month'?'month':'today');
      if(intent==='tomorrow'){r={start:addDays(today,1),end:addDays(today,1),label:'de mañana'};}
      if(intent==='yesterday'){r={start:addDays(today,-1),end:addDays(today,-1),label:'de ayer'};}
      if(intent==='week'){const z=getWeekRange(today);r={start:z[0],end:addDays(z[1],-1),label:'de esta semana'};}
      if(intent==='last_week'){const z=getPrevWeekRange(today);r={start:z[0],end:addDays(z[1],-1),label:'de la semana pasada'};}
      if(intent==='month'){const z=getMonthRange(today);r={start:z[0],end:addDays(z[1],-1),label:'de este mes'};}
      if(intent==='last_month'){const z=getPrevMonthRange(today);r={start:z[0],end:addDays(z[1],-1),label:'del mes pasado'};}
      list=all.filter(a=>a.date>=r.start&&a.date<=r.end&&isActiveAppointment(a));
      if(intent==='patient_time'){
        const matches=findPatientMatches(q,list);
        return matches.length?`<div class="assistant-title">🕐 Cita encontrada</div><ul class="assistant-list">${matches.slice(0,15).map(a=>`<li><b>${escapeHtml(a.patientName)}</b> — ${formatDate(a.date)} · ${escapeHtml(formatTime12(a.time))}</li>`).join('')}</ul>`:'<div class="assistant-title">🔎 No encontré al paciente</div><div>Prueba con su nombre o apellido.</div>';
      }
      if(intent==='modality'){
        const wantVirtual=/virtual|online/.test(x), m=list.filter(a=>wantVirtual?/virtual|online/i.test(a.modality||''):/presencial/i.test(a.modality||''));
        return apptListHtml(m,{emoji:'🧑‍💻',title:`Citas ${wantVirtual?'virtuales':'presenciales'} ${r.label}`});
      }
      if(intent==='average'){
        const vals=list.filter(a=>Number(a.cost)>0); const avg=vals.length?sumByCurrency(vals):{};
        Object.keys(avg).forEach(c=>avg[c]/=vals.length);
        return `<div class="assistant-title">📊 Promedio por cita ${escapeHtml(r.label)}</div><div class="assistant-total">${formatTotals(avg)}</div><div>Calculado sobre ${vals.length} cita(s) con monto.</div>`;
      }
      return apptListHtml(list,{title:`Citas ${r.label}`});
    }

    if(intent==='real_income'||intent==='pending'||intent==='projection'){
      r=rangeList(q,'month'); list=activeInRange(all,r);
      if(intent==='real_income'){const p=list.filter(isPaid);return`<div class="assistant-title">💰 Ingresos reales ${escapeHtml(r.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(p))}</div><div>${p.length} pago(s) registrados como pagados.</div>`;}
      if(intent==='pending'){const p=list.filter(isPendingPayment);return`<div class="assistant-title">⏳ Pendiente por cobrar ${escapeHtml(r.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(p))}</div><div>${p.length} cita(s) con pago pendiente.</div>${pendingDetailHtml(p)}`;}
      return`<div class="assistant-title">📈 Proyección de ingresos ${escapeHtml(r.label)}</div><div class="assistant-total">${formatTotals(sumByCurrency(list))}</div><div>${list.length} cita(s): cobradas + pendientes, canceladas excluidas.</div>`;
    }

    if(intent==='compare'){
      const useWeek=/semana/.test(x), cur=useWeek?getWeekRange(today):getMonthRange(today), prev=useWeek?getPrevWeekRange(today):getPrevMonthRange(today);
      const cp=all.filter(a=>a.date>=cur[0]&&a.date<cur[1]&&isPaid(a)),pp=all.filter(a=>a.date>=prev[0]&&a.date<prev[1]&&isPaid(a));
      const c=sumByCurrency(cp),p=sumByCurrency(pp),d=(c.PEN||0)-(p.PEN||0),pct=p.PEN?((d/p.PEN)*100).toFixed(1):null;
      return`<div class="assistant-title">${d>0?'📈':d<0?'📉':'➖'} Comparación de ingresos</div><div><b>${useWeek?'Esta semana':'Este mes'}:</b> ${formatTotals(c)} (${cp.length} pagos)</div><div><b>${useWeek?'Semana pasada':'Mes pasado'}:</b> ${formatTotals(p)} (${pp.length} pagos)</div><div class="mt-1 text-slate-500">Diferencia PEN: ${d>=0?'+':''}S/ ${d.toFixed(2)}${pct!==null?' ('+(d>=0?'+':'')+pct+'%)':''}.</div>`;
    }

    if(intent==='free'){
      r=rangeList(q,'today'); const rows=[];
      for(let d=r.start;d<=r.end;d=addDays(d,1)){const slots=daySlots(d),free=slots.filter(s=>!all.some(a=>a.date===d&&isActiveAppointment(a)&&String(a.time||'').slice(0,5)===s));rows.push({d,slots,free});}
      const total=rows.reduce((n,v)=>n+v.free.length,0);
      return`<div class="assistant-title">🟢 Horarios libres ${escapeHtml(r.label)}</div><div class="assistant-total">${total} horario(s) libre(s)</div><ul class="assistant-list">${rows.map(v=>v.slots.length?`<li>${formatDate(v.d)}: ${v.free.length} libre(s) — ${v.free.join(', ')||'ninguno'}</li>`:`<li>${formatDate(v.d)}: consultorio cerrado</li>`).join('')}</ul>`;
    }

    if(intent==='busiest'){
      const z=/mes/.test(x)?getMonthRange(today):getWeekRange(today), s=all.filter(a=>a.date>=z[0]&&a.date<z[1]&&isActiveAppointment(a)),counts={};
      s.forEach(a=>counts[a.date]=(counts[a.date]||0)+1);const rank=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
      if(!rank.length)return'<div class="assistant-title">📊 Días con más citas</div><div>No hay citas activas en el periodo.</div>';
      const max=rank[0][1],tops=rank.filter(v=>v[1]===max);
      return`<div class="assistant-title">📊 Día más ocupado</div><div class="assistant-total">${tops.map(v=>formatDate(v[0])).join(', ')} — ${max} cita(s)</div><ul class="assistant-list">${rank.slice(0,10).map(v=>`<li>${formatDate(v[0])}: ${v[1]} cita(s)</li>`).join('')}</ul>`;
    }

    if(intent==='unconfirmed'){
      r=rangeList(q,'today');list=all.filter(a=>a.date>=r.start&&a.date<=r.end&&isActiveAppointment(a)&&isPendingAttention(a));
      return apptListHtml(list,{emoji:'📝',title:`Citas sin confirmar ${r.label}`,emptyMsg:'No hay citas pendientes de confirmar/atender.'});
    }
    if(intent==='pending_tasks'){
      r=rangeList(q,'today');list=activeInRange(all,r);const u=list.filter(isPendingAttention),p=list.filter(isPendingPayment);
      return`<div class="assistant-title">🧾 Pendientes ${escapeHtml(r.label)}</div><div><b>${u.length}</b> cita(s) sin confirmar/atender.</div><div><b>${p.length}</b> cita(s) con pago pendiente por ${formatTotals(sumByCurrency(p))}.</div>${u.length?'<ul class="assistant-list mt-2">'+u.map(a=>`<li>${formatDate(a.date)} ${formatTime12(a.time)} — ${escapeHtml(a.patientName)}</li>`).join('')+'</ul>':''}${p.length?pendingDetailHtml(p):''}`;
    }
    if(intent==='cancelled'){
      r=rangeList(q,'month');list=all.filter(a=>a.date>=r.start&&a.date<=r.end&&isCancelled(a));
      return apptListHtml(list,{emoji:'❌',title:`Citas canceladas ${r.label}`,emptyMsg:'No hay citas canceladas en ese periodo.'});
    }
    if(intent==='help'){
      return`<div class="assistant-title">🤖 Soy tu asistente personal</div><div>Puedo consultar tu agenda y finanzas sin entrar a historias clínicas.</div><div class="mt-2 font-semibold">Puedes preguntarme, por ejemplo:</div><ul class="assistant-list"><li>¿Quién es mi siguiente paciente?</li><li>¿Cuántas citas tuve del 1 al 10 de septiembre?</li><li>¿Quiénes tienen cita mañana?</li><li>¿Cuál es la primera cita de hoy?</li><li>¿Cuántas citas tengo pendientes de confirmar?</li><li>¿Cuánto cobré esta semana?</li><li>¿Quiénes me deben dinero?</li><li>¿Cuál es mi proyección del 10 al 30?</li><li>¿Qué horarios libres tengo mañana?</li><li>¿Qué día estuvo más ocupado?</li><li>¿Cuántas citas virtuales tuve?</li><li>¿Cuál fue mi promedio por cita?</li><li>¿Cómo van mis ingresos frente al mes pasado?</li></ul>`;
    }
    return apptListHtml(all.filter(isActiveAppointment),{title:'Citas activas'});
  }

  function setAnswer(html){const e=$('assistant-answer');if(e){e.innerHTML=html;e.classList.remove('hidden');}}
  function setStatus(text,type){const e=$('assistant-status');if(!e)return;e.textContent=text;e.className='text-xs rounded-xl p-3';e.classList.add(type==='ok'?'bg-emerald-50':type==='error'?'bg-rose-50':'bg-slate-50',type==='ok'?'text-emerald-700':type==='error'?'text-rose-700':'text-slate-600');e.classList.remove('hidden');}
  function openAssistantModal(){const m=$('assistant-modal');if(!m)return;m.classList.remove('hidden');m.classList.add('flex');updateConfigState();const q=$('assistant-question');if(q)setTimeout(()=>q.focus(),80);}
  function closeAssistantModal(){const m=$('assistant-modal');if(m){m.classList.add('hidden');m.classList.remove('flex');}}
  function openGeminiConfig(){const b=$('gemini-config-box');if(!b)return;b.classList.toggle('hidden');const i=$('gemini-api-key');if(i)i.value=localStorage.getItem(KEY_NAME)||'';updateConfigState();}
  function saveGeminiKey(){const i=$('gemini-api-key'),k=i?i.value.trim():'';if(!k){alert('Pega primero tu API Key de Gemini.');return;}localStorage.setItem(KEY_NAME,k);updateConfigState();setStatus('API de Gemini guardada en este navegador.','ok');const b=$('gemini-config-box');if(b)b.classList.add('hidden');}
  function clearGeminiKey(){localStorage.removeItem(KEY_NAME);const i=$('gemini-api-key');if(i)i.value='';updateConfigState();setStatus('Clave eliminada. El asistente seguirá funcionando con interpretación local.','info');}
  function updateConfigState(){const e=$('assistant-config-state');if(e)e.textContent=localStorage.getItem(KEY_NAME)?'● Gemini configurado':'○ Gemini opcional';}

  function speakAnswer(){
    if(!('speechSynthesis'in window)||typeof SpeechSynthesisUtterance==='undefined'){setStatus('Este navegador no admite lectura por voz.','error');return false;}
    const text=lastAnswerText||(($('assistant-answer')||{}).innerText||'');if(!text.trim()){setStatus('Primero realiza una consulta.','info');return false;}
    try{const s=window.speechSynthesis;s.cancel();const u=new SpeechSynthesisUtterance(text.replace(/\s+/g,' ').trim());u.lang='es-PE';u.rate=1;u.pitch=1;u.volume=1;u.onstart=()=>setStatus('🔊 Reproduciendo respuesta por voz.','ok');u.onend=()=>setStatus('✅ Respuesta terminada.','ok');u.onerror=()=>setStatus('No se pudo reproducir la voz. Toca “Leer respuesta”.','error');s.speak(u);return true;}catch(e){setStatus('No se pudo iniciar la voz.','error');return false;}
  }
  function stopAnswerVoice(){if('speechSynthesis'in window)window.speechSynthesis.cancel();setStatus('🔇 Lectura detenida.','info');}
  function toggleAutoVoice(){autoSpeak=!autoSpeak;const b=$('assistant-auto-voice-btn');if(b){b.textContent=autoSpeak?'🔊 Voz automática: ON':'🔇 Voz automática: OFF';}if(!autoSpeak)stopAnswerVoice();}
  function updateVoiceButton(){const b=$('assistant-voice-btn');if(!b)return;b.textContent=isListening?'⏹️':'🎙️';b.title=isListening?'Detener dictado':'Hablar';b.classList.toggle('bg-rose-100',isListening);}
  function toggleAssistantVoice(){
    voiceQueryActive=true;const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setStatus('Usa Google Chrome o Microsoft Edge para dictar por voz.','error');return;}
    if(isListening&&recognition){recognition.stop();return;}
    recognition=new SR();recognition.lang='es-PE';recognition.continuous=false;recognition.interimResults=true;isListening=true;updateVoiceButton();setStatus('🎙️ Escuchando… habla ahora.','info');
    let finalText='';
    recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)finalText+=t;else interim+=t;}const input=$('assistant-question');if(input)input.value=(finalText+interim).trim();};
    recognition.onend=()=>{isListening=false;updateVoiceButton();if(finalText.trim()){const input=$('assistant-question');if(input)input.value=finalText.trim();setTimeout(askAssistant,200);}else{setStatus('No pude captar la pregunta.','info');}};
    recognition.onerror=e=>{isListening=false;updateVoiceButton();setStatus(e.error==='not-allowed'?'Debes permitir el micrófono en el navegador.':'No se pudo usar el micrófono: '+e.error,'error');};
    recognition.start();
  }

  async function askAssistant(){
    const input=$('assistant-question'),q=input?input.value.trim():'';if(!q){setStatus('Escribe o dicta una pregunta.','error');return;}
    const btn=$('assistant-send-btn');if(btn){btn.disabled=true;btn.textContent='…';}setStatus('Consultando…','info');
    try{
      let intent=localIntent(q);
      const explicit=parseDateRange(q);
      try{const ai=await classifyWithGemini(q);if(ai&&!explicit)intent=ai;}catch(e){console.warn('[Asistente] Gemini no disponible; interpretación local.',e);}
      const html=answer(intent,q);setAnswer(html);lastAnswerText=($('assistant-answer')||{}).innerText||'';
      setStatus('✅ Consulta resuelta con los datos administrativos de la agenda.','ok');
      if(autoSpeak)setTimeout(speakAnswer,80);voiceQueryActive=false;
    }catch(e){console.error(e);setStatus('No se pudo procesar la consulta: '+e.message,'error');}
    finally{if(btn){btn.disabled=false;btn.textContent='➤';}}
  }
  function askAssistantExample(text){const i=$('assistant-question');if(i)i.value=text;askAssistant();}

  // Acceso rápido desde burbuja.
  function openAssistantGreeting(){
    openAssistantModal();
    const welcome=$('assistant-welcome');
    if(welcome)welcome.classList.remove('hidden');
  }

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
  window.openAssistantGreeting=openAssistantGreeting;
  window.addEventListener('DOMContentLoaded',()=>{updateConfigState();});
  console.info('[Asistente Personal] versión',APP_VERSION);
})();