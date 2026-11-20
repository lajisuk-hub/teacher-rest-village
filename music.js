// 직접 만드는 잔잔한 배경 음악 (오르골 + 부드러운 화음)
let ctx, master, timer, on = false, vol = 0.35;
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; // 펜타토닉
const CHORDS = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];
const hz = (n) => 261.63 * Math.pow(2, n / 12);

function setup() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0;
  const delay = ctx.createDelay(); delay.delayTime.value = 0.42;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  master.connect(lp); lp.connect(ctx.destination);
  lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(ctx.destination);
}
function bell(n, t, len = 1.8, g = 0.12) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), e = ctx.createGain();
  o.type = 'sine'; o2.type = 'triangle';
  o.frequency.value = hz(n); o2.frequency.value = hz(n) * 2;
  const e2 = ctx.createGain(); e2.gain.value = 0.18;
  o.connect(e); o2.connect(e2); e2.connect(e); e.connect(master);
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.015); e.gain.exponentialRampToValueAtTime(0.0008, t + len);
  o.start(t); o2.start(t); o.stop(t + len); o2.stop(t + len);
}
function pad(notes, t, len) {
  notes.forEach((n) => {
    const o = ctx.createOscillator(), e = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(n - 12);
    o.connect(e); e.connect(master);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.035, t + 1.2); e.gain.linearRampToValueAtTime(0, t + len);
    o.start(t); o.stop(t + len + 0.1);
  });
}
let bar = 0;
function schedule() {
  const t = ctx.currentTime + 0.1, beat = 0.62;
  const chord = CHORDS[bar % 4];
  pad(chord, t, beat * 8);
  let last = 4;
  for (let i = 0; i < 8; i++) {
    if (Math.random() < 0.3 && i % 2) continue;
    last = Math.max(0, Math.min(SCALE.length - 1, last + Math.floor(Math.random() * 5) - 2));
    bell(SCALE[last] + (i === 0 ? chord[0] % 12 >= 0 ? 0 : 0 : 0), t + i * beat, 2.2, i % 4 === 0 ? 0.11 : 0.07);
  }
  bar++;
}
export function startMusic() {
  if (!ctx) setup();
  if (ctx.state === 'suspended') ctx.resume();
  if (on) return;
  on = true;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.5);
  schedule();
  timer = setInterval(schedule, 0.62 * 8 * 1000);
}
export function stopMusic() {
  if (!ctx || !on) return;
  on = false;
  clearInterval(timer);
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
}
export function setVolume(v) { vol = v; if (ctx && on) master.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.2); }
export const musicOn = () => on;
