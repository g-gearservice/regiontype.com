# regiontype.com

나라의 지명을 치는 타자연습. **정적 파일뿐이다** — 빌드 단계도, 패키지 매니저도,
프레임워크도 없다. 새로 들이지 않는다.

    python3 -m http.server 3000     실행
    ?rt=1                           판정 엔진 자체검사 (콘솔)
    node relay/test.mjs             중계기 검사

검사는 이 둘뿐이다. 러너를 새로 세우지 않는다.

## 손대기 전에 알 것

- `app.js` 단일 파일. 핵심은 `matchInput()` 하나다. 약칭은 그 약칭으로 이어질
  미점령 항목이 자기 자신뿐일 때만 확정된다. 스페이스를 `keydown` 으로 가로채면
  IME 조합 확정이 깨지므로 그렇게 하지 않는다. 이름에 띄어쓰기가 있으면 Enter 로
  확정한다.
- 화면 말이 한국어가 아니면 `matchTongue()` 가 판다 — 칸에 보이는 그 말의 이름을 말마다
  '열쇠'(ja 히라가나, zh 병음, 그 밖은 접은 로마자·키릴)로 접어 견준다. 읽기는
  `data/kr-read.<말>.json`(`tools/build_kr_read.py`). 한국어처럼 스페이스(또는 Enter)로 확정한다.
- `style.css` 단일 파일. 색·간격은 위쪽 커스텀 프로퍼티에서 딴다.
- `data/*.json` 은 대부분 `tools/*.py` 가 찍은 생성물이다. 손으로 고치지 말고 도구를 고친다.
  예외: `data/i18n.json` 화면 말, `data/changes.json` 바뀐 것 목록,
  강서구 코스의 한 줄 소개(`build_dong.py` 의 `KEEP`), 그 소개의 번역(`data/kr-intro.<말>.json`,
  원문을 고치면 같이 고친다). 한 줄 소개를 지어내지 않는다.
- 에셋을 새로 넣으면 `asset()` 을 태워 `?v=` 가 붙게 한다.

## 버전과 배포

릴리스 이름은 시맨틱 버저닝(SemVer) `vMajor.Minor.Patch` 다. `v1.0.0` 부터 이 규칙이다.
`app.js` 의 `REL` 에 적고, 설정 화면 버전 줄과 업데이트 알림이 거기서 읽는다.

- **Major** — 하위 호환이 깨지는 대규모 구조 개편, 중계기 API 변경. 올리면 Minor·Patch 는 0 (`1.5.2 → 2.0.0`).
- **Minor** — 호환을 지키며 더한 새 기능. 올리면 Patch 는 0 (`1.4.2 → 1.5.0`).
- **Patch** — 호환을 지키는 버그 수정·긴급 패치. 1 씩 (`1.5.0 → 1.5.1`).

어느 자리를 올릴지는 사람이 고른다. 모르면 묻는다.

`app.js` 의 `VER` 은 릴리스와 따로 가는 빌드 번호다. 개발·에이전트·로컬에서만 쓴다 —
보안상 배포 화면에 드러내지 않는다(설정 버전 줄 괄호는 `isDev()` 에서만 보인다).
고칠 때마다 `0.01` 씩 올린다(`1.45 → 1.46`). `?v=` 는 줄이지 않는다.

**GitHub Pages 소스는 `main` 이다.** 릴리스마다 `static-A.B.C` 브랜치를 새로 파
거기서 일하고(`static-1.0.0`), 끝나면 `main` 에 머지해 배포한다. 머지가 된 뒤에야
옛 브랜치를 지운다.

**봇이 직접 PR 을 올릴 때는 `agent-static-0.0.N` 브랜치를 쓴다.** N 은 봇이 직접
올린 PR 의 순번이다 — 지금까지 열린 `agent-static-*` PR 수에 1을 더한다
(`gh pr list --state all --limit 1000 --json headRefName -q '.[].headRefName' | grep -c '^agent-static-'`).
VER 과 무관하게 0.0 고정이고 N 만 늘린다. 사람이 고른 `static-A.B.C` 와 섞지 않는다.

**Pages 설정에는 손대지 않는다.** 소스 브랜치·도메인 따위는 사람이 만진다 —
읽지도 바꾸지도 않는다.

**사용자 눈에 보이는 것을 고칠 때마다 `data/changes.json` 에 한 줄 적는다.**
소개 페이지(`about/*.html`) 맨 아래 '바뀐 것'이 그 파일을 읽는다 — 스물여섯 장을
따로 고치지 않는다. 항목은 `{ v, date, ko, en }` 이고, 그 나라 말이 없으면 영어로
보인다. 적을 때 소개 페이지의 `changes.json?v=` 도 VER 로 같이 올린다.
안에서만 도는 변경(리팩터·도구)은 적지 않는다.

**VER 을 올릴 때마다 커밋 허가를 사용자에게 먼저 묻는다.** push·브랜치 삭제·
`wrangler deploy` 도 마찬가지다.

## 커밋과 README

커밋 메시지는 **영어** 한 줄, 평서형. 한국어로 쓰지 않는다.

    v1.0.1: Expand a province cell into its districts on double-click.

README 는 **`README.md` 한 장, 영어로만** 쓴다. 중국어·일본어·힌디어 절을 새로
쓰거나 고치지 않는다.

## 서브에이전트

`.claude/agents/` 에 있다. 저장소 헌법은 `regiontype`. 두 갈래 이상을 건드리는 일은
`team-lead` 로 시작한다.

| 에이전트 | 맡는 곳 |
|---|---|
| regiontype | 저장소 헌법 (직접 안 고침) |
| team-lead | 오케스트레이션 (직접 안 고침) |
| architect | 설계 계획 (직접 안 고침) |
| frontend | `index/about.html`, `style.css`, `app.js` UI |
| backend | `relay/` Cloudflare Worker |
| data-cartographer | `tools/*.py`, `data/*.json` |
| tester | `?rt=1`, `relay/test.mjs`, 브라우저 확인 |
| security-reviewer | 토큰·주입·개인정보 (읽기 전용) |
| documentation | `README.md`, 주석 |
| integrator | `VER`, 커밋, 릴리스 브랜치 |

판정 엔진·`relay/`·보안면을 건드렸으면 tester 와 security-reviewer 를 반드시 태운다.

## 계획과 기록

여러 단계짜리 일은 `docs/PLAN.md`(마일스톤·검사)를 먼저 채우고, 하면서
`docs/IMPLEMENT.md`(결정·달라진 점)에 덧붙인다. 둘 다 틀이다 — 일마다 복사해
쓰고, 틀 자체는 채우지 않는다. 작은 수정에는 쓰지 않는다.

## 지키는 선

전 기능 키보드 조작. 상태를 색으로만 구분하지 않는다(테두리·라벨·숫자를 함께).
`prefers-reduced-motion` 존중. 모바일 갈림은 화면 폭이 아니라 `pointer:coarse`.
`GH_TOKEN` 은 Worker 안에만 있다. 피드백은 회신 주소를 받지 않는다 — 이슈가 공개다.
한 줄 소개를 지어내지 않는다.
