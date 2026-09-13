"""대한민국 지명의 로마자 표 — 화면 말이 한국어가 아닐 때 코스 칸에 보이는 이름.

치는 이름은 그대로 한국어다. 원본(southkorea-maps 2018)의 name_eng 를 쓰되,
붙어 버린 것(Suwonsijangangu)과 접미가 빠진 것(광주시 → Gwangju)은 행정 단위
접미로 다시 가른다. 원본이 도시를 빼먹은 두 곳(창원시·포항시의 구)만 그 도시의
공식 로마자를 앞에 붙인다 — 그 밖에 지어내는 이름은 없다.

키는 kr-tree.json 과 같은 '부모슬러그/이름'이다. 중구·동구가 여러 시에 있다.

    python3 tools/build_names.py prov.json muni.json submuni.json muni-dokdo.json data/
"""
import json, re, sys
from pathlib import Path

SUFFIX = {'시': 'si', '군': 'gun', '구': 'gu', '읍': 'eup', '면': 'myeon', '동': 'dong'}
CITY = {'창원시': 'Changwon-si', '포항시': 'Pohang-si'}   # 원본 name_eng 에 도시가 없다


def unit(ko, en):
    """Hwaseongsi → Hwaseong-si, 광주시 Gwangju → Gwangju-si. 이미 갈라져 있으면 그대로."""
    tail = SUFFIX.get(ko[-1])
    if not tail or '-' in en:
        return en
    stem = en[:-len(tail)] if en.lower().endswith(tail) and len(en) > len(tail) + 1 else en
    return f'{stem[0].upper()}{stem[1:]}-{tail}'


def roman(ko, en):
    m = re.match(r'^(.+?시)(.+구)$', ko)
    if not m:
        return unit(ko, en)
    city, gu = m.groups()
    if city in CITY:                         # 창원시의창구 Uichanggu, 포항시남구 Nam-gu
        return f'{CITY[city]} {unit(gu, en)}'
    i = en.lower().find('si', 2)             # Suwonsijangangu → Suwon + si + jangangu
    return f'{unit(city, en[:i + 2])} {unit(gu, en[i + 2:])}'


assert roman('수원시장안구', 'Suwonsijangangu') == 'Suwon-si Jangan-gu'
assert roman('고양시일산동구', 'Goyangsiilsandonggu') == 'Goyang-si Ilsandong-gu'
assert roman('창원시의창구', 'Uichanggu') == 'Changwon-si Uichang-gu'
assert roman('포항시남구', 'Nam-gu') == 'Pohang-si Nam-gu'
assert roman('화성시', 'Hwaseongsi') == 'Hwaseong-si'
assert roman('광주시', 'Gwangju') == 'Gwangju-si'
assert roman('연기면', 'Yeongimyeon') == 'Yeongi-myeon'
assert roman('강서구', 'Gangseo-gu') == 'Gangseo-gu'
assert roman('독도', 'Dokdo') == 'Dokdo'

if __name__ == '__main__':
    prov_src, muni_src, sub_src, dokdo_src = sys.argv[1:5]
    out_dir = Path(sys.argv[5])
    prov = json.load(open(prov_src))['features']
    # 시·도는 원본 그대로, 세종만 Sejongsi → Sejong (서울·부산처럼 접미 없이)
    names = {f"kr-admin/{f['properties']['name']}": re.sub(r'(?<=[a-z])si$', '', f['properties']['name_eng'])
             for f in prov}
    code = {f['properties']['name']: f['properties']['code'] for f in prov}
    # 시군구가 먼저 — 같은 코드 앞머리의 읍면동 이름이 시군구 이름을 덮지 않게
    feats = [f['properties'] for src in (muni_src, dokdo_src, sub_src) for f in json.load(open(src))['features']]
    tree = json.loads((out_dir / 'kr-tree.json').read_text())['children']
    for key, slug in tree.items():
        parent, sido = key.split('/')
        if parent != 'kr-admin' or not slug:
            continue
        src = {}
        for p in feats:
            if str(p['code']).startswith(code[sido]) and p.get('name_eng'):
                src.setdefault(p['name'].replace('·', ','), p['name_eng'])
        for it in json.load(open(out_dir / f'{slug}.geom.json'))['items']:
            assert it['name'] in src, f'로마자 없음: {slug}/{it["name"]}'
            names[f"{slug}/{it['name']}"] = roman(it['name'], src[it['name']])
    (out_dir / 'kr-names.json').write_text(
        json.dumps(names, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'kr-names.json: {len(names)}곳')
