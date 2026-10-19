"""동네버스 베타(beta/bus)의 운행 판 바닥 — 실제 서울의 강·하천·산·공원을 찍어낸다 → data/bus-terrain/<구>.json

OpenFreeMap 벡터 타일(OpenStreetMap 기반, 키 없음)에서 water·waterway·landcover·park·mountain_peak 층만 읽어,
build_bus.py 가 bus.json 에 적어 둔 구별 투영식(xf)으로 760×600 판 좌표에 올린다. 정류장이 놓인 식과 같아서
강이 정류장 옆에서 실제 자리로 흐른다. 판 밖으로 창이 넓어져도 맨바닥이 보이지 않게 판 둘레 [-400,1160]×[-240,840] 까지 싣는다.
작은 조각은 버리고, 남은 것은 Douglas-Peucker 로 줄인다.

    python3 tools/build_terrain.py data/ [타일 캐시 폴더]

타일은 내려받아 캐시 폴더에 둔다(기본: 임시 폴더). 같은 타일은 다시 받지 않는다.
출처 표기: © OpenFreeMap © OpenStreetMap contributors (ODbL).
"""
import gzip, json, math, os, sys, tempfile, time, urllib.request
from pathlib import Path

out_dir = Path(sys.argv[1])
cache = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(tempfile.gettempdir()) / "rt-terrain-tiles"
UA = "regiontype-terrain-build/1.0 (https://regiontype.com)"
RECT = (-400, -240, 1160, 840)               # 판 좌표 — 이 안만 싣는다
KEEP = {"water", "waterway", "landcover", "park", "mountain_peak"}
MIN_AREA = {"water": 40, "green": 320}        # px² 보다 작은 조각은 버린다
MIN_LINE = 40                                 # px 보다 짧은 하천은 버린다(가는 지류·배수로는 처음부터 안 읽는다)


# ── 타일 받기 ────────────────────────────────────────────────────────────────
def tile_url():
    meta = json.load(urllib.request.urlopen(urllib.request.Request("https://tiles.openfreemap.org/planet", headers={"User-Agent": UA}), timeout=30))
    return meta["tiles"][0]


def get_tile(url, z, x, y):
    f = cache / str(z) / str(x) / f"{y}.pbf"
    if not f.exists():
        f.parent.mkdir(parents=True, exist_ok=True)
        for tr in range(4):
            try:
                req = urllib.request.Request(url.format(z=z, x=x, y=y), headers={"User-Agent": UA})
                data = urllib.request.urlopen(req, timeout=60).read()
                f.write_bytes(data)
                time.sleep(0.12)
                break
            except Exception as e:
                if tr == 3:
                    raise
                time.sleep(2 * (tr + 1))
    raw = f.read_bytes()
    return gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw


