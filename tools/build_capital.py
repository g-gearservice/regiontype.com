"""OpenStreetMap 수도 경계 → 나라별 수도 코스(<iso>-capital)·지형, world.json 지역.

서울은 손대지 않는다 — 이미 seoul-gu 가 수도 코스다. 한 줄 소개는 빈 칸이다.
받은 OSM 원본은 /tmp/rt-geo/capital/ 에 둔다. 다시 돌릴 때 Overpass 를 또 묻지 않는다.
OSM 에 없는 말의 지역 이름은 Wikidata 라벨로 메운다 — 받은 것은 같은 곳 wikidata/ 에 둔다.

    python3 tools/build_capital.py data/          # 전부
    python3 tools/build_capital.py data/ JP       # 한 나라
    python3 tools/build_capital.py survey FR      # 단계별 구획 수만 본다

© OpenStreetMap contributors, ODbL.
"""
import hashlib, json, re, subprocess, sys, tempfile, time, unicodedata, urllib.parse, urllib.request
from collections import Counter, defaultdict
from pathlib import Path

from translit import ja_hangul, kana_roma, latin_hangul, plain, transcribe, zh_hangul

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

# iso: 구 안쪽 한 단계 (admin_level 또는 Overpass 거르개, 이름에서 뗄 앞말) — 서울 행정동 자리.
# survey 로 고른다. 없는 나라는 구를 펴지 않는다(sub)
SUB = {
    'JP': ('9', None),                          # 町·大字. L10 丁目은 구마다 수백이다
    'FR': ('10', r"^Quartier\s+(de la |de l'|du |des |de |d')?"),   # 구마다 quartier 넷
    'CN': ('8', None),                          # 街道·镇
    'TW': ('9', None),                          # 里
    'DE': ('10', None),                         # Ortsteil
    'ES': ('10', None),                         # barrio
    'PL': ('10', None),                         # osiedle. L11 은 프라가·그로후프 쪽뿐
    'AT': ('10', r'^Katastralgemeinde\s+'),
    'CZ': ('9', None),                          # městská část — 바깥 SO 만 넷을 넘는다
    'FI': ('10', None),                         # peruspiiri
    'MX': ('10', r'^Colonia\s+'),               # OSM 이 덮은 colonia 만
    'IN': ('10', None),
    'ID': ('7', None),                          # kelurahan
    'AU': ('9', None),                          # suburb
    'BR': ('10', None),                         # 플라누 필로투 쪽 quadra 만
    'TH': ('8', r'^แขวง'),
    'PH': ('10', None),                         # barangay — OSM 에 152곳
    'HU': ('10', None),                         # városrész
    'BG': ('8|9', None),                        # 바깥 구는 마을(L8), 시내는 ж.к.·кв.(L9)
    'CO': ('9', r'^UPZ\s+'),
    'SE': ('10', None),                         # stadsdel
    'TR': ('8', r'\s+Mahallesi$'),
    'SA': ('10', r'^حي\s+'),
}
# 펴지 않는 수도 — OSM 에 구 아래 행정 경계가 없거나(US·VN·RO·IE·AR·CL·NO·PT·CH·UA·AE·NL·NZ·EG·MY)
# 몇 곳뿐이다(HK·IT·GB·BE·GR·CA). ZA 는 수도 코스부터 없다

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


