/* 커뮤니티 — relay/ 의 /cm/* 를 부르는 얇은 화면이다. 목록과 글 하나를 한 페이지에서
   해시로 가른다(#p12). 로그인·닉네임은 홈의 것을 그대로 쓴다(rt.token, /auth/me).
   남이 쓴 글은 전부 textContent 로만 넣는다 — innerHTML 은 이 파일에 없다. */
(() => {
'use strict';
const opt = (() => { try { return JSON.parse(localStorage.getItem('rt.opt') || '{}'); } catch { return {}; } })();
/* 홈과 같은 야간·모션 설정. 스타일시트가 그리기 전에 붙여야 흰 화면이 번쩍이지 않는다 */
document.documentElement.toggleAttribute('data-night', !!opt.night);
document.documentElement.dataset.motion = opt.motion === false ? 'off' : 'on';

/* 홈에서 넘어오는 전환 동안 화면은 스냅샷이라, 그 사이 굴리면 전환 자리에 묶인다 — 손이 굴리기 시작하면
   전환을 걷어 살아 있는 페이지에 넘긴다(app.js yieldToScroll 과 같은 몇 줄) */
addEventListener('pagereveal', e => {
  const vt = e.viewTransition;
  if (!vt) return;
  const skip = () => vt.skipTransition(), evs = ['wheel', 'touchmove'];
  evs.forEach(ev => addEventListener(ev, skip, { passive: true, capture: true }));
  vt.finished.catch(() => {}).finally(() => evs.forEach(ev => removeEventListener(ev, skip, { capture: true })));
});

const RELAY = self.RT_RELAY;   // relay.js — 로컬에서는 로컬 중계기, ?relay=live 로 운영
const token = () => { try { return localStorage.getItem('rt.token') || ''; } catch { return ''; } };

const VER = new URL(document.currentScript.src).searchParams.get('v') || '';

/* ── 화면 말 ─────────────────────────────────────────────
   auth.js 와 같은 결이다. 홈이 rt.ui 에 적어 둔 마지막 말 팩(app.js cacheUI)부터 쓰고,
   그 팩에 이 페이지 말이 없으면(옛 팩·바로 들어온 첫 방문) data/i18n.json 을 받아 고른다.
   그 말에 없는 키는 영어로, 아무 데도 없으면 빈 값 — HTML 에 적힌 말을 덮지 않게 */
let I18N = { ko: {} }, LANG = 'ko';
const t = (key, vars) => {
  let s = (I18N[LANG] || {})[key] || (I18N.en || {})[key] || (I18N.ko || {})[key] || '';
  if (s && vars) s = String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  return s;
};
async function loadI18n() {
  let ui = null;
  try { ui = JSON.parse(localStorage.getItem('rt.ui') || 'null'); } catch {}
  if (ui && ui.pack && ui.pack.cmLead) { I18N = { [ui.lang]: ui.pack }; LANG = ui.lang; }
  else {
    try { I18N = await (await fetch('../data/i18n.json?v=' + VER)).json(); } catch {}
    const langs = Object.keys(I18N);
    LANG = [opt.lang, ...(navigator.languages || [navigator.language])]
      .map(x => String(x || '').toLowerCase().replace(/^(no|nn)\b.*/, 'nb').slice(0, 2))
      .find(x => langs.includes(x)) || (langs.includes('en') ? 'en' : 'ko');
  }
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach(e => { const s = t(e.dataset.i18n); if (s) e.textContent = s; });
  document.querySelectorAll('[data-i18n-aria]').forEach(e => { const s = t(e.dataset.i18nAria); if (s) e.setAttribute('aria-label', s); });
}

const TAG = { brag: ['★', 'cmBrag'], ask: ['?', 'cmAsk'], idea: ['+', 'kindIdea'], chat: ['~', 'cmChat'] };
const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
function ago(at) {
  const rtf = new Intl.RelativeTimeFormat(LANG, { numeric: 'auto' });
  const s = (at - Date.now()) / 1000;
  for (const [u, n] of [['day', 86400], ['hour', 3600], ['minute', 60]])
    if (Math.abs(s) >= n) return Math.abs(s) >= 86400 * 7 ? new Date(at).toLocaleDateString(LANG) : rtf.format(Math.round(s / n), u);
  return rtf.format(0, 'second');   // '방금' — 말마다 Intl 이 안다
}
const who = x => x.name ? (x.handle ? `${x.name} @${x.handle}` : x.name) : t('anon');

async function call(path, body) {
  const head = body ? { 'content-type': 'application/json' } : {};
  if (token()) head.authorization = 'Bearer ' + token();
  let r, d;
  try {
    r = await fetch(RELAY + path, { method: body ? 'POST' : 'GET', headers: head, body: body && JSON.stringify(body) });
    d = await r.json();
  } catch { throw Object.assign(new Error(t('cmNet')), { status: 0 }); }
  if (!r.ok) {
    const msg = r.status === 405 ? t('cmClosed') : d.msg || t('cmFail');
    throw Object.assign(new Error(msg), { status: r.status, data: d });
  }
  return d;
}
/* 쓰다가 막히면 왜 막혔는지와 갈 곳을 같이 말한다 */
function why(e, sayEl) {
  sayEl.textContent = e.message;
  if (e.status === 401) sayEl.append(' ', link('/#signin', t('signinBtn')));
  if (e.data && e.data.noname) sayEl.append(' ', link('/#account', t('cmSetName')));
}
const link = (href, text) => { const a = el('a', null, text); a.href = href; return a; };

let me = null;          // { name, handle } — 로그인했고 닉네임이 있으면
let tag = '', cursor = 0, current = null;

function tagChip(tg) {
  const [mark, label] = TAG[tg] || ['·', tg];
  const s = el('span', 'cm-chip'); s.dataset.tag = tg;
  s.append(el('b', null, mark), t(label) || label);
  s.firstChild.setAttribute('aria-hidden', 'true');
  return s;
}

/* ── 목록 ─────────────────────────────────────────── */
async function load(more) {
  const say = $('#listSay');
  if (!more) { $('#list').replaceChildren(); cursor = 0; }
  say.textContent = t('reading');
  $('#more').hidden = true;
  try {
    const d = await call(`/cm/list?tag=${tag}` + (cursor ? `&before=${cursor}` : ''));
    for (const p of d.posts) $('#list').append(row(p));
    cursor = d.posts.length ? d.posts[d.posts.length - 1].id : cursor;
    $('#more').hidden = !d.more;
    say.textContent = $('#list').children.length ? '' : t('cmEmpty');
  } catch (e) { say.textContent = e.message; }
}

function row(p) {
  const li = el('li', 'cm-row');
  const a = el('a', 'cm-card'); a.href = '#p' + p.id;
  const top = el('span', 'cm-card-top');
  top.append(tagChip(p.tag), el('span', 'cm-meta', `${who(p)} · ${ago(p.at)}`));
  const nums = el('span', 'cm-nums');
  nums.append(el('span', null, `♥ ${p.ups}`), el('span', null, t('cmCommentsN', { n: p.replies })));
  nums.setAttribute('aria-label', t('cmNumsAria', { u: p.ups, n: p.replies }));
  a.append(top, el('strong', 'cm-card-title', p.title), el('span', 'cm-card-lead', p.lead.replace(/\s+/g, ' ')), nums);
  li.append(a);
  return li;
}

/* ── 글 하나 ──────────────────────────────────────── */
async function open(id) {
  $('#listView').hidden = true; $('#postView').hidden = false;
  $('#postSay').textContent = t('reading');
  for (const s of ['#pTag', '#pTitle', '#pMeta', '#pBody', '#replies']) $(s).replaceChildren();
  try {
    const d = await call('/cm/read?id=' + id);
    current = d.post;
    document.title = `${d.post.title} — regiontype ${t('community')}`;
    $('#pTag').append(tagChip(d.post.tag));
    $('#pTitle').textContent = d.post.title;
    $('#pMeta').textContent = `${who(d.post)} · ${ago(d.post.at)}`;
    for (const para of d.post.body.split('\n\n')) $('#pBody').append(el('p', null, para));
    upState(d.post.upped, d.post.ups);
    $('#pDel').hidden = !d.post.mine;
    $('#pFlag').hidden = d.post.mine;
    $('#pFlag').disabled = d.flagged.includes('p' + id);
    $('#pFlag').textContent = t($('#pFlag').disabled ? 'cmFlagged' : 'cmFlag');
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
  if (r.mine) acts.append(small(t('cmDelete'), () => del('r' + r.id, li), 'destructive'));
  else {
    const f = small(t(flagged.includes('r' + r.id) ? 'cmFlagged' : 'cmFlag'), () => flag('r' + r.id, f));
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
  if (!confirm(t('cmFlagAsk'))) return;
  try { await call('/cm/flag', { target }); btn.disabled = true; btn.textContent = t('cmFlagged'); }
  catch (e) { why(e, $('#postSay')); }
}
async function del(target, li) {
  if (!confirm(t(target[0] === 'p' ? 'cmDelPostAsk' : 'cmDelReplyAsk'))) return;
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
  document.title = `${t('community')} — regiontype`;
  $('#postView').hidden = true; $('#listView').hidden = false;
  load();   // 돌아올 때마다 새로 읽는다 — 방금 단 댓글·공감 수가 목록에 맞게
}

/* 쓰는 칸의 글자 수. 한도에 닿으면 숫자만이 아니라 글로도 알린다 */
const counter = (input, out, cap) => input.addEventListener('input', () => {
  out.textContent = `${input.value.length} / ${cap}` + (input.value.length >= cap ? ' — ' + t('cmLimit') : '');
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadI18n();
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
  /* 홈 봇이 써 둔 초안(ranked.js 의 act post) — 칸만 채워 열고, 올리기는 사람이 누른다. 한 번 읽으면 지운다 */
  let draft = null;
  try { draft = JSON.parse(sessionStorage.getItem('rt.cmDraft') || 'null'); sessionStorage.removeItem('rt.cmDraft'); } catch {}
  if (draft && token()) {
    const r = document.querySelector(`#postForm input[name="tag"][value="${CSS.escape(String(draft.tag))}"]`);
    if (r) r.checked = true;
    $('#postTitle').value = String(draft.title || '');
    $('#postBody').value = String(draft.body || '');
    $('#postBody').dispatchEvent(new Event('input'));
    $('#composeSay').replaceChildren();
    dlg.showModal();
  }
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
  Object.assign($('#signinLink'), { href: '/#account', textContent: t('accountBtn') });   // 폰 아래 막대의 계정 동그라미
  try {
    const d = await call('/auth/me');
    if (!d.intro && !d.profile?.name) {
      try {
        localStorage.removeItem('rt.intro');
        localStorage.setItem('rt.rescue', '1');
      } catch {}
      location.replace('/welcome/');
      return;
    }
    const p = d.profile || {};
    me = p.name ? { name: p.name, handle: p.handle || '' } : null;
    $('#me').textContent = me ? who(me) : t('cmSetName');
    $('#me').href = '/#account';
  } catch (e) {
    if (e.status === 401) {
      for (const k of ['rt.token', 'rt.name', 'rt.bio', 'rt.character', 'rt.botname', 'rt.botsize', 'rt.intro', 'rt.rescue', 'rt.greet']) {
        try { localStorage.removeItem(k); } catch {}
      }
      Object.assign($('#signinLink'), { href: '/#signin', textContent: t('signinBtn') });
      $('#me').textContent = t('signinBtn');
      $('#me').href = '/#signin';
    }
  }
});
})();
