"""Natural Earth admin-1 → 나라별 코스·지형·픽셀·목록.

서울 코스는 손대지 않는다. 한국은 서울만 — 시도(kr-admin) 코스는 만들지 않는다.

    python3 tools/build_world.py \\
        /tmp/rt-geo/ne-admin1-10m.geojson \\
        /tmp/rt-geo/ne-admin0.geojson data/
"""
import json, math, os, subprocess, sys, tempfile, unicodedata
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
admin1_src, admin0_src, out_dir = sys.argv[1], sys.argv[2], Path(sys.argv[3])
ONLY = sys.argv[4].upper() if len(sys.argv) > 4 else ''
DOTS = 500
COLS_MIN, COLS_MAX = 24, 56

# 치는 이름에 쓸 속성. 없으면 name → name_en 순.
NAME_AT = {
    'JP': 'name_ja', 'KR': 'name_ko', 'CN': 'name_zh', 'TW': 'name_zht',
    'HK': 'name_zh', 'DE': 'name_de', 'ES': 'name_es', 'IT': 'name_it',
    'PT': 'name_pt', 'NL': 'name_nl', 'PL': 'name_pl', 'SE': 'name_sv',
    'NO': 'name_en', 'FI': 'name_en', 'GR': 'name_el', 'TR': 'name_tr',
    'UA': 'name_uk', 'HU': 'name_hu',
    'BG': 'name_en', 'CZ': 'name_en', 'FR': 'name', 'GB': 'name', 'RO': 'name',
    'US': 'name', 'CA': 'name', 'AU': 'name', 'MX': 'name_es',
    'BR': 'name_pt', 'AR': 'name_es', 'CL': 'name_es', 'CO': 'name_es',
    'IN': 'name', 'ID': 'name', 'MY': 'name', 'NZ': 'name',
    'ZA': 'name', 'EG': 'name', 'SA': 'name_ar', 'AE': 'name_ar',
    'VN': 'name_vi', 'TH': 'name_th', 'PH': 'name', 'BE': 'name',
    'AT': 'name_de', 'CH': 'name', 'IE': 'name',
}

# 입력창 lang. UI 언어와 따로다.
TYPE_LANG = {
    'KR': 'ko', 'JP': 'ja', 'CN': 'zh', 'TW': 'zh-Hant', 'HK': 'zh-Hant',
    'DE': 'de', 'FR': 'fr', 'IT': 'it', 'ES': 'es', 'PT': 'pt', 'NL': 'nl',
    'PL': 'pl', 'SE': 'sv', 'NO': 'nb', 'FI': 'fi', 'GR': 'el', 'TR': 'tr',
    'UA': 'uk', 'RO': 'ro', 'HU': 'hu', 'BG': 'bg', 'CZ': 'cs',
    'GB': 'en', 'US': 'en', 'CA': 'en', 'AU': 'en', 'IE': 'en', 'NZ': 'en',
    'ZA': 'en', 'IN': 'en', 'PH': 'en', 'MY': 'ms', 'ID': 'id',
    'MX': 'es', 'AR': 'es', 'CL': 'es', 'CO': 'es', 'BR': 'pt',
    'EG': 'ar', 'SA': 'ar', 'AE': 'ar', 'VN': 'vi', 'TH': 'th',
    'BE': 'nl', 'AT': 'de', 'CH': 'de',
}

# group: admin-1 가 너무 잘게 쪼개진 나라는 한 단계 위로 합친다.
# drop_type / keep_unit 으로 해외 영토를 뺀다.
PACKS = {
    # KR: 시도(kr-admin) 코스 없음 — 서울만 seoul() 로 고정.
    'JP': {},
    'US': {},
    'CN': {'keep_unit': 'China'},
    'TW': {},
    'HK': {},
    'DE': {},
    'FR': {'group': 'region', 'keep_unit': 'France'},
    'IT': {'group': 'region'},
    'ES': {},
    'GB': {'group': 'geonunit'},
    'NL': {'drop_type': 'Special Municipality'},
    'BE': {},
    'PL': {},
    'PT': {},
    'AT': {},
    'CH': {},
    'CZ': {},
    'SE': {},
    'NO': {},
    'FI': {},
    'IE': {},
    'CA': {},
    'AU': {},
    'MX': {},
    'BR': {},
    'IN': {},
    'ID': {},
    'MY': {},
    'NZ': {},
    'AR': {},
    'CL': {},
    'CO': {},
    'ZA': {},
    'EG': {},
    'SA': {},
    'AE': {},
    'TR': {},
    'VN': {},
    'TH': {},
    'PH': {},
    'UA': {},
    'RO': {},
    'HU': {},
    'BG': {},
    'GR': {},
}

