# regiontype.com

지역을 타이핑으로 알리는 타자연습. v0.3.9 — 나라별 행정구역, 화면 한국어·영어·일본어.

## 0.3.9에서 바뀐 점

- 설정에서 나라와 언어를 고른다. 비우면 브라우저 언어와 중계기의 나라 코드
  (`GET /where`)로 기본값을 잡는다
- 46개국 행정구역 코스가 생긴다. 지명은 Natural Earth 의 현지 이름이고, 한 줄
  소개는 비어 있다
- 한국은 서울 코스 옆에 시도 코스가 붙는다. 일본은 도도부현, 미국은 50주와 워싱턴 DC
- 이름에 띄어쓰기가 있으면 스페이스로 확정하지 않고 Enter 로 확정한다

## 0.3.8에서 바뀐 점

- 아이콘을 구글 폰트에서 떼어 `assets/*.svg` 마스크로 그린다. 바깥으로 나가는
  요청이 하나도 없어져 폰트가 늦거나 막힌 망에서도 아이콘이 빈칸이 되지 않는다
- 소개 페이지(`about.html`)를 두고 타이틀 메뉴에서 잇는다. 자치구와 행정동이
  무엇인지, 왜 타이핑으로 외우는지를 검색에서 닿을 수 있는 자리에 적는다
- 링크 미리보기용 메타(OG·트위터카드)와 구조화 데이터를 넣는다
- 결과 화면에 전역 순위표를 붙인다. 코스와 제한 시간이 같은 판끼리만 겨룬다
- 지역 카드에 탭을 붙인다. 지도에서 코스를 고르는 칸 옆에 **순위** 칸이 생겨,
  치기 전에 남들이 어디쯤 몰려 있고 내가 그 안 어디에 서는지를 먼저 본다

## 0.3.7에서 바뀐 점

- 라이트 테마에서 맞은 글자는 어두운 오렌지, 오타는 빨강으로 구분한다
- 뒤로가기 아이콘을 로컬 SVG로 바꿔 폰트 없이도 보이게 한다
- 모바일 안내 문구를 짧게 줄인다

## 0.3.6에서 바뀐 점

- 오타를 쳐도 타이핑이 멈추지 않는다. 친 글자만큼 칸이 늘어 화면이 입력을 그대로 비춘다
- 지명의 가운뎃점을 콤마로 바꾼다 — `종로1·2·3·4가` 는 키보드로 칠 수 없다
- 맞게 친 글자와 오타의 색을 맞바꾼다. 둘이 비슷해 어느 쪽인지 한눈에 안 갈리던 것을 뗀다

이전 패치에서 이어받은 것: 로고 옆 점의 피드백 창, 설정의 그리드 토글, 기기 테마
파비콘, 타이틀·설정이 함께 쓰는 픽셀맵과 포인터 근접장, 빌드 번호 표시, 플레이
하단의 이전·지금·다음 큐와 블러, 서울 25개 구 행정동 코스, `/mimi/` 개발용 미리보기.

## 버전

`0.3.7` 에서 앞의 `0.3` 이 버전, 마지막 `7` 이 패치다. 패치 번호는 `app.js` 의
`VER` 에서 딴다 — `VER` 은 캐시 무효화용이라 고칠 때마다 1씩 올리고(`0.69 → 0.70`),
그 **소수 첫째 자리**가 곧 패치다. `VER=0.70` 이면 `v0.3.7`.

바뀐 점 목록에는 **이번 패치에서 바뀐 것만** 적는다. 지난 패치 것을 계속 쌓아 두면
무엇이 새로 들어왔는지 읽히지 않는다.

`?v=` 쿼리스트링은 줄이지 않는다. 줄이면 예전 번호와 겹쳐 캐시가 안 갈린다.

## 실행

    python3 -m http.server 3000

`http://localhost:3000` — 정적 파일뿐이라 아무 정적 호스팅에나 그대로 올라간다.
`?rt=1` 을 붙이면 정답 판정 엔진 자체 검사가 콘솔에서 돈다.

