/* 경쟁전 실시간 서버 — Durable Object 둘. 판정은 전부 compete.mjs 의 step 이 하고, 여기는 소켓과
   시계와 저장만 맡는다. 브라우저는 입력을 보내고 그림을 그릴 뿐 승패를 정하지 않는다.

   CompeteLobby  하나(idFromName('lobby')). 일회용 표로 들어온 소켓을 줄에 세우고, 같은 줄의 짝을
                 찾으면 판 DO 를 만들어 두 사람에게 match.found 를 보낸다. 줄은 소켓 첨부(attachment)에
                 적어 둔다 — 잠들었다 깨어도(Hibernation) 그대로 남는다.
   CompeteMatch  판 하나에 하나(idFromName(matchId)). 판 토큰으로 붙은 두 소켓의 입력을 리듀서에 넣고,
                 카운트다운·판 동안만 100ms 박자(setInterval)를 돌린다. 끝나면 박자를 걷고 D1 에 적는다 —
                 그 뒤로는 깨울 일이 없어 잠든다.

   판을 치르는 사람(who)은 로비에 b:<who> 로 적혀 다시 줄에 못 선다. 판 DO 가 판을 적고 나면(/free) 풀린다.

   소켓은 둘 다 같은 규칙이다: 연 뒤 NET.authMs 안에 auth 가 와야 하고, 그 전 메시지는 전부 버린다.
   Origin 은 이 문 앞(worker.mjs 의 mine())에서 이미 걸렀다.
   ponytail: 로비는 전역 하나다. 동시 대기자가 수천이 되면 기기·모드별 로비로 나눈다. */
import { NET, ABORT_PENALTY, RANKED_POOL, SPRINT, TERRITORY, BOT, RATING, MATCH, RETRO, KEEP } from './compete-config.mjs';
import { newMatch, step, parseMsg, countKeys, progress, audit } from './compete.mjs';
import { makeBot, timeline, itemPlan, due, baseTable, calibrate, regress, withMult } from './compete-bot.mjs';
import { fresh, rate as glicko, idle, blend, reset, display, tier } from './glicko.mjs';
import { NAMES } from './names.mjs';
import { rand } from './auth.mjs';

const send = (ws, msg) => { try { ws.send(JSON.stringify(msg)); } catch {} };
const att = ws => { try { return ws.deserializeAttachment() || {}; } catch { return {}; } };

/* 소켓마다 1초에 받는 메시지 수. 메모리에만 둔다 — 잠들면 셈이 처음부터인 것으로 충분하다 */
const rate = new WeakMap();
function flood(ws, now) {
  const r = rate.get(ws);
  if (!r || now - r.t >= 1000) { rate.set(ws, { t: now, n: 1 }); return false; }
  return ++r.n > NET.maxMsgPerSec;
}
/* 인증 안 한 채 authMs 를 넘긴 소켓을 닫는다. 다음에 볼 시각을 돌려준다 */
function sweep(ctx, now) {
  let next = Infinity;
  for (const ws of ctx.getWebSockets()) {
    const a = att(ws);
    if (a.ok) continue;
    if (now - a.at >= NET.authMs) { try { ws.close(1008, 'auth'); } catch {} }
    else next = Math.min(next, a.at + NET.authMs);
  }
  return next;
}
async function arm(ctx, t) {
  if (!(t < Infinity)) return;
  const cur = await ctx.storage.getAlarm();
  if (cur === null || t < cur) await ctx.storage.setAlarm(t);
}
const upgrade = (self, req) => {
  const [client, server] = Object.values(new WebSocketPair());
  return self.accept(server).then(() => new Response(null, { status: 101, webSocket: client }));
};

/* ── 시즌·레이팅(D1) ── */
/** 지금 시즌 — starts_at ≤ now < ends_at. 없으면 랭크전이 닫힌다 */
export const seasonAt = (db, now) => db.prepare(
  'select id, kind, reset from seasons where starts_at <= ? and ends_at > ? order by starts_at desc limit 1').bind(now, now).first();
/** 이 시즌의 내 레이팅 { p, games, wins }. 줄이 없으면 앞 시즌 줄을 시즌 넘김 규칙(reset)으로 넘기고, 앞 시즌도
 *  없으면 초기값이다. 쉰 기간(periodDays)만큼 RD 를 키워 준다. 읽기만 한다 — 쓰는 건 판이 끝날 때 한 번 */
export async function ratingOf(db, who, dev, season, now) {
  const row = await db.prepare('select mu, rd, sigma, games, wins, last_played_at from player_ratings where who = ? and dev = ? and season_id = ?')
    .bind(who, dev, season.id).first();
  if (row) {
    const n = row.last_played_at ? Math.floor((now - row.last_played_at) / (RATING.periodDays * 864e5)) : 0;
    return { p: idle({ r: row.mu, rd: row.rd, sigma: row.sigma }, n), games: row.games, wins: row.wins };
  }
  const prev = await db.prepare('select mu, rd, sigma from player_ratings where who = ? and dev = ? and season_id < ? order by season_id desc limit 1')
    .bind(who, dev, season.id).first();
  return { p: prev ? reset({ r: prev.mu, rd: prev.rd, sigma: prev.sigma }, season.reset) : fresh(), games: 0, wins: 0 };
}
/** 봇 CPM 표(기기별) = 기본 표(cpm) × 배율(mult). bot_calib 에 없으면 기본 표 */
export async function calibTable(db, dev) {
  const rows = db ? (await db.prepare('select rating, cpm, mult from bot_calib where dev = ? order by rating').bind(dev).all()).results : [];
  return rows.length ? withMult(rows.map(x => [x.rating, x.cpm]), rows.map(x => [x.rating, x.mult])) : baseTable(dev);
}
/** 랭크전에 보이는 이름 — 브라우저가 보낸 이름이 아니라 계정 프로필. 비공개(shut)면 비운다 */
async function profileName(db, who) {
  const p = db ? await db.prepare('select name, handle, shut from profile where who = ?').bind(who).first() : null;
  return !p || p.shut ? '' : p.name || p.handle || '';
}
/** 판 하나가 붙잡아 둘 수 있는 가장 긴 시간 — 로비의 b:<who> 가 저절로 풀리는 시각 */
const holdMs = mode => NET.joinMs + (mode === 'sprint' ? SPRINT : TERRITORY).countdownMs
  + (mode === 'sprint' ? SPRINT : TERRITORY).secs * 1000 + NET.reconnectMs + NET.busyGraceMs;