SEOUL_COURSES = [
    'seoul-gu', 'gangseo-dong', 'dobong-dong', 'dongdaemun-dong', 'dongjak-dong',
    'eunpyeong-dong', 'gangbuk-dong', 'gangdong-dong', 'gangnam-dong',
    'geumcheon-dong', 'guro-dong', 'gwanak-dong', 'gwangjin-dong', 'jongno-dong',
    'jung-dong', 'jungnang-dong', 'mapo-dong', 'nowon-dong', 'seocho-dong',
    'seodaemun-dong', 'seongbuk-dong', 'seongdong-dong', 'songpa-dong',
    'yangcheon-dong', 'yeongdeungpo-dong', 'yongsan-dong',
]


def iso_of(p):
    iso = p.get('iso_a2') or ''
    if iso in ('-99', '-1', '', None):
        return p.get('adm0_a3') or ''
    return iso


def clean(s):
    s = (s or '').replace('·', ',').strip()
    if '|' in s:
        s = s.split('|')[-1].strip()   # 甘肅|甘肃 → 간이체
    return s


def fold_mark(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s)
                   if not unicodedata.combining(c))


def is_jamo(s):
    return any('\u1100' <= c <= '\u11ff' or '\u3130' <= c <= '\u318f' for c in s)


def typing_name(p, iso):
    key = NAME_AT.get(iso, 'name')
    for k in (key, 'name_local', 'name', 'name_en'):
        v = clean(p.get(k))
        if v:
            return v
    return '?'


def aliases_of(p, name):
    out = []
    postal = clean(p.get('postal') or '')
    if 1 < len(postal) <= 3 and postal.upper() != name.upper():
        out.append(postal.upper() if postal.isalpha() else postal)
    folded = fold_mark(name)
    if folded != name and not is_jamo(folded):
        out.append(folded)
    # 고유
    seen, uniq = set(), []
    for a in out:
        if a and a != name and a not in seen:
            seen.add(a); uniq.append(a)
    return uniq


def unique_aliases(items):
    """같은 코스 안에서 두 곳이 나눠 가진 약칭은 확정에 쓰지 못한다."""
    n = {}
    for it in items:
        for a in it.get('aliases') or []:
            n[a] = n.get(a, 0) + 1
    for it in items:
        keep = [a for a in (it.get('aliases') or []) if n.get(a) == 1]
        if keep:
            it['aliases'] = keep
        else:
            it.pop('aliases', None)


def order(items):
    """무게중심 최근접 이웃. 서쪽 끝에서 출발한다."""
    left = items[:]
    path = [min(left, key=lambda it: it['c'][0])]
    left.remove(path[0])
    while left:
        cx, cy = path[-1]['c']
        nxt = min(left, key=lambda it: (it['c'][0] - cx) ** 2 + (it['c'][1] - cy) ** 2)
        left.remove(nxt)
        path.append(nxt)
    return path


def merge_group(feats, key, name_iso):
    bags = defaultdict(list)
    for f in feats:
        k = f['properties'].get(key)
        if k:
            bags[k].append(f)
    out = []
    for name, fs in bags.items():
        coords = []
        for f in fs:
            g = f['geometry']
            if g['type'] == 'Polygon':
                coords.append(g['coordinates'])
            else:
                coords.extend(g['coordinates'])
        out.append({
            'type': 'Feature',
            'properties': {'name': clean(name), 'postal': None},
            'geometry': {'type': 'MultiPolygon', 'coordinates': coords},
        })
    return out


def pick_feats(all_feats, iso, spec):
    feats = [f for f in all_feats if iso_of(f['properties']) == iso]
    if spec.get('keep_unit'):
        feats = [f for f in feats if f['properties'].get('geonunit') == spec['keep_unit']]
    if spec.get('drop_type'):
        feats = [f for f in feats if f['properties'].get('type_en') != spec['drop_type']]
    if spec.get('group'):
        return merge_group(feats, spec['group'], iso)
    labeled = []
    for f in feats:
        p = dict(f['properties'])
        p['name'] = typing_name(p, iso)
        labeled.append({'type': 'Feature', 'properties': p, 'geometry': f['geometry']})
    # 같은 이름이 두 번 나오면 뒤에 도형만 합친다
    by = {}
    for f in labeled:
        n = f['properties']['name']
        if n not in by:
            by[n] = f
            continue
        g0, g1 = by[n]['geometry'], f['geometry']
        c0 = [g0['coordinates']] if g0['type'] == 'Polygon' else g0['coordinates']
        c1 = [g1['coordinates']] if g1['type'] == 'Polygon' else g1['coordinates']
        by[n]['geometry'] = {'type': 'MultiPolygon', 'coordinates': c0 + c1}
    return list(by.values())


