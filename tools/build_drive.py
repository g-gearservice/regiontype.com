"""3D 내비게이션(beta/3dnavigation)이 읽는 행정동 경계를 찍어낸다.

격자 판(geom.json)은 화면 좌표라 실제 지도에 못 얹는다. 같은 원본에서 위경도
경계를 그대로 꺼내, 코스(course.json)의 순서대로 늘어놓는다. 순서는 손대지 않는다 —
홈의 코스와 내비의 코스가 같은 길이어야 한다.

    curl -sL -o dong.json .../seoul_submunicipalities_geo_simple.json
    python3 tools/build_drive.py dong.json data/
"""
import json, sys
from pathlib import Path

dong_src, out_dir = sys.argv[1], Path(sys.argv[2])
feats = json.load(open(dong_src))["features"]


def key(name):
    # 코스는 '종로1,2,3,4가동', 원본은 '종로1·2·3·4가동' 으로 적는다
    return name.replace(",", "·").replace(".", "·")


def ring(g):
    return g["coordinates"][0] if g["type"] == "Polygon" else max((p[0] for p in g["coordinates"]), key=len)


def centroid(r):
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(r, r[1:] + r[:1]):
        k = x1 * y2 - x2 * y1
        a += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k
    return [round(cx / (3 * a), 6), round(cy / (3 * a), 6)]


def trim(g):
    # 소수 여섯 자리(≈10cm)면 넉넉하다
    r = lambda pts: [[round(x, 6), round(y, 6)] for x, y in pts]
    if g["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": [r(p) for p in g["coordinates"]]}
    return {"type": "MultiPolygon", "coordinates": [[r(p) for p in poly] for poly in g["coordinates"]]}


made = []
for course_path in sorted(out_dir.glob("*-dong.course.json")):
    course = json.load(open(course_path))
    names = [it["name"] for it in course["items"]]
    by = {}
    for f in feats:
        by.setdefault(key(f["properties"]["name"]), []).append(f)
    miss = [n for n in names if key(n) not in by]
    if miss:
        print(f"건너뜀 {course['slug']}: 원본에 없는 동 {miss}")
        continue
    # 신사동처럼 이름이 두 구에 걸치면, 이름이 하나뿐인 동들의 한가운데에 가까운 쪽을 고른다
    sure = [centroid(ring(by[key(n)][0]["geometry"])) for n in names if len(by[key(n)]) == 1]
    mx, my = sum(p[0] for p in sure) / len(sure), sum(p[1] for p in sure) / len(sure)
    out = []
    for n in names:
        f = min(by[key(n)], key=lambda f: (lambda c: (c[0] - mx) ** 2 + (c[1] - my) ** 2)(centroid(ring(f["geometry"]))))
        out.append({"type": "Feature",
                    "properties": {"name": n, "c": centroid(ring(f["geometry"]))},
                    "geometry": trim(f["geometry"])})
    dest = out_dir / f"{course['slug']}.drive.json"
    json.dump({"type": "FeatureCollection", "title": course["title"], "features": out},
              open(dest, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{dest.name}: {len(out)}곳")
    made.append({"slug": course["slug"], "title": course["title"], "n": len(out),
                 "c": [round(mx, 5), round(my, 5)]})

# 내비 패널의 구 목록. 가나다순
made.sort(key=lambda m: m["title"])
json.dump(made, open(out_dir / "drive-index.json", "w"), ensure_ascii=False, separators=(",", ":"))
