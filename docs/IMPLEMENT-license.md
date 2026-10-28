# IMPLEMENT-license.md

> 라이선스 시험 · 시작하기 분기 · 순위 4탭 구현 기록.

## 할 일 참조

docs/PLAN-license.md: 시작하기 분기 UI 및 Long Press 시험 진입, 라이선스 체계, 순위 4칸 개편.

---

## 기록

### 2026-10-27 — 1단계: 시작하기 분기와 꾹 누르기 UI 구현 완료

**한 일:**
- `index.html`: `#navPlay` 상단에 열리는 `#modePick` 팝오버 (`role="dialog"`) 추가. 내부 `#modeNormal`, `#modeRanked`, `#examToggle`, `#modeHint`, `#modeNote` 마크업 작성. 라이선스 시험 진입 확인 창 `#examGate` (`<dialog>`) 및 등급표 마크업 추가.
- `app.js`: `#navPlay` 클릭 시 모드 분기 처리를 위해 일반전 실행 함수 `playNormal()` 분리 및 등록.
- `ranked.js`:
  - 기존 0.6초 `#navPlay` 꾹 누르기(`wirePlayHold`) 제거 및 `#modePick` 관리 로직(`wireModePick`) 구현.
  - 범용 1.2초(`EXAM_HOLD_MS = 1200`) 꾹 누르기 함수 `wireHold(btn, onTap, onHold)` 작성: `pointerdown`, `pointerup/leave/cancel/blur`, 키보드 `Space`/`Enter` 누르고 있기 지원, 꾹 누른 뒤 뒤따르는 `click` 무효화.
  - `prefers-reduced-motion: reduce` 및 `data-motion="off"` 환경 지원: 차오르는 애니메이션 대신 `data-left`로 남은 초 카운트다운 표시.
  - 라이선스 시험 토글 (`#examToggle`) 상태 처리 (`aria-pressed`). 토글 켜짐 시 짧게 눌러도 시험 확인 창 열림.
  - 시험 진입 게이트 (`openExam`): 비로그인 시 로그인 화면 유도, 한국어 외 언어 시 안내 표시, `#examGate` 모달에 코스명·120초·A~F 등급표 표시.
  - `wireStart`: `#navPlay` 클릭 시 고르기 판 열기/닫기 처리.
  - `rt=1` 자체검사 단언 추가 (`#modePick`, `#modeNormal`, `#modeRanked`, `#examToggle`, `#examGate`, `#examRows`, `EXAM_GRADES`).
- `style.css`: `#modePick`, `.mode-row`, `.mode-btn`, `.is-holding` 게이지 애니메이션, `.mode-exam`, `.mode-hint`, `.mode-note`, `#modePick.is-exam`, `#examGate`, `.exam-grades`, `.exam-badge` 스타일 작성.
- `data/i18n.json`: `modePick`, `examToggle`, `examHoldHint`, `examKoOnly`, `examTitle`, `examLede`, `examGrade`, `examMiss`, `examStart`, `examSoon`, `examLeft`, `rkHold`, `tourRanked` 26개 언어 번역 등록.

**결정:**
- Popover API(`showPopover`, `hidePopover`)를 사용하여 top-layer에 안전하게 띄우고 light dismiss(바깥 누르기, Esc) 지원.
- 버튼 꾹 누르기는 CSS 커스텀 프로퍼티 `--hold-ms`와 `scaleX` 애니메이션으로 부드럽게 채우고, 모션 감소 설정 시 숫자로 남은 시간 표시.
- 색상 외에도 테두리 스타일(점선/실선)과 `✓`/`○` 기호로 시험 토글 상태 명확화.

**검사:**
- `node --check app.js ranked.js relay/worker.mjs`: 통과
- `node relay/test.mjs`: 통과

**다음:**
- 2단계: 시험 모드 판과 브라우저 판정 (`start` 4번째 인자 또는 `exam` 객체, 120초 고정, HUD `#examTag`, `#result` 등급 배지).

