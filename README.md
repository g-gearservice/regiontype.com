# regiontype.com

지역을 타이핑으로 알리는 타자연습. v0.3.6 — 서울 25개 자치구와 구별 행정동 / 순서형.

## 0.3.6에서 바뀐 점

- 오타를 쳐도 타이핑이 멈추지 않는다. 친 글자만큼 칸이 늘어 화면이 입력을 그대로 비춘다
- 지명의 가운뎃점을 콤마로 바꾼다 — `종로1·2·3·4가` 는 키보드로 칠 수 없다

이전 패치에서 이어받은 것: 로고 옆 점의 피드백 창, 설정의 그리드 토글, 기기 테마
파비콘, 타이틀·설정이 함께 쓰는 픽셀맵과 포인터 근접장, 빌드 번호 표시, 플레이
하단의 이전·지금·다음 큐와 블러, 서울 25개 구 행정동 코스, `/mimi/` 개발용 미리보기.

## 버전

`0.3.6` 에서 앞의 `0.3` 이 버전, 마지막 `6` 이 패치다. 패치 번호는 `app.js` 의
`VER` 에서 딴다 — `VER` 은 캐시 무효화용이라 고칠 때마다 1씩 올리고(`0.62 → 0.63`),
그 **소수 첫째 자리**가 곧 패치다. `VER=0.63` 이면 `v0.3.6`.

바뀐 점 목록에는 **이번 패치에서 바뀐 것만** 적는다. 지난 패치 것을 계속 쌓아 두면
무엇이 새로 들어왔는지 읽히지 않는다.

`?v=` 쿼리스트링은 줄이지 않는다. 줄이면 예전 번호와 겹쳐 캐시가 안 갈린다.

## 실행

    python3 -m http.server 3000

`http://localhost:3000` — 정적 파일뿐이라 아무 정적 호스팅에나 그대로 올라간다.
`?rt=1` 을 붙이면 정답 판정 엔진 자체 검사가 콘솔에서 돈다.

