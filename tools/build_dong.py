"""서울 25개 자치구의 행정동 코스를 한 번에 찍어낸다.

지형은 build_map.py 를 구 코드로 필터해 그대로 돌린다 — 같은 격자, 같은 형식이라
비트맵과 mimi 양쪽이 손대지 않고 읽는다.

순서는 무게중심 최근접 이웃으로 잇는다. 손으로 고른 gangseo-dong 처럼 사연이
있는 순서는 아니지만, 서쪽 끝에서 시작해 옆 동으로 이어지는 길은 된다.

    curl -sL -o gu.json   .../seoul_municipalities_geo_simple.json
    curl -sL -o dong.json .../seoul_submunicipalities_geo_simple.json
    python3 tools/build_dong.py dong.json gu.json data/
"""
import json, math, re, subprocess, sys, unicodedata
from pathlib import Path

dong_src, gu_src, out_dir = sys.argv[1], sys.argv[2], Path(sys.argv[3])
# 격자는 구마다 다르게 잡는다. 폭을 1000 으로 고정해 놓으면 도봉구처럼 세로로 긴
# 구는 같은 칸 수에서도 줄이 두 배로 늘어 도트가 폭발한다. 채워진 도트 수를 보고
# 목표치에 닿는 첫 칸 수를 고른다 — 판마다 밀도가 비슷해야 글자 크기도 일정하다.
DOTS = int(sys.argv[4]) if len(sys.argv) > 4 else 700
COLS_MIN, COLS_MAX = 22, 40

HERE = Path(__file__).parent
gu = json.load(open(gu_src))["features"]
dong = json.load(open(dong_src))["features"]

# 손으로 쓴 코스는 덮어쓰지 않는다 — 한 줄 소개가 사람 손을 탄 것들이다
KEEP = {"gangseo-dong"}


def slug(name_eng, code):
    """Gangnam-gu → gangnam-dong. 영문명이 없으면 코드로 떨어진다."""
    s = re.sub(r"-gu$", "", (name_eng or "").strip().lower())
    s = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", s)).strip("-")
    return f"{s}-dong" if s else f"gu{code}-dong"


def order(items):
    """무게중심 최근접 이웃. 서쪽 끝에서 출발해 가장 가까운 다음 동으로 건너간다."""
    left = items[:]
    path = [min(left, key=lambda it: it["c"][0])]
    left.remove(path[0])
    while left:
        cx, cy = path[-1]["c"]
        nxt = min(left, key=lambda it: (it["c"][0] - cx) ** 2 + (it["c"][1] - cy) ** 2)
        left.remove(nxt)
        path.append(nxt)
    return path


made = []
for f in sorted(gu, key=lambda f: f["properties"]["code"]):
    code, name = f["properties"]["code"], f["properties"]["name"]
    s = slug(f["properties"].get("name_eng"), code)
    n = sum(1 for d in dong if d["properties"]["code"].startswith(code))
    if n < 2:
        print(f"건너뜀 {name}: 행정동 {n}개")
        continue

    geom_path = out_dir / f"{s}.geom.json"
    course_path = out_dir / f"{s}.course.json"
    if s in KEEP and course_path.exists():
        print(f"유지 {name}: {course_path.name} 은 손으로 쓴 코스다")
        continue

    for cols in range(COLS_MIN, COLS_MAX + 1, 2):
        subprocess.run([sys.executable, str(HERE / "build_map.py"),
                        dong_src, str(geom_path), str(cols), code],
                       check=True, stdout=subprocess.DEVNULL)
        geom = json.load(open(geom_path))
        dots = sum(len(r) - r.count(".") for r in geom["grid"])
        if dots >= DOTS:
            break

    names = [it["name"] for it in order(geom["items"])]
    json.dump({
        "slug": s,
        "title": f"{name} {len(names)}개 행정동",
        "description": f"{name}의 행정동 {len(names)}곳을 서쪽 끝에서 이웃한 동으로 이어 밟는다.",
        "mode": "sequence",
        "dataVersion": "2013-kostat",
        # 한 줄 소개는 사람이 쓸 자리다. 400곳을 지어낼 수는 없다
        "items": [{"name": n, "meta": {}} for n in names],
    }, open(course_path, "w"), ensure_ascii=False, separators=(",", ":"))
    made.append((s, name, len(names)))
    print(f"{name}: {len(names)}개 행정동 → {s} ({geom['cols']}x{geom['rows_n']}, 도트 {dots})")

print(f"\n{len(made)}개 코스")
print(json.dumps([{"slug": s, "gu": g, "n": n} for s, g, n in made], ensure_ascii=False))
