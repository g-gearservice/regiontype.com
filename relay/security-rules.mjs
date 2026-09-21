/* 보안 룰 표. 한 줄에 룰 하나 — 무엇을 보고, 무엇이어야 하는가.
 *
 * 룰은 순수 함수다. 네트워크도 파일도 여기서 만지지 않는다 — 다 모아 온 값(facts)을
 * 받아 판정만 한다. 그래서 relay/test.mjs 가 가짜 값으로 룰을 흔들어 볼 수 있다.
 * 검사를 도는 쪽은 relay/security-check.mjs 다.
 *
 *   need    무엇을 보는가.  'probe:<이름>' 은 라이브 응답, 'file:<경로>' 는 저장소 파일
 *   sev     high 는 뚫린 것, mid 는 약해진 것, low 는 어긋난 것
 *   want    사람이 읽을 기대값 한 줄
 *   test    맞으면 빈 문자열, 틀리면 '무엇이 어떻게 달랐는지' 한 줄
 *
 * 룰을 더할 때: 기대값을 여기 적고, 그 값을 어디서 떠 오는지는 check 쪽 PROBES 에 적는다.
 */

/* 라이브로 떠 올 자리. security-check.mjs 가 이 표대로 요청을 보낸다. */
export const PROBES = {
  site:     { url: 'https://regiontype.com/' },
  www:      { url: 'https://www.regiontype.com/' },
  plain:    { url: 'http://regiontype.com/', redirect: 'manual' },
  relay:    { url: 'https://g.gearservicevanguard.com/where',
              headers: { Origin: 'https://regiontype.com' } },
  preflight: { url: 'https://g.gearservicevanguard.com/', method: 'OPTIONS',
               headers: { Origin: 'https://regiontype.com',
                          'Access-Control-Request-Method': 'POST' } },
  /* 저장소 파일을 사이트가 내주는지 — Pages 에는 .assetsignore 가 없어 엣지가 대신 막는다 */
  internals: { url: 'https://regiontype.com/relay/worker.mjs' },
  /* 남의 출처로 같은 문을 두드려 본다 — 문이 아무에게나 열리면 여기서 걸린다 */
  stranger: { url: 'https://g.gearservicevanguard.com/', method: 'OPTIONS',
              headers: { Origin: 'https://evil.example',
                         'Access-Control-Request-Method': 'POST' } },
};

/* 응답 헤더를 한 줄로 다룬다 — 없으면 빈 문자열이라 test 안에서 분기가 없다 */
const h = (p, name) => String(p.headers?.[name] ?? '');
const maxAge = v => Number(/max-age=(\d+)/i.exec(v)?.[1] ?? -1);
const missing = (text, ...bits) => bits.filter(b => !text.includes(b));

/* 정적 사이트 두 호스트에 똑같이 걸리는 룰 — 한 벌을 써서 host 만 갈아 끼운다.
   www 가 조용히 다른 경로를 타는 일이 실제로 있어 둘 다 본다. */
