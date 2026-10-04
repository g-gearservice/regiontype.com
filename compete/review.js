/* 경쟁전 검토 — relay/ 의 GET·POST /compete/flags 를 부르는 얇은 화면. 로그인은 홈의 것(rt.token).
   남이 정한 이름은 전부 textContent 로만 넣는다 — innerHTML 은 이 파일에 없다. */
(() => {
'use strict';
const RELAY = self.RT_RELAY;   // relay.js
const token = () => { try { return localStorage.getItem('rt.token') || ''; } catch { return ''; } };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const WHY = { keys: '친 키가 이름 타수보다 적음', paste: '붙여넣기', cpm: '지속 CPM 초과', fast: '15ms 미만 간격 연속',
  cv: '간격이 기계처럼 고름', clock: '브라우저 시계가 서버와 어긋남', device: '기기 위장' };
const RES = { win: '승', loss: '패', draw: '무', abort: '무름' };

async function call(body) {
  const head = body ? { 'content-type': 'application/json' } : {};
  if (token()) head.authorization = 'Bearer ' + token();
  const r = await fetch(RELAY + '/compete/flags', { method: body ? 'POST' : 'GET', headers: head, body: body && JSON.stringify(body) })
    .catch(() => { throw new Error('중계기에 연결하지 못했습니다.'); });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 403 ? '관리자만 볼 수 있습니다. 관리자 계정으로 로그인해 주세요.' : d.msg || '읽지 못했습니다.');
  return d;
}

function row(f) {
  const li = el('li');
  const who = `${f.name || '(이름 없음)'} — ${RES[f.result] ?? f.result}, ${f.cpm} CPM, 정확도 ${f.accuracy}%`;
  const opp = f.o_bot ? `BOT — ${RES[f.o_result] ?? ''}` : `${f.o_name || '(이름 없음)'} — ${RES[f.o_result] ?? ''}, ${f.o_cpm ?? '-'} CPM`;
  li.append(el('h2', null, who),
    el('p', 'cm-meta', `${new Date(f.ended_at).toLocaleString('ko')} · ${f.mode} · ${f.dev} · ${f.ranked ? '랭크' : '캐주얼'} · 판 ${f.match_id}`),
    el('p', null, '이유: ' + String(f.flag_why || '').split(',').map(x => WHY[x] ?? x).join(', ')),
    el('p', null, '상대: ' + opp));
  const acts = el('div', 'cm-acts'), say = el('p', 'cm-say');
  say.setAttribute('role', 'status');
  for (const [verdict, label] of [['cheat', '부정 확정'], ['clear', '문제없음']]) {
    const b = el('button', 'profile-button' + (verdict === 'cheat' ? ' destructive' : ''), label);
    b.type = 'button';
    b.addEventListener('click', async () => {
      if (!confirm(`${f.name || '이 사람'}: ${label} — 되돌릴 수 없습니다.`)) return;
      acts.querySelectorAll('button').forEach(x => { x.disabled = true; });
      try {
        const d = await call({ m: f.match_id, pid: f.pid, verdict });
        if (!d.ok) throw new Error(d.why === 'state' ? '이미 판정된 판입니다.' : '판정하지 못했습니다.');
        const retro = (d.retro || []).map(x => x.applied ? `상대 소급 승리 반영(표시 ${x.delta >= 0 ? '+' : ''}${x.delta})` : `소급 안 함(${x.why})`);
        say.textContent = `${label} 처리됨. ${retro.join(' ')}`;
      } catch (e) {
        say.textContent = e.message;
        acts.querySelectorAll('button').forEach(x => { x.disabled = false; });
      }
    });
    acts.append(b);
  }
  li.append(acts, say);
  return li;
}

async function load() {
  const say = document.getElementById('say'), list = document.getElementById('list');
  try {
    const { flags } = await call();
    list.replaceChildren(...flags.map(row));
    say.textContent = flags.length ? `검토 대기 ${flags.length}건` : '검토할 판이 없습니다.';
  } catch (e) { say.textContent = e.message; }
}
document.addEventListener('DOMContentLoaded', load);
})();
