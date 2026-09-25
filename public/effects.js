import { showMascot } from './mascot.js';
const key = 'global-ai:sound:v1';
let preference = { enabled: false, volume: 35 };
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && typeof saved.enabled === 'boolean' && Number.isFinite(saved.volume)) {
    preference = { enabled: saved.enabled, volume: Math.max(0, Math.min(100, saved.volume)) };
  }
} catch { /* Private storage must not block the expedition. */ }
let context, master;
const voices = new Set();
const Audio = window.AudioContext || window.webkitAudioContext;
const controls = document.querySelector('#sound-controls');
controls.innerHTML = `<button type="button" id="sound-toggle" aria-pressed="false">Sonido: apagado</button><label for="sound-volume">Volumen <output id="volume-value"></output></label><input id="sound-volume" type="range" min="0" max="100" step="5" aria-label="Volumen de efectos"/><span id="sound-status" role="status"></span>`;
const toggle = controls.querySelector('#sound-toggle');
const volume = controls.querySelector('#sound-volume');
const status = controls.querySelector('#sound-status');
function save() { try { localStorage.setItem(key, JSON.stringify(preference)); } catch { } }
function sync() {
  toggle.textContent = `Sonido: ${preference.enabled ? 'activado' : 'apagado'}`;
  toggle.setAttribute('aria-pressed', String(preference.enabled));
  volume.value = preference.volume;
  controls.querySelector('output').textContent = `${preference.volume}%`;
  if (master) master.gain.setTargetAtTime(preference.enabled ? preference.volume / 100 : 0, context.currentTime, 0.01);
}
// Invoke synchronously from a user gesture, never on load or restored feedback.
export function unlockSound() {
  if (!preference.enabled || !Audio) return;
  try {
    if (!context) { context = new Audio(); master = context.createGain(); master.connect(context.destination); sync(); }
    context.resume().catch(() => { status.textContent = 'Audio no disponible. El feedback sigue en pantalla.'; });
  } catch { status.textContent = 'Audio no disponible. El feedback sigue en pantalla.'; }
}
toggle.addEventListener('click', () => {
  preference.enabled = !preference.enabled; save(); sync();
  if (preference.enabled) unlockSound(); else stopSound();
});
volume.addEventListener('input', () => {
  preference.volume = Number(volume.value); save(); sync();
  if (preference.volume === 0) stopSound();
});
if (!Audio) { toggle.disabled = true; status.textContent = 'Este navegador no admite los efectos de audio.'; }
sync();
export function stopSound() {
  for (const oscillator of voices) { try { oscillator.stop(); } catch { } }
  voices.clear();
}
function play(correct) {
  if (!context || context.state !== 'running' || !preference.enabled || !preference.volume) return;
  stopSound();
  // Original ascending prism chime / soft two-note invitation, under half a second.
  const notes = correct ? [523.25, 659.25, 783.99] : [349.23, 392];
  notes.forEach((frequency, i) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    const start = context.currentTime + i * 0.09;
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.17);
    oscillator.connect(gain); gain.connect(master); voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + 0.18);
  });
}
const seen = new Set();
export function celebrate(runId, feedback) {
  const id = `${runId}:${feedback.id}`;
  if (seen.has(id)) return;
  seen.add(id);
  const card = document.querySelector('.question-card');
  if (!card) return;
  play(feedback.correct);
  void showMascot(feedback.correct);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  card.classList.add(feedback.correct ? 'celebrate-correct' : 'celebrate-learning');
  const trail = card.querySelector('.star-trail');
  const destination = document.querySelector('.next-checkpoint');
  if (feedback.correct && trail && destination) {
    const from = trail.getBoundingClientRect(), to = destination.getBoundingClientRect();
    trail.style.setProperty('--travel-x', `${to.x + to.width / 2 - from.x}px`);
    trail.style.setProperty('--travel-y', `${to.y + to.height / 2 - from.y}px`);
    trail.classList.add('is-travelling');
    trail.addEventListener('animationend', () => trail.remove(), { once: true });
  }
}
