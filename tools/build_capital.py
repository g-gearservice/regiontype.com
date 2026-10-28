"""OpenStreetMap 수도 경계 → 나라별 수도 코스(<iso>-capital)·지형, world.json 지역.

서울은 손대지 않는다 — 이미 seoul-gu 가 수도 코스다. 한 줄 소개는 빈 칸이다.
받은 OSM 원본은 /tmp/rt-geo/capital/ 에 둔다. 다시 돌릴 때 Overpass 를 또 묻지 않는다.

    python3 tools/build_capital.py data/          # 전부
    python3 tools/build_capital.py data/ JP       # 한 나라
    python3 tools/build_capital.py survey FR      # 단계별 구획 수만 본다

© OpenStreetMap contributors, ODbL.
"""
import hashlib, json, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
CACHE = Path('/tmp/rt-geo/capital')
UA = 'regiontype-tools/1.0 (+https://regiontype.com)'
MIRRORS = ['https://overpass-api.de/api/interpreter',
           'https://overpass.private.coffee/api/interpreter',
           'https://overpass.kumi.systems/api/interpreter']

# iso: (수도 wikidata 또는 Overpass 거르개, 아래 구획의 admin_level, 이름 거르개, 이름에서 뗄 앞말)
CAP = {
    'JP': ('Q1490', 7, '区$', None),            # 東京 23区 — 같은 단계의 市町村은 뺀다
    'FR': ('Q90', 9, None, r'^Paris\s+'),       # 파리 구(arrondissement)
    'CN': ('Q956', 6, None, None),
    'TW': ('Q1867', 7, None, None),
    'HK': ('Q8646', 6, None, None),             # 홍콩은 수도가 따로 없다 — 18구(name:zh-Hant)
    'DE': ('Q64', 9, None, None),
    'IT': ('Q220', 10, None, r'^Municipio\s+'),
    'ES': ('Q2807', 9, None, None),
    'GB': ('Q84', '6|8', None, r'^(London Borough of|Royal Borough of|City of)\s+'),
    'BE': ('Q240', 8, None, None),
    'PL': ('Q270', 9, None, None),
    'PT': ('Q597', 8, None, None),
    'AT': ('Q1741', 9, None, None),
    'CH': ('Q70', 10, None, None),              # L9 는 'Stadtteil III' 같은 번호뿐
    'CZ': ('Q1085', 6, None, r'^SO\s+'),        # správní obvody, Praha 1–22
    'NO': ('Q585', 9, None, None),
    'FI': ('Q1757', 9, None, None),
    'CA': ('Q1930', 9, None, None),
    'MX': ('Q1489', 6, None, None),
    'IN': ('Q1353', 5, None, None),
    'ID': ('Q3630', 6, None, None),             # L5 다섯 kota 는 너무 적다 — kecamatan
    'US': ('Q3551781', 9, None, None),         # 8개 Ward
    'AU': ('Q3258', 7, None, r'^District of\s+'),
    'BR': ('Q119158', 8, None, None),           # regiões administrativas
    'VN': ('Q1858', 6, None, None),             # 2025 개편 뒤 phường·xã
    'TH': ('Q1861', 6, None, None),             # เขต
    'PH': ('Q1461', 8, None, None),
    'UA': ('Q1899', 10, None, None),            # 키이우 구(район)가 OSM 에서 L10
    'HU': ('Q1781', 9, None, None),
    'BG': ('[name="София-град"]', 6, None, None),   # Q472 는 시내(L8)뿐이라 바깥 구가 빠진다
    'CO': ('Q2841', 8, r'^(?!Los Laches$)', r'^Localidad\s+'),   # Los Laches 는 산타페의 동네인데 L8 로 잘못 올라 있다
    'IE': ('Q1761', 10, None, None),            # L9 는 선거구 338 — 동네(L10)
    'RO': ('Q19660', 9, None, None),           # 6개 Sector
    'SE': ('[name="Stockholms kommun"][admin_level=7]', 9, None, r'\s+stadsdelsområde$'),
    'NZ': ('[name="Wellington City"][admin_level=6]', 'gb:NZL/ADM3', None, r'\s+Ward$'),   # 시의회 선거구, Stats NZ CC BY 4.0
    'ZA': ('[name="City of Tshwane Metropolitan Municipality"][admin_level=6]', None, None, None),
    'EG': ('["name:en"="Cairo"][admin_level~"^(4|5|6)$"]', 'gb:EGY/ADM2', r'^(?!Zemam Out$)', None),   # 구(qism), CAPMAS CC BY 3.0 IGO — Zemam Out 은 구가 아니다
    'SA': ('Q97302281', 9, None, r'^بلدية\s+'),   # 구청(بلدية) 16곳 중 OSM 에 13곳, 그중 다섯은 경계가 끊겨 8곳
    'AE': ('["name:en"="Abu Dhabi"]', 8, None, None),
    'GR': ('[name="Δήμος Αθηναίων"]', 9, None, None),   # 7개 Κοινότητα
    'TR': ('[name="Ankara"][admin_level=4]', 6, None, None),
    'AR': ('[name="Ciudad Autónoma de Buenos Aires"]', 9, None, None),   # comuna(L5)는 번호뿐 — barrio
    'CL': ('[name="Provincia de Santiago"]', 8, None, None),
    'NL': ('Q9899', '[boundary=place][place=suburb]', None, None),   # stadsdelen 은 행정 경계가 아니라 place 경계다
    'MY': ('Q1865', 'gb:MYS/ADM3', None, r'^(MUKIM|PEKAN|BANDAR)\s+'),   # 무킴·읍, CC BY 4.0
}

