import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { db, verifyPassword } from './db.js';

const port = Number(process.env.PORT || 4173);
const root = resolve('public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
const error = (res, status, message) => json(res, status, { error: message });
const sha = value => createHash('sha256').update(value).digest('hex');
const loginFailures = new Map();

function userFromCookie(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('ga_session='))?.slice(11);
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  return db.prepare(`SELECT users.id,users.name,users.email,users.role FROM sessions
    JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?`).get(sha(raw), Date.now()) || null;
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32_000) throw new Error('Solicitud demasiado grande.');
  }
  try { return JSON.parse(raw); } catch { throw new Error('JSON inválido.'); }
}
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });

function assessmentForClient() {
  const row = db.prepare('SELECT id,title,level,description,minutes FROM assessments WHERE active = 1 ORDER BY id LIMIT 1').get();
  if (!row) return null;
  const items = db.prepare('SELECT id,type,skill,level,prompt,options_json,passage FROM questions WHERE assessment_id = ? ORDER BY position').all(row.id)
    .map(q => ({
      id: q.id, type: q.type, skill: q.skill, level: q.level, prompt: q.prompt,
      ...(q.options_json ? { options: JSON.parse(q.options_json) } : {}), ...(q.passage ? { passage: q.passage } : {})
    }));
  return { ...row, questions: items };
}

function interpretation(score) {
  if (score >= 80) return { title: '¡Listo para el siguiente horizonte!', detail: 'Buen dominio de este diagnóstico A2. Te recomendamos explorar retos B1.', tone: 'high' };
  if (score >= 50) return { title: 'Tu ruta A2 está tomando forma', detail: 'Ya tienes una base. Practica las habilidades con menor puntuación y vuelve a intentarlo.', tone: 'medium' };
  return { title: 'Una gran aventura comienza aquí', detail: 'Empieza reforzando fundamentos A1 antes de repetir este diagnóstico A2.', tone: 'low' };
}
function feedbackFor(skills) {
  const weakest = Object.entries(skills).sort((a, b) => a[1].percent - b[1].percent)[0];
  const tips = {
    Grammar: 'Repasa comparativos, tiempos verbales y conectores con ejemplos de tu día a día.',
    Reading: 'Lee mensajes cortos en inglés e identifica quién, dónde y cuándo antes de responder.',
    Vocabulary: 'Aprende tres palabras nuevas al día y úsalas en una oración propia.'
  };
  return `Tu siguiente paso: ${weakest?.[0] || 'Grammar'}. ${tips[weakest?.[0]] || tips.Grammar}`;
}

