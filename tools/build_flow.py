"""흐름(beta/flow)이 읽는 서울 25개 자치구 경계를 찍어낸다.

격자 판(seoul-gu.geom.json)은 칸이라 서울 모양이 안 나온다. 같은 통계청 2013 원본에서
구 경계를 꺼내 화면 좌표(가로 1000)로 펴고, 코스(seoul-gu.course.json)의 순서대로 늘어놓는다.
이웃 구가 맞닿은 꼭짓점은 원본에서 같은 좌표라, 반올림해도 같은 값으로 남는다 —
흐름은 그 겹친 꼭짓점으로 이웃을 찾는다.

    curl -sL -o gu.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
    python3 tools/build_flow.py gu.json data/
"""
import json, math, sys
from pathlib import Path

src, out_dir = sys.argv[1], Path(sys.argv[2])
feats = {f["properties"]["name"]: f for f in json.load(open(src))["features"]}
names = [it["name"] for it in json.load(open(out_dir / "seoul-gu.course.json"))["items"]]
miss = [n for n in names if n not in feats]
if miss:
    sys.exit(f"원본에 없는 구 {miss}")


def polys(g):
    return [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]


# 서울 위도에서 경도 1도는 위도 1도보다 짧다 — 가운데 위도의 cos 으로 눌러 편다
pts = [p for n in names for poly in polys(feats[n]["geometry"]) for ring in poly for p in ring]
x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
kx = math.cos(math.radians((y0 + y1) / 2))
W = 1000.0
s = W / ((x1 - x0) * kx)
H = round((y1 - y0) * s, 1)
proj = lambda p: [round((p[0] - x0) * kx * s, 1), round((y1 - p[1]) * s, 1)]


def centroid(r):
    a = cx = cy = 0.0
    for (x1_, y1_), (x2, y2) in zip(r, r[1:] + r[:1]):
        k = x1_ * y2 - x2 * y1_
        a += k; cx += (x1_ + x2) * k; cy += (y1_ + y2) * k
    return [round(cx / (3 * a), 1), round(cy / (3 * a), 1)]


items = []
for n in names:
    # 바깥 고리만 쓴다(구에는 구멍이 없다). 닫는 꼭짓점(처음과 같은 것)은 뺀다
    rings = [[proj(p) for p in poly[0][:-1]] for poly in polys(feats[n]["geometry"])]
    items.append({"name": n, "c": centroid(max(rings, key=len)), "rings": rings})

out = out_dir / "seoul-gu.flow.json"
out.write_text(json.dumps({"w": W, "h": H, "items": items}, ensure_ascii=False, separators=(",", ":")))
print(f"{out}  {len(items)}개 구  {sum(len(r) for it in items for r in it['rings'])}개 꼭짓점")
