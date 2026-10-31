/* 소리 — 시간표(timeline.js)의 사건으로 음악과 효과음을 한 번에 빚어 out/audio.wav(48kHz 스테레오)로 쓴다.
   120 BPM, D 장조. 키 소리·채움·XP·로고가 화면과 같은 시각표를 쓰므로 프레임 단위로 맞는다.
     node promo/launch-30s/audio.mjs */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DUR, BEAT, soundEvents } from './timeline.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SR = 48000, N = Math.ceil((DUR + 0.5) * SR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 7;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const hz = m => 440 * 2 ** ((m - 69) / 12);

/* 소리 한 줄: 사인(+배음) · 시작 음높이에서 끝 음높이로 미끄러짐 · 어택 · 지수 감쇠 · 팬 */
function tone(t, dur, f0, amp, { f1 = f0, attack = .004, decay = dur / 4, h2 = 0, h3 = 0, pan = 0, tri = 0 } = {}) {
  const i0 = Math.floor(t * SR), n = Math.floor(dur * SR);
  let ph = 0;
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n && i0 + i < N; i++) {
    if (i0 + i < 0) continue;
    const s = i / SR, f = f0 * (f1 / f0) ** (s / dur);
    ph += 2 * Math.PI * f / SR;
    const env = Math.min(1, s / attack) * Math.exp(-s / decay) * Math.min(1, (dur - s) / .01);
    let v = Math.sin(ph) + h2 * Math.sin(2 * ph) + h3 * Math.sin(3 * ph);
    if (tri) v = v * (1 - tri) + tri * (2 / Math.PI) * Math.asin(Math.sin(ph));
    v *= env * amp;
    L[i0 + i] += v * gl; R[i0 + i] += v * gr;
  }
}
/* 잡음 한 줄: 한 극 필터 둘로 대역을 고른다(hp: 높을수록 밝게) */
function noise(t, dur, amp, { lp = .5, hp = .0, attack = .001, decay = dur / 4, pan = 0, swell = false } = {}) {
  const i0 = Math.floor(t * SR), n = Math.floor(dur * SR);
  let a = 0, b = 0;
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n && i0 + i < N; i++) {
    if (i0 + i < 0) continue;
    const s = i / SR, x = rnd() * 2 - 1;
    a += lp * (x - a); b += hp * (a - b);
    const env = swell ? Math.sin(Math.PI * s / dur) ** 2 : Math.min(1, s / attack) * Math.exp(-s / decay);
    const v = (a - b) * env * amp;
    L[i0 + i] += v * gl; R[i0 + i] += v * gr;
  }
}

/* ── 음악 ── */
const CHORDS = [   // 한 마디(2s)마다. 근음 + 화음
  [50, [62, 66, 69, 73]], [47, [62, 66, 71, 74]], [43, [62, 67, 71, 74]], [45, [61, 64, 69, 73]],
  [50, [62, 66, 69, 73]], [47, [62, 66, 71, 74]], [43, [62, 67, 71, 74]], [40, [59, 64, 67, 71]],
  [43, [62, 67, 71, 74]], [45, [61, 64, 69, 73]], [50, [62, 66, 69, 73]], [47, [62, 66, 71, 74]],
  [43, [62, 67, 71, 74]], [45, [61, 64, 69, 73]], [50, [62, 66, 69, 74, 78]],
];
CHORDS.forEach(([root, notes], bar) => {
  const t = bar * 2;
  const quiet = t < 2 ? .45 : t >= 14 && t < 17 ? .7 : 1;
  for (const [k, m] of notes.entries()) tone(t, bar === 14 ? 2.6 : 2.15, hz(m), .016 * quiet, { attack: .35, decay: 2.2, tri: .25, pan: (k - 1.5) * .35 });
  if (t >= 2 && !(t >= 14 && t < 16)) for (const b of [0, 2]) tone(t + b * BEAT, .6, hz(root), .11, { decay: .22, h2: .35, tri: .2 });
});
for (let t = 3; t < DUR - .1; t += BEAT) {
  const drums = (t >= 3 && t < 14) || (t >= 17 && t < 26) || t >= 28 && t < 28.1;
  if (drums) tone(t, .3, 118, .42, { f1: 42, decay: .09, attack: .002 });
  const beatN = Math.round(t / BEAT);
  if (((t >= 8 && t < 14) || (t >= 20 && t < 26)) && beatN % 2 === 1) noise(t, .16, .1, { lp: .55, hp: .35, decay: .05, pan: .1 });
  if ((t >= 8 && t < 14) || (t >= 18 && t < 26)) noise(t + BEAT / 2, .05, .05, { lp: .9, hp: .9, decay: .012, pan: -.3 });
}
for (let t = 6; t < 8; t += BEAT / 4) noise(t, .04, .025 + .02 * (t - 6) / 2, { lp: .9, hp: .9, decay: .01, pan: .3 });

