# T2 · Hook kill list — retire copy-admission hooks

> Sprint note (docs only). KO primary. Short EN twin at the end.
> Not a product-code change. No VER bump. Do not merge / deploy without Parxang.

---

## 목적 (Purpose)

「우리가 베꼈다」를 말하는 마케팅 훅을 전부 내린다.
이 문서가 T2의 산출물이다 — 앞으로 훅·캡션·OG·소개 문구를 쓸 때 아래 목록에 걸리면 쓰지 않는다.

## 킬 1순위 (Explicit kill)

> ~~「미니 모터웨이즈라는 게임 배끼다가 망했더니…」~~

이 문장과 같은 틀의 변형은 모두 퇴역한다.

- 「미니 모터웨이즈」 등 남의 게임 이름을 **출발점**으로 세우는 문장
- 「배끼다 / 베끼다가」 — 복제를 스스로 인정하는 동사
- 「망했더니… / 실패했더니…」 — 실패담을 훅의 엔진으로 쓰는 전개

## 같이 내리는 것 (Also kill)

| 패턴 | 예시 (쓰지 않음) |
| --- | --- |
| 짭 자백 | 「우리는 짭이에요」, 「짭인데 더 재밌음」 |
| ripoff / clone 자처 | 「metrotyping 한국판」, 「○○ 클론」, 「ripoff 인정합니다」 |
| 베꼈다가 실패 → 반전 서사 | 「X 베꼈다가 망해서 이렇게 됐습니다」 |
| metrotyping 과 맵-필 경주 | 「누가 먼저 서울 다 채우나」, 「치면 지도가 채워진다」를 1순위 훅으로 |
| 뒤늦은 합류 체념 | 「유행 다 지났지만…」, 「늦었지만 저희도 해봤어요」, 「막차 탑니다」 |

맵-필 경주는 T3 「이제 그만 하는 말」과 겹친다. T2는 **복제·자백·체념** 축을, T3은 **포지셔닝** 축을 맡는다.

## 왜 지금 (Why kill now)

- **파도가 식는 중.** metrotyping 은 2026년 7월 중순이 정점이었다
  (Reels 약 220만, X 약 639만). 지금은 내려오는 쪽이다.
- **클론 소음.** metrotyping.org / .net / .online 등 복제 사이트가 여럿이다.
  이 소음 속에서 「우리도 베꼈다」고 말하면 **또 하나의 클론**으로 분류된다.
- **자백은 차별화를 지운다.** regiontype 의 축은 「내 동네」(25개 자치구, 행정동·법정동 400+) 인데,
  복제 서사가 앞에 서면 그 축이 들리지 않는다. 동네 자부심 대신 「짭」만 남는다.

## 범위 (Scope)

- 이 티켓은 **문서만** 만든다. 제품 UI 문자열(`data/i18n.json`, `index.html`, OG 메타)은
  이 티켓에서 바꾸지 않는다 — 나중 티켓이 요청할 때 바꾼다.
- 이 파일 자체가 킬-리스트 산출물이다.
- 대체 훅은 [`T2-replacement-hooks.md`](T2-replacement-hooks.md).
- 포지셔닝은 T3 `docs/sprint/T3-*.md` (branch `docs/3-neighborhood`, PR #54) 를 참고한다.
  T3 머지를 기다리지 않는다 — 참조만 한다.

## 가드레일 (Guardrails)

- Parxang 없이 머지·배포하지 않는다.
- 문서만. 제품 코드·데이터를 건드리지 않는다.
- VER 을 올리지 않는다. `data/changes.json` 에도 적지 않는다(사용자 눈에 보이는 변경이 아님).

---

## EN twin (short)

**Retire every hook that admits we copied someone.**

- Kill: 「미니 모터웨이즈라는 게임 배끼다가 망했더니…」 ("We tried ripping off Mini Motorways, flopped, so…") and any variant.
- Also kill: "we're a knockoff", "Korean metrotyping", clone/ripoff self-labels,
  "copied X, failed, so…" arcs, map-fill races against metrotyping, and late-to-the-party resignation.
- Why now: metrotyping peaked mid-July 2026 (Reels ~2.2M, X ~6.39M) and is cooling;
  metrotyping.org / .net / .online add clone noise. Confessing a copy files us as one more clone
  and buries the real axis — *my neighborhood* (25 districts, 400+ admin + legal dongs).
- Docs only; UI strings change only if a later ticket asks. See T3 `docs/sprint/T3-*.md` (PR #54) for positioning.
- No merge / deploy without Parxang. No VER bump.
