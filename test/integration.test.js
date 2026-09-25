import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

test('autenticación, protección de respuestas, calificación y progreso', async t => {
  const temp = mkdtempSync(join(tmpdir(), 'global-ai-'));
  const port = 18000 + Math.floor(Math.random() * 10000);
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port), DB_PATH: join(temp, 'test.sqlite') }, stdio: 'pipe'
  });
  t.after(() => { server.kill(); rmSync(temp, { recursive: true, force: true }); });
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(base + '/api/assessment'); if (r.status === 401) { ready = true; break; } } catch { }
    await delay(100);
  }
  assert.ok(ready, 'el servidor debe arrancar');
  let r = await fetch(base + '/api/assessment'); assert.equal(r.status, 401);
  r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'estudiante@globalai.demo', password: 'incorrecta' }) });
  assert.equal(r.status, 401);
  r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'estudiante@globalai.demo', password: 'GlobalAI2026!' }) });
  assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const headers = { Cookie: cookie, 'Content-Type': 'application/json' };
  r = await fetch(base + '/api/assessment', { headers });
  const a = await r.json();
  assert.equal(a.questions.length, 10);
  assert.deepEqual(Object.groupBy(a.questions, q => q.type).multiple_choice.length, 4);
  assert.equal(a.questions.filter(q => q.type === 'fill').length, 2);
  assert.equal(a.questions.filter(q => q.type === 'comprehension').length, 2);
  assert.equal(a.questions.filter(q => q.type === 'vocabulary').length, 2);
  assert.ok(!JSON.stringify(a).includes('correct_answer'));
  assert.ok(!JSON.stringify(a).includes('explanation'));
  r = await fetch(base + '/api/attempts', { method: 'POST', headers, body: JSON.stringify({ assessmentId: a.id, answers: [{ id: 'g1', value: 'takes' }] }) });
  assert.equal(r.status, 400);
  const correct = { g1: 'takes', g2: 'were having', g3: 'any', g4: 'more interesting', g5: 'will', g6: 'since', r1: 'At the café across the street', r2: 'He bought the tickets online', v1: 'hurry', v2: 'cheap enough' };
  r = await fetch(base + '/api/attempts', {
    method: 'POST', headers, body: JSON.stringify({
      assessmentId: a.id, score: 100,
      answers: a.questions.map(q => ({ id: q.id, value: correct[q.id] }))
    })
  });
  assert.equal(r.status, 201);
  const perfect = await r.json();
  assert.equal(perfect.score, 100);
  assert.equal(perfect.skills.Grammar.percent, 100);
  assert.equal(perfect.skills.Reading.percent, 100);
  r = await fetch(base + '/api/attempts', {
    method: 'POST', headers, body: JSON.stringify({
      assessmentId: a.id, score: 100,
      answers: a.questions.map(q => ({ id: q.id, value: '' }))
    })
  });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).score, 0, 'el servidor ignora una puntuación enviada por el cliente');
  r = await fetch(base + '/api/attempts', { headers });
  const history = (await r.json()).attempts;
  assert.equal(history.length, 2);
  assert.equal(history[0].score, 0);
  assert.equal(history[1].score, 100);
  await fetch(base + '/api/logout', { method: 'POST', headers });
  r = await fetch(base + '/api/attempts', { headers }); assert.equal(r.status, 401);
});
