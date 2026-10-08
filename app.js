/* regiontype — 나라의 지명을 친다. 코스는 data/*.json, 화면 말은 data/i18n.json. */
'use strict';

const $ = s => document.querySelector(s);
const VER = '3.88';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
const SYM = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'αβγδεζηθικλμνξοπρστυφχψωàáâãäåæçèéêëìíîïñòóôõöøùúûüýþăąćčďđęěğįłńňőřśşťůźżž';
let UI_LANGS = ['ko', 'en', 'ja'];
let I18N = { ko: {}, en: {}, ja: {} };
let WORLD = { countries: [] };
let LANG_COUNTRY = {};
let HERE = { country: '', lang: '', timezone: '' };
let LANG = 'ko', COUNTRY = 'KR';

/* UI 언어 태그를 i18n 키로 맞춘다. zh-Hant·nb 처럼 두 글자만 자르면 어긋난다. */
function normLangTag(tag) {
  const t = String(tag || '').replace('_', '-').trim().toLowerCase();
  if (!t) return '';
  if (t.startsWith('zh-hant') || t === 'zh-tw' || /-tw$/.test(t)) return 'zh-hant';
  if (t.startsWith('zh-hk') || /-hk$/.test(t)) return 'zh-hk';
  if (t.startsWith('zh')) return 'zh';
  if (t.startsWith('nb') || t === 'no' || t.startsWith('no-')) return 'nb';
  return t.slice(0, 2);
}
function parseUiLang(tag) {
  if (!tag) return null;
  const raw = String(tag).replace('_', '-').trim();
  if (UI_LANGS.includes(raw)) return raw;
  const low = raw.toLowerCase();
  if (UI_LANGS.includes(low)) return low;
  const base = normLangTag(raw);
  if (UI_LANGS.includes(base)) return base;
  if ((base === 'zh-hant' || base === 'zh-hk') && UI_LANGS.includes('zh')) return 'zh';
  return null;
}
function buildLangCountry(world) {
  const map = { ko: 'KR', ja: 'JP', zh: 'CN', 'zh-hant': 'TW', 'zh-hk': 'HK' };
  for (const c of world.countries) {
    const base = normLangTag(c.lang);
    if (!map[base]) map[base] = c.id;
  }
  return map;
}

const t = (key, vars) => {
  const tab = I18N[LANG] || I18N.en;
  let s = (tab && tab[key]) || I18N.en[key] || I18N.ko[key] || key;
  if (vars) s = String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  return s;
};
const courseLabel = c => {
  if (!c) return '';
  if (c.title && c.title !== String((c.items || []).length)) return c.title;
  return t('places', { n: (c.items || []).length });
};
const countryName = id => {
  try { return new Intl.DisplayNames([LANG], { type: 'region' }).of(id) || id; }
  catch { return id; }
};
/* 홈 머리글. 나라는 아직 개발 중이라 서울만 연다 — world.json 서울 권역 제목을 따른다 */
function homeTitle() {
  const pack = WORLD.countries.find(c => c.id === 'KR');
  const region = pack && (pack.regions || []).find(r => r.main === 'seoul-gu' || r.id === 'seoul');
  const title = region && region.title;
  if (title && typeof title === 'object') return title[LANG] || title.ko || title.en || '서울';
  return title || '서울';
}

function applyI18n(root) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
}

function paintUI(then) {
  document.documentElement.lang = LANG;
  /* 로그인 칸은 문이 하나다 — 들어가 있으면 라벨만 '내 계정' 이 된다.
     applyI18n 이 곧 이 키를 읽으므로 그 전에 바꿔 둔다 */
  const signinLink = $('#signinLink');
  if (signinLink) {
    const inn = !!token();
    signinLink.dataset.i18n = inn ? 'accountBtn' : 'signinBtn';
    /* 들어가 있으면 로그인 화면을 한 번 더 지날 이유가 없다 — 내 계정 덮개를 연다(ranked.js) */
    signinLink.href = inn ? '#account' : 'signin/';
  }
  /* Web Share API 가 있는 기기(대개 폰)는 저장 버튼이 공유 시트를 연다 — 라벨도 그에 맞춘다.
     언어를 바꿔도 applyI18n 이 이 key 를 다시 읽으니 여기서 한 번만 정하면 된다 */
  const saveBtn = $('#save');
  if (saveBtn) saveBtn.dataset.i18n = (typeof navigator.share === 'function') ? 'share' : 'save';
  /* 레일 폭이 고정이라 글자가 길어져도 셸이 흔들리지 않는다 — 그냥 다시 그린다 */
  applyI18n(document);
  document.title = 'regiontype · ' + t('pageTitle');
  document.querySelectorAll('template').forEach(tpl => applyI18n(tpl.content));
  requestAnimationFrame(() => relayoutNavShapes());
  /* 소개 페이지는 언어마다 별도 파일이다(about/ 폴더 안, ko 는 접미 없이 about/index.html).
     파일이 없는 언어는 한국어 소개로 보낸다 — 없는 주소를 열지 않는다 */
  const aboutLink = $('#aboutLink');
  if (aboutLink) {
    const have = 'ar,bg,cs,de,el,en,es,fi,fr,hu,id,it,ja,ms,nb,nl,pl,pt,ro,sv,th,tr,uk,vi,zh';
    aboutLink.href = (LANG !== 'ko' && have.split(',').includes(LANG))
      ? `about/${LANG}.html` : 'about/';
  }
  document.querySelectorAll('.unit').forEach(el => { el.textContent = unitLabel(); });
  if (then) then();
}

/* ── 설정 ───────────────────────────────────────────── */
const clock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
/* ── 타자 속도 ───────────────────────────────────────
   재는 값은 하나다 — 분당 타수(CPM, 키를 누른 수). 낱말 수(WPM)는 그걸 다섯으로 나눈 것이다
   (한 낱말 = 다섯 글자, 타자 검정의 오랜 자). 그래서 CPM 으로 치는 사람과 WPM 으로
   치는 사람이 같은 순위표에 서도 값이 어긋나지 않는다 — 저장은 늘 CPM 이고
   보일 때만 읽는 사람의 단위로 바꾼다.
   한글은 음절이 아니라 자모로 센다(keysOf). 한컴타자가 음절에서 자소 단위로 옮겼고,
   Monkeytype 도 한국어는 Hangul.disassemble 로 풀어 센 뒤 ÷5 한다 — 둘 다 두벌식에서
   실제로 누르는 키 수다. 확정하는 스페이스·Enter 도 한 타다(Monkeytype 과 같다).
   'auto' 는 한국어 화면이면 CPM, 아니면 WPM 이다 */
const CPW = 5;
/* 두벌식 키로 푼다. 쌍자음(ㄲ)·ㅒ·ㅖ 는 Shift 와 함께 한 키, 겹모음(ㅘ)·겹받침(ㄳ)은 두 키.
   Shift 는 세지 않는다 — hangul-js 의 disassemble 이 푸는 것과 같다. 조합 중에 홀로 선
   자모(ㅘ, ㄳ)도 같이 푼다. 푼 문자열끼리 앞머리를 견주면 조합 중인 '강ㅅ' 도 '강서구'의
   앞부분으로 읽힌다 */
const JUNG = 'ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅗㅏ ㅗㅐ ㅗㅣ ㅛ ㅜ ㅜㅓ ㅜㅔ ㅜㅣ ㅠ ㅡ ㅡㅣ ㅣ'.split(' ');
const JONG = [''].concat('ㄱ ㄲ ㄱㅅ ㄴ ㄴㅈ ㄴㅎ ㄷ ㄹ ㄹㄱ ㄹㅁ ㄹㅂ ㄹㅅ ㄹㅌ ㄹㅍ ㄹㅎ ㅁ ㅂ ㅂㅅ ㅅ ㅆ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ'.split(' '));
const PAIR = { ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ',
               ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ',
               ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ' };
const jamo = s => [...s.normalize('NFC')].map(ch => {
  const c = ch.charCodeAt(0) - 0xAC00;
  if (c < 0 || c >= 11172) return PAIR[ch] || ch;
  return 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(c / 588)] + JUNG[Math.floor(c % 588 / 28)] + JONG[c % 28];
}).join('');
const keysOf = s => jamo(s).length;

/* 폰 자체 키보드의 두벌식 조합기. 상태를 따로 들지 않고 입력창 끝 글자만 보고 잇는다 —
   시스템 IME 와 같은 결: 갑+ㅅ=값, 값+ㅏ=갑사, 고+ㅏ=과. 지울 때는 자모 하나씩 */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOW = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FIN = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
const MIX = { ㅗㅏ: 'ㅘ', ㅗㅐ: 'ㅙ', ㅗㅣ: 'ㅚ', ㅜㅓ: 'ㅝ', ㅜㅔ: 'ㅞ', ㅜㅣ: 'ㅟ', ㅡㅣ: 'ㅢ',
              ㄱㅅ: 'ㄳ', ㄴㅈ: 'ㄵ', ㄴㅎ: 'ㄶ', ㄹㄱ: 'ㄺ', ㄹㅁ: 'ㄻ', ㄹㅂ: 'ㄼ', ㄹㅅ: 'ㄽ',
              ㄹㅌ: 'ㄾ', ㄹㅍ: 'ㄿ', ㄹㅎ: 'ㅀ', ㅂㅅ: 'ㅄ' };
const SPLIT = Object.fromEntries(Object.entries(MIX).map(([k, v]) => [v, [...k]]));
const syl = (l, v, t = 0) => String.fromCharCode(0xAC00 + (l * 21 + v) * 28 + t);
const unsyl = ch => { const c = ch.charCodeAt(0) - 0xAC00;
  return c >= 0 && c < 11172 ? [Math.floor(c / 588), Math.floor(c % 588 / 28), c % 28] : null; };
function hanPush(buf, k) {
  const pre = buf.slice(0, -1), last = buf.slice(-1), s = last && unsyl(last);
  const vow = VOW.includes(k), fin = FIN.indexOf(k);
  if (s) {
    const [l, v, t] = s;
    if (!vow) {
      if (!t) return fin > 0 ? pre + syl(l, v, fin) : buf + k;
      const both = MIX[FIN[t] + k];
      return both ? pre + syl(l, v, FIN.indexOf(both)) : buf + k;
    }
    if (!t) { const both = MIX[VOW[v] + k]; return both ? pre + syl(l, VOW.indexOf(both)) : buf + k; }
    /* 받침이 다음 글자의 첫소리로 넘어간다 — 겹받침이면 뒤 하나만 */
    const [keep, move] = SPLIT[FIN[t]] || ['', FIN[t]];
    return pre + syl(l, v, FIN.indexOf(keep)) + syl(CHO.indexOf(move), VOW.indexOf(k));
  }
  if (vow && CHO.includes(last)) return pre + syl(CHO.indexOf(last), VOW.indexOf(k));
  if (vow && MIX[last + k] && VOW.includes(last)) return pre + MIX[last + k];
  return buf + k;
}
function hanBack(buf) {
  const pre = buf.slice(0, -1), last = buf.slice(-1), s = last && unsyl(last);
  if (!s) return SPLIT[last] && VOW.includes(last) ? pre + SPLIT[last][0] : pre;
  const [l, v, t] = s;
  if (t) return pre + syl(l, v, SPLIT[FIN[t]] ? FIN.indexOf(SPLIT[FIN[t]][0]) : 0);
  return pre + (SPLIT[VOW[v]] ? syl(l, VOW.indexOf(SPLIT[VOW[v]][0])) : CHO[l]);
}
const unitNow = () => (opt.unit === 'cpm' || opt.unit === 'wpm') ? opt.unit : (LANG === 'ko' ? 'cpm' : 'wpm');
const unitLabel = () => t(unitNow() === 'wpm' ? 'wpmUnit' : 'cpmUnit');
const speedIn = cpm => unitNow() === 'wpm' ? Math.round(cpm / CPW) : Math.round(cpm);
const showSpeed = cpm => speedIn(cpm) + ' ' + unitLabel();
const DEF = { time: 120, night: false, sound: true, motion: true, hint: true, grid: true, softkb: true, kbhint: true,
              lang: 'auto', country: 'auto', unit: 'auto', dong: 'admin', where: true };
const opt = Object.assign({}, DEF, JSON.parse(localStorage.getItem('rt.opt') || '{}'));
for (const k of Object.keys(opt)) if (!(k in DEF)) delete opt[k];

/* mimi 는 아직 내부용이다. 로컬에서만 문을 열어 둔다. CSS 기본이 숨김이라
   배포에서 잠깐 보였다 사라지는 일이 없다 — 여는 쪽에만 표시를 남긴다. */
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:') {
  document.documentElement.dataset.dev = '';
}
/* 배포/개발 갈림은 이 속성 하나다. 검사에서 지웠다 붙였다 하므로 그때그때 읽는다 */
const isDev = () => document.documentElement.hasAttribute('data-dev');

const saveOpt = () => {
  localStorage.setItem('rt.opt', JSON.stringify(opt));
  document.documentElement.toggleAttribute('data-night', opt.night);
  document.documentElement.dataset.motion = opt.motion ? 'on' : 'off';
  document.documentElement.toggleAttribute('data-no-grid', !opt.grid);
  requestAnimationFrame(syncGrid);
};


/* ── 부드러운 새로고침 ────────────────────────────────
   야간·언어는 한 번 새로 열어야 온 화면이 맞는다. 다만 새로고침 티가 나지 않게 —
   떠나기 직전 자리(덮개·탭·스크롤·초점·지도)를 sessionStorage 에 적고, 새 문서의 부트
   스크립트(index.html 머리)와 boot()·settings.js 가 읽어 첫 그림 전에 같은 자리로 선다.
   전환은 교차 문서 View Transition — navigation.navigate(replace) 는 전환이 붙고 기록도
   안 쌓인다(location.replace 는 전환이 안 붙는다, 실측). 판이 살아 있으면 하지 않는다.
   부르는 쪽은 false 를 받으면 예전처럼 즉석에서 칠한다. */
function softReload(kind) {
  if (G || $('#play').classList.contains('on')) return false;
  try {
    const box = $('#options'), a = document.activeElement;
    const rec = { at: Date.now(), kind, hash: location.hash, state: history.state, scroll: [], y: scrollY };
    if (!box.hidden) {
      [...box.querySelectorAll('*')].forEach((el, i) => {
        if (el.scrollTop || el.scrollLeft) rec.scroll.push({ i, t: el.scrollTop, l: el.scrollLeft });
      });
    }
    const opts = box.contains(a) && a !== box && a;
    if (opts) rec.focus = {
      kb: a.matches(':focus-visible'),
      sel: a.id ? '#' + a.id : a.dataset.opt ? `#options [data-opt="${a.dataset.opt}"]`
        : a.name ? `#options [name="${a.name}"][value="${a.value}"]` : '',
    };
    if (COURSE.tiles.length) rec.map = {
      pick: PICK && { name: PICK.name, kid: !!PICK.kid },
      open: OPEN && OPEN.tile.name, z: COURSE.z, px: COURSE.px, py: COURSE.py,
    };
    /* 새 문서가 새 말을 바로 입히도록 마지막 말 팩을 새 설정 것으로 바꿔 둔다 */
    Object.assign(opt, JSON.parse(localStorage.getItem('rt.opt') || '{}'));
    LANG = resolveLang();
    cacheUI();
    sessionStorage.setItem('rt.soft', JSON.stringify(rec));
  } catch { return false; }
  const url = location.pathname + location.search;   // 해시를 떼야 조각 이동이 아닌 새 문서가 된다
  if (window.navigation) navigation.navigate(url, { history: 'replace' }); else location.replace(url);
  return true;
}
/* 마지막에 그린 말(지금 언어 것만) — 다음 첫 그림이 fetch 를 기다리지 않는다 */
function cacheUI() {
  if (!I18N[LANG]) return;
  try {
    localStorage.setItem('rt.ui', JSON.stringify({ lang: LANG, auto: opt.lang === 'auto', pack: I18N[LANG], langs: UI_LANGS }));
  } catch {}
}
/* 새 문서 쪽 — 지도(고른 칸·펼친 구·카메라)를 적어 둔 자리로 세운다. 덮개는 settings.js 몫 */
async function softMap() {
  const m = window.RT_SOFT && window.RT_SOFT.map;
  if (!m || !COURSE.tiles.length) return;
  if (m.open) {
    const host = COURSE.tiles.find(x => !x.kid && x.name === m.open);
    if (host) await openCourse(host);
  }
  if (m.pick) {
    const p = COURSE.tiles.find(x => !!x.kid === m.pick.kid && x.name === m.pick.name);
    if (p) pickTile(p);
  }
  if (m.z) aimHomeCam(m.px, m.py, m.z, COURSE.tiles.filter(x => !x.gone && x.o.to > 0), true);
}

/* ── 정답 판정 ───────────────────────────────────────
   조합 중 문자열까지 매 입력마다 검사한다. 약칭("강남")은
   그 약칭으로 이어질 수 있는 미점령 항목이 자기 자신뿐일 때만
   인정한다. 그래서 "중"은 중구/중랑구 사이에서 확정되지 않고,
   "강남"은 즉시 확정된다. 앞에 붙은 오타는 접미 검사로 흘려보낸다. */
function stripSuffix(name) {
  const m = /^(.+?)(특별자치시|특별자치도|특별시|광역시|자치구|자치시|자치도|自治区|特别行政区|特別行政區|[시군구동읍면로가도]|[都道府県]|[省市縣县])$/.exec(String(name).normalize('NFC'));
  return m && m[1].length > 1 ? m[1] : null;
}

/* 화면에 띄울 이름. 긴 행정명은 한 자로 줄여 뒤에 남긴다 —
   서울특별시는 서울시, 제주특별자치도는 제주도다. 경기도·강남구처럼
   이미 짧으면 그대로 두고, 한국 밖 이름은 손대지 않는다. */
function adminLabel(name) {
  const n = String(name).normalize('NFC');
  const m = /^(.+?)(특별자치시|특별자치도|특별시|광역시|자치구|자치시|자치도)$/.exec(n);
  if (m && m[1].length > 1) {
    if (/시$/.test(m[2])) return m[1] + '시';
    if (/도$/.test(m[2])) return m[1] + '도';
    if (/구$/.test(m[2])) return m[1] + '구';
  }
  return n;
}
function matchInput(raw, items, spacy = false) {
  const key = s => {
    let t = String(s).normalize('NFC');
    if (!spacy) t = t.replace(/\s/g, '');
    return t.toLowerCase();
  };
  const buf = key(raw);
  for (let i = 0; i < buf.length; i++) {
    const sub = buf.slice(i);
    const open = items.filter(it => !it.claimed);
    const exact = open.find(it => key(it.name) === sub);
    if (exact) return exact;
    const alias = open.find(it =>
      it.aliases.some(a => key(a) === sub) &&
      open.every(x => x === it ||
        (!key(x.name).startsWith(sub) && !x.aliases.some(a => key(a) === sub))));
    if (alias) return alias;
  }
  return null;
}
/* ── 사운드 (WebAudio 삑 소리, 소재 확보 전 임시) ────── */
let ac;
function beep(freq, dur = .07, type = 'sine') {
  if (!opt.sound) return;
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(.09, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}

/* ── 화면 ───────────────────────────────────────────── */
function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  if (id !== 'play') stop();
  /* 숨어 있던 동안에는 알약을 앉힐 자리를 잴 수 없었다 — 보이고 난 다음 프레임에 앉힌다 */
  if (id === 'regions') requestAnimationFrame(() => relayoutNavShapes());
  requestAnimationFrame(() => requestAnimationFrame(syncGrid));
}

function applyGrid(ox, oy, nx, ny = nx) {
  const svg = $('.grid-bg'), p = $('#bitgrid');
  if (!p || !(nx > 0)) return;
  svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
  p.setAttribute('width', nx);
  p.setAttribute('height', ny);
  p.setAttribute('x', ox);
  p.setAttribute('y', oy);
  p.querySelector('path').setAttribute('d', `M${nx} 0 V${ny} H0`);
  /* 폰 홈의 위 흐림(.top-blur)은 --bg 단색 겹이라 이 격자를 덮는다 — 같은 원점·칸을 CSS 에 넘겨 겹에도 그린다 */
  const s = document.documentElement.style;
  for (const [k, v] of [['--gx', ox], ['--gy', oy], ['--gw', nx], ['--gh', ny]]) s.setProperty(k, v + 'px');
}
/* SVG 유저 좌표 → 화면. 추정하지 않고 CTM 으로 격자 원점·칸을 읽는다. */
const DECO_CELL = 152;   /* 플레이 밖 장식 격자 칸(px). about.html 과 같은 값 */
function syncGrid() {
  /* 플레이 밖에서는 맞출 지도가 없다 — 못 박은 칸으로 되돌리고 셸만 다시 앉힌다.
     되돌리지 않으면 플레이에서 나올 때 그 판의 칸 크기가 배경에 굳어 남는다 */
  if (!($('#play').classList.contains('on') && G && G.cam)) {
    /* 화면 폭·높이가 DECO_CELL 의 배수가 아니면 우측·하단에 짜투리 칸이 남는다.
       칸을 화면에 딱 맞는 배수로 살짝 늘리거나 줄여 경계를 딱 맞춘다 */
    const w = window.innerWidth, h = window.innerHeight;
    const cols = Math.max(1, Math.round(w / DECO_CELL));
    const rows = Math.max(1, Math.round(h / DECO_CELL));
    /* 칸은 반드시 정사각형이다 — 칸에 앉는 버튼이 원이라, 가로세로가 다르면 그대로
       타원으로 눌린다. 가로에 딱 맞춘 한 변과 세로에 딱 맞춘 한 변 중, 반대쪽에
       남는 자투리가 적은 쪽을 고른다. 한 변으로 두 축을 다 맞출 수는 없으니
       어느 쪽이든 자투리는 남고, 적게 남는 쪽을 고르는 것이 여기서 할 수 있는 최선이다 */
    const fitW = w / cols, fitH = h / rows;
    const spare = (cell) => Math.abs(w - cols * cell) + Math.abs(h - rows * cell);
    const cw = spare(fitH) < spare(fitW) ? fitH : fitW, ch = cw;
    /* 칸 크기와 '몇 번째 칸'을 CSS 로 넘긴다 — 타이틀은 자리를 재지 않고 칸에 앉는다.
       로고가 가운데 세 칸, 그 아래 한 줄이 버튼 세 칸이라 덩이는 세 칸 × 두 줄이다 */
    const st = document.documentElement.style;
    st.setProperty('--deco-cw', cw + 'px');
    st.setProperty('--deco-ch', ch + 'px');
    st.setProperty('--title-col', String(Math.max(0, Math.floor((cols - 3) / 2))));
    st.setProperty('--title-row', String(Math.max(0, Math.round((rows - 2) / 2))));
    applyGrid(...courseGridArgs(cw, ch));
    planCourses();
    return;
  }
  const root = $('#map'), space = G.cam, cell = G.cell;
  const ctm = space.getScreenCTM();
  if (!ctm) return;
  const a = root.createSVGPoint();
  a.x = 0; a.y = 0;
  const o = a.matrixTransform(ctm);
  a.x = cell;
  const x1 = a.matrixTransform(ctm);
  applyGrid(o.x, o.y, Math.hypot(x1.x - o.x, x1.y - o.y));
}
function decoGrid() {
  const s = getComputedStyle(document.documentElement);
  const cw = parseFloat(s.getPropertyValue('--deco-cw')) || DECO_CELL;
  const ch = parseFloat(s.getPropertyValue('--deco-ch')) || DECO_CELL;
  const cols = Math.max(1, Math.round(innerWidth / cw));
  const rows = Math.max(1, Math.round(innerHeight / ch));
  return { cw, ch, cols, rows };
}
function resolveCell(c, r, cols, rows) {
  const col = c < 0 ? cols + c : c;
  const row = r < 0 ? rows + r : r;
  return [Math.max(0, Math.min(cols - 1, col)), Math.max(0, Math.min(rows - 1, row))];
}
/* 서울 자치구 칸의 자리. maps/ 구 윤곽과 seoul-gu.geom 중심점을 8×7 덩이에 옮겼다.
   한강 남쪽이 아래, 강서가 서끝, 강동이 동끝, 도봉이 북끝 */
const SEOUL_MAP = [8, 7];
const SEOUL_CELLS = {
  'dobong-dong': [5, 0],
  'eunpyeong-dong': [2, 1], 'gangbuk-dong': [4, 1], 'nowon-dong': [5, 1],
  'jongno-dong': [3, 2], 'seongbuk-dong': [4, 2], 'jungnang-dong': [6, 2],
  'gangseo-dong': [0, 3], 'mapo-dong': [2, 3], 'seodaemun-dong': [3, 3],
  'jung-dong': [4, 3], 'dongdaemun-dong': [5, 3], 'gangdong-dong': [7, 3],
  'yangcheon-dong': [1, 4], 'yeongdeungpo-dong': [2, 4], 'yongsan-dong': [3, 4],
  'seongdong-dong': [5, 4], 'gwangjin-dong': [6, 4],
  'guro-dong': [1, 5], 'dongjak-dong': [3, 5], 'gangnam-dong': [5, 5], 'songpa-dong': [6, 5],
  'geumcheon-dong': [2, 6], 'gwanak-dong': [3, 6], 'seocho-dong': [4, 6],
};
/* 코스 칸은 화면 가운데 덩이로 선다. 자리표(at)가 없으면 한 줄 여섯 칸까지 줄짓는다.
   머리글 줄(0)은 비운다.
   ponytail: 칸이 모자라는 좁은 화면에서는 끝 칸에 겹친다 — 넘치면 페이지를 나눈다 */
