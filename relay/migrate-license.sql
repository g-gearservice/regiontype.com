-- 라이선스 시험 표 추가 마이그레이션
--   wrangler d1 execute rt-board --remote --file migrate-license.sql
create table if not exists license_ticket (
  who  text primary key,
  id   text    not null,
  mode text    not null,
  slug text    not null,
  at   integer not null,
  dev  text    not null default 'pc',
  lang text    not null default 'ko'
);

create table if not exists license (
  who    text    not null,
  mode   text    not null,
  slug   text    not null,
  grade  text    not null,
  cpm    integer not null,
  acc    integer not null,
  misses integer not null,
  dev    text    not null default 'pc',
  lang   text    not null default 'ko',
  name   text    not null default '',
  at     integer not null,
  primary key (who, mode, slug)
);
create index if not exists license_top on license (mode, slug, grade asc, cpm desc, at asc);
create index if not exists license_who on license (who, mode);

create table if not exists license_s (
  who  text    not null,
  mode text    not null,
  plan text    not null default 'capital',
  at   integer not null,
  primary key (who, mode, plan)
);
create index if not exists license_s_at on license_s (mode, plan, at asc);
