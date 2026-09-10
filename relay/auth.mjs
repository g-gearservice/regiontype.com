/* 로그인 — 순위표에 올릴 때만 필요하다. 게임은 로그인 없이 그대로 돈다.

   비밀번호는 받지 않는다. 정적 사이트가 비밀번호를 다루면 해시·재설정·유출
   대응을 전부 떠안는데, 그건 이 저장소가 감당할 층이 아니다. 패스키는 비밀이
   기기 밖으로 나오지 않고, 메일 링크는 일회용이다.

   세션은 서명한 무상태 토큰이다.
   ponytail: 무상태라 낱개로 끊을 수 없다 — 급하면 SESSION_KEY 를 갈아 전부 끊는다.
   낱개 로그아웃이 필요해지면 session 표를 만들어 대조로 올린다. */

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
const mac = key => crypto.subtle.importKey(
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
   쿠키를 안 쓰는 이유는 중계기가 사이트와 다른 곳(workers.dev)에 있어서다 —
   사이트 밖 쿠키는 브라우저가 점점 더 막는다. 헤더로 들고 다니면 CSRF 도 없다.
   ponytail: 중계기를 api.regiontype.com 으로 옮기면 HttpOnly 쿠키로 올릴 수 있다. */
const bearer = req => (req.headers.get('authorization') || '').replace(/^Bearer /, '');

export const who = (env, req) => env.SESSION_KEY ? open(env.SESSION_KEY, bearer(req)) : null;

/* ── 패스키 (WebAuthn) ────────────────────────────────────
   등록 때 브라우저가 getPublicKey() 로 SPKI 를 그대로 준다. 그래서 서버에
   CBOR 파서를 들일 필요가 없다 — attestation 은 'none' 으로 받는다.
   증명서를 안 받는 대신 우리가 지키는 건 '이 챌린지에 이 기기가 답했다' 하나다.
   순위표에는 그거면 된다. 은행이면 attestation 을 받아야 한다. */

export const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/* clientDataJSON — 브라우저가 무엇에 서명했는지 적어 보내는 쪽지.
   챌린지와 출처를 여기서 맞춰야 남의 사이트에서 받아온 서명을 못 쓴다. */
export function readClientData(raw, want, challenge, origins) {
  let c;
  try { c = JSON.parse(new TextDecoder().decode(unb64u(raw))); } catch { return '읽을 수 없는 응답입니다.'; }
  if (c.type !== want) return '응답 종류가 맞지 않습니다.';
  if (c.challenge !== challenge) return '만료되었거나 우리가 낸 요청이 아닙니다.';
  if (!origins.includes(c.origin)) return '허용된 곳이 아닙니다.';
  return null;
}

/* authenticatorData — 앞 37바이트가 고정 자리다.
   rpIdHash 32 | flags 1 | signCount 4 | (그 뒤는 안 본다) */
export function readAuthData(bytes) {
  if (bytes.length < 37) return null;
  const flags = bytes[32];
  return {
    rpIdHash: bytes.slice(0, 32),
    up: !!(flags & 1),          // 사람이 실제로 만졌다
    uv: !!(flags & 4),          // 지문·PIN 으로 본인 확인까지 했다
    count: new DataView(bytes.buffer, bytes.byteOffset + 33, 4).getUint32(0),
  };
}

/* ECDSA 서명은 DER 로 온다. WebCrypto 는 r||s 원시 64바이트를 받는다 —
   길이가 33바이트로 오는 값(앞의 0)을 잘라 맞춰야 한다. */
export function derToRaw(der) {
  if (der[0] !== 0x30) return der;             // 이미 원시형이면 그대로
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f;       // 긴 길이 표기
  const take = () => {
    if (der[i++] !== 0x02) return null;
    let n = der[i++];
    let v = der.slice(i, i + n); i += n;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = take(), s = take();
  if (!r || !s) return der;
  const raw = new Uint8Array(64);
  raw.set(r, 0); raw.set(s, 32);
  return raw;
}

const ALG = {
  '-7':   { import: { name: 'ECDSA', namedCurve: 'P-256' }, verify: { name: 'ECDSA', hash: 'SHA-256' } },
  '-257': { import: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verify: { name: 'RSASSA-PKCS1-v1_5' } },
};

/* 저장해 둔 공개키로 '이 기기가 이 챌린지에 답했다'를 확인한다.
   서명 대상은 authenticatorData 뒤에 clientDataJSON 의 해시를 붙인 것이다. */
export async function verify({ alg, key, authData, clientDataJSON, signature }) {
  const spec = ALG[String(alg)];
  if (!spec) return false;
  const pub = await crypto.subtle.importKey('spki', unb64u(key), spec.import, false, ['verify']);
  const a = unb64u(authData);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', unb64u(clientDataJSON)));
  const signed = new Uint8Array(a.length + hash.length);
  signed.set(a, 0); signed.set(hash, a.length);
  let sig = unb64u(signature);
  if (spec.import.name === 'ECDSA') sig = derToRaw(sig);
  return crypto.subtle.verify(spec.verify, pub, sig, signed);
}

export const sha = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
export { b64u, unb64u };