function courseCell(k, n, cols, rows, at) {
  const map = COURSE.map || SEOUL_MAP;
  const w = at ? map[0] : Math.max(1, Math.min(n, cols - 2, 6));
  const h = at ? map[1] : Math.ceil(n / w);
  const c0 = Math.floor((cols - w) / 2);
  const r0 = Math.max(1, Math.floor((rows - h) / 2));
  const [dc, dr] = at || [k % w, Math.floor(k / w)];
  /* 서울 덩이는 칸이 모자라도 겹치지 않는다 — 아래는 끌어 보면 된다 */
  if (at) return [c0 + dc, r0 + dr];
  return resolveCell(c0 + dc, r0 + dr, cols, rows);
}
/* 행정동 칸 자리. geom 의 s 가 겹치지 않으면 그걸 쓰고, 없으면 중심점으로 빈칸을 메운다.
   칸이 구 윤곽을 닮게, 같은 자리는 두지 않는다 */
function packGeom(items) {
  const n = items.length;
  if (!n) return { size: [1, 1], cells: {} };
  const byS = items.every(it => Array.isArray(it.s) && it.s.length === 2);
  if (byS) {
    const cols = items.map(it => it.s[0]), rows = items.map(it => it.s[1]);
    const c0 = Math.min(...cols), r0 = Math.min(...rows);
    const W = Math.max(...cols) - c0 + 1, H = Math.max(...rows) - r0 + 1;
    const cells = {}, seen = new Set();
    let ok = true;
    for (const it of items) {
      const k = (it.s[0] - c0) + ',' + (it.s[1] - r0);
      if (seen.has(k)) { ok = false; break; }
      seen.add(k);
      cells[it.name] = [it.s[0] - c0, it.s[1] - r0];
    }
    if (ok) return { size: [W, H], cells };
  }
  const xs = items.map(it => it.c[0]), ys = items.map(it => it.c[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const bw = Math.max(...xs) - x0 || 1, bh = Math.max(...ys) - y0 || 1;
  const cellsN = Math.max(n, Math.ceil(n / .5));
  let H = Math.max(3, Math.round(Math.sqrt(cellsN * bh / bw)));
  let W = Math.max(3, Math.ceil(cellsN / H));
  const id = (c, r) => c + ',' + r;
  const toCell = (it, w, h) => [
    Math.max(0, Math.min(w - 1, Math.round((it.c[0] - x0) / bw * (w - 1)))),
    Math.max(0, Math.min(h - 1, Math.round((it.c[1] - y0) / bh * (h - 1)))),
  ];
  const place = (w, h) => {
    const taken = new Set(), out = {};
    const order = items.slice().sort((a, b) => a.c[1] - b.c[1] || a.c[0] - b.c[0]);
    for (const it of order) {
      let [c, r] = toCell(it, w, h);
      if (taken.has(id(c, r))) {
        let best = null, bd = Infinity;
        for (let rr = 0; rr < h; rr++) for (let cc = 0; cc < w; cc++) {
          if (taken.has(id(cc, rr))) continue;
          const d = (cc - c) * (cc - c) + (rr - r) * (rr - r);
          if (d < bd) { bd = d; best = [cc, rr]; }
        }
        if (!best) return null;
        [c, r] = best;
      }
      taken.add(id(c, r));
      out[it.name] = [c, r];
    }
    return out;
  };
  let out = place(W, H);
  while (!out) {
    if (W <= H) W++; else H++;
    out = place(W, H);
  }
  return { size: [W, H], cells: out };
}
function followGrid(ms) {
  const t0 = performance.now();
  const step = () => {
    syncGrid();
    if (performance.now() - t0 < ms) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
/* 데스크톱 확대는 125% 까지만 레이아웃에 반영한다 — 그 위로는 설정 셸을 같은 비율로
   되돌려(--zc) 고르기 판 두 열이 한 열로 접히지 않게 한다. 확대 자체는 페이지가 막을
   수 없다. 확대율은 창 바깥/안쪽 폭의 비로 재고 5% 눈금으로 반올림한다 —
   창틀·스크롤바 몇 px 이 100% 를 101% 로 읽게 만드는 걸 지운다 */
const ZOOM_CAP = 1.25;
function capZoom() {
  const z = Math.round((window.outerWidth / window.innerWidth) * 20) / 20;
  const fine = matchMedia('(pointer:fine)').matches;
  const k = (fine && z > ZOOM_CAP) ? ZOOM_CAP / z : 1;
  document.documentElement.style.setProperty('--zc', String(k));
}
capZoom();
window.addEventListener('resize', capZoom);
window.addEventListener('resize', syncGrid);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go);
});

/* ── 코스 로드 ──────────────────────────────────────── */
const grab = url => fetch(asset(url)).then(r => r.json());
/* 서울 칸 데이터는 boot 의 다른 짐(i18n·world·sense)을 기다리지 않고 곧장 나선다.
   로그인 화면에서 돌아올 때 점이 제 칸으로 날아가려면, 새 문서가 처음 그려지는
   순간에 칸이 이미 서 있어야 한다 — 늦게 서면 짝을 못 찾고 그냥 흐려진다 */
const KR = Promise.all([grab('data/kr-tree.json'), grab('data/kr-names.json')]);
const loadCourse = slug => grab(`data/${slug}.course.json`);
const loadGeom = slug => grab(`data/${slug}.geom.json`);
const load = slug => Promise.all([loadCourse(slug), loadGeom(slug)]);

/* ── 코스 고르기 — 격자 한 칸 버튼 ─────────────────────
   홈의 장식 격자와 격자 한 칸 버튼을 그대로 쓴다. 서울 자치구가 서울 모양으로
   서고, 한 번 누르면 그 구로 포커스, 같은 구를 한 번 더 누르면 행정동이 그 칸에서
   좌표대로 번져 나온다 — 화면은 그대로다. 격자는 그 칸을 붙잡고 촘촘해지고, 둘레 구는
   작아진 채 밖으로 밀린다. 치는 건 시작 칸이 한다. */
let COURSE = { tiles: [], tree: null, root: '', px: 0, py: 0, z: 1, map: null };
let PICK = null;      // 고른 칸
const MARK = new Set();   // 함께 고른 칸들. PICK 은 그 가운데 마지막으로 누른 칸이다
/* 같은 단계의 이웃 칸인가. 격자로 한 칸 넘게 떨어지면 복수 선택을 놓는다 */
function nextTo(a, b) {
  if (!a || !b || !a.gc || !b.gc) return false;
  if (!a.kid !== !b.kid || (a.kid && a.parent !== b.parent)) return false;
  return Math.max(Math.abs(a.gc[0] - b.gc[0]), Math.abs(a.gc[1] - b.gc[1])) <= 1;
}
let OPEN = null;      // 펼친 칸 { tile, bw, bh, kids }
let openGen = 0;
const TILE = new WeakMap();

/* 나라 코스는 칸이 아니라 머리글이다. 칸은 뿌리 바로 아래 코스만 —
   값이 null 인 자리(코스가 아직 없는 곳)는 칸을 만들지 않는다 */
function courseList(root, tree) {
  const list = [];
  if (tree) for (const [k, slug] of Object.entries(tree.children)) {
    const [parent, name] = k.split('/');
    if (parent === root && slug) list.push({ slug, name });
  }
  return list;
}

/* 임계 감쇠 스프링 — Apple 이 이동·재배치에 쓰는 damping 1, response .42.
   목표만 바꾸면 지금 값과 속도에서 이어 가므로, 펼치는 도중에 접어도 튀지 않는다.
   손으로 던진 것(폰 시트)만 damping .8 · response .3 으로 살짝 넘친다 */
const RESPONSE = .42;
const sp = (x, eps) => ({ x, v: 0, to: x, eps });
function spStep(p, dt, resp = RESPONSE, damp = 1) {
  if (p.x === p.to && !p.v) return false;
  const w = 2 * Math.PI / resp;
  p.v += (w * w * (p.to - p.x) - 2 * damp * w * p.v) * dt;
  p.x += p.v * dt;
  if (Math.abs(p.to - p.x) < p.eps && Math.abs(p.v) < p.eps * 10) { p.x = p.to; p.v = 0; return false; }
  return true;
}
const calm = () => !opt.motion || matchMedia('(prefers-reduced-motion:reduce)').matches;
const GZ = { z: sp(1, .0005), ax: sp(0, .05), ay: sp(0, .05),
             px: sp(0, .05), py: sp(0, .05), cz: sp(1, .0005),
             nx: sp(0, .02), ny: sp(0, .02) };   // 격자 배율·붙잡은 점·카메라·커서 반응
/* 커서가 움직이면 초점이 그쪽을 바라본다 — 지도는 반대로 아주 조금 물러나고,
   그만큼 커서 쪽이 드러난다(고개를 돌리면 눈앞 풍경이 반대로 흐르는 결).
   10px 이면 칸(160px)의 6% 라 눈에 걸리지 않고 손끝에만 남는다. 카메라와 같은
   스프링(response .42)을 타서 커서보다 한 박자 늦게 따라온다 */
const NUDGE = -10;
/* 홈 카메라 배율. 핀치와 스마트 포커스가 같이 쓴다. 펼친 동이 넵바에 들어가면
   하한까지 줄이고, 가운데에 작게 뜨면 상한까지 키운다 */
const fingers = () => matchMedia('(pointer:coarse)').matches;
/* 손가락 화면은 서울 덩이(8칸)가 폭에 다 들어야 해서 하한이 더 낮다 */
const HOME_Z = [fingers() ? .2 : .42, 3], PLAY_Z = [1, 8], HOME_FILL = .8;
function clampZoom(z, lo, hi) { return Math.max(lo, Math.min(hi, z)); }
/* 홈의 기본 배율. 데스크톱은 1배, 손가락 화면은 서울 덩이가 좌우 16px 여백 안에 든다 */
const homeFit = box => Math.min(1, fingers() ? (innerWidth - 32) / box.w : 1, homeStage().h / box.h);

function makeTile(label, slug, kid) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'grid-btn';
  /* 글자는 안쪽 span 에 둔다 — 칸과 따로 키워야 밀려나 작아진 칸에서도 읽힌다 */
  el.append(document.createElement('span'));
  el.firstChild.textContent = label;
  el.setAttribute('aria-label', label);
  el.setAttribute('aria-pressed', 'false');
  const tile = { el, label, short: label, slug, kid, x: sp(0, .05), y: sp(0, .05), s: sp(1, .0005),
                 o: sp(1, .0005), f: sp(1, .0005), wait: 0, order: 0 };
  TILE.set(el, tile);
  return tile;
}
/* 밀려나 작아진 시·도 칸의 이름. 남북으로 갈린 도는 첫 글자와 방위(충청북도 → 충북),
   나머지는 접미를 뗀 어간(서울특별시 → 서울, 경기도 → 경기) */
function shortAdmin(name) {
  const m = /^(.).(남|북)도$/.exec(String(name).normalize('NFC'));
  return m ? m[1] + m[2] : stripSuffix(name) || name;
}
/* 펼친 구역 칸의 한국어 이름. 시·군 접미를 떼고(파주시 → 파주), 시 안의 구는 시 글자만
   뗀다(고양시일산서구 → 고양일산서구). 구·읍·면·동은 떼면 중구·동구가 한 글자라 둔다 */
function kidName(name) {
  const n = String(name).normalize('NFC');
  const m = /^(.+?)시(.+구)$/.exec(n);
  if (m) return m[1] + m[2];
  return /^.{2,}[시군]$/.test(n) ? n.slice(0, -1) : n;
}
/* 칸에 보이는 지명. 화면 말이 한국어가 아니면 로마자 표(kr-names.json)에서 꺼낸다 —
   치는 이름은 그대로 한국어다. short 면 밀려난 칸에 쓸 짧은 이름 */
function placeName(names, parent, name, short = false) {
  const en = LANG !== 'ko' && names && names[`${parent}/${name}`];
  if (!en) return short ? shortAdmin(name) : adminLabel(name);
  return short ? en.replace(/-(do|si)$/, '') : en;
}
/* 칸 글자 크기. 밀려난 칸은 짧은 이름으로 바꾸고 k 배로 키운다 — 칸이 1/d 로 줄어도
   화면 글자는 k/d 배인 구역 칸 글자와 같아진다. 어느 칸이든 폭을 넘으면 폭에 맞춰 줄인다.
   처음 재는 칸은 바로 맞춘다 — 화면에 들어서자마자 글자가 줄어드는 게 보이지 않게 */
function asideTile(tile, on, k = 1) {
  const span = tile.el.firstChild, text = on ? tile.short : tile.label;
  if (span.textContent !== text) span.textContent = text;
  if (!span.scrollWidth) return;   // 숨은 화면에서는 잴 수 없다
  /* 폰 한국어는 칸 폭을 거의 다 쓴다 — 네 글자 구가 깨알이 되지 않게. 칸을 넘기면
     실기기에서 이웃 이름과 붙어 '서대문구중구' 로 읽혀 폭 안에서 멈춘다 */
  const f = Math.min(on ? k : 1, tile.el.clientWidth * (fingers() && LANG === 'ko' ? .98 : .86) / span.scrollWidth);
  const first = !tile.fitted;
  tile.fitted = true;
  if (tile.f.to === f && !first) return;
  tile.f.x = tile.f.to = f;
  /* 글자 크기도 CSS 트랜지션이 옮긴다(style.css). 처음 재는 칸은 바로 맞춘다 */
  span.style.transition = calm() || first ? 'none' : '';
  span.style.transform = `scale(${f.toFixed(4)})`;
}
/* ── 홈 칸의 움직임은 CSS 트랜지션이 한다 ──
   저전력 모드의 Safari·Chrome 은 JS 가 매 프레임 그리는 움직임을 초당 30장으로 묶지만,
   transform·opacity 트랜지션은 합성기가 제 박자로 돌린다. 그래서 JS 는 목표 자리만 한 번
   찍는다 — 스프링 값(x·y·s·o·f)은 늘 목표와 같고, 눈에 보이는 중간은 CSS 가 메운다.
   카메라(이동·줌)는 칸마다 곱하지 않고 칸을 담은 통(#courseBtns) 하나에 건다:
   통 translate(px) scale(z) 안의 칸 translate(x) scale(s) = 예전의 translate(x·z+px) scale(s·z).
   번지는 차례(wait)는 transition-delay 다. 길이·곡선은 style.css 의 --cam-dur·--cam-ease */
const CAM_MS = 500;
function paintTile(tile) {
  tile.el.firstChild.style.transform = `scale(${tile.f.x.toFixed(4)})`;
  tile.el.style.transform =
    `translate3d(${tile.x.x.toFixed(2)}px,${tile.y.x.toFixed(2)}px,0) scale(${tile.s.x.toFixed(4)})`;
  tile.el.style.opacity = tile.o.x.toFixed(3);
}
/* now 면 트랜지션 없이 바로(끌기·휠·처음 그리기) — 손을 1:1 로 따라와야 한다.
   커서 기울기는 translate 에 둔다. transform 에 같이 적으면 마우스가 움직일 때마다
   목표가 바뀌어, 가는 중인 초점 이동이 처음부터 다시 시작된다 */
function paintCam(now = false) {
  const el = $('#courseBtns');
  el.style.transition = now || calm() ? 'none' : '';
  el.style.transform = `translate3d(${COURSE.px.toFixed(2)}px,${COURSE.py.toFixed(2)}px,0) scale(${(COURSE.z || 1).toFixed(4)})`;
  el.style.translate = `${GZ.nx.to.toFixed(2)}px ${GZ.ny.to.toFixed(2)}px`;
  courseKick();
}
/* 기울기만 옮긴다. 카메라 transform 은 그대로라 초점 이동은 제 시간으로 끝까지 간다 */
function paintNudge() {
  const el = $('#courseBtns');
  if (calm()) el.style.transition = 'none';
  else if (el.style.transition === 'none') el.style.transition = '';
  el.style.translate = `${GZ.nx.to.toFixed(2)}px ${GZ.ny.to.toFixed(2)}px`;
  courseKick();
}
/* 줄인 움직임에서는 트랜지션 없이 바로 옮긴다 */
function aimTile(tile, x, y, s, o, wait = 0, snap = false) {
  if (!snap && tile.x.to === x && tile.y.to === y && tile.s.to === s && tile.o.to === o) return;
  const still = snap || calm();
  tile.el.inert = o === 0;
  tile.el.style.transition = still ? 'none' : '';
  tile.el.style.transitionDelay = still || !wait ? '' : wait.toFixed(3) + 's';
  tile.o.x = tile.o.to = o;
  /* 접히는 구역은 줄인 움직임에서 제자리에서 사라지기만 한다 */
  if (!(still && tile.gone)) [[tile.x, x], [tile.y, y], [tile.s, s]].forEach(([p, v]) => { p.x = p.to = v; });
  paintTile(tile);
  /* 다 사라진 뒤에 걷는다. 그 사이 다시 보이게 되면(o 가 0 이 아니면) 두고 간다 */
  if (tile.gone && o === 0) setTimeout(() => {
    if (!tile.gone || tile.o.to !== 0) return;
    tile.el.remove();
    COURSE.tiles = COURSE.tiles.filter(t => t !== tile);
  }, still ? 0 : wait * 1000 + CAM_MS);
}
/* 격자 배율도 칸과 같은 곡선·같은 시간으로 — 보이지 않는 요소 하나(GK)에 트랜지션을 걸고
   그 지금 값을 읽는다. translate(A·(1−z)) scale(z) 를 함수마다 보간하면 붙잡은 점 A 는
   움직이는 내내 제자리다(선이 A 쪽으로 모인다) */
const GK = document.createElement('i');
const GK_T = 'transform var(--cam-dur) var(--cam-ease)';
GK.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;transform-origin:0 0';
$('#courseBtns').before(GK);
function aimGrid(z, ax, ay) {
  if (GZ.z.to === z && GZ.ax.to === ax && GZ.ay.to === ay) return;
  GZ.z.x = GZ.z.to = z; GZ.ax.x = GZ.ax.to = ax; GZ.ay.x = GZ.ay.to = ay;
  GK.style.transition = calm() ? 'none' : GK_T;
  GK.style.transform = `translate(${(ax * (1 - z)).toFixed(2)}px,${(ay * (1 - z)).toFixed(2)}px) scale(${z.toFixed(5)})`;
  courseKick();
}
/* 통이 지금 서 있는 카메라 — 트랜지션 도중이면 그 중간 값이다(계산된 스타일) */
function liveOf(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return { z: 1, px: 0, py: 0 };
  const m = new DOMMatrix(t);
  return { z: m.a, px: m.e, py: m.f };
}
const liveCam = () => liveOf($('#courseBtns'));
/* 커서 기울기의 지금 값. transform 과 따로라 계산된 transform 에는 안 들어 있다 */
function liveNudge(el) {
  const raw = getComputedStyle(el).translate;
  if (!raw || raw === 'none') return { x: 0, y: 0 };
  const n = raw.match(/-?[\d.]+/g) || [];
  return { x: parseFloat(n[0]) || 0, y: n.length > 1 ? parseFloat(n[1]) || 0 : 0 };
}
/* 무늬 원점을 붙잡은 점 A 에 두고 칸을 z 배로 — 선이 A 쪽으로 모인다.
   A 는 늘 큰 칸의 모서리라 z = 1/d 에서 선이 작은 칸 격자와 딱 겹친다.
   카메라는 통의 지금 값을 읽는다 — 칸과 한 치도 어긋나지 않는다 */
function courseGridArgs(cw, ch) {
  const on = $('#regions').classList.contains('on');
  const { z: cam, px, py } = on ? liveCam() : { z: 1, px: 0, py: 0 };
  const n = on ? liveNudge($('#courseBtns')) : { x: 0, y: 0 };
  const { z: gz, px: gx, py: gy } = on ? liveOf(GK) : { z: 1, px: 0, py: 0 };
  return [gx * cam + px + n.x, gy * cam + py + n.y, cw * gz * cam, ch * gz * cam];
}

/* 격자만 JS 가 그린다(SVG 무늬 속성은 트랜지션이 없다). 통이 움직이는 동안 매 프레임
   통의 지금 카메라를 따라 그린다. 저전력 모드에선 이 선만 30장이고, 흐린 선이라 덜 보인다 */
let courseRaf = 0;
function courseKick() {
  if (courseRaf) return;
  courseRaf = requestAnimationFrame(courseFrame);
}
function courseFrame() {
  let busy = false;
  if ($('#regions').classList.contains('on')) {
    const { cw, ch } = decoGrid();
    applyGrid(...courseGridArgs(cw, ch));
    busy = $('#courseBtns').getAnimations().length > 0 || GK.getAnimations().length > 0;
  }
  courseRaf = busy ? requestAnimationFrame(courseFrame) : 0;
}

/* 펼친 덩이 중심에서 원래 자리로 가는 단위 벡터. 겹치면 등각으로 가른다 */
function radialPush(ox, oy, cx, cy, i, n) {
  const dx = ox - cx, dy = oy - cy, len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    const a = (2 * Math.PI * i) / Math.max(1, n);
    return [Math.cos(a), Math.sin(a)];
  }
  return [dx / len, dy / len];
}