---

### 2026-10-27 — 2단계: 시험 모드 판과 브라우저 판정 구현 완료

**한 일:**
- `relay/license.mjs`: 공용 라이선스 채점 모듈 작성. `EXAM_GRADES` (A~F), `gradeOf({ done, acc, cpm, misses })`, `nextConditionOf({ done, acc, cpm, misses, grade })` export.
- `app.js`:
  - 브라우저용 `EXAM_GRADES`, `gradeOf`, `nextConditionOf` 내장.
  - `start(slug, only, rk, exam)`: 4번째 인자 `exam` 지원. 120초 고정(`secs = 120`), 코스 전체 대상(`only = null`), `G.exam` 보관, `#play`에 `is-exam` 토글 및 `#examTag` 노출.
  - `finish()`: `G.exam`인 경우 캐주얼 최고 기록(`localStorage`) 저장 방지, `#rBest` 갱신 방지, `#rBoard` 및 `#rLp` 숨김.
  - 오타 수(`misses = Math.max(0, G.tries - G.hits)`), 완주 여부(`done = G.hits === G.items.length`) 계산 후 `#rExam` 카드에 등급 배지(`data-grade`), 완주 상태, 세부 기록(`정확도 · CPM · 오타`), 다음 등급 달성 조건 표시.
  - `board()`: `if (!G || G.exam) return;`로 시험 판일 때 캐주얼 순위판 조회 차단.
  - `?rt=1` 블록에 라이선스 등급 판정 경계값 검사 8종 추가.
- `ranked.js`:
  - `#examGo` 클릭 시 `start(rankedSlug(), null, null, { mode, id })`로 시험 게임 시작.
  - `wireStart`: `#again` 클릭 시 `G.exam`이 있으면 동일한 시험 모드로 재시작.
  - `rt-finish` 이벤트 핸들러에서 `g.exam`일 때 얼리 리턴하여 `/played` 및 `/ranked/end` 전송 완전 차단.
- `index.html`:
  - `#play .stat-row`에 `#examTag` HUD 배지 추가.
  - `#result .scores`에 `#rExam` 결과 카드 추가 (`#rExamBadge`, `#rExamTitle`, `#rExamDone`, `#rExamStats`, `#rExamNext`).
- `style.css`:
  - `.exam-tag` HUD 배지 스타일 및 경쟁전 시험 모드 시의 강조 스타일 추가.
  - `#result` 내 `.exam-res` 카드, `.exam-badge` 등급별 테두리/배경/글자색 토큰 스타일 추가.
- `data/i18n.json`:
  - 26개 언어에 2단계 관련 키 추가 (`examTab`, `examGradeNamed`, `examDone`, `examNotDone`, `examNeedDone`, `examNeedAcc`, `examNeedCpm`, `examNeedMiss`, `examMaxGrade`, `examMissCnt`, `examNone`).
- `relay/test.mjs`:
  - `relay/license.mjs` 검사 블록 추가: 등급 경계값, 완주 미달, 오타 11회 이상, 다음 등급 필요 조건 및 `app.js`와의 일치 여부 단언.

**검사:**
- `node --check app.js ranked.js relay/license.mjs relay/test.mjs`: 통과
- `node relay/test.mjs`: 통과 (모든 자체검사 및 `license self-check done` 정상)

**다음:**
- 3단계: Relay D1 저장과 S 등급 산정 (`relay/license-store.mjs` 또는 `worker.mjs` 확장: 시험 시작 토큰 발급, 시험 완료 기록, 수도 플랜 26개 코스 A 달성 시 S 등급 계산, `/license/*` 엔드포인트).

---

### 2026-10-27 — 3단계: Relay D1 저장과 S 등급 산정 구현 완료

