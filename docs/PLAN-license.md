# PLAN-license.md

> 라이선스 시험 · 시작하기 분기 · 순위 4탭 계획서
> 검사는 `?rt=1` · `node relay/test.mjs` 둘뿐이다. 러너를 새로 세우지 않는다.

## 할 일

시작하기 버튼 클릭 시 [일반전] / [경쟁전] 분기 및 Long Press(1.2초)를 통한 라이선스(시험) 모드 진입, 코스별 F~A 등급 및 Capital 전 코스 S 자동 부여 평가 체계, 순위표 4칸(경쟁전 일반/라이선스, 일반전 일반/라이선스) 재편.

## 까닭

기존에는 시작하기(#navPlay)를 0.6초 꾹 눌러 경쟁전을 켰으나, 사용자가 일반전과 경쟁전을 명확히 선택하고 각 모드별 라이선스 시험 모드로 진입할 수 있도록 개선하기 위함.

## 방법

정적 사이트(Vanilla JS, CSS, Cloudflare Worker D1).
- 1단계: 시작하기(#navPlay) 클릭 시 `#modePick` 팝오버를 띄우고, 일반전/경쟁전 단추 제공. 짧게 누르면 즉시 시작, 1.2초 꾹 누르면 라이선스 시험 모드 진입 확인 창(#examGate) 표시. 접근성 대안으로 토글 단추 제공.
- 2단계: 시험 모드 120초 판과 브라우저 판정 (`gradeOf`), 결과 화면 배지 및 조건 표시.
- 3단계: relay D1 라이선스 저장 (`license`, `license_s`, `exam`), 서버 재판정 및 S 자동 부여 API.
- 4단계: 순위 화면(#ranking) 경쟁전/일반전 탭 내 하위 2탭(일반, 라이선스) 4칸 재편.

## 마일스톤

- [x] **M1: 시작하기 분기와 꾹 누르기 (UI만, 서버 변경 없음)** — `#modePick` 팝오버, 1.2초 꾹 누르기 게이지 및 키보드/터치 지원, 시험 토글 대안, `#examGate` 진입 확인 창, i18n 26개 언어 반영 | 검사: `node --check`, `node relay/test.mjs`
- [x] **M2: 시험 모드 판과 브라우저 판정** — 120초 고정 시험 판, `gradeOf` 판정, `#result` 등급 배지 | 검사: `?rt=1` 경계값 단언
- [x] **M3: 저장, API, S 자동 부여 (relay)** — `tools/build_plans.py`, D1 스키마 및 마이그레이션 SQL, `/license/*` API | 검사: `node relay/test.mjs`
- [x] **M4: 순위 덮개 4칸** — 경쟁전/일반전 하위 탭 분리, 키보드 Tab/화살표 조작 | 검사: `?rt=1`, `node relay/test.mjs`
- [x] **끝: 자체검사 통과** — 검사: `?rt=1`, `node relay/test.mjs`

## 범위

안:
- `index.html`, `style.css`, `app.js`, `ranked.js`, `data/i18n.json`
- `relay/worker.mjs`, `relay/license.mjs`, `relay/plans.mjs`, `relay/schema.sql`, `relay/migrate-license.sql`, `relay/test.mjs`

밖:
- `mimi/`, `landing/`, `relay/compete*.mjs`, Pages 설정, .env 및 시크릿

## 열린 물음

1. 오타 = 틀린 확정 수(`tries - hits`) 기준 유지 여부 (키 단위 `bad` 여부)
2. 시험 시간 120초 고정 vs 코스 크기별 가변 여부
3. Capital S 조건에 `seoul-gu`(구 코스) 포함 26개 vs 동 25개만 여부
4. 라이선스 PC / 모바일 분리 여부
5. 일반전 순위 '누적 연습량' 추가 여부
6. 하루 시험 횟수 상한 도입 여부

---
*만든 날: 2026-10-27*
