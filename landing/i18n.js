/* 소개 화면(/landing/, /landing/proto/)의 화면 말. 말은 data/landing-i18n.json, 게임 화면 말
   data/i18n.json 과 같은 26개만 받는다.

   고르는 차례. 맞는 것이 없으면 한국어로 두고 아무것도 바꾸지 않는다.
     1. 설정에서 고른 말 (rt.opt 의 lang 이 'auto' 가 아니면)
     2. 계정에 고정된 나라·언어 (/auth/me 의 pin = { country, lang }; 아직 없으면 건너뛴다)
     3. 방문자가 사는 나라 — 중계기 /where 의 country 의 공용어(data/world.json 의 lang)가
        지원 말이면 그 말. 브라우저 말 설정과는 맞춰 보지 않는다(브라우저가 영어여도 일본에서
        들어오면 일본어). 시간대·Accept-Language 로는 나라를 짐작하지 않는다.
        설정의 '접속 지역 추정'(rt.opt 의 where:false)을 끄면 /where 를 묻지 않는다.
     4. 그 밖은 ko.

   표시법
     data-i18n="키"                         글자(textContent)를 바꾼다. 자식 요소가 없는 끝 요소에 단다.
     data-i18n="키" data-i18n-attr="aria-label content"
                                            글자 대신 적힌 속성들을 그 키로 바꾼다.
     data-i18n-aria-label="키"              (placeholder·title·alt·content 도) 그 속성만 그 키로 바꾼다.
                                            글자와 속성을 한 요소에서 따로 바꿀 때 쓴다.
     data-i18n-vars='{"n":3}'               {n} 자리를 채운다.
   페이지 스크립트는 RT_LANDING.t(키, 값) 으로 말을 꺼내고, 말이 바뀌면 'rt-landing-i18n' 이벤트를 듣는다.
   한 키에 그 말이 없으면 en, en 도 없으면 ko(페이지 원문)다.

   키 — 섹션 id 가 앞머리다. /landing/ 과 시안 1~6 이 같은 키를 쓴다. page 는 머리줄·바닥줄·문서 제목처럼
   섹션 밖의 말, hero 는 시안 첫 화면.
     page   title desc expand openAll closeAll playNow scrollHint privacy terms community
            menu toc home newWindow branches arrows
     hero   tagline city gu dong inputLabel lit placeholder mapLabel poster issue route tilt week
            capTime({min},{n}) hit({v})
     about  name b1.h b1.p … b5.h b5.p route.label route.cap countries
            list.label list.sort list.abc list.course list.find list.none list.seoul
            shot1.cap shot1.alt shot2.cap shot2.alt phone.cap phone.alt
     dev    name verNote verNoteLive stack stackLabel run test relayTest tree.app tree.style tree.data
            tree.relay tree.beta tail1 tail2 changes grep.label grep.ph hits
     style  name beta open nav.title nav.p nav.sig bus.title bus.p bus.sig crt.title crt.p crt.sig
     story  name b1.h b1.p … b5.h b5.p
            (b5.p 는 염창동 한 줄 소개 — data/kr-intro.<말>.json 의 gangseo-dong/염창동 그대로. 지어내지 않는다)
     play   name go go.label lead frame live.play live.pause newTab pick.unit pick.view pick.add pick.added
     plans  name note month year tbd scope soon capital.short nation.short world.short
            capital.title capital.scope nation.title nation.scope world.title world.scope
   개발 칸의 터미널 주석(dev.verNote·verNoteLive·stack·stackLabel 과 tree.*·run·test·relayTest·tail1·tail2)과
   play/pause 는 ko·en 에만 있고, 다른 말은 영어로 보인다.
   펼침 칸(role=region)의 aria-label 은 그 섹션의 name 키를 data-i18n-attr="aria-label" 로 같이 쓴다.
*/
(() => {
  'use strict';
  const me = document.currentScript;
  const V = (me && new URL(me.src).searchParams.get('v')) || '';
  const at = p => {
    const u = new URL(p, me ? me.src : location.href);
    if (V) u.searchParams.set('v', V);
    return u.href;
  };
  const LANGS = ['ko', 'en', 'ja', 'de', 'fr', 'es', 'pt', 'zh', 'it', 'nl', 'pl', 'cs', 'sv', 'nb',
                 'fi', 'uk', 'ro', 'hu', 'bg', 'el', 'tr', 'vi', 'th', 'id', 'ms', 'ar'];
  const RTL = ['ar'];

  /* 말 태그를 지원 말 키로 접는다. zh-TW·zh-Hant 도 zh, no·nn 은 nb (app.js normLangTag 와 같은 갈래) */
  const base = tag => {
    const t = String(tag || '').replace('_', '-').trim().toLowerCase();
    if (!t) return '';
    if (t.startsWith('zh')) return 'zh';
    if (t.startsWith('nb') || t.startsWith('nn') || t === 'no' || t.startsWith('no-')) return 'nb';
    return t.split('-')[0];
  };
  const ok = l => LANGS.includes(l) ? l : '';

  /* 순수 판정. 검사가 그대로 부른다.
     opt: rt.opt, pin: /auth/me 의 pin, where: /where 응답,
     official: 나라 → 공용어 표 */
  function pick({ opt = {}, pin = null, where = null, official = {} } = {}) {
    if (opt.lang && opt.lang !== 'auto' && ok(opt.lang)) return opt.lang;
    if (pin && ok(base(pin.lang))) return base(pin.lang);
    const country = String(where && where.country || '').toUpperCase();
    const want = ok(base(official[country]));
    if (want) return want;
    return 'ko';
  }

  /* 중계기는 app.js sense() 처럼 1.6초까지만 기다린다. 데이터 파일은 넉넉히 */
  const json = (url, init, ms = 1600) => fetch(url, Object.assign({ signal: AbortSignal.timeout(ms) }, init))
    .then(r => r.ok ? r.json() : null).catch(() => null);

  let TAB = {}, LANG = 'ko';
  const t = (key, vars) => {
    let s = (TAB[LANG] && TAB[LANG][key]) || (TAB.en && LANG !== 'ko' && TAB.en[key]) || (TAB.ko && TAB.ko[key]);
    if (s == null) return null;
    if (vars) s = String(s).replace(/\{(\w+)\}/g, (_, k) => k in vars ? vars[k] : '');
    return s;
  };

  /* 처음 본 한국어 원문을 남겨 두어, 다른 말에서 한국어로 돌아올 때 그대로 되살린다 */
  const ORIG = new WeakMap();
  /* 속성 따로 키: data-i18n-aria-label="키" 처럼 쓰면 글자와 속성을 한 요소에서 따로 바꿀 수 있다 */
  const ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'content'];
  const SEL = ['[data-i18n]', ...ATTRS.map(a => `[data-i18n-${a}]`)].join(',');
  function apply(node) {
    const list = node && node.matches && node.matches(SEL) ? [node] : [];
    list.push(...(node || document).querySelectorAll(SEL));
    for (const el of list) {
      let vars = null;
      try { vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : null; } catch {}
      /* 값이 드는 말은 페이지 스크립트가 한국어로 직접 쓴다 */
      if (vars && LANG === 'ko') continue;
      /* [속성, 키] 목록. 속성 null 은 글자 */
      const jobs = [];
      const key = el.getAttribute('data-i18n');
      const attrs = (el.getAttribute('data-i18n-attr') || '').split(/\s+/).filter(Boolean);
      if (key) {
        if (attrs.length) for (const a of attrs) jobs.push([a, key]);
        else jobs.push([null, key]);
      }
      for (const a of ATTRS) if (el.hasAttribute('data-i18n-' + a)) jobs.push([a, el.getAttribute('data-i18n-' + a)]);
      if (!ORIG.has(el)) ORIG.set(el, {});
      const orig = ORIG.get(el);
      for (const [a, k] of jobs) {
        const slot = a || '#text';
        if (!(slot in orig)) orig[slot] = a ? el.getAttribute(a) : el.textContent;
        const s = LANG === 'ko' ? null : t(k, vars);
        const v = s != null ? s : orig[slot];
        if (v == null) continue;
        if (a) el.setAttribute(a, v);
        else el.textContent = v;
      }
    }
  }

  async function set(lang) {
    lang = ok(lang) || 'ko';
    if (lang === LANG && lang === 'ko') return lang;
    if (lang !== 'ko' && !TAB[lang]) {
      const all = await json(at('../data/landing-i18n.json'), {}, 8000);
      if (!all || !all[lang]) return LANG;
      TAB = all;
    }
    LANG = lang;
    const root = document.documentElement;
    root.lang = lang;
    root.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
    apply(document);
    dispatchEvent(new CustomEvent('rt-landing-i18n', { detail: { lang } }));
    return lang;
  }

  async function run() {
    let opt = {}, tok = '';
    try { opt = JSON.parse(localStorage.getItem('rt.opt') || '{}') || {}; } catch {}
    try { tok = localStorage.getItem('rt.token') || ''; } catch {}
    const relay = self.RT_RELAY;
    const [acct, where] = await Promise.all([
      tok && relay ? json(relay + '/auth/me', { headers: { authorization: 'Bearer ' + tok } }) : null,
      opt.where !== false && relay ? json(relay + '/where') : null,
    ]);
    let official = {};
    if (where && where.country && String(where.country).toUpperCase() !== 'KR') {
      const world = await json(at('../data/world.json'), {}, 8000);
      for (const c of (world && world.countries) || []) official[c.id] = c.lang;
    }
    const lang = pick({ opt, pin: acct && acct.pin, where, official });
    return set(lang);
  }

  self.RT_LANDING = { pick, run, set, apply, t: (k, v) => t(k, v), get lang() { return LANG; } };
  run();
})();
