-- 한 번만 돈다: 로그인 2단계(메일·문자 코드) 를 위한 칸과 표를 붙인다. schema.sql 의 pending 주석 참고.
-- 칸이 이미 있으면 alter 가 "duplicate column" 으로 멈춘다 — 그 줄은 건너뛴다.
--   wrangler d1 execute rt-board --remote --file migrate-two.sql
alter table pending add column mail text;
alter table pending add column sends integer not null default 0;
create table if not exists twofa (
  who   text primary key,
  mail  integer not null default 0,
  phone integer not null default 0,
  at    integer not null
);