def within(rs, prs, edge, n=200):
    """수도 경계와 겹치지 않는 꼭짓점의 과반이 수도 안이면 수도 구획이다. 가운데 한 점은
    오목한 구(파리 12구)에서 이웃 땅(생망데)에 떨어지고, 경계 위 꼭짓점은 안팎이 반반으로 갈린다
    — 가장자리 구(베를린 트렙토-쾨페니크)는 꼭짓점 대부분이 경계 위다."""
    pts = [p for r in rs for p in r if p not in edge]
    if not pts:
        return True
    pts = pts[::max(1, len(pts) // n)]
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
    name = tags.get(f'name:{lang}') or tags.get(f'name:{lang[:2]}') or tags.get('name')
    if not name:   # 이름 없는 구획은 칠 수 없다 — 판에서 뺀다(델리·앙카라의 '?')
        return None
    if strip:
        name = re.sub(strip, '', name).strip()
    if name.isupper():   # 쿠알라룸푸르 geoBoundaries 는 'PEKAN KEPONG' 처럼 대문자뿐이다
        name = name.title()
    return name.replace('·', ',')


def wd_labels(qid):
    """Wikidata 개체의 말별 라벨 {언어: 이름}. 못 받으면 {} — OSM 이름만으로 간다."""
    if not re.fullmatch(r'Q\d+', qid):   # OSM 태그는 누구나 고친다 — 캐시 경로에 그대로 넣지 않는다
        return {}
    path = CACHE / 'wikidata' / f'{qid}.json'
    if path.exists():
        return json.loads(path.read_text())
    url = ('https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&format=json&ids='
           + urllib.parse.quote(qid))
    for n in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            res = json.load(urllib.request.urlopen(req, timeout=60))
            labels = res['entities'][qid]['labels']     # 없는 개체는 'missing' 이라 KeyError
            break
        except Exception as e:
            print(f'  다시 {qid} (wikidata): {e}', file=sys.stderr)
            time.sleep(5)
    else:
        print(f'경고: Wikidata 라벨 실패 {qid} — OSM 이름만 쓴다', file=sys.stderr)
        return {}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(labels, ensure_ascii=False))
    return labels


def one_name(v):
    """OSM 여러 값(大倫敦;大伦敦)과 간체·번체 짝(东京都/東京都)은 앞 이름 하나 — 칸과 머리글엔 한 이름이 선다.
    Sudoeste/Octogonal 처럼 라틴 이름의 빗금은 그 이름이다."""
    v = v.split(';')[0].strip()
    parts = [x.strip() for x in v.split('/')]
    return parts[0] if len(parts) > 1 and all(re.search(r'[\u4e00-\u9fff]', x) for x in parts) else v


def titles(tags):
    # OSM 이 먼저, 빈 말만 Wikidata 의 같은 언어 라벨로(own_label) — mul 이나 다른 말로 돌려 쓰지 않는다
    wd = wd_labels(tags['wikidata']) if tags.get('wikidata') else {}
    t = {l: v for l in UI_LANGS for v in [own_label(l, tags, wd)] if v}
    t.setdefault('en', tags.get('name:en') or tags.get('name'))
    return t


def build(iso, out_dir, world):
    qid, level, keep, strip = CAP[iso]
    if level is None:
        print(f'건너뜀 {iso}: 단계 미정 (survey)')
        return []
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
        if not name or (keep and not re.search(keep, name)) or not typable(iso, name, tags):
            continue
        poly = [[r] for r in rs]
        if name in feats:   # 같은 이름은 도형만 합친다
            feats[name]['geometry']['coordinates'] += poly
            continue
        feats[name] = {'type': 'Feature', 'properties': {'name': name, 'tags': tags},
                       'geometry': {'type': 'MultiPolygon', 'coordinates': poly}}
    feats = list(feats.values())
    if len(feats) < 4:
        print(f'건너뜀 {iso}: {len(feats)}곳')
        return []
    slug = f'{iso.lower()}-capital'
    n = stamp(iso, slug, feats, out_dir, 'geoboundaries-' if str(level).startswith('gb:') else 'osm-')
    pack = next(c for c in world['countries'] if c['id'] == iso)
    if not n:   # 칠 만한 판이 아니다 — 지난번에 올린 권역·동네·이름표를 걷는다. 홈은 그 나라 첫 권역(admin)으로
        pack['regions'] = [r for r in pack['regions'] if r['id'] != slug]
        for f in out_dir.glob(f'{slug}-*.json'):
            f.unlink()
        return []
    region = {
        'id': slug, 'root': slug, 'children': sub(iso, par, feats, slug, out_dir) if iso in SUB else {},
        'title': titles(par['tags']),
        'thumb': slug, 'main': slug, 'nested': False, 'courses': [slug],
    }
    region['courses'] += list(region['children'].values())
    region['nested'] = bool(region['children'])
    pack['regions'] = [r for r in pack['regions'] if r['id'] != slug] + [region]
    print(f'{iso} {n}곳 → {slug}' + (f' (고리 못 지은 곳 {dropped})' if dropped else '')
          + (f', 펼친 구 {len(region["children"])}' if region['children'] else ''))
    return [slug, *region['children'].values()]


# 화면 말 → 이름표를 찾는 OSM name:<키>·Wikidata 라벨 키. 없는 말은 제 코드 하나
OSM_KEYS = {'zh': ['zh-Hans', 'zh'], 'nb': ['nb', 'no']}
WD_KEYS = {'zh': ['zh-hans', 'zh-cn', 'zh'], 'nb': ['nb', 'no']}
TAGS = {}   # 슬러그 → {코스 이름: OSM 태그} — stamp 가 채운다


def wd_prefetch(qids):
    """Wikidata 라벨을 50개씩 묶어 캐시에 미리 받는다 — wd_labels 가 하나씩 묻지 않게."""
    todo = sorted({q for q in qids if re.fullmatch(r'Q\d+', q or '')
                   and not (CACHE / 'wikidata' / f'{q}.json').exists()})
    for i in range(0, len(todo), 50):
        ids = todo[i:i + 50]
        url = ('https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&format=json&ids='
               + urllib.parse.quote('|'.join(ids)))
        for n in range(4):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA})
                ents = json.load(urllib.request.urlopen(req, timeout=120))['entities']
                break
            except Exception as e:
                print(f'  다시 wikidata {i}: {e}', file=sys.stderr)
                time.sleep(5)
        else:
            continue
        (CACHE / 'wikidata').mkdir(parents=True, exist_ok=True)
        for q in ids:
            (CACHE / 'wikidata' / f'{q}.json').write_text(
                json.dumps(ents.get(q, {}).get('labels', {}), ensure_ascii=False))


