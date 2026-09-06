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
