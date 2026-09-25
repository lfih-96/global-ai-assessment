const app = document.querySelector('#app');
const topUser = document.querySelector('#top-user');
const state = { user: null, assessment: null, attempts: [], answers: {}, index: 0, screen: 'login', result: null, busy: false, message: '' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const skillIcons = { Grammar: '◈', Reading: '▤', Vocabulary: '✦' };
async function request(path, options = {}) {
  let response;
  try { response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options }); }
  catch { throw new Error('Sin conexión con el servidor. Comprueba tu red e inténtalo de nuevo.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}
const draftKey = () => `global-ai:draft:${state.user?.id}:${state.assessment?.id}`;
function saveDraft() { try { localStorage.setItem(draftKey(), JSON.stringify(state.answers)); } catch { } }
function loadDraft() {
  try {
    const stored = JSON.parse(localStorage.getItem(draftKey()) || '{}');
    state.answers = Object.fromEntries(state.assessment.questions.map(q => [q.id, typeof stored[q.id] === 'string' ? stored[q.id] : '']));
  } catch { state.answers = {}; }
}
function clearDraft() { try { localStorage.removeItem(draftKey()); } catch { } }
function completedCount() { return state.assessment.questions.filter(q => (state.answers[q.id] || '').trim()).length; }
const flash = msg => { state.message = msg; render(); };

function shell(content) {
  topUser.innerHTML = state.user ? `<div class="user-chip"><span class="avatar">${esc(state.user.name[0])}</span><span class="user-name">${esc(state.user.name)}</span><button type="button" class="text-button" data-action="logout">Salir</button></div>` : '<span class="top-tag">YOUR ENGLISH JOURNEY STARTS HERE ✦</span>';
  app.innerHTML = (state.message ? `<div class="notice" role="alert">${esc(state.message)}<button data-action="dismiss" aria-label="Cerrar aviso">×</button></div>` : '') + content;
}
function login() {
  shell(`<section class="login-layout"><div class="login-story"><div class="eyebrow"><span class="dot"></span> WELCOME TO THE LAB</div><h1>Your English<br><em>journey starts here.</em></h1><p>Una evaluación breve. Una ruta diseñada para ti. Descubre dónde estás y hacia dónde puedes llegar.</p><div class="orbit-scene" aria-hidden="true"><div class="orbit orbit--outer"></div><div class="orbit orbit--inner"></div><div class="planet">G<span>✦</span></div><div class="orbit-label orbit-label--one">GROW</div><div class="orbit-label orbit-label--two">EXPLORE</div><div class="orbit-star">✦</div></div><div class="story-foot"><span>01 / DISCOVER</span><span>02 / LEARN</span><span>03 / GROW</span></div></div><div class="login-panel"><div class="panel-kicker">STUDENT PORTAL <span>01 — 03</span></div><h2>Bienvenido a bordo<span class="accent">.</span></h2><p>Inicia sesión para continuar tu expedición.</p><form id="login-form"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" autocomplete="username" required placeholder="tu@correo.com" value="estudiante@globalai.demo"/><label for="password">Contraseña</label><input id="password" name="password" type="password" autocomplete="current-password" required placeholder="Tu contraseña" value="GlobalAI2026!"/><button class="button button--primary button--wide" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Ingresando…' : 'Comenzar expedición <span aria-hidden="true">↗</span>'}</button></form><div class="demo-box"><span class="demo-icon">✧</span><div><strong>Acceso de demostración</strong><span>Las credenciales están precargadas para explorar el prototipo.</span></div></div></div></section>`);
}
function dashboard() {
  const latest = state.attempts[0];
  const best = state.attempts.length ? Math.max(...state.attempts.map(a => a.score)) : null;
  const firstName = state.user.name.split(' ')[0];
  const filled = completedCount();
  shell(`<div class="page-heading"><div><div class="eyebrow"><span class="dot"></span> STUDENT DASHBOARD</div><h1>Hola, ${esc(firstName)} <span class="wave">✳</span></h1><p>Tu próxima aventura en inglés está lista para comenzar.</p></div><div class="heading-number">01<span>/ 03</span></div></div><div class="dashboard-grid"><section class="hero-card"><div class="hero-content"><div class="card-label">✦ NUEVA MISIÓN DISPONIBLE <span>A2 · 10 RETOS</span></div><div class="hero-copy"><span class="mini-rule"></span><h2>The English<br><em>Expedition</em></h2><p>Viaja por situaciones cotidianas. Descubre tus fortalezas en Grammar, Reading y Vocabulary.</p><div class="hero-meta"><span>◷ 12 MINUTOS</span><span>◎ 3 HABILIDADES</span></div><button class="button button--light" data-action="start">${filled ? `Continuar misión (${filled}/10)` : 'Empezar evaluación'} <span aria-hidden="true">↗</span></button></div></div><div class="hero-graphic" aria-hidden="true"><div class="graphic-ring graphic-ring--one"></div><div class="graphic-ring graphic-ring--two"></div><div class="graphic-core">A<span>2</span></div><span class="graphic-star">✦</span><span class="graphic-caption">THE JOURNEY<br>IS YOURS</span></div></section><div class="side-column"><section class="metric-card"><div class="card-label dark">TU BRÚJULA <span>↗</span></div><div class="metrics"><div><strong>${state.attempts.length}</strong><span>Misiones<br>completadas</span></div><div><strong>${best === null ? '—' : best + '%'}</strong><span>Tu mejor<br>resultado</span></div></div><p>${latest ? `Última evaluación: ${esc(formatDate(latest.date))}` : 'Tu historia empieza con tu primera evaluación.'}</p></section><section class="quote-card"><span class="quote-mark">“</span><p>Every expert was once a beginner.</p><span>KEEP GOING, ONE STEP AT A TIME ✦</span></section></div></div><section class="section-block"><div class="section-head"><div><span class="eyebrow">YOUR LEARNING MAP</span><h2>Progreso reciente</h2></div><button class="text-link" data-action="progress">Ver historial completo ↗</button></div>${latest ? `<div class="latest-card"><div class="latest-icon">✦</div><div><strong>${esc(latest.title)}</strong><span>${esc(formatDate(latest.date))} · ${esc(latest.level)}</span></div><strong class="latest-score">${latest.score}%</strong><button class="icon-arrow" data-action="progress" aria-label="Ver progreso">↗</button></div>` : `<div class="empty-card"><span>✧</span><p>Aún no tienes intentos registrados. ¡Tu primer paso te espera!</p></div>`}</section>`);
}
function assessmentScreen() {
  const a = state.assessment, q = a.questions[state.index], n = a.questions.length, count = completedCount();
  const passage = q.passage ? `<div class="passage"><span>READ THE MESSAGE</span><p>${esc(q.passage)}</p></div>` : '';
  const choices = q.options ? `<div class="choices">${q.options.map((value, i) => `<label class="choice ${state.answers[q.id] === value ? 'is-selected' : ''}"><input type="radio" name="response" value="${esc(value)}" ${state.answers[q.id] === value ? 'checked' : ''}/><span class="choice-letter">${String.fromCharCode(65 + i)}</span><span>${esc(value)}</span><span class="choice-indicator">✓</span></label>`).join('')}</div>` : `<label class="fill-label" for="fill-answer">YOUR ANSWER</label><input id="fill-answer" class="fill-input" type="text" maxlength="200" autocomplete="off" placeholder="Escribe una palabra en inglés…" value="${esc(state.answers[q.id] || '')}"/>`;
  shell(`<div class="assessment-wrap"><div class="assessment-top"><button class="back-link" data-action="dashboard">← Guardar y salir</button><span>THE ENGLISH EXPEDITION <b>·</b> A2</span><span class="count-pill">${count}/${n} RESPONDIDAS</span></div><div class="step-track" aria-label="Progreso de la evaluación">${a.questions.map((item, i) => `<button data-action="jump" data-index="${i}" title="Pregunta ${i + 1}" aria-label="Ir a la pregunta ${i + 1}" class="step ${i === state.index ? 'step--active' : ''} ${state.answers[item.id]?.trim() ? 'step--done' : ''}"></button>`).join('')}</div><div class="question-layout"><div class="question-context"><span class="eyebrow">CHECKPOINT ${String(state.index + 1).padStart(2, '0')} / ${n}</span><div class="big-step">${String(state.index + 1).padStart(2, '0')}<span>.</span></div><div class="context-line"></div><div class="context-skill">${skillIcons[q.skill] || '✦'} ${esc(q.skill.toUpperCase())}</div><p>${q.skill === 'Grammar' ? 'Construye el significado, una palabra a la vez.' : q.skill === 'Reading' ? 'Encuentra las pistas dentro del texto.' : 'Cada palabra abre una nueva puerta.'}</p><div class="context-decoration" aria-hidden="true">✳</div></div><section class="question-card"><div class="question-head"><span>${esc(q.type.replace('_', ' ').toUpperCase())}</span><span>LEVEL ${esc(q.level)}</span></div>${passage}<h1>${esc(q.prompt)}</h1>${choices}<div class="question-actions"><button class="button button--outline" data-action="previous" ${state.index === 0 ? 'disabled' : ''}>← Anterior</button>${state.index < n - 1 ? `<button class="button button--primary" data-action="next">Siguiente reto →</button>` : `<button class="button button--primary" data-action="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Enviando…' : 'Finalizar misión ✦'}</button>`}</div><div class="question-note">Tu progreso se guarda en este dispositivo mientras completas la misión.</div></section></div></div>`);
}
function resultScreen() {
  const r = state.result;
  shell(`<div class="result-page"><div class="eyebrow"><span class="dot"></span> MISSION COMPLETE</div><div class="result-hero"><div><span class="result-kicker">RESULTADO DE TU EXPEDICIÓN</span><h1>Un paso más<br><em>hacia tu futuro.</em></h1><p>Completaste los 10 retos del diagnóstico A2. Aquí empieza tu siguiente capítulo.</p></div><div class="score-ring" style="--score:${r.score}%"><div><strong>${r.score}<small>%</small></strong><span>GLOBAL SCORE</span></div></div></div><div class="result-grid"><section class="result-card result-card--wide"><div class="card-label dark">TU MAPA DE HABILIDADES <span>↗</span></div>${Object.entries(r.skills).map(([name, val]) => `<div class="skill-row"><span class="skill-name"><i>${skillIcons[name] || '✦'}</i>${esc(name)}</span><div class="skill-bar"><div style="width:${val.percent}%"></div></div><strong>${val.percent}%</strong></div>`).join('')}</section><section class="result-card tally-card"><div class="card-label dark">EN NÚMEROS</div><div class="tally"><div><span>RESPUESTAS CORRECTAS</span><strong>${r.correctCount}<small>/10</small></strong></div><div><span>POR REFORZAR</span><strong>${r.incorrectCount}<small>/10</small></strong></div></div></section></div><section class="coach-card"><div class="coach-symbol">✦</div><div><span>GLOBAL AI · ENGLISH COACH</span><h2>${esc(r.interpretation.title)}</h2><p>${esc(r.interpretation.detail)} ${esc(r.feedback)}</p><small>Feedback educativo basado en reglas. No es una certificación oficial del MCER.</small></div></section><details class="review"><summary>Revisar respuestas y explicaciones <span>＋</span></summary><div class="review-list">${r.review.map((item, i) => `<div class="review-item"><span class="review-status ${item.correct ? 'correct' : 'wrong'}">${item.correct ? '✓' : '×'}</span><div><strong>Pregunta ${i + 1} · ${item.correct ? 'Correcta' : 'Para repasar'}</strong><p>Tu respuesta: ${esc(item.response || 'Sin respuesta')} · Respuesta esperada: ${esc(item.correctAnswer)}</p><small>${esc(item.explanation)}</small></div></div>`).join('')}</div></details><div class="bottom-actions"><button class="button button--primary" data-action="progress">Ver mi progreso ↗</button><button class="button button--outline" data-action="restart">Intentarlo de nuevo</button></div></div>`);
}
function progressScreen() {
  const attempts = state.attempts;
  const newest = attempts[0];
  shell(`<div class="progress-page"><button class="back-link" data-action="dashboard">← Volver al dashboard</button><div class="page-heading"><div><span class="eyebrow"><span class="dot"></span> YOUR JOURNEY SO FAR</span><h1>Tu progreso<span class="accent">.</span></h1><p>Cada intento es una nueva oportunidad para crecer.</p></div><div class="heading-number">03<span>/ 03</span></div></div>${attempts.length ? `<div class="progress-stats"><div><span>INTENTOS</span><strong>${attempts.length}</strong></div><div><span>MEJOR MARCA</span><strong>${Math.max(...attempts.map(a => a.score))}%</strong></div><div><span>ÚLTIMA MARCA</span><strong>${newest.score}%</strong></div></div><section class="history-section"><div class="section-head"><div><span class="eyebrow">THE JOURNEY CONTINUES</span><h2>Historial de intentos</h2></div></div>${attempts.map((a, i) => `<div class="history-item"><div class="history-index">${String(attempts.length - i).padStart(2, '0')}</div><div class="history-name"><strong>${esc(a.title)}</strong><span>${esc(formatDate(a.date))} · ${esc(a.level)} · ${a.correctCount}/10 correctas</span></div><div class="history-skills">${Object.entries(a.skills).map(([s, v]) => `<span>${esc(s)} ${v.percent}%</span>`).join('')}</div><strong class="history-score">${a.score}%</strong></div>`).join('')}</section>` : `<div class="empty-card empty-card--large"><span>✧</span><h2>Tu historia comienza aquí</h2><p>Termina una evaluación para ver cómo creces con cada intento.</p><button class="button button--primary" data-action="start">Comenzar →</button></div>`}<div class="bottom-actions"><button class="button button--primary" data-action="restart">Nueva expedición ↗</button></div></div>`);
}
function formatDate(value) {
  const iso = value?.includes('T') ? value : value?.replace(' ', 'T') + 'Z';
  return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
function render() { ({ login, dashboard, assessment: assessmentScreen, result: resultScreen, progress: progressScreen })[state.screen](); }
async function refreshHistory() { state.attempts = (await request('/api/attempts')).attempts; }
async function prepareAssessment() { state.assessment = await request('/api/assessment'); loadDraft(); }

document.addEventListener('submit', async e => {
  if (e.target.id !== 'login-form') return;
  e.preventDefault(); if (state.busy) return;
  const credentials = { email: e.target.elements.email.value, password: e.target.elements.password.value };
  state.busy = true; state.message = ''; render();
  try {
    const data = await request('/api/login', { method: 'POST', body: JSON.stringify(credentials) });
    state.user = data.user; await Promise.all([prepareAssessment(), refreshHistory()]); state.screen = 'dashboard';
  } catch (err) { state.message = err.message; }
  finally { state.busy = false; render(); }
});
document.addEventListener('change', e => {
  if (e.target.name !== 'response') return;
  const q = state.assessment.questions[state.index]; state.answers[q.id] = e.target.value; saveDraft(); render();
});
document.addEventListener('input', e => {
  if (e.target.id !== 'fill-answer') return;
  state.answers[state.assessment.questions[state.index].id] = e.target.value; saveDraft();
});
document.addEventListener('click', async e => {
  const button = e.target.closest('[data-action]'); if (!button || state.busy) return;
  const action = button.dataset.action;
  state.message = '';
  try {
    if (action === 'dismiss') state.message = '';
    if (action === 'dashboard') state.screen = 'dashboard';
    if (action === 'start') { state.index = 0; state.screen = 'assessment'; }
    if (action === 'restart') { state.answers = {}; state.index = 0; clearDraft(); state.screen = 'assessment'; }
    if (action === 'previous') state.index = Math.max(0, state.index - 1);
    if (action === 'next') state.index = Math.min(state.assessment.questions.length - 1, state.index + 1);
    if (action === 'jump') state.index = Number(button.dataset.index);
    if (action === 'progress') { await refreshHistory(); state.screen = 'progress'; }
    if (action === 'logout') { await request('/api/logout', { method: 'POST' }); state.user = null; state.assessment = null; state.screen = 'login'; }
    if (action === 'submit') {
      const missing = state.assessment.questions.length - completedCount();
      if (missing && !confirm(`Tienes ${missing} respuesta(s) sin completar. Se contarán como incorrectas. ¿Enviar de todos modos?`)) return;
      state.busy = true; render();
      state.result = await request('/api/attempts', {
        method: 'POST', body: JSON.stringify({
          assessmentId: state.assessment.id,
          answers: state.assessment.questions.map(q => ({ id: q.id, value: state.answers[q.id] || '' }))
        })
      });
      clearDraft(); state.answers = {}; await refreshHistory(); state.screen = 'result';
    }
    render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) { flash(err.message); }
  finally { state.busy = false; if (action === 'submit') render(); }
});

async function init() {
  try { const data = await request('/api/me'); state.user = data.user; await Promise.all([prepareAssessment(), refreshHistory()]); state.screen = 'dashboard'; }
  catch { state.screen = 'login'; }
  render();
}
init();