def own_label(lang, tags, wd):
    """그 말로 적힌 이름 — OSM name:<말> 이 먼저, 없으면 Wikidata 같은 말 라벨. 지어내지 않는다."""
    for k in OSM_KEYS.get(lang, [lang]):
        if tags.get(f'name:{k}'):
            return one_name(tags[f'name:{k}'])
    for k in WD_KEYS.get(lang, [lang]):
        if wd.get(k, {}).get('value'):
            return one_name(wd[k]['value'])
    return None


SCRIPT_UI = {'ja', 'zh', 'uk', 'bg', 'el', 'ar', 'th'}
LATIN_UI = {'en', 'de', 'fr', 'es', 'pt', 'it', 'nl', 'pl', 'cs', 'sv', 'nb', 'fi', 'ro', 'hu', 'tr', 'vi', 'id', 'ms'}
# 한국어 표기 때 이름 끝 한자 단위 → 한국어 단위. 읽기에 붙은 영어 단위 낱말은 뗀다
KO_UNIT = [('街道', '가도'), ('地区', '지구'), ('区', '구'), ('區', '구'), ('镇', '진'), ('鎮', '진'),
           ('乡', '향'), ('鄉', '향'), ('里', '리'), ('市', '시')]
EN_UNIT = re.compile(r'(?i)[\s-]+(subdistrict|sub-district|district|town|township|village|ward|city|area|'
                     r'street|residential|community|ku|shi)$')


_PINYIN, _VARIANTS = {}, {}


