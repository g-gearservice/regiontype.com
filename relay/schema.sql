-- 순위표. 한 판은 (코스, 제한 시간) 이고, 그 안에서 한 사람이 한 줄이다.
--   wrangler d1 execute rt-board --remote --file schema.sql
--
-- 줄의 주인은 이름이 아니라 who 다 — 브라우저가 한 번 만들어 두는 난수.
-- 이름으로 주인을 삼으면 남의 이름에 높은 점수를 박아 그 사람이 영영
-- 자기 기록을 못 올리게 만들 수 있다. 이름은 화면에 거는 표시일 뿐이다.
--
-- ★ 순위는 점수가 아니라 타자 속도(cpm, 분당 글자 수)로 세운다. 이미 board 표가
-- 있는 DB 에 이 파일을 다시 적용하는 경우 `create table if not exists` 는 아무것도
-- 하지 않는다 — cpm 칸이 안 붙고, 그 순간부터 /score 의 insert 가 "no column named
-- cpm" 으로 터진다. board 에는 지킬 기록이 있으니 표를 지우지 말고 칸만 더한다
-- (사람이 직접 실행한다. 옛 줄의 cpm 은 0 이라 새 기록이 올라오면 갱신된다):
--
--   wrangler d1 execute rt-board --remote --command "alter table board add column cpm integer not null default 0"
--   wrangler d1 execute rt-board --remote --command "drop index if exists board_top"
--   wrangler d1 execute rt-board --remote --file schema.sql
create table if not exists board (
  slug  text    not null,
  secs  integer not null,
  who   text    not null,
  name  text    not null,
  cpm   integer not null default 0,   -- 분당 글자 수. 화면의 WPM 은 이걸 다섯으로 나눈 것
  score integer not null,
  hits  integer not null,
  acc   integer not null,
  at    integer not null,
  primary key (slug, secs, who)
);
-- 판마다 상위 몇 줄만 읽는다. 같은 속도면 먼저 올린 쪽이 앞이다.
create index if not exists board_top on board (slug, secs, cpm desc, at asc);

-- 타수 순위표. board 와 칸이 같다 — cpm 이 한글을 음절이 아니라 자모(두벌식 키 수)로
-- 센 분당 타수라는 것만 다르다. 옛 board 의 한국어 기록은 약 2.5배 낮은 단위라 섞지
-- 않고 여기서 새로 시작한다. board 는 읽지 않지만 /forget·계정 삭제는 계속 지운다.
-- 이미 있는 DB 에는 이 파일을 다시 적용하면 표가 더해진다(사람이 실행한다):
--   wrangler d1 execute rt-board --remote --file schema.sql
create table if not exists speed (
  slug  text    not null,
  secs  integer not null,
  who   text    not null,
  name  text    not null,
  cpm   integer not null default 0,   -- 분당 타수(한글은 자모). 화면의 WPM 은 이걸 다섯으로 나눈 것
  score integer not null,
  hits  integer not null,
  acc   integer not null,
  at    integer not null,
  primary key (slug, secs, who)
);
create index if not exists speed_top on speed (slug, secs, cpm desc, at asc);

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

-- ── 경쟁전 · 전적 ──────────────────────────────────────────
-- 경쟁전 사다리. 한 사람이 한 줄이고 lp 는 0 에서 시작해 판마다 오르내린다.
-- 티어는 따로 적지 않는다 — lp 100 마다 한 단계(worker.mjs 의 STEP)라 읽는 쪽이 셈한다.
-- name 은 순위표(board)와 같은 규칙으로 다듬은 공개 표시다.
create table if not exists ladder (
  who   text primary key,
  name  text    not null,
  lp    integer not null default 0,
  games integer not null default 0,
  wins  integer not null default 0,
  at    integer not null
);
create index if not exists ladder_top on ladder (lp desc, at asc);

-- 판 기록(전적). 경쟁전·일반전 모두. 사람마다 최근 50판만 남긴다.
-- delta 는 경쟁전에서 오르내린 lp 다(일반전은 null). 탈주는 score 0 · delta 음수 줄이다.
create table if not exists played (
  who   text    not null,
  mode  text    not null,         -- 'ranked' | 'normal'
  slug  text    not null,
  secs  integer not null,
  cpm   integer not null default 0,   -- 그 판의 타자 속도. 기록 페이지가 이걸 보인다
  score integer not null,
  hits  integer not null,
  acc   integer not null,
  delta integer,
  at    integer not null
);
create index if not exists played_who on played (who, at desc);

-- 진행 중인 경쟁전. 한 사람 한 장. 끝내지 않고 새로 시작하면 그 판은 탈주로 친다 —
-- 지는 판을 창을 닫아 지우는 길을 막는다.
create table if not exists ticket (
  who  text primary key,
  id   text    not null,
  slug text    not null,
  at   integer not null
);