/** 허용폭 — 기다린 만큼 넓어진다 */
export const windowOf = waited => Math.min(MATCH.window + MATCH.widenBy * Math.floor(waited / MATCH.widenEvery), MATCH.windowMax);
const tierName = (p, games) => tier(p, games)?.name ?? null;

export class CompeteLobby {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.tables = {}; }
  now() { return Date.now(); }

  async fetch(req) {
    if (req.headers.get('upgrade') === 'websocket') return upgrade(this, req);
    /* /ticket 은 worker.mjs 만 부른다 — 바깥 요청은 업그레이드만 여기까지 온다 */
    if (new URL(req.url).pathname === '/ticket' && req.method === 'POST') {
      const c = await req.json(), t = rand(24), exp = this.now() + NET.ticketMs;
      await this.ctx.storage.put('t:' + t, { who: c.who, name: c.name, dev: c.dev, guest: !!c.guest, exp });
      await arm(this.ctx, exp);
      return Response.json({ ticket: t });
    }
    /* 판 DO 가 판을 적었다(또는 무름) — 그 판으로 잡아 둔 사람을 푼다 */
    if (new URL(req.url).pathname === '/free' && req.method === 'POST') {
      const c = await req.json();
      for (const who of c.who) if ((await this.ctx.storage.get('b:' + who))?.m === c.m) await this.ctx.storage.delete('b:' + who);
      return new Response(null, { status: 204 });
    }
    /* 검토 큐 — worker.mjs 가 관리자(ADMIN_IDS)인지 본 뒤에만 넘긴다 */
    if (new URL(req.url).pathname === '/flags') {
      if (req.method === 'GET') return Response.json({ flags: await flagQueue(this.env.DB) });
      if (req.method === 'POST') return Response.json(await review(this.env.DB, await req.json(), this.now()));
    }
    return new Response('not found', { status: 404 });
  }

  async accept(ws) {
    this.ctx.acceptWebSocket(ws);
    ws.serializeAttachment({ at: this.now(), ok: false });
    await arm(this.ctx, this.now() + NET.authMs);
  }

  /* 알람: 인증 안 한 소켓 · 지난 표 · 풀린 판 잡기(b:)를 걷고, 줄이 있으면 짝을 다시 찾는다(허용폭이 넓어졌다) */
  async alarm() {
    const now = this.now();
    let next = sweep(this.ctx, now);
    const gone = [];
    for (const prefix of ['t:', 'b:']) for (const [k, v] of await this.ctx.storage.list({ prefix })) {
      if (v.exp <= now) gone.push(k); else next = Math.min(next, v.exp);
    }
    if (gone.length) await this.ctx.storage.delete(gone);
    if (await this.pairUp(now)) next = Math.min(next, now + MATCH.sweepMs);
    await arm(this.ctx, next);
  }

  async webSocketMessage(ws, raw) {
    if (flood(ws, this.now())) { try { ws.close(1008, 'flood'); } catch {} return; }
    const m = parseMsg(raw), a = att(ws);
    if (!m) return;
    if (!a.ok) {
      if (m.type !== 'auth') return;
      const k = 't:' + m.key, t = await this.ctx.storage.get(k);
      if (!t || t.exp <= this.now()) { try { ws.close(1008, 'ticket'); } catch {} return; }
      await this.ctx.storage.delete(k);   // 한 번 쓰면 끝
      ws.serializeAttachment({ ...a, ok: true, who: t.who, name: t.name, dev: t.dev, guest: t.guest, q: null });
      return send(ws, { type: 'lobby.ok', guest: t.guest });
    }
    if (m.type === 'ping') return send(ws, { type: 'pong', t: m.t, s: this.now() });
    if (m.type === 'queue.leave') { ws.serializeAttachment({ ...a, q: null }); return send(ws, { type: 'queue.left' }); }
    if (m.type === 'queue.join') return this.join(ws, a, m);
  }
  webSocketClose(ws, code) { try { ws.close(code, 'bye'); } catch {} }
  webSocketError() {}

  /* 줄에 선다. 랭크는 지금 시즌의 내 r 을 줄에 적는다 — 짝은 r 로 찾고(허용폭), 봇은 r ±botSpread 다 */
  async join(ws, a, m) {
    if (m.ranked && a.guest) return send(ws, { type: 'queue.error', code: 'login' });
    if (m.ranked && m.mode !== 'sprint') return send(ws, { type: 'queue.error', code: 'mode' });
    const slugs = m.ranked ? RANKED_POOL : Object.hasOwn(NAMES, m.slug) ? [m.slug] : null;
    if (!slugs) return send(ws, { type: 'queue.error', code: 'course' });
    const now = this.now();
    /* 판을 치르는 중이면 줄에 못 선다(다른 탭) — 두 판이 겹치면 레이팅이 나중 판으로 덮인다 */
    const busy = await this.ctx.storage.get('b:' + a.who);
    if (busy && busy.exp > now) return send(ws, { type: 'queue.error', code: 'busy', matchId: busy.m });
    const until = await this.penalty(a);
    if (until) return send(ws, { type: 'queue.penalty', until });
    let season = null, me = null;
    if (m.ranked) {
      season = this.env.DB ? await seasonAt(this.env.DB, now) : null;
      if (!season) return send(ws, { type: 'queue.error', code: 'season' });
      me = await ratingOf(this.env.DB, a.who, a.dev, season, now);
    }
    /* 랭크전 이름은 계정 프로필에서. 게스트·캐주얼전은 표에 실린 이름 그대로 */
    const name = m.ranked ? await profileName(this.env.DB, a.who) : a.name;
    const q = { name, key: [m.mode, m.ranked ? 'r' : 'c', a.dev, m.ranked ? '' : m.slug].join('|'), at: now, mode: m.mode, ranked: m.ranked,
      slugs, season: season?.id ?? null, r: me ? me.p.r : RATING.mu0, rd: me ? me.p.rd : RATING.rd0, games: me?.games ?? 0, offered: false };
    /* 같은 사람의 다른 탭 줄은 걷는다 — 자기 자신과 짝이 되지 않게 */
    for (const o of this.ctx.getWebSockets()) {
      const b = att(o);
      if (o !== ws && b.ok && b.q && b.who === a.who) o.serializeAttachment({ ...b, q: null });
    }
    ws.serializeAttachment({ ...a, q });
    if (m.bot) return this.botFor(ws, now);
    if (!(await this.pairUp(now, ws))) return;
    send(ws, { type: 'queue.waiting', n: this.queued(q.key), window: q.ranked ? windowOf(0) : null });
    await arm(this.ctx, now + MATCH.sweepMs);
  }
  queued(key) { return this.ctx.getWebSockets().filter(o => att(o).q?.key === key).length; }

  /* 줄 전체에서 짝을 찾는다: 같은 줄, 오래 기다린 순. 랭크는 |r 차| 가 두 사람 허용폭 모두의 안이어야 한다.
     짝이 없고 botOfferMs 를 넘긴 사람에게는 봇을 권한다(autoBot 이면 바로 붙인다).
     줄이 남아 있으면 true(알람을 다시 건다). me 가 있으면 그 소켓이 아직 줄에 있는지로 돌려준다 */
  async pairUp(now, me) {
    const qs = this.ctx.getWebSockets().map(ws => ({ ws, a: att(ws) })).filter(x => x.a.ok && x.a.q).sort((x, y) => x.a.q.at - y.a.q.at);
    const used = new Set();
    for (const x of qs) {
      if (used.has(x.ws)) continue;
      const wx = windowOf(now - x.a.q.at);
      const y = qs.find(y => y !== x && !used.has(y.ws) && y.a.q.key === x.a.q.key && y.a.who !== x.a.who
        && (!x.a.q.ranked || Math.abs(x.a.q.r - y.a.q.r) <= Math.min(wx, windowOf(now - y.a.q.at))));
      if (!y) continue;
      used.add(x.ws); used.add(y.ws);
      /* 판 DO 에 넘기기 전에(await 전에) 두 줄을 먼저 걷는다 — 그 사이 다른 짝 찾기가 같은 사람을 못 집는다 */
      x.ws.serializeAttachment({ ...x.a, q: null }); y.ws.serializeAttachment({ ...y.a, q: null });
      await this.make([[x.ws, x.a], [y.ws, y.a]], x.a.q);
    }
    let left = false;
    for (const x of qs) {
      if (used.has(x.ws)) continue;
      left = true;
      if (now - x.a.q.at < MATCH.botOfferMs || x.a.q.offered) continue;
      if (MATCH.autoBot) { await this.botFor(x.ws, now); continue; }
      x.ws.serializeAttachment({ ...x.a, q: { ...x.a.q, offered: true } });
      send(x.ws, { type: 'queue.botOffer', waited: now - x.a.q.at });
    }
    return me ? !!att(me).q : left;
  }

  async botFor(ws, now) {
    const a = att(ws), q = a.q;
    ws.serializeAttachment({ ...a, q: null });
    const spread = q.ranked ? MATCH.botSpread : BOT.ratingJitter, base = q.ranked ? q.r : BOT.rating;
    const rating = Math.round(base + (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 * 2 - 1) * spread);
    this.tables[a.dev] ??= { at: 0 };
    if (now - this.tables[a.dev].at > 600000) this.tables[a.dev] = { at: now, t: await calibTable(this.env.DB, a.dev) };
    return this.make([[ws, a]], q, { rating, table: this.tables[a.dev].t });
  }

  /* pair 가 한 사람이면 봇 판이다(bot 에 레이팅과 CPM 표). 상대 정보는 이름 · 티어(배치 중이면 null) · 봇 여부 */
  async make(pair, q, bot) {
    const id = rand(18), u32 = () => crypto.getRandomValues(new Uint32Array(1))[0], seed = u32();
    const players = pair.map(([, x]) => ({ pid: rand(9), who: x.who, name: x.q.name ?? x.name, dev: x.dev, guest: x.guest, token: rand(24),
      tier: q.ranked ? tierName({ r: x.q.r, rd: x.q.rd }, x.q.games) : null }));
    if (bot) players.push({ pid: rand(9), bot: true, name: BOT.name, dev: players[0].dev, botSeed: u32(), rating: bot.rating, table: bot.table,
      tier: q.ranked ? tierName({ r: bot.rating, rd: RATING.botRd }, RATING.placement) : null });
    /* 붙이기 전에 잡는다 — 판 DO 를 기다리는 사이에 다른 탭이 줄에 서지 못하게. 못 만들면 바로 푼다 */
    const hold = players.filter(p => !p.bot && !p.guest).map(p => 'b:' + p.who), exp = this.now() + holdMs(q.mode);
    await this.ctx.storage.put(Object.fromEntries(hold.map(k => [k, { m: id, exp }])));
    await arm(this.ctx, exp);
    let ok = false;
    try {
      const r = await this.env.MATCH.get(this.env.MATCH.idFromName(id)).fetch(new Request('https://match/init', { method: 'POST',
        body: JSON.stringify({ id, mode: q.mode, ranked: q.ranked, season: q.season, dev: players[0].dev, slugs: q.slugs, seed, players }) }));
      ok = r.ok;
    } catch {}
    if (!ok) await this.ctx.storage.delete(hold);
    pair.forEach(([ws], i) => { const o = players.find((_, k) => k !== i);
      send(ws, ok
        ? { type: 'match.found', matchId: id, token: players[i].token, you: players[i].pid, seed, mode: q.mode, ranked: q.ranked, slugs: q.slugs,
            opponent: { name: o.name, tier: o.tier, isBot: !!o.bot } }
        : { type: 'queue.error', code: 'server' }); });
  }

  /* 카운트다운 중 이탈이 24시간에 ABORT_PENALTY.count 번이면 마지막 이탈에서 waitMs 동안 못 선다 */
  async penalty(a) {
    if (a.guest || !this.env.DB) return 0;
    const now = this.now();
    const r = await this.env.DB.prepare(`select count(*) as n, max(m.ended_at) as last from match_participants p
        join matches m on m.id = p.match_id where p.who = ? and p.result = 'abort' and p.quit = 1 and m.ended_at > ?`)
      .bind(a.who, now - ABORT_PENALTY.windowMs).first();
    return r && r.n >= ABORT_PENALTY.count && now < r.last + ABORT_PENALTY.waitMs ? r.last + ABORT_PENALTY.waitMs : 0;
  }
}

