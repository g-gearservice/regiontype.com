-- 이미 배포된 rt-board 에 1대1 경쟁전을 더한다. 사람이 한 번만 실행한다:
--   wrangler d1 execute rt-board --remote --file migrate-duel.sql
-- alter 는 두 번 돌리면 "duplicate column" 으로 멈춘다 — 그때는 이미 된 것이다.
alter table ticket add column duel text;

-- 매칭 줄. 한 사람 한 줄이고 짝이 지어지거나 나가면 지운다. at 은 처음 선 시각이다.
create table if not exists queue (
  who  text primary key,
  dev  text    not null,
  slug text    not null,
  name text    not null,
  lp   integer not null,
  at   integer not null
);
-- 맞대결 한 판. a 가 줄에 먼저 서 있던 쪽이고 b 는 짝을 지은 쪽이다. b 가 'bot' 이면
-- 봇 판(a 가 사람) — b_cpm 을 짝지을 때 정해 둬 사람이 끝내는 즉시 정산된다.
-- *_cpm: null 아직 · -1 앞뒤 안 맞는 판 · -2 탈주(이미 깎음). *_d 는 정산된 lp 변화다.
create table if not exists duel (
  id    text primary key,
  dev   text    not null,
  slug  text    not null,
  at    integer not null,             -- 시작 시각(짝이 지어진 뒤 3초)
  a     text    not null,
  b     text    not null,
  a_name text   not null default '',
  b_name text   not null default '',
  a_lp  integer not null default 0,
  b_lp  integer not null default 0,
  bot_cpm integer,
  a_hits integer, b_hits integer,
  a_cpm integer, b_cpm integer,
  a_acc integer, b_acc integer,
  a_d   integer, b_d   integer,
  done  integer not null default 0
);