def unihan():
    """유니코드 Unihan 의 kMandarin 첫 읽기와 글자 이체(간체·번체·같은 뜻·자형) 표 — 받은 표는 캐시에 둔다."""
    if _PINYIN:
        return
    paths = CACHE.parent / 'unihan-mandarin.json', CACHE.parent / 'unihan-variants.json'
    if not all(p.exists() for p in paths):
        import io, zipfile
        req = urllib.request.Request('https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip',
                                     headers={'User-Agent': UA})
        z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(req, timeout=300).read()))
        py, var = {}, defaultdict(list)
        for line in z.read('Unihan_Readings.txt').decode().splitlines():
            f = line.split('\t')
            if len(f) == 3 and f[1] == 'kMandarin':
                py[chr(int(f[0][2:], 16))] = plain(f[2].split()[0]).replace('u:', 'v')
        for line in z.read('Unihan_Variants.txt').decode().splitlines():
            f = line.split('\t')
            if len(f) == 3 and f[1] in ('kSimplifiedVariant', 'kTraditionalVariant', 'kSemanticVariant', 'kZVariant'):
                var[chr(int(f[0][2:], 16))] += [chr(int(h, 16)) for h in re.findall(r'U\+([0-9A-F]+)', f[2])]
        paths[0].write_text(json.dumps(py, ensure_ascii=False))
        paths[1].write_text(json.dumps(var, ensure_ascii=False))
    _PINYIN.update(json.loads(paths[0].read_text()))
    _VARIANTS.update(json.loads(paths[1].read_text()))


def hanzi_pinyin(text):
    """한자 → 성조 없는 병음(마디마다 띄움). 모르는 글자가 있으면 None."""
    unihan()
    out = [_PINYIN.get(c) for c in text]
    return None if None in out else ' '.join(out)


def _gb(c):
    try:
        return len(c.encode('gb2312')) == 2 or c.isascii()
    except UnicodeEncodeError:
        return False


def _jis1(c):
    """JIS 가나·1수준 한자 — 일본어 IME 가 바로 내는 글자. 區 같은 2수준 구자체는 아니다."""
    try:
        b = c.encode('cp932')
    except UnicodeEncodeError:
        return False
    return len(b) == 1 or int.from_bytes(b, 'big') < 0x9873


def cjk_form(name, ok):
    """한자 이름을 그 화면 말 IME 가 내는 꼴로 — 글자마다 이체(세 다리까지, 가까운 것부터)에서 ok 인 첫 글자.
    練馬区 → 练马区, 渋 → 澁 → 澀 → 涩(중국어), 朝阳区 → 朝陽区(일본어). 한 글자라도 못 바꾸면 None."""
    unihan()
    out = []
    for c in name:
        seen, ring = [c], [c]
        for _ in range(3):
            ring = [w for v in ring for w in _VARIANTS.get(v, []) if w not in seen]
            seen += dict.fromkeys(ring)
        hit = next((v for v in seen if ok(v)), None)
        if not hit:
            return None
        out.append(hit)
    return ''.join(out)


# 불가리아 음역법(2009) — 라틴 글자 화면에 영어 이름이 없는 소피아 동네를 적는다
BG_LATIN = dict(zip('абвгдежзийклмнопрстуфхцчшщъьюя',
                    'a b v g d e zh z i y k l m n o p r s t u f h ts ch sh sht a y yu ya'.split()))


def bg_latin(name):
    out = re.sub(r'ия\b', 'ia', name)
    return ''.join((BG_LATIN[c.lower()].capitalize() if c.isupper() else BG_LATIN[c.lower()])
                   if c.lower() in BG_LATIN else c for c in out)


def latin_reading(src, tags, wd):
    """그 이름의 로마자 읽기 — 가나 읽기 태그, 병음 태그, 그다음 영어 이름."""
    kana = tags.get('name:ja-Hira') or tags.get('name:ja_kana') or tags.get('name:ja-Kana')
    if src == 'ja' and kana and kana_roma(kana):
        return kana_roma(kana)
    for k in ('name:ja-Latn', 'name:ja_rm', 'name:zh-Latn-pinyin', 'name:zh_pinyin', 'name:en'):
        if tags.get(k):
            return tags[k]
    return (wd.get('en') or {}).get('value')


