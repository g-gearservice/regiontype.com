"""리전 패스의 '구 모양 봇' — 서울 25구와 서울 전체의 실루엣을 봇 몸 윤곽(반지름 64개)으로 찍는다.

원본은 이미 찍어 둔 data/<구>-dong.drive.json(행정동 위경도 경계)이다. 동을 합치지 않고,
구의 무게중심에서 64 방향으로 반직선을 쏴 모든 동 경계와 만나는 가장 먼 점을 잡는다 —
그 거리가 그 방향의 반지름이다(합집합 없이 겉 실루엣만 남는다). 별꼴이 아닌 오목한 곳은
엔진이 받는 범위(0.4‥1.3) 안으로 눌린다. 마지막에 이웃 반지름과 한 번 고른다.

각도는 engine.js toPoints 와 같다: i/64 바퀴, 화면 좌표(y 가 아래). 위도 보정 등거리 투영.

    python3 tools/build_regions.py data/ assets/bloub/regions.js
"""
import json, math, sys
from pathlib import Path

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
N = 64
order = [i["name"] for i in json.load(open(src / "seoul-gu.course.json"))["items"]]
roman = json.load(open(src / "kr-names.json"))


def rings(path):
    out = []
    for f in json.load(open(path))["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        out += [p[0] for p in polys]
    return out


def profile(rs):
    lat0 = sum(y for r in rs for _, y in r) / sum(len(r) for r in rs)
    k = math.cos(math.radians(lat0))
    rs = [[(x * k, -y) for x, y in r] for r in rs]
    a = cx = cy = 0.0
    for r in rs:
        for (x1, y1), (x2, y2) in zip(r, r[1:] + r[:1]):
            c = x1 * y2 - x2 * y1
            a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c
    cx, cy = cx / (3 * a), cy / (3 * a)
    edges = [((x1 - cx, y1 - cy), (x2 - cx, y2 - cy)) for r in rs for (x1, y1), (x2, y2) in zip(r, r[1:] + r[:1])]
    radii = []
    for i in range(N):
        th = i / N * 2 * math.pi
        dx, dy = math.cos(th), math.sin(th)
        best = 0.0
        for (ax, ay), (bx, by) in edges:
            ex, ey = bx - ax, by - ay
            den = dx * ey - dy * ex
            if abs(den) < 1e-15:
                continue
            t = (ax * ey - ay * ex) / den
            u = (ax * dy - ay * dx) / den
            if t > 0 and 0 <= u <= 1:
                best = max(best, t)
        radii.append(best)
    # 한 번 [1 2 1] 로 고른다 — 동 경계의 잔톱니가 봇 크기에서는 지저깨비로 보인다. 구 꼴은 그대로 남는다
    radii = [(radii[i - 1] + 2 * radii[i] + radii[(i + 1) % N]) / 4 for i in range(N)]
    top = max(radii)
    return [round(min(1.3, max(0.4, r / top * 1.2)), 3) for r in radii]


files = {json.load(open(p))["title"].split()[0]: p for p in sorted(src.glob("*-dong.drive.json"))}
assert set(files) == set(order), set(order) ^ set(files)
out, every = [], []
for name in order:
    p = files[name]
    rs = rings(p)
    every += rs
    out.append({"id": p.name.split("-dong.")[0], "ko": name, "en": roman.get("seoul-gu/" + name, name), "radii": profile(rs)})
out.append({"id": "seoul", "ko": "서울", "en": "Seoul", "radii": profile(every)})

dst.write_text(
    "/* tools/build_regions.py 가 찍었다 — 손으로 고치지 않는다. 서울 25구(코스 순서)와 서울 전체의\n"
    "   실루엣을 봇 몸 윤곽(engine.js 의 반지름 64개)으로 옮긴 것. 원본은 data/<구>-dong.drive.json */\n"
    "export const REGIONS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(len(out), "regions →", dst)
