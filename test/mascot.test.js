import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/mascot.js', import.meta.url), 'utf8');
let sequence = 0;
async function harness({ delayed = false, reduced = false, unavailable = false } = {}) {
  const scenes = [], timers = new Map();
  let resolveAsset;
  globalThis.fetch = () => new Promise(resolve => {
    resolveAsset = () => resolve({ ok: !unavailable, text: async () => '<svg class="same-drawing"></svg>' });
    if (!delayed) resolveAsset();
  });
  globalThis.window = { matchMedia: () => ({ matches: reduced }) };
  globalThis.document = {
    createElement: () => ({ setAttribute(k, v) { this[k] = v; }, remove() { this.removed = true; } }),
    body: { append(scene) { scenes.push(scene); } }
  };
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
  globalThis.setTimeout = (callback, duration) => { const id = timers.size + 1; timers.set(id, { callback, duration }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  const module = await import('data:text/javascript;base64,' + Buffer.from(source + `\n// ${sequence++}`).toString('base64'));
  return { module, scenes, timers, resolveAsset, restore() { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; } };
}

test('mascota: mismo dibujo, reacción correcta, retirada y pose reducida', async () => {
  let h = await harness();
  try {
    await h.module.showMascot(true);
    assert.match(h.scenes[0].className, /mascot--correct/);
    assert.equal(h.scenes[0]['aria-hidden'], 'true');
    assert.match(h.scenes[0].innerHTML, /same-drawing/);
    assert.equal([...h.timers.values()][0].duration, 2700);
    await h.module.showMascot(false);
    assert.equal(h.scenes[0].removed, true);
    assert.match(h.scenes[1].className, /mascot--learning/);
    assert.match(h.scenes[1].innerHTML, /same-drawing/);
    h.module.clearMascot();
    assert.equal(h.scenes[1].removed, true);
    assert.equal(h.timers.size, 0);
  } finally { h.restore(); }
  h = await harness({ reduced: true });
  try {
    await h.module.showMascot(false);
    assert.match(h.scenes[0].className, /mascot--still/);
    assert.equal([...h.timers.values()][0].duration, 1600);
    [...h.timers.values()][0].callback();
    assert.equal(h.scenes[0].removed, true);
  } finally { h.restore(); }
});

test('mascota: continuar cancela un SVG tardío y un asset fallido no bloquea', async () => {
  let h = await harness({ delayed: true });
  try {
    const pending = h.module.showMascot(true);
    h.module.clearMascot();
    h.resolveAsset(); await pending;
    assert.equal(h.scenes.length, 0);
  } finally { h.restore(); }
  h = await harness({ unavailable: true });
  try { await h.module.showMascot(true); assert.equal(h.scenes.length, 0); }
  finally { h.restore(); }
});
