-- 한 번만 돈다: 첫 Google 로그인 때 나라·언어를 고정할 칸을 붙인다. schema.sql 의 user·pending 주석 참고.
-- 칸이 이미 있으면 alter 가 "duplicate column" 으로 멈춘다 — 그 줄은 건너뛴다.
-- 워커를 올리기 전에 먼저 돌린다 — 새 워커는 이 칸을 읽고 쓰므로, 칸이 없으면 로그인·/auth/me 가 넘어진다.
--   wrangler d1 execute rt-board --remote --file migrate-pin.sql
alter table user add column pin_country text;
alter table user add column pin_lang text;
alter table user add column pin_at integer;
alter table pending add column pin text;