def reading(iso, src, name, tags, wd):
    """생성 표기의 입력 — (읽을 글자열, 읽는 규칙 말) 또는 None. 일본·중국은 로마자 읽기(가나·병음)로,
    라틴·키릴·그리스 글자는 제 이름을 그 말 규칙으로, 아랍·타이 글자와 인도·필리핀 지명은
    영어 로마자를 적힌 대로 읽는다."""
    if src in ('ja', 'zh'):
        unit_zh = next((zh for zh, _ in KO_UNIT if name.endswith(zh) and len(name) > len(zh)), '')
        roma = latin_reading(src, tags, wd)
        if not roma and src == 'zh':   # 영어 이름도 Wikidata 도 없는 베이징 진·향 — 한자에서 병음을 읽는다
            roma = hanzi_pinyin(name[:len(name) - len(unit_zh)])
            roma = roma and roma.replace(' ', '')
        return roma and (EN_UNIT.sub('', roma.strip()), 'phon' if src == 'ja' else 'py')
    if src in ('ar', 'th') or iso in ('IN', 'PH', 'SA', 'AE', 'EG'):
        latin = not re.search(r'[^\x00-\x7f\u00c0-\u024f]', name)   # geoBoundaries 카이로는 이름이 이미 로마자
        roma = latin_reading(src, tags, wd) or (name if latin else None)
        stem = roma and re.sub(r'(?i)^(khwaeng|khet|kwaeng)\s+', '', EN_UNIT.sub('', roma.strip()))
        return stem and (stem, 'th' if src == 'th' else 'phon')
    if src == 'vi':
        return re.sub(r'^(Phường|Xã|Thị trấn)\s+', '', name), 'vi'
    if src == 'bg':
        return re.sub(r'^(Район|ж\.\s?к\.|кв\.|с\.)\s*', '', name), 'bg'
    return name, 'pb' if iso == 'BR' else src


def ko_label(iso, src, name, tags, wd):
    """한국어 이름이 없는 지명을 외래어 표기법으로 적는다(tools/translit.py). 못 하면 None.
    일본·중국은 제 표기 규칙(가나·병음 표)에 한자 단위(区 → 구)를 붙인다."""
    r = reading(iso, src, name, tags, wd)
    if not r:
        return None
    if src not in ('ja', 'zh'):
        h = latin_hangul(*r)
        return h and h + ('구' if src == 'bg' and name.startswith('Район ') else '')
    unit = next((ko for zh, ko in KO_UNIT if name.endswith(zh) and len(name) > len(zh)), '')
    hangul = ja_hangul(r[0]) if src == 'ja' else zh_hangul(r[0])
    if not hangul:
        return None
    return hangul + unit if unit and not hangul.endswith(unit) else hangul