## 파일

    index.html   화면 (타이틀 / 지역 / 설정 / 플레이 / 결과)
    style.css
    app.js       판정 엔진 + 게임 루프 + 결과 카드
    design/      플레이·큐 화면 디자인 (`design.pen`)
    relay/       피드백 → GitHub 이슈 중계기 (Cloudflare Worker)
    mimi/        미니 모터웨이즈 스타일 보드 (개발용)
    data/*.course.json   항목·별칭·한 줄 정보 (mode: sequence)
    data/*.geom.json     비트맵 도트 격자
    data/korea-pixels.json  타이틀 화면 픽셀맵 격자
    tools/build_map.py      GeoJSON → geom.json
    tools/build_dong.py     25개 구 행정동 코스를 한꺼번에
    tools/build_pixels.py   GeoJSON → 픽셀 격자

## 지도 데이터 갱신

    curl -sL -o gu.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
    python3 tools/build_map.py gu.json data/seoul-gu.geom.json

25개 자치구의 행정동 코스는 한 번에 찍어낸다. 격자는 채워진 도트 수를 보고
구마다 다르게 잡는다 — 폭만 고정하면 세로로 긴 구에서 도트가 폭발한다.

    curl -sL -o dong.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_submunicipalities_geo_simple.json
    python3 tools/build_dong.py dong.json gu.json data/

강서구 코스는 한 줄 소개를 손으로 썼기 때문에 덮어쓰지 않는다(build_dong.py 의 KEEP).
나머지 코스의 한 줄 소개는 비어 있다 — 400곳을 지어낼 수는 없어 사람이 채울 자리로 뒀다.

## 타이틀 픽셀맵

전국 시도 경계를 격자로 찍어 서울만 다른 색으로 둔다. v1 이 서울에서 시작해
전국으로 넓어진다는 로드맵이 그림 하나로 보이도록.

    curl -sL -o kr.json https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json
    python3 tools/build_pixels.py kr.json data/korea-pixels.json 34

마지막 인자는 가로 칸 수(여백을 잘라내므로 결과는 더 좁다). 울릉도·독도처럼
이웃 없는 한 칸짜리 섬은 장식으로서 잡티라 지운다.

## 정답 판정

매 입력마다(한글 조합 중 포함) 검사한다. 약칭("강남")은 **그 약칭으로 이어질 수
있는 미점령 항목이 자기 자신뿐일 때만** 인정한다.

- `강남` → 강남구 즉시 확정
- `중` → 중구·중랑구가 모두 남아 있으면 확정하지 않음 (`중구`를 다 쳐야 함)
- 어간이 한 글자면 약칭으로 인정하지 않음
- 앞에 붙은 오타는 접미 검사로 흘려보냄 (`ㅋㅋ강남` → 강남구)

오답은 **조합이 끝난 시점에 어느 접미도 미점령 항목의 앞부분이 아닐 때** 자동
확정된다(`강난` → 즉시 오답). 스페이스를 keydown 으로 가로채면 IME 조합 확정
자체가 깨지므로 그렇게 하지 않는다. 감점은 없고 콤보만 끊긴다.

## 피드백

타이틀 로고의 노란 점이 곧 피드백 버튼이다. 손을 얹거나 탭으로 옮겨오면 점이
커지며 깃발이 뜨고, 누르면 `<dialog>` 가 모달로 열린다. 화면을 하나 더 만들지
않은 건 "여기서 말을 걸 수 있다"를 로고 옆 점 하나로 끝내기 위해서다.

받는 쪽은 `app.js` 위쪽 상수 하나로 갈린다.

    const FEEDBACK_URL = ''       // 채우면 여기로 JSON 을 POST
    const FEEDBACK_REPO = 'pistolinkr/regiontype.com'

보내는 몸통은

    { kind, body, v, href, ua }

`kind` 는 버그 / 제안 / 지명·정보 오류. 글만 받으면 재현할 수 없어 버전·주소·
브라우저를 함께 싣는다. 회신 주소는 받지 않는다 — 이슈가 공개라 적는 순간
남의 메일이 그대로 노출되고, 답은 이슈에 달면 된다.

`FEEDBACK_URL` 이 비어 있으면 `FEEDBACK_REPO` 의 이슈 초안을 미리 채워 새 탭으로
연다. 인프라 없이 도는 길이라 기본값으로 두었지만, 제보자에게 GitHub 계정을
요구한다. 그게 싫으면 아래 중계기를 세운다.

### 중계기 (`relay/`)

GitHub 이슈는 토큰 없이 만들 수 없고, 정적 사이트에 토큰을 두면 그대로 털린다.
그래서 토큰을 쥔 Cloudflare Worker 한 장을 사이에 둔다. 하는 일은 그것뿐이다 —
받은 JSON 을 이슈 한 장으로 지어 GitHub API 로 넘긴다.

    cd relay
    wrangler login
    wrangler secret put GH_TOKEN     # 그 저장소의 Issues 쓰기만 가진 세밀 토큰
    wrangler deploy

찍혀 나온 주소를 `app.js` 의 `FEEDBACK_URL` 에 붙이면 '보내기'가 곧 이슈 등록이
된다. 토큰은 Worker 안에만 있고 브라우저로는 내려가지 않는다.

    node relay/test.mjs      이슈 한 장이 제대로 지어지는지 검사

이슈를 만드는 열린 주소라 언젠가 스팸이 온다. IP 하나당 60초 창을 두었고,
메타는 코드 블록에 가둬 남이 보낸 값이 이슈 서식을 흔들지 못하게 했다. 그래도
새는 날이 오면 Turnstile 을 앞에 세운다 — 토큰이 그 저장소 이슈만 만질 수 있어
최악이라도 README 한 장짜리 저장소를 비우면 끝이다.

## 접근성

- 전 기능 키보드 조작. 토글·스텝 버튼은 `aria-label` 로 이름을 갖는다
- 점령 상태는 색 외에 **테두리와 지명 라벨**로도 구분된다 (PRD 8.4)
- 남은 시간을 게이지와 **숫자** 양쪽으로 표시해 색 대비에 의존하지 않는다
- `prefers-reduced-motion` 존중, 설정에서 애니메이션 개별 차단 가능
- 모바일 안내 화면은 화면 폭이 아니라 `pointer:coarse` 로 가른다 —
  데스크톱에서 200% 확대한 사용자가 쫓겨나지 않도록

## v1까지 남은 것

법정동·동명이지 대응, 위치형 모드, 서버 랭킹, 코스 에디터. 행정동 한 줄 소개는 강서구만 채워져 있다.