# ── MVT 풀기(필요한 만큼만) ──────────────────────────────────────────────────
def varint(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1
        r |= (c & 0x7F) << s; s += 7
        if c < 0x80:
            return r, i


def fields(b):
    i = 0
    while i < len(b):
        k, i = varint(b, i)
        f, w = k >> 3, k & 7
        if w == 0:
            v, i = varint(b, i)
        elif w == 2:
            n, i = varint(b, i); v = b[i:i + n]; i += n
        elif w == 1:
            v = b[i:i + 8]; i += 8
        elif w == 5:
            v = b[i:i + 4]; i += 4
        else:
            raise ValueError("wire " + str(w))
        yield f, w, v


def packed(b):
    i, out = 0, []
    while i < len(b):
        v, i = varint(b, i); out.append(v)
    return out


zz = lambda n: (n >> 1) ^ -(n & 1)


def value(b):
    for f, w, v in fields(b):
        if f == 1:
            return v.decode()
        if f in (4, 5):
            return v
        if f == 6:
            return zz(v)
        if f == 7:
            return bool(v)
        if f == 3:
            import struct
            return struct.unpack("<d", v)[0]
        if f == 2:
            import struct
            return struct.unpack("<f", v)[0]


def geometry(cmds):
    parts, cur, x, y, i = [], None, 0, 0, 0
    while i < len(cmds):
        c = cmds[i]; i += 1
        cid, n = c & 7, c >> 3
        if cid == 7:
            if cur:
                cur.append(cur[0])
            continue
        for _ in range(n):
            x += zz(cmds[i]); y += zz(cmds[i + 1]); i += 2
            if cid == 1:
                cur = [[x, y]]; parts.append(cur)
            else:
                cur.append([x, y])
    return parts


def decode(b):
    """→ {층: [(속성, 종류(1점·2선·3면), 조각들, extent)]} — 필요한 층만"""
    out = {}
    for f, w, lay in fields(b):
        if f != 3:
            continue
        name, keys, vals, feats, ext = "", [], [], [], 4096
        for lf, lw, lv in fields(lay):
            if lf == 1: name = lv.decode()
            elif lf == 2: feats.append(lv)
            elif lf == 3: keys.append(lv.decode())
            elif lf == 4: vals.append(value(lv))
            elif lf == 5: ext = lv
        if name not in KEEP:
            continue
        for fb in feats:
            tags, typ, geo = [], 0, []
            for ff, fw, fv in fields(fb):
                if ff == 2: tags = packed(fv)
                elif ff == 3: typ = fv
                elif ff == 4: geo = packed(fv)
            props = {keys[tags[j]]: vals[tags[j + 1]] for j in range(0, len(tags), 2)}
            out.setdefault(name, []).append((props, typ, geometry(geo), ext))
    return out


# ── 좌표·자르기·줄이기 ───────────────────────────────────────────────────────
def to_px(xf, z, tx, ty, ext, px, py):
    n = 2 ** z
    lon = (tx + px / ext) / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (ty + py / ext) / n))))
    lon0, lat1, ax, ay, bx, by = xf
    return [bx + (lon - lon0) * ax, by + (lat1 - lat) * ay]


def clip_ring(ring):
    """Sutherland–Hodgman — 네 변을 차례로"""
    x0, y0, x1, y1 = RECT
    for axis, lim, keep_lt in ((0, x1, True), (0, x0, False), (1, y1, True), (1, y0, False)):
        inside = (lambda p: p[axis] <= lim) if keep_lt else (lambda p: p[axis] >= lim)
        out = []
        for k in range(len(ring)):
            a, b = ring[k - 1], ring[k]
            ia, ib = inside(a), inside(b)
            if ia != ib:
                t = (lim - a[axis]) / ((b[axis] - a[axis]) or 1e-9)
                out.append([lim, a[1] + t * (b[1] - a[1])] if axis == 0 else [a[0] + t * (b[0] - a[0]), lim])
            if ib:
                out.append(b)
        ring = out
        if not ring:
            return []
    return ring


def clip_line(pts):
    """선은 점 단위로 — 판 밖의 점은 끊는다(둘레가 넉넉해 어긋남이 안 보인다)"""
    x0, y0, x1, y1 = RECT
    runs, cur = [], []
    for p in pts:
        if x0 <= p[0] <= x1 and y0 <= p[1] <= y1:
            cur.append(p)
        elif cur:
            runs.append(cur); cur = []
    if cur:
        runs.append(cur)
    return runs


def dp(pts, eps):
    if len(pts) < 3:
        return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy) or 1e-9
    m, mi = -1, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / L
        if d > m:
            m, mi = d, i
    if m <= eps:
        return [pts[0], pts[-1]]
    return dp(pts[:mi + 1], eps)[:-1] + dp(pts[mi:], eps)


def dp_ring(r, eps):
    """닫힌 고리는 시작점=끝점이라 그대로 줄이면 선분 하나로 오므라든다 — 시작점에서 가장 먼 점에서 둘로 쪼갠다"""
    r = r[:-1] if len(r) > 1 and r[0] == r[-1] else r
    if len(r) < 4:
        return r
    k = max(range(len(r)), key=lambda i: math.dist(r[0], r[i]))
    return dp(r[:k + 1], eps)[:-1] + dp(r[k:] + [r[0]], eps)[:-1]