/* 칸마다 목표 자리를 새로 잡는다. 목표가 그대로면 스프링은 건드리지 않는다 */
function planCourses(snap = false) {
  const tops = COURSE.tiles.filter(tile => !tile.kid);
  if (!tops.length) return;
  const { cw, ch, cols, rows } = decoGrid();
  const coarse = tile => courseCell(tops.indexOf(tile), tops.length, cols, rows, tile.cell);
  /* 이웃 판정은 지도에서의 자리로 한다 — 펼친 동안 둘레로 밀려나도 기준은 그대로다 */
  tops.forEach(tile => { tile.gc = coarse(tile); });
  const fold = (list, stepMax) => {
    const step = Math.min(stepMax, .3 / Math.max(1, list.length));
    list.sort((a, b) => b.order - a.order).forEach((tile, i) =>
      aimTile(tile, tile.parent.x.to, tile.parent.y.to, tile.parent.s.to, 0, i * step));
  };
  if (!OPEN) {
    tops.forEach(tile => {
      const [c, r] = coarse(tile);
      aimTile(tile, c * cw, r * ch, 1, 1, 0, snap);
      asideTile(tile, false);
    });
    fold(COURSE.tiles.filter(tile => tile.gone), .02);
    aimGrid(1, GZ.ax.to, GZ.ay.to);
    /* 손가락 화면의 배율은 칸 크기에서 나온다 — 칸이 바뀌면(첫 syncGrid·회전) 다시 맞춘다 */
    if (snap || fingers()) syncHomeCam(snap);
    courseKick();
    return;
  }
  const { tile: host, ar, kids } = OPEN;
  /* 구역 칸은 시작 칸과 같은 큰 칸이 기본이다(k = d). 덩이가 화면에 안 들면 한 단씩 줄인다.
     d 는 격자를 몇 배 촘촘히 할지, k 는 구역 칸이 작은 칸 몇 개 폭인지. 둘레 구는 작은 칸 하나 */
  const n = kids.length + 1, area = Math.ceil(n * 1.15);
  let d, k, bw, bh;
  for ([d, k] of [[2, 2], [3, 2], [2, 1], [3, 1], [4, 1]]) {
    const maxW = Math.floor((cols * d - 2 * d) / k);   // 양옆에 시·도 자리를 큰 칸 하나씩 남긴다
    const maxH = Math.floor((rows - 1) * d / k);
    bh = Math.min(maxH, Math.max(2, Math.round(Math.sqrt(area / ar))));
    bw = Math.max(2, Math.ceil(area / bh));
    if (bw <= maxW) break;
  }
  const F = cols * d, R = rows * d, fw = cw / d, fh = ch / d;
  const taken = new Set();
  const id = (c, r) => c + ',' + r;
  const block = (c0, r0, w, h) => {
    for (let c = c0; c < c0 + w; c++) for (let r = r0; r < r0 + h; r++) taken.add(id(c, r));
  };
  const free = (c, r, size) => {
    for (let dc = 0; dc < size; dc++) for (let dr = 0; dr < size; dr++) {
      const x = c + dc, y = r + dr;
      if (x < 0 || y < 0 || x >= F || y >= R || taken.has(id(x, y))) return false;
    }
    return true;
  };
  /* 머리글 줄과 아래 왼쪽 이름 줄은 비워 둔다 */
  block(0, 0, F, d);
  block(0, (rows - 1) * d, 2 * d, d);
  /* (c, r) 에서 가장 가까운 빈자리를 size 칸 걸음으로 찾는다 — 구역 칸끼리 줄이 맞는다.
     away 가 있으면 같은 거리에서 그 점에서 먼 쪽을 고른다.
     ponytail: 자리마다 고리를 넓혀 가며 훑는다 — 칸이 수천 개가 되면 빈칸 목록을 따로 둔다 */
  const near = (c, r, away, size = 1) => {
    for (let ring = 0; ring * size < F + R; ring++) {
      let best = null, score = Infinity;
      for (let i = -ring; i <= ring; i++) for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const x = c + i * size, y = r + j * size;
        if (!free(x, y, size)) continue;
        const sc = i * i + j * j - (away ? .01 * Math.hypot(x - away[0], y - away[1]) : 0);
        if (sc < score) { score = sc; best = [x, y]; }
      }
      if (best) { block(best[0], best[1], size, size); return best; }
    }
    return [c, r];
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const [hc, hr] = coarse(host);
  const x0 = clamp(hc * d - (bw >> 1) * k, 0, F - bw * k);
  const y0 = clamp(hr * d - (bh >> 1) * k, d, R - bh * k);
  const cx = x0 + (bw >> 1) * k, cy = y0 + (bh >> 1) * k;
  /* 부모 칸이 가운데, 구역은 지도에서 제 쪽 칸으로. 가운데 가까운 구역이 먼저 자리를 잡는다 */
  const place = new Map([[host, near(cx, cy, null, k)]]);
  kids.map(tile => [tile, x0 + Math.round(tile.u * (bw - 1)) * k, y0 + Math.round(tile.v * (bh - 1)) * k])
    .sort((p, q) => Math.hypot(p[1] - cx, p[2] - cy) - Math.hypot(q[1] - cx, q[2] - cy))
    .forEach(([tile, c, r]) => {
      const at = near(c, r, null, k);
      place.set(tile, at);
      tile.gc = [Math.round((at[0] - x0) / k), Math.round((at[1] - y0) / k)];
    });
  const cells = [...place.values()];
  const zx0 = Math.min(...cells.map(p => p[0])) - 1, zx1 = Math.max(...cells.map(p => p[0])) + k;
  const zy0 = Math.min(...cells.map(p => p[1])) - 1, zy1 = Math.max(...cells.map(p => p[1])) + k;
  block(zx0, zy0, zx1 - zx0 + 1, zy1 - zy0 + 1);
  const mx = (zx0 + zx1) / 2, my = (zy0 + zy1) / 2;
  /* 둘레 구는 원래 지도 덩이 중심에서 본 방위로 펼친 블록 바깥에 고리를 만든다.
     호스트가 한쪽에 있어도 강동은 동, 도봉은 북으로 나간다. 각이 겹치면 near 가 민다 */
  const others = tops.filter(tile => tile !== host);
  let sx = 0, sy = 0;
  tops.forEach(tile => { const [c, r] = coarse(tile); sx += c * d; sy += r * d; });
  const ox = sx / tops.length, oy = sy / tops.length;
  others.map((tile, i) => {
    const [oc, or] = coarse(tile);
    const [ux, uy] = radialPush(oc * d, or * d, ox, oy, i, others.length);
    return { tile, ux, uy, ang: Math.atan2(uy, ux) };
  }).sort((a, b) => a.ang - b.ang).forEach(({ tile, ux, uy }) => {
    const tx = ux > 0 ? (zx1 + 1 - mx) / ux : ux < 0 ? (zx0 - 1 - mx) / ux : Infinity;
    const ty = uy > 0 ? (zy1 + 1 - my) / uy : uy < 0 ? (zy0 - 1 - my) / uy : Infinity;
    const dist = Math.max(1, Math.min(tx, ty));
    const c = clamp(Math.round(mx + ux * dist), 0, F - 1);
    const r = clamp(Math.round(my + uy * dist), 0, R - 1);
    const [pc, pr] = near(c, r, [mx, my]);
    aimTile(tile, pc * fw, pr * fh, 1 / d, 1);
    asideTile(tile, true, k);
  });
  const [pc, pr] = place.get(host);
  aimTile(host, pc * fw, pr * fh, k / d, 1);
  asideTile(host, false);
  /* 하나씩 번진다 — 부모 칸에서 가까운 구역부터. 전체가 .6초를 넘지 않게 간격을 죈다 */
  const step = Math.min(.035, .6 / kids.length);
  kids.map(tile => [tile, place.get(tile)])
    .sort((p, q) => Math.hypot(p[1][0] - pc, p[1][1] - pr) - Math.hypot(q[1][0] - pc, q[1][1] - pr))
    .forEach(([tile, [c, r]], i) => {
      tile.order = i;
      aimTile(tile, c * fw, r * fh, k / d, 1, i * step);
      asideTile(tile, false);
    });
  fold(COURSE.tiles.filter(tile => tile.gone), .02);
  aimGrid(1 / d, hc * cw, hr * ch);
  focusHome(snap);
  courseKick();
}

async function tellPick() {
  const name = $('#courseName'), tile = PICK;
  /* 여러 칸을 골랐으면 코스 제목 대신 고른 칸 이름을 늘어놓는다 */
  if (MARK.size > 1) { name.textContent = [...MARK].map(x => x.short || x.label).join(' · '); return; }
  /* 아무 칸도 안 고르면 서울 코스다 — 머리글이 그걸 브랜드 색으로 알린다 */
  const slug = tile ? tile.slug : COURSE.root;
  if (!slug) return;
  try {
    const course = await loadCourse(slug);
    /* 제 코스가 없는 구역은 부모 코스를 친다 — 무엇을 치게 되는지 같이 적는다.
       코스 제목은 한국어로만 적혀 있어, 다른 화면 말에서는 칸 이름과 곳 수로 짓는다 */
    const owner = !tile ? null : tile.kid && tile.slug === tile.parent.slug ? tile.parent : tile;
    const label = LANG === 'ko' ? courseLabel(course)
      : `${owner ? owner.label : homeTitle()} · ${t('places', { n: course.items.length })}`;
    if (PICK === tile) name.textContent = !owner || owner === tile ? label : `${tile.label} · ${label}`;
  } catch {}
}
/* tile 이 null 이면 서울 코스를 고른 것이다 */
function paintCourseHead(label) {
  const b = $('#coursePick'), box = $('#regions .screen-head');
  if (!b) return;
  b.textContent = label || '';
  b.hidden = !label;
  if (box) box.hidden = !label;
  if (label) b.removeAttribute('aria-label');
  else b.setAttribute('aria-label', homeTitle());
}
/* add 는 Shift. 이웃 칸이면 더 고르고(이미 골랐으면 뺀다), 멀면 그 칸 하나만 남긴다 */
function pickTile(tile, add = false) {
  if (!tile) { MARK.clear(); PICK = null; }
  else if (add && [...MARK].some(m => nextTo(m, tile))) {
    if (MARK.has(tile) && MARK.size > 1) {
      MARK.delete(tile);
      if (PICK === tile) PICK = [...MARK].pop();
    } else { MARK.add(tile); PICK = tile; }
  } else {
    MARK.clear(); MARK.add(tile); PICK = tile;
  }
  COURSE.tiles.forEach(x => x.el.setAttribute('aria-pressed', String(MARK.has(x))));
  const head = $('#coursePick');
  if (head) head.setAttribute('aria-pressed', String(!tile));
  tellPick();
}
/* 접히는 구역을 고르고 있었거나 초점이 거기 있었으면 부모 칸으로 돌린다 */
function foldKids() {
  COURSE.tiles.forEach(tile => {
    if (tile.kid && !tile.gone) { tile.gone = true; tile.el.classList.add('gone'); }
  });
  if (!OPEN) return;
  OPEN.tile.el.setAttribute('aria-expanded', 'false');
  [...MARK].forEach(tile => { if (tile.gone) MARK.delete(tile); });
  if (PICK && PICK.gone) pickTile(OPEN.tile);
  if (OPEN.kids.some(tile => tile.el.contains(document.activeElement))) OPEN.tile.el.focus();
}
function closeCourse() {
  openGen++;
  if (!OPEN) return false;
  foldKids();
  OPEN = null;
  planCourses();
  /* 접었다고 서울 전체로 물러나지 않는다 — 보던 구에 그대로 남는다.
     전체로 돌아가는 건 Esc 나 머리글을 눌러 고르기를 풀었을 때다 */
  syncHomeCam();
  return true;
}
async function openCourse(host) {
  if (host.kid || host.gone) return;
  if (!host.el.hasAttribute('aria-expanded') || (OPEN && OPEN.tile === host)) { closeCourse(); return; }
  const n = ++openGen;
  let geom;
  try { geom = await loadGeom(host.slug); } catch { return; }
  if (n !== openGen) return;
  foldKids();
  const its = geom.items, xs = its.map(it => it.c[0]), ys = its.map(it => it.c[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 || 1, h = Math.max(...ys) - y0 || 1;
  const kids = its.map(it => {
    const own = COURSE.tree && COURSE.tree.children[`${host.slug}/${it.name}`];
    const tile = makeTile(LANG === 'ko' ? kidName(it.name) : placeName(COURSE.names, host.slug, it.name),
                          own || host.slug, true);
    tile.el.setAttribute('aria-label', placeName(COURSE.names, host.slug, it.name));
    Object.assign(tile, { name: it.name, parent: host, u: (it.c[0] - x0) / w, v: (it.c[1] - y0) / h });
    ['x', 'y', 's'].forEach(k => { tile[k].x = tile[k].to = host[k].x; });
    tile.o.x = tile.o.to = 0;
    tile.el.inert = true;
    paintTile(tile);
    return tile;
  });
  host.el.after(...kids.map(tile => tile.el));
  COURSE.tiles.push(...kids);
  host.el.setAttribute('aria-expanded', 'true');
  OPEN = { tile: host, ar: w / h, kids };
  /* 펼친 칸이 곧 current 다 — 접었을 때 그 구가 그대로 골라져 있다 */
  pickTile(host);
  planCourses();
}

/* 설정 게임 탭의 동 구분. 법정동이면 구 칸이 법정동 코스(-bdong)를 가리킨다 */
const dongSlug = slug => opt.dong === 'legal' ? slug.replace(/-dong$/, '-bdong') : slug;
async function renderCourses() {
  /* 서울만 연다. 설정 지역 탭은 개발 중이라 고른 나라가 홈 지도를 바꾸지 않는다 */
  const [tree, names] = await KR;
  const root = 'seoul-gu';
  openGen++;
  OPEN = null;
  const was = PICK && (PICK.kid ? PICK.parent.name : PICK.name);
  GZ.px.x = GZ.px.to = 0; GZ.px.v = 0;
  GZ.py.x = GZ.py.to = 0; GZ.py.v = 0;
  GZ.cz.x = GZ.cz.to = 1; GZ.cz.v = 0;
  COURSE = { tree, names, root, px: 0, py: 0, z: 1, map: SEOUL_MAP,
    tiles: courseList(root, tree).map(it => {
    const tile = makeTile(placeName(names, root, it.name), dongSlug(it.slug), false);
    tile.name = it.name;
    tile.short = placeName(names, root, it.name, true);
    tile.cell = SEOUL_CELLS[it.slug];
    tile.el.setAttribute('aria-expanded', 'false');
    return tile;
  }) };
  $('#courseBtns').replaceChildren(...COURSE.tiles.map(tile => tile.el));
  paintCourseHead('');
  pickTile(COURSE.tiles.find(tile => tile.name === was) || null);
  planCourses(true);
  COURSE.tiles.forEach(paintTile);
  paintCam(true);
}
/* 코스 칸은 지도가 다시 그려질 때마다 새로 나므로 문서에서 받는다 */
document.addEventListener('click', e => {
  /* 로그인 덮개가 떠 있으면 칸은 배경일 뿐이다 — 호버는 살아 있되 눌리지 않는다 */
  if (document.body.matches('.signing, .setting, .paging')) return;
  const b = e.target.closest('#courseBtns .grid-btn');
  const tile = b && TILE.get(b);
  if (tile) {
    /* 한 번 누르면 그 구로 포커스, 같은 구를 한 번 더 누르면 행정동을 편다.
       세 번째는 openCourse 가 접는다. 동 칸은 아래가 없으니 고르기만 한다.
       키보드 Enter 도 같은 click 이라 갈래를 따로 두지 않는다 */
    if (e.shiftKey) { pickTile(tile, true); syncHomeCam(); }
    else if (!tile.kid && PICK === tile) openCourse(tile);
    else {
      /* 다른 구를 고르면 펼쳐둔 곳은 접는다 — 위 단계로 돌아온 것이다. 접지 않으면
         focusHome 이 펼친 덩이 갈래를 타서 카메라가 엉뚱한 구로 간다.
         동 칸은 제 덩이 안에서 고르는 것이라 접지 않는다 */
      if (!tile.kid && OPEN && OPEN.tile !== tile) closeCourse();
      pickTile(tile);
      syncHomeCam();
    }
  }
  if (e.target.closest('#coursePick')) { pickTile(null); syncHomeCam(); }
  /* 고른 칸이 있으면 그 코스로, 없으면 서울 코스로 */
  if (e.target.closest('#navPlay') && COURSE.root) {
    /* 여러 칸은 한 코스 안에서만 고를 수 있으니, 그 코스를 고른 곳만 남겨 친다 */
    if (MARK.size > 1) start(PICK.kid ? PICK.parent.slug : COURSE.root, new Set([...MARK].map(x => x.name)));
    else start(PICK ? PICK.slug : COURSE.root);
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !$('#regions').classList.contains('on')) return;
  if (document.body.matches('.signing, .setting, .paging')) return;
  /* 고른 칸이 있으면 먼저 고르기를 멈춰 서울 코스로 돌아가고, 없을 때 펼친 곳을 접는다 */
  if (PICK) { pickTile(null); syncHomeCam(); }
  else closeCourse();
});

/* 홈 지도를 끌어도 칸이 화면 밖으로 통째로 사라지지 않게 가둔다 */
function clampHomePan(px, py, tiles, useTo = false, z = COURSE.z || 1) {
  tiles = tiles || COURSE.tiles.filter(t => !t.gone && t.o.to > 0);
  if (!tiles.length) return [0, 0];
  const { cw, ch } = decoGrid();
  const pad = Math.min(cw, ch) * .4 * z;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tiles) {
    const s = (useTo ? t.s.to : t.s.x) * z;
    const x = (useTo ? t.x.to : t.x.x) * z;
    const y = (useTo ? t.y.to : t.y.x) * z;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + cw * s); y1 = Math.max(y1, y + ch * s);
  }
  return [
    Math.max(pad - x1, Math.min(innerWidth - pad - x0, px)),
    Math.max(pad - y1, Math.min(innerHeight - pad - y0, py)),
  ];
}
function shiftHome(px, py, tiles, useTo = false) {
  [px, py] = clampHomePan(px, py, tiles, useTo);
  COURSE.px = px; COURSE.py = py;
  GZ.px.x = GZ.px.to = px; GZ.px.v = 0;
  GZ.py.x = GZ.py.to = py; GZ.py.v = 0;
  paintCam(true);
  const { cw, ch } = decoGrid();
  applyGrid(...courseGridArgs(cw, ch));
}
function aimHomeCam(px, py, z, tiles, snap = false) {
  z = clampZoom(z, HOME_Z[0], HOME_Z[1]);
  [px, py] = clampHomePan(px, py, tiles, true, z);
  GZ.cz.x = GZ.cz.to = z; GZ.cz.v = 0;
  GZ.px.x = GZ.px.to = px; GZ.px.v = 0;
  GZ.py.x = GZ.py.to = py; GZ.py.v = 0;
  COURSE.z = z; COURSE.px = px; COURSE.py = py;
  paintCam(snap);
  if (snap || calm()) {
    const { cw, ch } = decoGrid();
    applyGrid(...courseGridArgs(cw, ch));
  }
}
function homeStage() {
  const nav = $('#regions .navbar');
  /* 폰의 아래 막대(#tabDock)는 접혀도 제 상자 높이가 그대로라 지도 자리가 흔들리지 않는다 */
  const dock = $(fingers() ? '#tabDock' : '#regions .nav-bot');
  const pad = 28;
  const top = (nav ? nav.getBoundingClientRect().bottom : 160) + pad;
  const bot = (dock ? dock.getBoundingClientRect().top : innerHeight) - pad;
  const left = pad, right = innerWidth - pad;
  return { cx: (left + right) / 2, cy: (top + bot) / 2,
           w: Math.max(1, right - left), h: Math.max(1, bot - top) };
}
function worldBox(tiles) {
  const { cw, ch } = decoGrid();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tiles) {
    const s = t.s.to;
    x0 = Math.min(x0, t.x.to); y0 = Math.min(y0, t.y.to);
    x1 = Math.max(x1, t.x.to + cw * s); y1 = Math.max(y1, t.y.to + ch * s);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
/* 펼친 덩이는 무대를 채우도록 맞춘다 — 동이 윗줄·아래 막대에 가리면 줄이고,
   한가운데 작게 뜨면 키운다. 고르기만 했으면 배율은 그대로 두고 그 칸을
   한가운데로 밀기만 한다: 구 하나를 채우려 들면 배율이 상한까지 튄다 */
function focusHome(snap = false) {
  if (!$('#regions').classList.contains('on')) return;
  const stage = homeStage();
  if (OPEN) {
    const tiles = [OPEN.tile, ...OPEN.kids].filter(t => !t.gone && t.o.to > 0);
    if (!tiles.length) return;
    const box = worldBox(tiles), self = worldBox([OPEN.tile]);
    const cx = (self.x0 + self.x1) / 2, cy = (self.y0 + self.y1) / 2;
    /* 펼친 구를 무대 한가운데에 못 박는다. 덩이 상자 한가운데에 맞추면 동이 한쪽으로
       치우친 구(성북구처럼)에서 구 자신이 옆으로 밀려 — 방금 맞춘 초점이 흔들린다.
       배율은 그 못에서 가장 먼 동까지가 들어가게 고른다 */
    const reachX = Math.max(cx - box.x0, box.x1 - cx, 1);
    const reachY = Math.max(cy - box.y0, box.y1 - cy, 1);
    const z = clampZoom(HOME_FILL * Math.min(stage.w / (2 * reachX), stage.h / (2 * reachY)), HOME_Z[0], HOME_Z[1]);
    aimHomeCam(stage.cx - cx * z, stage.cy - cy * z, z, tiles, snap);
    return;
  }
  if (!PICK || PICK.gone) return;
  const all = COURSE.tiles.filter(t => !t.kid && !t.gone);
  const box = worldBox([PICK]), z = homeFit(worldBox(all));
  /* 가둠은 덩이 전체로 잰다 — 가장자리 구를 가운데로 밀어도 지도가 날아가지 않는다 */
  aimHomeCam(stage.cx - (box.x0 + box.x1) / 2 * z, stage.cy - (box.y0 + box.y1) / 2 * z, z, all, snap);
}
function restoreHomeView(snap = false) {
  const tiles = COURSE.tiles.filter(t => !t.kid && !t.gone);
  if (!tiles.length) return;
  const box = worldBox(tiles), stage = homeStage();
  const z = homeFit(box);
  const px = innerWidth / 2 - (box.x0 + box.x1) / 2 * z;
  const head = stage.cy - stage.h / 2;
  const viewH = stage.h;
  const py = box.h * z < viewH ? head + (viewH - box.h * z) / 2 - box.y0 * z : head - box.y0 * z;
  aimHomeCam(px, py, z, tiles, snap);
}
/* 카메라가 갈 곳은 늘 지금 초점이다 — 펼쳤으면 그 덩이, 고르기만 했으면 그 칸,
   아무것도 없으면 서울 전체. 열고 닫고 크기를 바꾸는 길이 저마다 제 시야를 고르면
   그때마다 초점이 샌다. 카메라를 옮기는 자리는 전부 여기로 모은다 */
function syncHomeCam(snap = false) {
  if (!$('#regions').classList.contains('on')) return;
  if (OPEN || (PICK && !PICK.gone)) focusHome(snap);
  else restoreHomeView(snap);
}
/* 서울 덩이가 화면보다 크면 가운데로 끌어 한강 일대가 먼저 보이게 한다 */
function nudgeHome(snap = true) { restoreHomeView(snap); }

/* 커서 반응. 손가락·펜에는 걸지 않고(헛호버), 모션을 줄였으면 아예 쉰다 */
const fineHover = () => matchMedia('(hover:hover) and (pointer:fine)').matches;
function aimNudge(x, y) {
  const on = fineHover() && !calm() && $('#regions').classList.contains('on')
    && !document.body.classList.contains('signing') && !document.body.classList.contains('setting');
  const grip = v => Math.max(-1, Math.min(1, v));
  const nx = !on || x == null ? 0 : grip((x - innerWidth / 2) / (innerWidth / 2)) * NUDGE;
  const ny = !on || x == null ? 0 : grip((y - innerHeight / 2) / (innerHeight / 2)) * NUDGE;
  if (nx === GZ.nx.to && ny === GZ.ny.to) return;
  GZ.nx.x = GZ.nx.to = nx; GZ.ny.x = GZ.ny.to = ny;
  /* 끄는 동안은 손을 1:1 로 따라가는 중이라 트랜지션을 다시 켜지 않는다.
     기울기만 옮긴다 — 카메라 transform 을 다시 쓰면 초점 이동이 끊긴다 */
  if (!drag) paintNudge();
}
$('#regions').addEventListener('pointermove', e => {
  if (drag || e.pointerType !== 'mouse') return;
  aimNudge(e.clientX, e.clientY);
});
$('#regions').addEventListener('pointerleave', () => aimNudge(null));
addEventListener('blur', () => aimNudge(null));

/* 홈·플레이 지도를 같은 끌기로 옮긴다. 칸을 눌러 고르는 클릭은 문턱을 넘지 않으면 그대로다 */
let drag = null, skipClick = false;
/* 손가락은 누르기만 해도 몇 px 흔들린다 — 마우스 문턱(6px)이면 탭이 끌기로 먹힌다 */
const slopOf = e => e.pointerType === 'mouse' ? 36 : 196;
document.addEventListener('click', e => {
  if (!skipClick) return;
  if (e.target.closest('#tabDock')) { skipClick = false; return; }   // 지도를 끈 뒤 첫 탭 누름을 삼키지 않는다
  skipClick = false;
  e.preventDefault();
  e.stopPropagation();
}, true);
/* 넵바 링크를 끌면 브라우저가 주소 미리보기를 달고 나온다. 파이어폭스는 -webkit-user-drag 를 몰라 여기서 막는다 */
$('#regions').addEventListener('dragstart', e => {
  if (e.target.closest && e.target.closest('.navbar, .nav-bot, .tab-dock')) e.preventDefault();
});
$('#regions').addEventListener('pointerdown', e => {
  if (e.button || !$('#regions').classList.contains('on') || fingersOn.size > 1) return;
  if (e.target.closest('.navbar, .nav-bot, .tab-dock, .map-ctl, .screen-head, .rk-layer, dialog, a, input, textarea, select')) return;
  /* 캡처는 문턱을 넘긴 뒤에만. 처음부터 #regions 가 잡으면 칸 버튼의 click 이
     부모로 다시 향해 구를 눌러도 행정동이 안 열린다 */
  GZ.cz.x = GZ.cz.to = COURSE.z || 1; GZ.cz.v = 0;
  drag = { kind: 'home', id: e.pointerId, cx: e.clientX, cy: e.clientY, slop: slopOf(e),
           touch: e.pointerType !== 'mouse', px: GZ.px.x, py: GZ.py.x, moved: false, host: $('#regions') };
});
addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const sx = e.clientX - drag.cx, sy = e.clientY - drag.cy;
  if (!drag.moved && sx * sx + sy * sy < drag.slop) return;
  if (!drag.moved) {
    drag.moved = true;
    drag.host.classList.add('is-drag');
    if (drag.kind === 'home') {
      try { drag.host.setPointerCapture(drag.id); } catch {}
      /* 카메라가 아직 미끄러지는 중이면 지금 선 자리에서 잡는다 — 목표에서 잡으면 튄다 */
      const c = liveCam(), n = liveNudge($('#courseBtns'));
      COURSE.z = c.z; COURSE.px = c.px + n.x - GZ.nx.to; COURSE.py = c.py + n.y - GZ.ny.to;
      GZ.cz.x = GZ.cz.to = c.z;
      paintCam(true);
      drag.px = COURSE.px - sx; drag.py = COURSE.py - sy;
      /* 지도를 끌기 시작하면 폰 시트는 접혀 길을 비운다 */
      if (SHEET.open) sheetSet(false);
    }
  }
  /* 처리한 때가 아니라 일어난 때로 잰다 — 바쁠 때 몰려 처리된 이동이 순간 속도로 부풀어 튕김이 튄다 */
  (drag.hist || (drag.hist = [])).push([e.timeStamp, e.clientX, e.clientY]);
  if (drag.hist.length > 8) drag.hist.shift();
  if (drag.kind === 'play') {
    const p = viewPoint(e);
    if (!p || !G) return;
    look(drag.tx + (p.x - drag.x), drag.ty + (p.y - drag.y));
    syncGrid();
  } else shiftHome(drag.px + sx, drag.py + sy);
});
function dragEnd(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  /* 터치는 누른 칸(버튼)이 포인터를 저절로 잡는다. 끌기가 캡처를 지도로 옮기면 그 칸이
     lostpointercapture 를 내는데, 그걸 끝으로 읽으면 칸 위에서 시작한 끌기가 바로 죽는다 */
  if (e && e.type === 'lostpointercapture' && e.target !== drag.host) return;
  if (drag.host) drag.host.classList.remove('is-drag');
  if (drag.moved) skipClick = true;
  if (drag.moved && drag.touch && e && e.type === 'pointerup') fling(drag);
  drag = null;
}
/* 손가락으로 튕기고 떼면 그 속도로 조금 더 미끄러진다 — 폰 지도의 관성.
   멈췄다가 뗐거나 모션을 줄였으면 없다. 마우스 끌기는 예전 그대로 선다 */