DATA = HERE.parent / 'data'
UI_LANGS = json.loads((DATA / 'i18n.json').read_text()).keys()


def overpass(q, key):
    # 거르개를 고치면 다른 파일이 된다 — 옛 경계가 캐시에 남아 판을 흐리지 않게
    path = CACHE / f'{key}-{hashlib.md5(q.encode()).hexdigest()[:8]}.json'
    if path.exists():
        return json.loads(path.read_text())
    body = urllib.parse.urlencode({'data': q}).encode()
    for n in range(8):
        url = MIRRORS[n % len(MIRRORS)]
        try:
            req = urllib.request.Request(url, data=body, headers={'User-Agent': UA})
            res = json.load(urllib.request.urlopen(req, timeout=300))
            # 붐비는 서버는 200 에 빈 elements 와 remark 를 준다 — 캐시하면 영영 빈 칸이 된다
            if res.get('remark'):
                raise RuntimeError(res['remark'])
            els = res['elements']
            if not els:
                return els      # 정말 없다 — 캐시하지 않는다
            break
        except Exception as e:
            print(f'  다시 {key} ({url.split("/")[2]}): {e}', file=sys.stderr)
            time.sleep(10)
    else:
        raise SystemExit(f'Overpass 실패: {key}')
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(els, ensure_ascii=False))
    return els


def rings(rel):
    """겉 테두리 길(way)을 끝점끼리 이어 닫힌 고리로. 닫히지 않는 조각은 버린다
    — 리야드 구청 다섯은 OSM 경계에 1–12km 틈이 있어 빠진다."""
    segs = [[(p['lon'], p['lat']) for p in m['geometry']] for m in rel.get('members', [])
            if m['type'] == 'way' and m.get('role') in ('outer', '') and m.get('geometry')]
    out = []
    while segs:
        r = segs.pop(0)
        while r[0] != r[-1]:
            for i, s in enumerate(segs):
                if s[0] == r[-1]: r = r + s[1:]; break
                if s[-1] == r[-1]: r = r + s[::-1][1:]; break
                if s[-1] == r[0]: r = s + r[1:]; break
                if s[0] == r[0]: r = s[::-1] + r[1:]; break
            else:
                break
            segs.pop(i)
        if len(r) > 3 and r[0] == r[-1]:
            out.append(r)
    return out


def inside(pt, rs):
    x, y = pt
    c = False
    for r in rs:
        for (x1, y1), (x2, y2) in zip(r, r[1:]):
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                c = not c
    return c


def parent(iso, qid):
    # wikidata 가 경계에 안 붙은 수도는 Overpass 거르개를 그대로 적는다
    sel = f'[wikidata={qid}]' if qid.startswith('Q') else qid
    els = overpass(f'[out:json][timeout:240];rel{sel}[boundary=administrative];out geom;',
                   f'{iso}-parent')
    assert els, f'{iso}: wikidata {qid} 경계가 없다'
    return els[0]