const ACTIVE = new Set(['COUNTDOWN', 'PLAYING']);
const DONE = new Set(['FINISHED', 'RESULTS']);

export class CompeteMatch {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.timer = null; this.busy = false; this.kn = {}; this.kbuf = {};
    this.meta = null; this.s = null;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get('meta')) ?? null;
      this.s = (await ctx.storage.get('s')) ?? null;
    });
  }
  now() { return Date.now(); }

  async fetch(req) {
    await this.ready;
    if (req.headers.get('upgrade') === 'websocket') {
      /* 로비가 만들지 않은 판 id 로는 아무것도 남기지 않고 돌려보낸다 */
      if (!this.meta) return new Response('no match', { status: 404 });
      return upgrade(this, req);
    }
    if (new URL(req.url).pathname === '/init' && req.method === 'POST') {
      if (this.meta) return new Response('exists', { status: 409 });
      const c = await req.json();
      this.s = newMatch({ mode: c.mode, seed: c.seed, players: c.players.map(p => p.pid), slugs: c.slugs });
      this.meta = { ...c, joinBy: this.now() + NET.joinMs, seen: {}, gone: {}, saved: false, closeAt: null };
      for (const p of c.players) if (p.bot) this.s = step(this.s, { type: 'ready', pid: p.pid }, this.now()).state;
      await this.ctx.storage.put({ meta: this.meta, s: this.s });
      await arm(this.ctx, this.meta.joinBy);
      return new Response(null, { status: 201 });
    }
    return new Response('not found', { status: 404 });
  }

  async accept(ws) {
    this.ctx.acceptWebSocket(ws);
    ws.serializeAttachment({ at: this.now(), ok: false });
    await arm(this.ctx, this.now() + NET.authMs);
  }

  sockets(pid) { return this.ctx.getWebSockets().filter(ws => { const a = att(ws); return a.ok && (pid === undefined || a.pid === pid); }); }
  deliver(out) {
    for (const o of out) for (const ws of this.sockets(o.to === 'all' ? undefined : o.to)) send(ws, o.msg);
  }
  /* 판의 지금 모습 — 붙거나 다시 붙은 사람에게 통째로 준다 */
  snapshot(pid) {
    const s = this.s, other = this.meta.players.find(p => p.pid !== pid);
    const { stats, ...result } = s.result ?? {};
    return { type: 'match.state', phase: s.phase, you: pid, mode: s.mode, items: s.items, startAt: s.startAt,
      opponent: { name: other.name, tier: null, isBot: !!other.bot }, progress: progress(s),
      ...(s.owner ? { owner: s.owner } : {}),
      ...(s.result ? { result: { ...result, stats: Object.fromEntries(Object.entries(stats).map(([k, x]) =>
        [k, { cpm: x.cpm, acc: x.acc, strokes: x.strokes, items: x.items, value: x.value }])) } } : {}) };
  }

  async webSocketMessage(ws, raw) {
    await this.ready;
    const now = this.now();
    if (flood(ws, now)) { try { ws.close(1008, 'flood'); } catch {} return; }
    const m = parseMsg(raw), a = att(ws);
    if (!m || !this.meta) return;
    if (!a.ok) {
      if (m.type !== 'auth') return;
      const p = this.meta.players.find(x => x.token === m.key);
      if (!p) { try { ws.close(1008, 'token'); } catch {} return; }
      /* 같은 사람이 다른 탭으로 다시 붙으면 옛 소켓을 닫는다 */
      for (const o of this.sockets(p.pid)) { try { o.close(4000, 'replaced'); } catch {} }
      ws.serializeAttachment({ ...a, ok: true, pid: p.pid });
      this.meta.seen[p.pid] = true;
      delete this.meta.gone[p.pid];
      await this.ctx.storage.put('meta', this.meta);
      send(ws, this.snapshot(p.pid));
      return;
    }
    if (m.type === 'ping') return send(ws, { type: 'pong', t: m.t, s: now });
    return this.ingest(a.pid, m, now);
  }

  /* 사람의 소켓과 봇이 같이 쓰는 입력 길. 판정은 리듀서만 한다 */
  async ingest(pid, m, now) {
    switch (m.type) {
      case 'match.ready': return this.apply({ type: 'ready', pid }, true);
      case 'input.commit': await this.apply({ type: 'commit', pid, i: m.itemIndex, text: m.text }, true); return this.flush();
      case 'input.paste': return this.apply({ type: 'paste', pid }, true);
      case 'input.keys': {
        if (this.s.phase !== 'PLAYING') return;
        /* 날 키 기록(리플레이·부정 분석)은 메모리에 모았다가 확정 때와 단계가 바뀔 때 몰아서 적는다 —
           묶음마다 적으면 쓰기 값이 키 수만큼 든다. DO 가 그 사이 쫓겨나면 마지막 확정 뒤 키만 잃는다 */
        if (!this.isBot(pid)) (this.kbuf[pid] ??= []).push({ at: now, i: m.itemIndex, events: m.events });
        return this.apply({ type: 'keys', pid, ...countKeys(m.events) }, false);
      }
    }
  }
  /* 모아 둔 키 묶음을 사람마다 한 줄씩 적는다 */
  async flush() {
    const put = {};
    for (const [pid, list] of Object.entries(this.kbuf)) {
      if (!list.length) continue;
      this.kn[pid] ??= (await this.ctx.storage.list({ prefix: `k:${pid}:` })).size;
      put[`k:${pid}:${String(this.kn[pid]++).padStart(6, '0')}`] = list;
    }
    this.kbuf = {};
    if (Object.keys(put).length) await this.ctx.storage.put(put);
  }

  async webSocketClose(ws, code) {
    try { ws.close(code, 'bye'); } catch {}
    await this.ready;
    const a = att(ws);
    if (!a.ok || !this.meta || DONE.has(this.s.phase) || this.sockets(a.pid).some(o => o !== ws)) return;
    /* 카운트다운 전·중에 끊겼으면 유예가 끝날 때 판을 무른다(레이팅 없음) */
    this.meta.gone[a.pid] = { at: this.now(), early: this.s.phase !== 'PLAYING' };
    await this.ctx.storage.put('meta', this.meta);
    await arm(this.ctx, this.now() + NET.reconnectMs);
  }
  webSocketError(ws) { return this.webSocketClose(ws, 1011); }

  /* 리듀서 한 걸음. save 면 상태를 저장한다(준비·확정·이탈·단계 바뀜) */
  async apply(ev, save) {
    const was = this.s.phase;
    const { state, out } = step(this.s, ev, this.now());
    this.s = state;
    this.deliver(out);
    if (state.phase !== was) await this.flush();
    if (save || state.phase !== was) await this.ctx.storage.put('s', this.s);
    await this.pace();
  }

  /* 판이 도는 동안만 박자를 둔다. 끝나면 박자를 걷는다 — 걷지 않으면 DO 가 영영 안 잠든다 */
  async pace() {
    if (ACTIVE.has(this.s.phase)) {
      if (this.timer) return;
      this.timer = setInterval(() => this.tick(), NET.tickMs);
      /* 박자는 DO 가 쫓겨나면 사라진다. 제한 시간에 알람을 하나 걸어 두면 깨어나 이어 간다 */
      await arm(this.ctx, this.s.startAt + (this.s.mode === 'sprint' ? SPRINT : TERRITORY).secs * 1000 + NET.tickMs);
    } else {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      if (this.s.phase === 'FINISHED') await this.finish();
    }
  }

  isBot(pid) { return !!this.meta.players.find(p => p.pid === pid)?.bot; }

  /* 봇의 손. 스프린트는 판이 시작될 때 타임라인 전체를 시드로 짓고(메모리에만 — 브라우저로는 안 나간다),
     박자마다 지난 이벤트를 사람과 같은 메시지로 ingest 에 넣는다. 영토전은 상대가 집은 곳에 따라 다음
     목표가 바뀌어, 항목 하나씩 그때그때 짓는다. 쫓겨났다 깨어나면 seed 로 다시 지어 마지막 확정 뒤부터 잇는다 */
  async feedBot(now) {
    const p = this.meta.players.find(x => x.bot);
    if (!p || this.s.phase !== 'PLAYING') return;
    if (!this.bot) {
      const hand = makeBot({ seed: p.botSeed, rating: p.rating, dev: p.dev, items: this.s.items, ...(p.table ? { table: p.table } : {}) });
      if (this.s.mode === 'sprint') {
        const events = timeline(hand, this.s.items, this.s.startAt), last = this.s.players[p.pid].last ?? this.s.startAt;
        const from = events.findIndex(e => e.t > last);
        this.bot = { hand, events, from: from < 0 ? events.length : from };
      } else this.bot = { hand, events: [], from: 0, target: -1 };
    }
    const b = this.bot;
    if (this.s.mode === 'territory') {
      const lost = b.target >= 0 && this.s.owner[b.target] !== null && this.s.owner[b.target] !== p.pid;
      if (b.from >= b.events.length || lost) {
        const free = this.s.owner.map((o, i) => o === null ? i : -1).filter(i => i >= 0);
        if (!free.length) return;
        b.target = free[Math.floor(b.hand.r() * free.length)];
        /* 치던 곳을 상대가 먼저 집었으면 알아채는 만큼 쉬고 다른 곳으로 간다 */
        const start = lost ? now + b.hand.uni(BOT.typo.notice) : now;
        b.events = itemPlan(b.hand, this.s.items[b.target], start).events.map(e => ({ ...e, i: b.target }));
        b.from = 0;
      }
    }
    const { msgs, from } = due(b.events, b.from, now);
    b.from = from;
    for (const m of msgs) { if (this.s.phase !== 'PLAYING') break; await this.ingest(p.pid, m, now); }
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const now = this.now();
      await this.feedBot(now);
      await this.apply({ type: 'tick' }, false);
      await this.expire(now);
      if (this.s.phase === 'PLAYING') {
        const pr = progress(this.s);
        for (const p of this.meta.players) {
          const other = this.meta.players.find(x => x.pid !== p.pid);
          for (const ws of this.sockets(p.pid)) send(ws, { type: 'opponent.progress', ...pr[other.pid], t: now });
        }
      }
      sweep(this.ctx, now);
    } finally { this.busy = false; }
  }

  /* 끊긴 사람의 유예가 지났으면 기권으로 넣는다. 붙을 시간이 지나도록 안 붙은 사람이 있으면 무른다 */
  async expire(now) {
    for (const [pid, g] of Object.entries(this.meta.gone)) {
      if (DONE.has(this.s.phase)) break;
      if (now - g.at >= NET.reconnectMs) { delete this.meta.gone[pid]; await this.apply({ type: 'forfeit', pid, abort: g.early }, true); }
    }
    if (this.s.phase === 'WAITING' && now >= this.meta.joinBy) {
      const absent = this.meta.players.filter(p => !this.s.players[p.pid].ready).map(p => p.pid);
      if (absent.length) {
        const { state, out } = step(this.s, { type: 'forfeit', pid: absent[0] }, now);
        for (const pid of absent) state.players[pid].quit = true;   // 둘 다 안 왔으면 둘 다 무른 쪽이다
        this.s = state;
        this.deliver(out);
        await this.ctx.storage.put('s', this.s);
        await this.pace();
      }
    }
  }

  async alarm() {
    await this.ready;
    const now = this.now();
    let next = sweep(this.ctx, now);
    if (!this.meta) return;
    if (this.meta.closeAt && now >= this.meta.closeAt) {
      for (const ws of this.ctx.getWebSockets()) { try { ws.close(1000, 'closed'); } catch {} }
      await this.ctx.storage.deleteAll();
      this.meta = null;
      return;
    }
    /* 못 적은 판이면 다시 적어 본다 */
    if (this.s.phase === 'FINISHED' && !this.meta.saved) await this.finish();
    if (this.meta.retryAt) next = Math.min(next, this.meta.retryAt);
    await this.expire(now);
    /* 쫓겨났다 깨어난 판이면 박자를 다시 세운다 */
    if (ACTIVE.has(this.s.phase)) { await this.apply({ type: 'tick' }, false); }
    if (this.s.phase === 'WAITING') next = Math.min(next, this.meta.joinBy);
    for (const g of Object.values(this.meta.gone)) next = Math.min(next, g.at + NET.reconnectMs);
    if (this.meta.closeAt) next = Math.min(next, this.meta.closeAt);
    await arm(this.ctx, next);
  }

  /* 끝난 판을 적는다: matches · match_participants · match_logs(키 기록, gzip JSON). 한 batch 라 통째로
     되거나 통째로 안 된다. 실패하면 판을 지우지 않는다 — 저장분(meta · s · 키 기록)을 그대로 두고 알람으로
     다시 시도한다(saveRetryMs 에서 두 배씩, saveRetryMaxMs 까지). 다 적기 전에는 RESULTS 로 넘기지도
     정리(closeAt)하지도 않는다. 문장은 전부 insert or ignore — 응답만 잃은 성공 뒤에 다시 적어도 겹치지 않는다.
     결과는 이미 match.end 로 두 사람에게 갔다 — 저장이 늦어도 화면은 기다리지 않는다 */
  async finish() {
    if (this.meta.saved || this.saving) return;
    const now = this.now();
    if (this.meta.retryAt && now < this.meta.retryAt) return;
    this.saving = true;
    let rated = {};
    try {
      if (this.env.DB) rated = await this.save(now);
    } catch (e) {
      console.error('compete save', this.meta.id, e?.message);
      this.meta.tries = (this.meta.tries ?? 0) + 1;
      this.meta.retryAt = now + Math.min(NET.saveRetryMs * 2 ** (this.meta.tries - 1), NET.saveRetryMaxMs);
      await this.ctx.storage.put('meta', this.meta);
      await arm(this.ctx, this.meta.retryAt);
      return;
    } finally { this.saving = false; }
    this.meta.saved = true;
    this.meta.retryAt = null;
    /* 레이팅은 적힌 뒤에야 알린다 — 적히지 않은 변화를 보여 주지 않는다 */
    for (const [pid, x] of Object.entries(rated)) for (const ws of this.sockets(pid)) send(ws, { type: 'match.rating', ...x });
    this.s = step(this.s, { type: 'close' }, now).state;
    this.meta.closeAt = now + NET.cleanupMs;
    await this.ctx.storage.put({ meta: this.meta, s: this.s });
    await arm(this.ctx, this.meta.closeAt);
    /* 로비에 판이 끝났다고 알려 줄 서기를 푼다. 못 알려도 로비의 b: 가 holdMs 뒤 저절로 풀린다 */
    const who = this.meta.players.filter(p => !p.bot && !p.guest).map(p => p.who);
    if (who.length && this.env.LOBBY) {
      try { await this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby')).fetch('https://lobby/free', { method: 'POST', body: JSON.stringify({ m: this.meta.id, who }) }); } catch {}
    }
  }

  /* 랭크 판이면 레이팅을 같은 batch 에서 쓴다(Glicko-2 한 판 = 한 기간). 상대 값은 판 직전 것.
     봇 판은 봇을 RD botRd 로 보고 변화량의 botFactor 만. 무른 판 · 게스트는 레이팅이 없다.
     player_ratings 는 last_match 로 지킨다 — 응답만 잃은 성공 뒤 다시 적어도 두 번 오르지 않는다.
     부정 의심(flags)이 하나라도 있으면 아무도 레이팅이 바뀌지 않는다: 플래그된 쪽은 검토를 기다리고(review),
     상대는 무효(void, 0). 판 직전 값(mu·rd_before)은 그래도 적는다 — 부정이 확정되면 소급 승리가 그 값을 쓴다.
     돌려주는 값 { pid: { before, after, delta, tier, placement, games, factor } } 은 화면에 보낼 몫.
     배치 중이면 before · after · delta 를 빼고 placement 만 — 표시 레이팅이 RD 따라 크게 출렁여 보이지 않게 */
  async rate(now, flags) {
    const s = this.s, r = s.result, db = this.env.DB, out = {}, stmts = [], mu = {};
    if (!this.meta.ranked || !r.rated || this.meta.season == null) return { out, stmts, mu };
    const season = { id: this.meta.season, ...(await db.prepare('select reset from seasons where id = ?').bind(this.meta.season).first()) };
    const cur = {};
    for (const p of this.meta.players) cur[p.pid] = p.bot ? { p: { r: p.rating, rd: RATING.botRd, sigma: RATING.sigma0 } }
      : await ratingOf(db, p.who, p.dev, season, now);
    const humans = this.meta.players.filter(x => !x.bot && !x.guest);
    if (Object.values(flags).some(f => f.length)) {
      for (const p of humans) {
        mu[p.pid] = { before: cur[p.pid].p, after: null };
        out[p.pid] = flags[p.pid]?.length ? { review: true, delta: 0 } : { void: true, delta: 0 };
      }
      return { out, stmts, mu };
    }
    for (const p of humans) {
      const o = this.meta.players.find(x => x.pid !== p.pid), sc = r.winner === null ? .5 : r.winner === p.pid ? 1 : 0;
      const before = cur[p.pid].p, full = glicko(before, [{ r: cur[o.pid].p.r, rd: cur[o.pid].p.rd, s: sc }]);
      const after = o.bot ? blend(before, full, RATING.botFactor) : full;
      const games = cur[p.pid].games + 1, wins = cur[p.pid].wins + (sc === 1 ? 1 : 0);
      mu[p.pid] = { before, after };
      stmts.push(db.prepare(`insert into player_ratings (who, season_id, dev, mu, rd, sigma, games, wins, placement_done, last_played_at, last_match)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict (who, season_id, dev) do update set mu = excluded.mu, rd = excluded.rd, sigma = excluded.sigma, games = excluded.games,
            wins = excluded.wins, placement_done = excluded.placement_done, last_played_at = excluded.last_played_at, last_match = excluded.last_match
          where player_ratings.last_match is null or player_ratings.last_match <> excluded.last_match`)
        .bind(p.who, season.id, p.dev, after.r, after.rd, after.sigma, games, wins, games >= RATING.placement ? 1 : 0, now, this.meta.id));
      const placement = games < RATING.placement ? { games, of: RATING.placement } : null;
      out[p.pid] = { ...(placement ? {} : { before: display(before), after: display(after), delta: display(after) - display(before) }),
        tier: tier(after, games)?.name ?? null, placement, games, factor: o.bot ? RATING.botFactor : 1 };
    }
    return { out, stmts, mu };
  }

  /* 판을 적기 전에 사람마다 부정 의심을 본다 — 판정 때 선 플래그(keys · paste) + 키 기록 audit.
     같은 저장분에서 같은 답이 나오니 저장을 다시 시도해도 결과가 같다 */
  async save(now) {
    const s = this.s, r = s.result, db = this.env.DB;
    const logs = new Map(), flags = {};
    for (const p of this.meta.players.filter(x => !x.bot)) {
      const batches = [...(await this.ctx.storage.list({ prefix: `k:${p.pid}:` })).values()].flat(), st = r.stats[p.pid];
      flags[p.pid] = [...new Set([...s.players[p.pid].flags, ...audit({ dev: p.dev, log: st.log, batches, cpm: st.cpm, ms: st.ms })])];
      logs.set(p.pid, await gzip(JSON.stringify({ items: st.log, batches })));
    }
    const { out, stmts, mu } = await this.rate(now, flags);
    const res = pid => r.reason === 'abort' ? 'abort' : r.winner === null ? 'draw' : r.winner === pid ? 'win' : 'loss';
    await db.batch([
      db.prepare(`insert or ignore into matches (id, mode, ranked, dev, seed, slugs, season_id, status, reason, started_at, ended_at)
                  values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(this.meta.id, s.mode, this.meta.ranked ? 1 : 0, this.meta.dev, this.meta.seed, JSON.stringify(this.meta.slugs),
              this.meta.season ?? null, r.reason === 'abort' ? 'aborted' : 'done', r.reason, s.startAt, s.endAt ?? now),
      ...this.meta.players.flatMap(p => {
        const st = r.stats[p.pid], who = p.guest || p.bot ? null : p.who;
        return [
          db.prepare(`insert or ignore into match_participants (match_id, pid, who, bot_id, is_bot, result, quit, cpm, accuracy, strokes, items,
                        mu_before, rd_before, mu_after, rd_after, flagged, flag_why) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(this.meta.id, p.pid, who, p.bot ? `bot:${p.rating}` : null, p.bot ? 1 : 0, res(p.pid),
                  s.players[p.pid].quit ? 1 : 0, st.cpm, st.acc, st.strokes, st.items,
                  mu[p.pid]?.before.r ?? null, mu[p.pid]?.before.rd ?? null, mu[p.pid]?.after?.r ?? null, mu[p.pid]?.after?.rd ?? null,
                  flags[p.pid]?.length ? 1 : 0, flags[p.pid]?.join(',') || null),
          /* 봇은 키 기록을 남기지 않는다 — seed 로 다시 지을 수 있다 */
          ...(p.bot ? [] : [db.prepare('insert or ignore into match_logs (match_id, pid, who, keylog, at) values (?, ?, ?, ?, ?)')
            .bind(this.meta.id, p.pid, who, logs.get(p.pid), now)]),
        ];
      }),
      ...stmts,
    ]);
    return out;
  }
}

