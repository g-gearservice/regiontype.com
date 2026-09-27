# T6 · Marketing metrics — 개인정보 없이 숫자로 캠페인 읽기

> Sprint proposal (docs only). KO primary. Short EN twin at the end.
> **정의 문서다 — 구현이 아니다.** Not a product-code change. No VER bump.
> Do not merge / deploy without Parxang.

---

## 목적 (Purpose)

마케팅 기간 동안 「캠페인이 먹혔나」를 **감이 아니라 숫자로** 판단한다.
단, 사람을 식별할 수 있는 것은 하나도 모으지 않는다. 합계만 본다.

이 문서는 네 개의 지표를 **정의**하고, 저장 방식은 **후보만** 낸다.
무엇을 실제로 심을지는 Parxang 이 고른다 — 아래 「도입 여부」.

## 범위 (Scope)

- **기간:** 마케팅 기간(캠페인 창) 한정. 창이 닫히면 수집도 닫는다. 상시 분석이 아니다.
- **단위:** 집계 수(count)만. 사람·세션 단위 로그를 남기지 않는다.
- **지표:** 정확히 넷 — ① 유입 ② 모바일 이탈 ③ 첫 판 완주 ④ 공유. 늘리지 않는다.
- **자동 구현 = 아니오.** 이 PR 에는
  - 분석 SDK(GA·Amplitude·Plausible 등) 없음
  - Cloudflare Web Analytics 스니펫·새 KV/D1 바인딩 없음
  - 추적 코드·`fetch` 비콘·쿠키 없음
- VER 을 올리지 않는다. `data/changes.json` 에 적지 않는다(사용자 눈에 보이는 변경이 아님).

## 모든 지표에 공통으로 모으지 않는 것 (Never collected)

| 항목 | 이유 |
| --- | --- |
| IP 주소 원문 | 저장하지 않는다. 필요하면 요청 처리 중 메모리에서만 쓰고 버린다 |
| 계정 id (`who`, Google/Apple sub 등) | 순위표용 식별자를 지표에 섞지 않는다 |
| 정밀 위치 (GPS·위경도) | 「내 동네」 게임이라도 사는 곳을 묻지 않는다. 코스 slug 로 충분 |
| 키 입력 내용 | 친 글자·오타·입력 시퀀스를 보내지 않는다 |
| 이름·닉네임 | 순위표 표시 이름 포함, 지표로 가지 않는다 |
| 전체 User-Agent 문자열·기기 지문 | `pointer:coarse` 여부 한 비트면 된다 |
| 전체 referrer URL | 출처는 **호스트 버킷**(아래)으로 잘라서만 |

---

## ① 유입 (Traffic)

- **답하는 질문:** 캠페인이 사람을 데려왔나? 어느 채널에서?
- **정의(집계):** `visit[date][channel]` — 하루·채널별 첫 화면 로드 수.
  - `channel` 은 고정 버킷 중 하나: `utm_source` 값(허용 목록: `ig`, `x`, `kakao`, `threads`, `yt` …) → 없으면 referrer 호스트를 `search` / `social` / `other` / `direct` 로 접는다.
  - 새로고침·같은 탭 이동은 `sessionStorage` 한 칸으로 한 번만 센다(서버엔 안 보냄).
- **모으지 않는 것:** 공통 표 전부. 특히 referrer 전체 경로, UTM 의 자유 문자열(허용 목록 밖은 `other`).
- **저장 후보:**
  - A. **일 카운터만** — `(date, channel) → n`. 가장 작다. 추천.
  - B. Cloudflare 존 대시보드의 기존 요청 통계만 읽기(코드 0줄). 채널 구분이 거칠다.
- **마케팅이 읽는 법:** 캠페인 창 전 7일 평균을 기준선으로, 게시 당일~+3일 채널별 증가분. 「IG 게시 뒤 `ig` 가 기준선 대비 몇 배」.
- **위험:** 봇·프리뷰 크롤러(카톡·X 링크 미리보기)가 부풀린다 → 첫 화면에서 JS 가 돈 경우만 센다. UTM 을 안 붙인 게시물은 `direct` 로 샌다.
- **킬 스위치:** 설정 한 줄(`METRICS_ON=false` 류)로 비콘을 끈다. 끄면 카운터는 그 자리에서 멈추고 게임은 아무 영향 없다.

## ② 모바일 이탈 (Mobile bounce / exit)

- **답하는 질문:** 휴대폰으로 들어온 사람이 판을 시작하기도 전에 떠나나?
- **정의(집계):** `mobile_land[date]` 와 `mobile_start[date]` 두 카운터.
  - 모바일 = `matchMedia('(pointer:coarse)')` — 저장소 규칙대로 화면 폭이 아니다.
  - 이탈률 = `1 − mobile_start / mobile_land`. 같은 식으로 데스크톱도 세어 비교선으로 쓴다.
  - 「시작」= 첫 코스 판이 실제로 시작된 순간(첫 입력 칸 활성). 몇 초 머물렀는지는 재지 않는다.
