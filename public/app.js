import { unlockSound, stopSound, celebrate } from './effects.js';
const app = document.querySelector('#app');
const topUser = document.querySelector('#top-user');
const state = { user: null, assessment: null, attempts: [], answers: {}, index: 0, screen: 'login', result: null, busy: false, message: '' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const skillIcons = { Grammar: '◈', Reading: '▤', Vocabulary: '✦' };
async function request(path, options = {}) {
  let response;
  try { response = await fetch(path, { credentials: 'same-origin', signal: AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/json' }, ...options }); }
  catch { throw new Error('Sin conexión con el servidor. Comprueba tu red e inténtalo de nuevo.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 401) { state.screen = 'login'; state.user = null; } throw new Error(data.error || 'No se pudo completar la solicitud.'); }
  return data;
}
state.run = null;
state.rewards = { xp: 0, badges: [] };
function completedCount() { return state.run && !state.run.result ? state.run.answered : 0; }
function adoptRun(run) {
  state.run = run;
  state.answers = Object.fromEntries((run?.review || []).map(r => [r.id, r.response]));
  state.index = Math.max(0, (run?.answered || 0) - 1);
}
const flash = msg => { state.message = msg; render(); };
function shell(content) {
  topUser.innerHTML = state.user ? `<div class="user-chip"><span class="avatar">${esc(state.user.name[0])}</span><span class="user-name">${esc(state.user.name)}</span><button type="button" class="text-button" data-action="logout">Salir</button></div>` : '<span class="top-tag">YOUR ENGLISH JOURNEY STARTS HERE ✦</span>';
  app.innerHTML = (state.message ? `<div class="notice" role="alert">${esc(state.message)}<button data-action="dismiss" aria-label="Cerrar aviso">×</button></div>` : '') + content;
}
function login() {
  shell(`<section class="login-layout"><div class="login-story"><div class="eyebrow"><span class="dot"></span> WELCOME TO THE LAB</div><h1>Your English<br><em>journey starts here.</em></h1><p>Una evaluación breve. Una ruta diseñada para ti. Descubre dónde estás y hacia dónde puedes llegar.</p><div class="orbit-scene" aria-hidden="true"><div class="orbit orbit--outer"></div><div class="orbit orbit--inner"></div><div class="planet">G<span>✦</span></div><div class="orbit-label orbit-label--one">GROW</div><div class="orbit-label orbit-label--two">EXPLORE</div><div class="orbit-star">✦</div></div><div class="story-foot"><span>01 / DISCOVER</span><span>02 / LEARN</span><span>03 / GROW</span></div></div><div class="login-panel"><div class="panel-kicker">STUDENT PORTAL <span>01 — 03</span></div><h2>Bienvenido a bordo<span class="accent">.</span></h2><p>Inicia sesión para continuar tu expedición.</p><form id="login-form"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" autocomplete="username" required placeholder="tu@correo.com" value="${esc(state.credentials?.email ?? 'estudiante@globalai.demo')}"/><label for="password">Contraseña</label><input id="password" name="password" type="password" autocomplete="current-password" required placeholder="Tu contraseña" value="${esc(state.credentials?.password ?? 'GlobalAI2026!')}"/><button class="button button--primary button--wide" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Ingresando…' : 'Comenzar expedición <span aria-hidden="true">↗</span>'}</button></form><div class="demo-box"><span class="demo-icon">✧</span><div><strong>Acceso de demostración</strong><span>Las credenciales están precargadas para explorar el prototipo.</span></div></div></div></section>`);
}

function badgeIcon(code) {
  const shape = code === 'spark' ? '<path d="M24 8l5 11 11 5-11 5-5 11-5-11-11-5 11-5z"/>' : code === 'navigator' ? '<circle cx="24" cy="24" r="16"/><path d="M31 17l-4 10-10 4 4-10z"/>' : '<path d="M7 34h34M10 29l10-12 7 8 11-15M29 10h9v9"/>';
  return '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round">'+shape+'</svg>';
}
function badgeCards(badges) {
  return badges.map(b=>'<div class="expedition-badge badge--'+esc(b.code)+'">'+badgeIcon(b.code)+'<div><strong>'+esc(b.name)+'</strong><p>'+esc(b.detail)+'</p></div></div>').join('');
}
function rewardSummary(rewards) {
  if (!rewards) return '';
  return '<section class="reward-summary" aria-labelledby="rewards-title"><div class="reward-heading"><div><span class="eyebrow">TESOROS DE LA EXPEDICIÓN</span><h2 id="rewards-title">Tu esfuerzo deja huella.</h2></div><strong class="xp-total">'+rewards.xp+' <small>XP</small></strong></div><div class="xp-breakdown"><span>Aprendizaje <b>+'+rewards.learning+'</b></span><span>Aciertos <b>+'+rewards.accuracy+'</b></span><span>Finalización <b>+'+rewards.completion+'</b></span><span>Mejora personal <b>+'+rewards.improvement+'</b></span></div><p>Los XP celebran tu práctica; tu nota A2 se calcula por separado.</p><div class="badge-grid">'+badgeCards(rewards.badges)+'</div>'+(rewards.badges.length?'':'<p>Las insignias se entregan una sola vez. Tu colección está en el dashboard.</p>')+'</section>';
}

function dashboard() {
  const latest = state.attempts[0];
  const best = state.attempts.length ? Math.max(...state.attempts.map(a => a.score)) : null;
  const firstName = state.user.name.split(' ')[0];
  const filled = completedCount();
  shell(`<div class="page-heading"><div><div class="eyebrow"><span class="dot"></span> STUDENT DASHBOARD</div><h1>Hola, ${esc(firstName)} <span class="wave">✳</span></h1><p>Tu próxima aventura en inglés está lista para comenzar.</p></div><div class="heading-number">01<span>/ 03</span></div></div><div class="dashboard-grid"><section class="hero-card"><div class="hero-content"><div class="card-label">✦ NUEVA MISIÓN DISPONIBLE <span>A2 · 10 RETOS</span></div><div class="hero-copy"><span class="mini-rule"></span><h2>The English<br><em>Expedition</em></h2><p>Parte de Estación Prisma, sigue la Ruta de los Ecos y llega al Puerto de las Palabras. Diez retos, un nuevo horizonte.</p><div class="hero-meta"><span>◷ 12 MINUTOS</span><span>◎ 3 HABILIDADES</span></div><button class="button button--light" data-action="start">${filled ? `Continuar misión (${filled}/10)` : 'Empezar evaluación'} <span aria-hidden="true">↗</span></button></div></div><div class="hero-graphic" aria-hidden="true"><div class="graphic-ring graphic-ring--one"></div><div class="graphic-ring graphic-ring--two"></div><div class="graphic-core">A<span>2</span></div><span class="graphic-star">✦</span><span class="graphic-caption">THE JOURNEY<br>IS YOURS</span></div></section><div class="side-column"><section class="metric-card"><div class="card-label dark">TU BRÚJULA <span>↗</span></div><div class="metrics"><div><strong>${state.attempts.length}</strong><span>Misiones<br>completadas</span></div><div><strong>${best === null ? '—' : best + '%'}</strong><span>Tu mejor<br>resultado</span></div></div><p>${latest ? `Última evaluación: ${esc(formatDate(latest.date))}` : 'Tu historia empieza con tu primera evaluación.'}</p></section><section class="quote-card"><span class="quote-mark">“</span><p>Every expert was once a beginner.</p><span>KEEP GOING, ONE STEP AT A TIME ✦</span></section></div></div><section class="collection"><div class="section-head"><h2>Tu bitácora de explorador</h2><strong>${state.rewards.xp} XP acumulados</strong></div><p>5 XP por aprender · +5 por acertar · +30 al terminar · +20 por superar tu mejor nota.</p><div class="badge-grid">${badgeCards(state.rewards.badges)}</div>${state.rewards.badges.length ? "" : "<p>Tu primera confirmación encenderá la Chispa Prisma.</p>"}</section><section class="section-block"><div class="section-head"><div><span class="eyebrow">YOUR LEARNING MAP</span><h2>Progreso reciente</h2></div><button class="text-link" data-action="progress">Ver historial completo ↗</button></div>${latest ? `<div class="latest-card"><div class="latest-icon">✦</div><div><strong>${esc(latest.title)}</strong><span>${esc(formatDate(latest.date))} · ${esc(latest.level)}</span></div><strong class="latest-score">${latest.score}%</strong><button class="icon-arrow" data-action="progress" aria-label="Ver progreso">↗</button></div>` : `<div class="empty-card"><span>✧</span><p>Aún no tienes intentos registrados. ¡Tu primer paso te espera!</p></div>`}</section>`);
}
const stages = [
  { skill: 'Grammar', title: 'Estación Prisma', subtitle: 'Enciende los motores del lenguaje.', symbol: '◈', range: '01 — 06', key: 'station' },
  { skill: 'Reading', title: 'Ruta de los Ecos', subtitle: 'Sigue las pistas. Descubre el mensaje.', symbol: '≋', range: '07 — 08', key: 'trail' },
  { skill: 'Vocabulary', title: 'Puerto de las Palabras', subtitle: 'Cada palabra te lleva más lejos.', symbol: '✦', range: '09 — 10', key: 'harbor' }
];
function landscape(key) {
  const shapes = key === 'station'
    ? '<path d="M30 155h220M65 145V75l85-45 85 45v70M90 145V85h120v60M110 145v-35h80v35M55 160l-15 28m185-28 15 28M115 65h70"/><circle cx="150" cy="65" r="12"/>'
    : key === 'trail'
    ? '<path d="M10 160L80 55l60 105M110 160l80-120 80 120M150 195c-100-45 100-50 10-100M45 107h33m91-26h31"/><circle cx="75" cy="175" r="6"/><circle cx="191" cy="120" r="6"/>'
    : '<path d="M20 170q30-20 60 0t60 0t60 0t60 0M20 192q30-20 60 0t60 0t60 0t60 0M85 145h110l-20 20h-70zM150 45v100M140 60l-45 70h45zM160 60l45 70h-45z"/><circle cx="230" cy="50" r="18"/>';
  return '<svg class="landscape" viewBox="0 0 300 210" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+shapes+'</svg>';
}
function assessmentScreen() {
  const q = state.assessment.questions[state.index];
  const stageIndex = stages.findIndex(s => s.skill === q.skill), stage = stages[stageIndex];
  const feedback = state.run.review.find(r => r.id === q.id);
  const locked = feedback || state.busy;
  const value = state.answers[q.id] || '';
  const options = q.options ? '<div class="choices" role="radiogroup" aria-labelledby="question-title">'+q.options.map((v,i) =>
    '<label class="choice '+(value===v?'is-selected':'')+(feedback && value===v && !feedback.correct?' is-incorrect':'')+'"><input type="radio" name="response" value="'+esc(v)+'" '+(value===v?'checked ':'')+(locked?'disabled':'')+'/><span class="choice-letter">'+String.fromCharCode(65+i)+'</span><span lang="en">'+esc(v)+'</span><span class="choice-indicator" aria-hidden="true">'+(feedback && value===v && !feedback.correct?'×':'✓')+'</span></label>').join('')+'</div>'
    : '<label class="fill-label" for="fill-answer">Escribe una palabra en inglés</label><input id="fill-answer" class="fill-input" type="text" maxlength="200" autocomplete="off" autocapitalize="none" spellcheck="false" value="'+esc(value)+'" '+(locked?'disabled':'')+' />';
  const cheers = ['¡La chispa de tu viaje está encendida!', '¡Tus ideas ya toman velocidad!', '¡Encontraste la pieza que faltaba!', '¡Tu brújula apunta más lejos!', '¡Un nuevo puente en tu ruta!', '¡Estación Prisma completada con luz propia!', '¡Escuchaste la pista entre los ecos!', '¡El mensaje ya tiene sentido!', '¡Esa palabra abre el puerto!', '¡Tu última estrella llegó a destino!'];
  shell(`<div class="assessment-wrap scene--${stage.key}">
    <div class="assessment-top"><button class="back-link" data-action="dashboard">← Pausar y salir</button><span>THE ENGLISH EXPEDITION · A2</span><span class="count-pill">${state.run.answered}/10 CONFIRMADAS</span></div>
    <div class="reward-progress"><span>${state.run.rewards?.xp || 0} XP en esta expedición</span><span class="next-checkpoint">${state.index === 9 ? "✦ Destino final" : "✦ Checkpoint " + (state.index + 2)}</span></div><progress class="journey-progress" max="10" value="${state.run.answered}" aria-label="Retos confirmados">${state.run.answered}/10</progress>
    <ol class="journey-map" aria-label="Etapas de la expedición">${stages.map((s,i)=>'<li '+(i===stageIndex?'aria-current="step"':'')+' class="'+(i<stageIndex?'visited':'')+'"><span aria-hidden="true">'+(i<stageIndex?'✓':s.symbol)+'</span><div><small>'+s.range+'</small><strong>'+s.title+'</strong></div></li>').join('')}</ol>
    <div class="question-layout"><aside class="expedition-scene"><span class="eyebrow">ETAPA 0${stageIndex+1} · ${stage.skill}</span>${landscape(stage.key)}<h2>${stage.title}</h2><p>${stage.subtitle}</p><div class="passport">PASAPORTE GLOBAL AI <strong>${state.run.answered} / 10 sellos</strong><small>Cada reto confirmado cuenta como un paso.</small></div></aside>
    <section class="question-card" aria-busy="${state.busy}"><div class="question-head"><span>RETO ${state.index+1} DE 10</span><span>${q.skill}</span></div>
    ${q.passage?'<div class="passage"><span>LEE Y ENCUENTRA LA PISTA</span><p lang="en">'+esc(q.passage)+'</p></div>':''}
    <h1 id="question-title" tabindex="-1" lang="en">${esc(q.prompt)}</h1><p class="challenge-instruction">${q.options?'Elige una opción y confirma tu respuesta.':'Completa la frase y confirma tu respuesta.'}</p>
    <form id="answer-form">${options}<span class="star-trail" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i><i>✧</i></span>
    ${feedback?'<div class="answer-feedback '+(feedback.correct?'success':'learning')+'" tabindex="-1" role="status"><strong>'+(feedback.correct?'✓ '+cheers[state.index%cheers.length]:['↗ Una pista nueva para tu mapa', '◈ Hagamos una pausa para aprender', '✧ Este descubrimiento también cuenta'][state.index % 3])+'</strong><p>'+(feedback.correct?'Respuesta correcta.':'Respuesta incorrecta. La respuesta es <b lang="en">'+esc(feedback.correctAnswer)+'</b>.')+' '+esc(feedback.explanation)+'</p>'+(feedback.reward ? '<div class="earned-xp">+'+feedback.reward.xp+' XP · Aprendizaje +5'+(feedback.correct?' · Acierto +5':'')+(feedback.reward.completion?' · Finalización +30':'')+(feedback.reward.improvement?' · Mejora +20':'')+'</div>'+badgeCards(feedback.reward.badges) : '')+'</div>':''}
    <div class="question-actions">${feedback?'<button type="button" class="button button--primary" data-action="continue">'+(state.index===9?'Descubrir mi resultado ✦':(state.index===5?'Explorar la Ruta de los Ecos →':state.index===7?'Llegar al Puerto de las Palabras →':'Continuar →'))+'</button>':'<button type="submit" class="button button--primary" '+(state.busy?'disabled':'')+'>'+(state.busy?'Guardando respuesta…':'Confirmar respuesta')+'</button>'}</div></form>
    <p class="question-note">${feedback?'Respuesta guardada. Puedes continuar a tu ritmo.':'Las respuestas confirmadas se guardan y no se pueden cambiar.'}</p>
    ${state.message?'<button class="text-link" data-action="recover">Recuperar progreso del servidor</button>':''}
    </section></div></div>`);
}
function resultScreen() {
  const r = state.result;
  shell(`<div class="result-page"><div class="eyebrow"><span class="dot"></span> MISSION COMPLETE</div><div class="result-hero"><div><span class="result-kicker">RESULTADO DE TU EXPEDICIÓN</span><h1>Un paso más<br><em>hacia tu futuro.</em></h1><p>Completaste los 10 retos del diagnóstico A2. Aquí empieza tu siguiente capítulo.</p></div><div class="score-ring" style="--score:${r.score}%"><div><strong>${r.score}<small>%</small></strong><span>GLOBAL SCORE</span></div></div></div>${rewardSummary(r.rewards)}<div class="arrival-stamps" aria-label="Tres etapas completadas">${stages.map(s => `<div><span aria-hidden="true">${s.symbol}</span><strong>${s.title}</strong><small>✓ Etapa completada</small></div>`).join("")}</div><div class="result-grid"><section class="result-card result-card--wide"><div class="card-label dark">TU MAPA DE HABILIDADES <span>↗</span></div>${Object.entries(r.skills).map(([name, val]) => `<div class="skill-row"><span class="skill-name"><i>${skillIcons[name] || '✦'}</i>${esc(name)}</span><div class="skill-bar"><div style="width:${val.percent}%"></div></div><strong>${val.percent}%</strong></div>`).join('')}</section><section class="result-card tally-card"><div class="card-label dark">EN NÚMEROS</div><div class="tally"><div><span>RESPUESTAS CORRECTAS</span><strong>${r.correctCount}<small>/10</small></strong></div><div><span>POR REFORZAR</span><strong>${r.incorrectCount}<small>/10</small></strong></div></div></section></div><section class="strength-card"><span>${r.correctCount ? "✦ TU FORTALEZA EN ESTA RUTA" : "✦ TU PUNTO DE PARTIDA"}</span><h2>${esc(Object.entries(r.skills).filter(([,v]) => v.percent === Math.max(...Object.values(r.skills).map(s => s.percent))).map(([name]) => name).join(" · "))}</h2><p>${r.correctCount ? "Empieza tu próxima práctica desde lo que ya sabes." : "Completaste el recorrido: ahora tienes un punto de partida para practicar las tres habilidades."}</p></section><section class="coach-card"><div class="coach-symbol">✦</div><div><span>GLOBAL AI · ENGLISH COACH</span><h2>${esc(r.interpretation.title)}</h2><p>${esc(r.interpretation.detail)} ${esc(r.feedback)}</p><small>Feedback educativo basado en reglas. No es una certificación oficial del MCER.</small></div></section><details class="review"><summary>Revisar respuestas y explicaciones <span>＋</span></summary><div class="review-list">${r.review.map((item, i) => `<div class="review-item"><span class="review-status ${item.correct ? 'correct' : 'wrong'}">${item.correct ? '✓' : '×'}</span><div><strong>Pregunta ${i + 1} · ${item.correct ? 'Correcta' : 'Para repasar'}</strong><p>Tu respuesta: ${esc(item.response || 'Sin respuesta')} · Respuesta esperada: ${esc(item.correctAnswer)}</p><small>${esc(item.explanation)}</small></div></div>`).join('')}</div></details><div class="bottom-actions"><button class="button button--primary" data-action="progress">Ver mi progreso ↗</button><button class="button button--outline" data-action="restart">Intentarlo de nuevo</button></div></div>`);
}
function progressScreen() {
  const attempts = state.attempts;
  const newest = attempts[0];
  shell(`<div class="progress-page"><button class="back-link" data-action="dashboard">← Volver al dashboard</button><div class="page-heading"><div><span class="eyebrow"><span class="dot"></span> YOUR JOURNEY SO FAR</span><h1>Tu progreso<span class="accent">.</span></h1><p>Cada intento es una nueva oportunidad para crecer.</p></div><div class="heading-number">03<span>/ 03</span></div></div>${attempts.length ? `<div class="progress-stats"><div><span>INTENTOS</span><strong>${attempts.length}</strong></div><div><span>MEJOR MARCA</span><strong>${Math.max(...attempts.map(a => a.score))}%</strong></div><div><span>ÚLTIMA MARCA</span><strong>${newest.score}%</strong></div></div><section class="history-section"><div class="section-head"><div><span class="eyebrow">THE JOURNEY CONTINUES</span><h2>Historial de intentos</h2></div></div>${attempts.map((a, i) => `<div class="history-item"><div class="history-index">${String(attempts.length - i).padStart(2, '0')}</div><div class="history-name"><strong>${esc(a.title)}</strong><span>${esc(formatDate(a.date))} · ${esc(a.level)} · ${a.correctCount}/10 correctas · ${a.rewards?.xp || 0} XP</span></div><div class="history-skills">${Object.entries(a.skills).map(([s, v]) => `<span>${esc(s)} ${v.percent}%</span>`).join('')}</div><strong class="history-score">${a.score}%</strong></div>`).join('')}</section>` : `<div class="empty-card empty-card--large"><span>✧</span><h2>Tu historia comienza aquí</h2><p>Termina una evaluación para ver cómo creces con cada intento.</p><button class="button button--primary" data-action="start">Comenzar →</button></div>`}<div class="bottom-actions"><button class="button button--primary" data-action="restart">${state.run && !state.run.result ? "Retomar expedición ↗" : "Nueva expedición ↗"}</button></div></div>`);
}
function formatDate(value) {
  const iso = value?.includes('T') ? value : value?.replace(' ', 'T') + 'Z';
  return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
function render() {
  const active = document.activeElement;
  const key = active?.name === 'response' ? active.value : null;
  ({ login, dashboard, assessment: assessmentScreen, result: resultScreen, progress: progressScreen })[state.screen]();
  if (key) [...document.querySelectorAll('[name="response"]')].find(el=>el.value===key)?.focus();
}
function focusScreen(selector = 'h1') {
  const el = app.querySelector(selector);
  if (el) { el.setAttribute('tabindex','-1'); el.focus({ preventScroll: selector === 'h1' }); if (selector === 'h1') window.scrollTo({ top: 0, behavior: 'instant' }); }
}
async function refreshHistory() { const [history, rewards] = await Promise.all([request('/api/attempts'), request('/api/rewards')]); state.attempts=history.attempts; state.rewards=rewards; }
async function prepareAssessment() {
  state.assessment = await request('/api/assessment');
  adoptRun((await request('/api/expedition')).expedition);
}
document.addEventListener('submit', async e => {
  if (!['login-form','answer-form'].includes(e.target.id)) return;
  e.preventDefault(); if (state.busy) return;
  unlockSound();
  let earnedFeedback = null;
  const formId=e.target.id;
  const credentials = formId==='login-form' ? { email:e.target.elements.email.value, password:e.target.elements.password.value } : null;
  const q = state.assessment?.questions[state.index];
  if (formId==='answer-form' && !state.answers[q.id]?.trim()) {
    flash('Selecciona o escribe una respuesta antes de confirmar.');
    (app.querySelector('[name="response"]') || app.querySelector('#fill-answer'))?.focus(); return;
  }
  if (credentials) state.credentials=credentials;
  state.busy=true; state.message=''; render();
  try {
    if (formId==='login-form') {
      state.user=(await request('/api/login',{method:'POST',body:JSON.stringify(credentials)})).user;
      await Promise.all([prepareAssessment(),refreshHistory()]); state.credentials=null; state.screen='dashboard';
    } else {
      state.run=await request('/api/expedition/'+state.run.id+'/answers',{method:'POST',body:JSON.stringify({questionId:q.id,value:state.answers[q.id]})});
      earnedFeedback=state.run.review.find(r=>r.id===q.id);
    }
  } catch(err) { state.message=err.message; }
  finally { state.busy=false; render(); if(earnedFeedback) celebrate(state.run.id, earnedFeedback); focusScreen(formId==='answer-form' ? (state.message?'.notice':'.answer-feedback') : 'h1'); }
});
document.addEventListener('change',e=>{
  if(e.target.name!=='response' || state.busy) return;
  state.answers[state.assessment.questions[state.index].id]=e.target.value;
  document.querySelectorAll('.choice').forEach(el=>el.classList.toggle('is-selected',el.querySelector('input').checked));
});
document.addEventListener('input',e=>{
  if(e.target.id==='fill-answer') state.answers[state.assessment.questions[state.index].id]=e.target.value;
});
document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-action]'); if(!button || state.busy) return;
  const action=button.dataset.action;
  stopSound();
  state.message=''; state.busy=true;
  try {
    if(action==='dismiss') state.message='';
    if(action==='dashboard') { await refreshHistory(); state.screen='dashboard'; }
    if(action==='start' || action==='restart') {
      adoptRun(await request('/api/expedition',{method:'POST'})); state.screen='assessment';
    }
    if(action==='recover') {
      adoptRun((await request('/api/expedition')).expedition); state.screen='assessment';
    }
    if(action==='continue') {
      if(state.index===9 && state.run.result) { state.result=state.run.result; state.screen='result'; }
      else state.index=Math.min(9,state.index+1);
    }
    if(action==='progress') { await refreshHistory(); state.screen='progress'; }
    if(action==='logout') {
      await request('/api/logout',{method:'POST'}); state.user=null; state.run=null; state.answers={}; state.screen='login';
    }
  } catch(err) { state.message=err.message; }
  finally { state.busy=false; render(); focusScreen(state.message?'.notice':'h1'); }
});
async function init() {
  try {
    state.user=(await request('/api/me')).user;
    await Promise.all([prepareAssessment(),refreshHistory()]);
    state.result=state.run?.result; state.screen=state.result?'result':state.run?'assessment':'dashboard';
  } catch(err) { state.screen='login'; if(!err.message.includes('Inicia sesión')) state.message=err.message; }
  render();
}
init();
