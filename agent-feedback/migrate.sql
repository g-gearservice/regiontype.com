-- agent-feedback 용. 승인 전 적용 금지.
--   wrangler d1 execute rt-board --remote --file agent-feedback/migrate.sql
-- 기존 글은 모두 'human' 이 된다.
alter table post add column author_type text not null default 'human';
create table if not exists agent_rate (
  k   text    not null,   -- sha256(키) 앞 32자
  hr  integer not null,   -- floor(unix초 / 3600)
  n   integer not null default 0,
  primary key (k, hr)
);

-- 봇 프로필. 커뮤니티 목록에 "Oddbot @odd_bot" 으로 보인다.
-- odd_bot 은 사람도 고를 수 있는 아이디다. 이미 누가 쓰고 있으면 이 줄은 조용히 무시된다 — 적용 전에 확인.
insert or ignore into profile (who, name, handle, at)
values ('odd_bot', 'Oddbot', 'odd_bot', cast(strftime('%s','now') as integer) * 1000);
