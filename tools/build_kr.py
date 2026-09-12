"""대한민국 시·도 코스와 도별 시군구 코스를 한 번에 찍어낸다.

지형은 build_map.py 를 시·도 코드로 필터해 그대로 돌린다 — 같은 격자, 같은 형식이다.

서울은 건너뛴다. seoul-gu 는 손으로 쓴 한 줄 소개와 순위표 기록이 걸려 있어
슬러그를 바꾸지도, 덮어쓰지도 않는다. 세종은 시군구가 자기 하나뿐이라 빠진다.

한 줄 소개(items[].meta.description)는 비워 둔다 — 250곳을 지어낼 수는 없다.
시·도 약칭(충북·전남 …)은 지어내는 값이 아니라 통용되는 것이라 별칭으로 박는다.

    curl -sL -o prov.json .../skorea-provinces-2018-geo.json
    curl -sL -o muni.json .../skorea-municipalities-2018-geo.json
    python3 tools/build_kr.py prov.json muni.json data/
"""
import json, re, subprocess, sys, tempfile, unicodedata
from collections import Counter
from pathlib import Path

prov_src, muni_src, out_dir = sys.argv[1], sys.argv[2], Path(sys.argv[3])
# build_dong.py 와 같은 이유로 칸 수를 훑는다 — 폭이 1000 으로 고정이라 세로로 긴
# 구역은 같은 칸 수에서 줄이 늘어 도트가 폭발한다. 목표 도트에 닿는 첫 칸 수를 쓴다.
DOTS = 700
# 네 번째 인자로 시·도 코드를 주면 그것만 다시 찍는다 (쉼표로 여럿). 없으면 전부.
ONLY = set(sys.argv[4].split(',')) if len(sys.argv) > 4 else None
TOP_DOTS = 700
COLS_MIN, COLS_MAX = 24, 56
# 본토로부터 이 거리(도) 밖의 섬은 뺀다. 강화(0.35)·영흥(0.45)은 남고
# 백령(1.75)은 빠진다. 나라 기준인 build_pixels.py 의 ±25 도와 같은 규칙이다.
NEAR = 0.8

HERE = Path(__file__).parent
SEOUL, TOP = '11', 'kr-admin'

prov = json.load(open(prov_src))['features']
muni = json.load(open(muni_src))['features']

# 통용되는 두 글자 약칭. stripSuffix 가 접미사를 떼어 내지 못하는 것만 적는다
# (서울특별시·부산광역시·제주특별자치도는 app.js 가 접미사로 처리한다).
ABBR = {
    '충청북도': '충북', '충청남도': '충남',
    '전라북도': '전북', '전라남도': '전남',
    '경상북도': '경북', '경상남도': '경남',
}


def slug(name_eng, code):
    """Gyeonggi-do → gyeonggi. 영문명이 없으면 코드로 떨어진다."""
    s = re.sub(r'-(do|si)$', '', (name_eng or '').strip().lower())
    s = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', s)).strip('-')
    return s or f'p{code}'


def order(items):
    """무게중심 최근접 이웃. 서쪽 끝에서 출발해 가장 가까운 다음 곳으로 건너간다."""
    # ponytail: build_dong.py 에서 복사했다. 세 번째 도구가 생기면 그때 합친다
    left = items[:]
    path = [min(left, key=lambda it: it['c'][0])]
    left.remove(path[0])
    while left:
        cx, cy = path[-1]['c']
        nxt = min(left, key=lambda it: (it['c'][0] - cx) ** 2 + (it['c'][1] - cy) ** 2)
        left.remove(nxt)
        path.append(nxt)
    return path


def outers(f):
    """겉 테두리만. build_map.py 와 같은 규칙이다 — 구멍은 어차피 버린다."""
    g = f['geometry']
    return [g['coordinates'][0]] if g['type'] == 'Polygon' else [p[0] for p in g['coordinates']]


def area(ring):
    return abs(sum(a[0] * b[1] - b[0] * a[1]
                   for a, b in zip(ring, ring[1:] + ring[:1]))) / 2


def centroid(ring):
    return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)


