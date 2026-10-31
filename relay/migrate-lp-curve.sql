-- 디비전 lp 폭을 티어마다 두 배로 늘린다(브론즈 100 · 실버 200 · 골드 400 · 플래 800 · 다이아 1600,
-- 마스터 9300 · 그랜드마스터 20000 · 챌린저 40000 — worker.mjs 의 FLOOR).
-- 옛 lp(디비전마다 100, 마스터 1500~)를 같은 티어·디비전·그 안의 자리로 옮긴다.
-- 다이아 III 1250 → 4500 + 50×16 = 5300. 옛 마스터는 1500 을 넘은 만큼을 9300 위에 그대로 얹는다.
-- 사람이 새 worker 를 배포하기 직전에 한 번만 실행한다:
--   wrangler d1 execute rt-board --remote --file migrate-lp-curve.sql
-- 두 번 돌리면 또 늘어난다 — 돌렸는지 모르면 select max(lp) from ladder 가 1500 대 아래인지 먼저 본다.
-- 전적(played)의 delta 는 그 판에 오간 lp 라 그대로 둔다.
update ladder set lp = case lp / 100
  when 0 then lp when 1 then lp when 2 then lp
  when 3 then 300 + (lp - 300) * 2 when 4 then 500 + (lp - 400) * 2 when 5 then 700 + (lp - 500) * 2
  when 6 then 900 + (lp - 600) * 4 when 7 then 1300 + (lp - 700) * 4 when 8 then 1700 + (lp - 800) * 4
  when 9 then 2100 + (lp - 900) * 8 when 10 then 2900 + (lp - 1000) * 8 when 11 then 3700 + (lp - 1100) * 8
  when 12 then 4500 + (lp - 1200) * 16 when 13 then 6100 + (lp - 1300) * 16 when 14 then 7700 + (lp - 1400) * 16
  else 9300 + lp - 1500 end;