const siteRules = key => [
  { id: `${key}-hsts`, need: `probe:${key}`, sev: 'high',
    want: 'HSTS max-age ≥ 1년, includeSubDomains',
    test: p => {
      const v = h(p, 'strict-transport-security');
      if (!v) return 'Strict-Transport-Security 가 없다';
      if (maxAge(v) < 31536000) return `max-age 가 짧다: ${v}`;
      if (!/includesubdomains/i.test(v)) return `includeSubDomains 가 빠졌다: ${v}`;
      return '';
    } },
  { id: `${key}-csp`, need: `probe:${key}`, sev: 'high',
    want: "CSP 에 frame-ancestors·base-uri·object-src·form-action",
    test: p => {
      const v = h(p, 'content-security-policy');
      if (!v) return 'Content-Security-Policy 가 없다';
      const gone = missing(v, "frame-ancestors 'none'", "base-uri 'self'",
                              "object-src 'none'", "form-action 'self'");
      return gone.length ? `빠진 지시어: ${gone.join(', ')}` : '';
    } },
  { id: `${key}-frame`, need: `probe:${key}`, sev: 'mid',
    want: 'X-Frame-Options: DENY',
    test: p => /^deny$/i.test(h(p, 'x-frame-options')) ? ''
             : `X-Frame-Options 가 DENY 가 아니다: ${h(p, 'x-frame-options') || '없음'}` },
  { id: `${key}-nosniff`, need: `probe:${key}`, sev: 'mid',
    want: 'X-Content-Type-Options: nosniff',
    test: p => /^nosniff$/i.test(h(p, 'x-content-type-options')) ? ''
             : `nosniff 가 아니다: ${h(p, 'x-content-type-options') || '없음'}` },
  { id: `${key}-referrer`, need: `probe:${key}`, sev: 'low',
    want: 'Referrer-Policy: strict-origin-when-cross-origin',
    test: p => h(p, 'referrer-policy') === 'strict-origin-when-cross-origin' ? ''
             : `다른 값이다: ${h(p, 'referrer-policy') || '없음'}` },
  { id: `${key}-permissions`, need: `probe:${key}`, sev: 'low',
    want: '카메라·마이크·위치·결제·USB 를 아무에게도 주지 않는다',
    test: p => {
      const v = h(p, 'permissions-policy');
      if (!v) return 'Permissions-Policy 가 없다';
      const gone = missing(v, 'camera=()', 'microphone=()', 'geolocation=()',
                              'payment=()', 'usb=()');
      return gone.length ? `열려 있는 기능: ${gone.join(', ')}` : '';
    } },
  { id: `${key}-coop`, need: `probe:${key}`, sev: 'low',
    want: 'Cross-Origin-Opener-Policy: same-origin',
    test: p => h(p, 'cross-origin-opener-policy') === 'same-origin' ? ''
             : `다른 값이다: ${h(p, 'cross-origin-opener-policy') || '없음'}` },
];