const FLING_MS = 260;
function fling(d) {
  const h = d.hist;
  if (!h || h.length < 2 || calm()) return;
  const [t1, x1, y1] = h[h.length - 1];
  if (performance.now() - t1 > 60) return;
  const f = h.find(s => t1 - s[0] <= 100), dt = t1 - f[0];
  if (dt < 8) return;
  const vx = (x1 - f[1]) / dt, vy = (y1 - f[2]) / dt;
  if (Math.hypot(vx, vy) < .3) return;
  panBy(d.kind, vx * FLING_MS, vy * FLING_MS, true);
}
/* 화면 px 만큼 지도를 민다. glide 면 스프링·전환을 태워 미끄러지게 */
function panBy(kind, dx, dy, glide) {
  if (kind === 'home') {
    if (glide) aimHomeCam(COURSE.px + dx, COURSE.py + dy, COURSE.z);
    else shiftHome(COURSE.px + dx, COURSE.py + dy);
    return;
  }
  const a = viewPoint({ clientX: 0, clientY: 0 }), b = viewPoint({ clientX: dx, clientY: dy });
  if (!a || !b) return;
  look(G.tx + b.x - a.x, G.ty + b.y - a.y);
  if (glide) followGrid(600); else syncGrid();
}
/* 핀치에서 한 손가락이 남으면 그 손가락으로 끌기를 이어 간다 */
function resumeDrag(kind, id, x, y) {
  if (kind === 'home') {
    drag = { kind, id, cx: x, cy: y, px: COURSE.px, py: COURSE.py, touch: true, moved: true, host: $('#regions') };
  } else {
    const p = viewPoint({ clientX: x, clientY: y });
    if (!p) return;
    drag = { kind, id, x: p.x, y: p.y, tx: G.tx, ty: G.ty, cx: x, cy: y, touch: true, moved: true, host: $('#map') };
  }
  drag.host.classList.add('is-drag');
}
addEventListener('pointerup', dragEnd);
addEventListener('pointercancel', dragEnd);
addEventListener('lostpointercapture', dragEnd, true);
document.addEventListener('keydown', e => {
  if (!$('#regions').classList.contains('on')) return;
  if (e.target.closest('input, textarea, select, dialog')) return;
  const go = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (!go) return;
  e.preventDefault();
  const step = e.shiftKey ? 80 : 40;
  shiftHome(COURSE.px + go[0] * step, COURSE.py + go[1] * step);
});

/* 홈·플레이 지도를 휠·트랙패드(핀치=ctrl+wheel)로 확대한다. 칸이 화면에서
   사라지지 않게 가두고, 줄어든 움직임에서는 배율만 바꾸고 카메라는 안 민다 */
function wheelZoomFactor(e) {
  const line = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
  const gain = (e.ctrlKey ? .012 : .003) * (calm() ? .45 : 1);
  const k = Math.exp(-e.deltaY * line * gain);
  return Math.min(1.25, Math.max(.8, k));
}
function zoomHomeAt(mx, my, factor) {
  if (!$('#regions').classList.contains('on') || !COURSE.tiles.length) return;
  const old = COURSE.z || 1;
  const z = clampZoom(old * factor, HOME_Z[0], HOME_Z[1]);
  if (z === old) return;
  COURSE.z = z;
  GZ.cz.x = GZ.cz.to = z; GZ.cz.v = 0;
  shiftHome(mx - (mx - COURSE.px) / old * z, my - (my - COURSE.py) / old * z);
}
let zoomHold = 0;
function zoomPlayAt(mx, my, factor) {
  if (!G || !G.cam) return;
  const old = G.z || G.zoom;
  const z = clampZoom(old * factor, PLAY_Z[0], PLAY_Z[1]);
  if (z === old) return;
  const p = viewPoint({ clientX: mx, clientY: my });
  G.z = z;
  const map = $('#map');
  map.style.setProperty('--z', z);
  map.classList.add('is-zoom');
  clearTimeout(zoomHold);
  zoomHold = setTimeout(() => map.classList.remove('is-zoom'), calm() ? 0 : 80);
  if (!p) { look(G.tx, G.ty); return; }
  look(p.x - (p.x - G.tx) / old * z, p.y - (p.y - G.ty) / old * z);
}
function mapWheel(e) {
  if (e.target.closest('dialog, input, textarea, select')) return;
  if ($('#regions').classList.contains('on')) {
    if (e.target.closest('.navbar, .nav-bot, .tab-dock, .map-ctl, .screen-head, .rk-layer')) return;
    if (!e.target.closest('#regions')) return;
    e.preventDefault();
    zoomHomeAt(e.clientX, e.clientY, wheelZoomFactor(e));
  } else if ($('#play').classList.contains('on')) {
    if (e.target.closest('button, a, input, .hud')) return;
    if (!e.target.closest('#play')) return;
    e.preventDefault();
    zoomPlayAt(e.clientX, e.clientY, wheelZoomFactor(e));
  }
}
addEventListener('wheel', mapWheel, { passive: false });
/* 두 손가락 핀치. gesture* 는 Safari 에만 있어 안드로이드는 포인터 둘의 거리로 잰다.
   둘째 손가락이 닿으면 한 손가락 끌기는 놓고, 뗀 뒤의 click 은 삼킨다 */
const fingersOn = new Map();
let pinchD = 0, pinchM = null;
const pinchKind = () => $('#regions').classList.contains('on') ? 'home'
  : $('#play').classList.contains('on') && G && G.cam ? 'play' : null;
const pinchSpan = () => { const [a, b] = [...fingersOn.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  /* 첫 손가락이면 화면에 남은 손가락은 없다. iOS 는 pointerup·cancel 을 빠뜨릴 때가 있어
     그 유령이 남으면 다음 한 손가락 끌기가 핀치로 읽혀 지도가 튀고 엉뚱하게 줄었다 커진다 */
  if (e.isPrimary) { fingersOn.clear(); pinchD = 0; }
  if (e.target.closest('#softkb')) return;   // 두 엄지로 치는 건 핀치가 아니다
  fingersOn.set(e.pointerId, [e.clientX, e.clientY]);
  if (fingersOn.size !== 2) return;
  if (drag) { if (drag.host) drag.host.classList.remove('is-drag'); drag = null; }
  const [a, b] = [...fingersOn.values()];
  pinchD = pinchSpan(); pinchM = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}, true);
addEventListener('pointermove', e => {
  if (!fingersOn.has(e.pointerId)) return;
  fingersOn.set(e.pointerId, [e.clientX, e.clientY]);
  if (fingersOn.size !== 2 || !pinchD) return;
  /* 두 손가락 사이가 벌어진 만큼 확대하고, 가운데가 움직인 만큼 민다 — 지도 앱처럼 */
  const d = pinchSpan(), [a, b] = [...fingersOn.values()], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const kind = pinchKind();
  if (kind && d > 0) {
    (kind === 'home' ? zoomHomeAt : zoomPlayAt)(m[0], m[1], d / pinchD);
    panBy(kind, m[0] - pinchM[0], m[1] - pinchM[1], false);
  }
  pinchD = d; pinchM = m;
}, true);
const fingerUp = e => {
  if (!fingersOn.delete(e.pointerId)) return;
  if (!pinchD) return;
  skipClick = true; setTimeout(() => { skipClick = false; }, 350);
  if (fingersOn.size > 1) return;
  pinchD = 0;
  const kind = pinchKind(), [[id, [x, y]] = []] = [...fingersOn];
  if (kind && id != null && !(kind === 'play' && fingers())) resumeDrag(kind, id, x, y);   // 폰 게임은 끌기 없음
};
addEventListener('pointerup', fingerUp, true);
addEventListener('pointercancel', fingerUp, true);
function wirePinch(el, zoomAt) {
  let last = 1;
  el.addEventListener('gesturestart', e => { e.preventDefault(); last = 1; });
  el.addEventListener('gesturechange', e => {
    e.preventDefault();
    if (fingersOn.size > 1) return;   // iOS 터치 핀치는 위의 포인터 쪽이 맡는다(맥 트랙패드만 여기)
    const f = e.scale / last;
    last = e.scale;
    zoomAt(e.clientX, e.clientY, f);
  });
}
wirePinch($('#regions'), zoomHomeAt);
wirePinch($('#play'), zoomPlayAt);
/* 폰에서는 Safari 페이지 줌을 어디서도 시작시키지 않는다 — 독(#tabDock)은 body 로 나가 있어 위
   #regions 의 막음이 닿지 않고, 지도 핀치(포인터)와 함께 페이지가 줄어 막대 비율이 깨진다 */
for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, e => { if (fingers()) e.preventDefault(); });
document.addEventListener('keydown', e => {
  const plus = e.key === '+' || e.key === '=' || e.key === 'Add';
  const minus = e.key === '-' || e.key === '_' || e.key === 'Subtract';
  if (!plus && !minus) return;
  const factor = plus ? 1.12 : 1 / 1.12;
  if ($('#play').classList.contains('on') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    zoomPlayAt(innerWidth / 2, innerHeight / 2, factor);
    return;
  }
  if (e.target.closest('input, textarea, select, dialog')) return;
  if (!$('#regions').classList.contains('on')) return;
  e.preventDefault();
  zoomHomeAt(innerWidth / 2, innerHeight / 2, factor);
});

/* 윗줄·아래줄 알약. 쉴 때 윗줄은 로고 오른쪽 점, 아래줄은 시작하기에 앉아 있고,
   호버·초점이 칸으로 가면 경기장형으로 커지며 따라간다. 손가락 화면은
   hover 가 없어 집에 두고, 키보드는 초점을 따른다 */
function navTopTarget(el) {
  if (!el || !el.closest) return null;
  const logo = el.closest('.nav-logo');
  /* 봇이 로고에서 조르는 동안(ranked.js 의 rk-intro)은 알약이 로고를 감싸지
     않는다 — 로고 점이 제 자리에서 로고를 채운다 */
  if (logo && logo.closest('#regions .navbar')) return document.body.classList.contains('rk-intro') ? null : logo;
  const it = el.closest('.nav-item');
  if (!it) return null;
  if (!it.closest('#regions .navbar')) return null;
  return it;
}
function navBotTarget(el) {
  if (!el || !el.closest) return null;
  const it = el.closest('.nav-item');
  if (!it || !it.closest('#regions .nav-bot')) return null;
  return it;
}
function makeNavFollow(spec) {
  const SPR = { x: sp(0, .05), y: sp(0, .05), w: sp(8, .05), h: sp(8, .05) };
  let aim = null, on = false, raf = 0, t0 = 0, base = null, pull = null;
  function paint() {
    const shape = spec.shape();
    if (!shape) return;
    shape.style.width = SPR.w.x.toFixed(2) + 'px';
    shape.style.height = SPR.h.x.toFixed(2) + 'px';
    shape.style.transform = 'translate(' + SPR.x.x.toFixed(1) + 'px,' + SPR.y.x.toFixed(1) + 'px)';
  }
  function kick() {
    if (raf) return;
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    const dt = Math.max(0, Math.min(.034, (now - t0) / 1000));
    t0 = now;
    let busy = false;
    for (const p of Object.values(SPR)) busy = spStep(p, dt) || busy;
    paint();
    raf = busy ? requestAnimationFrame(frame) : 0;
  }
  function aimTo(el) {
    const shape = spec.shape(), nav = spec.nav();
    if (!shape || !nav) return;
    /* 로그인 덮개로 초점이 넘어가도 뒤의 알약은 로그인에 남는다. */
    const signin = $('#signinLink');
    if ($('#signin') && !$('#signin').hidden && nav.contains(signin)) el = signin;
    const setLink = nav.querySelector('a[href^="settings"]');
    if (document.body.classList.contains('setting') && setLink) el = setLink;
    const home = spec.home();
    const t = el || home;
    aim = el || null;
    nav.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('is-on', n === t));
    const logo = nav.querySelector('.nav-logo');
    if (logo) logo.classList.toggle('is-on', t === logo);
    const pill = !!(t && (spec.pillAtRest || t !== home));
    shape.classList.toggle('is-pill', pill);
    if (!t) return;
    const nr = nav.getBoundingClientRect();
    /* 화면이 숨어 있으면(.screen 이 display:none) 모든 rect 가 0 이다. 그 값을 스프링에
       넣으면 알약이 넵바 왼쪽 위 구석에 박힌 채 돌아온다 — 재지 말고 물러난다 */
    if (!nr.width) return;
    const r = t.getBoundingClientRect();
    const x = r.left - nr.left, w = r.width, h = r.height;
    let y = r.top - nr.top;
    /* 알약은 줄 한가운데에 선다. 로고는 시각 보정으로 조금 올라가 있어서(translate)
       제 rect 를 그대로 쓰면 알약만 따라 올라가 칸마다 높이가 달라 보인다.
       쉴 때의 점은 줄이 아니라 로고의 점 자리라 손대지 않는다 */
    const ref = pill && nav.querySelector('.nav-item');
    const rr = ref && ref.getBoundingClientRect();
    /* 손가락 화면은 로고가 제 줄에 따로 선다 — 같은 줄일 때만 맞춘다 */
    if (rr && rr.bottom > r.top && rr.top < r.bottom) y = (rr.top + rr.bottom) / 2 - nr.top - h / 2;
    const still = calm() || !on;
    on = true;
    base = { x, y, w, h };
    place(still);
  }
  /* 누른 채 끌면 알약이 손끝 쪽으로 늘어나며 끌려간다 — iOS 탭 막대의 결. 멀어질수록
     덜 따라오는 고무줄(Apple rubber band, c .55)이라 아무리 끌어도 칸을 벗어나지 않고,
     끄는 쪽으로 늘어난 만큼 옆으로는 살짝 홀쭉해진다. 놓으면 같은 스프링으로 돌아온다 */
  function place(still) {
    let { x, y, w, h } = base;
    if (pull && !calm()) {
      const rb = (d, m) => Math.sign(d) * m * (1 - 1 / (Math.abs(d) * .55 / m + 1));
      const dx = rb(pull.px - pull.nx - x - w / 2 - pull.ox, 28);
      const dy = rb(pull.py - pull.ny - y - h / 2 - pull.oy, 14);
      const ax = Math.abs(dx), ay = Math.abs(dy);
      const cx = x + w / 2 + dx * .7, cy = y + h / 2 + dy * .7;
      w += ax * .6 - ay * .3;
      h += ay * .6 - ax * .2;
      x = cx - w / 2; y = cy - h / 2;
    }
    [[SPR.x, x], [SPR.y, y], [SPR.w, w], [SPR.h, h]].forEach(([p, v]) => {
      p.to = v;
      if (still) { p.x = v; p.v = 0; }
    });
    if (still) paint();
    else kick();
  }
  function grab(e) {
    const it = spec.target(e.target);
    if (e.button || !it || pull || document.body.classList.contains('rk-intro')) return;
    const nr = spec.nav().getBoundingClientRect(), r = it.getBoundingClientRect();
    pull = { id: e.pointerId, it, nx: nr.left, ny: nr.top, px: e.clientX, py: e.clientY,
             ox: e.clientX - r.left - r.width / 2, oy: e.clientY - r.top - r.height / 2 };
    aimTo(it);
  }
  function drag(e) {
    if (!pull || e.pointerId !== pull.id) return;
    pull.px = e.clientX; pull.py = e.clientY;
    /* 다른 칸 위로 끌고 가면 알약이 그 칸으로 건너가 거기서 다시 늘어난다 */
    const hit = spec.target(document.elementFromPoint(e.clientX, e.clientY));
    if (hit && hit !== pull.it) { pull.it = hit; pull.ox = pull.oy = 0; aimTo(hit); }
    else if (base) place(false);
  }
  function drop(e, fine) {
    if (!pull || e.pointerId !== pull.id) return;
    pull = null;
    aimTo(fine ? spec.target(document.elementFromPoint(e.clientX, e.clientY)) : null);
  }
  function wire() {
    const nav = spec.nav();
    if (!nav || nav.dataset.shapeOn) return;
    nav.dataset.shapeOn = '1';
    const fine = () => matchMedia('(hover:hover) and (pointer:fine)').matches;
    nav.addEventListener('pointerover', e => {
      const it = spec.target(e.target);
      if (!it) return;
      if (fine() || it === document.activeElement) aimTo(it);
    });
    nav.addEventListener('pointerdown', grab);
    addEventListener('pointermove', drag);
    addEventListener('pointerup', e => drop(e, fine()));
    addEventListener('pointercancel', e => drop(e, false));
    nav.addEventListener('pointerleave', () => {
      if (pull) return;
      const a = document.activeElement;
      const keep = nav.contains(a) && a.matches(':focus-visible') ? spec.target(a) : null;
      aimTo(keep || null);
    });
    nav.addEventListener('focusin', e => {
      if (pull) return;
      const it = spec.target(e.target);
      /* 포인터로 연 덮개를 닫아 돌려준 포커스까지 따라가면, 손을 뗐는데도 로그인
         알약이 남는다. 키보드 포커스일 때만 따라가고 포인터는 hover 에 맡긴다. */
      /* 설정·로그인을 클릭할 때 생기는 포커스도 현재 hover 는 유지한다.
         클릭 직후 시작하기로 돌아가면 그 장면이 페이지 전환에 찍힌다. */
      if (it) aimTo(e.target.matches(':focus-visible') || (fine() && it.matches(':hover')) ? it : null);
    });
    nav.addEventListener('focusout', e => {
      if (!nav.contains(e.relatedTarget)) aimTo(null);
    });
    addEventListener('resize', () => { on = false; aimTo(aim); });
    requestAnimationFrame(() => aimTo(null));
  }
  function relayout() { on = false; aimTo(aim); }
  return { aim: aimTo, wire, relayout };
}
const navTop = makeNavFollow({
  nav: () => $('#regions .navbar'),
  shape: () => $('#navShape'),
  home: () => $('#regions .navbar .nav-logo .dot'),
  target: navTopTarget,
  pillAtRest: false,
});
const navBot = makeNavFollow({
  nav: () => $('#regions .nav-bot'),
  shape: () => $('#navBotShape'),
  home: () => $('#navPlay'),
  target: navBotTarget,
  pillAtRest: true,
});
function aimNavShape(el) { navTop.aim(el); }
function aimBotShape(el) { navBot.aim(el); }
function wireNavShape() { navTop.wire(); navBot.wire(); }
function relayoutNavShapes() { navTop.relayout(); navBot.relayout(); }

/* ── 폰의 윗줄 메뉴 ─────────────────────────────────────
   손가락 화면에서는 로고 대신 왼쪽 위 햄버거가 윗줄 메뉴(순위·기록·커뮤니티·소개)를
   펼친다 — 같은 요소를 옮길 뿐이라 href 로 받는 손(ranked.js)과 키보드 길이 그대로 산다.
   설정·시작하기·로그인은 아래 알약에 그대로 있다. 밖을 누르거나 Esc, 칸을 고르면 접힌다 */
const SHEET = { open: false };
const sheetOn = () => fingers() && !!$('#sheetMore').firstChild;
function sheetDock() {
  $('#sheetMore').append(...['#regions a[href="#ranking"]', '#regions a[href="#records"]',
    '#regions a[href="community/"]', '#aboutLink'].map(s => $(s)));
  $('#sheetMore').inert = true;
}
function sheetSet(open) {
  if (!sheetOn()) return;
  dispatchEvent(new Event('rt-sheet'));
  SHEET.open = open;
  $('#sheetGrab').setAttribute('aria-expanded', String(open));
  $('#sheetMore').inert = !open;
  if (!open && $('#sheetMore').contains(document.activeElement)) $('#sheetGrab').focus({ preventScroll: true });
}
document.addEventListener('pointerdown', e => {
  if (SHEET.open && !e.target.closest('.navbar, .rk-layer')) sheetSet(false);
});
$('#sheetMore').addEventListener('click', () => sheetSet(false));
$('#sheetGrab').addEventListener('click', () => sheetSet(!SHEET.open));
/* Esc 는 펼친 시트부터 접는다 — 칸 고르기를 푸는 것(아래 Esc)보다 앞선다 */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !SHEET.open || !$('#regions').classList.contains('on')) return;
  if (document.body.matches('.signing, .setting, .paging')) return;
  e.stopImmediatePropagation();
  sheetSet(false);
}, true);
/* 오른쪽 줄의 전체 보기 — 펼친 구가 있으면 그 덩이, 없으면 서울 전체로 */
$('#homeFit').addEventListener('click', () => { dockMin(false); if (OPEN) focusHome(); else restoreHomeView(); });

/* ── 폰의 아래 막대 — 애플 뮤직 탭 막대 결 ───────────────────
   위 줄 미니 막대(코스 이름·시작), 아래 줄 탭 알약(지도·순위·기록·설정)과 계정 동그라미.
   애플 뮤직이 아래로 스크롤하면 탭 막대를 지금 탭 동그라미로 접고 미니 막대를 그 옆에
   내려앉히듯, 지도를 끌거나 집으면 접는다. 지도 탭·전체 보기를 누르거나 키보드 초점이
   탭 알약에 들어오면 펼친다. 요소는 옮길 뿐이라 href 로 받는 손과 키보드 길이 그대로 산다 */
const dockMin = on => $('#tabDock').classList.toggle('is-min', on && fingers());

/* 탭 순서 — 전환 방향(오른쪽 탭이면 새 화면이 오른쪽에서 밀려온다)이 이걸 따른다.
   덮개는 셋이 따로 산다(ranked.js 순위·기록·계정, settings.js 설정, auth.js 로그인) —
   여기서는 새로 열지 않고, 기존 손잡이(탭 링크의 click)를 그대로 태워 옮긴다 */
const TABS = ['map', 'ranking', 'settings', 'account'];
const TAB_SEL = { map: '#tabHome', ranking: '#tabBar a[href="#ranking"]',
  settings: '#tabBar a[href^="settings"]', account: '#signinLink' };
const TAB = { swap: false, pass: false };   // swap: 탭끼리 옮기는 중 — 덮개들이 pushState 대신 replaceState 를 쓴다
const histPush = (state, url) => history[TAB.swap ? 'replaceState' : 'pushState'](state, '', url);
/* 덮개가 열려 있어도 막대가 남으니, Tab 이 덮개 안에서만 돌지 않게 덮개 쪽 트랩에 얹는다 */
const dockTabs = () => fingers() ? [...document.querySelectorAll('#tabBar .nav-item, #signinLink')] : [];
function tabNow() {
  const b = document.body.classList;
  if (b.contains('signing')) return 'account';
  if (b.contains('setting')) return 'settings';
  if (b.contains('paging')) {
    const p = ['ranking', 'records', 'account'].find(n => !$('#' + n).hidden && !$('#' + n).classList.contains('pg-exit'));
    if (p) return p === 'records' ? 'account' : p;   // 기록은 계정 탭 안에 산다
  }
  return 'map';
}
function tabPaint() {
  $('#tabDock').inert = false;   // 옛 캐시의 덮개 스크립트가 body 자식을 통째로 잠가도 막대는 산다
  const now = tabNow();
  TABS.forEach(n => {
    const el = $(TAB_SEL[n]);
    if (n === now) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  if (now !== 'map') dockMin(false);
}
/* 같은 문서 View Transition — 없거나 움직임을 줄였으면 그냥 즉시 바꾼다 */
function tabSwap(sign, fn) {
  const root = document.documentElement;
  if (!document.startViewTransition || calm()) return fn();
  root.dataset.tabSwap = '';
  root.style.setProperty('--tab-sign', sign);
  const vt = document.startViewTransition(fn);
  vt.ready.catch(() => {}); vt.updateCallbackDone.catch(() => {});   // 빠르게 연달아 누르면 앞 전환이 건너뛰어진다 — 오류가 아니다
  vt.finished.catch(() => {}).finally(() => { delete root.dataset.tabSwap; });
}
function tabGo(to) {
  const from = tabNow();
  if (from === to && !(to === 'account' && !$('#records').hidden)) {
    /* 지도 탭 — 접혀 있으면 펼치고, 펼친 채 다시 누르면 지도를 처음 자리로(탭을 두 번 누르면 맨 위로 가듯). 덮개 탭은 그대로 */
    if (to === 'map') { if ($('#tabDock').classList.contains('is-min')) dockMin(false); else $('#homeFit').click(); }
    return;
  }
  tabSwap(Math.sign(TABS.indexOf(to) - TABS.indexOf(from)), () => {
    TAB.swap = from !== 'map';   // 지도에서 첫 진입만 기록을 쌓는다 — 뒤로 가기 한 번이 곧 홈
    try {
      dispatchEvent(new Event('rt-tab-swap'));
      /* 캐시에 남은 옛 덮개 스크립트는 이 이벤트를 못 듣는다 — 열린 채면 닫기 단추로 닫는다 */
      [['#options', '#optClose'], ['#signin', '#siClose']].forEach(([b, c]) => { if (!$(b).hidden) $(c).click(); });
      if (to !== 'map') { TAB.pass = true; $(TAB_SEL[to]).click(); TAB.pass = false; }
    } finally { TAB.swap = TAB.pass = false; }
    tabPaint();
    /* 포커스는 새 덮개의 제목으로, 지도면 지도 탭으로 */
    const box = ['#ranking', '#records', '#account', '#options', '#signin'].map(s => $(s)).find(n => n && !n.hidden);
    if (!box) $('#tabHome').focus({ preventScroll: true });
    else if (!box.contains(document.activeElement)) (box.querySelector('h1, h2') || box).focus({ preventScroll: true });
  });
}
function tabDock() {
  $('#tabDock .tab-acc').append($('#courseName'), $('#navPlay'));
  $('#tabBar').append(...['#regions a[href="#ranking"]', '#regions a[href="community/"]',
    '#regions .nav-bot a[href="settings/"]'].map(s => $(s)));
  $('#tabDock').append($('#signinLink'));
  /* 기록은 계정 탭 안으로 — 로그인해야 들어오는 곳이다. href 는 그대로라 ranked.js 의 손이 받는다 */
  const rec = $('#regions a[href="#records"]');
  rec.className = 'profile-button';
  $('#account .account-details').prepend(rec);
  /* #regions 안에 있으면 덮개가 뒤를 잠글 때(inert) 막대도 잠긴다 — body 직속으로 뺀다 */
  document.body.append($('#tabDock'));
  /* 덮개는 막대와 함께 열려 있으니 모달이 아니다. 제목은 프로그램으로 초점을 받는다 */
  ['#signin', '#options', '#ranking', '#records', '#account'].forEach(s => {
    const box = $(s);
    box.setAttribute('aria-modal', 'false');
    const h = box.querySelector('h1, h2');
    if (h) h.tabIndex = -1;
  });
  let down = null;
  $('#regions').addEventListener('pointerdown', e => {
    down = e.target.closest('.tab-dock, .navbar, .map-ctl, .rk-layer, dialog') ? null : [e.clientX, e.clientY];
  }, true);
  $('#regions').addEventListener('pointermove', e => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 12) { down = null; dockMin(true); }
  }, true);
  addEventListener('pointerup', () => { down = null; });
  addEventListener('pointercancel', () => { down = null; });
  /* 탭 — 덮개 손잡이보다 먼저 받아 탭끼리의 이동으로 돌린다(합성 click 은 통과시킨다) */
  $('#tabDock').addEventListener('click', e => {
    if (TAB.pass) return;
    const to = TABS.find(n => $(TAB_SEL[n]).contains(e.target));
    if (!to) return;
    e.preventDefault(); e.stopImmediatePropagation();
    tabGo(to);
  }, true);
  $('#tabBar').addEventListener('focusin', () => dockMin(false));
  /* 덮개가 어떤 길로 열리고 닫혀도(Esc·뒤로 가기·주소 해시) 지금 탭 표시가 따라간다 */
  const mo = new MutationObserver(tabPaint);
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  mo.observe($('#tabDock'), { attributes: true, attributeFilter: ['inert'] });
  ['#ranking', '#records', '#account'].forEach(s => mo.observe($(s), { attributes: true, attributeFilter: ['hidden', 'class'] }));
  tabPaint();
}
if (fingers()) {
  sheetDock();
  tabDock();
  /* 결과 시트는 순위표가 늦게 붙어 자란다 — 자랄 때마다 끝난 지도를 그 위 빈 칸에 다시 앉힌다 */
  new ResizeObserver(() => { if ($('#result').classList.contains('on')) fitResult(); }).observe($('#result .res-sheet'));
  /* iOS 는 터치 손잡이가 하나도 없으면 :active(누름 반응)를 안 켠다 */
  document.addEventListener('touchstart', () => {}, { passive: true });
}

