/* 독립 계정 화면. 프로필 서비스가 없는 항목은 지원 여부를 명시한다. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const VER = new URL(document.currentScript.src).searchParams.get('v') || '';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
const read = (key, fallback = '') => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const parse = (key, fallback) => { try { return JSON.parse(read(key)) || fallback; } catch { return fallback; } };
const say = text => { $('#accountSay').textContent = text; };
const write = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { say('브라우저에 저장하지 못했습니다. 저장 공간 설정을 확인해 주세요.'); return false; } };
const opt = parse('rt.opt', {});
/* app.js 와 relay/worker.mjs 의 plain() 과 같은 자여야 한다. 여기서만 통과하는
   이름을 저장하면 그 뒤 순위 등록이 전부 400 을 받는다 — 중계기가 제 자로 다시
   깎아 빈 이름이 되면 그 줄을 거절하기 때문이다. 폭 없는 공백 한 자면 그렇게 된다.
   trim() 은 그런 글자를 못 털어서 \p{C}\p{Z} 로 한 번 더 민다 */
const plain = (v, n = 12) =>
  String(v ?? '').trim().slice(0, n).replace(/[\p{C}\p{Z}]/gu, ' ').replace(/ +/g, ' ').trim();
const shapes = [['round','동그라미'],['leaf','잎'],['square','네모'],['arch','아치']];
const expressions = [['curious','호기심'],['smile','웃음'],['calm','차분함'],['wink','윙크']];
const colours = [['ink','먹색'],['teal','청록'],['green','초록'],['orange','주황'],['red','빨강'],['purple','보라'],['blue','파랑']];
const character = { shape: 'round', expression: 'curious', colour: 'teal' };
/* 모르는 값은 기본으로 되돌린다 — 저장된 통이 옛 이름을 들고 있어도 화면이 빈다거나
   CSS 가 없는 클래스를 잡는 일이 없게 */
function loadCharacter() {
  const s = parse('rt.character', {});
  character.shape = shapes.some(x => x[0] === s.shape) ? s.shape : 'round';
  character.expression = expressions.some(x => x[0] === s.expression) ? s.expression : 'curious';
  character.colour = colours.some(x => x[0] === s.colour) ? s.colour : 'teal';
}
/* 저장 안 한 변경이 있을 때만 저장 버튼이 열린다 — 눌렀는데 아무 일도 안 일어나는
   버튼을 두지 않는다. 아직 한 번도 저장한 적이 없으면 지금 모습 그대로 저장할 수 있다 */