def kids(iso, par, level):
    if level is None:   # 조사: 모든 단계, 가운데 점만
        q = f'rel({par["id"]});map_to_area->.a;rel(area.a)[boundary=administrative];out center tags;'
        return overpass(f'[out:json][timeout:240];{q}', f'{iso}-survey')
    # level 은 7 이나 '6|8'(런던은 시티 6·자치구 8), 행정 경계가 없는 곳은 Overpass 거르개 그대로
    filt = level if str(level).startswith('[') else f'[boundary=administrative][admin_level~"^({level})$"]'
    q = f'rel({par["id"]});map_to_area->.a;rel(area.a){filt};out geom;'
    return overpass(f'[out:json][timeout:240];{q}', f'{iso}-kids')


def survey(iso):
    qid = CAP[iso][0]
    par = parent(iso, qid)
    rs = rings(par)
    by = defaultdict(list)
    for k in kids(iso, par, None):
        if k['id'] != par['id'] and 'center' in k and inside((k['center']['lon'], k['center']['lat']), rs):
            by[k['tags'].get('admin_level', '?')].append(k['tags'].get('name', '?'))
    print(f"{iso} {par['tags'].get('name')} L{par['tags'].get('admin_level')}")
    for lv in sorted(by, key=lambda s: int(s) if s.isdigit() else 99):
        print(f'   L{lv} {len(by[lv]):4d}  ' + ', '.join(by[lv][:6]))


