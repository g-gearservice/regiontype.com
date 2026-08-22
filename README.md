# regiontype.com

지역을 타이핑으로 알리는 타자연습. v0.1.1 — 서울 25개 자치구 / 자유형.

## 실행

    python3 -m http.server 3000

`http://localhost:3000` — 정적 파일뿐이라 아무 정적 호스팅에나 그대로 올라간다.
`?rt=1` 을 붙이면 정답 판정 엔진 자체 검사가 콘솔에서 돈다.

## 파일

    index.html   화면 4개 (타이틀 / 코스 / 설정 / 플레이 / 결과)
    style.css
    app.js       판정 엔진 + 게임 루프 + 결과 카드
    data/*.course.json   항목·별칭·한 줄 정보
    data/*.geom.json     화면 좌표로 투영된 SVG path (17KB)
    data/korea-pixels.json  타이틀 화면 픽셀맵 격자
    tools/build_map.py      GeoJSON → geom.json
    tools/build_pixels.py   GeoJSON → 픽셀 격자

## 지도 데이터 갱신

    curl -sL -o gu.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
    python3 tools/build_map.py gu.json data/seoul-gu.geom.json

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
- 설정에서 "정식 명칭 강제"를 켜면 약칭 전부 불인정

오답은 **조합이 끝난 시점에 어느 접미도 미점령 항목의 앞부분이 아닐 때** 자동
확정된다(`강난` → 즉시 오답). 스페이스를 keydown 으로 가로채면 IME 조합 확정
자체가 깨지므로 그렇게 하지 않는다. 감점은 없고 콤보만 끊긴다.

## 접근성

- 전 기능 키보드 조작. 토글·스텝 버튼은 `aria-label` 로 이름을 갖는다
- 점령 상태는 색 외에 **테두리와 지명 라벨**로도 구분된다 (PRD 8.4)
- 남은 시간을 게이지와 **숫자** 양쪽으로 표시해 색 대비에 의존하지 않는다
- `prefers-reduced-motion` 존중, 설정에서 애니메이션 개별 차단 가능
- 모바일 안내 화면은 화면 폭이 아니라 `pointer:coarse` 로 가른다 —
  데스크톱에서 200% 확대한 사용자가 쫓겨나지 않도록

## v1까지 남은 것

행정동 코스(법정동·동명이지 대응), 순서형·위치형 모드, 서버 랭킹, 코스 에디터.
