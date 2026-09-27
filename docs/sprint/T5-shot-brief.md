# T5 · Shot brief: fast-hand play film

> Sprint process (docs only). EN primary. Short KO twin optional.
> Not a product-code change. No VER bump. Do not merge / deploy without Parxang.
> T5 partial: checklist + brief ship now; film + review still open.

---

## Purpose

This brief says what to film for the first regiontype Reel, so the review has a real clip to judge.
A Reel is never approved from a written description. See [`T5-reels-checklist.md`](T5-reels-checklist.md).

Filming is **pending Parxang**. No clip exists yet, so nothing in this doc describes one.

## What to film

| Item | Spec |
| --- | --- |
| Subject | Real human hands typing fast on regiontype, on a real device and keyboard |
| Content | One full short round: one district course (구) or a short slice of it, from the start to a visible finish or result |
| Aspect | Vertical **9:16**. Shoot with the phone held vertically, or crop to 9:16 without cutting off the UI |
| Duration | **Target 20s**. Hard range 15–30s |
| Pace | Real play speed. Typos, backspaces and retries are fine if they're human |
| Framing | Keep enough UI in frame that it's clearly regiontype, Seoul neighborhood typing: dong names, the course, the input |

## Hook and positioning

- **First second:** T2 H1.
  - KO: 「서울 지도 다 채웠어요? 그럼 우리 동 이름은 칠 수 있어요?」
  - EN: "Filled the whole Seoul map? Now can you type your own dong?"
- **Axis:** T3 「내 동네」. 25 districts and 400+ administrative + legal dongs. The pitch is local pride, not a map-fill race.
- On-screen text and captions come from T2 [`T2-replacement-hooks.md`](T2-replacement-hooks.md) and T3 [`T3-copy-home-og-hooks.md`](T3-copy-home-og-hooks.md). Nothing on the T2 kill list.
- Best choice of course: the filmer's own 구, so the pride is real.

## Do / Don't

| Do | Don't |
| --- | --- |
| Show real hands on a real keyboard or phone | Use stock, AI-generated or composited hands |
| Keep a visible keystroke rhythm that looks like human WPM | Film a silent "aesthetic typing" montage or ASMR B-roll |
| Play one continuous short round | Stitch highlights into a montage-only cut |
| Keep mistakes when they happen | Script-type a fixed line to look perfect |
| Open on the H1 hook in the first 1s | Open on a logo card or a slow build |
| Keep keyboard sound if you like (audio is optional) | Add any copy, clone or "knockoff" line (T2 kill list) |
| Frame dong names so they're readable | Frame only a map filling up as the payoff (T3) |

## Setup

- Phone vertical on a stand, or a screen capture plus a hands cam, composed to 9:16.
- Light the hands and the screen evenly, with no glare over the input.
- Run the live site as-is. Don't change the product for the shoot.

## Output

Put the clip where the reviewer can open it, then log it:

- Clip path/link: `<TBD: Drive / Reels draft link, or a local path outside the repo>`
- Don't commit video files to this repo.
- Add a row to [`T5-review-log.md`](T5-review-log.md) with the link. Review runs against the checklist.

## Guardrails

- No merge without Parxang.
- No deploy.
- No VER bump. Nothing goes in `data/changes.json`.
- Leave `img.png` and any stashes alone.
- Don't fabricate hand-play video. No AI or stock clip stands in for the real film.

---

## KO twin (short)

실제 손으로, 실제 기기에서 regiontype 한 판을 빠르게 치는 세로 9:16 영상을 찍는다. 20초 목표, 15–30초 안.
첫 1초는 H1 「서울 지도 다 채웠어요? 그럼 우리 동 이름은 칠 수 있어요?」로 연다. 축은 「내 동네」다.
무음 감성 타이핑 몽타주, 스톡·AI 손은 쓰지 않는다. 촬영은 Parxang 대기 중이다.
