// POST /agent/feedback — 봇이 커뮤니티에 '제안'(tag idea) 글을 올린다.
// 인증: Authorization: Bearer <AGENT_FEEDBACK_KEY>. 키당 시간당 10건.
// 본문·키는 로그에 남기지 않는다.
const PATH = '/agent/feedback';
const LIMIT = 10;              // 키당 시간당
const WHO = 'odd_bot';         // profile.who. 사람 id(hex 32자)와 겹칠 수 없다. migrate.sql 이 Oddbot 프로필을 넣는다
const TITLE_MAX = 60, BODY_MAX = 2000; // schema.sql post 와 같은 한도
const enc = new TextEncoder();

const json = (s, v, h = {}) => new Response(JSON.stringify(v), {
  status: s, headers: { 'content-type': 'application/json; charset=utf-8', ...h },
});

async function sha(s) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}
// 길이 차이도 새지 않게 두 해시를 비교한다
async function same(a, b) {
  const [x, y] = await Promise.all([sha(a), sha(b)]);
  return crypto.subtle.timingSafeEqual(x, y);
}
const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
const clean = (v, max) => typeof v === 'string'
  ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim()
  : '';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== PATH) return json(404, { error: 'not found' });
    if (req.method !== 'POST') return json(405, { error: 'method' }, { allow: 'POST' });

    const key = env.AGENT_FEEDBACK_KEY;
    if (!key) return json(503, { error: 'nokey' });
    const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
    if (!m || !(await same(m[1], key))) return json(401, { error: 'auth' });

    if (!(req.headers.get('content-type') || '').includes('application/json'))
      return json(415, { error: 'json' });
    const raw = await req.text();
    if (raw.length > 16384) return json(413, { error: 'size' });
    let c; try { c = JSON.parse(raw); } catch { return json(400, { error: 'json' }); }
    const title = clean(c?.title), body = clean(c?.body);
    if (!title || !body || [...title].length > TITLE_MAX || [...body].length > BODY_MAX)
      return json(400, { error: 'title 1-60, body 1-2000' });

    const now = Math.floor(Date.now() / 1000), hr = Math.floor(now / 3600);
    const k = hex(await sha(m[1])).slice(0, 32);
    const row = await env.DB.prepare(
      `insert into agent_rate (k, hr, n) values (?, ?, 1)
       on conflict (k, hr) do update set n = n + 1 returning n`).bind(k, hr).first();
    if (row.n === 1) await env.DB.prepare('delete from agent_rate where hr < ?').bind(hr - 24).run();
    if (row.n > LIMIT)
      return json(429, { error: 'rate' }, { 'retry-after': String((hr + 1) * 3600 - now) });

    // 분류는 클라이언트 값과 상관없이 'idea'(제안) 로 고정
    const r = await env.DB.prepare(
      `insert into post (who, tag, title, body, at, author_type)
       values (?, 'idea', ?, ?, ?, 'bot') returning id`)
      .bind(WHO, title, body, Date.now()).first();
    return json(201, { id: r.id, tag: 'idea', author_type: 'bot' });
  },
};
