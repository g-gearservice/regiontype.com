"""동네버스 베타(beta/bus)가 읽는 정류장 판을 찍어낸다 → data/bus.json

구마다 행정동 코스(*-dong.course.json)의 순서 그대로, 동 중심점(*-dong.drive.json 의 c)을
760×600 판에 투영하고, 정류장 이름표가 서로·정류장·손님 줄과 겹치지 않게 놓을 쪽(b·t·r·l)을 고른다.
도저히 안 되면 겹치는 정류장을 서로 밀어낸다(한 번에 4px, 합쳐 20px 까지).
한 줄 소개는 코스에 적힌 것만 옮긴다 — 지어내지 않는다.

    python3 tools/build_bus.py data/
"""
import itertools, json, math, random, re, sys
from pathlib import Path

out_dir = Path(sys.argv[1])
W, H = 760, 600
PALETTE = ["#f6c037", "#e8513a", "#3a9ad9", "#57b26a", "#ef8db5", "#a678d6", "#f08a3c", "#4fc1b4"]


def stem(n):
    return re.sub(r"본$", "", re.sub(r"동$", "", re.sub(r"[0-9·,]", "", n)))


def project(cs):
    lat0 = sum(c[1] for c in cs) / len(cs)
    k = math.cos(math.radians(lat0))
    lo, la = [c[0] for c in cs], [c[1] for c in cs]
    w, h = (max(lo) - min(lo)) * k or 1e-9, (max(la) - min(la)) or 1e-9
    s = min(680 / w, 520 / h)
    pts = [[40 + (c[0] - min(lo)) * k * s, 40 + (max(la) - c[1]) * s] for c in cs]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    dx, dy = W / 2 - (min(xs) + max(xs)) / 2, H / 2 - (min(ys) + max(ys)) / 2
    return [[round(x + dx), round(y + dy)] for x, y in pts]


def boxes(p, name, side):
    """이름표(14px 굵게), 손님 줄(90×14), 정류장 표지(38×38). 판의 운행 화면과 같은 치수다"""
    x, y = p
    w, h = 14.5 * len(name) + 6, 18
    lab = {"b": (x - w / 2, y + 24, x + w / 2, y + 24 + h), "t": (x - w / 2, y - 24 - h, x + w / 2, y - 24),
           "r": (x + 24, y - h / 2, x + 24 + w, y + h / 2), "l": (x - 24 - w, y - h / 2, x - 24, y + h / 2)}[side]
    strip = (x - 114, y - 7, x - 24, y + 7) if side == "r" else (x + 24, y - 7, x + 114, y + 7)
    return lab, strip, (x - 19, y - 19, x + 19, y + 19)


def hit(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def clashes(pts, names, sides):
    bx = [boxes(pts[i], names[i], sides[i]) for i in range(len(pts))]
    bad = []
    for i, (lab, strip, mark) in enumerate(bx):
        if lab[0] < 0 or lab[1] < 0 or lab[2] > W or lab[3] > H:
            bad.append((i, None))
        for j, (lab2, strip2, mark2) in enumerate(bx):
            if i == j:
                continue
            if hit(lab, mark2) or hit(lab, strip2) or (i < j and hit(lab, lab2)) or (i < j and hit(mark, mark2)):
                bad.append((i, j))
    return bad


def solve(pts, names, rng):
    best = None
    for _ in range(120):
        sides = [rng.choice("btrl") for _ in pts]
        c = len(clashes(pts, names, sides))
        for _ in range(400):
            if c == 0:
                return sides, 0
            i = rng.randrange(len(pts)); old = sides[i]; sides[i] = rng.choice("btrl")
            c2 = len(clashes(pts, names, sides))
            if c2 <= c:
                c = c2
            else:
                sides[i] = old
        if best is None or c < best[1]:
            best = (sides[:], c)
    return best


def layout(names, cs, rng):
    pts = project(cs)
    home = [p[:] for p in pts]
    for _ in range(6):
        sides, c = solve(pts, names, rng)
        if c == 0:
            return pts, sides
        # 걸린 정류장끼리 4px 씩 떼어 놓는다. 제자리에서 20px 넘게는 안 민다
        for i, j in clashes(pts, names, sides):
            if j is None:
                continue
            dx, dy = pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]
            d = math.hypot(dx, dy) or 1
            for k, sgn in ((i, 1), (j, -1)):
                nx, ny = pts[k][0] + sgn * 4 * dx / d, pts[k][1] + sgn * 4 * dy / d
                if math.hypot(nx - home[k][0], ny - home[k][1]) <= 20:
                    pts[k] = [round(min(W - 30, max(30, nx))), round(min(H - 30, max(30, ny)))]
    raise SystemExit(f"겹침을 못 풀었다: {names[0]} … ({c} 곳)")


