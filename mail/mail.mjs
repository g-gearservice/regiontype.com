/* regiontype 복구 메일. 브라우저에 문을 열지 않는다 — 중계기가 서비스 바인딩으로만
   부른다. 주소·제목에 줄바꿈을 끼워 헤더를 늘리는 값은 거절한다. 본문은 평문뿐이다. */

const ADDR = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function normMail(s) {
  const e = String(s ?? '').trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return '';
  if (/[\s<>()"\\]/.test(e) || e.includes('..')) return '';
  if (!ADDR.test(e)) return '';
  return e;
}

/* 헤더와 본문을 나눈 평문 MIME. 실패하면 빈 문자열 — 보낸 척하지 않는다. */
export function mime(from, to, subject, text) {
  const f = normMail(from), t = normMail(to);
  const sub = String(subject ?? '').trim();
  const body = String(text ?? '').replace(/\r\n?/g, '\n');
  if (!f || !t || !sub || sub.length > 80 || /[\r\n]/.test(sub)) return '';
  if (!body || body.length > 2000 || body.includes('\0')) return '';
  return [
    `From: ${f}`,
    `To: ${t}`,
    `Subject: ${sub}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ].join('\r\n');
}

const json = (status, extra = {}) => new Response(JSON.stringify({ ok: status < 300, ...extra }), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

async function sameSecret(got, want) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(got))),
    crypto.subtle.digest('SHA-256', enc.encode('Bearer ' + String(want))),
  ]);
  const ua = new Uint8Array(a), ub = new Uint8Array(b);
  let v = 0;
  for (let i = 0; i < ua.length; i++) v |= ua[i] ^ ub[i];
  return v === 0;
}

/* 유료 Email Service 의 구조화 send(). html 은 받지 않는다. 주소는 응답에 싣지 않는다. */
export async function handle(req, env) {
  let path = '';
  try { path = new URL(req.url).pathname; } catch { return json(404); }
  if (req.method !== 'POST' || path !== '/send') return json(404);
  if (!env.MAIL_KEY || !env.MAIL_FROM || !env.EMAIL?.send) return json(503);
  if (!await sameSecret(req.headers.get('authorization') || '', env.MAIL_KEY)) return json(401);
  let c;
  try { c = await req.json(); } catch { return json(400); }
  if (c?.html != null || c?.attachments != null) return json(400);
  const from = normMail(env.MAIL_FROM);
  const to = normMail(c?.to);
  const subject = String(c?.subject ?? '').trim();
  const text = String(c?.text ?? '').replace(/\r\n?/g, '\n');
  if (!from || !to || !subject || subject.length > 80 || /[\r\n]/.test(subject)) return json(400);
  if (!text || text.length > 2000 || text.includes('\0')) return json(400);
  await env.EMAIL.send({ to, from, subject, text });
  return json(200);
}