## 파일

    index.html   화면 (타이틀 / 지역 / 설정 / 플레이 / 결과)
    about.html   소개 — style.css 토큰만 물려받고 app.js 는 부르지 않는다
    style.css
    app.js       판정 엔진 + 게임 루프 + 결과 카드
    design/      플레이·큐 화면 디자인 (`design.pen`)
    relay/       중계기 (Cloudflare Worker) — 피드백 → GitHub 이슈, 순위표 → D1
    mimi/        미니 모터웨이즈 스타일 보드 (개발용)
    data/*.course.json   항목·별칭·한 줄 정보 (mode: sequence)
    data/*.geom.json     비트맵 도트 격자
    data/world.json         나라 목록 (build_world.py)
    data/i18n.json          화면 말 (ko / en / ja). 손으로 쓴다
    data/*-pixels.json      타이틀 픽셀맵
    tools/build_map.py      GeoJSON → geom.json
    tools/build_dong.py     25개 구 행정동 코스를 한꺼번에
    tools/build_pixels.py   GeoJSON → 픽셀 격자
    tools/build_world.py    Natural Earth admin-1 → 나라 코스
    tools/build_size.py     코스 정원 → relay/size.mjs

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

## 나라 코스

서울 말고 나라별 1단계 행정구역은 Natural Earth 10m 에서 찍는다. 한 줄 소개는
짓지 않는다.

    curl -sL -o /tmp/ne-admin1.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
    curl -sL -o /tmp/ne-admin0.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
    python3 tools/build_world.py /tmp/ne-admin1.geojson /tmp/ne-admin0.geojson data/
    python3 tools/build_size.py

`relay/size.mjs` 는 정원 표다. 코스가 늘면 중계기도 이 파일을 읽으므로, 찍은 뒤
`node relay/test.mjs` 로 어긋남을 본다. `GET /where` 는 배포된 중계기에 있다.

## 정답 판정

매 입력마다(한글 조합 중 포함) 검사한다. 약칭("강남")은 **그 약칭으로 이어질 수
있는 미점령 항목이 자기 자신뿐일 때만** 인정한다.

- `강남` → 강남구 즉시 확정
- `중` → 중구·중랑구가 모두 남아 있으면 확정하지 않음 (`중구`를 다 쳐야 함)
- 어간이 한 글자면 약칭으로 인정하지 않음
- 앞에 붙은 오타는 접미 검사로 흘려보냄 (`ㅋㅋ강남` → 강남구)

오답은 **조합이 끝난 시점에 어느 접미도 미점령 항목의 앞부분이 아닐 때** 자동
확정된다(`강난` → 즉시 오답). 스페이스를 keydown 으로 가로채면 IME 조합 확정
자체가 깨지므로 그렇게 하지 않는다. 이름에 띄어쓰기가 있는 코스는 스페이스가
글자라서, 그때만 Enter 로 확정한다. 감점은 없고 콤보만 끊긴다.

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

    node relay/test.mjs      이슈 한 장과 점수 한 줄을 제대로 거르는지 검사

이슈를 만드는 열린 주소라 언젠가 스팸이 온다. IP 하나당 창을 두었고, 메타는 코드
블록에 가둬 남이 보낸 값이 이슈 서식을 흔들지 못하게 했다. 그래도 새는 날이 오면
Turnstile 을 앞에 세운다 — 토큰이 그 저장소 이슈만 만질 수 있어 최악이라도
README 한 장짜리 저장소를 비우면 끝이다.

창은 `ratelimit` 바인딩으로 센다. **전에는 Cache API 로 셌는데 그건 `workers.dev`
배포에서 통째로 무시된다** — `put` 은 버려지고 `match` 는 늘 빈손이라, 창이 있다고
적혀 있는 동안 실제로는 한 번도 켜진 적이 없었다. 조용히 열려 있는 방벽이 없는
방벽보다 나쁘다. 그래서 바인딩이 없으면 200 대신 503 으로 문을 닫는다.

회신 주소는 어떤 모양으로도 받지 않는다. 화면에 입력칸이 없는 것으로는 모자라다 —
중계기가 그 필드를 읽는 한 아무나 남의 메일 주소를 공개 이슈에 박을 수 있다.

### 순위표 (`relay/` + D1)

같은 중계기에 경로 두 개를 더 얹었다. 한 판은 **코스와 제한 시간**이고, 그 안에서
한 사람이 한 줄을 차지한다 — 5분 판과 1분 판을 한 줄에 세우면 점수에 뜻이 없다.

    POST /score    {c, t, who, name, score, hits, tries} → {rank, top}
    GET  /top      ?c=코스&t=초 → {top}
    POST /dist     {c, t} → {bins, bucket, cap, total, score, over}
    POST /forget   {} → {gone}      내 줄을 전부 내린다

    POST /auth/new  패스키 만들기 시작 → 챌린지
    POST /auth/reg  패스키 만들기 끝  → 세션 토큰
    POST /auth/go   로그인 시작       → 챌린지
    POST /auth/log  로그인 끝         → 세션 토큰
    GET  /auth/me   지금 누구인지

    cd relay
    wrangler d1 create rt-board                              # 찍힌 id 를 wrangler.toml 에
    wrangler d1 execute rt-board --remote --file schema.sql
    wrangler deploy

`database_id` 가 비어 있거나 배포가 아직이면 중계기가 503 으로 접고, 사이트는
순위표 절을 통째로 숨긴다. 결과 화면은 그대로다.

줄의 주인은 이름이 아니라 `who` 다 — 브라우저가 한 번 만들어 두는 난수이고 화면에
보이지 않으며, 응답에도 실리지 않는다. 이름으로 주인을 삼으면 남의 이름에 높은
점수를 박아 그 사람이 영영 자기 기록을 못 올리게 만들 수 있다. 내 줄 표시도
중계기가 `me` 로 붙여 보낸다 — 이름은 서버가 다듬어 저장하므로 브라우저가 이름을
맞대어 찾으면 어긋난다.

채점은 브라우저가 한다. 중계기가 보는 건 앞뒤가 맞는지뿐이고, 상한은 **코스 정원과
제한 시간**이 함께 정한다 — 코스에 있는 곳보다 많이 들를 수 없고, 한 곳 치는 데
아무리 빨라도 0.5초는 든다. 정원 표(`SIZE`)가 없으면 25곳짜리 판에 500곳을 친 척한
25만점이 통과해 1위를 영구 점거한다. 표에 없는 코스 이름은 아예 받지 않는다.

그 표는 `data/*.course.json` 에서 뽑아 적은 값이라 언젠가 낡는다. `relay/test.mjs`
가 매번 원본과 맞대어 보고 어긋나면 잡는다.

그래도 정직한 값과 잘 지은 거짓말은 여기서 못 가른다. **순위표는 명예의 전당이지
판정 기록이 아니다.** 가려야 할 만큼 시달리면 채점을 서버로 옮기는 수밖에 없다.

### 로그인

**순위표에 올릴 때만 필요하다.** 게임은 로그인 없이 그대로 돈다. 분포도 그냥 보인다 —
내 자리만 안 찍힐 뿐이다.

**비밀번호를 받지 않는다.** 정적 사이트가 비밀번호를 다루면 해시·재설정·유출 대응을
전부 떠안는데 그건 이 저장소가 감당할 층이 아니다. 패스키는 비밀이 기기 밖으로
나오지 않아서 **우리가 털릴 것 자체가 없다** — 서버에는 공개키만 남는다.

    wrangler secret put SESSION_KEY   # 아무 긴 난수. 갈면 모든 세션이 끊긴다

메일 링크는 아직 없다. Cloudflare Email Routing 은 받기만 하고 보내지 못해서,
발송처(Resend·Postmark 등)와 API 키가 정해져야 얹을 수 있다.

패스키 검증은 **의존성 없이** 한다. 등록 때 브라우저의 `getPublicKey()` 가 SPKI 를
그대로 주므로 서버에 CBOR 파서를 들이지 않는다. 서명은 WebCrypto 로 확인하고,
인증기가 보내는 DER 서명을 원시 64바이트로 풀어 넣는다(`derToRaw`).

`attestation` 은 `none` 이다. 기기 제조사 증명서를 안 받는 대신 지키는 건
**'이 챌린지에, 이 출처에서, 이 기기가 답했다'** 하나다. 순위표에는 그거면 된다.

세션은 서명한 무상태 토큰이고 `Authorization: Bearer` 로 실어 보낸다. 쿠키를 안
쓰는 건 중계기가 사이트와 다른 곳(`workers.dev`)에 있어서다 — 사이트 밖 쿠키는
브라우저가 점점 더 막는다. 헤더로 나르면 CSRF 도 없다. 중계기를
`api.regiontype.com` 으로 옮기면 HttpOnly 쿠키로 올릴 수 있다.

**줄의 주인은 토큰에서 읽는다.** 몸통에 실려 온 값은 보지 않는다 — 예전 기록 코드
방식은 코드를 아는 사람이면 누구나 그 이름으로 올릴 수 있었다.

무상태라 세션을 낱개로 끊을 수 없다. 급하면 `SESSION_KEY` 를 갈아 전부 끊는다.

### 순위 칸

지역 카드의 탭에서 연다. 치기 전에 여는 화면이라 결과 화면의 순위표와 목적이 다르다
— 저기는 방금 친 판의 결과고, 여기는 **겨룰 상대**다. 화살표로 코스를 넘기고 제한
시간은 설정을 따른다.

분포는 그 판에서 나올 수 있는 최고 점수까지 그린다. 사람이 몰린 자리까지만 그리면
판마다 가로 눈금이 달라져 서로 견줄 수 없다. 등수와 상위 몇 %는 서버가 센 값만
적는다 — 막대에서 눈대중한 자리를 숫자로 적으면 보이는 것과 실제가 어긋난다.

`/dist` 는 읽기인데 POST 다. `who` 가 자격증명이라 주소줄에 실으면 중계·기록 로그에
그대로 남기 때문이다.

이름은 남 앞에 걸리는 유일한 남의 입력이다. 12자에서 자르고 보이지 않는
글자(제어·서식·방향 뒤집기)를 털어 넣으며, 화면에는 `textContent` 로만 올린다.
브라우저도 **중계기와 똑같은 자로** 다듬는다 — 여기서만 통과하는 이름을 저장하면
그 뒤 모든 판이 400 을 받고, 순위표 칸이 접히면서 이름을 다시 적을 폼까지 함께
사라져 되돌릴 길이 없어진다.

이름이 공개된다는 것을 적는 자리에서 밝히고(“누구나 보는 순위표에 이 이름이
올라갑니다”), 설정에 **순위표에서 내리기**를 둔다. 점수를 안 깨도 이름은 갱신되므로
잘못 적은 이름을 지우려고 자기 최고 기록을 깰 필요가 없다.
IP 는 레이트리밋 창에만 쓰고 저장하지 않는다. D1 에 남는 건 코스·시간·`who`·
이름·점수뿐이다.

## 접근성

- 전 기능 키보드 조작. 토글·스텝 버튼은 `aria-label` 로 이름을 갖는다
- 점령 상태는 색 외에 **테두리와 지명 라벨**로도 구분된다 (PRD 8.4)
- 남은 시간을 게이지와 **숫자** 양쪽으로 표시해 색 대비에 의존하지 않는다
- `prefers-reduced-motion` 존중, 설정에서 애니메이션 개별 차단 가능
- 모바일 안내 화면은 화면 폭이 아니라 `pointer:coarse` 로 가른다 —
  데스크톱에서 200% 확대한 사용자가 쫓겨나지 않도록

## v1까지 남은 것

법정동·동명이지 대응, 위치형 모드, 서버 랭킹, 코스 에디터. 행정동 한 줄 소개는 강서구만 채워져 있다.