- **모으지 않는 것:** 공통 표 전부. 기기 모델·OS 버전·화면 크기·체류 시간·스크롤 깊이.
- **저장 후보:**
  - A. **일 카운터** — `(date, coarse, stage) → n`, `stage ∈ {land, start}`. 추천.
  - B. A + 채널 버킷 한 칸(`(date, coarse, channel, stage)`) — 「IG 로 온 모바일만 유독 나간다」를 볼 수 있다. 칸이 늘어나니 작은 버킷은 합쳐서 보인다(아래 위험).
- **마케팅이 읽는 법:** 모바일 이탈이 데스크톱보다 크게 높으면 카피보다 **첫 화면·키보드**가 문제다 → T1(`fix/1-mobile`) 쪽으로 넘긴다. 캠페인 중 이탈이 갑자기 튀면 그날 배포를 먼저 의심한다.
- **위험:** `pageshow`/`bfcache` 로 같은 사람이 두 번 land 로 잡힐 수 있다 → 탭당 한 번. 채널×모바일로 쪼개면 칸이 작아져 재식별 쪽으로 기운다 → 하루 10 미만 칸은 「<10」으로만 보인다.
- **킬 스위치:** ①과 같은 스위치. 추가로 B 를 골랐다면 채널 칸만 따로 끌 수 있게 한다.

## ③ 첫 판 완주 (First-round complete)

- **답하는 질문:** 들어온 사람이 **한 판을 끝까지** 해 보나? (게임이 첫 경험에서 붙잡나)
- **정의(집계):** `first_start[date]`, `first_done[date]`.
  - 「첫 판」= 이 브라우저에서 처음 시작한 판. `localStorage` 의 불리언 한 칸으로 판단하고, **그 칸은 서버로 가지 않는다.**
  - 「완주」= 제한 시간이 끝나거나 코스의 모든 항목을 점령해 결과 화면이 뜬 것. 중간에 나가기는 완주가 아니다.
  - 완주율 = `first_done / first_start`. 필요하면 코스 종류(구 / 동) 한 칸만 붙인다 — 특정 동 이름은 붙이지 않는다.
- **모으지 않는 것:** 공통 표 전부. 점수·CPM·정확도·오타 수·친 동 이름 목록. 순위표(`board`)와 잇지 않는다.
- **저장 후보:**
  - A. **일 카운터** — `(date, kind, stage) → n`. 추천.
  - B. 익명 세션 버킷 — 하루 한 번 바뀌는 salt 로 `hash(salt ‖ 난수)` 를 만들어 같은 날 start→done 만 잇고, **salt 는 자정에 버린다**. 날을 넘어 이어지지 않는다. A 로 모자랄 때만.
- **마케팅이 읽는 법:** 유입이 늘었는데 완주율이 떨어지면 「구경꾼만 왔다」 — 훅이 기대를 잘못 세웠다(T2/T3 카피 재검토). 완주율이 유지되면 채널이 맞는 사람을 데려온 것.
- **위험:** 브라우저 저장소를 지우는 사람은 「첫 판」이 여러 번 잡힌다(과대). 시크릿 창도 같다. 절대값이 아니라 **기간 대비 추세**로만 읽는다.
- **킬 스위치:** 공통 스위치. B 를 골랐다면 salt 생성을 끄는 즉시 해시가 안 만들어진다 — 남은 해시는 이미 하루 안에 쓸모가 없다.

## ④ 공유 (Share)

- **답하는 질문:** 해 본 사람이 남에게 보내나? (캠페인이 스스로 퍼지나)
- **정의(집계):** `share[date][target]` — 공유 버튼을 눌러 **공유 동작이 성공한** 수.
  - `target` 버킷: `native`(Web Share 시트), `copy`(링크 복사), `image`(결과 카드 저장, T4 `fix/4-share-916` 가 싣는다면).
  - Web Share 는 어느 앱으로 갔는지 알려 주지 않는다 — 알아내려 하지 않는다.
  - 돌아온 쪽은 ①의 `utm_source=share` 로 센다(공유 링크에 고정 UTM). 누가 누구를 데려왔는지는 잇지 않는다.
- **모으지 않는 것:** 공통 표 전부. 받는 사람, 메신저 종류, 결과 카드에 찍힌 점수·이름·동.
- **저장 후보:**
  - A. **일 카운터** — `(date, target) → n`. 추천.
  - B. 코드 없이 ①의 `share` 채널 유입만 보기 — 「공유 → 돌아온 방문」은 보이지만 버튼 누른 수는 모른다.
