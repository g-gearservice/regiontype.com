-- 한 번만 돈다: 순위표(best)를 화면 말(lang) 갈래로 옮긴다. schema.sql 의 ★ 언어 절 참고.
-- 옛 줄은 전부 'ko' 로 옮긴다 — 말을 적지 않던 때라 다른 말로 친 판도 한국어 표에 선다.
-- migrate-dev.sql 처럼 한 파일·한 요청으로 묶어 그 사이 지운 사람의 줄이 되살아나지 않게 한다.
--   wrangler d1 execute rt-board --remote --file migrate-lang.sql
alter table ticket add column lang text not null default 'ko';
alter table queue add column lang text not null default 'ko';
alter table duel add column lang text not null default 'ko';
drop index if exists best_top;
alter table best rename to best_old;
create table best (
  mode  text    not null,
  slug  text    not null,
  secs  integer not null,
  dev   text    not null,
  lang  text    not null default 'ko',
  who   text    not null,
  name  text    not null default '',
  cpm   integer not null,
  score integer not null,
  hits  integer not null,
  acc   integer not null,
  at    integer not null,
  primary key (mode, slug, secs, dev, lang, who)
);
create index best_top on best (mode, slug, secs, dev, lang, cpm desc, at asc);
insert into best (mode, slug, secs, dev, lang, who, name, cpm, score, hits, acc, at)
  select mode, slug, secs, dev, 'ko', who, name, cpm, score, hits, acc, at from best_old where who in (select id from user);
-- 사본은 ERASE 가 닿지 않는다 — 남기면 지운 사람의 기록이 남는다
drop table best_old;