-- ── 프로필 ────────────────────────────────────────────────
-- 로그인한 사람을 따라다니는 값. 기기를 바꿔도 같은 닉네임·소개·캐릭터가 온다.
-- (브라우저의 localStorage 는 그 브라우저에서만 산다 — 여기가 원본이다.)
-- name 은 순위표(board)·사다리(ladder)에 걸리는 것과 같은 표시라, 고치면
-- worker.mjs 의 authProfile 이 그 두 표의 name 도 같이 고친다.
-- face 는 캐릭터 세 값을 'shape,expression,colour' 로 이어 적은 것이다 —
-- 어떤 말이 있는지는 화면(account.js)이 알고, 서버는 모양만 본다.
--
-- handle 은 사람이 고르는 공개 아이디다(a-z 0-9 _ , 3‥16자). name 과 달리
-- 겹치지 않는다 — 아래 부분 인덱스가 막는다. 아직 안 정한 사람은 빈 값이고,
-- 빈 값은 여럿일 수 있어야 하므로 인덱스에서 뺀다(sqlite 의 unique 는 빈
-- 문자열을 서로 같다고 본다 — null 과 다르다).
-- botname 은 그록 봇 캐릭터의 이름이고, push·shut 은 가입 안내(welcome/)에서
-- 고르는 두 값이다 — 새소식 알림을 받을지, 계정을 비공개로 둘지.
-- ★ who 를 가진 표를 새로 만들면 worker.mjs 의 ERASE 에도 더한다. 빠뜨리면 계정을
-- 지워도 그 줄만 남아 '지웠다'는 말이 거짓이 된다 — relay/test.mjs 가 이 파일을 읽어
-- 대조하므로 잊으면 검사가 먼저 깨진다.
create table if not exists profile (
  who  text primary key,
  name text    not null default '',
  bio  text    not null default '',   -- 한 줄 소개. 60자
  face text    not null default '',
  lang text    not null default 'auto',
  at   integer not null,
  handle  text    not null default '',   -- 공개 아이디. a-z 0-9 _ , 3‥16자
  botname text    not null default '',   -- 캐릭터 이름. 12자
  push    integer not null default 0,    -- 새소식 알림을 받겠다고 했는지
  shut    integer not null default 0     -- 계정 비공개
);

-- ★ 이미 profile 표가 있는 DB 에 이 파일을 다시 적용하는 경우:
-- `create table if not exists` 는 아무것도 하지 않는다 — 위의 네 칸이 안 붙고,
-- 그 순간부터 /auth/profile 의 insert 가 "no column named handle" 로 터진다.
-- profile 에는 지킬 값이 있으니 표를 지우지 말고 칸만 더한다(사람이 직접 실행한다):
--
--   wrangler d1 execute rt-board --remote --command "alter table profile add column handle text not null default ''"
--   wrangler d1 execute rt-board --remote --command "alter table profile add column botname text not null default ''"
--   wrangler d1 execute rt-board --remote --command "alter table profile add column push integer not null default 0"
--   wrangler d1 execute rt-board --remote --command "alter table profile add column shut integer not null default 0"
--   wrangler d1 execute rt-board --remote --file schema.sql
create unique index if not exists profile_handle on profile (handle) where handle <> '';

-- ── 처음 온 사람 ───────────────────────────────────────────
-- 가입 직후 한 번 묻는 설문(welcome/). 한 사람 한 줄이고, 이 줄이 있다는 것이
-- 곧 "가입 안내를 마쳤다" 는 표시다 — /auth/me 의 intro 가 그것을 알린다.
-- platform·medium 은 화면(welcome/welcome.js)이 쥔 목록의 slug 고 nps 는 0‥10 이다.
-- 고른 것 말고는 아무것도 담지 않는다 — 자유 입력 칸이 없다.
create table if not exists intro (
  who      text primary key,
  platform text    not null default '',
  medium   text    not null default '',
  nps      integer,
  at       integer not null
);

-- ── 커뮤니티 ──────────────────────────────────────────────
-- 사이트 안의 게시판(community/). 읽기는 누구나, 쓰기는 로그인하고 닉네임을 정한
-- 사람만. 글쓴이 이름은 여기 적지 않는다 — 읽을 때 profile 과 이어 붙인다. 그래야
-- 닉네임을 바꾸면 옛 글에도 따라가고, 비공개(shut)로 돌리면 옛 글도 가려진다.
-- 공감·신고·댓글 수는 칸으로 들고 있지 않고 읽을 때 센다 — 계정을 지워 mark·reply
-- 줄이 빠져도 어긋날 숫자가 없다. 신고가 셋 쌓이면 읽는 쿼리가 그 글을 뺀다.
--   wrangler d1 execute rt-board --remote --file schema.sql   (표가 더해질 뿐이다)
create table if not exists post (
  id    integer primary key autoincrement,
  who   text    not null,
  tag   text    not null,             -- 'brag' | 'ask' | 'idea' | 'chat'
  title text    not null,             -- 60자
  body  text    not null,             -- 2000자, 줄바꿈 유지
  at    integer not null
);
create index if not exists post_tag on post (tag, id desc);
create index if not exists post_who on post (who);

create table if not exists reply (
  id    integer primary key autoincrement,
  post  integer not null,
  who   text    not null,
  body  text    not null,             -- 500자
  at    integer not null
);
create index if not exists reply_post on reply (post, id);
create index if not exists reply_who on reply (who);

-- 공감(up)과 신고(flag). 한 사람이 한 대상에 한 번. target 은 'p12'(글)·'r40'(댓글)
create table if not exists mark (
  who    text    not null,
  kind   text    not null,
  target text    not null,
  at     integer not null,
  primary key (who, kind, target)
);
create index if not exists mark_target on mark (kind, target);
