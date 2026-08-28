/* regiontype 피드백 중계기 — 사이트가 보낸 JSON 을 GitHub 이슈로 옮긴다.
   정적 사이트에 토큰을 둘 수 없어서 존재한다. 하는 일은 그것뿐이다.

       wrangler secret put GH_TOKEN     // 그 저장소의 Issues 쓰기만 가진 세밀 토큰
       wrangler deploy                                                        */

const REPO = 'pistolinkr/regiontype.com';
const SITE = ['https://regiontype.com', 'https://www.regiontype.com'];
const KIND = { bug: '버그', idea: '제안', data: '지명·정보 오류' };
const CAP = { body: 500, from: 120, v: 16, href: 300, ua: 300 };

const cut = (s, n) => String(s ?? '').trim().slice(0, n);
/* 메타 한 줄에 들어갈 값. 백틱과 줄바꿈을 빼야 코드 블록을 뚫고 나오지 못한다 */
const flat = (s, n) => cut(s, n).replace(/[`\r\n]/g, ' ');
/* Origin 은 curl 로 얼마든 꾸며낼 수 있다 — 문지기가 아니라 CORS 예의일 뿐이라
   로컬도 그냥 통과시킨다. 실제로 막는 건 아래 IP 창이다. */
const mine = o => SITE.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

/* 이슈 한 장을 짓는다. 사이트의 GitHub 초안 경로와 같은 모양이라
   중계기를 켜기 전후로 이슈가 달라 보이지 않는다. */
export function compose(c) {
  const kind = KIND[c.kind] ? c.kind : 'bug';
  const body = cut(c.body, CAP.body);
  const meta = [`종류: ${KIND[kind]}`, `버전: ${flat(c.v, CAP.v)}`,
                `주소: ${flat(c.href, CAP.href)}`, `브라우저: ${flat(c.ua, CAP.ua)}`];
  /* 회신 주소는 공개 이슈에 남는다. @ 를 풀어 긁어가기만 어렵게 해 둔다 */
  const from = flat(c.from, CAP.from);
  if (from) meta.push(`회신: ${from.replace('@', ' [at] ')}`);
  return {
    title: `[${KIND[kind]}] ${body.split('\n')[0].slice(0, 60)}`,
    /* 메타는 코드 블록에 가둔다 — 남이 보낸 값이 이슈 마크다운으로 살아나지 않게 */
    body: `${body}\n\n---\n\`\`\`\n${meta.join('\n')}\n\`\`\``,
    labels: [KIND[kind]],
    ok: !!body,
  };
}

const head = o => ({
  'access-control-allow-origin': mine(o) ? o : SITE[0],
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
});
const reply = (status, msg, o) =>
  new Response(JSON.stringify({ ok: status < 300, msg }),
    { status, headers: { 'content-type': 'application/json', ...head(o) } });

export default {
  async fetch(req, env) {
    const o = req.headers.get('origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: head(o) });
    if (req.method !== 'POST') return reply(405, 'POST 만 받습니다.', o);
    if (!mine(o)) return reply(403, '허용된 곳이 아닙니다.', o);

    /* ponytail: 캐시로 만든 거친 IP 창 — 엣지마다 따로 센다. 한 사람이 한 곳에서
       퍼붓는 걸 막는 게 목적이라 이 정도면 된다. 정확히 세야 할 만큼 시달리면
       Rate Limiting 바인딩이나 KV 로 올린다. */
    const ip = req.headers.get('cf-connecting-ip') || '?';
    const key = new Request(`https://rl.regiontype/${encodeURIComponent(ip)}`);
    if (await caches.default.match(key)) return reply(429, '조금 뒤에 다시 보내주세요.', o);

    let c;
    try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
    const issue = compose(c);
    if (!issue.ok) return reply(400, '내용이 비어 있습니다.', o);

    /* 창은 GitHub 을 부르기 *전에* 닫는다 — 동시에 퍼붓는 게 정확히 그 공격이다 */
    await caches.default.put(key, new Response('1', { headers: { 'cache-control': 'max-age=60' } }));

    const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GH_TOKEN}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'regiontype-feedback',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: issue.title, body: issue.body, labels: issue.labels }),
    });
    if (!r.ok) return reply(502, 'GitHub 이 받지 않았습니다. 잠시 뒤 다시 시도해 주세요.', o);
    return reply(201, '고맙습니다', o);
  },
};