const TZ_COUNTRY = {
  'Asia/Seoul': 'KR', 'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN', 'Asia/Taipei': 'TW',
  'Asia/Hong_Kong': 'HK', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Jakarta': 'ID', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Manila': 'PH',
  'Asia/Kolkata': 'IN', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA',
  'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Rome': 'IT', 'Europe/Madrid': 'ES',
  'Europe/London': 'GB', 'Europe/Amsterdam': 'NL', 'Europe/Warsaw': 'PL',
  'Europe/Brussels': 'BE', 'Europe/Vienna': 'AT', 'Europe/Zurich': 'CH',
  'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Helsinki': 'FI',
  'Europe/Athens': 'GR', 'Europe/Bucharest': 'RO', 'Europe/Budapest': 'HU',
  'Europe/Sofia': 'BG', 'Europe/Prague': 'CZ', 'Europe/Lisbon': 'PT',
  'Europe/Dublin': 'IE', 'Europe/Istanbul': 'TR', 'Europe/Kyiv': 'UA', 'Europe/Kiev': 'UA',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA',
  'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR', 'America/Buenos_Aires': 'AR',
  'America/Santiago': 'CL', 'America/Bogota': 'CO',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ',
  'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG',
};
const haveCountry = id => WORLD.countries.some(c => c.id === id);

function countryFromLangTag(tag) {
  const p = String(tag || '').replace('_', '-').split('-');
  if (p[1] && haveCountry(p[1].toUpperCase())) return p[1].toUpperCase();
  const base = normLangTag(tag);
  if (base === 'zh-hant' && haveCountry('TW')) return 'TW';
  if (base === 'zh-hk' && haveCountry('HK')) return 'HK';
  if (base === 'zh' && /hk/i.test(tag) && haveCountry('HK')) return 'HK';
  const hit = LANG_COUNTRY[base];
  return hit && haveCountry(hit) ? hit : null;
}

async function sense() {
  /* 설정 보안 탭의 '접속 지역 추정'을 끄면 중계기에 묻지 않고 시간대만 쓴다 */
  if (opt.where) try {
    const r = await fetch(FEEDBACK_URL + '/where', { signal: AbortSignal.timeout(1600) });
    if (r.ok) {
      const d = await r.json();
      HERE = { country: d.country || '', lang: d.lang || '', timezone: d.timezone || '' };
      return HERE;
    }
  } catch {}
  HERE = { country: '', lang: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '' };
  return HERE;
}

function resolveCountry() {
  /* 배포는 아직 남한만 연다 — 자동 감지도, 저장해 둔 선택도 넘기지 않는다 */
  if (!isDev() && haveCountry('KR')) return 'KR';
  if (opt.country !== 'auto' && haveCountry(opt.country)) return opt.country;
  if (HERE.country && haveCountry(HERE.country)) return HERE.country;
  for (const tag of [HERE.lang, ...(navigator.languages || []), navigator.language]) {
    const hit = countryFromLangTag(tag);
    if (hit) return hit;
  }
  if (TZ_COUNTRY[HERE.timezone] && haveCountry(TZ_COUNTRY[HERE.timezone]))
    return TZ_COUNTRY[HERE.timezone];
  return haveCountry('KR') ? 'KR' : (WORLD.countries[0] && WORLD.countries[0].id);
}

function resolveLang() {
  if (opt.lang !== 'auto' && UI_LANGS.includes(opt.lang)) return opt.lang;
  for (const tag of [HERE.lang, ...(navigator.languages || []), navigator.language]) {
    const hit = parseUiLang(tag);
    if (hit) return hit;
  }
  const pack = WORLD.countries.find(c => c.id === COUNTRY);
  const fromCountry = parseUiLang(pack && pack.lang);
  if (fromCountry) return fromCountry;
  return UI_LANGS.includes('en') ? 'en' : UI_LANGS[0];
}

/* 손으로 지은 코스(제목·한 줄 소개가 붙은 지역)를 가진 나라만 정식이다.
   나머지는 tools 가 찍은 admin-1 뿐이라 미리보기. 데이터에 status 를 새로
   심지 않고 이미 있는 것에서 읽는다 */
const countryStage = id => {
  const pack = WORLD.countries.find(c => c.id === id);
  return pack && (pack.regions || []).some(r => r.title) ? 'available' : 'preview';
};

/* 지금 무엇이 잡혔는지 읽어 준다. 화면에는 더 안 그리고 콘솔에만 남긴다 —
   홈은 서울만, 지역 탭은 개발 중 */
function paintRegion() {
  console.log('[region]', homeTitle(), t('tabDev'));
}

async function showCountry(id) {
  COUNTRY = (isDev() && haveCountry(id)) ? id : resolveCountry();
  paintRegion();
  await renderCourses();
}

async function boot() {
  saveOpt();
  /* 부트 스크립트가 읽어 둔 마지막 말이 있으면 fetch 를 기다리지 않고 바로 입힌다 */
  if (window.RT_UI) { I18N[RT_UI.lang] = RT_UI.pack; LANG = RT_UI.lang; paintUI(); }
  const [i18n, world] = await Promise.all([
    grab('data/i18n.json'),
    grab('data/world.json'),
    sense(),
  ]);
  I18N = i18n;
  /* 한국어 말고는 아직 덜 됐다 — 지명이 플레이 화면에서 한국어로 남고, 로마자는
     칸을 넘쳐 잘린다. 다 될 때까지 개발에서만 연다 */
  UI_LANGS = isDev() ? Object.keys(I18N) : ['ko'];
  WORLD = world;
  LANG_COUNTRY = buildLangCountry(world);
  // 개발에서 골라 둔 나라·언어가 localStorage 에 남아 있어도 배포에서는 되돌린다
  if (!isDev() && opt.country !== 'auto') { opt.country = 'auto'; saveOpt(); }
  if (!isDev() && opt.lang !== 'auto') { opt.lang = 'auto'; saveOpt(); }
  COUNTRY = resolveCountry();
  LANG = resolveLang();
  paintUI();
  cacheUI();
  addEventListener('rt-opt', () => {
    const next = Object.assign({}, DEF, JSON.parse(localStorage.getItem('rt.opt') || '{}'));
    for (const k of Object.keys(next)) if (!(k in DEF)) delete next[k];
    const dong = opt.dong, country = opt.country;
    Object.assign(opt, next);
    /* 나라 고르기는 개발에서만 열린다 — 배포는 showCountry 가 KR 로 되돌린다 */
    if (opt.country !== country && isDev()) showCountry(resolveCountry());
    else if (opt.dong !== dong) renderCourses();
    document.documentElement.toggleAttribute('data-night', opt.night);
    document.documentElement.dataset.motion = opt.motion ? 'on' : 'off';
    document.documentElement.toggleAttribute('data-no-grid', !opt.grid);
    requestAnimationFrame(syncGrid);
    LANG = resolveLang();
    paintUI();
    cacheUI();
    if (G) syncKb();
  });
  fbPlaceholder();
  paintRegion();
  wireNavShape();
  await showCountry(COUNTRY);
  await softMap();
  /* 이어 붙이기가 끝났다 — 등장 움직임 눌러 둔 것을 한 박자 뒤 푼다 */
  setTimeout(() => document.documentElement.removeAttribute('data-still'), 400);
}

/* ── 게임 ───────────────────────────────────────────── */
let G = null, tick = null, pending = null;

/* rk 는 경쟁전 표({id, secs}) — ranked.js 가 중계기에서 받아 넘긴다. 시간은 표가 정한다 */
async function start(slug, only, rk) {
  /* 폰 화상 키보드는 누른 그 자리(동기)에서 초점을 줘야 뜬다(iOS) — 불러오기를
     기다린 뒤의 focus 로는 안 뜬다. 화면을 먼저 열고 입력창을 잡는다 */
  /* 게임 자판이 켜져 있으면 기기 키보드가 올라오지 않게 먼저 막는다 — 코스를 못 치는
     자판이면 syncKb 가 도로 푼다 */
  if (fingers()) { kbMode(opt.softkb); go('play'); if (!opt.softkb) $('#typein').focus(); }
  const secs = rk ? rk.secs : opt.time;
  /* 속도는 '맞힌 곳 이름의 글자 수 ÷ 걸린 시간' 이다. 띄어쓰기는 세지 않는다 */
  const [course, geom] = await load(slug);
  const zoom = playZoom(geom);
  /* only 가 있으면 고른 곳만 친다. 나머지 도트는 배경으로 남아 어디인지 보인다 */
  const pick = only ? course.items.filter(it => only.has(it.name)) : course.items;
  const items = (pick.length ? pick : course.items).map(it => {
    // 어간('서울')과 줄인 행정명('서울시') 둘 다 쳐서 맞는다.
    // 코스가 손으로 적어 둔 별칭(울릉도 같은 것)은 그대로 남는다
    const also = [stripSuffix(it.name), adminLabel(it.name)]
      .filter(a => a && a !== it.name);
    // 한 줄 소개는 아직 사람이 안 쓴 코스가 있다. 여기서 한 번만 채워 두면
    // 목표 줄·자유형·결과 목록이 저마다 undefined 를 막을 필요가 없다
    return { ...it, meta: { description: '', ...it.meta },
             aliases: [...new Set([...(it.aliases || []), ...also])], claimed: false };
  });
  G = { slug, course, items, zoom, z: zoom, seq: course.mode === 'sequence', idx: 0,
       total: secs, left: secs, ranked: rk || null, hits: 0, tries: 0, combo: 0, best: 0, score: 0, chars: 0, part: 0, t0: 0, t1: 0, ok: 0, bad: 0, typed: 0,
       cell: geom.cell, spacy: items.some(it => /\s/.test(it.name)), tx: 0, ty: 0 };
  $('#typein').lang = course.lang || document.documentElement.lang;

  const svg = $('#map');
  svg.setAttribute('viewBox', `0 0 ${geom.w} ${geom.h}`);
  drawDots(svg, geom, items);

  svg.style.setProperty('--z', zoom);   // 라벨·테두리를 역보정해 화면상 크기를 유지한다
  G.cam = svg.querySelector('.cam');
  G.view = [geom.w, geom.h];
  fitPlayK();
  // 정보 줄을 먼저 비운다 — aim() 이 띄운 첫 목표를 곧바로 지워버리던 순서였다
  $('#fact').classList.remove('on');
  $('#fact').innerHTML = '';
  aim();                              // 첫 목표를 잡고 화면을 맞춘다
  $('#statTotal').textContent = '/' + items.length;
  $('#statCount').textContent = '0';
  $('#statSpeed').textContent = '0';
  $('#statCombo').textContent = '';
  $('#typein').value = '';
  $('#gaugeFill').style.width = '100%';
  $('#statTime').firstElementChild.textContent = clock(secs);
  $('#play').classList.toggle('is-ranked', !!rk);
  $('#rkTag').hidden = !rk;
  G.kb = kbFor(items);
  syncKb();
  $('.gauge').classList.remove('warn');
  $('#statTime').classList.remove('warn');
  go('play');
  stop();
  countdown(3, run);
}

/* 데스크톱은 3배로만 돈다. 손가락 화면은 세로로 좁아 1배면 도트가 몇 px 로 뭉개져
   무엇이 차는지 안 보인다 — 도트 한 알이 화면에서 PHONE_DOT px 가 되게 1~3배 사이에서
   고른다(.5 단위). 카메라는 데스크톱처럼 aim() 이 목표를 따라간다 */
const PHONE_DOT = 14;
/* 테두리·라벨은 --z 로 역보정해 화면상 크기를 지키는데, 폰은 지도 자체가 크게
   줄어 있어 그것만으로는 테두리가 1px 아래로 사라진다. 줄어든 몫(1/fit)을 --k 로 더 준다 */
function fitPlayK() {
  if (!fingers() || !G || !G.view) return;
  const r = $('#map').getBoundingClientRect(), fit = Math.min(r.width / G.view[0], r.height / G.view[1]);
  if (fit > 0) $('#map').style.setProperty('--k', (1 / fit).toFixed(3));
}
function playZoom(geom) {
  if (!fingers()) return 3;
  const r = $('#map').getBoundingClientRect();
  const fit = Math.min(r.width / geom.w, r.height / geom.h);
  if (!(fit > 0)) return 1;
  return Math.min(3, Math.max(1, Math.ceil(PHONE_DOT / (fit * geom.cell) * 2) / 2));
}

/* 도트 지도 — 격자 한 칸이 원 하나. */
function drawDots(svg, geom, items) {
  const cells = geom.items.map(() => []);
  geom.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') cells[SYM.indexOf(ch)].push([x, y]);
  }));
  const cw = geom.cell, dr = (cw * .46).toFixed(1);
  svg.style.setProperty('--tf', (cw * .86).toFixed(1) + 'px');   // 칸을 꽉 채우게

  svg.innerHTML = '<g class="cam">' + geom.items.map((g, i) =>
    `<g id="p${i}">` + cells[i].map(([x, y], n) =>
      // --i 는 도트가 차오르는 순서. 한 구가 다 차는 데 최대 0.28초
      `<circle cx="${((x + .5) * cw).toFixed(1)}" cy="${((y + .5) * cw).toFixed(1)}"` +
      ` r="${dr}" style="--i:${Math.min(n, 40)}"/>`).join('') + '</g>').join('') +
    // 이름의 y 는 격자 줄 한가운데로 맞춘다. 줄 사이에 걸치면 위아래 도트를
    // 반씩 건드려 지저분해진다
    '<g class="tiles">' + geom.items.map((g, i) =>
      `<g id="tl${i}" class="tile"><text id="t${i}" x="${g.c[0]}"` +
      ` y="${((Math.round(g.c[1] / cw - .5) + .5) * cw).toFixed(1)}"></text></g>`
    ).join('') + '</g>' +
    '</g>';

  link(svg, geom, items, cells);
  // 글자 상자는 화면에 올라온 뒤에야 잴 수 있다. display:none 이면 0 이 나온다
  requestAnimationFrame(() => coverDots(svg, items, cw));
}

/* 이름을 격자에 앉힌다. 자리는 자기 구역이 실제로 깔린 줄 중에서 고르되,
   이미 다른 이름이 차지한 칸은 피한다 — 붙어 있는 화곡1·2·8동처럼 무게중심이
   몰린 구역들이 같은 줄에 겹쳐 찍히던 문제를 여기서 끊는다. */
function placeLabels(items, cw) {
  const taken = [];
  // 글자끼리 한 칸은 띄운다. 딱 붙으면 두 이름이 한 단어처럼 읽힌다
  const free = (row, a, b) => !taken.some(t => t.row === row && a - 1 < t.b && t.a < b + 1);
  const base = cw * .86;   // --tf 와 같은 값. 줄여 앉힐 때 여기서 깎는다

  // 고를 자리가 적은 구역부터 앉힌다. 넓은 구역은 나중에도 갈 데가 많다
  const order = items.filter(i => i.label && i.cells && i.cells.length)
                     .sort((x, y) => x.cells.length - y.cells.length);

  for (const it of order) {
    const home = Math.round(it.at[1] / cw - .5);
    // 자기 구역이 깔린 줄만 후보다. 남의 땅에 이름을 얹으면 더 헷갈린다
    const rows = new Map();
    for (const [x, y] of it.cells) {
      const r = rows.get(y);
      if (r) { r[0] = Math.min(r[0], x); r[1] = Math.max(r[1], x + 1) }
      else rows.set(y, [x, x + 1]);
    }
    const near = [...rows].sort((p, q) => Math.abs(p[0] - home) - Math.abs(q[0] - home));

    /* 제자리에 빈 줄이 없으면 글자를 줄여 다시 본다. 좁은 구가 스무 개씩 붙어 있는
       송파·강남에서는 원래 크기로는 모두를 앉힐 자리가 안 나온다. */
    let pick = null;
    for (const k of [1, .82, .68]) {
      it.label.style.fontSize = (base * k).toFixed(1) + 'px';
      const span = Math.max(1, Math.ceil(it.label.getBBox().width / cw));
      const spots = near.map(([row, [lo, hi]]) =>
        ({ row, start: Math.round((lo + hi) / 2 - span / 2), span }));
      const fit = spots.find(s => free(s.row, s.start, s.start + span));
      if (fit) { pick = fit; break }
      pick = spots[0];   // 못 앉으면 가장 작게 줄인 마지막 시도를 쓴다
    }

    it.label.setAttribute('x', ((pick.start + pick.span / 2) * cw).toFixed(1));
    it.label.setAttribute('y', ((pick.row + .5) * cw).toFixed(1));
    it.box = pick;
    taken.push({ row: pick.row, a: pick.start, b: pick.start + pick.span });
  }
}

/* 이름이 앉은 자리의 도트를 찾아 둔다 — 글자 밑은 지우고, 이웃한 도트는 줄인다. */
function coverDots(svg, items, cw) {
  placeLabels(items, cw);

  const dots = [...svg.querySelectorAll('.cam > g[id^="p"] circle')].map(c => ({
    el: c,
    col: Math.round(+c.getAttribute('cx') / cw - .5),
    row: Math.round(+c.getAttribute('cy') / cw - .5)
  }));

  for (const it of items) {
    if (!it.box) continue;
    const { row, start, span } = it.box;
    const inside = (c, r) => r === row && c >= start && c < start + span;
    const touch = (c, r) => r >= row - 1 && r <= row + 1 &&
                            c >= start - 1 && c < start + span + 1;
    it.under = dots.filter(d => inside(d.col, d.row)).map(d => d.el);
    it.shrink = dots.filter(d => !inside(d.col, d.row) && touch(d.col, d.row)).map(d => d.el);
  }
}

function link(svg, geom, items, cells) {
  geom.items.forEach((g, i) => {
    const it = items.find(x => x.name === g.name);
    if (!it) return;
    it.cells = cells && cells[i];
    it.el = svg.querySelector('#p' + i);
    it.tile = svg.querySelector('#tl' + i);
    // 이름표는 타일 안에 있다. 타일을 안 그리는 미리보기에서는 없다
    it.label = svg.querySelector('#t' + i);
    if (it.label) it.label.textContent = adminLabel(g.name);
    it.at = g.c;
  });
}

/* 지도 아래 정보 줄. 윗줄과 아랫줄을 따로 갱신한다 —
   '보임'에서는 윗줄이 지금 칠 곳, 아랫줄이 직전에 맞힌 곳의 설명이 된다. */
function say(head, body) {
  const f = $('#fact');
  if (!f.firstElementChild) f.innerHTML = '<span></span>';
  if (body !== undefined) f.querySelector('span').textContent = body;
  if (head !== undefined) setTarget(head);
  f.classList.add('on');
}

function fillSide(el, it, hideName) {
  if (!el) return;
  if (!it || hideName) { el.replaceChildren(); return; }
  el.innerHTML = `<span class="q-name">${promptName(it)}</span>`;
}

function paintQueue() {
  if (!G) return;
  const t = target();
  const i = t ? G.items.indexOf(t) : -1;
  fillSide($('#qPrev'), i > 0 ? G.items[i - 1] : null, false);
  fillSide($('#qNext'), i >= 0 ? G.items[i + 1] : null, !opt.hint);
}

/* 칠 이름을 글자 하나씩 늘어놓는다. 이 자체가 입력창이다 —
   맞게 친 글자만 색이 차오른다. */
function setTarget(name) {
  const box = $('#qLetters') || $('#typing');
  box.replaceChildren();
  box.style.setProperty('--n', [...name].length);   // 손가락 화면에서 긴 이름을 폭에 맞춰 줄인다
  G.want = name;
  for (const ch of name) {
    const el = document.createElement('b');
    el.textContent = ch;
    box.append(el);
  }
  $('#typing').classList.remove('bad');
  $('#typing').classList.toggle('hide', !opt.hint);
  paintTyped('');
}

/* 지금까지 친 것을 그대로 보여준다.
   맞은 글자는 색이 차고, 지금 치는 자리에는 조합 중인 자모(ㄱ, 가)가
   그대로 뜬다. 조합 중인지 아닌지는 input 이벤트가 알려준다 —
   자모 표를 들고 맞춰볼 필요가 없다. */
function paintTyped(raw, composing = false) {
  const box = $('#qLetters') || $('#typing');
  if (!G.want) return;
  const buf = (G.spacy ? raw.replace(/^\s+/, '') : raw.replace(/\s/g, ''));
  // 앞에 붙은 찌꺼기를 흘려보낸다. 스페이스로 확정할 때 IME 가 조합을 끝내며
  // 비운 입력창에 글자를 도로 넣는 일이 있어, 앞에서부터만 비교하면 그 뒤로
  // 영영 색이 안 찬다. 정답 판정이 접미를 훑는 것과 같은 방식이다.
  let n = 0, rest = buf;
  for (let i = 0; i < buf.length; i++) {
    const sub = buf.slice(i);
    let k = 0;
    while (k < sub.length && k < G.want.length && sub[k] === G.want[k]) k++;
    if (k > n || i === 0) { n = k; rest = sub.slice(k); }
    if (n === G.want.length) break;
  }
  /* 목표를 다 맞힌 뒤에 남은 것은 IME 가 되돌려 넣은 찌꺼기다. 스페이스로 확정할
     때 조합을 끝내며 비운 입력창에 글자를 도로 넣는 일이 있다 — 그걸 칸을 늘려
     보여 주면 같은 음절이 두 번 찍힌 것처럼 된다. 다 맞혔으면 거기서 끝이다. */
  if (n >= G.want.length) rest = '';

  /* 폰 한글 키보드는 isComposing 을 안 주는 일이 많다. 그걸 믿으면 '강ㅅ' 처럼 음절을
     만드는 중간마다 오타로 읽혀 칸이 음절마다 흔들린다. 두벌식으로 풀어 남은 목표의
     앞머리면 오타가 아니라 치는 중이다 */
  const soft = !!rest && jamo(G.want.slice(n)).startsWith(jamo(rest));
  const ing = soft || (composing && rest.length > 0);   // 마지막 한 글자는 아직 만들어지는 중
  // 그 앞의 것들은 이미 굳은 오타다
  const bad = !soft && rest.length - (ing ? 1 : 0) > 0;

  /* 칸은 목표 글자 수에 맞춰 만들어져 있다. 오타로 길어지면 그릴 자리가 없어
     화면이 첫 오타 글자에서 굳고 — 아무리 더 쳐도 안 바뀐다 — 버퍼에 몇 자가
     쌓였는지 보이지 않아 몇 번을 지워야 할지도 알 수 없다. 넘치면 칸을 늘린다.
     한글 IME 는 스페이스 전까지 조합을 끝내지 않아 isComposing 이 계속 참이므로,
     조합 중이라고 손을 놓으면 그 사이 내내 굳어 있게 된다. */
  const need = Math.max(G.want.length, n + rest.length);
  while (box.children.length < need) box.append(document.createElement('b'));
  while (box.children.length > need) box.lastChild.remove();

  [...box.children].forEach((el, i) => {
    const typed = i >= n ? rest[i - n] : null;   // 이 자리에 실제로 친 글자
    const last = i === n + rest.length - 1;      // 방금 친 자리
    el.classList.toggle('on', i < n);
    el.classList.toggle('ing', !!typed);
    el.classList.toggle('over', i >= G.want.length);   // 목표보다 길어진 자리
    el.textContent = typed || G.want[i] || '';
    // 커서는 방금 친 것 바로 뒤에 선다
    el.classList.toggle('cur-l', i === n && !typed);
    // 다 맞게 쳤으면 마지막 글자 뒤에 선다 — 칸이 없어 cur-l 이 설 자리가 없다
    el.classList.toggle('cur-r', (!!typed && last) || (!rest.length && n >= need && i === need - 1));
  });
  $('#typing').classList.toggle('bad', bad);
}


