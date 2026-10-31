/* 영상 굽기. 저장소 뿌리를 제 손으로 띄우고, 머리 없는 Chrome 에 index.html?render 를 열어
   seek(t) → 한 장 찍기를 프레임마다 되풀이해 ffmpeg 에 넘긴다.

     node promo/launch-30s/audio.mjs                         소리(out/audio.wav)
     node promo/launch-30s/render.mjs                        1080×1920 30fps → out/regiontype-30s.mp4
     node promo/launch-30s/render.mjs --scale .5 --fps 15    가벼운 애니매틱 → out/animatic.mp4
     node promo/launch-30s/render.mjs --stills 0.4,2.2,...   그 시각의 정지 화면 → out/still-*.png
*/
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = normalize(join(HERE, '../..'));
const OUT = join(HERE, 'out');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const scale = +arg('scale', 1), fps = +arg('fps', 30), stills = arg('stills', null);
const outFile = join(OUT, arg('out', scale < 1 ? 'animatic.mp4' : 'regiontype-30s.mp4'));
const { DUR, FPS } = await import('./timeline.js');
await mkdir(OUT, { recursive: true });

/* 정적 파일만 내는 작은 서버 — 저장소 밖은 내지 않는다 */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wav': 'audio/wav', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const p = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  const f = p.endsWith('/') ? join(p, 'index.html') : p;
  const body = await readFile(f).catch(() => null);
  if (!body) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }).end(body);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/promo/launch-30s/?render`;

/* Chrome */
const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', process.env.CHROME].find(p => p && existsSync(p));
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${await mkdtemp(join(tmpdir(), 'rt-promo-'))}`,
  '--hide-scrollbars', '--mute-audio', '--no-first-run', '--window-size=1080,1920', 'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  await new Promise(r => setTimeout(r, 100));
  wsUrl = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json()).then(j => j.webSocketDebuggerUrl).catch(() => null);
}
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, m => m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async expr => {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

await cdp('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: scale, mobile: false });
await cdp('Page.navigate', { url: base });
for (let i = 0; i < 300; i++) { if (await evaluate('window.__ready === true').catch(() => false)) break; await new Promise(r => setTimeout(r, 100)); }
const shot = async () => Buffer.from((await cdp('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })).data, 'base64');

const t0 = Date.now();
if (stills) {
  /* 정지 화면도 0 초부터 프레임마다 밟아 간다 — 봇의 모프·시선은 시간을 이어서 받아야 같다 */
  const want = stills.split(',').map(Number).sort((a, b) => a - b);
  let k = 0;
  for (let f = 0; f < DUR * FPS && k < want.length; f++) {
    const t = f / FPS;
    await evaluate(`seek(${t})`);
    while (k < want.length && want[k] < t + 1 / FPS) {
      await evaluate(`seek(${want[k]})`);
      await writeFile(join(OUT, `still-${want[k].toFixed(2)}.png`), await shot());
      console.log('still', want[k]);
      k++;
    }
  }
} else {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    ...(existsSync(join(OUT, 'audio.wav')) ? ['-i', join(OUT, 'audio.wav'), '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', scale < 1 ? '23' : '15', '-preset', scale < 1 ? 'veryfast' : 'slow',
    '-r', String(fps), '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(DUR * fps);
  for (let f = 0; f < n; f++) {
    /* 낮은 fps 에서도 봇의 시계는 30fps 로 밟는다 */
    for (let s = Math.round(f * FPS / fps) - Math.round(FPS / fps) + 1; s < Math.round(f * FPS / fps); s++) if (s > 0) await evaluate(`seek(${s / FPS})`);
    await evaluate(`seek(${f / fps})`);
    const png = await shot();
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) console.log(`frame ${f}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote', outFile);
}
ws.close(); chrome.kill(); server.close();
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