def keep_near(by_feat):
    """본토에서 멀리 떨어진 섬을 걷어낸다.

    백령도 하나가 인천의 경계 상자를 서해로 1.2도 끌어내면, 폭이 1000 으로 고정된
    화면에서 진짜 시가지 여덟 구가 오른쪽 15% 에 뭉쳐 고를 수 없는 지도가 된다.
    가장 넓은 고리를 본토로 보고 그 언저리만 남긴다 — build_pixels.py 의 규칙과
    같고, 나라(±25도)가 아니라 시·도 크기에 맞춘 거리다.

    구역이 통째로 사라지면 코스에서 이름이 빠진다. 그래서 남길 고리가 하나도 없는
    항목은 제 고리 중 제일 큰 것을 돌려받는다. 보장은 '언저리 것 중 제일 큰 것'이고,
    그게 없을 때만 '통째로 제일 큰 것'이다 — 옹진군은 백령도가 제일 크니, 그냥
    제일 큰 고리를 보장하면 상자가 그대로라 아무것도 고쳐지지 않는다.
    """
    home = max((r for rs in by_feat for r in rs), key=area)
    hx, hy = centroid(home)
    out, cut = [], 0
    for rs in by_feat:
        near = [r for r in rs
                if abs(centroid(r)[0] - hx) < NEAR and abs(centroid(r)[1] - hy) < NEAR]
        cut += len(rs) - len(near)
        out.append(near or [max(rs, key=area)])      # 울릉군처럼 언저리가 없는 곳
    return out, cut


def thin_ring(ring, eps):
    """마지막으로 남긴 점에서 eps 넘게 떨어진 점만 남긴다."""
    out = [ring[0][:2]]
    for pt in ring[1:]:
        x, y = pt[0], pt[1]
        px, py = out[-1]
        if abs(x - px) + abs(y - py) > eps:
            out.append([x, y])
    return out if len(out) >= 4 else [p[:2] for p in ring]


def prep(src, code):
    """격자에 나타날 수 없는 굴곡을 미리 걷어내고 임시 GeoJSON 으로 뱉는다.

    래스터화는 칸 단위다. 칸보다 촘촘한 해안선 굴곡은 결과를 바꾸지 못하면서
    줄마다 수십만 번 훑히기만 한다 — 원본 그대로면 시·도 한 장에 몇 시간이 걸린다.
    가장 잘게 쪼갤 때(COLS_MAX)의 반 칸을 기준으로 솎아 낸다.
    """
    feats = [f for f in json.load(open(src))['features']
             if str(f['properties'].get('code', '')).startswith(code)]
    # 먼 섬을 먼저 걷어내야 eps 가 제 크기로 잡힌다 — 상자가 벌어진 채로 재면
    # 반 칸이 실제보다 커져 본토 해안선까지 뭉개진다
    kept, cut = keep_near([outers(f) for f in feats])
    lons = [c[0] for rs in kept for r in rs for c in r]
    eps = (max(lons) - min(lons)) / COLS_MAX / 2
    before = after = 0
    for f, rs in zip(feats, kept):
        rings = []
        for r in rs:
            before += len(r)
            t = thin_ring(r, eps)
            after += len(t)
            rings.append(t)
        f['geometry'] = ({'type': 'Polygon', 'coordinates': [rings[0]]} if len(rings) == 1
                         else {'type': 'MultiPolygon', 'coordinates': [[r] for r in rings]})
    path = Path(tempfile.mkdtemp(prefix='rt-kr-')) / 'thin.json'
    json.dump({'type': 'FeatureCollection', 'features': feats},
              open(path, 'w'), separators=(',', ':'))
    print(f'  점 {before} → {after} ({after * 100 // before}%), 먼 섬 고리 {cut}개 뺌')
    return path


def sweep(src, dst, code, want):
    """도트가 want 에 닿는 첫 칸 수로 격자를 찍고 그 격자를 돌려준다."""
    thin = prep(src, code)
    for cols in range(COLS_MIN, COLS_MAX + 1, 2):
        subprocess.run([sys.executable, str(HERE / 'build_map.py'),
                        str(thin), str(dst), str(cols)],
                       check=True, stdout=subprocess.DEVNULL)
        geom = json.load(open(dst))
        dots = sum(len(r) - r.count('.') for r in geom['grid'])
        if dots >= want:
            break
    return geom, dots