/* 순서형에서 지금 쳐야 할 항목. 자유형이면 목표가 없다. */
const target = () => G.seq ? G.items[G.idx] : null;

/* 안내에 띄울 이름. 행정명을 한 자로 줄여 붙인다 — 서울시, 제주도.
   경기도·강남구처럼 이미 짧으면 정식 명칭 그대로다. */
const promptName = it => adminLabel(it.name);

/* 칠 수 있는 가장 긴 이름의 길이. 안내에 '서울시'가 떠 있어도
   '서울특별시'까지 쳐져야 하므로 별칭 길이도 같이 잰다. */
const typeCap = it => it
  ? Math.max(it.name.length, ...(it.aliases || []).map(a => a.length))
  : 0;

/* 지도 밖 빈 공간이 보이지 않게 가둔다. z=1 이면 범위가 0 하나뿐이다 */
function clampCam(tx, ty, W, H, z) {
  return [
    Math.min(0, Math.max(W * (1 - z), tx)),
    Math.min(0, Math.max(H * (1 - z), ty)),
  ];
}
/* 폰은 지도가 화면 끝까지 깔리고 머리줄·아래 시트가 그 위에 뜬다. 가려지지 않는 칸
   (머리줄 밑 ~ 시트 위)을 지도 좌표로 돌려준다 — 목표는 이 칸 한가운데에 서고, 지도는
   이 칸을 빈틈없이 덮는 데까지만 끌린다. 결과 화면이면 뒤로 단추 밑 ~ 결과 시트 위다.
   시트는 offsetTop·offsetHeight 로 잰다 — 올라오는 중(transform)에도 앉을 자리는 같다 */
function viewSpan() {
  if (!fingers()) return null;
  const res = $('#result').classList.contains('on');
  const head = (res ? $('#result .back') : $('#play .hud')).getBoundingClientRect();
  const sheet = res ? $('#result .res-sheet') : $('#play .play-sheet');
  const low = res ? innerHeight - sheet.offsetHeight : $('#play').getBoundingClientRect().top + sheet.offsetTop;
  const a = viewPoint({ clientX: 0, clientY: head.bottom + 8 }), b = viewPoint({ clientX: innerWidth, clientY: low - 8 });
  return a && b && b.y > a.y ? [a, b] : null;
}
/* 길이 len 인 지도가 [a0, a1] 칸을 덮게 t 를 가둔다. 칸보다 작으면 칸 한가운데에 둔다.
   over 는 지도 끝 너머로 비워도 되는 몫(칸 길이의 비율) — 지도 앱처럼 끝을 조금 넘겨 민다.
   .5 면 지도 맨 끝 점도 칸 한가운데에 선다 */