def within(rs, prs, edge):
    """수도 경계와 겹치지 않는 꼭짓점의 과반이 수도 안이면 수도 구획이다. 가운데 한 점은
    오목한 구(파리 12구)에서 이웃 땅(생망데)에 떨어지고, 경계 위 꼭짓점은 안팎이 반반으로 갈린다
    — 가장자리 구(베를린 트렙토-쾨페니크)는 꼭짓점 대부분이 경계 위다."""
    pts = [p for r in rs for p in r if p not in edge]
    if not pts:
        return True
    pts = pts[::max(1, len(pts) // 200)]
    return sum(inside(p, prs) for p in pts) * 2 > len(pts)


def gb_units(path):
    """geoBoundaries 한 층(예: EGY/ADM2) — OSM 에 수도 안 구획이 없는 나라만 쓴다."""
    dst = CACHE.parent / 'gb' / (path.replace('/', '-') + '.geojson')
    if not dst.exists():
        api = f'https://www.geoboundaries.org/api/current/gbOpen/{path}/'
        meta = json.load(urllib.request.urlopen(urllib.request.Request(api, headers={'User-Agent': UA}), timeout=120))
        dst.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(meta['simplifiedGeometryGeoJSON'], headers={'User-Agent': UA})
        dst.write_bytes(urllib.request.urlopen(req, timeout=600).read())
    out = []
    for f in json.loads(dst.read_text())['features']:
        g = f['geometry']
        polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        out.append(({'name': f['properties']['shapeName']}, [[tuple(p) for p in poly[0]] for poly in polys]))
    return out


def typing_name(tags, iso, strip):
    lang = type_lang(iso)
    name = tags.get(f'name:{lang}') or tags.get(f'name:{lang[:2]}') or tags.get('name') or '?'
    if strip:
        name = re.sub(strip, '', name).strip()
    if name.isupper():   # 쿠알라룸푸르 geoBoundaries 는 'PEKAN KEPONG' 처럼 대문자뿐이다
        name = name.title()
    return name.replace('·', ',')


def titles(tags):
    t = {l: tags[f'name:{l}'] for l in UI_LANGS if tags.get(f'name:{l}')}
    t.setdefault('en', tags.get('name:en') or tags.get('name'))
    return t


def build(iso, out_dir, world):
    qid, level, keep, strip = CAP[iso]
    if level is None:
        print(f'건너뜀 {iso}: 단계 미정 (survey)')
        return
    par = parent(iso, qid)
    prs = rings(par)
    if str(level).startswith('gb:'):
        # 단순화한 geoBoundaries 도형은 OSM 수도 경계와 꼭짓점을 나눠 갖지 않는다
        units, edge = gb_units(level[3:]), set()
    else:
        units = [(k['tags'], rings(k)) for k in kids(iso, par, level) if k['id'] != par['id']]
        edge = {p for r in prs for p in r}
    feats, dropped = {}, 0
    for tags, rs in units:
        if not rs:
            dropped += 1
            continue
        if not within(rs, prs, edge):
            continue
        name = typing_name(tags, iso, strip)
        if keep and not re.search(keep, name):
            continue
        poly = [[r] for r in rs]
        if name in feats:   # 같은 이름은 도형만 합친다
            feats[name]['geometry']['coordinates'] += poly
            continue
        feats[name] = {'type': 'Feature', 'properties': {'name': name},
                       'geometry': {'type': 'MultiPolygon', 'coordinates': poly}}
    feats = list(feats.values())
    if len(feats) < 4:
        print(f'건너뜀 {iso}: {len(feats)}곳')
        return
    slug = f'{iso.lower()}-capital'
    src = Path(tempfile.mkdtemp(prefix='rt-cap-')) / f'{iso}.geojson'
    src.write_text(json.dumps({'type': 'FeatureCollection', 'features': feats}, ensure_ascii=False))
    geom_path = out_dir / f'{slug}.geom.json'
    for cols in (32, 40, 48, 56):
        r = subprocess.run([sys.executable, str(HERE / 'build_map.py'), str(src), str(geom_path), str(cols)],
                           capture_output=True, text=True)
        if r.returncode == 0:
            break
    else:
        print(f'실패 {iso}: {r.stderr.strip()[-300:]}')
        return
    geom = json.loads(geom_path.read_text())
    items = [{'name': it['name'], 'meta': {'description': ''}} for it in order(geom['items'])]
    n = len(items)
    (out_dir / f'{slug}.course.json').write_text(json.dumps({
        'slug': slug,
        'title': f'{n}',
        'description': '',
        'mode': 'sequence',
        'dataVersion': ('geoboundaries-' if str(level).startswith('gb:') else 'osm-') + time.strftime('%Y%m'),
        'lang': type_lang(iso),
        'settings': {'defaultTime': 120 if n < 30 else 180 if n < 60 else 300},
        'items': items,
    }, ensure_ascii=False, separators=(',', ':')))
    pack = next(c for c in world['countries'] if c['id'] == iso)
    pack['regions'] = [r for r in pack['regions'] if r['id'] != slug] + [{
        'id': slug, 'root': slug, 'children': {},
        'title': titles(par['tags']),
        'thumb': slug, 'main': slug, 'nested': False, 'courses': [slug],
    }]
    print(f'{iso} {n}곳 → {slug}' + (f' (고리 못 지은 곳 {dropped})' if dropped else ''))


def type_lang(iso):
    """입력창 lang 은 그 나라 admin 코스가 이미 갖고 있다(build_world.py TYPE_LANG)."""
    return json.loads((DATA / f'{iso.lower()}-admin.course.json').read_text())['lang']


def order(items):
    """무게중심 최근접 이웃. 서쪽 끝에서 출발한다 — build_world.py 와 같다."""
    left = items[:]
    path = [min(left, key=lambda it: it['c'][0])]
    left.remove(path[0])
    while left:
        cx, cy = path[-1]['c']
        nxt = min(left, key=lambda it: (it['c'][0] - cx) ** 2 + (it['c'][1] - cy) ** 2)
        left.remove(nxt)
        path.append(nxt)
    return path


if __name__ == '__main__':
    what, only = sys.argv[1], (sys.argv[2].upper() if len(sys.argv) > 2 else '')
    todo = [only] if only else list(CAP)
    if what == 'survey':
        for iso in ([only] if only else [k for k, v in CAP.items() if v[1] is None]):
            try:
                survey(iso)
            except (SystemExit, AssertionError) as e:
                print(f'{iso} 실패: {e}')
            sys.stdout.flush()
        sys.exit()
    out_dir = Path(what)
    world_path = out_dir / 'world.json'
    world = json.loads(world_path.read_text())
    for iso in todo:
        build(iso, out_dir, world)
    world_path.write_text(json.dumps(world, ensure_ascii=False, separators=(',', ':')))