**한 일:**
- `tools/build_plans.py`: `data/world.json`에서 서울 26개 코스(`seoul-gu` + 25개 구-동 코스)를 읽어 `relay/plans.mjs`를 생성하는 도구 작성 및 실행.
- `relay/plans.mjs`: `CAPITAL_COURSES` 26개 코스 상수 생성.
- `relay/schema.sql` 및 `relay/migrate-license.sql`:
  - `license_ticket`: 진행 중인 시험 표 (`who`, `id`, `mode`, `slug`, `dev`, `lang`, `at`).
  - `license`: 코스별 최고 기록 (`who`, `mode`, `slug`, `grade`, `cpm`, `acc`, `misses`, `dev`, `lang`, `name`, `at`).
  - `license_s`: 수도 플랜 26개 코스 전수 A 달성 시 자동 수여되는 S 등급 기록 (`who`, `mode`, `plan`, `at`).
- `relay/entry.mjs`: `OWN.board`에 `'/license/'` 라우팅 등록.
- `relay/license.mjs`: `GRADE_WEIGHT` (A: 6 ~ F: 1) 가중치 상수 추가.
- `relay/worker.mjs`:
  - `ERASE` 배열에 `license_ticket`, `license`, `license_s` 추가하여 계정 삭제 시 개인 데이터 완전 삭제 보장.
  - `POST /license/start`: 120초 시험 일회용 티켓 발급. 코스 유효성 및 로그인 검증.
  - `POST /license/end`: 소요 시간 검증(5초~135초), 완주 여부 및 오타 수 계산 후 등급 산정. 기존 기록보다 높거나 동일 등급에서 CPM이 높을 때만 갱신.
  - Capital 26개 코스 A 달성 시 `license_s`에 기록 추가 및 `sAwarded: true` 반환.
  - `GET /license/me`: 로그인 사용자의 모드별 라이선스 취득 현황 및 Capital S 등급 달성 상태 조회.
  - `GET /license/top`: S 등급 달성자 명단 및 코스별 상위 라이선스 기록 조회.
- `ranked.js`:
  - `#examGo` 클릭 시 `/license/start`를 호출하여 티켓을 발급받아 시험 시작.
  - `rt-finish` 이벤트에서 시험 게임 완료 시 `/license/end`로 결과를 안전하게 전송.
  - `#again` 클릭 시 다시 시험 확인 모달을 열어 재도전 지원.
- `relay/test.mjs`:
  - `node:sqlite` 인메모리 DB 기반 종합 통합 검사 작성:
    1. 비로그인 접근 차단 (401)
    2. 미등록 코스 차단 (400)
    3. 정상 티켓 발급 (201, 120초)
    4. 5초 미만 소요 거절 (400) 및 소비된 티켓 재사용 차단 (409)
    5. 완주 미달 시 탈락 처리 (`done: false`, `grade: null`)
    6. A 등급 취득 및 `license` 테이블 저장 (`isBest: true`)
    7. 하위 등급 달성 시 기존 기록 유지 (`isBest: false`)
    8. 동일 등급 내 CPM 갱신 (`isBest: true`)
    9. 수도 플랜 26개 코스 전수 A 달성 시 `license_s` S 등급 수여 (`sAwarded: true`, `capitalA: 26`)
    10. `/license/me` 내역 조회 및 `/license/top` 순위 조회 검증.

**검사:**
- `node --check app.js ranked.js relay/license.mjs relay/plans.mjs relay/worker.mjs relay/test.mjs`: 통과
- `node relay/test.mjs`: 통과 (`license D1 store and Capital S self-check done` 정상)