const fitSpan = (t, a0, a1, len, over = 0) => {
  const s = (a1 - a0) * over;
  return len >= a1 - a0 ? Math.min(a0 + s, Math.max(a1 - len - s, t)) : (a0 + a1 - len) / 2;
};
/* 폰에서 손으로 밀 때는 칸의 1/3 은 지도가 덮고 있게(over 2/3), 목표 조준은 .5 */
function look(tx, ty, over = 2 / 3) {
  if (!G || !G.cam) return;
  const [W, H] = G.view, z = G.z || G.zoom, v = viewSpan();
  if (v) { tx = fitSpan(tx, v[0].x, v[1].x, W * z, over); ty = fitSpan(ty, v[0].y, v[1].y, H * z, over); }
  else [tx, ty] = clampCam(tx, ty, W, H, z);
  G.tx = tx; G.ty = ty;
  G.cam.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${z})`);
  /* 목표에서 끌려 나가면 '목표로' 단추가 선다(폰 오른쪽 줄) */
  const a = G.aimed, away = !a || z !== a[2] || Math.hypot(tx - a[0], ty - a[1]) > W * .02;
  $('#playAim').hidden = !away || !target() || !$('#play').classList.contains('on');
}
/* 카메라를 지금 목표로 — 폰은 가려지지 않는 칸의 한가운데로 */
function aimCam() {
  const t = target(), [W, H] = G.view, z = G.z || G.zoom, v = viewSpan();
  const [cx, cy] = v ? [(v[0].x + v[1].x) / 2, (v[0].y + v[1].y) / 2] : [W / 2, H / 2];
  G.aimed = null;
  look(t ? cx - z * t.at[0] : 0, t ? cy - z * t.at[1] : 0, .5);
  G.aimed = [G.tx, G.ty, z];
  $('#playAim').hidden = true;
  followGrid(600);
}

/* 현재 목표를 표시하고 카메라를 그리로 옮긴다.
   3·7배율에서는 전체가 안 보이므로 화면이 목표를 따라가야 한다. */
function aim() {
  const t = target();
  G.items.forEach(i => i.el.classList.toggle('target', i === t));
  // 이름과 설명은 언제나 같은 곳을 가리켜야 한다. 치는 동안 그곳을 읽게 된다
  if (t) say(promptName(t), t.meta.description);
  paintQueue();
  $('#fact').classList.toggle('aim', !!t);
  G.items.forEach(i => {
    if (!i.label) return;
    const show = i.claimed || (opt.hint && (!G.seq || i === t));
    i.label.classList.toggle('on', show);
  });
  aimCam();
}
/* 폰 결과 — 끝난 지도를 결과 시트 위 빈 칸에 통째로 앉힌다 */
function fitResult() {
  const v = viewSpan();
  if (!v || !G || !G.cam) return;
  const [W, H] = G.view;
  G.z = Math.min((v[1].x - v[0].x) / W, (v[1].y - v[0].y) / H) * .94;
  $('#map').style.setProperty('--z', G.z);
  look(0, 0);
}
/* 목표로 — 누르는 동안 입력창의 초점(화상 키보드)을 뺏지 않는다 */
$('#playAim').addEventListener('pointerdown', e => e.preventDefault());
$('#playAim').addEventListener('click', () => { if (G && G.cam) aimCam(); });

function countdown(n, done) {
  const el = $('#countdown'); el.classList.add('on');
  const step = () => {
    el.replaceChildren();
    if (n > 0) { const b = document.createElement('b'); b.textContent = n; el.append(b); }
    if (n-- <= 0) { el.classList.remove('on'); return done(); }
    beep(440 + n * 110, .09, 'triangle');
    pending = setTimeout(step, 700);
  };
  step();
}

function run() {
  $('#typein').value = '';   // 카운트다운 동안 미리 친 글자는 세지 않는다
  typeFocus();
  /* 폰: 첫 조준은 머리줄이 내려오는 중에 재서 칸이 어긋난다 — 다 앉은 뒤 다시 맞춘다 */
  if (fingers() && G.cam && $('#playAim').hidden) aimCam();
  tick = setInterval(() => {
    G.left--;
    $('#gaugeFill').style.width = (G.left / G.total * 100) + '%';
    $('#statSpeed').textContent = speedIn(cpmNow());
    $('#statTime').firstElementChild.textContent = clock(G.left);
    $('.gauge').classList.toggle('warn', G.left <= 10);
    $('#statTime').classList.toggle('warn', G.left <= 10);
    if (G.left <= 0) finish();
  }, 1000);
}
function stop() { clearInterval(tick); clearTimeout(pending); tick = pending = null; }

/* 스페이스로 확정한다.
   keydown 으로 스페이스를 가로채면 한글 조합 확정 자체가 깨지므로
   (조합 중 스페이스는 isComposing:true 로 먼저 온다) 가로채지 않고
   입력값에 들어온 공백을 보고 판단한다. */
/* 입력창은 1x1 로 숨겨 두었다. 다른 데를 클릭하면 포커스가 빠져나가
   타이핑이 먹지 않으므로, 플레이 화면을 누르면 되돌린다.
   pointerdown 에서 기본 동작을 막아야 포커스가 딴 데로 가지 않는다.
   그 자리에서 끌면 3배 카메라를 옮긴다 — 맞히면 aim() 이 다음 목표로 되돌린다.
   폰은 끌지 않는다 — 자판을 치다 스친 엄지에 지도가 밀린다. 핀치 확대는 둔다 */
function viewPoint(e) {
  const svg = $('#map'), ctm = svg && svg.getScreenCTM();
  if (!ctm) return null;
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(ctm.inverse());
}
$('#play').addEventListener('pointerdown', e => {
  if (e.target.closest('button, a, input, select, textarea')) return;
  e.preventDefault();
  typeFocus();
  if (!G || !G.cam || e.button || fingersOn.size > 1 || fingers()) return;
  const p = viewPoint(e);
  if (!p) return;
  const map = $('#map');
  drag = { kind: 'play', id: e.pointerId, x: p.x, y: p.y, tx: G.tx, ty: G.ty, touch: e.pointerType !== 'mouse',
           cx: e.clientX, cy: e.clientY, slop: slopOf(e), moved: false, host: map };
  map.setPointerCapture(e.pointerId);
});

/* 폰은 pointerdown 의 focus 로는 화상 키보드가 안 뜨는 브라우저가 있다(iOS) —
   click 에서 한 번 더 부른다. 이미 포커스가 있으면 아무 일도 없다 */
$('#play').addEventListener('click', e => {
  if (!e.target.closest('button, a, input, select, textarea')) typeFocus();
});
/* 게임 자판이 서 있으면 입력창에 초점을 주지 않는다 — 초점이 있으면 iOS 가 ∧∨✓ 막대를
   붙이고 주소창 알약을 띄운다. 자판은 초점 없이 입력창 값을 고친다(kbPress) */
const kbOwns = () => !KB.el.hidden;
function typeFocus() { if (kbOwns()) $('#typein').blur(); else $('#typein').focus(); }
/* 게임 자판 중에 블루투스 키보드를 치면 그제야 초점을 준다 — 첫 키는 흘릴 수 있다 */
document.addEventListener('keydown', e => {
  if (kbOwns() && G && tick && e.target === document.body && e.key.length === 1) $('#typein').focus();
});

/* 지금 칠 수 있는 상태인지 눈에 보이게 한다 */
const markFocus = () => $('#typing').classList.toggle('off', document.activeElement !== $('#typein') && !kbOwns());
$('#typein').addEventListener('focus', markFocus);
$('#typein').addEventListener('blur', markFocus);

/* 폰 Safari 탭은 문서를 위아래로 --bleed 만큼 늘려 두고(style.css), 늘 그 가운데에 묶는다 —
   화면 밖 위아래에 문서가 있어야 Safari 가 상태바·주소창 밑에 페이지를 그린다 */
const bleedOn = matchMedia('(pointer:coarse) and (display-mode:browser)');
const pinDoc = () => {
  const b = bleedOn.matches ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bleed')) || 0 : 0;
  if (Math.abs(scrollY - b) > .5) scrollTo(0, b);
};
pinDoc();
for (const e of ['load', 'scroll', 'resize']) addEventListener(e, pinDoc, { passive: true });
/* 위 흐림(style.css 의 .top-blur) — 지도를 세기가 다른 흐린 복사본 여섯 장으로 따라 그린다. 상태바 칸에
   backdrop-filter 를 못 쓰니 복사본을 흐린다. 속성만 바뀌면 짝 노드에 그 속성만 옮긴다(트랜지션도 같이
   돈다). 노드가 바뀌면 통째로 다시 뜬다. 복사본도 id 를 그대로 쓴다 — CSS 가 #courseBtns·#map 으로
   그린다. 원본이 앞에 있어 $() 는 원본을 잡는다. wrap 은 복사본을 원본 자리에 놓는 껍데기 */
function blurTwins(src, box, wrap = c => c) {
  const twins = new WeakMap();
  let queued = false;
  const copyAll = () => {
    queued = false;
    const a = [src, ...src.querySelectorAll('*')];
    a.forEach(n => twins.set(n, []));
    box.replaceChildren(...Array.from({ length: 6 }, () => {
      const copy = src.cloneNode(true), b = [copy, ...copy.querySelectorAll('*')], layer = document.createElement('div');
      a.forEach((n, i) => twins.get(n).push(b[i]));
      layer.append(wrap(copy));
      return layer;
    }));
  };
  new MutationObserver(ms => {
    for (const m of ms) {
      const ts = m.type === 'attributes' && twins.get(m.target);
      if (!ts) { if (!queued) { queued = true; requestAnimationFrame(copyAll); } continue; }
      const v = m.target.getAttribute(m.attributeName);
      for (const t of ts) v === null ? t.removeAttribute(m.attributeName) : t.setAttribute(m.attributeName, v);
    }
  }).observe(src, { attributes: true, childList: true, subtree: true, characterData: true });
  copyAll();
}
if (bleedOn.matches) {
  blurTwins($('#courseBtns'), $('#topBlur'));
  /* 게임 지도는 머리줄 밑 .stage 에 있다 — 그 자리·크기를 재어 복사본 껍데기(.tb-at)에 준다 */
  const map = $('#map'), box = $('#playTopBlur');
  new ResizeObserver(() => {
    const r = map.getBoundingClientRect(), p = $('#play').getBoundingClientRect();
    for (const [k, v] of [['--mx', r.left - p.left], ['--my', r.top - p.top], ['--mw', r.width], ['--mh', r.height]])
      box.style.setProperty(k, v + 'px');
  }).observe(map);
  blurTwins(map, box, c => { const w = document.createElement('div'); w.className = 'tb-at'; w.append(c); return w; });
}

/* 화상 키보드가 뜨면 플레이 화면을 보이는 만큼으로 줄인다(style.css 의 --vvh·--vvt,
   손가락 화면에서만 읽는다). 안드로이드는 viewport 메타의 interactive-widget 이 이미
   레이아웃을 줄이고, iOS 는 그걸 몰라 visualViewport 로 잰다 */
if (window.visualViewport) {
  const vv = visualViewport, st = document.documentElement.style;
  /* 키보드가 떠 있으면 시트 밑에 홈 인디케이터 몫(--sab)을 두지 않는다. 판을 치는 중
     목표에서 끌려 나가 있지 않으면 줄어든 칸에 맞춰 목표를 다시 가운데 둔다 */
  /* 가린 게 없으면 셋 다 지운다 — 그때 #play 는 Safari 아래 막대 밑(화면 맨 아래)까지
     깔리고 시트가 막대 몫(--under)만큼 속을 띄운다. 막대 위에서 끊으면 그 밑이 검은 띠다 */
  const fitVV = () => {
    /* 가린 높이가 100px 을 넘어야 키보드다 — iOS 26 Safari 는 키보드 없이도 아래 주소창 몫(48px 안팎)을
       보이는 칸에서 뺀다. 그걸 키보드로 보면 시트가 그만큼 떠서 주소창과 벌어진다(아이폰에서 잼) */
    const covered = innerHeight - vv.height > 100 || vv.offsetTop > 0;
    document.documentElement.toggleAttribute('data-vv', covered);
    if (covered) {
      st.setProperty('--vvh', vv.height + 'px'); st.setProperty('--vvt', vv.offsetTop + 'px'); st.setProperty('--sab', '0px');
      /* 보이는 칸 밑 ~ 레이아웃 바닥(키보드·주소 알약 뒤). #play 는 거기까지 깔고 시트만 그 위에 앉힌다 —
         보이는 칸에서 끊으면 iOS 주소 알약 둘레가 지도 없이 빈다(카운트다운은 inset:0 이라 거기까지 깔린다) */
      st.setProperty('--kb', Math.max(0, innerHeight - vv.height - vv.offsetTop) + 'px');
    } else for (const k of ['--vvh', '--vvt', '--sab', '--kb']) st.removeProperty(k);
    requestAnimationFrame(() => {
      fitPlayK();
      if (fingers() && G && G.cam && $('#play').classList.contains('on') && $('#playAim').hidden) aimCam();
    });
  };
  vv.addEventListener('resize', fitVV);
  vv.addEventListener('scroll', fitVV);
}

/* 브라우저 막대 색(theme-color)은 사이트 야간을 따른다. data-night 를 누가 바꾸든 여기 한 곳 */
const tintBar = () => { $('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); };
new MutationObserver(tintBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-night'] });
tintBar();

function judge(raw) {
  const answer = G.spacy ? raw.trim() : raw.replace(/\s+/g, '');
  if (!answer) return;
  const hit = matchInput(answer, G.items, G.spacy);
  G.part = 0; G.typed = 0;
  if (!hit || (G.seq && hit !== target())) { G.bad++; return miss(); }   // 확정 키도 한 타
  G.ok++;
  G.chars += keysOf(answer) + 1;   // 친 그대로(약칭이면 약칭) + 확정 키
  claim(hit);
}

$('#typein').addEventListener('input', e => {
  if (!G || !tick) return;
  const inp = e.target;
  let val = inp.value, composing = e.isComposing;
  if (!G.t0 && val) G.t0 = performance.now();   // 속도 시계는 첫 키에서 선다 — cpmNow 참고
  /* 제시된 글자 수를 넘겨서는 아예 안 써진다. 넘겨 친 찌꺼기가 남으면 같은
     지명이라도 지워야 할 백스페이스 수가 달라진다. 자모는 한 칸 안에서 합쳐지므로
     길이는 다음 음절을 시작할 때만 늘어난다 — 그 한 음절만 잘라 낸다.
     확정하는 스페이스는 잘라 내지 않는다.
     ponytail: 조합 중에 value 만 고치면 IME 가 제 버퍼를 도로 밀어 넣어 안 잘린다.
     포커스를 한 번 끊어야 조합이 진짜로 끝난다. IME 를 취소하는 표준 방법이 생기면
     blur/focus 는 지운다. */
  const cap = G.seq ? typeCap(target()) : 0;
  if (cap && !(G.spacy && /\s/.test(G.want || '')) && !/\s/.test(val) && val.length > cap) {
    val = val.slice(0, cap);
    composing = false;
    const had = document.activeElement === inp;   // 게임 자판이면 초점이 없다 — 도로 주지 않는다
    inp.blur();
    inp.value = val;
    if (had) inp.focus();
  }
  paintTyped(val, composing);
  G.part = partKeys(val, G.seq ? [target()] : G.items.filter(it => !it.claimed), G.spacy);
  /* 정확도도 키 단위다(Monkeytype getAccuracy) — 새로 들어온 키가 맞는 앞부분을 이으면
     맞은 키, 아니면 틀린 키. 지운 키는 어느 쪽에도 안 들어간다 */
  const len = typedForm(val, G.spacy).length;
  if (len > G.typed) G[G.part || !len ? 'ok' : 'bad'] += len - G.typed;
  G.typed = len;
  $('#statSpeed').textContent = speedIn(cpmNow());
  if (G.spacy) return;                            // 공백이 이름에 있으면 Enter 로 확정
  if (!/\s/.test(val)) return;                   // 스페이스 전에는 판단하지 않는다
  inp.value = '';
  judge(val);
});
$('#typein').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing || !G || !tick) return;
  e.preventDefault();
  const val = e.target.value;
  e.target.value = '';
  judge(val);
});

/* ── 폰 게임 자판 ─────────────────────────────────────
   폰은 기기 키보드 대신 이 자판으로 친다(opt.softkb). 누른 키는 입력창 값을 hanPush/hanBack
   으로 고치고 input 이벤트를 쏜다 — 판정·색칠·속도·글자 수 자르기는 기기 키보드와 같은
   길을 탄다. 입력창은 초점을 쥔 채 inputmode="none" 으로 기기 키보드만 막는다(블루투스
   키보드는 그대로 친다). 코스를 이 자판으로 다 칠 수 없으면 기기 키보드로 돌아간다 */
const KB_ROWS = { ko: ['ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ', 'ㅁㄴㅇㄹㅎㅗㅓㅏㅣ', 'ㅋㅌㅊㅍㅠㅜㅡ'],
                  en: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] };
const KB_SHIFT = { ㅂ: 'ㅃ', ㅈ: 'ㅉ', ㄷ: 'ㄸ', ㄱ: 'ㄲ', ㅅ: 'ㅆ', ㅐ: 'ㅒ', ㅔ: 'ㅖ' };
/* 화면 읽기 프로그램이 자모를 이름으로 읽게 */
const KB_NAME = { ㄱ: '기역', ㄲ: '쌍기역', ㄴ: '니은', ㄷ: '디귿', ㄸ: '쌍디귿', ㄹ: '리을', ㅁ: '미음',
  ㅂ: '비읍', ㅃ: '쌍비읍', ㅅ: '시옷', ㅆ: '쌍시옷', ㅇ: '이응', ㅈ: '지읒', ㅉ: '쌍지읒', ㅊ: '치읓',
  ㅋ: '키읔', ㅌ: '티읕', ㅍ: '피읖', ㅎ: '히읗', ㅏ: '아', ㅐ: '애', ㅑ: '야', ㅒ: '얘', ㅓ: '어',
  ㅔ: '에', ㅕ: '여', ㅖ: '예', ㅗ: '오', ㅛ: '요', ㅜ: '우', ㅠ: '유', ㅡ: '으', ㅣ: '이' };
const KB_SYM = /^[0-9,.'\-]$/;   // 숫자·문장부호는 코스에 있는 것만 한 줄 더 선다(종로1,2,3,4가동)
const KB = { el: $('#softkb'), sig: '', shift: false, down: new Map() };
const KB_SWIPE = 40;   // 자판 위를 이만큼(px) 왼쪽으로 쓸고 떼면 한 자 지운다
const KB_FLICK = 18;   // 이만큼(px) 위로 밀고 떼면 윗글자(ㄲ·ㅒ·대문자)를 친다

/* 이 코스를 칠 자판 — { lay: 'ko'|'en', sym: '12,' } 또는 null(기기 키보드). 항목마다 이름이나
   별칭 하나는 자판 글자·공백·코스의 숫자/문장부호로만 되어 있어야 한다(Québec 은 못 친다) */
function kbFor(items) {
  const forms = items.map(it => [it.name, ...it.aliases].map(n => String(n).normalize('NFC')));
  const lay = forms.flat().some(n => /[가-힣]/.test(n)) ? 'ko' : 'en';
  const letter = lay === 'ko' ? /^[가-힣]$/ : /^[a-z]$/i;
  const ok = n => [...n].every(c => letter.test(c) || c === ' ' || KB_SYM.test(c));
  if (!forms.every(f => f.some(ok))) return null;
  const sym = [...new Set(forms.flat().filter(ok).join(''))].filter(c => KB_SYM.test(c))
    .sort((a, b) => /\d/.test(b) - /\d/.test(a) || a.localeCompare(b)).join('');   // 숫자 먼저, 부호는 뒤에
  return { lay, sym };
}
function kbBuild(kb) {
  const key = (k, s, name) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'kb-k'; b.dataset.k = k;
    if (s) b.dataset.s = s;
    if (name) b.dataset.name = name;
    return b;
  };
  const act = (a, label, text) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'kb-k kb-' + a; b.dataset.act = a;
    b.setAttribute('aria-label', t(label)); b.textContent = text;
    return b;
  };
  const row = (...keys) => { const r = document.createElement('div'); r.className = 'kb-row'; r.append(...keys); return r; };
  const letters = s => [...s].map(k => kb.lay === 'ko' ? key(k, KB_SHIFT[k], 1) : key(k, k.toUpperCase()));
  const [r1, r2, r3] = KB_ROWS[kb.lay];
  const shift = act('shift', 'kbShift', '⇧');
  shift.setAttribute('aria-pressed', 'false');
  KB.el.replaceChildren(...[
    kb.sym && row(...[...kb.sym].map(k => key(k))),
    row(...letters(r1)), row(...letters(r2)),
    row(shift, ...letters(r3), act('back', 'kbBack', '⌫')),
    row(act('space', 'kbSpace', t('kbSpace')), ...(G.spacy ? [act('enter', 'kbEnter', '⏎')] : [])),
  ].filter(Boolean));
  KB.shift = false;
  KB.el.querySelectorAll('.kb-row')[kb.sym ? 2 : 1].classList.add('kb-mid');
  KB.el.classList.toggle('is-sym', !!kb.sym);
  KB.el.classList.toggle('is-en', kb.lay === 'en');
  kbPaint();
}
/* 키 얼굴 — 윗글자는 모서리에 작게 서고, 위로 밀면 키 가운데로 올라온다. 켜진 Shift 면 윗글자가 선다 */
function kbFace(b, up) {
  const k = (up || KB.shift) && b.dataset.s || b.dataset.k;
  b.textContent = k;
  b.classList.toggle('up', up && !!b.dataset.s);
  if (b.dataset.name) b.setAttribute('aria-label', KB_NAME[k] || k);
}
/* 켜진 Shift 는 aria-pressed 와 바뀐 글자로 보인다(색만이 아니다) */
function kbPaint() {
  KB.el.querySelectorAll('[data-k]').forEach(b => kbFace(b, false));
  KB.el.classList.toggle('is-shift', KB.shift);
  const s = KB.el.querySelector('.kb-shift');
  if (s) s.setAttribute('aria-pressed', KB.shift);
  kbHint();
}
/* 다음에 칠 키 — 친 것을 두벌식으로 풀어 목표의 앞머리면 그 다음 자모, 아니면 지우기.
   다 쳤으면 확정(스페이스, 띄어 쓴 코스는 Enter). 경쟁전·설정에서 끄면 안 뜬다 */
function kbHint() {
  KB.el.querySelectorAll('.kb-next').forEach(b => b.classList.remove('kb-next', 'kb-flick'));
  if (KB.el.hidden || !opt.kbhint || !G || G.ranked || !G.want) return;
  /* 영어는 대소문자까지 짚는다 — 판정은 안 가려도 글자 칸 색칠(paintTyped)은 가린다 */
  const form = s => G.kb && G.kb.lay === 'en' ? (G.spacy ? s : s.replace(/\s/g, '')) : typedForm(s, G.spacy);
  const typed = form($('#typein').value.replace(/^\s+/, '')), want = form(G.want);
  const ch = !want.startsWith(typed) ? null : want[typed.length];
  const b = ch === undefined ? KB.el.querySelector(G.spacy ? '.kb-enter' : '.kb-space')
    : ch === null ? KB.el.querySelector('.kb-back')
    : ch === ' ' ? KB.el.querySelector('.kb-space')
    : [...KB.el.querySelectorAll('[data-k]')].find(x => x.dataset.k === ch || x.dataset.s === ch);
  if (!b) return;
  b.classList.add('kb-next');
  /* 쌍자음·ㅒ·ㅖ·대문자는 Shift 도 짚고 키에 위로 밀라는 화살표(kb-flick)도 세운다 — 색만이 아니다.
     켜진 Shift 를 꺼야 할 때도 Shift 를 짚는다 */
  const up = !!b.dataset.s && ch === b.dataset.s && ch !== b.dataset.k;
  b.classList.toggle('kb-flick', up && !KB.shift);
  if (b.dataset.s && up !== KB.shift) KB.el.querySelector('.kb-shift').classList.add('kb-next');
}
const kbMode = on => { if (on) $('#typein').inputMode = 'none'; else $('#typein').removeAttribute('inputmode'); };
/* 자판을 세우거나 거둔다 — 판을 시작할 때, 설정이 바뀔 때. 시트 높이가 바뀌므로 목표를 다시 겨눈다 */
function syncKb() {
  const inp = $('#typein'), on = fingers() && opt.softkb && !!G && !!G.kb;
  if (on) {
    const sig = G.kb.lay + G.kb.sym + G.spacy + LANG;
    if (sig !== KB.sig) { KB.sig = sig; kbBuild(G.kb); }
  }
  /* 기기 키보드로 돌아갈 때 초점을 놓는다 — 다음 누름의 focus 가 기기 키보드를 띄운다(iOS) */
  if (!on && inp.inputMode === 'none') { kbMode(false); inp.blur(); }
  else kbMode(on);
  if (on) inp.blur();
  KB.el.hidden = !on;
  markFocus();
  kbHint();
  if (G && G.cam && $('#play').classList.contains('on')) requestAnimationFrame(() => { fitPlayK(); if ($('#playAim').hidden) aimCam(); });
}
function kbPress(b, up) {
  const inp = $('#typein'), a = b.dataset.act;
  if (a === 'shift') { KB.shift = !KB.shift; return kbPaint(); }
  /* Enter 는 입력창의 keydown Enter 와 같은 길로 확정한다 */
  if (a === 'enter') { inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })); return kbHint(); }
  const k = a === 'space' ? ' ' : a === 'back' ? null : (up || KB.shift) && b.dataset.s || b.dataset.k;
  inp.value = k === null ? hanBack(inp.value) : hanPush(inp.value, k);
  inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: k === null ? 'deleteContentBackward' : 'insertText', data: k }));
  if (KB.shift && !a) { KB.shift = false; kbPaint(); }
}
/* 키 사이 틈·가운데 줄 들여쓰기·줄 사이를 짚어도 가장 가까운 키를 친다 — 빈 곳이 먹히면
   ㅁ·ㅣ 처럼 들여 선 줄 끝 키가 자주 안 쳐진다. 자판 밖이면 null */
function kbAt(x, y) {
  const at = document.elementFromPoint(x, y);
  if (!at || !KB.el.contains(at)) return null;
  const hit = at.closest('button');
  if (hit) return hit;
  let best = null, bd = Infinity;
  for (const b of KB.el.querySelectorAll('button')) {
    const r = b.getBoundingClientRect();
    const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
/* 누르면 바로 눌린 모양, 뗄 때 친다(가장 가까운 키가 누른 키일 때만). 윗글자가 있는 키는 위로 밀고 떼면
   윗글자를 친다(키를 벗어나도 된다). 어느 키에서든 왼쪽으로 쓸고 떼면 한 자 지운다.
   지우기는 길게 누르면 되풀이한다.
   pointerdown 을 막아 초점은 입력창에 남고, 두 엄지로 쳐도 지도 끌기·핀치가 되지 않는다 */
KB.el.addEventListener('pointerdown', e => {
  e.preventDefault(); e.stopPropagation();
  const b = kbAt(e.clientX, e.clientY);
  if (!b) return;
  b.classList.add('down');
  const d = { b, rep: 0, n: 0, x: e.clientX, y: e.clientY, up: false, left: false };
  if (b.dataset.act === 'back') d.rep = setTimeout(function again() { kbPress(b); d.n++; d.rep = setTimeout(again, 70); }, 450);
  KB.down.set(e.pointerId, d);
});
const kbUp = (e, commit) => {
  const d = KB.down.get(e.pointerId);
  if (!d) return;
  KB.down.delete(e.pointerId);
  clearTimeout(d.rep);
  d.b.classList.remove('down');
  if (d.up) kbFace(d.b, false);
  if (!commit || d.n) return;
  if (d.left) kbPress(KB.el.querySelector('.kb-back'));
  else if (d.up || kbAt(e.clientX, e.clientY) === d.b) kbPress(d.b, d.up);
};
KB.el.addEventListener('pointermove', e => {
  const d = KB.down.get(e.pointerId);
  if (!d || d.n) return;
  const dx = d.x - e.clientX, dy = d.y - e.clientY;
  const left = dx >= KB_SWIPE && dx > Math.abs(dy);
  if (left !== d.left) { d.left = left; d.b.classList.toggle('down', !left); }
  const up = !left && !!d.b.dataset.s && dy >= KB_FLICK;
  if (up !== d.up) { d.up = up; kbFace(d.b, up); }
});
KB.el.addEventListener('pointerup', e => kbUp(e, true));
KB.el.addEventListener('pointercancel', e => kbUp(e, false));
/* 키보드(Tab·Enter)로 누른 click 은 pointer 가 없다(detail 0) */
KB.el.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !e.detail) kbPress(b, e.shiftKey); });   // Shift+Enter 는 윗글자
KB.el.addEventListener('contextmenu', e => e.preventDefault());
$('#typein').addEventListener('input', kbHint);
$('#typein').addEventListener('keydown', () => setTimeout(kbHint));

function miss() {
  $('#typein').value = '';
  paintTyped('');
  G.tries++; G.combo = 0;
  $('#statCombo').textContent = '';
  const bar = $('.typebar');
  bar.classList.remove('bad'); void bar.offsetWidth; bar.classList.add('bad');
  setTimeout(() => bar.classList.remove('bad'), 240);
  beep(160, .12, 'square');
}

function claim(it) {
  it.claimed = true;
  it.el.classList.add('got');
  if (it.label) it.label.classList.add('on');
  if (it.tile) it.tile.classList.add('built');
  if (it.under) it.under.forEach(c => c.classList.add('under'));
  if (it.shrink) it.shrink.forEach(c => c.classList.add('near'));
  G.hits++; G.tries++; G.combo++;
  $('#statSpeed').textContent = speedIn(cpmNow());
  G.score += 100 * Math.min(5, G.combo);   // ponytail: 콤보 배율만. 인지도 역수(weight) 데이터 확보되면 항목별 배점으로 교체
  $('#statCount').textContent = G.hits;
  if (it.tile) { it.tile.classList.remove('pop'); void it.tile.getBBox(); it.tile.classList.add('pop'); }
  const cb = $('#statCombo');
  cb.textContent = G.combo > 1 ? '×' + Math.min(5, G.combo) : '';
  cb.classList.remove('bump'); void cb.offsetWidth; cb.classList.add('bump');
  setTimeout(() => cb.classList.remove('bump'), 160);
  // 순서형은 바로 뒤 aim() 이 다음 목표의 이름과 설명으로 갈아끼운다
  if (!G.seq) say(it.name, it.meta.description);
  beep(520 + G.combo * 40, .08, 'triangle');
  if (G.hits === G.items.length) return finish();
  if (G.seq) { while (G.items[G.idx] && G.items[G.idx].claimed) G.idx++; }
  aim();
}

/* 지금까지의 속도. Monkeytype 의 실시간 WPM 과 같은 셈이다(test-timer.ts timerStep):
     타수 = 확정한 지명의 타수 + 지금 치는 입력이 맞는 앞부분이면 그 타수(G.part)
     시간 = 첫 키를 누른 때(G.t0)부터 지금까지, 끝났으면 끝난 때(G.t1)까지 — ms 로 잰다
   틀린 입력은 타수에 안 들어가고(Monkeytype 의 raw 가 아닌 wpm), 손 놓고 있는 시간도
   빼 주지 않는다 — 두 사이트 모두 그렇다. 키를 칠 때마다, 그리고 1초마다 다시 센다.
   끝난 판에만 거는 천장 둘은 중계기(worker.mjs 의 entry)가 보는 것과 같은 값이다 —
   넘겨 보내면 그 판은 통째로 400 을 받아 순위표에 안 올라간다 */
/* 치고 있는 입력이 아직 확정 안 된 어느 이름(또는 별칭)의 앞부분이면 그 타수, 아니면 0.
   Monkeytype 이 칠 중인 낱말을 '맞게 친 데까지'만 쳐 주는 것(countChars 의
   creditPartial)과 같다. 견주는 모양은 matchInput 과 같게 — 대소문자·띄어쓰기를 접는다 */
const typedForm = (s, spacy) => jamo((spacy ? String(s) : String(s).replace(/\s/g, '')).toLowerCase());
function partKeys(raw, items, spacy = false) {
  const key = s => typedForm(s, spacy);
  const k = key(raw);
  if (!k) return 0;
  return items.some(it => [it.name, ...it.aliases].some(n => key(n).startsWith(k))) ? k.length : 0;
}
/* 맞게 친 키 ÷ 친 키. 아무것도 안 쳤으면 0 (Monkeytype 과 같다) */
const accNow = () => G.ok + G.bad ? Math.floor(G.ok / (G.ok + G.bad) * 100) : 0;
function cpmNow(done = false) {
  if (!G.t0) return 0;
  const ms = Math.max(1000, (G.t1 || performance.now()) - G.t0);
  const cpm = Math.min(1500, Math.round((G.chars + G.part) / ms * 60000));
  return done ? Math.min(G.hits * 50, cpm) : cpm;
}

function finish() {
  stop();
  G.t1 = performance.now();
  beep(300, .3, 'triangle');
  G.items.filter(i => !i.claimed).forEach(i => i.el.classList.add('miss'));
  pending = setTimeout(() => {
    G.cpm = cpmNow(true);
    G.acc = accNow();
    /* 옛 열쇠(rt.best.* 점수, rt.fast.* 음절 CPM)는 지금 타수와 견줄 수 없다 */
    const key = `rt.keys.${G.slug}.t${G.total}`;
    const prev = Number(localStorage.getItem(key) || 0);
    $('#rScore').textContent = speedIn(G.cpm);
    $('#rCount').textContent = G.hits;
    $('#rCount').dataset.of = G.items.length;
    $('#rAcc').textContent = G.acc + '%';
    $('#rBest').textContent = G.cpm > prev ? t('bestNew') : prev ? t('bestPrev', { n: showSpeed(prev) }) : '';
    if (G.cpm > prev) localStorage.setItem(key, G.cpm);

    drawCard();
    board();
    /* 전적·경쟁전 lp 는 ranked.js 가 올린다 */
    dispatchEvent(new CustomEvent('rt-finish', { detail: G }));
    /* 폰 결과는 지도를 뒤에 남긴다 — 입력창도 남으니 화상 키보드를 내린다 */
    $('#typein').blur();
    go('result');
    fitResult();
  }, 1200);
}

/* 결과 카드 — SVG를 그대로 이미지로 굽는다 (9:16, 스토리용).
   스토리는 위아래 UI 가 가리므로 글자는 위 250·아래 340 px 안쪽에 둔다 */
let cardReady = Promise.resolve(), cardShot = null, cardSeq = 0;
function drawCard() {
  let done;
  const seq = ++cardSeq;
  cardShot = null;
  cardReady = new Promise(r => done = r);
  const cv = $('#card'), ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, pad = 90;
  const css = getComputedStyle(document.body);
  const bg = css.backgroundColor, ink = css.color;

  const svg = $('#map').cloneNode(true);
  svg.querySelector('.cam').removeAttribute('transform');   // 카드에는 전체 지도를
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const acc = css.getPropertyValue('--accent'), land = css.getPropertyValue('--land');
  svg.insertAdjacentHTML('afterbegin', '<style>' +
    `circle{fill:${land}}g.got circle{fill:${acc}}g.miss circle{fill:${land}}` +
    'text{display:none}</style>');
  /* 긴 코스 이름이 폭을 넘으면 글씨를 줄인다 */
  const fit = (txt, weight, size, x, y) => {
    ctx.font = `${weight} ${size}px system-ui,sans-serif`;
    const w = ctx.measureText(txt).width;
    if (w > W - pad * 2) ctx.font = `${weight} ${Math.floor(size * (W - pad * 2) / w)}px system-ui,sans-serif`;
    ctx.fillText(txt, x, y);
  };
  /* .logo 와 같은 꼴 — region(굵게) + type(가늘게) + 점(accent). textAlign 이 center 라
     한 번에 못 그리니 폭을 재서 직접 가운데 맞춘다 */
  const wordmark = (x, y, size) => {
    const font = w => `${w} ${size}px system-ui,sans-serif`;
    ctx.font = font(800);
    const wRegion = ctx.measureText('region').width;
    ctx.font = font(400);
    const wType = ctx.measureText('type').width;
    const dotD = size * .22, gap = size * .06;
    let cx = x - (wRegion + wType + gap + dotD) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.font = font(800);
    ctx.fillText('region', cx, y);
    cx += wRegion;
    ctx.font = font(400);
    ctx.fillText('type', cx, y);
    cx += wType + gap;
    ctx.fillStyle = acc;
    ctx.beginPath();
    ctx.arc(cx + dotD / 2, y - size * .32, dotD / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'center';
  };
  const img = new Image();
  img.onload = () => {
    if (seq !== cardSeq) return done();                       // 더 새 판이 이미 그리는 중 — 옛 그림을 덧칠하지 않는다
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);             // 바탕은 그릴 때마다 여기서 새로 깐다
    const vb = $('#map').getAttribute('viewBox').split(' ').map(Number);
    const top = 480, bottom = 1150;                           // 지도 칸 — 위는 머릿글, 아래는 점수·CTA 몫
    let w = W - pad * 2, h = w * vb[3] / vb[2];
    if (h > bottom - top) { h = bottom - top; w = h * vb[2] / vb[3]; }
    ctx.drawImage(img, (W - w) / 2, top + (bottom - top - h) / 2, w, h);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    wordmark(W / 2, 320, 64);
    /* '내 동네' 로 들어와야 할 머릿글은 코스 이름이다 — regiontype 이 아니라 */
    ctx.fillStyle = ink;
    fit(courseLabel(G.course), 800, 76, W / 2, 430);
    fit(`${G.hits}/${G.items.length}`, 800, 150, W / 2, 1290);
    fit(t('cardLine', { zoom: G.zoom, speed: showSpeed(G.cpm || 0) }), 500, 38, W / 2, 1370);
    /* 점수 다음으로 눈에 띄어야 할 한 줄 — 공유 루프의 실제 문구 */
    fit(t('cardCta'), 700, 54, W / 2, 1470);
    ctx.textAlign = 'left';
    /* 공유 파일은 미리 굽는다 — iOS 는 누른 직후가 아니면 share() 를 막는다 */
    cv.toBlob(b => { if (b) cardShot = new File([b], `regiontype-${G.slug}.png`, { type: 'image/png' }); done(); }, 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
}

$('#save').onclick = async () => {
  /* 공유 시트가 있는 기기(대개 폰)는 인스타 스토리·카톡으로 바로 보낸다. 누른 뒤
     await 을 거치면 iOS 가 막으므로 미리 구운 cardShot 이 있을 때만 곧장 부른다.
     취소(AbortError)는 실패가 아니다. 안 되면 옛 다운로드로 돌아간다 */
  if (cardShot && navigator.canShare && navigator.canShare({ files: [cardShot] })) {
    try {
      await navigator.share({
        files: [cardShot],
        text: `${courseLabel(G.course)} ${G.hits}/${G.items.length} · ${t('cardCta')}`,
        url: 'https://regiontype.com',
      });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  await cardReady;
  const a = document.createElement('a');
  a.download = `regiontype-${G.slug}.png`;
  a.href = $('#card').toDataURL('image/png');
  a.click();
};
$('#again').onclick = () => start(G.slug);

/* ── 피드백 ──────────────────────────────────────────
   정적 사이트에는 GitHub 토큰을 둘 수 없다. relay/ 의 중계기가 토큰을 쥐고
   이슈를 대신 만든다 — FEEDBACK_URL 이 그 주소다.
   글만으로는 재현할 수 없어 버전·주소·브라우저를 함께 싣는다. */
const FEEDBACK_URL = self.RT_RELAY;   // relay.js
/* 폰 타수는 키보드와 견줄 수 없다 — 순위표는 기기마다 따로 선다(relay 의 devOf) */
const DEV = matchMedia('(pointer:coarse)').matches ? 'mobile' : 'pc';
const fbNote = $('#fbNote');
const fbSend = $('#fbSend');
const fbSay = (msg, bad) => { fbNote.textContent = msg; fbNote.classList.toggle('bad', !!bad); };
let fbKind = 'bug';
let fbToken = '', fbWidget = null, fbLoading = null, fbRetry = null;
const fbCanSend = () => { fbSend.disabled = !fbToken; };
const fbClearToken = () => {
  fbToken = '';
  fbCanSend();
};
const fbRemoveWidget = () => {
  fbClearToken();
  if (fbWidget !== null && window.turnstile) window.turnstile.remove(fbWidget);
  fbWidget = null;
  $('#fbHuman').replaceChildren();
};
const fbRenewWidget = () => {
  fbRemoveWidget();
  if ($('#feedback').open) fbReady();
};
const loadTurnstile = () => {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const old = document.querySelector('script[data-turnstile]');
    if (old) old.remove();
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true; s.dataset.turnstile = '';
    const timer = setTimeout(() => { s.remove(); reject(new Error(t('fbFail'))); }, 8000);
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = e => { clearTimeout(timer); s.remove(); reject(e); };
    document.head.append(s);
  });
};
const fbReady = async () => {
  try {
    const sitekey = await (fbLoading || (fbLoading = (async () => {
      const r = await fetch(`${FEEDBACK_URL}/turnstile`, { signal: AbortSignal.timeout(8000) });
      const c = await r.json();
      if (!r.ok || !c.sitekey) throw new Error(c.msg || t('fbFail'));
      await loadTurnstile();
      return c.sitekey;
    })()));
    /* 느린 연결에서 기다리다 창을 닫았으면 숨은 상자에 iframe 을 만들지 않는다.
       준비 Promise 는 남겨 두므로 다시 열 때 곧바로 여기부터 이어진다. */
    if (!$('#feedback').open || fbWidget !== null) return;
    fbWidget = window.turnstile.render('#fbHuman', {
      sitekey, action: 'feedback', theme: 'auto', size: 'flexible',
      callback: token => {
        if (!$('#feedback').open) return;
        fbToken = token; fbCanSend(); fbSay('');
      },
      'expired-callback': fbRenewWidget,
      'timeout-callback': fbRenewWidget,
      'error-callback': () => {
        fbClearToken(); fbSay(t('fbFail'), true);
        clearTimeout(fbRetry);
        fbRetry = setTimeout(fbRenewWidget, 1000);
      },
    });
  } catch (e) {
    fbLoading = null;
    fbClearToken();
    fbSay(e.message || t('fbFail'), true);
  }
};
const fbPlaceholder = () => {
  const key = { bug: 'kindBug', idea: 'kindIdea', data: 'kindData' }[fbKind];
  $('#fbBody').placeholder = t(key);
};
fbPlaceholder();

/* 넵바와 설정 정책 탭, 두 곳에서 같은 판을 연다 */
document.querySelectorAll('[data-fb-open]').forEach(b => b.onclick = () => {
  fbSay(''); fbPlaceholder(); $('#feedback').showModal();
  fbReady();
});
$('#fbClose').onclick = () => $('#feedback').close();
/* dialog 는 배경 클릭으로 닫히지 않는다. 여백은 form 이 갖고 있으니
   dialog 자신이 표적이면 곧 바깥이다. */
$('#feedback').onclick = e => { if (e.target === e.currentTarget) e.currentTarget.close(); };
$('#feedback').addEventListener('close', () => {
  clearTimeout(fbRetry); fbRetry = null; fbRemoveWidget();
});

$('.fb-kind').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  fbKind = b.dataset.v;
  $('.fb-kind').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  fbPlaceholder();
};

$('#fbForm').onsubmit = async e => {
  e.preventDefault();
  const body = $('#fbBody').value.trim();
  if (!body || !fbToken) return;
  const c = { kind: fbKind, body,
              v: VER, href: location.href, ua: navigator.userAgent, cf: fbToken };
  fbClearToken();
  fbSay(t('fbSending'));
  let accepted = false;
  try {
    const r = await fetch(FEEDBACK_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) });
    let msg = '';
    try { msg = (await r.json()).msg || ''; } catch { /* Access/HTML 차단 */ }
    if (!r.ok) throw new Error(msg || String(r.status));
    $('#fbBody').value = '';
    fbSay(t('fbThanks'));
    accepted = true;
    setTimeout(() => $('#feedback').close(), 1200);
  } catch (e) {
    fbSay(e.message && e.message !== 'Failed to fetch' ? e.message : t('fbFail'), true);
  }
  if (!accepted && $('#feedback').open) fbRenewWidget();
};

/* ── 순위표 ───────────────────────────────────────────
   기록은 피드백과 같은 중계기 뒤 D1 에 쌓인다. 코스와 제한 시간이 둘 다 같아야
   한 판이다 — 5분과 1분을 한 줄에 세우면 점수에 뜻이 없다.
   채점은 여기 브라우저가 하고 중계기는 앞뒤만 본다. 명예의 전당이지 판정 기록이 아니다. */
const NAME_KEY = 'rt.name';
/* ── 로그인 ───────────────────────────────────────────
   순위표에 올릴 때만 필요하다. 게임은 로그인 없이 그대로 돈다.
   로그인은 같은 문서의 홈 덮개(auth.js)가 한다 — 여기서는 그 결과로 받아 둔
   토큰만 읽는다. /signin/ 은 공급자 콜백을 홈으로 넘기는 착지대다.

   비밀번호는 안 받는다. 1차는 Google·Apple(SSO)이 하고, 패스키는 계정에 걸어
   둔 사람만 얹는 2단계다 — 어느 쪽 비밀도 우리가 쥐지 않는다.
   토큰을 쿠키가 아니라 localStorage 에 두는 건 중계기가 사이트와 다른 도메인
   (g.gearservicevanguard.com)에 있어서다. 남의 도메인 쿠키는 브라우저가
   점점 더 막는다 — 도메인이 갈린 이상 HttpOnly 쿠키로 올릴 길은 닫혔다. */
const TOKEN_KEY = 'rt.token';
const token = () => { try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' } };

const boardSay = (t, bad) => {
  const p = $('#boardSay'); p.textContent = t; p.classList.toggle('bad', !!bad);
};

function drawRanks(list) {
  const ol = $('#ranks');
  ol.innerHTML = '';
  list.forEach((r, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<b></b><span class="who"></span><span class="pt"></span>';
    li.querySelector('b').textContent = i + 1;
    li.querySelector('.who').textContent = r.name || t('anon');
    li.querySelector('.pt').textContent = showSpeed(r.cpm);
    if (r.me) {
      li.classList.add('me');
      const tag = document.createElement('span');
      tag.className = 'tag'; tag.textContent = t('me');
      li.querySelector('.who').after(tag);
    }
    ol.append(li);
  });
}

const boardAsk = async (path, body) => {
  const t = token();
  const head = {};
  if (body) head['content-type'] = 'application/json';
  if (t) head.authorization = 'Bearer ' + t;
  const r = await fetch(FEEDBACK_URL + path, body
    ? { method: 'POST', headers: head, body: JSON.stringify(body) }
    : { headers: head });
  if (!r.ok) throw new Error(r.status);
  return r.json();
};

/* 순위표가 안 되어도 결과 화면은 그대로다 — 통째로 접고 만다.
   로그인했으면 일반전 판은 여기서 /played 로 올린다 — 전적과 코스별 최고 기록이 한 번에
   적히고 그 판의 순위표가 돌아온다. 이름은 없어도 오른다(중계기가 닉네임을 붙인다).
   경쟁전 판은 ranked.js 가 /ranked/end 로 올리고, 정산이 끝나면 이걸 다시 부른다 */
async function board() {
  const sec = $('#board');
  sec.hidden = true;
  const inn = !!token();
  const play = { c: G.slug, t: G.total };
  /* 한 판은 한 번만 올린다 — 내리기 뒤에 다시 그릴 때 방금 내린 판을 도로 올리지 않게 */
  const up = inn && !G.ranked && !G.sent;
  if (up) G.sent = true;
  try {
    const d = up
      ? await boardAsk('/played', { ...play, dev: DEV, name: localStorage.getItem(NAME_KEY) || '',
          score: G.score, cpm: G.cpm, acc: G.acc, hits: G.hits, tries: G.tries })
      : await boardAsk(`/top?c=${encodeURIComponent(play.c)}&t=${play.t}&dev=${DEV}&mode=${G.ranked ? 'ranked' : 'normal'}`);
    $('#boardWhere').textContent = `${courseLabel(G.course)} · ${clock(G.total)}`;
    boardSay(d.rank ? t('nth', { n: d.rank })
      : G.score && !inn ? t('notOnBoard', { n: showSpeed(G.cpm) })
      : '');
    $('#boardIn').hidden = inn;
    $('#boardDrop').hidden = !inn;
    drawRanks(d.top || []);
    sec.hidden = false;
  } catch { sec.hidden = true; }
}

/* 이름은 공개 목록에 걸린다. 올린 사람이 거둘 손잡이가 여기 있어야 한다 —
   이 버튼이 사라지면 철회 불가가 된다. 로그인한 채 다음 판을 치면 그 판은 다시 오른다.
   이름만 가리려면 계정의 비공개(profile.shut)다 */
$('#boardDrop').onclick = async () => {
  if (!confirm(t('forgetAsk'))) return;
  try {
    const d = await boardAsk('/forget', {});
    await board();
    boardSay(d.gone ? t('forgot', { n: d.gone }) : t('forgotNone'));
  } catch { boardSay(t('forgetFail'), true); }
};



/* ── 자체 검사: rt=1 쿼리로 실행 ─────────────────────── */
if (location.search.includes('rt=1')) {
  /* 두벌식 조합기 — 자판을 누른 순서 그대로 쳐서 음절이 맞게 서는지 */
  const type = keys => [...keys].reduce(hanPush, '');
  console.assert(type('ㄱㅏㅇㅅㅓㄱㅜ') === '강서구', '두벌식: 강서구');
  console.assert(type('ㄱㅏㅂㅅ') === '값' && type('ㄱㅏㅂㅅㅏ') === '갑사', '겹받침과 받침 넘김');
  console.assert(type('ㄱㅗㅏ') === '과' && type('ㅇㅡㅣ') === '의', '겹모음');
  console.assert(type('ㅈㅜㅇㄹㅣㅁㄷㅗㅇ') === '중림동' && type('ㅇㅕㅇㄷㅡㅇㅍㅗ') === '영등포', '받침 뒤 모음은 새 음절');
  console.assert(type('ㄷㅏㄹㄱ') === '닭' && type('ㄷㅏㄹㄱㅇㅣ') === '닭이', '겹받침 뒤에 첫소리가 오면 그대로 둔다');
  console.assert(type('ㅃㅏㄸ') === '빠ㄸ', 'ㄸ·ㅃ·ㅉ 은 받침이 되지 않는다');
  console.assert(type('abㄱ') === 'abㄱ' && type('ㄱ ㅏ') === 'ㄱ ㅏ', '한글 아닌 것과 공백은 붙이기만');
  console.assert(['값', '갑', '가', 'ㄱ', ''].every((w, i, a) => i === 0 || hanBack(a[i - 1]) === w), '지우기: 자모 하나씩');
  console.assert(hanBack('과') === '고' && hanBack('닭') === '달' && hanBack('ㅘ') === 'ㅗ', '겹모음·겹받침 지우기');
  const mk = names => names.map(n => ({ name: n, aliases: [stripSuffix(n)].filter(Boolean), claimed: false }));
  const m = (s, items) => { const r = matchInput(s, items); return r && r.name; };
  const gu = mk(['중구', '중랑구', '강남구', '강서구', '성북구', '성동구']);
  console.assert(m('중', gu) === null, '중: 중구/중랑구 미확정이어야');
  console.assert(m('중구', gu) === '중구', '중구 정확일치');
  console.assert(m('강남', gu) === '강남구', '약칭 즉시 확정');
  console.assert(m('ㅋㅋ강남', gu) === '강남구', '앞 오타는 접미 검사로 흘려보냄');
  console.assert(m('없는곳', gu) === null, '미등록');
  const one = mk(['중구', '중랑구']); one[1].claimed = true;
  console.assert(m('중', one) === null, '한 글자 어간(중)은 약칭으로 인정하지 않는다');
  const two = mk(['강서구', '강남구']); two[0].claimed = true;
  console.assert(m('강서', two) === null, '이미 점령한 곳은 다시 맞지 않는다');

  const dong = [{ name: '역삼1동', aliases: ['역삼동', '역삼1'], claimed: false },
                { name: '역삼동', aliases: [], claimed: false }];
  console.assert(m('역삼동', dong) === '역삼동', '정식 명칭 일치가 남의 별칭에 가려지면 안 된다');
  console.assert(m('역삼1', dong) === '역삼1동', '별칭은 후보가 자기 자신뿐일 때 확정');

  const jp = mk(['東京都', '京都府']);
  console.assert(m('東京', jp) === '東京都', '都 접미 약칭');
  console.assert(m('京都', jp) === '京都府', '府 접미 약칭');
  const us = [{ name: 'New York', aliases: ['NY'], claimed: false },
              { name: 'New Mexico', aliases: ['NM'], claimed: false }];
  const ms = (s, items) => { const r = matchInput(s, items, true); return r && r.name; };
  console.assert(ms('New York', us) === 'New York', '띄어쓰기 이름 정확일치');
  console.assert(ms('new york', us) === 'New York', '영문 대소문자');
  console.assert(ms('NY', us) === 'New York', '우편 약칭');
  console.assert(ms('ny', us) === 'New York', '우편 약칭 소문자');
  const kj = mk(['전라남도', '광주광역시']);
  kj[0].aliases.push('KJ'); kj[1].aliases.push('KJ');
  console.assert(m('KJ', kj) === null, '겹치는 우편 약칭은 확정하지 않는다');
  console.assert(m('광주', kj) === '광주광역시', '접미 약칭은 후보가 하나일 때');

  /* 시·도. 홑 '도' 가 접미 문자류에 없으면 경기도는 약칭이 아예 안 생긴다 */
  const sido = mk(['경기도', '강원도', '충청북도', '충청남도', '제주특별자치도']);
  console.assert(m('경기', sido) === '경기도', '도 접미 약칭');
  console.assert(m('제주', sido) === '제주특별자치도', '특별자치도가 홑 도보다 먼저 걸린다');
  console.assert(m('충청', sido) === null, '충청북도/충청남도 사이에서 미확정');
  sido[2].aliases.push('충북'); sido[3].aliases.push('충남');
  console.assert(m('충북', sido) === '충청북도', '통용 약칭은 별칭으로 박는다');
  const seom = mk(['울릉도', '독도']);
  console.assert(m('울릉', seom) === '울릉도', '섬 이름도 도 접미를 탄다');
  console.assert(m('독', seom) === null, '한 글자 어간은 약칭으로 인정하지 않는다');

  /* Shift 복수 선택은 격자로 붙어 있는 칸까지만 */
  const tl = (c, r, kid, parent) => ({ gc: [c, r], kid, parent });
  console.assert(nextTo(tl(3, 3), tl(4, 4)) === true, '대각선도 이웃이다');
  console.assert(nextTo(tl(3, 3), tl(5, 3)) === false, '한 칸 넘게 떨어지면 이웃이 아니다');
  console.assert(nextTo(tl(3, 3), tl(3, 4, true, 1)) === false, '구와 동은 같은 단계가 아니다');
  console.assert(nextTo(tl(3, 3, true, 1), tl(3, 4, true, 2)) === false, '다른 구의 동끼리는 묶지 않는다');
  console.assert(nextTo(tl(3, 3, true, 1), tl(3, 4, true, 1)) === true, '같은 구의 이웃 동');

  /* 화면 이름은 행정명을 한 자로 줄여 붙인다 */
  console.assert(adminLabel('서울특별시') === '서울시', '특별시는 시로 줄인다');
  console.assert(adminLabel('세종특별자치시') === '세종시', '특별자치시도 시로');
  console.assert(adminLabel('광주광역시') === '광주시', '광역시도 시로');
  console.assert(adminLabel('제주특별자치도') === '제주도', '특별자치도는 도로');
  console.assert(adminLabel('경기도') === '경기도', '이미 짧은 이름은 그대로 둔다');
  console.assert(adminLabel('강남구') === '강남구', '자치구가 아닌 구도 그대로');
  console.assert(adminLabel('California') === 'California', '한국 밖 이름은 손대지 않는다');

  /* 타수는 두벌식 키 수다 */
  console.assert(keysOf('가') === 2, '가 = ㄱㅏ');
  console.assert(keysOf('까') === 2, '쌍자음은 Shift 를 세지 않아 한 키');
  console.assert(keysOf('과') === 3, '겹모음 ㅘ 는 ㅗ+ㅏ');
  console.assert(keysOf('닭') === 4, '겹받침 ㄺ 은 ㄹ+ㄱ');
  console.assert(keysOf('강남구') === 8, '강남구 = ㄱㅏㅇㄴㅏㅁㄱㅜ');
  console.assert(keysOf('New York') === 8, '라틴 문자는 한 글자 한 키, 띄어쓰기도 한 키');
  console.assert(keysOf('ㅘ') === 2 && keysOf('ㄳ') === 2, '홀로 선 겹자모도 두 키');
  const gs = [{ name: '강서구', aliases: ['강서'] }];
  console.assert(partKeys('강ㅅ', gs) === 4, '조합 중인 강ㅅ 은 강서구의 앞 네 타');
  console.assert(partKeys('갓', gs) === 0, '앞부분이 아니면 0');
  console.assert(partKeys('ny', [{ name: 'New York', aliases: [] }], true) === 0, '띄어쓰기 이름은 앞에서부터');
  console.assert(partKeys('new y', [{ name: 'New York', aliases: [] }], true) === 5, '대소문자는 접는다');

  /* 안내에 '서울시'가 떠 있어도 어간·줄인 이름·정식 명칭이 모두 맞는다 */
  const mkAdmin = names => names.map(n => ({
    name: n,
    aliases: [...new Set([stripSuffix(n), adminLabel(n)].filter(a => a && a !== n))],
    claimed: false,
  }));
  const si = mkAdmin(['서울특별시', '부산광역시', '제주특별자치도']);
  console.assert(m('서울', si) === '서울특별시', '어간만 쳐도 맞는다');
  console.assert(m('서울시', si) === '서울특별시', '줄인 행정명도 맞는다');
  console.assert(m('서울특별시', si) === '서울특별시', '정식 명칭도 그대로 맞는다');
  console.assert(m('제주도', si) === '제주특별자치도', '제주도로도 맞는다');
  console.assert(typeCap(si[0]) === '서울특별시'.length, '입력 한도는 가장 긴 이름에서 딴다');

  const tree = { children: {
    'kr-admin/서울특별시': 'seoul-gu', 'kr-admin/세종특별자치시': null,
    'seoul-gu/강서구': 'gangseo-dong',
  } };
  console.assert(courseList('kr-admin', tree).map(c => c.slug).join() === 'seoul-gu',
    '칸은 뿌리 바로 아래 코스만, 빈 자리는 뺀다 — 나라 코스는 머리글');
  { const was = opt.dong;
    opt.dong = 'legal';
    console.assert(dongSlug('gangseo-dong') === 'gangseo-bdong' && dongSlug('seoul-gu') === 'seoul-gu', '법정동은 구 코스만 바꾼다');
    opt.dong = was; }
  console.assert(courseList('seoul-gu', tree).map(c => c.slug).join() === 'gangseo-dong',
    '서울 칸은 자치구 코스만');
  console.assert(courseList('us-admin', null).length === 0, 'tree 없으면 칸 없이 머리글만');
  console.assert(courseCell(0, 18, 9, 6).join() === '1,1', '코스 덩이는 가운데서 시작');
  console.assert(courseCell(17, 18, 9, 6).join() === '6,3', '한 줄 여섯 칸씩 내려간다');
  console.assert(courseCell(0, 25, 12, 8, SEOUL_CELLS['gangseo-dong']).join() === '2,4', '강서는 덩이 서쪽');
  console.assert(courseCell(0, 25, 12, 8, SEOUL_CELLS['gangdong-dong']).join() === '9,4', '강동은 덩이 동쪽');
  console.assert(courseCell(0, 25, 12, 8, SEOUL_CELLS['dobong-dong']).join() === '7,1', '도봉은 덩이 북쪽');
  console.assert(courseCell(0, 25, 12, 8, SEOUL_CELLS['gwanak-dong']).join() === '5,7', '관악은 덩이 남쪽');
  console.assert(courseCell(0, 25, 12, 4, SEOUL_CELLS['gangseo-dong'])[1]
    !== courseCell(0, 25, 12, 4, SEOUL_CELLS['gwanak-dong'])[1], '짧은 화면에서도 남북이 겹치지 않는다');
  const rp = (ox, oy, i, n) => radialPush(ox, oy, 5, 5, i, n).map(v => Math.round(v * 1e3) / 1e3);
  console.assert(rp(10, 5, 0, 4).join() === '1,0', '동쪽으로 민다');
  console.assert(rp(5, 0, 0, 4).join() === '0,-1', '위쪽으로 민다');
  console.assert(rp(5, 5, 0, 4).join() === '1,0', '겹치면 등각');
  console.assert(rp(5, 5, 1, 4).join() === '0,1', '등각 다음');
  const packed = packGeom([{ name: 'a', c: [0, 0] }, { name: 'b', c: [10, 0] }, { name: 'c', c: [0, 10] }]);
  console.assert(packed.size[0] >= 2 && packed.size[1] >= 2, '행정동 자리표는 넓이를 따른다');
  console.assert(new Set(Object.values(packed.cells).map(p => p.join())).size === 3, '행정동은 겹치지 않는다');
  const slotted = packGeom([{ name: 'a', c: [0, 0], s: [2, 3] }, { name: 'b', c: [1, 1], s: [5, 3] }]);
  console.assert(slotted.cells.a.join() === '0,0' && slotted.cells.b.join() === '3,0', 's 자리표가 있으면 그걸 쓴다');
  console.assert(['서울특별시', '세종특별자치시', '경기도', '강원도', '제주특별자치도'].map(shortAdmin).join()
    === '서울,세종,경기,강원,제주', '밀려난 칸 이름은 시·도 접미를 뗀다');
  console.assert(['충청북도', '충청남도', '전라북도', '경상남도'].map(shortAdmin).join()
    === '충북,충남,전북,경남', '남북으로 갈린 도는 첫 글자와 방위');
  console.assert(['고양시일산서구', '시흥시', '연천군', '의정부시', '포항시남구', '중구', '조치원읍'].map(kidName).join()
    === '고양일산서구,시흥,연천,의정부,포항남구,중구,조치원읍', '구역 칸은 시·군을 떼고 구·읍·면·동은 둔다');
  const langWas = LANG, roman = { 'kr-admin/충청북도': 'Chungcheongbuk-do' };
  LANG = 'vi';
  console.assert(placeName(roman, 'kr-admin', '충청북도') === 'Chungcheongbuk-do', '한국어 밖에서는 로마자 표');
  console.assert(placeName(roman, 'kr-admin', '충청북도', true) === 'Chungcheongbuk', '짧은 로마자는 -do 를 뗀다');
  console.assert(placeName(null, 'kr-admin', '경기도') === '경기도', '표가 없으면 한국어로 떨어진다');
  LANG = 'ko';
  console.assert(placeName(roman, 'kr-admin', '충청북도', true) === '충북', '한국어 화면은 한국어 약칭');
  LANG = langWas;
  const spr = sp(0, .05); spr.to = 100;
  let peak = 0;
  for (let i = 0; i < 90; i++) { spStep(spr, 1 / 60); peak = Math.max(peak, spr.x); }
  console.assert(spr.x === 100 && peak <= 100, '임계 감쇠 스프링은 넘치지 않고 1.5초 안에 멈춘다');
  const logo = $('#regions .navbar .nav-logo'), shape = $('#navShape');
  if (logo && shape && logo.querySelector('.dot')) {
    aimNavShape(logo);
    console.assert(logo.classList.contains('is-on') && shape.classList.contains('is-pill'),
      '로고를 가리키면 알약이 로고를 감싼다');
    aimNavShape(null);
    console.assert(!logo.classList.contains('is-on') && !shape.classList.contains('is-pill'),
      '손 떼면 로고 점 자리의 원으로 돌아간다');
    document.body.classList.add('rk-intro');
    aimNavShape(null);
    console.assert(!logo.classList.contains('is-on') && !shape.classList.contains('is-pill') && navTopTarget(logo) === null,
      '봇이 조르는 동안엔 알약이 로고를 감싸지 않는다 — 로고 점이 채운다');
    document.body.classList.remove('rk-intro');
    aimNavShape(null);
  }
  const play = $('#navPlay'), botShape = $('#navBotShape');
  const set = document.querySelector('#regions .nav-bot a[href="settings/"]');
  if (play && botShape && set && play.closest('.nav-bot')) {
    aimBotShape(set);
    console.assert(set.classList.contains('is-on') && !play.classList.contains('is-on') && botShape.classList.contains('is-pill'),
      '아래줄에서 설정을 가리키면 알약이 설정을 감싼다');
    aimBotShape(null);
    console.assert(play.classList.contains('is-on') && !set.classList.contains('is-on') && botShape.classList.contains('is-pill'),
      '손 떼면 시작하기 뒤로 돌아간다');
  }
  console.assert(clampCam(0, 0, 100, 100, 1).join() === '0,0', '1배는 이동 없음');
  console.assert(clampCam(-50, -50, 100, 100, 3).join() === '-50,-50', '안쪽은 그대로');
  console.assert(clampCam(-1000, 40, 100, 100, 3).join() === '-200,0', '지도 밖으로 못 나감');
  console.assert(clampHomePan(0, 0).join() === '0,0', '칸이 없으면 원점');
  console.assert(clampZoom(.1, .55, 2.6) === .55, '홈 줌은 칸이 사라질 만큼 줄지 않는다');
  console.assert(clampZoom(9, 1, 8) === 8, '플레이 줌 상한');
  console.assert(clampZoom(3, 1, 8) === 3, '플레이 줌 안쪽은 그대로');
  console.assert(fitSpan(0, -100, 900, 600) === 100, '폰: 지도가 빈 칸보다 작으면 칸 한가운데');
  console.assert(fitSpan(50, 0, 500, 1000) === 0 && fitSpan(-900, 0, 500, 1000) === -500,
    '폰: 지도가 크면 빈 칸을 빈틈없이 덮는 데까지만 끌린다');
  console.assert(fitSpan(250, 0, 500, 1000, .5) === 250 && fitSpan(250 - 1000, 0, 500, 1000, .5) === -750,
    '폰 조준: 지도 맨 끝(0, 1000)의 목표도 칸 한가운데(250)에 선다');
  console.assert(fitSpan(9999, 0, 500, 1000, 2 / 3) === 500 * 2 / 3 && fitSpan(0, -100, 900, 600, .5) === 100,
    '폰 끌기: 칸의 1/3 은 지도가 덮고, 작은 지도는 여전히 한가운데');

  UI_LANGS = ['ko', 'en', 'ja', 'de', 'fr', 'es', 'pt', 'zh'];
  LANG_COUNTRY = buildLangCountry({
    countries: [{ id: 'KR', lang: 'ko' }, { id: 'JP', lang: 'ja' }, { id: 'US', lang: 'en' },
                { id: 'DE', lang: 'de' }, { id: 'FR', lang: 'fr' }, { id: 'TW', lang: 'zh' }],
  });
  WORLD = { countries: [
    { id: 'KR' }, { id: 'JP' }, { id: 'US' }, { id: 'DE' }, { id: 'FR' }, { id: 'TW' },
  ] };
  const devWas = isDev();
  document.documentElement.dataset.dev = '';        // 나라 감지는 개발 쪽 계약이다
  HERE = { country: '', lang: 'de-DE', timezone: 'Europe/Berlin' };
  opt.country = 'auto';
  console.assert(resolveCountry() === 'DE', 'Accept-Language·타임존으로 독일');
  HERE = { country: 'FR', lang: 'en-US', timezone: 'Europe/Paris' };
  console.assert(resolveCountry() === 'FR', 'relay 나라 코드가 언어보다 우선');
  opt.country = 'auto';
  HERE = { country: '', lang: 'zh-TW', timezone: '' };
  console.assert(resolveCountry() === 'TW', 'zh-TW → 대만');
  opt.country = 'JP';
  console.assert(resolveCountry() === 'JP', '개발에서는 고른 나라가 자동 감지를 이긴다');
  document.documentElement.removeAttribute('data-dev');
  console.assert(resolveCountry() === 'KR', '배포는 골라 둔 나라를 무시하고 남한');
  HERE = { country: 'FR', lang: 'fr-FR', timezone: 'Europe/Paris' };
  console.assert(resolveCountry() === 'KR', '배포는 자동 감지도 무시하고 남한');
  document.documentElement.toggleAttribute('data-dev', devWas);
  opt.country = 'auto';
  HERE = { country: '', lang: 'zh-TW', timezone: '' };
  opt.lang = 'auto';
  console.assert(parseUiLang('zh-Hant-TW') === 'zh', '번체 UI 는 zh 로');
  console.assert(parseUiLang('de-AT') === 'de', 'de-AT → de UI');
  opt.lang = 'auto'; LANG = resolveLang();
  HERE = { country: 'BR', lang: 'pt-BR', timezone: 'America/Sao_Paulo' };
  COUNTRY = 'BR';
  console.assert(resolveLang() === 'pt', 'pt-BR → pt UI');

  WORLD = { countries: [
    { id: 'KR', regions: [{ id: 'seoul', title: { ko: '서울' } }] },
    { id: 'JP', regions: [{ id: 'jp-admin' }] },
    { id: 'ZZ' },
  ] };
  console.assert(countryStage('KR') === 'available', '손으로 지은 코스가 있으면 정식');
  console.assert(countryStage('JP') === 'preview', 'admin-1 뿐이면 미리보기');
  console.assert(countryStage('XX') === 'preview', '모르는 나라도 미리보기로 떨어진다');
  console.assert(countryStage('ZZ') === 'preview', 'regions 가 없어도 터지지 않는다');

  console.log('self-check done');
}

/* 소개·방침처럼 다른 문서로 나갔다가 뒤로 오면 이 화면은 뒤로/앞으로
   캐시(bfcache)에서 통째로 되살아나 스크립트가 다시 돌지 않는다. 그때만 새로 읽는다.
   storage 는 다른 탭에서만 온다 — 같은 탭의 뒤로 가기에는 안 온다. 다른 탭이
   계정을 지우거나 로그아웃해 rt.token 이 사라지면 이 탭의 '내 계정' 도 내린다 */
addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
addEventListener('storage', e => { if (e.key === 'rt.token' || e.key === null) paintUI(); });

/* ?v= 표류. 페이지가 셋(홈·로그인·설정)이라 손으로 적는 자리가 여섯이다 — 개발에서만
   짖는다. 파비콘(rel=icon)은 뺀다: 그림이 바뀔 때만 움직이는 별개의 캐시 열쇠다 */
if (isDev()) document.querySelectorAll('[src*="?v="],[href*="?v="]:not([rel~="icon"])').forEach(el => {
  const v = new URL(el.getAttribute('src') || el.getAttribute('href'), location.href).searchParams.get('v');
  if (v !== VER) console.warn('[ver] ?v=' + v + ' \u2260 ' + VER, el);
});

/* ranked.js 가 화면 말을 다 읽은 뒤에 봇을 열도록 기다린다 */
const BOOTED = boot();
