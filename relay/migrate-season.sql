-- 이미 배포된 rt-board 에 경쟁전(실시간) 표를 더한다. 사람이 한 번만 실행한다:
--   wrangler d1 execute rt-board --remote --file migrate-season.sql
-- ★ rt-auth 를 이 판(match_participants·match_logs 를 지우는 계정 삭제)으로 배포하기 전에 먼저 돌린다 —
--   표가 없으면 계정 삭제 batch 가 통째로 엎어진다.
-- 시즌 줄은 따로 넣는다(출시 때 프리시즌 2주, 그 뒤 시즌 1 — 시작일은 사람이 정한다). 예:
--   insert into seasons (id, name, kind, starts_at, ends_at, reset) values (1, '프리시즌', 'pre', <ms>, <ms>, 'full');

-- 경쟁전(실시간) 판. 판 DO(compete-do.mjs)가 끝날 때 한 번 적는다. slugs 는 세트를 뽑은 코스 목록(JSON).
-- status: done · aborted(카운트다운 중 이탈 — 레이팅 없음). season_id 는 Phase 4 가 채운다
create table if not exists matches (
  id         text    primary key,
  mode       text    not null,
  ranked     integer not null,
  dev        text    not null,
  seed       integer not null,
  slugs      text    not null,
  season_id  integer,
  status     text    not null,
  reason     text,
  started_at integer,
  ended_at   integer
);
-- 판의 한 사람. who 는 로그인한 사람만(게스트는 null). result: win · loss · draw · abort.
-- quit 은 나간 쪽. mu·rd 는 판 직전·직후 Glicko 값(플래그 판은 직전만).
-- flagged: 0 없음 · 1 검토 대기 · 2 부정 확정 · 3 문제없음. flag_why 는 쉼표로 이은 이유. retro_applied 는 소급 승리 시각
create table if not exists match_participants (
  match_id  text    not null,
  pid       text    not null,
  who       text,
  bot_id    text,
  is_bot    integer not null default 0,
  result    text    not null,
  quit      integer not null default 0,
  cpm       integer,
  accuracy  integer,
  strokes   integer,
  items     integer,
  mu_before real, rd_before real, mu_after real, rd_after real,
  flagged   integer not null default 0,
  flag_why  text,
  reviewed_at integer,
  reviewed_by text,
  retro_applied integer,
  primary key (match_id, pid)
);
create index if not exists match_participants_who on match_participants (who, match_id);
create index if not exists match_participants_flagged on match_participants (flagged) where flagged <> 0;
-- 키 기록(gzip JSON: 항목별 기록 + 받은 키 묶음). 리플레이·부정행위 분석용. 플래그 없는 판은
-- 30일, 플래그 판은 검토 뒤 90일에 걷는다(compete-do.mjs 의 daily). 검토 전에는 안 지운다. 계정을 지우면 who 로 같이 간다
create table if not exists match_logs (
  match_id text    not null,
  pid      text    not null,
  who      text,
  keylog   blob    not null,
  at       integer not null,
  primary key (match_id, pid)
);
create index if not exists match_logs_at on match_logs (at);

-- 시즌. kind: pre(프리시즌) · season. reset 은 이 시즌에 들어올 때 앞 시즌 레이팅을 어떻게 넘기나:
-- full(초기값) · soft(1500 쪽으로 반, RD +100). 지금 시각이 [starts_at, ends_at) 인 줄이 없으면 랭크전이 닫힌다
create table if not exists seasons (
  id        integer primary key,
  name      text    not null,
  kind      text    not null,
  starts_at integer not null,
  ends_at   integer not null,
  reset     text    not null default 'full'
);
-- 시즌·기기별 Glicko-2 레이팅. 판 DO 가 판이 끝날 때 쓴다. last_match 는 같은 판을 두 번 반영하지 않는 열쇠다
-- (저장을 다시 시도해도 겹치지 않게)
create table if not exists player_ratings (
  who            text    not null,
  season_id      integer not null,
  dev            text    not null,
  mu             real    not null,
  rd             real    not null,
  sigma          real    not null,
  games          integer not null default 0,
  wins           integer not null default 0,
  placement_done integer not null default 0,
  last_played_at integer,
  last_match     text,
  primary key (who, season_id, dev)
);
-- 봇 CPM 표(기기별). cpm 은 기본 표(회귀 또는 BOT.cpm), mult 는 그 위에 쌓은 보정. 하루 한 번 배치가 쓴다. 줄이 없으면 BOT.cpm
create table if not exists bot_calib (
  dev        text    not null,
  rating     integer not null,
  cpm        real    not null,
  mult       real    not null default 1,   -- 쌓인 보정 배율(BOT.calib.mult 안). 쓰는 CPM = cpm × mult
  updated_at integer not null,
  primary key (dev, rating)
);
