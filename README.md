# regiontype.com

지역을 타이핑으로 알리는 타자연습. v0.1 — 서울 25개 자치구 / 자유형.

## 실행

    python3 -m http.server 4173

`http://localhost:4173` — 정적 파일뿐이라 아무 정적 호스팅에나 그대로 올라간다.
`?rt=1` 을 붙이면 정답 판정 엔진 자체 검사가 콘솔에서 돈다.

## 파일

    index.html   화면 4개 (타이틀 / 코스 / 설정 / 플레이 / 결과)
    style.css
    app.js       판정 엔진 + 게임 루프 + 결과 카드
    data/*.course.json   항목·별칭·한 줄 정보
    data/*.geom.json     화면 좌표로 투영된 SVG path (17KB)
    tools/build_map.py   GeoJSON → geom.json

## 지도 데이터 갱신

    curl -sL -o gu.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
    python3 tools/build_map.py gu.json data/seoul-gu.geom.json

## 정답 판정

매 입력마다(한글 조합 중 포함) 검사한다. 약칭("강남")은 **그 약칭으로 이어질 수
있는 미점령 항목이 자기 자신뿐일 때만** 인정한다.

- `강남` → 강남구 즉시 확정
- `중` → 중구·중랑구가 모두 남아 있으면 확정하지 않음 (`중구`를 다 쳐야 함)
- 어간이 한 글자면 약칭으로 인정하지 않음
- 앞에 붙은 오타는 접미 검사로 흘려보냄 (`ㅋㅋ강남` → 강남구)
- 설정에서 "정식 명칭 강제"를 켜면 약칭 전부 불인정

오답은 스페이스/엔터로 확정한다. 감점은 없고 콤보만 끊긴다.

## v1까지 남은 것

행정동 코스(법정동·동명이지 대응), 순서형·위치형 모드, 서버 랭킹, 코스 에디터.
