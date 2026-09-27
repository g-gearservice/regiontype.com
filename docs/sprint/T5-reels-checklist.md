# T5 · Reels gate checklist

> Sprint process (docs only). EN primary. Short KO twin optional.
> Not a product-code change. No VER bump. Do not merge / deploy without Parxang.
> T5 partial: checklist + brief ship now; film + review still open.

---

**HARD RULE: a Reel cannot be marked APPROVED from a text description alone. Approval needs an attached clip path/link, the reviewer's initials, and a PASS/FAIL on every gate below.**

Review only after watching the clip itself, start to end. The shot spec is in [`T5-shot-brief.md`](T5-shot-brief.md).

---

## Gates

| # | Gate | Pass when | PASS | FAIL |
| --- | --- | --- | --- | --- |
| G1 | Real hands / human cadence | Real hands are visible, or the keystroke rhythm clearly reads as human WPM (uneven, with corrections) | ☐ | ☐ |
| G2 | No stock / AI hands | No stock, AI-generated or composited hands anywhere in the cut | ☐ | ☐ |
| G3 | Neighborhood hook | The hook is T2 H1 or on the T3 「내 동네」 axis. No copy-admission line | ☐ | ☐ |
| G4 | Vertical 9:16 | Delivered as 9:16, with the UI not cropped out | ☐ | ☐ |
| G5 | First-1s hook | The hook is on screen or spoken within the first second | ☐ | ☐ |
| G6 | Full short round | One continuous round (a district course or slice) is visible, not a montage-only cut | ☐ | ☐ |
| G7 | Real play, even if silent | Audio is optional. A silent clip still reads as real play, not aesthetic B-roll | ☐ | ☐ |
| G8 | Caption / on-screen text | Matches T2 / T3. Nothing from the T2 kill list or the T3 "don't use" list | ☐ | ☐ |
| G9 | Clearly regiontype | The UI shows Seoul neighborhood typing: dong names, course, input | ☐ | ☐ |

Any single FAIL makes the overall result FAIL. Fix it and re-review as a new entry in the log.

## Approval block

| Field | Value |
| --- | --- |
| Clip path/link | `____________________` (**required**) |
| Reviewer initials | `____` |
| Review date | `YYYY-MM-DD` |
| Gates G1–G9 | all marked ☐ yes ☐ no |
| Overall | ☐ PASS ☐ FAIL |
| Status | ☐ BLOCKED ☐ IN REVIEW ☐ APPROVED |

Status can't be **APPROVED** unless:

1. the clip path/link is filled and opens, and
2. every gate is marked, all PASS, and
3. reviewer initials and the date are filled in.

Log every review in [`T5-review-log.md`](T5-review-log.md).

## Guardrails

- No merge without Parxang.
- No deploy.
- No VER bump.
- Leave `img.png` and any stashes alone.
- Don't fabricate hand-play video. A described or generated clip isn't a clip.

---

## KO twin (short)

**글 설명만으로는 승인하지 않는다.** 클립 경로·링크, 검토자 이니셜, 게이트마다 PASS/FAIL 이 모두 있어야 APPROVED 다.
게이트 하나라도 FAIL 이면 전체 FAIL 이다.
