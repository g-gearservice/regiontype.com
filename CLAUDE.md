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
- `style.css` 단일 파일. 색·간격은 위쪽 커스텀 프로퍼티에서 딴다.
- `data/*.json` 은 대부분 `tools/*.py` 가 찍은 생성물이다. 손으로 고치지 말고 도구를 고친다.
  예외: `data/i18n.json` 화면 말, 강서구 코스의 한 줄 소개(`build_dong.py` 의 `KEEP`).
  한 줄 소개를 지어내지 않는다.
- 에셋을 새로 넣으면 `asset()` 을 태워 `?v=` 가 붙게 한다.

## 버전과 배포

릴리스 이름은 `vA.B.C` 세 자리다.

- **A** — 대규모 변경. 구조를 다시 짜거나 새 모드가 생기는 수준. 사람이 고른다.
- **B** — 자잘한 변경. 평소 기능 추가·수정처럼 사용자 눈에 보이지만 A 만큼은
  아닌 것. 사람이 고른다.
- **C** — `VER` 에서 점을 뺀 숫자다(`VER = '1.45'` → `v0.4.145`). 고르지 않고 옮긴다.

A 를 올리면 B 는 0으로 되돌린다. C 는 늘 VER 을 따르므로 되돌리지 않는다.

`app.js` 의 `VER`(설정 화면 버전 줄 괄호 안 숫자)은 고칠 때마다 `0.01` 씩 올린다
(`1.45 → 1.46`). `?v=` 는 줄이지 않는다. 설정 화면의 C 자리는 VER 에서 읽으니
손으로 적지 않는다.

**GitHub Pages 소스는 `main` 이 아니라 작업 브랜치다.** 릴리스마다 `static-A.B.C`
브랜치를 새로 판다(`static-0.4.145`). Pages 소스를 옮긴 뒤에야 옛 브랜치를 지운다.

**VER 을 올릴 때마다 커밋 허가를 사용자에게 먼저 묻는다.** push·브랜치 삭제·
`wrangler deploy` 도 마찬가지다.

## 커밋과 README

커밋 메시지는 **영어** 한 줄, 평서형. 한국어로 쓰지 않는다.

    v0.4.145: Expand a province cell into its districts on double-click.

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

## 지키는 선

전 기능 키보드 조작. 상태를 색으로만 구분하지 않는다(테두리·라벨·숫자를 함께).
`prefers-reduced-motion` 존중. 모바일 갈림은 화면 폭이 아니라 `pointer:coarse`.
`GH_TOKEN` 은 Worker 안에만 있다. 피드백은 회신 주소를 받지 않는다 — 이슈가 공개다.
한 줄 소개를 지어내지 않는다.
