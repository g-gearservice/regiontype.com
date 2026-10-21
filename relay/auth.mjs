/* 로그인 — 순위표에 올릴 때만 필요하다. 게임은 로그인 없이 그대로 돈다.

   비밀번호는 받지 않는다. 정적 사이트가 비밀번호를 다루면 해시·재설정·유출
   대응을 전부 떠안는데, 그건 이 저장소가 감당할 층이 아니다. 1차 인증은
   Google·Apple 이 하고(OIDC), 2단계는 그 Google 메일로 가는 숫자 6자리다.
   복구 코드는 그 메일을 받을 수 없을 때 2단계를 넘는 비상구다.

   세션은 서명한 토큰이다. 서명이 맞아도 사람 줄이 없으면 로그인이 아니다 —
   계정을 지우면 user 가 사라지고, 그 전에 낸 토큰은 그때부터 거절된다.
   ponytail: 토큰마다 끊는 표는 없다. 지운 계정만 여기서 걸리고, 살아있는 계정은
   서명 그대로 통과한다. 급하면 SESSION_KEY 를 갈아 전부 끊는다. */

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - t.length % 4) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};
export const rand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
export const hex = n => [...crypto.getRandomValues(new Uint8Array(n))]
  .map(b => b.toString(16).padStart(2, '0')).join('');

const enc = new TextEncoder();
/* HMAC 키 하나 가져오기. 세션 서명 말고도 쓴다 — SSO 의 sub 을 이 사이트
   안에서만 뜻이 있는 값으로 접어 두는 데도 같은 SESSION_KEY 를 쓴다(worker.mjs). */
export const mac = key => crypto.subtle.importKey(
  'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

/* payload 를 그대로 실어 보낸다 — 사용자 id 와 만료뿐이고 비밀이 아니다.
   서명이 지키는 건 비밀이 아니라 '우리가 낸 것' 이라는 사실이다. */
export async function sign(key, who, days = 90) {
  const body = b64u(enc.encode(JSON.stringify({ u: who, x: Date.now() + days * 864e5 })));
  const sig = b64u(await crypto.subtle.sign('HMAC', await mac(key), enc.encode(body)));
  return `${body}.${sig}`;
}

/* 토큰이 우리 것이고 아직 살아 있으면 사용자 id 를, 아니면 null 을 준다.
   서명 확인을 timingSafeEqual 대신 verify 에 맡긴다 — WebCrypto 가 상수 시간이다. */
export async function open(key, token) {
  const [body, sig] = String(token ?? '').split('.');
  if (!body || !sig) return null;
  let ok;
  try {
    ok = await crypto.subtle.verify('HMAC', await mac(key), unb64u(sig), enc.encode(body));
  } catch { return null; }
  if (!ok) return null;
  let c;
  try { c = JSON.parse(new TextDecoder().decode(unb64u(body))); } catch { return null; }
  if (!c || typeof c.u !== 'string' || !(c.x > Date.now())) return null;
  return c.u;
}

/* Authorization: Bearer <토큰>.
   쿠키를 안 쓰는 이유는 중계기가 사이트와 아예 다른 도메인(regiontype.gearservicevanguard.com
   ↔ regiontype.com)에 있어서다 — 남의 도메인 쿠키는 브라우저가 점점 더 막는다.
   헤더로 들고 다니면 CSRF 도 없다.
   도메인이 갈린 이상 HttpOnly 쿠키로 올릴 길은 닫혔다. 그 길을 원하면 중계기를
   사이트와 같은 도메인의 서브도메인으로 되돌려야 한다. */
const bearer = req => (req.headers.get('authorization') || '').replace(/^Bearer /, '');

export async function who(env, req) {
  if (!env.SESSION_KEY) return null;
  const id = await open(env.SESSION_KEY, bearer(req));
  if (!id) return null;
  const row = await env.DB.prepare('select 1 as n from user where id = ?').bind(id).first();
  return row ? id : null;
}

export const sha = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
export { b64u, unb64u };
