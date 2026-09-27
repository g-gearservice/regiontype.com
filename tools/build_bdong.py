"""서울 25개 자치구의 법정동 코스를 찍어낸다. 행정동 코스(build_dong.py)의 짝이다.

명단은 서울시 '자치구별 동 현황'(행정동 427 · 법정동 467) 표가 정하고, 경계는
도로명주소 법정동 도형(juso 2015)에서 가져와 표와 이름을 맞춘다. 표에 없는 도형,
도형 없는 표 이름이 나오면 멈춘다 — 조용히 빠지거나 끼어들지 않게.

    curl -sL -o aut.html https://www.seoul.go.kr/seoul/autonomy_sub.do
    curl -sL -o bdong.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/juso/2015/json/seoul_neighborhoods_geo_simple.json
    python3 tools/build_bdong.py aut.html bdong.json data/

슬러그는 행정동 코스에서 딴다(gangnam-dong → gangnam-bdong). 순서는 build_dong 과
같은 무게중심 최근접 이웃이고, 각 법정동에 그 땅을 나눠 가진 행정동을 meta.admin 에 둔다.
"""
import html, json, re, subprocess, sys, tempfile
from pathlib import Path

page, geo_src, out_dir = sys.argv[1], sys.argv[2], Path(sys.argv[3])
HERE = Path(__file__).parent
COLS_MIN, COLS_MAX = 22, 64
# 종로(87)·중구(74)는 손톱만 한 '가' 가 줄줄이다. 도트 목표를 곳 수에 비례시켜
# 작은 동도 제 칸이 스캔라인에 걸리게 한다 — 700 에 묶으면 절반이 한 점으로 눌린다
DOTS = lambda n: max(700, 14 * n)
# 표가 둘을 한 칸에 줄여 적거나 쉼표를 빠뜨린 곳. 도형과 법정 명칭은 둘로 나뉘어 있다
SPLIT = {"신문로1.2가": ["신문로1가", "신문로2가"],
         "만리동1가만리동2가": ["만리동1가", "만리동2가"],
         "인현동": ["인현동1가", "인현동2가"]}


def text(cell):
    cell = re.sub(r"<i>.*?</i>", "", cell, flags=re.S)
    return re.sub(r"<[^>]+>|[()\s]", "", html.unescape(cell))


def table(src):
    """{구: [(행정동, [법정동…])]} — 표의 h5 머리('중 구' 처럼 띄어 적은 것도)로 구를 가른다."""
    out = {}
    for m in re.finditer(r"<h5>\d+\)\s*(.+?)\(<i>.*?</h5>(.*?)</table>", src, re.S):
        gu = re.sub(r"\s", "", m.group(1))
        rows = re.findall(r"<tr>\s*<td>(.*?)</td>\s*<td>(.*?)</td>", m.group(2), re.S)
        out[gu] = [(text(a), [y for x in text(b).split(",") if x for y in SPLIT.get(x, [x])])
                   for a, b in rows]
    return out


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


def demo():
    t = table('<h5>24) 중 구(<i>中區</i>) - x</h5><table><tr><td>광희동(<i>光熙洞</i>)</td>'
              '<td>신문로1.2가(<i>x</i>), 광희동1가(<i>x</i>)</td></tr></table>')
    assert t == {"중구": [("광희동", ["신문로1가", "신문로2가", "광희동1가"])]}, t


demo()
TABLE = table(Path(page).read_text(encoding="utf-8"))
assert len(TABLE) == 25, f"자치구 {len(TABLE)}개 — 표 모양이 바뀌었다"
assert sum(map(len, TABLE.values())) == 427, "행정동이 427이 아니다"

feats = json.load(open(geo_src))["features"]
by_gu = {}
for f in feats:
    p = f["properties"]
    by_gu.setdefault(p["EMD_CD"][:5], []).append(
        {"type": "Feature", "geometry": f["geometry"],
         "properties": {"code": p["EMD_CD"], "name": p["EMD_KOR_NM"]}})

tree = json.load(open(out_dir / "kr-tree.json"))["children"]
made = []
for gu, rows in TABLE.items():
    legal = {l for _, ls in rows for l in ls}
    code = max(by_gu, key=lambda c: len(legal & {f["properties"]["name"] for f in by_gu[c]}))
    have = {f["properties"]["name"] for f in by_gu[code]}
    assert have == legal, f"{gu}: 표에만 {sorted(legal - have)}, 도형에만 {sorted(have - legal)}"
    admin = {l: [a for a, ls in rows if l in ls] for l in legal}

    s = tree[f"seoul-gu/{gu}"].removesuffix("-dong") + "-bdong"
    geom_path, course_path = out_dir / f"{s}.geom.json", out_dir / f"{s}.course.json"
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        json.dump({"type": "FeatureCollection", "features": by_gu[code]}, tmp, ensure_ascii=False)
    for cols in range(COLS_MIN, COLS_MAX + 1, 2):
        subprocess.run([sys.executable, str(HERE / "build_map.py"), tmp.name, str(geom_path), str(cols)],
                       check=True, stdout=subprocess.DEVNULL)
        geom = json.load(open(geom_path))
        dots = sum(len(r) - r.count(".") for r in geom["grid"])
        if dots >= DOTS(len(legal)):
            break
    Path(tmp.name).unlink()

    names = [it["name"] for it in order(geom["items"])]
    json.dump({
        "slug": s,
        "title": f"{gu} {len(names)}개 법정동",
        "description": f"{gu}의 법정동 {len(names)}곳을 서쪽 끝에서 이웃한 동으로 이어 밟는다.",
        "mode": "sequence",
        "dataVersion": "2015-juso",
        # 한 줄 소개는 사람이 쓸 자리다. 여기엔 서울시 표가 준 행정동 짝만 둔다
        "items": [{"name": n, "meta": {"admin": admin[n]}} for n in names],
    }, open(course_path, "w"), ensure_ascii=False, separators=(",", ":"))
    made.append(len(names))
    print(f"{gu}: {len(names)}개 법정동 → {s} ({geom['cols']}x{geom['rows_n']}, 도트 {dots})")

assert sum(made) == 467, f"법정동 {sum(made)}개 — 467이어야 한다"
print(f"\n{len(made)}개 코스, 법정동 {sum(made)}곳")
