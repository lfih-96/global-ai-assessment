import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { questions } from '../server/questions.js';

test('expedición persistente, segura e idempotente', async t => {
  const temp = mkdtempSync(join(tmpdir(), 'global-ai-'));
  const port = 18000 + Math.floor(Math.random() * 10000);
  const base = `http://127.0.0.1:${port}`;
  const dbPath = join(temp, 'test.sqlite');
  let server;
  async function start() {
    server = spawn(process.execPath, ['server/index.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), DB_PATH: dbPath }, stdio: 'pipe' });
    for(let i=0;i<60;i++) {
      try { if((await fetch(base+'/api/me')).status===401) return; } catch {}
      await delay(50);
    }
    throw new Error('El servidor no arrancó');
  }
  async function stop() { const closed=once(server,'exit'); server.kill(); await closed; }
  t.after(async()=>{ if(server.exitCode===null) await stop(); rmSync(temp,{recursive:true,force:true}); });
  await start();
  let headers = { 'Content-Type':'application/json' };
  async function api(path, method='GET', body, extra={}) {
    const r=await fetch(base+path,{method,headers:{...headers,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:r.status,data:await r.json(),headers:r.headers};
  }
  await t.test('autenticación, origen y contrato de diez preguntas',async()=>{
    assert.equal((await api('/api/expedition')).status,401);
    assert.equal((await api('/api/login','POST',{email:'estudiante@globalai.demo',password:'bad'})).status,401);
    const login=await api('/api/login','POST',{email:'estudiante@globalai.demo',password:'GlobalAI2026!'});
    assert.equal(login.status,200);
    headers.Cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await api('/api/expedition','POST',{}, {Origin:'https://evil.example'})).status,403);
    const a=(await api('/api/assessment')).data;
    assert.equal(a.questions.length,10);
    assert.deepEqual(a.questions.reduce((acc,q)=>(acc[q.type]=(acc[q.type]||0)+1,acc),{}),{multiple_choice:4,fill:2,comprehension:2,vocabulary:2});
    assert.ok(!JSON.stringify(a).match(/correct|explanation/));
    assert.equal((await api('/api/attempts','POST',{answers:[]})).status,410);
    assert.equal((await api('/server/questions.js')).status,404);
  });
  let run;
  await t.test('inicio concurrente, validación y respuestas sin revelar',async()=>{
    const starts=await Promise.all([api('/api/expedition','POST'),api('/api/expedition','POST')]);
    assert.equal(starts[0].data.id,starts[1].data.id);
    run=starts[0].data;
    assert.deepEqual(run.review,[]);
    assert.equal(run.result,null);
    for(const payload of [null,{}, {questionId:'g1',value:''},{questionId:'g1',value:'invented'},{questionId:'g2',value:'had'},{questionId:'g1',value:'x'.repeat(201)}]) {
      assert.equal((await api(`/api/expedition/${run.id}/answers`,'POST',payload)).status,400);
    }
    assert.equal((await api('/api/expedition')).data.expedition.answered,0);
  });
  await t.test('confirmación única, conflicto y recuperación tras reiniciar servidor',async()=>{
    const payload={questionId:'g1',value:'takes',score:0};
    const copies=await Promise.all([api(`/api/expedition/${run.id}/answers`,'POST',payload),api(`/api/expedition/${run.id}/answers`,'POST',payload)]);
    assert.deepEqual(copies[0].data,copies[1].data);
    assert.equal(copies[0].data.answered,1);
    assert.equal(copies[0].data.review[0].correct,true);
    assert.equal(copies[0].data.review[0].correctAnswer,'takes');
    assert.equal((await api(`/api/expedition/${run.id}/answers`,'POST',{questionId:'g1',value:'take'})).status,400);
    await stop(); await start();
    assert.deepEqual((await api('/api/expedition')).data.expedition,copies[0].data);
    assert.equal((await api('/api/attempts')).data.attempts.length,0);
  });
  await t.test('aislamiento entre usuarios',async()=>{
    const db=new DatabaseSync(dbPath);
    db.exec("INSERT INTO users(name,email,password_salt,password_hash) SELECT 'Other','other@demo.test',password_salt,password_hash FROM users LIMIT 1");
    db.close();
    const login=await api('/api/login','POST',{email:'other@demo.test',password:'GlobalAI2026!'});
    const other={Cookie:login.headers.get('set-cookie').split(';')[0]};
    assert.equal((await api('/api/expedition','GET',undefined,other)).data.expedition,null);
    assert.equal((await api(`/api/expedition/${run.id}/answers`,'POST',{questionId:'g1',value:'takes'},other)).status,400);
    assert.deepEqual((await api('/api/attempts','GET',undefined,other)).data.attempts,[]);
  });
  await t.test('nota mixta del servidor y finalización repetida sin duplicados',async()=>{
    for(const q of questions.slice(1)) {
      const value=q.id==='g2'?'had':q.id==='g5'?' WILL ':q.correct;
      if(q.id==='v2') {
        const db=new DatabaseSync(dbPath);
        db.exec("CREATE TRIGGER fail_result BEFORE INSERT ON attempts BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END");
        const failed=await api(`/api/expedition/${run.id}/answers`,'POST',{questionId:q.id,value});
        assert.equal(failed.status,500);
        assert.equal((await api('/api/expedition')).data.expedition.answered,9);
        assert.equal((await api('/api/attempts')).data.attempts.length,0);
        db.exec('DROP TRIGGER fail_result'); db.close();
      }
      const response=await api(`/api/expedition/${run.id}/answers`,'POST',{questionId:q.id,value,score:100,correct:true});
      assert.equal(response.status,200);
      assert.equal(response.data.review.length,questions.indexOf(q)+1);
      assert.equal(response.data.result===null,q.id!=='v2');
      run=response.data;
    }
    assert.equal(run.result.score,90);
    assert.equal(run.result.correctCount,9);
    assert.equal(run.result.skills.Grammar.percent,83);
    assert.equal(run.result.skills.Reading.percent,100);
    const duplicate=await api(`/api/expedition/${run.id}/answers`,'POST',{questionId:'v2',value:'cheap enough'});
    assert.deepEqual(duplicate.data,run);
    await stop(); await start();
    assert.deepEqual((await api('/api/expedition')).data.expedition,run);
    assert.equal((await api('/api/attempts')).data.attempts.length,1);
  });
  await t.test('0% y 100%, historial y revocación de sesión',async()=>{
    for(const perfect of [false,true]) {
      const next=(await api('/api/expedition','POST')).data;
      assert.notEqual(next.id,run.id);
      for(const q of questions) {
        const value=perfect?q.correct:(q.options?.find(o=>o!==q.correct)||'incorrect');
        run=(await api(`/api/expedition/${next.id}/answers`,'POST',{questionId:q.id,value,score:100})).data;
      }
      assert.equal(run.result.score,perfect?100:0);
    }
    assert.deepEqual((await api('/api/attempts')).data.attempts.map(a=>a.score),[100,0,90]);
    await api('/api/logout','POST');
    assert.equal((await api('/api/expedition')).status,401);
    assert.equal((await api('/api/attempts')).status,401);
  });
});