def shown_label(iso, lang, src, name, tags, wd):
    """화면 말 lang 으로 보일 이름. 제 말 이름 → (한국어) 표기법 → (제 글자 화면) 그 글자로 생성 → 영어 이름.
    영어도 없으면 None — 코스 이름 그대로 보인다."""
    own = own_label(lang, tags, wd)
    if own and not (lang in LATIN_UI and NONLATIN.search(own)):   # 스웨덴어 Wikidata 라벨이 타이 글자 그대로인 곳이 있다
        return own
    if lang == 'ko':   # 표기법으로 못 적으면 아래 영어 이름으로 — 제 글자(키릴·아랍)는 한국어 자판으로 못 친다
        made = ko_label(iso, src, name, tags, wd)
        if made:
            return made
    elif lang in ('ja', 'zh') and src in ('ja', 'zh'):
        # 한자는 한자로 읽되 그 말 IME 가 내는 꼴로 — 중국어 화면의 練馬区 는 练马区, 일본어 화면의 朝阳区 는 朝陽区.
        # 가나가 섞였거나 바꿀 수 없는 글자가 있으면 아래 그 글자 표기로
        made = not re.search(r'[぀-ヿ]', name) and cjk_form(name, _gb if lang == 'zh' else _jis1)
        if made:
            return made
    if lang in SCRIPT_UI:   # 가나·한자·키릴·그리스·아랍·타이 글자 화면은 그 글자로 적는다
        r = reading(iso, src, name, tags, wd)
        made = r and transcribe(*r, lang)
        if made:
            return made
    if own_label('en', tags, wd):
        return own_label('en', tags, wd)
    if src == 'zh':   # 영어 이름이 없으면 병음(Xiaotangshan)
        py = hanzi_pinyin(name)
        return py and py.replace(' ', '').capitalize()
    if src == 'bg':   # 영어 이름이 없는 소피아 동네는 음역법으로(ж.к. Канала → Kanala) — 앞말은 reading 이 뗀다
        return bg_latin(reading(iso, src, name, tags, wd)[0])
    return None


NONLATIN = re.compile(r'[^\x00-ɏḀ-ỿ‐-’]')


def typable(iso, name, tags):
    """화면 말 누구나 칠 수 있는 칸인가 — 라틴 글자 화면에 보일 이름이 있어야 한다. 없으면 판에서 뺀다
    (영어 이름도 Wikidata 도 없는 리야드 عليشه, 델리 코스의 우르두 이름뿐인 동네)."""
    if not NONLATIN.search(name):
        return True
    wd = wd_labels(tags['wikidata']) if tags.get('wikidata') else {}
    return bool(shown_label(iso, 'en', type_lang(iso)[:2], name, tags, wd))


NE_ADMIN = [Path('/tmp/rt-geo/ne-admin1-10m.geojson'), Path('/tmp/ne-admin1.geojson')]   # build_world.py 의 원본
_NE = {}


def admin_tags(iso, out_dir):
    """나라 전국 코스(<iso>-admin)의 곳마다 Natural Earth 의 말별 이름(name_ko·name_ja…)과 wikidata 를 태그로.
    Nation 플랜 지도와, 수도 판이 없는 나라(남아공·말레이시아)의 홈이 쓴다. 이름이 안 맞는 곳(합친 권역)은 빈 태그 —
    이름표가 규칙으로 적는다. 원본이 없으면 슬러그 없이 돌아온다."""
    slug = f'{iso.lower()}-admin'
    path = out_dir / f'{slug}.course.json'
    src = next((p for p in NE_ADMIN if p.exists()), None)
    if not path.exists() or not src:
        return None
    if not _NE:
        for f in json.loads(src.read_text())['features']:
            _NE.setdefault(f['properties'].get('iso_a2'), []).append(f['properties'])
    fold = lambda v: ''.join(c for c in unicodedata.normalize('NFD', str(v or '')) if not unicodedata.combining(c)) \
        .casefold().replace('-', ' ').strip()   # 악센트만 뗀다 — 한자·가나는 그대로
    feats = _NE.get(iso, [])
    tags = {}
    for it in json.loads(path.read_text())['items']:
        key = fold(it['name'])
        p = next((p for p in feats if key and key in {fold(v) for k, v in p.items()
                  if k.startswith('name') and k not in ('name_len',) and isinstance(v, str)}), None)
        tags[it['name']] = {} if not p else {
            **{f'name:{k[5:]}': v for k, v in p.items() if k.startswith('name_') and k not in ('name_len', 'name_alt', 'name_local', 'name_zht') and v},
            **({'wikidata': p['wikidataid']} if p.get('wikidataid') else {})}
    TAGS[slug] = tags
    return slug


