/* regiontype 문자 발송. 브라우저에 문을 열지 않는다 — 중계기가 서비스 바인딩으로만
   부른다. 번호는 E.164 만 받는다. 국내 형식으로 고쳐 주는 일은 여기서 하지 않는다. */

const E164 = /^\+[1-9]\d{7,14}$/;
const enc = new TextEncoder();

const json = status => new Response(JSON.stringify({ ok: status < 300 }), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const hex = buf => [...buf].map(b => b.toString(16).padStart(2, '0')).join('');

export function normPhone(s) {
  const e = String(s ?? '');
  if (!e || /\s/.test(e)) return '';
  if (!E164.test(e)) return '';
  return e;
}

async function sameSecret(got, want) {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(got))),
    crypto.subtle.digest('SHA-256', enc.encode('Bearer ' + String(want))),
  ]);
  const ua = new Uint8Array(a), ub = new Uint8Array(b);
  let v = 0;
  for (let i = 0; i < ua.length; i++) v |= ua[i] ^ ub[i];
  return v === 0;
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(String(msg)))));
}

function solapiReady(env) {
  return !!(env.SOLAPI_KEY && env.SOLAPI_SECRET && env.SOLAPI_FROM);
}

function twilioReady(env) {
  return !!(env.TWILIO_SID && env.TWILIO_TOKEN && (env.TWILIO_FROM || env.TWILIO_SERVICE));
}

function allowPrefix(to, raw) {
  const list = String(raw ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return !list.length || list.some(p => to.startsWith(p));
}

function pickProvider(env, to) {
  const solapi = solapiReady(env);
  const twilio = twilioReady(env);
  const mode = String(env.SMS_PROVIDER ?? 'auto').trim().toLowerCase() || 'auto';
  const want = mode === 'solapi' || mode === 'twilio' ? mode : (to.startsWith('+82') ? 'solapi' : 'twilio');
  if (want === 'solapi') return solapi ? 'solapi' : (twilio ? 'twilio' : '');
  return twilio ? 'twilio' : (solapi ? 'solapi' : '');
}

async function sendSolapi(to, text, env, fetchImpl) {
  const date = new Date().toISOString();
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const auth = `HMAC-SHA256 apiKey=${env.SOLAPI_KEY}, date=${date}, salt=${salt}, signature=${await hmacHex(env.SOLAPI_SECRET, date + salt)}`;
  const message = { from: env.SOLAPI_FROM, text };
  if (to.startsWith('+82')) message.to = '0' + to.slice(3);
  else {
    /* 국제번호는 국가번호 경계를 억지로 가르지 않고 +만 뗀다. */
    message.to = to.slice(1);
  }
  return fetchImpl('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: auth },
    body: JSON.stringify({ message }),
    redirect: 'manual',
  });
}

async function sendTwilio(to, text, env, fetchImpl) {
  const form = new URLSearchParams({ To: to, Body: text });
  if (env.TWILIO_SERVICE) form.set('MessagingServiceSid', String(env.TWILIO_SERVICE));
  else form.set('From', String(env.TWILIO_FROM));
  return fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + btoa(`${env.TWILIO_SID}:${env.TWILIO_TOKEN}`),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    redirect: 'manual',
  });
}

export async function handle(req, env, fetchImpl = fetch) {
  let path = '';
  try { path = new URL(req.url).pathname; } catch { return json(404); }
  if (req.method !== 'POST' || path !== '/send') return json(404);
  if (!env.SMS_KEY || (!solapiReady(env) && !twilioReady(env))) return json(503);
  if (!await sameSecret(req.headers.get('authorization') || '', env.SMS_KEY)) return json(401);
  let c;
  try { c = await req.json(); } catch { return json(400); }
  if (!c || Array.isArray(c) || typeof c !== 'object') return json(400);
  if (Object.keys(c).some(k => k !== 'to' && k !== 'text')) return json(400);
  const to = normPhone(c?.to);
  const text = String(c?.text ?? '');
  if (!to || !text || text.length > 300 || text.includes('\0')) return json(400);
  if (!allowPrefix(to, env.SMS_ALLOW)) return json(403);
  const provider = pickProvider(env, to);
  if (!provider) return json(503);
  try {
    const r = provider === 'solapi'
      ? await sendSolapi(to, text, env, fetchImpl)
      : await sendTwilio(to, text, env, fetchImpl);
    return json(r?.ok === true ? 200 : 502);
  } catch {
    return json(502);
  }
}