async function gzip(text) {
  const body = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(body).arrayBuffer());
}

/* ── 소급 승리 ── 부정이 확정된 판의 상대(victim pid)에게 이긴 것으로 한 번 갱신한다. 검토(review)가 부른다.
   돌려주는 값: { applied: true, delta } 또는 { applied: false, why } */
export async function applyRetro(db, matchId, victimPid, now) {
  if (!RETRO.enabled) return { applied: false, why: 'off' };
  const m = await db.prepare('select season_id, ranked from matches where id = ?').bind(matchId).first();
  if (!m || !m.ranked || m.season_id === null) return { applied: false, why: 'match' };
  const season = await seasonAt(db, now);
  if (!season || season.id !== m.season_id) return { applied: false, why: 'season' };
  const v = await db.prepare('select pid, who, retro_applied from match_participants where match_id = ? and pid = ?').bind(matchId, victimPid).first();
  const c = await db.prepare('select who, mu_before, rd_before from match_participants where match_id = ? and pid <> ?').bind(matchId, victimPid).first();
  if (!v?.who || !c?.who || c.mu_before === null) return { applied: false, why: 'player' };
  if (v.retro_applied) return { applied: false, why: 'done' };
  const used = await db.prepare(`select count(*) as n from match_participants p join matches x on x.id = p.match_id
      where p.who = ? and p.retro_applied is not null and x.season_id = ?`).bind(v.who, m.season_id).first();
  if (used.n >= RETRO.perSeason) return { applied: false, why: 'season-limit' };
  const pair = await db.prepare(`select count(*) as n from match_participants p join match_participants q on q.match_id = p.match_id and q.pid <> p.pid
      where p.who = ? and q.who = ? and p.retro_applied is not null`).bind(v.who, c.who).first();
  if (pair.n >= RETRO.perPair) return { applied: false, why: 'pair-limit' };
  const dev = (await db.prepare('select dev from matches where id = ?').bind(matchId).first()).dev;
  const cur = await ratingOf(db, v.who, dev, season, now);
  const after = glicko(cur.p, [{ r: c.mu_before, rd: c.rd_before, s: 1 }]);
  /* 플래그 판은 상대에게 무효였다(판 수에 안 들어감) — 소급 승리가 그 판을 한 판·1승으로 처음 센다. 그 판이 첫 판이면 줄이 없다 */
  const games = cur.games + 1;
  await db.batch([
    db.prepare(`insert into player_ratings (who, season_id, dev, mu, rd, sigma, games, wins, placement_done, last_played_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict (who, season_id, dev) do update set mu = excluded.mu, rd = excluded.rd, sigma = excluded.sigma, games = excluded.games,
                  wins = excluded.wins, placement_done = excluded.placement_done, last_played_at = excluded.last_played_at`)
      .bind(v.who, season.id, dev, after.r, after.rd, after.sigma, games, cur.wins + 1, games >= RATING.placement ? 1 : 0, now),
    db.prepare('update match_participants set retro_applied = ?, mu_after = ?, rd_after = ? where match_id = ? and pid = ? and retro_applied is null')
      .bind(now, after.r, after.rd, matchId, victimPid),
  ]);
  return { applied: true, delta: display(after) - display(cur.p) };
}