const markClean = () => { $('#characterSave').disabled = !!read('rt.character'); };
loadCharacter();
function paint() {
  const preview = $('#character');
  preview.className = 'character shape-' + character.shape + ' expression-' + character.expression;
  preview.style.setProperty('--character-colour', 'var(--avatar-' + character.colour + ')');
  for (const [key, list] of [['shape', shapes], ['expression', expressions], ['colour', colours]]) {
    const label = list.find(x => x[0] === character[key])[1];
    $('#' + key + 'Label').textContent = label;
    document.querySelectorAll('[data-' + key + ']').forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key] === character[key])));
  }
  preview.setAttribute('aria-label', $('#colourLabel').textContent + ' ' + $('#shapeLabel').textContent + ' · ' + $('#expressionLabel').textContent);
}
for (const [key, list] of [['shape', shapes], ['expression', expressions], ['colour', colours]]) {
  for (const [value, label] of list) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset[key] = value;
    button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', 'false'); button.title = label;
    button.className = 'character-choice ' + (key === 'shape' ? 'shape-' + value : key === 'expression' ? 'expression-' + value : '');
    if (key === 'expression') { button.append(document.createElement('span'), document.createElement('span')); }
    if (key === 'colour') button.style.background = 'var(--avatar-' + value + ')';
    button.onclick = () => {
      character[key] = value; paint();
      $('#characterSave').disabled = false;
      say('미리보기입니다. 캐릭터 저장을 눌러 저장하세요.');
    };
    $('#' + key + 'Choices').append(button);
  }
}
paint();
markClean();
$('#characterSave').onclick = () => {
  if (!write('rt.character', JSON.stringify(character))) return;
  markClean();
  say('캐릭터를 이 브라우저에 저장했습니다.');
};
const loggedIn = () => !!read('rt.token');
function session() {
  const inn = loggedIn();
  $('#accountLogout').disabled = !inn;
  $('#accountSignin').hidden = inn;
  $('#accountName').disabled = !inn;
  $('#accountName').value = inn ? read('rt.name') : '';
  $('#accountSession').textContent = inn ? '이 브라우저의 계정과 설정을 관리합니다.' : '로그인하면 닉네임과 보안 설정을 관리할 수 있습니다.';
}
$('#accountName').value = read('rt.name');
$('#accountName').addEventListener('change', e => {
  if (!loggedIn()) { session(); return; }
  const value = plain(e.target.value);
  if (!value) { say('닉네임을 1자 이상 입력해 주세요.'); e.target.value = read('rt.name'); return; }
  /* 깎인 모습을 칸에 되돌려 놓는다 — 저장된 것과 보이는 것이 달라지지 않게 */
  e.target.value = value;
  if (value === read('rt.name')) return say('');
  if (write('rt.name', value)) say('다음 순위 등록에 사용할 닉네임을 저장했습니다.');
});
function saveOption(key, value) {
  const latest = parse('rt.opt', {});
  latest[key] = value;
  if (!write('rt.opt', JSON.stringify(latest))) return;
  opt[key] = value;
  document.documentElement.toggleAttribute('data-night', !!opt.night);
  $('#accountNight').setAttribute('aria-pressed', String(!!opt.night));
  say('설정을 저장했습니다.');
}
$('#accountNight').setAttribute('aria-pressed', String(!!opt.night));
$('#accountNight').onclick = () => saveOption('night', !opt.night);
$('#accountLanguage').value = ['ko', 'auto'].includes(opt.lang) ? opt.lang : 'auto';
$('#accountLanguage').onchange = e => saveOption('lang', e.target.value);
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  fetch(asset('../data/i18n.json')).then(r => r.json()).then(data => {
    for (const code of Object.keys(data).filter(code => code !== 'ko')) {
      const option = document.createElement('option'); option.value = code;
      try { option.textContent = new Intl.DisplayNames([code], {type: 'language'}).of(code); } catch { option.textContent = code; }
      $('#accountLanguage').append(option);
    }
    $('#accountLanguage').value = opt.lang || 'auto';
  }).catch(() => {});
}
$('#accountLogout').onclick = () => {
  try { localStorage.removeItem('rt.token'); localStorage.removeItem('rt.name'); localStorage.removeItem('rt.character'); sessionStorage.removeItem('rt.bind'); }
  catch { say('로그아웃하지 못했습니다. 브라우저 설정을 확인해 주세요.'); return; }
  $('#accountName').value = '';
  session();
  location.replace('../');
};
session();
function syncOptions() {
  Object.assign(opt, { night: false, lang: 'auto', motion: true }, parse('rt.opt', {}));
  document.documentElement.toggleAttribute('data-night', !!opt.night);
  document.documentElement.dataset.motion = opt.motion === false ? 'off' : 'on';
  $('#accountNight').setAttribute('aria-pressed', String(!!opt.night));
  $('#accountLanguage').value = opt.lang || 'auto';
}
addEventListener('pageshow', () => { session(); syncOptions(); });
addEventListener('storage', e => {
  if (e.key === null || e.key === 'rt.token' || e.key === 'rt.name') session();
  if (e.key === null || e.key === 'rt.opt') {
    syncOptions();
  }
  /* 다른 탭에서 캐릭터를 저장했거나 로그아웃으로 지웠으면 이 탭의 미리보기도 따라간다 */
  if (e.key === null || e.key === 'rt.character') { loadCharacter(); paint(); markClean(); }
});
const checkedToken = read('rt.token');
if (checkedToken) fetch('https://g.gearservicevanguard.com/auth/me', {headers: {authorization: 'Bearer ' + checkedToken}})
  .then(r => {
    if (checkedToken !== read('rt.token')) return;
    if (r.status === 401) {
      localStorage.removeItem('rt.token'); localStorage.removeItem('rt.name'); sessionStorage.removeItem('rt.bind'); session();
    } else if (!r.ok) $('#accountSession').textContent = '계정 상태를 확인할 수 없습니다. 잠시 후 다시 접속해 주세요.';
  })
  .catch(() => { if (checkedToken === read('rt.token')) $('#accountSession').textContent = '계정 상태를 확인할 수 없습니다. 인터넷 연결을 확인해 주세요.'; });
})();
