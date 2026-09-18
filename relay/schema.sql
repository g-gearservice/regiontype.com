-- 순위표. 한 판은 (코스, 제한 시간) 이고, 그 안에서 한 사람이 한 줄이다.
--   wrangler d1 execute rt-board --remote --file schema.sql
--
-- 줄의 주인은 이름이 아니라 who 다 — 브라우저가 한 번 만들어 두는 난수.
-- 이름으로 주인을 삼으면 남의 이름에 높은 점수를 박아 그 사람이 영영
-- 자기 기록을 못 올리게 만들 수 있다. 이름은 화면에 거는 표시일 뿐이다.
create table if not exists board (
  slug  text    not null,
  secs  integer not null,
  who   text    not null,
  name  text    not null,
  score integer not null,
  hits  integer not null,
  acc   integer not null,
  at    integer not null,
  primary key (slug, secs, who)
);
-- 판마다 상위 몇 줄만 읽는다. 동점이면 먼저 올린 쪽이 앞이다.
create index if not exists board_top on board (slug, secs, score desc, at asc);

-- ── 로그인 ────────────────────────────────────────────────
-- 순위표에 올릴 때만 필요하다. 게임은 로그인 없이 그대로 돈다.
-- 1차 인증은 Google·Apple(SSO) 이 하고, 패스키는 계정에 하나라도 있으면 그
-- 위에 얹는 2단계다. mail 은 계속 비워 둔다 — 메일도 이름도 받지 않는다.
create table if not exists user (
  id   text primary key,          -- 난수 16바이트 hex. 사람을 가리키는 유일한 값이다
  mail text unique,               -- 늘 null. 자리만 남겨 둔다 — 받는 값이 아니다
  at   integer not null
);
-- 패스키 한 개 = 기기 한 대. 한 사람이 여럿 가질 수 있다.
-- key 는 SPKI DER 를 base64url 로 적은 공개키다 — 비밀은 기기 밖으로 나오지 않는다.
create table if not exists passkey (
  id    text primary key,         -- credential id (base64url)
  who   text not null,
  key   text not null,
  alg   integer not null,         -- COSE 알고리즘 (-7 ES256, -257 RS256)
  count integer not null default 0,
  at    integer not null
);
create index if not exists passkey_who on passkey (who);