- **마케팅이 읽는 법:** 공유 / 첫 판 완주 비율이 곧 「퍼질 힘」. 이 값이 캠페인 중 오르면 훅이 결과 카드까지 이어진 것.
- **위험:** 공유 시트를 열었다 취소한 것을 성공으로 세면 부풀린다 → `navigator.share()` 가 resolve 된 경우만. 결과 카드 이미지에 이름이 들어가면 그 자체가 개인정보 노출 → 카드 쪽 결정은 T4 몫, 이 지표는 카드 **내용**을 보지 않는다.
- **킬 스위치:** 공통 스위치. 공유 버튼 자체는 스위치와 무관하게 계속 동작한다.

---

## 저장 방식 비교 (Storage options — 제안만, 배선 없음)

| 안 | 모양 | 개인정보 면 | 비용·손 | 비고 |
| --- | --- | --- | --- | --- |
| **S1 · 일 카운터** | `(date, metric, bucket) → n` 한 표 | 가장 안전. 행 하나가 여러 사람의 합 | 작음 | **추천.** 네 지표 모두 이걸로 된다 |
| S2 · 익명 세션 버킷 | S1 + 하루짜리 salt 해시로 같은 날 흐름만 잇기 | salt 를 매일 버리면 날을 넘어 못 잇는다 | 중간 | ③에서 S1 이 모자랄 때만 |
| S3 · 코드 0줄 | Cloudflare 존 대시보드 기존 통계 읽기 | 새로 모으는 것 없음 | 없음 | ①만 거칠게. ②~④ 불가 |
| ✗ 외부 SDK | GA·Amplitude 등 | 제3자에게 IP·기기 정보가 간다 | — | **쓰지 않는다** |

S1 을 고른다면 자리는 이미 있는 `relay/` Worker 뒤다(새 서버를 세우지 않는다). 다만 그 배선은
**이 PR 이 아니라** 도입 결정 뒤의 별도 티켓이고, 그때 backend · tester · security-reviewer 를 태운다.

## 보관·폐기 (Retention)

- 캠페인 창 종료 + 30일 뒤 일 카운터를 지운다(요약 표 한 장만 문서로 남긴다).
- S2 salt 는 매일 자정 폐기. 해시 원본을 백업하지 않는다.
- 하루 10 미만 칸은 대시보드·보고서에 「<10」으로만 적는다.

## 전역 킬 스위치 (Global kill switch)

- 스위치 하나로 네 지표 모두 즉시 멈춘다. 게임·순위표·피드백은 영향이 없어야 한다.
- 이런 때 누른다: 개인정보 문의·신고가 들어옴 / 숫자가 이상하게 튐(봇) / 캠페인 창 종료 / Parxang 판단.
- 켜고 끈 날짜를 이 문서 아래에 한 줄씩 적는다.

---

## 도입 여부

도입 여부는 박상현 결정. 이 PR은 구현하지 않음.

Parxang 선택:

- ☐ 도입 안 함 (문서로만 둠)
- ☐ S3 만 (코드 0줄, ① 거칠게)
- ☐ S1 일 카운터 — 지표: ☐ ① ☐ ② ☐ ③ ☐ ④
- ☐ S1 + S2 (③ 흐름 잇기 포함)
- 캠페인 창: `____-__-__` ~ `____-__-__`

## 가드레일 (Guardrails)

- Parxang 없이 머지·배포하지 않는다.
- 문서만. 제품 코드·데이터·`relay/`·Cloudflare 설정을 건드리지 않는다.
- 분석 SDK·추적 코드·새 바인딩을 이 PR 에 넣지 않는다.
- VER 을 올리지 않는다. `data/changes.json` 에 적지 않는다.

---

## EN twin (short)

**Judge the campaign with numbers, without PII. Definition doc only.**

- Scope: marketing window only; aggregate counts only; exactly four metrics —
  ① traffic (daily visits per fixed channel bucket), ② mobile exit (`pointer:coarse` land vs. start),
  ③ first-round complete (first start vs. result screen, first-ness kept client-side),
  ④ share (successful share actions per target; return visits via fixed `utm_source=share`).
- Never collected: raw IP, account id, precise GPS, keystroke content, names, full UA / referrer.
- Storage, proposed not wired: **S1 daily counters (recommended)**; S2 day-scoped salted hash buckets, salt discarded at midnight;
  S3 zero-code zone stats. No third-party SDK. Buckets under 10 shown as "<10"; delete 30 days after the window.
- One global kill switch stops all four without touching the game.
- Auto-implement = **NO**: no analytics SDK, no Cloudflare/GA assets, no tracking code. No VER bump, no `changes.json`.
- **Adoption is Parxang's call alone. This PR implements nothing.**
