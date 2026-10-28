# PLAN-capital.md

> Capital 플랜 조건 — 지원하는 모든 나라의 수도 코스
> 검사는 `?rt=1` · `node relay/test.mjs` 둘뿐이다. 러너를 새로 세우지 않는다.

## 할 일

world.json 의 46개 나라마다 수도 안쪽 구획(구·구역·자치구)을 치는 코스 `<iso>-capital` 을 만든다.

## 까닭

플랜 타일의 Capital 은 "지원하는 모든 나라의 수도(서울, 도쿄, 파리, 워싱턴 D.C. 등)" 를 약속한다.
지금 수도 코스는 서울(`seoul-gu`) 하나뿐이고, 나머지 45개 나라는 Natural Earth admin-1(주·도)뿐이다.
끝난 모습: 45개 나라에 `data/<iso>-capital.{course,geom}.json` 이 있고 world.json 지역에 올라 있다.

## 방법

- 새 도구 `tools/build_capital.py`. 표준 라이브러리만 — Overpass(OSM)에서 수도 경계(wikidata 로 찾는다)와
  그 안의 한 단계 아래 행정 경계를 받아, 길(way)을 이어 고리를 짓고 GeoJSON 으로 쓴 뒤 `build_map.py` 에 넘긴다.
  코스 JSON 은 `build_world.py` 와 같은 꼴(`order`, `unique_aliases` 를 가져다 쓴다).
- 수도마다 (wikidata, 아래 단계 admin_level, 이름 거르개) 를 표 하나에 적는다. 단계는 조사(`survey`)로 고른다.
- 이름: 그 나라 말 `name`. 화면 제목은 OSM `name:<말>` — 지어내지 않는다. 한 줄 소개는 빈 칸.
- 받은 OSM 원본은 `/tmp/rt-geo/capital/` 에 캐시 — 다시 돌릴 때 Overpass 를 또 두드리지 않는다.
- 출처 표기: © OpenStreetMap contributors (ODbL). README 데이터 절에 한 줄.

## 마일스톤

- [x] **M1: 조사** — 45개 수도의 단계별 구획 수 표 | 검사: 표가 메모에 있다
- [x] **M2: 도구** — `build_capital.py` 가 도쿄·파리를 찍는다 | 검사: `start('jp-capital')` 가 dev 에서 판을 연다
- [x] **M3: 45개 나라** — 전부 찍고 world.json 에 올린다 | 검사: `?rt=1`
- [ ] **끝: 자체검사 통과** — 검사: `?rt=1`, `node relay/test.mjs`

## 범위

안: `tools/build_capital.py`, `data/<iso>-capital.*.json`, `data/world.json`, `README.md`(출처 한 줄)

밖: 홈 화면에서 나라·수도 고르기(홈은 아직 서울 고정 — `renderCourses`), 배포 나라 막음(`resolveCountry`),
결제·플랜 권한, 랜딩 플랜 타일 문구

## 열린 물음

- [ ] 구획이 4곳 미만이거나 수백 곳인 수도는 어느 단계를 쓰나 — 조사 결과로 수도마다 정한다
- [ ] 홍콩은 나라가 아니라 수도가 따로 없다 — 18구(= 지금 `hk-admin`)를 그대로 쓸지

## 위험

- Overpass 가 자주 502/504 를 낸다 — 재시도와 캐시로 버틴다.
- OSM 경계 고리가 덜 닫힌 곳이 있다 — 닫히지 않은 고리는 버리고 건수를 출력해 눈으로 본다.

## 메모

- 2026-10-27 Overpass 는 붐비면 200 에 빈 elements + remark 를 준다. remark 는 다시 묻고, 빈 결과는 캐시하지 않는다.
- 2026-10-28 수도 안 구획 거르기: 가운데 한 점(파리 12구가 생망데에 떨어짐) → 꼭짓점 과반(경계 위 꼭짓점이 반반으로 갈려
  가장자리 구가 빠짐) → 수도 경계와 겹치지 않는 꼭짓점의 과반. 이걸로 베이징 16·베를린 12·마드리드 21 이 맞았다.
