-- 경쟁전 상대 미니맵: 맞힌 곳 지도. 이미 깔린 D1 에 한 번만 돌린다.
alter table duel add column a_set text;
alter table duel add column b_set text;