-- SSO 로 묶인 사람. sub 는 공급자가 준 원래 값이 아니라 hmac_sha256(SUB_KEY,
-- provider+':'+원래 sub) 를 hex 로 적은 값이다(SUB_KEY 가 없으면 SESSION_KEY
-- 로 대신한다 — worker.mjs 의 hmacSub). Google 의 sub 은 전역 고정 id 라 다른
-- 사이트의 유출 데이터와 대조하면 동일인이 드러난다. HMAC 을 씌워 이 사이트
-- 안에서만 뜻이 있는 값으로 접는다(Apple 은 원래 팀 단위 가명이라 절실하진
-- 않지만, 갈라 쓰지 않고 같은 경로를 태운다).
--
-- SESSION_KEY 와 SUB_KEY 를 나눈 이유: SESSION_KEY 는 "급하면 갈아서 세션을
-- 전부 끊는" 비상 레버로 문서화돼 있다. 두 키가 같으면 그 레버를 당길 때마다
-- 이 표의 sub 도 전부 안 맞게 되어, 다음 로그인에서 조용히 새 빈 계정이
-- 생기고 옛 순위표·패스키·복구 코드는 고아가 된다("다시 로그인하면 다시
-- 묶인다"는 말은 성립하지 않는다 — sub 이 같아도 해시가 달라지므로). SUB_KEY
-- 를 따로 두면 SESSION_KEY 회전은 세션만 끊고, sso 연결은 SUB_KEY 를 갈 때만
-- (그것도 여전히 위와 같은 대가로) 끊긴다.
create table if not exists sso (
  provider text not null,         -- 'google' | 'apple'
  sub      text not null,
  who      text not null,
  at       integer not null,
  primary key (provider, sub)
);

-- 패스키 없이 2단계를 넘는 비상구. code 원문은 어디에도 남기지 않는다 —
-- 해시만 저장하고, 쓰면(redeem) 그 줄을 지운다(한 번만 쓴다). 재발급은
-- 그 계정의 옛 줄을 전부 지우고 다시 8개를 채우는 전량 교체다.
create table if not exists recovery (
  hash text primary key,          -- sha256(code) 를 hex 로 적은 값
  who  text not null,
  at   integer not null
);
create index if not exists recovery_who on recovery (who);

-- 로그인 도중의 일회용 상태. 서버가 낸 것인지 확인해야 하므로 남겨 둔다.
-- kind 는 'reg'(패스키 등록) | 'sso-google' | 'sso-apple'(SSO 진행 중) |
-- 'take'(SSO 를 마치고 토큰을 받으러 오길 기다림) | 'two'(2단계 확인 중) 다.
--
-- ★ 이미 pending 표가 있는 DB 에 이 파일을 다시 적용하는 경우:
-- `create table if not exists` 는 표가 이미 있으면 아무것도 안 한다 — 새로
-- 늘어난 칸(back·provider·sub·tries)이 안 붙는다. sqlite 의 존재 검사는 표
-- 단위지 칸 단위가 아니다. 붙이지 않은 채로 두면 challenge() 의 insert 가
-- "no column named sub" 로 터지고, 그 순간부터 로그인이 전부 실패한다.
-- pending 은 수명 5분짜리 상태만 담아 지킬 데이터가 없으니, 아래 둘 중 하나를
-- 사람이 직접 실행한다(이 파일이나 우리가 대신 돌리지 않는다):
--
--   -- 표를 통째로 새로 만든다(가장 간단하다) --
--   wrangler d1 execute rt-board --remote --command "drop table pending"
--   wrangler d1 execute rt-board --remote --file schema.sql
--
--   -- 또는 표는 두고 칸만 더한다 --
--   wrangler d1 execute rt-board --remote --command "alter table pending add column back text"
--   wrangler d1 execute rt-board --remote --command "alter table pending add column provider text"
--   wrangler d1 execute rt-board --remote --command "alter table pending add column sub text"
--   wrangler d1 execute rt-board --remote --command "alter table pending add column tries integer not null default 0"
--
-- 'take' 줄의 id 는 bind 하나가 아니라 b64u(sha(state + tag)) 다 — tag 는
-- /auth/cb 가 새로 내어 302 의 URL 프래그먼트로만 돌려준다(서버 로그에도
-- Referer 에도 안 남는다). state 만으로 id 를 만들면, state 를 미리 알고 있는
-- 사람(자기 bind 로 /auth/sso 를 부른 사람 — 공격자일 수 있다)이 다른 브라우저가
-- 그 링크를 눌러 완성한 로그인을 가로챌 수 있다. tag 를 더해야 '그 302 를 받은
-- 바로 그 브라우저'만 다음 단계로 넘어간다.
create table if not exists pending (
  id       text primary key,      -- challenge, 또는 SSO state, 또는 위 take id
  kind     text not null,
  who      text,
  until    integer not null,
  back     text,                  -- /auth/sso 를 부른 오리진. /auth/cb 의 302 가
                                   -- 돌아갈 곳을 여기서만 읽는다 — 사용자가 보낸
                                   -- 값으로 리다이렉트 목적지를 짓지 않는다
  provider text,                  -- kind='take' 일 때만: 이 SSO 가 어느 공급자인지
  sub      text,                  -- kind='take' 일 때만: 이미 HMAC 을 씌운 sub.
                                   -- bind+tag 를 증명하기 전엔(=/auth/take 전엔)
                                   -- user·sso 표를 건드리지 않는다 — 그래야 남의
                                   -- 동의 화면 결과를 내 계정에 조용히 엮을 수 없다
  tries    integer not null default 0   -- kind='two' 재시도 횟수. 5회에서 스스로
                                         -- 태운다 — 패스키를 취소하거나 틀려도
                                         -- 복구 코드로 갈아탈 수 있어야 해서, 그
                                         -- 사이엔 이 줄을 지우지 않는다
);
