# regiontype — 서울 지도 에셋

디자인 시안과 프로토타입에 바로 쓸 수 있는 SVG 지도와 메타데이터.
좌표계 하나(`viewBox="0 0 1600 1200"`)를 모든 파일이 공유하므로 레이어를 겹쳐도 정확히 포개진다.

## 파일

| 파일 | 용량 | 내용 |
|---|---|---|
| `seoul-gu.svg` | 62 KB | 자치구 25개 |
| `seoul-dong.svg` | 92 KB | 행정동 423개 |
| `seoul-all.svg` | 153 KB | 행정동 + 자치구 외곽선 (권장) |
| `seoul-meta.json` | 81 KB | 카메라 좌표, 별칭, 부모 관계 |
| `build_map.py` | — | 재생성 스크립트 |

PRD 기준(자치구 50KB / 행정동 300KB) 대비 행정동은 여유가 크고, 자치구는 12KB 초과했다. 필요하면 `build_map.py`의 `tol` 값을 올려 더 줄일 수 있다.

## SVG 구조

```html
<svg viewBox="0 0 1600 1200">
  <g id="dong">
    <path data-code="1123078" data-name="청담동" data-parent="11680"
          class="rt-region rt-dong" d="M..."/>
  </g>
  <g id="gu-outline">
    <path data-code="11680" data-name="강남구"
          class="rt-gu-outline" d="M..."/>
  </g>
</svg>
```

모든 구역이 개별 `<path>`다. `data-code`로 지목하고, `data-parent`로 소속 자치구를 건다. 다중 폴리곤(섬·비지)은 `id`에 `-0`, `-1` 접미사가 붙는다.

## 상태 적용

```css
.rt-dong                          { fill: var(--map-untouched-fill);
                                    stroke: var(--map-untouched-stroke); }
.rt-dong.is-captured              { fill: var(--map-captured-fill);
                                    stroke: var(--map-captured-stroke); }
.rt-dong.is-active                { fill: var(--map-active-fill);
                                    stroke: var(--map-active-stroke); }
.rt-dong:not([data-parent="11680"]) { opacity: var(--map-ambient-opacity); }
```

`stroke`를 모든 상태에 유지해야 같은 상태의 인접 구역이 한 덩어리로 뭉치지 않는다.

## 카메라

`seoul-meta.json`의 `bbox`를 `viewBox`에 넣으면 그 구역으로 확대된다.

```js
const { bbox } = meta.gu["11680"];        // 강남구
const [x0, y0, x1, y1] = bbox;
const pad = (x1 - x0) * 0.12;
svg.setAttribute("viewBox",
  `${x0-pad} ${y0-pad} ${x1-x0+2*pad} ${y1-y0+2*pad}`);
```

행정동까지 완전히 확대하지 않고 상위 자치구가 화면을 채우는 수준에서 멈춘다. 목표 행정동은 강조하고 같은 구의 이웃은 그대로 두어 위치 감각을 유지한다.

`centroid`는 라벨 배치와 이동 거리 계산(모션 지속시간 스케일링)에 쓴다.

## 별칭

행정 단위 접미사 제거와 법정동 이름을 자동 생성한다.

```
역삼1동  →  역삼, 역삼1, 역삼1동, 역삼동
청담동   →  청담, 청담동
강남구   →  강남, 강남구
```

`역삼1동`에 법정동 `역삼동`이 별칭으로 들어간 것이 핵심이다. 사용자는 일상적으로 법정동 이름을 쓰기 때문이다.

## 데이터 출처

통계청 2013년 행정동 경계 (`southkorea/seoul-maps`).
자치구 외곽선은 행정동을 합집합으로 합성해 만들었다. 서로 다른 기준연도를 섞으면 경계가 어긋나므로, 한 출처에서 파생시켜 완전한 포개짐을 보장했다.

투영은 등장방형에 서울 중심위도(37.5665°) 경도 보정을 적용했다. 도시 규모에서 충분하다.

## 반드시 처리해야 할 것

**행정동 데이터가 2013년 기준이다.** 13년이 지났고 그동안 통폐합이 여러 차례 있었다. 시안 작업에는 문제없지만 출시 전에 서울열린데이터광장의 최신 경계로 교체해야 한다. 교체 시 `build_map.py`의 입력만 바꾸면 되고, 나머지 파이프라인은 그대로 쓸 수 있다.

**별칭은 검수가 필요하다.** 자동 생성이라 `종로1·2·3·4가동` 같은 예외에서 `종로`가 누락된다. 동명 행정동(신사동 — 강남·관악·은평)의 처리 규칙도 별도로 정해야 한다.

**배점(`weight`)이 비어 있다.** 인지도 역수로 배점을 차등하는 설계인데, 인지도 점수는 수동으로 부여해야 한다.

## 재생성

```bash
pip install shapely cairosvg
python3 build_map.py
```