function submit(user, payload) {
  const assessment = assessmentForClient();
  if (!assessment || payload?.assessmentId !== assessment.id || !Array.isArray(payload.answers)) throw new Error('Evaluación o respuestas inválidas.');
  const rows = db.prepare('SELECT id,skill,type,options_json,correct_answer,explanation FROM questions WHERE assessment_id = ? ORDER BY position').all(assessment.id);
  if (payload.answers.length !== rows.length) throw new Error(`Envía exactamente ${rows.length} respuestas (pueden estar vacías).`);
  const provided = new Map();
  for (const answer of payload.answers) {
    if (!answer || typeof answer.id !== 'string' || typeof answer.value !== 'string' || answer.value.length > 200 || provided.has(answer.id)) throw new Error('Formato de respuestas inválido.');
    provided.set(answer.id, answer.value.trim());
  }
  if (rows.some(q => !provided.has(q.id))) throw new Error('Faltan preguntas de la evaluación.');
  const skills = {};
  const review = rows.map(q => {
    const response = provided.get(q.id);
    const correct = response.toLocaleLowerCase('en').replace(/\s+/g, ' ') === q.correct_answer.toLocaleLowerCase('en');
    const current = skills[q.skill] ||= { correct: 0, total: 0, percent: 0 };
    current.total++;
    current.correct += Number(correct);
    return { id: q.id, response, correct, correctAnswer: q.correct_answer, explanation: q.explanation };
  });
  for (const skill of Object.values(skills)) skill.percent = Math.round(skill.correct / skill.total * 100);
  const correctCount = review.filter(q => q.correct).length;
  const score = Math.round(correctCount / rows.length * 100);
  const message = feedbackFor(skills);
  const outcome = interpretation(score);
  db.exec('BEGIN IMMEDIATE');
  try {
    const id = db.prepare(`INSERT INTO attempts (user_id,assessment_id,score_percent,correct_count,incorrect_count,skills_json,feedback,interpretation)
      VALUES (?,?,?,?,?,?,?,?)`).run(user.id, assessment.id, score, correctCount, rows.length - correctCount, JSON.stringify(skills), message, JSON.stringify(outcome)).lastInsertRowid;
    const insert = db.prepare('INSERT INTO attempt_answers (attempt_id,question_id,response,is_correct) VALUES (?,?,?,?)');
    review.forEach(r => insert.run(id, r.id, r.response, Number(r.correct)));
    db.exec('COMMIT');
    return { id: Number(id), score, correctCount, incorrectCount: rows.length - correctCount, skills, feedback: message, interpretation: outcome, review };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

function history(user) {
  return db.prepare(`SELECT a.id,a.created_at,a.score_percent,a.correct_count,a.incorrect_count,a.skills_json,
    b.title,b.level FROM attempts a JOIN assessments b ON b.id = a.assessment_id
    WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 20`).all(user.id).map(a => ({
    id: a.id, date: a.created_at, score: a.score_percent, correctCount: a.correct_count,
    incorrectCount: a.incorrect_count, skills: JSON.parse(a.skills_json), title: a.title, level: a.level
  }));
}

async function api(req, res, url) {
  if (req.method === 'POST' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return error(res, 403, 'Origen no autorizado.');
  if (url.pathname === '/api/login' && req.method === 'POST') {
    const ip = req.socket.remoteAddress;
    const rate = loginFailures.get(ip) || { count: 0, until: 0 };
    if (rate.count >= 8 && rate.until > Date.now()) return error(res, 429, 'Demasiados intentos. Vuelve a probar en 15 minutos.');
    const data = await body(req);
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (!email || !password || password.length > 256) return error(res, 400, 'Introduce correo y contraseña válidos.');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, user)) {
      loginFailures.set(ip, { count: rate.count + 1, until: Date.now() + 15 * 60_000 });
      return error(res, 401, 'Correo o contraseña incorrectos.');
    }
    loginFailures.delete(ip);
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(sha(token), user.id, Date.now() + 12 * 3600_000);
    res.setHeader('Set-Cookie', `ga_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${req.socket.encrypted ? '; Secure' : ''}`);
    return json(res, 200, { user: publicUser(user) });
  }
  const user = userFromCookie(req);
  if (!user) return error(res, 401, 'Inicia sesión para continuar.');
  if (url.pathname === '/api/me' && req.method === 'GET') return json(res, 200, { user: publicUser(user) });
  if (url.pathname === '/api/logout' && req.method === 'POST') {
    const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('ga_session='))?.slice(11);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
    res.setHeader('Set-Cookie', 'ga_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/assessment' && req.method === 'GET') return json(res, 200, assessmentForClient());
  if (url.pathname === '/api/attempts' && req.method === 'GET') return json(res, 200, { attempts: history(user) });
  if (url.pathname === '/api/attempts' && req.method === 'POST') {
    try { return json(res, 201, submit(user, await body(req))); }
    catch (e) { return error(res, 400, e.message); }
  }
  return error(res, 404, 'Ruta no encontrada.');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return error(res, 405, 'Método no permitido.');
    const pathname = decodeURIComponent(url.pathname);
    const filename = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(root + sep)) return error(res, 403, 'Acceso denegado.');
    const content = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (e) {
    if (e.code === 'ENOENT') return error(res, 404, 'Página no encontrada.');
    if (e.message === 'JSON inválido.' || e.message === 'Solicitud demasiado grande.') return error(res, 400, e.message);
    console.error(e);
    return error(res, 500, 'Ocurrió un error interno.');
  }
});
server.listen(port, () => console.log(`Global AI Assessment listo en http://localhost:${port}`));