admin1 = json.load(open(admin1_src))['features']
world = {'countries': []}

seoul = {
    'id': 'KR',
    'lang': 'ko',
    'pixels': 'korea-pixels',
    'regions': [
        {
            'id': 'seoul',
            'title': {'ko': '서울', 'en': 'Seoul', 'ja': 'ソウル'},
            'description': {
                'ko': '한강이 가로지르는 수도. 25개 자치구부터 423개 행정동까지.',
                'en': 'The capital on the Hangang. 25 districts, 423 dongs.',
                'ja': '漢江が横切る首都。25自治区から423行政洞まで。',
            },
            'thumb': 'seoul-gu',
            'main': 'seoul-gu',
            'nested': True,
            'courses': SEOUL_COURSES,
        }
    ],
}

tmp = Path(tempfile.mkdtemp(prefix='rt-world-'))

for iso, spec in PACKS.items():
    if ONLY and iso != ONLY:
        continue
    feats = pick_feats(admin1, iso, spec)
    if len(feats) < 4:
        print(f'건너뜀 {iso}: {len(feats)}곳')
        continue
    slug = f'{iso.lower()}-admin'
    src = tmp / f'{iso}.geojson'
    json.dump({'type': 'FeatureCollection', 'features': feats},
              open(src, 'w'), ensure_ascii=False)
    geom_path = out_dir / f'{slug}.geom.json'
    course_path = out_dir / f'{slug}.course.json'

    last = None
    for cols in (32, 40, 48):
        r = subprocess.run([sys.executable, str(HERE / 'build_map.py'),
                            str(src), str(geom_path), str(cols)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            last = r.stderr.strip() or r.stdout.strip()
            continue
        geom = json.load(open(geom_path))
        dots = sum(len(row) - row.count('.') for row in geom['grid'])
        last = None
        if dots >= min(DOTS, 28 * len(feats)):
            break
    if last:
        print(f'실패 {iso}: {last}')
        continue

    geom = json.load(open(geom_path))
    # 별칭은 원본 속성에서. 합친 그룹은 postal 이 없다
    alias_at = {}
    if not spec.get('group'):
        for f in feats:
            alias_at[f['properties']['name']] = aliases_of(f['properties'], f['properties']['name'])
    ordered = order(geom['items'])
    items = []
    for it in ordered:
        rec = {'name': it['name'], 'meta': {'description': ''}}
        a = alias_at.get(it['name']) or []
        if a:
            rec['aliases'] = a
        items.append(rec)
    unique_aliases(items)

    title = f'{len(items)}'
    json.dump({
        'slug': slug,
        'title': title,
        'description': '',
        'mode': 'sequence',
        'dataVersion': 'ne-10m-admin1',
        'lang': TYPE_LANG.get(iso, 'en'),
        'settings': {'defaultTime': 120 if len(items) < 30 else 180 if len(items) < 60 else 300},
        'items': items,
    }, open(course_path, 'w'), ensure_ascii=False, separators=(',', ':'))

    pix = out_dir / f'{iso.lower()}-pixels.json'
    r = subprocess.run([sys.executable, str(HERE / 'build_pixels.py'),
                        admin0_src, str(pix), '34', iso],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(f'픽셀 실패 {iso}: {r.stderr.strip() or r.stdout.strip()}')
        continue

    region = {
        'id': slug,
        'thumb': slug,
        'main': slug,
        'nested': False,
        'courses': [slug],
    }
    world['countries'].append({
        'id': iso,
        'lang': TYPE_LANG.get(iso, 'en')[:2],
        'pixels': f'{iso.lower()}-pixels',
        'regions': [region],
    })
    print(f'{iso} {len(items)}곳 → {slug}')

if ONLY:
    path = out_dir / 'world.json'
    prev = json.loads(path.read_text()) if path.exists() else {'countries': []}
    by = {c['id']: c for c in prev['countries']}
    for c in world['countries']:
        by[c['id']] = c
    # KR 은 서울 카드로 고정. PACKS 에 KR 이 없으므로 항상 이 값으로 덮는다.
    by['KR'] = seoul
    order = ['KR','JP','US','CN','TW','HK','DE','FR','IT','ES','GB']
    rest = sorted(k for k in by if k not in order)
    world = {'countries': [by[k] for k in order if k in by] + [by[k] for k in rest]}
    json.dump(world, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f"world.json 갱신 {ONLY}")
else:
    world['countries'].insert(0, seoul)
    json.dump(world, open(out_dir / 'world.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f"world.json {len(world['countries'])}개국")
