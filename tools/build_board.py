"""대지 한 장에 남한을 통째로 깐다.

카드 한 장에 지도 한 장이 아니라, 30000px 짜리 대지 위에 시·도·시군구·행정동
비트맵을 제 지리 좌표에 놓는다. 돌아다니다 구역을 고르면 그 판이 시작된다.
줌이 곧 층위다 — 멀리 빼면 시·도, 당기면 시군구, 더 당기면 행정동이 드러난다.

그러려면 모든 타일이 투영 하나를 나눠 써야 한다. build_map.py 는 인자를 안 주면
제 bbox 를 폭 1000 에 맞춰 혼자 서므로(타일마다 축척이 다르다), 여기서 남한 전체
투영을 잡아 FRAME 으로 먹인다. 타일은 자기가 덮는 칸 범위만 들고 at 으로 제자리를 안다.

칸 크기는 층마다 다르고 km 로 적는다 — 픽셀로 적으면 대지 크기를 바꿀 때 뜻이 흐려진다.

기존 data/*.geom.json 은 건드리지 않는다. 카드 화면이 그걸 읽고 있다.

    python3 tools/build_board.py prov.json muni.json gu.json dong.json data/
"""
import json, math, re, subprocess, sys, unicodedata
from pathlib import Path

prov_src, muni_src, gu_src, dong_src, out_dir = (
    sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], Path(sys.argv[5]))
BOARD_W = float(sys.argv[6]) if len(sys.argv) > 6 else 30000.0

HERE = Path(__file__).parent
board_dir = out_dir / 'board'
board_dir.mkdir(parents=True, exist_ok=True)

# 층마다 칸 하나가 덮는 실제 거리(km). 구역 하나가 도트 수십 개는 받아야 모양이 읽힌다.
CELL_KM = {'sido': 8.0, 'sgg': 2.0, 'dong': 0.27}
KM_PER_DEG = 111.0


def _slug(name_eng, drop, tail, code):
    """Gyeonggi-do → gyeonggi-sgg, Gangnam-gu → gangnam-dong. 기존 규칙 그대로다."""
    t = re.sub(drop, '', (name_eng or '').strip().lower())
    t = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', t)).strip('-')
    return f'{t or "p" + code}-{tail}'


def outers(f):
    g = f['geometry']
    return [g['coordinates'][0]] if g['type'] == 'Polygon' else [p[0] for p in g['coordinates']]


def thin_ring(ring, eps):
    """마지막으로 남긴 점에서 eps 넘게 떨어진 점만 남긴다.

    래스터화는 칸 단위라 칸보다 촘촘한 굴곡은 결과를 바꾸지 못한다. 그런데 줄마다
    전부 훑히기는 한다 — 원본 그대로면 한 장에 몇 시간이 걸린다.
    """
    out = [ring[0][:2]]
    for pt in ring[1:]:
        x, y = pt[0], pt[1]
        px, py = out[-1]
        if abs(x - px) + abs(y - py) > eps:
            out.append([x, y])
    return out if len(out) >= 4 else [p[:2] for p in ring]


def thinned(src, prefix, eps, cache={}):
    """코드 접두로 거른 뒤 점을 솎아 임시 GeoJSON 을 만든다."""
    if src not in cache:
        cache[src] = json.load(open(src))['features']
    feats = [dict(f) for f in cache[src]
             if str(f['properties'].get('code', '')).startswith(prefix)]
    assert feats, f'코드 {prefix!r} 로 시작하는 항목이 없다'
    for f in feats:
        rings = [thin_ring(r, eps) for r in outers(f)]
        f['geometry'] = ({'type': 'Polygon', 'coordinates': [rings[0]]} if len(rings) == 1
                         else {'type': 'MultiPolygon', 'coordinates': [[r] for r in rings]})
    tmp = board_dir / '.thin.json'
    json.dump({'type': 'FeatureCollection', 'features': feats},
              open(tmp, 'w'), separators=(',', ':'))
    return tmp