/* ── 효과음 ── */
const PENTA = [74, 76, 78, 81, 83, 86, 88, 90, 93, 95];
for (const e of soundEvents()) {
  const v = e.vol ?? 1;
  switch (e.type) {
    case 'key': noise(e.t, .03, .16 * v, { lp: .7, hp: .5, decay: .006, pan: rnd() * .4 - .2 }); tone(e.t, .025, 2600 + rnd() * 500, .025 * v, { decay: .006 }); break;
    case 'space': noise(e.t, .05, .14 * v, { lp: .45, hp: .2, decay: .012 }); tone(e.t, .06, 210, .07 * v, { f1: 150, decay: .02 }); break;
    case 'confirm': tone(e.t, .1, 150, .16 * v, { f1: 92, decay: .03 }); noise(e.t, .04, .1 * v, { lp: .5, hp: .25, decay: .01 }); break;
    case 'fill': {
      const m = PENTA[e.n % 7] + (e.soft ? 0 : 0);
      tone(e.t + .005, .5, hz(m), e.soft ? .035 : .07, { decay: e.soft ? .1 : .16, h2: .3, h3: .1, pan: (e.n % 5 - 2) * .15 });
      break;
    }
    case 'unfold': [0, .1, .2, .3].forEach((d, i) => tone(e.t + d, .8, hz([74, 78, 81, 86][i]), .05, { decay: .3, h2: .2, pan: i * .2 - .3 })); break;
    case 'trace': noise(e.t, 1.1, .045, { lp: .12, hp: .02, swell: true }); tone(e.t, 1.1, 300, .015, { f1: 600, attack: .4, decay: .8 }); break;
    case 'complete': [62, 66, 69, 74].forEach((m, i) => tone(e.t + i * .025, 1.4, hz(m + 12), .045, { decay: .5, h2: .25, h3: .1, pan: i * .25 - .35 })); break;
    case 'spread': for (let i = 0; i < 11; i++) tone(e.t - .2 + i * .09, .3, hz(PENTA[(i * 3) % 10] + 12), .022, { decay: .08, h2: .2, pan: rnd() - .5 }); break;
    case 'bot': tone(e.t + .3, .22, 330, .09, { f1: 720, decay: .1, h2: .15 }); tone(e.t + .44, .2, 520, .07, { f1: 900, decay: .08 }); break;
    case 'reply': tone(e.t, .16, hz(81), .07, { decay: .06, h2: .2 }); tone(e.t + .1, .25, hz(86), .07, { decay: .1, h2: .2 }); break;
    case 'straighten': tone(e.t + .05, .85, 700, .03, { f1: 260, attack: .2, decay: .5 }); break;
    case 'xp': tone(e.t, .25, hz(e.soft ? 93 + (e.n % 5) : 86 + e.n * 2), e.soft ? .03 : .065, { decay: e.soft ? .04 : .07, h2: .2 }); break;
    case 'level': [86, 90, 93, 98].forEach((m, i) => tone(e.t + i * .06, .9, hz(m), .06, { decay: .3, h2: .15, pan: i * .2 - .3 })); break;
    case 'morph': tone(e.t + .05, .45, 440, .07, { f1: 220, decay: .2, tri: .3 }); tone(e.t + .25, .3, 330, .05, { f1: 660, decay: .1 }); break;
    case 'fold': noise(e.t, .5, .04, { lp: .15, hp: .02, swell: true }); tone(e.t, .5, 520, .025, { f1: 260, attack: .1, decay: .3 }); break;
    case 'align': for (let i = 0; i < 8; i++) noise(e.t + .02 + i * .045, .03, .07, { lp: .6, hp: .35, decay: .007, pan: (i % 3 - 1) * .4 }); break;
    case 'logo': tone(e.t, 2, hz(98), .06, { decay: .7, h2: .1 }); tone(e.t, 2, hz(86), .05, { decay: 1, h2: .2 }); break;
  }
}

/* 마스터: 부드럽게 눌러 -1 dBFS 로 */
let peak = 0;
for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.9); R[i] = Math.tanh(R[i] * 1.9); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const g = .89 / peak, n = Math.floor(DUR * SR);
const buf = Buffer.alloc(44 + n * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  const fade = Math.min(1, (n - i) / (SR * .25));   // 끝 0.25s 를 접어 고리로 이어 들어도 튀지 않게
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g * fade)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g * fade)) * 32767), 46 + i * 4);
}
await mkdir(join(HERE, 'out'), { recursive: true });
await writeFile(join(HERE, 'out/audio.wav'), buf);
console.log('wrote out/audio.wav', (n / SR).toFixed(2) + 's', 'peak gain', g.toFixed(2));