SHAPES = ["square", "triangle", "diamond", "pentagon"]


def kinds(names, pts):
    """정류장 모양 = 동 집안. 번호로 갈린 동(화곡1·2·3…)은 한 집안이라 같은 모양이고, 큰 집안부터
    □ △ ◇ ⬠. 혼자인 동은 ○. 관악구처럼 집안이 거의 없어 모양이 셋이 안 되면, 혼자인 동들을
    구 한가운데를 둘러 권역(부채꼴)으로 나눠 남은 모양을 준다 — 손님이 갈 곳이 생긴다"""
    cnt, first = {}, {}
    for i, n in enumerate(names):
        cnt[stem(n)] = cnt.get(stem(n), 0) + 1; first.setdefault(stem(n), i)
    fams = sorted([k for k in cnt if cnt[k] > 1], key=lambda k: (-cnt[k], first[k]))[:len(SHAPES)]
    out = [SHAPES[fams.index(stem(n))] if stem(n) in fams else "circle" for n in names]
    singles = [i for i, k in enumerate(out) if k == "circle"]
    need = 3 - len(fams)
    if need > 1 and singles:
        spare = ["circle"] + SHAPES[len(fams):]
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        sector = lambda i: int(((math.atan2(pts[i][1] - cy, pts[i][0] - cx) + math.pi) / (2 * math.pi)) * need) % need
        for i in singles:
            out[i] = spare[sector(i)]
    return out


def first_open(kind, pts):
    """첫 정류장(버스가 서 있는 곳) + 서로 먼 둘. 모양이 셋 다 다르게 — 안 되면 둘이라도 섞이게"""
    best, bd = None, (-1, -1)
    for a, b in itertools.combinations(range(1, len(pts)), 2):
        t = (0, a, b)
        mix = len({kind[i] for i in t})
        if mix < 2:
            continue
        d = (mix, min(math.dist(pts[x], pts[y]) for x, y in itertools.combinations(t, 2)))
        if d > bd:
            best, bd = list(t), d
    return best


index = json.load(open(out_dir / "drive-index.json"))
index.sort(key=lambda d: d["c"][0])   # 서쪽 구부터 — 고르기 판의 띠를 서에서 동으로 늘어놓는다
out = []
for n, ent in enumerate(index):
    slug = ent["slug"]
    course = json.load(open(out_dir / f"{slug}.course.json"))
    drive = json.load(open(out_dir / f"{slug}.drive.json"))
    cen = {f["properties"]["name"]: f["properties"]["c"] for f in drive["features"]}
    items = course["items"]
    names = [it["name"] for it in items]
    pts, sides = layout(names, [cen[nm] for nm in names], random.Random(slug))
    kind = kinds(names, pts)
    out.append({
        "slug": slug.replace("-dong", ""),
        "name": names and course["title"].split()[0],
        "color": PALETTE[n % len(PALETTE)],
        "desc": course.get("description", ""),
        "stops": [[nm, pts[i][0], pts[i][1], sides[i], kind[i], (items[i].get("meta") or {}).get("description", "")]
                  for i, nm in enumerate(names)],
        "first": first_open(kind, pts),
    })
    print(f"{out[-1]['name']}: 정류장 {len(names)}곳")

json.dump({"districts": out}, open(out_dir / "bus.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("→", out_dir / "bus.json")