- 2026-10-28 캐시 이름에 질의 해시를 붙였다 — 소피아 거르개를 바꿨는데 옛 부모 경계가 남아 17곳으로 찍혔다.
- 2026-10-28 런던은 시티(L6)와 자치구(L8)가 다른 단계 → 단계 자리에 '6|8'.
- 2026-10-28 39곳 완료. OSM 에 그대로 쓸 행정 경계가 없는 곳: 웰링턴·프리토리아·카이로·리야드·암스테르담·쿠알라룸푸르.
  OSM 자체에 빠진 구: 방콕 46/50, 스톡홀름 11/13.
- `build_world.py` 는 world.json 을 새로 쓴다 — 그 뒤에 `build_capital.py` 를 돌린다.
- 2026-10-28 암스테르담 stadsdelen 은 `boundary=place` `place=suburb` 경계다 → 단계 자리에 Overpass 거르개를 그대로 적게 했다. 40곳.
  남은 5곳(웰링턴·프리토리아·카이로·리야드·쿠알라룸푸르)은 OSM 에 행정·place 어느 쪽 구획 폴리곤도 없다
  (프리토리아는 'Tshwane Ward N' 번호 선거구 107개뿐).
- 2026-10-28 geoBoundaries 로 셋을 채웠다 — 단계 자리 'gb:EGY/ADM2' 꼴. 카이로 41(구 qism, 라틴 표기), 쿠알라룸푸르 6(무킴·읍,
  KL 무킴과 KL 읍이 같은 이름으로 합쳐짐), 웰링턴 5(시의회 선거구, 2017). 리야드는 OSM 구청(بلدية) 8/16 — wikidata Q97302281. 13곳 중 다섯은 경계에 1–12km 틈이 있다(허용 거리로 잇기는 시도 후 되돌림).
  프리토리아만 남았다: OSM·geoBoundaries 모두 번호 선거구뿐.
- 2026-10-28 검사: `node relay/test.mjs` 0 으로 끝. `?rt=1` self-check done, assert 실패 0(경고는 [ver]·중계기 ERR_CONNECTION_REFUSED 뿐).
  `*-capital` 44곳 course·geom·size.mjs 건수와 이름이 모두 같다. 브라우저(헤드리스, 영어 화면): eg 41·nz 5·jp 23 판이 열리고
  nz·jp 는 첫 이름+스페이스로 G.hits 1. eg 첫 칸 'Qasr Al-Nile' 은 화면 말이 한국어가 아니면 이름 속 스페이스에서 판정돼 틀린다
  (it.say 가 없어 typeForm 꼴이 안 보임. 'qasralnile ' 은 맞음, 한국어 화면은 Enter 로 맞음). 띄어쓴 이름이 있는 수도 32/44, us-admin 'New Mexico' 도 같다.
  그래서 '끝' 은 아직 안 친다.
- 2026-10-28 띄어쓴 이름: 표에 없는 칸도 it.say = typeForm(이름)(start), 그리고 tongueInput 이 맞는 칸이 아직 없고
  띄어쓴 칸의 앞머리로 이어지는 중이면 스페이스에서 판정하지 않는다 — typeForm 이 못 접는 아랍·키릴·그리스·괄호 이름
  (ae 25·ua 10·gr 7·bg 4·ie 16·br 1)도 같은 길로 고쳐진다. ?rt=1 에 순서형·자유형 assert.
- 2026-10-28 지역 제목: UI 26말 × 44곳 = 1144 칸 중 539 칸이 빈다(nb 는 거의 모두). titles() 가 OSM 다음으로 부모 경계의
  wikidata 라벨(같은 언어 코드만, mul 안 씀)로 메우게 했다 — 캐시 /tmp/rt-geo/capital/wikidata/. 클라우드에서 overpass·wikidata·
  geoboundaries 가 네트워크 정책으로 막혀 다시 찍지 못했다. world.json 은 아직 옛 제목이다.
- 2026-10-28 카이로 아랍어 이름: geoBoundaries 파일을 받을 수 없어 확인 못 함. 지어내지 않고 라틴 표기로 둔다.

---
*만든 날: 2026-10-27*
