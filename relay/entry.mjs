/* 워커를 경로 묶음별로 따로 배포하기 위한 얇은 문. 처리 코드는 worker.mjs 하나뿐이고
   (갈래를 베끼지 않는다) 각 워커의 main 은 entry-<이름>.mjs — `only('<이름>')` 한 줄이다.
   '/' 로 끝나는 항목은 그 아래 전부(접두), 아니면 정확히 그 경로다.
   새 경로를 worker.mjs 에 붙이면 여기 OWN 에도 적어야 한다 — 빠지면 test.mjs 가 잡는다.
   존 라우트(wrangler.<이름>.toml)의 패턴도 같이 맞춘다. */
import worker from './worker.mjs';

export const OWN = {
  feedback: ['/', '/turnstile', '/where'],   // 기존 rt-feedback — 남는 경로의 최후 원점
  auth: ['/auth/'],
  board: ['/top', '/dist', '/forget', '/ranked/', '/played', '/games', '/ladder', '/match/'],
  community: ['/cm/'],
  bot: ['/bot/'],
  online: ['/online'],
};

export const owns = (name, path) =>
  OWN[name].some(p => (p.endsWith('/') && p !== '/' ? path.startsWith(p) : path === p));

/* 프리플라이트(OPTIONS)도 경로로 가른다 — 브라우저는 실제 요청과 같은 경로로 묻는다 */
export const only = name => ({
  fetch(req, env, ctx) {
    if (!owns(name, new URL(req.url).pathname)) {
      return new Response('{"msg":"이 워커의 경로가 아닙니다."}',
        { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    return worker.fetch(req, env, ctx);
  },
});