def place_names(iso, slugs, out_dir):
    """수도·동네 이름의 화면 말 표 data/names/<iso>.<말>.json — {'<슬러그>/<이름>': 그 말 이름}.
    코스 제 말(type_lang)은 표가 없다. 말마다 빈 칸 수를 찍는다."""
    src = type_lang(iso)[:2]
    feats = [(slug, name, tags) for slug in slugs for name, tags in TAGS.get(slug, {}).items()]
    wd_prefetch([t.get('wikidata') for _, _, t in feats])
    wds = {t['wikidata']: wd_labels(t['wikidata']) for _, _, t in feats if t.get('wikidata')}
    gaps = {}
    (out_dir / 'names').mkdir(exist_ok=True)
    for lang in UI_LANGS:
        path = out_dir / 'names' / f'{iso.lower()}.{lang}.json'
        if lang == src:
            path.unlink(missing_ok=True)
            continue
        tab = {}
        for slug, name, tags in feats:
            v = shown_label(iso, lang, src, name, tags, wds.get(tags.get('wikidata'), {}))
            if v and v != name:
                tab[f'{slug}/{name}'] = v
            elif not v:
                gaps[lang] = gaps.get(lang, 0) + 1
                if lang == 'ko' and gaps[lang] <= 3:
                    print(f'    ko 빈 칸: {name} {dict((k, v) for k, v in tags.items() if k in ("name:en", "wikidata"))}')
        path.write_text(json.dumps(tab, ensure_ascii=False, separators=(',', ':'), sort_keys=True))
    print(f'  이름 {len(feats)}곳, 빈 칸: ' + ' '.join(f'{k}{v}' for k, v in gaps.items()))


# 칠 만한 판인가. 한 곳이 도트의 MAX_SHARE 넘게 차지하면(쿠알라룸푸르 도시 경계가 읍을 덮음) 판이 아니고,
# 동네 판은 MAX_KIDS 곳까지다(서울 동 판이 스물몇 곳). 도트는 곳마다 둘은 되게 격자를 키운다
MAX_SHARE, MAX_KIDS, COLS = .75, 80, (32, 40, 48, 56, 64)


def drop(out_dir, slug):
    for ext in ('course', 'geom'):
        (out_dir / f'{slug}.{ext}.json').unlink(missing_ok=True)


def stamp(iso, slug, feats, out_dir, src_tag, max_items=None):
    """GeoJSON 항목 → <slug>.geom.json(build_map.py)·<slug>.course.json. 곳 수, 못 찍거나 칠 만한 판이
    아니면 0(남은 파일도 지운다)."""
    if max_items and len(feats) > max_items:
        drop(out_dir, slug)
        return 0
    src = Path(tempfile.mkdtemp(prefix='rt-cap-')) / f'{slug}.geojson'
    src.write_text(json.dumps({'type': 'FeatureCollection', 'features': feats}, ensure_ascii=False))
    geom_path = out_dir / f'{slug}.geom.json'
    def run(cols):
        r = subprocess.run([sys.executable, str(HERE / 'build_map.py'), str(src), str(geom_path), str(cols)],
                           capture_output=True, text=True)
        if r.returncode:
            return None, r.stderr
        g = json.loads(geom_path.read_text())
        return g, Counter(c for row in g['grid'] for c in row if c != '.')

    # 곳마다 도트 둘이 되는 가장 작은 격자. 끝내 안 되면(아주 작은 마을) 외톨이 도트가 가장 적은 격자 —
    # 같으면 작은 쪽. 격자를 마냥 키우면 지도가 무거워질 뿐 외톨이는 그대로다
    tried = {}
    for cols in COLS:
        geom, dots = run(cols)
        if geom is None:
            err = dots
            continue
        tried[cols] = sum(1 for v in dots.values() if v < 2)
        if not tried[cols]:
            break
    if not tried:
        print(f'실패 {slug}: {err.strip()[-300:]}')
        return 0
    best = min(tried, key=lambda c: (tried[c], c))
    if best != cols or geom is None:
        geom, dots = run(best)
    if max(dots.values()) > MAX_SHARE * sum(dots.values()):
        print(f'  건너뜀 {slug}: 한 곳이 도트의 {max(dots.values()) * 100 // sum(dots.values())}%')
        drop(out_dir, slug)
        return 0
    TAGS[slug] = {f['properties']['name']: f['properties'].get('tags') or {} for f in feats}
    items = [{'name': it['name'], 'meta': {'description': ''}} for it in order(geom['items'])]
    n = len(items)
    (out_dir / f'{slug}.course.json').write_text(json.dumps({
        'slug': slug,
        'title': f'{n}',
        'description': '',
        'mode': 'sequence',
        'dataVersion': src_tag + time.strftime('%Y%m'),
        'lang': type_lang(iso),
        'settings': {'defaultTime': 120 if n < 30 else 180 if n < 60 else 300},
        'items': items,
    }, ensure_ascii=False, separators=(',', ':')))
    return n