def area(r):
    return abs(sum(r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1] for i in range(len(r)))) / 2


def d_of(rings, close):
    s = ""
    for r in rings:
        s += "M" + "L".join(f"{round(p[0])} {round(p[1])}" for p in r) + ("Z" if close else "")
    return s


# ── 구 하나 ──────────────────────────────────────────────────────────────────
def build(d, url):
    xf = d["xf"]
    lon0, lat1, ax, ay, bx, by = xf
    z = 14 if 111320 / ay < 6 else 13               # 판이 더 확대된 작은 구는 한 단계 더 자세한 타일
    n = 2 ** z
    lons = [lon0 + (x - bx) / ax for x in (RECT[0], RECT[2])]
    lats = [lat1 - (y - by) / ay for y in (RECT[1], RECT[3])]
    tx = lambda lon: int((lon + 180) / 360 * n)
    ty = lambda lat: int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    water, rivers, green, peaks = [], [], [], []
    for x in range(tx(min(lons)), tx(max(lons)) + 1):
        for y in range(ty(max(lats)), ty(min(lats)) + 1):
            for layer, feats in decode(get_tile(url, z, x, y)).items():
                for props, typ, parts, ext in feats:
                    cls = props.get("class", "")
                    pp = [[to_px(xf, z, x, y, ext, px, py) for px, py in part] for part in parts]
                    if layer in ("water", "park", "landcover") and typ == 3:
                        kind = "water" if layer == "water" else "green"
                        if kind == "green" and not (layer == "park" or cls in ("wood", "grass")):
                            continue
                        if kind == "water" and cls in ("ocean", "sea"):
                            continue
                        rings = []
                        for r in pp:
                            c = clip_ring(r)
                            if len(c) >= 3 and area(c) >= (6 if rings else MIN_AREA[kind]):
                                rings.append(dp_ring(c, 0.7))
                        if rings and area(rings[0]) >= MIN_AREA[kind]:
                            (water if kind == "water" else green).append(d_of(rings, True))
                    elif layer == "waterway" and typ == 2 and cls in ("river", "canal"):
                        for r in pp:
                            for run in clip_line(r):
                                ln = sum(math.dist(run[i - 1], run[i]) for i in range(1, len(run)))
                                if ln >= MIN_LINE:
                                    rivers.append([cls, d_of([dp(run, 0.7)], False)])
                    elif layer == "mountain_peak" and typ == 1 and props.get("name"):
                        p = pp[0][0]
                        if RECT[0] <= p[0] <= RECT[2] and RECT[1] <= p[1] <= RECT[3]:
                            peaks.append([round(p[0]), round(p[1]), props.get("ele") or 0])
    # 타일 경계에서 겹쳐 두 번 실린 봉우리·하천은 하나만
    peaks = sorted({(p[0] // 6, p[1] // 6): p for p in peaks}.values(), key=lambda p: -p[2])[:14]
    seen, rv = set(), []
    for c, dd in rivers:
        if dd not in seen:
            seen.add(dd); rv.append([c[0], dd])
    return {"water": sorted(set(water)), "river": rv, "green": sorted(set(green)), "peak": [[p[0], p[1]] for p in peaks]}


if __name__ == "__main__":
    index = json.load(open(out_dir / "bus.json"))["districts"]
    only = sys.argv[3:] if len(sys.argv) > 3 else None
    url = tile_url()
    (out_dir / "bus-terrain").mkdir(exist_ok=True)
    for d in index:
        if only and d["slug"] not in only:
            continue
        t = build(d, url)
        f = out_dir / "bus-terrain" / f"{d['slug']}.json"
        json.dump(t, open(f, "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{d['name']}: 물 {len(t['water'])} 하천 {len(t['river'])} 녹지 {len(t['green'])} 봉우리 {len(t['peak'])} → {f.stat().st_size // 1024}KB")
