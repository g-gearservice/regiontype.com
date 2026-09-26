/* 커뮤니티 — relay/ 의 /cm/* 를 부르는 얇은 화면이다. 목록과 글 하나를 한 페이지에서
   해시로 가른다(#p12). 로그인·닉네임은 홈의 것을 그대로 쓴다(rt.token, /auth/me).
   남이 쓴 글은 전부 textContent 로만 넣는다 — innerHTML 은 이 파일에 없다. */
(() => {
'use strict';
const opt = (() => { try { return JSON.parse(localStorage.getItem('rt.opt') || '{}'); } catch { return {}; } })();
/* 홈과 같은 야간·모션 설정. 스타일시트가 그리기 전에 붙여야 흰 화면이 번쩍이지 않는다 */
document.documentElement.toggleAttribute('data-night', !!opt.night);
document.documentElement.dataset.motion = opt.motion === false ? 'off' : 'on';

/* 로컬에서 relay 를 wrangler dev 로 띄워 볼 때만 ?relay=http://localhost:8787 을 받는다.
   배포된 사이트에서는 이 값을 읽지 않는다 — 토큰이 남의 주소로 나가면 안 된다 */
const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const asked = new URLSearchParams(location.search).get('relay') || '';
const RELAY = local && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(asked) ? asked : 'https://g.gearservicevanguard.com';
const token = () => { try { return localStorage.getItem('rt.token') || ''; } catch { return ''; } };

const TAG = { brag: ['★', '자랑'], ask: ['?', '질문'], idea: ['+', '제안'], chat: ['~', '잡담'] };
const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
function ago(at) {
  const s = (at - Date.now()) / 1000;
  for (const [u, n] of [['day', 86400], ['hour', 3600], ['minute', 60]])
    if (Math.abs(s) >= n) return Math.abs(s) >= 86400 * 7 ? new Date(at).toLocaleDateString('ko') : rtf.format(Math.round(s / n), u);
  return '방금';
}
const who = x => x.name ? (x.handle ? `${x.name} @${x.handle}` : x.name) : '익명';

async function call(path, body) {
  const head = body ? { 'content-type': 'application/json' } : {};
  if (token()) head.authorization = 'Bearer ' + token();
  let r, d;
  try {
    r = await fetch(RELAY + path, { method: body ? 'POST' : 'GET', headers: head, body: body && JSON.stringify(body) });
    d = await r.json();
  } catch { throw Object.assign(new Error('연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'), { status: 0 }); }
  if (!r.ok) {
    const msg = r.status === 405 ? '커뮤니티가 아직 열리지 않았습니다.' : d.msg || '처리하지 못했습니다.';
    throw Object.assign(new Error(msg), { status: r.status, data: d });
  }
  return d;
}
/* 쓰다가 막히면 왜 막혔는지와 갈 곳을 같이 말한다 */
function why(e, sayEl) {
  sayEl.textContent = e.message;
  if (e.status === 401) sayEl.append(' ', link('/#signin', '로그인하기'));
  if (e.data && e.data.noname) sayEl.append(' ', link('/#account', '닉네임 정하기'));
}
const link = (href, text) => { const a = el('a', null, text); a.href = href; return a; };

let me = null;          // { name, handle } — 로그인했고 닉네임이 있으면
let tag = '', cursor = 0, current = null;

function tagChip(t) {
  const [mark, label] = TAG[t] || ['·', t];
  const s = el('span', 'cm-chip'); s.dataset.tag = t;
  s.append(el('b', null, mark), label);
  s.firstChild.setAttribute('aria-hidden', 'true');
  return s;
}

/* ── 목록 ─────────────────────────────────────────── */
async function load(more) {
  const say = $('#listSay');
  if (!more) { $('#list').replaceChildren(); cursor = 0; }
  say.textContent = '읽는 중…';
  $('#more').hidden = true;
  try {
    const d = await call(`/cm/list?tag=${tag}` + (cursor ? `&before=${cursor}` : ''));
    for (const p of d.posts) $('#list').append(row(p));
    cursor = d.posts.length ? d.posts[d.posts.length - 1].id : cursor;
    $('#more').hidden = !d.more;
    say.textContent = $('#list').children.length ? '' : '아직 글이 없습니다. 첫 글을 남겨 보세요.';
  } catch (e) { say.textContent = e.message; }
}

function row(p) {
  const li = el('li', 'cm-row');
  const a = el('a', 'cm-card'); a.href = '#p' + p.id;
  const top = el('span', 'cm-card-top');
  top.append(tagChip(p.tag), el('span', 'cm-meta', `${who(p)} · ${ago(p.at)}`));
  const nums = el('span', 'cm-nums');
  nums.append(el('span', null, `♥ ${p.ups}`), el('span', null, `댓글 ${p.replies}`));
  nums.setAttribute('aria-label', `공감 ${p.ups}, 댓글 ${p.replies}`);
  a.append(top, el('strong', 'cm-card-title', p.title), el('span', 'cm-card-lead', p.lead.replace(/\s+/g, ' ')), nums);
  li.append(a);
  return li;
}

/* ── 글 하나 ──────────────────────────────────────── */
async function open(id) {
  $('#listView').hidden = true; $('#postView').hidden = false;
  $('#postSay').textContent = '읽는 중…';
  for (const s of ['#pTag', '#pTitle', '#pMeta', '#pBody', '#replies']) $(s).replaceChildren();
  try {
    const d = await call('/cm/read?id=' + id);
    current = d.post;
    document.title = `${d.post.title} — regiontype 커뮤니티`;
    $('#pTag').append(tagChip(d.post.tag));
    $('#pTitle').textContent = d.post.title;
    $('#pMeta').textContent = `${who(d.post)} · ${ago(d.post.at)}`;
    for (const para of d.post.body.split('\n\n')) $('#pBody').append(el('p', null, para));
    upState(d.post.upped, d.post.ups);
    $('#pDel').hidden = !d.post.mine;
    $('#pFlag').hidden = d.post.mine;
    $('#pFlag').disabled = d.flagged.includes('p' + id);
    $('#pFlag').textContent = $('#pFlag').disabled ? '신고함' : '신고';
    for (const r of d.replies) $('#replies').append(replyRow(r, d.flagged));
    $('#rCount').textContent = d.replies.length;
    $('#postSay').textContent = '';
    $('#pTitle').focus();
  } catch (e) { $('#postSay').textContent = e.message; current = null; }
}

function replyRow(r, flagged) {
  const li = el('li', 'cm-reply');
  const meta = el('p', 'cm-meta', `${who(r)} · ${ago(r.at)}`);
  const acts = el('span', 'cm-reply-acts');
  if (r.mine) acts.append(small('지우기', () => del('r' + r.id, li), 'destructive'));
  else {
    const f = small(flagged.includes('r' + r.id) ? '신고함' : '신고', () => flag('r' + r.id, f));
    f.disabled = flagged.includes('r' + r.id);
    acts.append(f);
  }
  meta.append(acts);
  li.append(meta, el('p', 'cm-reply-body', r.body));
  return li;
}
const small = (text, on, cls = '') => { const b = el('button', 'cm-small ' + cls, text); b.type = 'button'; b.onclick = on; return b; };

function upState(on, n) {
  $('#pUp').setAttribute('aria-pressed', String(on));
  $('#pUps').textContent = n;
}

async function flag(target, btn) {
  if (!confirm('이 글을 신고할까요? 서로 다른 세 사람이 신고하면 가려집니다.')) return;
  try { await call('/cm/flag', { target }); btn.disabled = true; btn.textContent = '신고함'; }
  catch (e) { why(e, $('#postSay')); }
}
async function del(target, li) {
  if (!confirm(target[0] === 'p' ? '이 글과 달린 댓글을 모두 지울까요?' : '이 댓글을 지울까요?')) return;
  try {
    await call('/cm/del', { target });
    if (target[0] === 'p') { location.hash = ''; return; }
    li.remove();
    $('#rCount').textContent = $('#replies').children.length;
  } catch (e) { why(e, $('#postSay')); }
}

/* ── 주소 ─────────────────────────────────────────── */
function route() {
  const m = /^#p(\d+)$/.exec(location.hash);
  if (m) return open(Number(m[1]));
  current = null;
  document.title = '커뮤니티 — regiontype';
  $('#postView').hidden = true; $('#listView').hidden = false;
  load();   // 돌아올 때마다 새로 읽는다 — 방금 단 댓글·공감 수가 목록에 맞게
}

/* 쓰는 칸의 글자 수. 한도에 닿으면 숫자만이 아니라 글로도 알린다 */
const counter = (input, out, cap) => input.addEventListener('input', () => {
  out.textContent = `${input.value.length} / ${cap}` + (input.value.length >= cap ? ' — 한도' : '');
});

document.addEventListener('DOMContentLoaded', async () => {
  counter($('#postBody'), $('#postCount'), 2000);
  counter($('#replyBody'), $('#replyCount'), 500);

  $('#tags').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    tag = b.dataset.tag;
    for (const x of $('#tags').children) x.setAttribute('aria-pressed', String(x === b));
    load();
  });
  $('#more').onclick = () => load(true);

  const dlg = $('#composer');
  $('#write').onclick = () => {
    if (!token()) { location.href = '/#signin'; return; }
    $('#composeSay').replaceChildren();
    dlg.showModal();
  };
  $('#cancel').onclick = () => dlg.close();
  $('#postForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, go = f.querySelector('.cm-go');
    go.disabled = true;
    try {
      const d = await call('/cm/post', { tag: f.tag.value, title: $('#postTitle').value, body: $('#postBody').value });
      f.reset(); $('#postCount').textContent = '0 / 2000';
      dlg.close();
      location.hash = '#p' + d.id;
    } catch (err) { why(err, $('#composeSay')); }
    go.disabled = false;
  });

  $('#pUp').onclick = async () => {
    if (!current) return;
    try { const d = await call('/cm/up', { target: 'p' + current.id }); upState(d.on, d.n); }
    catch (e) { why(e, $('#postSay')); }
  };
  $('#pFlag').onclick = () => current && flag('p' + current.id, $('#pFlag'));
  $('#pDel').onclick = () => current && del('p' + current.id);
  $('#replyForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!current) return;
    const go = e.target.querySelector('.cm-go');
    go.disabled = true;
    try {
      const d = await call('/cm/reply', { post: current.id, body: $('#replyBody').value });
      const body = $('#replyBody').value.trim();
      $('#replies').append(replyRow({ id: d.id, body, at: Date.now(), mine: true, ...me }, []));
      $('#rCount').textContent = $('#replies').children.length;
      e.target.reset(); $('#replyCount').textContent = '0 / 500';
      $('#postSay').textContent = '';
    } catch (err) { why(err, $('#postSay')); }
    go.disabled = false;
  });

  addEventListener('hashchange', route);
  route();

  /* 머리의 로그인 자리. 닉네임이 있으면 이름을, 없으면 정하러 가는 길을 건다 */
  if (!token()) return;
  try {
    const d = await call('/auth/me');
    const p = d.profile || {};
    me = p.name ? { name: p.name, handle: p.handle || '' } : null;
    $('#me').textContent = me ? who(me) : '닉네임 정하기';
    $('#me').href = '/#account';
  } catch (e) { if (e.status === 401) $('#me').textContent = '다시 로그인'; }
});
})();
