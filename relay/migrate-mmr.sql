-- 이미 배포된 rt-board 에 숨은 실력(mmr)·판마다 승패(win)를 더하고 시즌을 새로 연다.
-- 사람이 한 번만 실행한다:
--   wrangler d1 execute rt-board --remote --file migrate-mmr.sql
-- alter 는 두 번 돌리면 "duplicate column" 으로 멈춘다 — 그때는 이미 된 것이다.
alter table ladder add column mmr real;
alter table played add column win real;

-- 옛 lp 는 배치 5판 연승만으로 골드가 되던 셈이라 새 디비전 자리와 맞지 않는다.
-- 모두 배치부터 다시 친다. 전적(played)과 코스별 최고 기록(best)은 그대로 둔다.
update ladder set lp = 0, games = 0, wins = 0, mmr = null;
-- 옛 경쟁전 줄의 승패를 lp 부호로 메운다(배치 판도 +lp 였다)
update played set win = case when delta > 0 then 1 when delta < 0 then 0 else .5 end
 where mode = 'ranked' and win is null and delta is not null;
