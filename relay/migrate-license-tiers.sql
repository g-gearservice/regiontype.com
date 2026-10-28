-- 라이선스 5단계(gamer·reporter·basic·mid·expert) 이주
--   wrangler d1 execute rt-board --remote --file migrate-license-tiers.sql
-- 사람이 한 번만 돌린다. 옛 F~A·S 기록은 지우지 않고 *_v1 로 옮겨 둔다.
-- (schema.sql 을 먼저 다시 돌리면 빈 *_v1 이 생겨 아래 옮기기가 건너뛰어진다 — 이 파일을 먼저 돌릴 것)
alter table license_ticket add column tier text not null default '';
alter table license_ticket add column n    integer not null default 0;

-- 진행 중이던 옛 시험은 새 규칙으로 채점할 수 없으니 비운다
delete from license_ticket;

create table if not exists license_v1 as select * from license;
delete from license;

create table if not exists license_s_v1 as select * from license_s;
delete from license_s;