# ── 남한 전체 투영 ───────────────────────────────────────
pts = [c for f in json.load(open(prov_src))['features'] for r in outers(f) for c in r]
lo0, lo1 = min(p[0] for p in pts), max(p[0] for p in pts)
la0, la1 = min(p[1] for p in pts), max(p[1] for p in pts)
k = math.cos(math.radians((la0 + la1) / 2))            # 경도 1도의 실제 폭 보정
x0 = lo0 * k
s = BOARD_W / (lo1 * k - x0)                           # 도 → 대지 px
top = la1
BOARD_H = round((la1 - la0) * s, 1)
PX_PER_KM = s / KM_PER_DEG

print(f'대지 {BOARD_W:.0f} x {BOARD_H:.0f} px   '
      f'경도 {lo0:.3f}~{lo1:.3f}  위도 {la0:.3f}~{la1:.3f}  1km={PX_PER_KM:.1f}px')


def tile(src, prefix, slug, level):
    cell = round(CELL_KM[level] * PX_PER_KM, 3)
    eps = CELL_KM[level] / KM_PER_DEG / 2 / k          # 반 칸을 경도 도수로
    dst = board_dir / f'{slug}.geom.json'
    frame = f'{k},{x0},{s},{top},{cell}'
    subprocess.run([sys.executable, str(HERE / 'build_map.py'),
                    str(thinned(src, prefix, eps)), str(dst), '0', '', frame],
                   check=True, stdout=subprocess.DEVNULL)
    g = json.load(open(dst))
    dots = sum(len(r) - r.count('.') for r in g['grid'])
    print(f'  {slug:<22} {len(g["items"]):>3}곳  {g["cols"]}x{g["rows_n"]}  '
          f'도트 {dots:>5}  at {g["at"]}')
    return {'slug': slug, 'at': g['at'], 'w': g['w'], 'h': g['h'], 'n': len(g['items'])}


levels = []

# 시·도 한 장
print('시·도:')
levels.append({'id': 'sido', 'cell': round(CELL_KM['sido'] * PX_PER_KM, 3),
               'tiles': [tile(prov_src, '', 'kr-admin', 'sido')]})

# 시군구 — 서울 포함 17개 시·도를 한 장씩. 250곳을 한 장에 담으면 SYM(137자)을 넘는다
print('시군구:')
prov = sorted(json.load(open(prov_src))['features'], key=lambda f: f['properties']['code'])
muni = json.load(open(muni_src))['features']
sgg = []
for f in prov:
    p = f['properties']
    code = p['code']
    n = sum(1 for m in muni if m['properties']['code'].startswith(code))
    if n < 2:
        print(f'  건너뜀 {p["name"]}: 시군구 {n}개')
        continue
    slug = 'seoul-gu' if code == '11' else _slug(p.get('name_eng'), r'-(do|si)$', 'sgg', code)
    sgg.append(tile(muni_src, code, slug, 'sgg'))
levels.append({'id': 'sgg', 'cell': round(CELL_KM['sgg'] * PX_PER_KM, 3), 'tiles': sgg})

# 행정동 — 지금은 서울뿐이다
print('행정동:')
gu = sorted(json.load(open(gu_src))['features'], key=lambda f: f['properties']['code'])
dong = json.load(open(dong_src))['features']
tiles = []
for f in gu:
    p = f['properties']
    n = sum(1 for d in dong if d['properties']['code'].startswith(p['code']))
    if n < 2:
        continue
    tiles.append(tile(dong_src, p['code'], _slug(p.get('name_eng'), r'-gu$', 'dong', p['code']), 'dong'))
levels.append({'id': 'dong', 'cell': round(CELL_KM['dong'] * PX_PER_KM, 3), 'tiles': tiles})

(board_dir / '.thin.json').unlink(missing_ok=True)
json.dump({'w': BOARD_W, 'h': BOARD_H,
           'frame': {'k': k, 'x0': x0, 's': s, 'top': top},
           'levels': levels},
          open(out_dir / 'board.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'\nboard.json — 층 {len(levels)}개, 타일 {sum(len(l["tiles"]) for l in levels)}장')