def write_course(path, slug_, title, desc, names, aliases=None):
    items = []
    for n in names:
        rec = {'name': n, 'meta': {'description': ''}}
        a = (aliases or {}).get(n)
        if a:
            rec['aliases'] = [a]
        items.append(rec)
    json.dump({
        'slug': slug_,
        'title': title,
        'description': desc,
        'mode': 'sequence',
        'dataVersion': '2018-kostat',
        'settings': {'defaultTime': 120 if len(items) < 30 else 180},
        'items': items,
    }, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))


# ── 시·도 한 장 ──────────────────────────────────────────
geom, dots = sweep(prov_src, out_dir / f'{TOP}.geom.json', '', TOP_DOTS)
top_names = [it['name'] for it in order(geom['items'])]
write_course(out_dir / f'{TOP}.course.json', TOP,
             f'대한민국 {len(top_names)}개 시·도',
             '남한의 광역자치단체를 서쪽 끝에서 이웃한 곳으로 이어 밟는다.',
             top_names, ABBR)
print(f'대한민국: {len(top_names)}개 시·도 → {TOP} '
      f"({geom['cols']}x{geom['rows_n']}, 도트 {dots})")

# ── 도별 시군구 ──────────────────────────────────────────
n_by_code = Counter(f['properties']['code'][:2] for f in muni)
children = {}
made = []

for f in sorted(prov, key=lambda f: f['properties']['code']):
    p = f['properties']
    code, name = p['code'], p['name']

    if ONLY and code not in ONLY:
        continue
    if code == SEOUL:                       # 서울은 이미 seoul-gu 가 있다
        children[f'{TOP}/{name}'] = 'seoul-gu'
        continue
    if n_by_code[code] < 2:                 # 세종 — 자기 자신 하나뿐
        print(f'건너뜀 {name}: 시군구 {n_by_code[code]}개')
        children[f'{TOP}/{name}'] = None
        continue

    s = f'{slug(p.get("name_eng"), code)}-sgg'
    geom, dots = sweep(muni_src, out_dir / f'{s}.geom.json', code, DOTS)
    names = [it['name'] for it in order(geom['items'])]
    write_course(out_dir / f'{s}.course.json', s,
                 f'{name} {len(names)}개 시군구',
                 f'{name}의 시군구 {len(names)}곳을 서쪽 끝에서 이웃한 곳으로 이어 밟는다.',
                 names)
    children[f'{TOP}/{name}'] = s
    for n in names:
        children.setdefault(f'{s}/{n}', None)   # 시군구 아래는 아직 없다
    made.append((s, name, len(names)))
    print(f'{name}: {len(names)}개 시군구 → {s} '
          f"({geom['cols']}x{geom['rows_n']}, 도트 {dots})")

# 서울 구 → 행정동. 코스 제목 앞머리가 그 구 이름이다 — app.js 의 byGu 와 같은 규칙이고,
# 이 표가 생기면 app.js 쪽 정규식은 지울 수 있다.
for path in sorted(out_dir.glob('*-dong.course.json')):
    d = json.load(open(path))
    m = re.match(r'^(\S+구)\s', d.get('title', ''))
    if m:
        children[f'seoul-gu/{m.group(1)}'] = d['slug']

# 일부만 다시 찍었으면 표도 일부만 채워진다. 기존 표에 얹는다.
if ONLY:
    prev = out_dir / 'kr-tree.json'
    if prev.exists():
        children = {**json.loads(prev.read_text())['children'], **children}

tree = {'root': TOP, 'children': children}
(out_dir / 'kr-tree.json').write_text(
    json.dumps(tree, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

print(f'\n{len(made)}개 시군구 코스 + {TOP}')
print(f'kr-tree.json: 간선 {len(children)}개 '
      f'(내려갈 수 있는 곳 {sum(1 for v in children.values() if v)}곳)')
