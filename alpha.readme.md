# alpha team — regiontype.com 다루는 법

alpha team 이 이 저장소에서 일할 때, 그리고 각자 쓰는 Claude 에게 일을 맡길 때 보는 한 장이다.
규칙의 원본은 `CLAUDE.md`(= `AGENTS.md`)다. 이 파일과 어긋나면 `CLAUDE.md` 가 이긴다.

## 1. 이 프로젝트는

지도 위 지명을 타자로 쳐서 칸을 점령하는 타자연습 웹. 한국어가 기본이고 화면 말은 26개.

- **정적 파일뿐이다.** 빌드·패키지 매니저·프레임워크가 없고, 새로 들이지 않는다.
- 화면 로직은 `app.js` 한 장, 스타일은 `style.css` 한 장.
- `relay/` 는 Cloudflare Worker(피드백 → GitHub 이슈 중계).
- `data/*.json` 은 대부분 `tools/*.py` 가 찍은 생성물이다. 손으로 고치지 말고 도구를 고친다.
- 배포: `main` 에 머지되면 GitHub Pages 로 나간다.

```
python3 -m http.server 3000     실행 → http://localhost:3000
?rt=1                           판정 엔진 자체검사 (콘솔)
node relay/test.mjs             중계기 검사
```

검사는 이 둘뿐이다. 테스트 러너를 새로 세우지 않는다.

## 2. 내 Claude 에게 이 프로젝트를 알려주는 법

### Claude Code 로 저장소를 열 때 (권장)

저장소를 클론해 열면 Claude 가 `CLAUDE.md` 를 알아서 읽는다. 첫 메시지로 맡은 갈래만 알려주면 된다.

> CLAUDE.md 와 alpha.readme.md 를 읽고, 내가 맡은 ○○ 쪽 파일을 훑어 요약해줘. 그다음 할 일은 ○○야.

### claude.ai 처럼 저장소가 없는 곳에서 쓸 때

Claude 가 코드를 볼 수 없으니 맥락을 넣어줘야 한다. 둘 중 하나를 쓴다.

1. 이 파일의 1·4·5절을 프로젝트 지침(Project instructions)에 붙인다.
2. 디자인 시스템 아티팩트 링크를 넘긴다(3절).

## 3. 디자인 일을 Claude 에게 맡길 때

디자인 기준은 **`style.css` 맨 위 `:root` 토큰**과 **`/beta/style/` 페이지**다.

- 저장소를 여는 Claude 라면 이렇게 시킨다.
  "`style.css` 의 `:root`·`:root[data-night]` 토큰과 `beta/style/index.html` 을 읽고 디자인 언어를 요약해줘."
- 저장소가 없는 Claude 라면 디자인 시스템 아티팩트 링크를 넘긴다. 주의할 점은 셋이다.
  - **공유해야 보인다.** 아티팩트는 처음에 만든 사람만 볼 수 있다.
  - **보기 권한만 주면 Claude 는 요약만 받는다.** 토큰 값을 정확히 쓰게 하려면 편집 권한을 준다.
  - **복사본이다.** `style.css` 토큰이 바뀌면 아티팩트도 다시 올린다. 기준은 늘 `style.css` 다.
- 시안은 이 제약 안에서 구현될 수 있어야 한다: 정적 HTML/CSS/JS, 라이브러리 없음, 낮·밤 두 테마.
- 시안에서 색은 hex 가 아니라 **토큰 이름**(`--accent`, `--card` …)으로, 간격·시간은 수치로 적는다.
- 시안을 코드로 옮기는 건 별도 작업이다. 그때 5절의 VER·changes.json 규칙을 따른다.

## 4. 지키는 선 (협상 안 됨)

- 모든 기능을 키보드만으로 조작할 수 있어야 한다.
- 상태를 색으로만 구분하지 않는다. 테두리·라벨·숫자를 함께 쓴다.
- `prefers-reduced-motion`, `prefers-reduced-transparency` 를 존중한다.
- 모바일 분기는 화면 폭이 아니라 `pointer:coarse` 로 나눈다.
- 대비는 WCAG AA. 주황(`--accent`) 바탕 위 글자는 흰색 말고 `--on-accent`.
- 한 줄 소개(장소 설명)를 지어내지 않는다.
- `GH_TOKEN` 은 Worker 안에만 둔다. 저장소·화면·문서에 토큰을 적지 않는다.
- 피드백은 회신 주소를 받지 않는다. 이슈가 공개되기 때문이다.
- 스페이스를 `keydown` 으로 가로채지 않는다. IME 조합 확정이 깨진다.

## 5. 일하는 순서

1. **브랜치**
   - 사람이 하는 릴리스: `static-A.B.C`
   - 봇(Claude)이 직접 올리는 PR: `agent-static-A.B.C`. A.B.C 는 그 PR 의 릴리스(`REL`)와 같다(`agent-static-1.4.0` ↔ `v1.4.0`).
   - `main` 에 직접 푸시하지 않는다. 머지가 곧 배포다.
2. **VER**: 사용자 눈에 보이는 것을 고치면 `app.js` 의 `VER` 을 `0.01` 올린다(`1.45 → 1.46`).
   릴리스 이름의 C 자리는 VER 에서 점을 뺀 숫자다(`v0.11.450`). `?v=` 는 줄이지 않는다.
3. **바뀐 것**: 사용자 눈에 보이는 변경은 `data/changes.json` 에 `{ v, date, ko, en }` 으로 한 줄 적고,
   소개 페이지의 `changes.json?v=` 도 VER 로 올린다. 리팩터나 도구만 고쳤으면 적지 않는다.
4. **에셋**: 새 에셋은 `asset()` 을 거쳐 `?v=` 가 붙게 한다.
5. **커밋**: 영어 한 줄, 평서형. 한국어로 쓰지 않는다.
   `v0.11.451: Add the alpha team guide.`
6. **사람에게 먼저 묻는 것**: VER 올린 커밋, push, 브랜치 삭제, `wrangler deploy`.
   Claude 가 이걸 묻지 않고 하려 들면 멈춘다.
7. **손대지 않는 것**: GitHub Pages 설정(소스 브랜치·도메인). 사람이 직접 만진다.

## 6. 갈래별 담당

| 갈래 | 파일 | 꼭 지킬 것 |
|---|---|---|
| 디자인·프론트 | `index.html`, `about/`, `style.css`, `app.js` UI | 토큰에서 색·간격 따기, 4절 |
| 판정 엔진 | `app.js` 의 `matchInput()`, `matchTongue()` | `?rt=1` 통과 |
| 백엔드 | `relay/` | `node relay/test.mjs` 통과, 보안 검토 |
| 데이터 | `tools/*.py` → `data/*.json` | 생성물 손으로 고치지 않기 |
| 문서 | `README.md`(영어 한 장), 주석 | 다른 언어 README 절을 만들지 않기 |

판정 엔진·`relay/`·보안면을 건드렸으면 검사와 보안 검토를 반드시 거친다.

`CLAUDE.md` 에 적힌 서브에이전트(`.claude/agents/`)는 저장소에 들어 있지 않고 개인 로컬에만 있다.
없으면 위 표대로 갈래를 나눠 Claude 에게 직접 지시하면 된다.

## 7. 막히면

- 규칙이 헷갈리면 `CLAUDE.md`.
- 화면 말은 `data/i18n.json`, 바뀐 것 목록은 `data/changes.json`. 둘 다 손으로 고쳐도 되는 파일이다.
- 그 밖의 `data/*.json` 이 이상하면 해당 `tools/*.py` 를 찾는다.