def bbox(rs):
    xs, ys = [p[0] for r in rs for p in r], [p[1] for r in rs for p in r]
    return min(xs), min(ys), max(xs), max(ys)


def sub(iso, par, feats, cap, out_dir):
    """수도의 구 하나하나를 한 단계 아래 구획으로 편다 — 서울 구 → 행정동 자리다.
    아래 구획은 수도 안에서 한 번에 받아 구마다 '꼭짓점 과반이 그 구 안' 으로 나눈다.
    네 곳이 안 되는 구는 펴지 않는다. 슬러그는 구 이름의 md5 앞 6자 — 다시 찍어도 기록이 이어진다.
    돌려주는 값은 world.json 권역의 children: {'<cap>/<구>': '<cap>-<md5>'}."""
    level, strip = SUB[iso]
    for f in out_dir.glob(f'{cap}-*.json'):   # 지난번 동네 판 — 이번에 못 서는 구는 남지 않게
        f.unlink()
    filt = level if level.startswith('[') else f'[boundary=administrative][admin_level~"^({level})$"]'
    q = f'[out:json][timeout:300];rel({par["id"]});map_to_area->.a;rel(area.a){filt};out geom;'
    units = [(k['tags'], rs, bbox(rs)) for k in overpass(q, f'{iso}-sub') if k['id'] != par['id']
             for rs in [rings(k)] if rs]
    children = {}
    for f in feats:
        ward = f['properties']['name']
        wrs = [poly[0] for poly in f['geometry']['coordinates']]
        wx0, wy0, wx1, wy1 = bbox(wrs)
        edge = {p for r in wrs for p in r}
        got = {}
        for tags, rs, (x0, y0, x1, y1) in units:
            if x1 < wx0 or x0 > wx1 or y1 < wy0 or y0 > wy1 or not within(rs, wrs, edge, 24):
                continue
            name = typing_name(tags, iso, strip)   # 베를린 Mitte 구의 Mitte 처럼 구와 같은 이름도 제 동네다
            if not name or not typable(iso, name, tags):
                continue
            poly = [[r] for r in rs]
            if name in got:
                got[name]['geometry']['coordinates'] += poly
                continue
            got[name] = {'type': 'Feature', 'properties': {'name': name, 'tags': tags},
                         'geometry': {'type': 'MultiPolygon', 'coordinates': poly}}
        if len(got) < 4:
            continue
        slug = f'{cap}-{hashlib.md5(ward.encode()).hexdigest()[:6]}'
        if stamp(iso, slug, list(got.values()), out_dir, 'osm-', MAX_KIDS):
            children[f'{cap}/{ward}'] = slug
    return children


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
        slugs = build(iso, out_dir, world) or []
        admin = admin_tags(iso, out_dir)
        place_names(iso, slugs + ([admin] if admin else []), out_dir)
    world_path.write_text(json.dumps(world, ensure_ascii=False, separators=(',', ':')))
