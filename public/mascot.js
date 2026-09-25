// One original SVG rig is shared by both reactions. No sound or scoring here.
const drawing = fetch('/explorer.svg').then(r => r.ok ? r.text() : null).catch(() => null);
let active = null, timer, generation = 0;

export function clearMascot() {
  generation++;
  clearTimeout(timer);
  active?.remove();
  active = null;
}

export async function showMascot(correct) {
  clearMascot();
  const version = generation;
  const svg = await drawing;
  // A slow asset must never appear on a later question after Continue.
  if (!svg || version !== generation) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = document.createElement('div');
  scene.className = `mascot-overlay mascot--${correct ? 'correct' : 'learning'}${reduced ? ' mascot--still' : ''}`;
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = `<div class="mascot-scene"><div class="mascot-halo"></div>${svg}</div>`;
  document.body.append(scene);
  active = scene;
  timer = setTimeout(() => { if (active === scene) clearMascot(); }, reduced ? 1600 : 2700);
}