**다음:**
- 4단계: 순위 화면(#ranking) 4칸 재편 (경쟁전 일반/라이선스, 일반전 일반/라이선스 하위 탭 및 키보드 조작).

---

### 2026-10-27 — 4단계: 순위 덮개 4칸 및 키보드 접근성 구현 완료

**한 일:**
- `index.html`:
  - 순위 대화상자(`#ranking`)의 상위 탭(`[경쟁전]`, `[일반전]`) 하위에 모드별 2칸 서브탭 구조 추가:
    - 경쟁전: `[일반]` (`#rkTabRankedCasual`), `[라이선스]` (`#rkTabRankedLicense`)
    - 일반전: `[일반]` (`#rkTabNormalCasual`), `[라이선스]` (`#rkTabNormalLicense`)
  - 각 탭 패널(`#rkRankedCasual`, `#rkRankedLicense`, `#rkNormalCasual`, `#rkNormalLicense`) 마크업 배치.
  - 라이선스 패널 내부에 수도 플랜 S 달성자 명단(`#rankedSHolders`, `#normalSHolders`) 및 코스별 라이선스 상위 순위표(`#rankedLicenseBests`, `#normalLicenseBests`) 컨테이너 추가.
- `style.css`:
  - 모바일(`pointer: coarse` 또는 좁은 화면)에서 4단 가로 탭이 쪼그라들거나 줄바꿈되는 문제를 막기 위해 2단계 탭 계층(상위 탭 2개 + 하위 탭 2개) 구조 스타일(`.sub-tabs`, `.sub-tabs [role="tab"]`, `.pg-subpanel`) 적용.
  - S 등급 배지(`.exam-badge[data-grade="S"]`)의 황금빛 테두리 및 텍스트 스타일 정의.
- `data/i18n.json`:
  - 26개 언어 전체에 4단계 키 추가 (`subCasual`, `subLicense`, `capitalS`, `sEmpty`, `licenseBests`, `subTabGroup`).
- `ranked.js`:
  - 범용 WAI-ARIA 탭 키보드 조작 헬퍼 `wireTabGroup(tabs, panels, onChange)` 구현:
    - 좌/우 화살표(`ArrowLeft`, `ArrowRight`), `Home`, `End` 키를 통한 탭 전환 및 포커스 이동 지원.
    - `aria-selected`, `tabindex` (선택된 탭 0, 비선택 -1), `hidden` 속성 동기화.
    - 상위 탭 및 하위 서브탭 그룹에 각각 적용.
  - `fillRanking`: 순위판 열람 시 현재 선택된 탭 및 서브탭에 맞춰 적절한 순위 데이터(래더, 캐주얼 개인 최고, 수도 플랜 S 달성자 및 코스별 라이선스 순위표)를 온디맨드로 조회 및 렌더링.
  - `fillLicense`: `/license/top` API를 호출하여 S 달성자 카드와 코스별 라이선스 순위표(순위, 등급 배지, 닉네임, CPM, 정확도, 오타) 표시. 본인 기록일 경우 `me` 클래스 부여.
  - `?rt=1` 자체검사 단언 추가: 서브탭 및 순위 컨테이너 요소 존재 확인.
- `app.js` & `relay/worker.mjs`:
  - 순위 조회 시 세션 확인 후 본인 기록 식별 플래그 전달.
- `app.js` & `style.css`:
  - **라이선스 시험 모드 구역(구, 동) 명 및 힌트 완전 은닉**:
    - 지도 타일/텍스트: `#play.is-exam #map .tiles`, `#play.is-exam #map text` 숨김 처리 및 `aim()` 라벨 비활성화.
    - 큐: `#play.is-exam .q-side` 숨김 및 `paintQueue()`에서 앞/뒤 구역 명 노출 차단.
    - 타이핑 박스: `setTarget()`에서 `G.exam` 시 `.typing.hide` 강제 적용(아직 치지 않은 글자는 빈 블록으로 처리하여 지명 노출 차단).
    - 설명 및 팁: `say()`에서 `G.exam` 시 본문 소개(`#fact span`) 표시 차단 및 `#play.is-exam .fact` 숨김.
    - 가상 키보드: `kbHint()`에서 `G.exam` 시 다음 칠 자판 힌트 비활성화.

**검사:**
- `node --check app.js ranked.js relay/license.mjs relay/plans.mjs relay/worker.mjs relay/test.mjs`: 통과
- `node relay/test.mjs`: 통과
- `?rt=1`: 통과 (모든 DOM 및 등급 경계값 단언 검증)