/* ── 하루 한 번(rt-compete 의 cron) ── 키 기록 보존 기한 삭제, 그리고 봇 CPM 표 보정. 기기마다:
   기본 표는 사람 판(판 직전 r · CPM)이 regressGames 를 넘으면 regress, 아니면 BOT.cpm. 배율은 지난 calibDays
   동안의 랭크 사람-봇 판으로 어제 배율 위에 calibrate 한다. 플래그된 판은 둘 다에서 뺀다 */
export async function daily(env, now = Date.now()) {
  const db = env.DB;
  if (!db) return;
  await db.batch([
    db.prepare(`delete from match_logs where at < ? and match_id not in (select match_id from match_participants where flagged <> 0)`)
      .bind(now - KEEP.logDays * 864e5),
    db.prepare(`delete from match_logs where match_id in (select match_id from match_participants where flagged in (2, 3) and reviewed_at < ?)
                and match_id not in (select match_id from match_participants where flagged = 1)`).bind(now - KEEP.reviewedDays * 864e5),
  ]);
  for (const dev of ['pc', 'mobile']) {
    const rows = (await db.prepare(`select b.bot_id, h.result from match_participants b
        join match_participants h on h.match_id = b.match_id and h.is_bot = 0
        join matches m on m.id = b.match_id
        where b.is_bot = 1 and h.flagged = 0 and m.ranked = 1 and m.dev = ? and m.status = 'done' and m.ended_at > ?`)
      .bind(dev, now - BOT.calib.days * 864e5).all()).results
      .map(x => ({ botRating: Number(String(x.bot_id).slice(4)), human: x.result === 'win' ? 1 : x.result === 'draw' ? .5 : 0 }));
    const pairs = (await db.prepare(`select p.mu_before as rating, p.cpm from match_participants p join matches m on m.id = p.match_id
        where p.is_bot = 0 and p.quit = 0 and p.flagged = 0 and p.mu_before is not null and m.ranked = 1 and m.dev = ? and m.status = 'done'`)
      .bind(dev).all()).results;
    const base = regress(pairs) ?? baseTable(dev);
    const old = (await db.prepare('select rating, mult from bot_calib where dev = ?').bind(dev).all()).results;
    const mults = calibrate(base.map(([R]) => [R, old.find(x => x.rating === R)?.mult ?? 1]), rows);
    await db.batch(base.map(([rating, cpm], k) => db.prepare(`insert into bot_calib (dev, rating, cpm, mult, updated_at) values (?, ?, ?, ?, ?)
        on conflict (dev, rating) do update set cpm = excluded.cpm, mult = excluded.mult, updated_at = excluded.updated_at`)
      .bind(dev, rating, cpm, mults[k][1], now)));
  }
}