export const RULES = [
  ...siteRules('site'),
  ...siteRules('www'),

  { id: 'https-only', need: 'probe:plain', sev: 'high',
    want: 'http:// 는 https:// 로 영구 이동',
    test: p => {
      if (![301, 308].includes(p.status)) return `평문 요청이 ${p.status} 로 답한다`;
      const to = h(p, 'location');
      return to.startsWith('https://') ? '' : `https 로 보내지 않는다: ${to || '없음'}`;
    } },

  /* ── 중계기 ────────────────────────────────────────────
     피드백 중계기는 로그인 없이 누구나 부를 수 있어야 한다. Zero Trust 가 이 호스트를
     덮으면 브라우저는 워커가 돌기도 전에 403·302 를 받는다 — relay/ACCESS.md 참고. */
  { id: 'relay-open', need: 'probe:relay', sev: 'high',
    want: '/where 가 Access 로그인 없이 JSON 을 돌려준다',
    test: p => {
      if (h(p, 'location').includes('cloudflareaccess.com'))
        return 'Cloudflare Access 로그인으로 넘긴다 — 중계기가 잠겼다';
      if (p.status !== 200) return `${p.status} 로 답한다`;
      if (!h(p, 'content-type').includes('application/json')) return 'JSON 이 아니다';
      return '';
    } },
  { id: 'relay-preflight', need: 'probe:preflight', sev: 'high',
    want: '사이트 출처의 프리플라이트는 204 와 그 출처를 그대로 받는다',
    test: p => {
      if (p.status !== 204) return `프리플라이트가 ${p.status} 다 (403 이면 Access)`;
      const o = h(p, 'access-control-allow-origin');
      return o === 'https://regiontype.com' ? '' : `허용 출처가 어긋난다: ${o || '없음'}`;
    } },
  { id: 'relay-stranger', need: 'probe:stranger', sev: 'high',
    want: '모르는 출처에는 CORS 를 내주지 않는다',
    test: p => {
      const o = h(p, 'access-control-allow-origin');
      if (o === '*') return '아무 출처나 받는다 (*)';
      if (o === 'https://evil.example') return '모르는 출처를 그대로 되비춘다';
      return '';
    } },
  { id: 'relay-vary', need: 'probe:preflight', sev: 'mid',
    want: 'Vary: Origin — 출처별 응답이 서로 섞이지 않게',
    test: p => /origin/i.test(h(p, 'vary')) ? '' : `Vary 에 Origin 이 없다: ${h(p, 'vary') || '없음'}` },
  { id: 'relay-no-credentials', need: 'probe:preflight', sev: 'mid',
    want: '쿠키를 실어 나르지 않는다 — 세션은 Bearer 토큰이다',
    test: p => h(p, 'access-control-allow-credentials')
             ? 'Allow-Credentials 가 켜져 있다' : '' },

  /* ── 저장소 ────────────────────────────────────────────
     네트워크가 없어도 도는 룰. 코드가 규칙을 어긴 채 배포로 넘어가는 걸 여기서 잡는다. */
  { id: 'no-secret-literal', need: 'file:relay', sev: 'high',
    want: '토큰·열쇠는 소스에 적히지 않는다 (wrangler secret 뿐)',
    test: src => {
      const hit = /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.exec(src);
      if (hit) return `GitHub 토큰처럼 생긴 값이 있다: ${hit[0].slice(0, 8)}…`;
      const set = /\b(GH_TOKEN|SESSION_KEY|SUB_KEY|GOOGLE_SECRET|APPLE_KEY|TURNSTILE_SECRET)\s*[:=]\s*['"`][^'"`]+['"`]/.exec(src);
      return set ? `소스에 값이 박혀 있다: ${set[1]}` : '';
    } },
  { id: 'secret-not-in-vars', need: 'file:relay/wrangler.toml', sev: 'high',
    want: 'wrangler.toml 의 [vars] 에 비밀을 적지 않는다',
    test: src => {
      const vars = /\[vars\]([\s\S]*?)(\n\[|$)/.exec(src)?.[1] ?? '';
      const bad = /(TOKEN|SECRET|KEY|PASSWORD)\s*=/i.exec(vars);
      return bad ? `[vars] 에 ${bad[1]} 이 있다 — secret 으로 옮긴다` : '';
    } },
  { id: 'ratelimits', need: 'file:relay/wrangler.toml', sev: 'high',
    /* RL_CB 가 빠지면 /auth/cb 가 무제한으로 열리는 게 아니라 — worker.mjs 가
       env.RL_CB 없는 바인딩을 만나 pass() 에서 null 을 받아 '설정 미비'로
       막힌다(악용이 아니라 로그인이 전부 조용히 실패한다). 그래서 나머지
       셋과 같은 sev(high)로 같이 본다. */
    want: '네 창(RL_FB·RL_SC·RL_AU·RL_CB)이 다 붙어 있다',
    test: src => {
      const gone = missing(src, 'RL_FB', 'RL_SC', 'RL_AU', 'RL_CB');
      return gone.length ? `빠진 레이트리밋 바인딩: ${gone.join(', ')}` : '';
    } },
  { id: 'assets-exclude', need: 'file:.assetsignore', sev: 'high',
    want: '소스·설정은 사이트 자산으로 나가지 않는다',
    test: src => {
      const lines = src.split('\n').map(s => s.trim());
      const gone = ['relay', 'tools', 'wrangler.toml', '.dev.vars', '.claude']
        .filter(p => !lines.includes(p));
      return gone.length ? `자산으로 새어 나갈 수 있다: ${gone.join(', ')}` : '';
    } },
  /* 위 룰의 라이브 짝. .assetsignore 는 Worker 배포에서만 듣는다 — Pages 로 나가는 동안은
     저장소가 통째로 열려 있고, 그때 막는 건 엣지 룰뿐이다. 저장소가 공개라 새는 비밀은
     없으니 high 가 아니라 mid 다 — 줄일 표면이지, 뚫린 구멍이 아니다. */
  { id: 'internals-closed', need: 'probe:internals', sev: 'mid',
    want: '저장소 파일은 사이트가 내주지 않는다',
    test: p => p.status === 200
      ? '/relay/worker.mjs 를 그대로 내준다 — 사이트가 줄 이유가 없는 파일이다'
      : '' },
  { id: 'headers-parity', need: 'file:_headers', sev: 'mid',
    want: '_headers 가 존 룰과 같은 헤더를 건다',
    test: src => {
      const gone = missing(src, 'Strict-Transport-Security', 'X-Content-Type-Options',
                                'X-Frame-Options', 'Referrer-Policy',
                                'Permissions-Policy', 'Content-Security-Policy');
      return gone.length ? `_headers 에 빠진 헤더: ${gone.join(', ')}` : '';
    } },
  { id: 'origin-allowlist', need: 'file:relay/worker.mjs', sev: 'high',
    want: 'allowedOrigin 이 아무나 통과시키지 않는다',
    test: src => {
      const list = /const SITE = \[([^\]]*)\]/.exec(src)?.[1];
      if (!list) return 'SITE 목록을 찾지 못했다 — 룰이 낡았거나 목록이 사라졌다';
      const hosts = [...list.matchAll(/'([^']+)'/g)].map(m => m[1]);
      const odd = hosts.filter(u => !/^https:\/\/(www\.)?regiontype\.com$/.test(u));
      if (odd.length) return `모르는 출처가 목록에 있다: ${odd.join(', ')}`;
      /* '어디서 왔든 통과' 로 쓰이는 모양들 */
      if (/allowedOrigin\s*=\s*\(?\s*\w*\s*\)?\s*=>\s*true/.test(src))
        return 'allowedOrigin 이 무조건 true 다';
      return '';
    } },
  /* ── 계정 ──────────────────────────────────────────────
     이 값은 Cloudflare MCP 에서 떠 온다 — 스케줄이 workers_list 를 불러
     --facts 로 넘겨준다. 계정에 모르는 워커가 앉아 있으면 여기서 걸린다. */
  { id: 'workers-known', need: 'cf:workers', sev: 'high',
    want: '계정에 아는 워커 둘뿐 (regiontype-com · rt-feedback)',
    test: names => {
      const known = ['regiontype-com', 'rt-feedback'];
      const odd = names.filter(n => !known.includes(n));
      const gone = known.filter(n => !names.includes(n));
      return [odd.length ? `모르는 워커: ${odd.join(', ')}` : '',
              gone.length ? `사라진 워커: ${gone.join(', ')}` : ''].filter(Boolean).join(' / ');
    } },

  { id: 'token-stays-server', need: 'file:app.js', sev: 'high',
    want: 'GH_TOKEN 은 워커 안에만 — 브라우저 코드에는 없다',
    test: src => {
      if (/GH_TOKEN/.test(src)) return 'app.js 가 GH_TOKEN 을 입에 올린다';
      if (/api\.github\.com\/repos\/[^'"`]*\/issues/.test(src) && /authorization/i.test(src))
        return 'app.js 가 GitHub API 에 직접 인증을 건다';
      return '';
    } },
];

/* 값이 없는 룰은 '지나감' 으로 남긴다 — 토큰이 없거나 네트워크가 끊긴 실행에서
   빠진 검사가 통과처럼 보이면 안 된다. */
export function check(facts, rules = RULES) {
  return rules.map(r => {
    const got = facts[r.need];
    if (got === undefined) return { id: r.id, sev: r.sev, want: r.want, state: 'skip',
                                    why: `${r.need} 을 뜨지 못했다` };
    let why;
    try { why = r.test(got); }
    catch (e) { return { id: r.id, sev: r.sev, want: r.want, state: 'skip',
                         why: `룰이 깨졌다: ${e.message}` }; }
    return { id: r.id, sev: r.sev, want: r.want, state: why ? 'fail' : 'pass', why };
  });
}

/* 한 판의 성적. high 가 하나라도 깨지면 exit 1 — 나머지는 세어서 보여만 준다. */
export const tally = res => ({
  pass: res.filter(r => r.state === 'pass').length,
  fail: res.filter(r => r.state === 'fail').length,
  skip: res.filter(r => r.state === 'skip').length,
  high: res.filter(r => r.state === 'fail' && r.sev === 'high').length,
});
