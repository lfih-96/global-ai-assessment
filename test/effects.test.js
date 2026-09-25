import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/effects.js', import.meta.url), 'utf8').replace("import { showMascot } from './mascot.js';", "const showMascot = correct => window.mascots.push(correct);");
let sequence = 0;
async function harness(saved, { reduced = false, unsupported = false, blockedStorage = false } = {}) {
  const calls = { contexts: 0, notes: [], classes: [], resumes: 0 };
  const makeElement = () => ({ textContent: '', value: '', handlers: {}, setAttribute(name,value) { this[name]=value; }, addEventListener(name,fn) { this.handlers[name]=fn; } });
  const toggle=makeElement(), volume=makeElement(), status=makeElement(), output=makeElement();
  const controls={ querySelector: s=>({'#sound-toggle':toggle,'#sound-volume':volume,'#sound-status':status,output})[s] };
  const trail={ style:{setProperty(){}},classList:{add(name){calls.classes.push(name);}},getBoundingClientRect:()=>({x:100,y:300}),addEventListener(){},remove(){} };
  const card={ classList:{add(name){calls.classes.push(name);}},querySelector:()=>trail };
  class Audio {
    constructor() { calls.contexts++; this.currentTime=1; this.state='suspended'; this.destination={}; }
    resume() { calls.resumes++; this.state='running'; return Promise.resolve(); }
    createGain() { return {gain:{setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}; }
    createOscillator() {
      const note={frequency:{},connect(){},disconnect(){},start(time){this.startTime=time;},stop(time){this.stopTime=time;}};
      calls.notes.push(note); return note;
    }
  }
  globalThis.window={mascots:[],AudioContext:unsupported?undefined:Audio,matchMedia:()=>({matches:reduced})};
  globalThis.document={querySelector:s=>s==='#sound-controls'?controls:s==='.question-card'?card:{getBoundingClientRect:()=>({x:200,y:20,width:30,height:30})}};
  let storage = saved;
  globalThis.localStorage={getItem(){if(blockedStorage) throw Error('denied'); return storage;},setItem(k,v){if(blockedStorage) throw Error('denied'); storage=v;}};
  const effects=await import('data:text/javascript;base64,'+Buffer.from(source+`\n// instance ${sequence++}`).toString('base64'));
  return {effects,calls,toggle,volume,status,get saved(){return storage;}};
}

test('efectos: silencio inicial, interacción, volumen, notas y preferencias', async()=>{
  const h=await harness(null);
  h.effects.unlockSound(); h.effects.celebrate(1,{id:'g1',correct:true});
  assert.equal(h.calls.contexts,0,'no se crea AudioContext al cargar ni con sonido apagado');
  assert.equal(h.toggle['aria-pressed'],'false');
  h.toggle.handlers.click();
  assert.equal(h.calls.contexts,1);
  h.effects.celebrate(1,{id:'g2',correct:true});
  assert.deepEqual(h.calls.notes.map(n=>n.frequency.value),[523.25,659.25,783.99]);
  assert.ok(h.calls.notes.every(n=>n.stopTime-n.startTime<0.2));
  h.effects.celebrate(1,{id:'g2',correct:true});
  assert.equal(h.calls.notes.length,3,'el mismo feedback no repite el efecto');
  assert.equal(window.mascots.length,2,'una mascota por confirmación, incluso con sonido apagado');
  const trails=h.calls.classes.filter(c=>c==='is-travelling').length;
  h.effects.celebrate(1,{id:'g3',correct:false});
  assert.equal(h.calls.classes.filter(c=>c==='is-travelling').length,trails,'el error no lanza estrellas de acierto');
  assert.deepEqual(h.calls.notes.slice(3).map(n=>n.frequency.value),[349.23,392]);
  h.volume.value=0; h.volume.handlers.input();
  h.effects.celebrate(1,{id:'g4',correct:true});
  assert.equal(h.calls.notes.length,5);
  h.volume.value=60; h.volume.handlers.input();
  const restored=await harness(h.saved);
  assert.equal(restored.toggle['aria-pressed'],'true');
  assert.equal(Number(restored.volume.value),60);
  assert.equal(restored.calls.contexts,0,'la preferencia no inicia reproducción automática');
  restored.effects.unlockSound();
  assert.equal(restored.calls.contexts,1);
  restored.toggle.handlers.click();
  restored.effects.celebrate(2,{id:'g1',correct:true});
  assert.equal(restored.calls.notes.length,0);
});

test('movimiento reducido, almacenamiento bloqueado y audio no compatible',async()=>{
  const reduced=await harness(null,{reduced:true,blockedStorage:true});
  reduced.effects.celebrate(1,{id:'g1',correct:false});
  assert.deepEqual(reduced.calls.classes,[]);
  reduced.toggle.handlers.click(); // blocked storage must not throw
  const unavailable=await harness(null,{unsupported:true});
  assert.equal(unavailable.toggle.disabled,true);
  unavailable.effects.unlockSound();
  assert.equal(unavailable.calls.contexts,0);
});
