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
create table if not exists user (
  id   text primary key,          -- 난수 16바이트 hex. 사람을 가리키는 유일한 값이다
  mail text unique,               -- 메일 링크로 들어온 사람만 있다. 패스키만 쓰면 없다
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
-- 로그인 도중의 일회용 챌린지. 서버가 낸 것인지 확인해야 하므로 남겨 둔다.
create table if not exists pending (
  id    text primary key,         -- challenge (base64url)
  kind  text not null,            -- 'reg' | 'log'
  who   text,
  until integer not null
);
