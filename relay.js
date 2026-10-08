/* 중계기 주소는 여기 한 곳이다 — 모든 페이지가 다른 스크립트보다 먼저 싣고, 각 스크립트는
   self.RT_RELAY 를 읽는다. 배포된 사이트는 늘 운영 중계기다.
   로컬(localhost·127.0.0.1)에서는 로컬 중계기(wrangler dev, .claude/launch.json 의 relay-dev)가
   기본이다. 로그인은 운영 중계기로 넘어간다 — 로컬 중계기에는 Google 비밀이 없다. ?relay=live 로 운영 중계기, ?relay=http://127.0.0.1:포트
   로 다른 로컬 포트를 고르면 rt.relay 에 남아 다른 페이지도 따라간다. ?relay=local 은 기본으로 되돌린다.
   토큰이 남의 주소로 나가면 안 되므로 운영 주소와 로컬 주소만 받는다. */
(() => {
  const LIVE = 'https://g.gearservicevanguard.com', LOCAL = 'http://127.0.0.1:8788';
  let url = LIVE;
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    url = LOCAL;
    try {
      const asked = new URLSearchParams(location.search).get('relay');
      if (asked === 'local') localStorage.removeItem('rt.relay');
      else if (asked === 'live' || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(asked || '')) localStorage.setItem('rt.relay', asked);
      const v = localStorage.getItem('rt.relay');
      if (v === 'live') url = LIVE;
      else if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(v || '')) url = v;
    } catch {}
  }
  self.RT_RELAY = url;
  self.RT_LIVE = LIVE;
})();