/* ── 검토(관리자) ── flagged: 0 없음 · 1 검토 대기 · 2 부정 확정 · 3 문제없음 */
/** 검토 대기 줄 — 오래된 것부터. 상대도 같이 싣는다 */
export async function flagQueue(db) {
  return (await db.prepare(`select p.match_id, p.pid, p.who, coalesce(f.name, '') as name, p.flag_why, p.result, p.cpm, p.accuracy, p.strokes, p.items,
        m.mode, m.ranked, m.dev, m.ended_at, o.pid as o_pid, o.is_bot as o_bot, coalesce(g.name, '') as o_name, o.result as o_result, o.cpm as o_cpm
      from match_participants p join matches m on m.id = p.match_id
      left join match_participants o on o.match_id = p.match_id and o.pid <> p.pid
      left join profile f on f.who = p.who left join profile g on g.who = o.who
      where p.flagged = 1 order by m.ended_at asc limit 200`).all()).results;
}
/** 판정 하나. { m, pid, verdict: 'cheat' | 'clear', by }. cheat 면 상대(사람)에게 소급 승리를 한 번 */
export async function review(db, c, now) {
  const verdict = { cheat: 2, clear: 3 }[c?.verdict];
  if (!verdict || typeof c.m !== 'string' || typeof c.pid !== 'string') return { ok: false, why: 'bad' };
  const r = await db.prepare('update match_participants set flagged = ?, reviewed_at = ?, reviewed_by = ? where match_id = ? and pid = ? and flagged = 1')
    .bind(verdict, now, String(c.by ?? ''), c.m, c.pid).run();
  if (!r.meta.changes) return { ok: false, why: 'state' };
  const retro = [];
  if (verdict === 2) {
    const others = (await db.prepare('select pid from match_participants where match_id = ? and pid <> ? and who is not null').bind(c.m, c.pid).all()).results;
    for (const o of others) retro.push({ pid: o.pid, ...(await applyRetro(db, c.m, o.pid, now)) });
  }
  return { ok: true, retro };
}
