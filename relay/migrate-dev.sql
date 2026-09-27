-- 한 번만 돈다: speed·ladder 를 기기(dev) 갈래로 옮긴다. schema.sql 머리의 ★ 기기 절 참고.
-- 명령을 나눠 치면 그 사이 옛 워커의 /forget·계정 삭제가 빈 새 표에서만 지우고,
-- 곧이어 옮겨 담기가 그 사람의 줄을 되살린다. 그래서 한 파일·한 요청으로 묶는다.
--   wrangler d1 execute rt-board --remote --file migrate-dev.sql
alter table played add column dev text not null default 'pc';
alter table ticket add column dev text not null default 'pc';
drop index if exists speed_top;
drop index if exists ladder_top;
alter table speed rename to speed_pc;
alter table ladder rename to ladder_pc;
create table speed (
  slug  text    not null,
  secs  integer not null,
  dev   text    not null default 'pc',
  who   text    not null,
  name  text    not null,
  cpm   integer not null default 0,
  score integer not null,
  hits  integer not null,
  acc   integer not null,
  at    integer not null,
  primary key (slug, secs, dev, who)
);
create index speed_top on speed (slug, secs, dev, cpm desc, at asc);
create table ladder (
  who   text    not null,
  dev   text    not null default 'pc',
  name  text    not null,
  lp    integer not null default 0,
  games integer not null default 0,
  wins  integer not null default 0,
  at    integer not null,
  primary key (who, dev)
);
create index ladder_top on ladder (dev, lp desc, at asc);
-- 옛 줄은 전부 pc 다(폰은 막혀 있었다). 이미 지운 계정의 줄은 옮기지 않는다
insert into speed (slug, secs, dev, who, name, cpm, score, hits, acc, at)
  select slug, secs, 'pc', who, name, cpm, score, hits, acc, at from speed_pc where who in (select id from user);
insert into ladder (who, dev, name, lp, games, wins, at)
  select who, 'pc', name, lp, games, wins, at from ladder_pc where who in (select id from user);
-- 사본은 ERASE 가 닿지 않는다 — 남기면 지운 사람의 기록이 남는다
drop table speed_pc;
drop table ladder_pc;
