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
const shapes = [['round','동그라미'],['leaf','잎'],['square','네모'],['arch','아치']];
const expressions = [['curious','호기심'],['smile','웃음'],['calm','차분함'],['wink','윙크']];
const colours = [['ink','먹색'],['teal','청록'],['green','초록'],['orange','주황'],['red','빨강'],['purple','보라'],['blue','파랑']];
const saved = parse('rt.character', {});
const character = { shape: shapes.some(x => x[0] === saved.shape) ? saved.shape : 'round', expression: expressions.some(x => x[0] === saved.expression) ? saved.expression : 'curious', colour: colours.some(x => x[0] === saved.colour) ? saved.colour : 'teal' };
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
    button.onclick = () => { character[key] = value; paint(); say('미리보기입니다. 캐릭터 저장을 눌러 저장하세요.'); };
    $('#' + key + 'Choices').append(button);
  }
}
paint();
$('#characterSave').onclick = () => { if (write('rt.character', JSON.stringify(character))) say('캐릭터를 이 브라우저에 저장했습니다.'); };
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
  const value = e.target.value.replace(/[<>\x00-\x1f\x7f]/g, '').trim().slice(0, 12);
  if (!value) { say('닉네임을 1자 이상 입력해 주세요.'); e.target.value = read('rt.name'); return; }
  e.target.value = value;
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
