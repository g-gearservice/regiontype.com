# T3 · Copy drafts — home / OG / hooks

> Sprint drafts on the **「내 동네」** axis. KO first; short EN optional.
> Docs only — product strings land in a later ticket if Parxang picks a line.
> Do not merge / deploy without Parxang.

Current live (for contrast, not to keep as the lead):

- `<title>` / pageTitle: `서울 얼마나 아세요?`
- `og:description`: `25개 자치구부터 423개 행정동까지. 타이핑으로 서울을 완성하세요.`
- meta description: `지역을 타이핑으로 알리는 타자연습. 서울 25개 자치구부터.`

「완성하세요」는 맵-필 훅에 가깝다. 아래 초안은 그 축을 내린다.

---

## 1. Home — hero / sub

### A · 추천 (동네 자부심)

- **Hero:** 내 동네, 칠 수 있어요?
- **Sub:** 서울 25개 구 · 행정동·법정동 400+ · 우리 구부터

### B · 구 시리즈 진입

- **Hero:** 우리 구부터 치세요
- **Sub:** 25개 자치구 시리즈. 동은 행정동과 법정동, 둘 다.

### C · 증명형

- **Hero:** 내가 사는 곳을 타이핑으로
- **Sub:** 구를 고르고, 동 이름을 친다. 지도를 채우려고가 아니라.

### D · 짧은 브랜드형

- **Hero:** 내 동네 타자
- **Sub:** regiontype — 서울 사람용 지명 타자연습

**EN (optional twins)**

| KO hero | EN |
| --- | --- |
| 내 동네, 칠 수 있어요? | Can you type your neighborhood? |
| 우리 구부터 치세요 | Start with your district |
| 내가 사는 곳을 타이핑으로 | Type the place you live |
| 내 동네 타자 | Neighborhood typing |

---

## 2. OG — title / description

링크 미리보기(카톡·DM·X). 제목은 짧게, 설명에 숫자·축을 넣는다.

### OG A · 추천

- **og:title:** `regiontype — 내 동네, 칠 수 있어요?`
- **og:description:** `서울 25개 구, 행정동·법정동 400+. 우리 동네 이름을 타이핑으로.`

### OG B

- **og:title:** `regiontype — 내 동네 타자`
- **og:description:** `25개 자치구 시리즈. 행정동 423 · 법정동 467. 맵 필이 아니라 동네 자부심.`

### OG C · 숫자 전면

- **og:title:** `regiontype — 서울 25구 · 동 400+`
- **og:description:** `우리 구부터. 행정동과 법정동, 두 겹의 동네를 친다.`

**meta description (검색용, 한 줄)**

- `서울 내 동네를 치는 타자연습. 25개 자치구, 행정동·법정동 400+.`

**twitter:** og와 동일 문구 재사용.

**EN (optional)**

- title: `regiontype — Can you type your neighborhood?`
- description: `Seoul’s 25 districts and 400+ dongs — administrative and legal. Type your place, not a map-fill clone.`

---

## 3. Hooks / captions (3–5)

숏폼·커뮤니티·공유 카드용. 한 줄 훅 + 필요 시 한 줄 받침.

1. **우리 동 이름, 바로 칠 수 있어?**
   - 받침: 서울 행정동·법정동 400+. regiontype
2. **강남구만 아는 서울은 반쪽**
   - 받침: 25개 구 시리즈 — 우리 구부터
3. **행정동으로 한 판, 법정동으로 한 판**
   - 받침: 같은 구, 다른 동네 지도
4. **지도 채우기 말고, 내 동네 증명**
   - 받침: 타이핑으로 확인하는 서울
5. **「우리 동네」가 코스다**
   - 받침: regiontype · 서울 사람용 지명 타자

**쓰지 않는 훅 (T3)**

- 치면 지도가 채워진다 / 서울을 완성하세요
- 미니 모터웨이즈·복제·자기비하 서사 (T2)
- 맵-필 장르 선점 주장

**EN captions (optional)**

1. Can you type your dong’s name cold?
2. Start with *your* district — 25 in the series.
3. One round admin dongs, one round legal dongs.
4. Not map-fill. Neighborhood proof.
5. Your neighborhood is the course.

---

## 4. Pick sheet (for Parxang)

| Slot | Lean | Candidate |
| --- | --- | --- |
| Home hero | A | 내 동네, 칠 수 있어요? |
| Home sub | A | 서울 25개 구 · 행정동·법정동 400+ · 우리 구부터 |
| OG title | A | regiontype — 내 동네, 칠 수 있어요? |
| OG description | A | 서울 25개 구, 행정동·법정동 400+. 우리 동네 이름을 타이핑으로. |
| Share hook | 1 or 4 | 우리 동 이름… / 지도 채우기 말고… |

제품 문자열(`data/i18n.json`, `index.html` meta) 반영은 이 PR 밖.
이 문서는 카피 후보만 고정한다.
