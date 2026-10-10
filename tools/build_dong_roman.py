"""서울 동 이름의 로마자 — 화면 말이 한국어가 아닐 때 동 칸에 보이는 이름.

kr-names.json 은 구까지만 있다(원본 southkorea-maps 에 동 name_eng 가 없다).
동은 국어의 로마자 표기법(2000)으로 찍는다: 받침 넘김, 비음화, ㄹ 의 ㄴ·ㄹ 동화는
적고 된소리는 적지 않는다. 체언이라 ㄱ·ㄷ·ㅂ 뒤 ㅎ 은 거센소리로 바꾸지 않는다(집현 Jiphyeon).
행정 단위 앞에는 붙임표를 넣고 그 앞뒤로는 동화하지 않는다(Sinmunno 1-ga).
규칙으로 안 맞는 공식 표기는 FIX 에 적는다 — 지어내지 않는다.

build_names.py 다음에 돌린다. kr-names.json 에 '<코스 슬러그>/<동 이름>' 키를 덧붙인다.

    python3 tools/build_dong_roman.py
"""
import json, re
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data'

INI = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
MED = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi',
       'yu', 'eu', 'ui', 'i']
# 받침 → 대표음(끝소리) · 모음 앞으로 넘어갈 때의 첫소리. 겹받침은 앞 것이 남고 뒤 것이 넘어간다
FIN = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ',
       'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
CODA = {'': '', 'ㄱ': 'k', 'ㄲ': 'k', 'ㄳ': 'k', 'ㄴ': 'n', 'ㄵ': 'n', 'ㄶ': 'n', 'ㄷ': 't', 'ㄹ': 'l', 'ㄺ': 'k',
        'ㄻ': 'm', 'ㄼ': 'l', 'ㄽ': 'l', 'ㄾ': 'l', 'ㄿ': 'p', 'ㅀ': 'l', 'ㅁ': 'm', 'ㅂ': 'p', 'ㅄ': 'p', 'ㅅ': 't',
        'ㅆ': 't', 'ㅇ': 'ng', 'ㅈ': 't', 'ㅊ': 't', 'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 't'}
# 모음 앞: (남는 끝소리, 넘어가는 첫소리)
LINK = {'ㄱ': ('', 'g'), 'ㄲ': ('', 'kk'), 'ㄳ': ('k', 's'), 'ㄴ': ('', 'n'), 'ㄵ': ('n', 'j'), 'ㄶ': ('', 'n'),
        'ㄷ': ('', 'd'), 'ㄹ': ('', 'r'), 'ㄺ': ('l', 'g'), 'ㄻ': ('l', 'm'), 'ㄼ': ('l', 'b'), 'ㄽ': ('l', 's'),
        'ㄾ': ('l', 't'), 'ㄿ': ('l', 'p'), 'ㅀ': ('', 'r'), 'ㅁ': ('', 'm'), 'ㅂ': ('', 'b'), 'ㅄ': ('p', 's'),
        'ㅅ': ('', 's'), 'ㅆ': ('', 'ss'), 'ㅇ': ('ng', ''), 'ㅈ': ('', 'j'), 'ㅊ': ('', 'ch'), 'ㅋ': ('', 'k'),
        'ㅌ': ('', 't'), 'ㅍ': ('', 'p'), 'ㅎ': ('', '')}
NASAL = {'k': 'ng', 't': 'n', 'p': 'm'}

FIX = {}   # '<이름>': '<공식 로마자>' — 규칙과 다른 공식 표기만


def syl(c):
    i = ord(c) - 0xAC00
    return INI[i // 588], MED[i % 588 // 28], FIN[i % 28]


def roman(word):
    """한 덩어리(붙임표 없는) 한글을 소리대로 로마자로."""
    s = [list(syl(c)) for c in word]
    out = []
    for k, (ini, med, fin) in enumerate(s):
        if k + 1 < len(s):
            nxt = s[k + 1]
            if nxt[0] == '':                       # 모음 앞: 받침 넘김
                coda, nxt[0] = LINK[fin] if fin else ('', '')
            else:
                coda = CODA[fin]
                if nxt[0] == 'r':
                    if coda == 'n' and k + 2 == len(s) and nxt[1] == 'o':   # 길 이름 로: 신문로 [신문노] Sinmunno
                        nxt[0] = 'n'
                    elif coda in ('n', 'l'):       # 신림 Sillim, 문래 Mullae
                        coda, nxt[0] = 'l', 'l'
                    elif coda:                     # 종로 Jongno, 왕십리 Wangsimni
                        nxt[0] = 'n'
                if nxt[0] in ('n', 'm') and coda in NASAL:   # 독립 Dongnip
                    coda = NASAL[coda]
                if nxt[0] == 'l' and coda == 'n':
                    coda = 'l'
        else:
            coda = CODA[fin]
        out.append(ini + med + coda)
    return ''.join(out)


UNIT = re.compile(r'^(?P<stem>[가-힣]+?)(?P<num>[0-9][0-9,·.]*)?(?P<unit>가동|가|동)?'
                  r'(?:(?P<num2>[0-9][0-9,·.]*)(?P<unit2>동))?$')


def dong_en(name):
    if name in FIX:
        return FIX[name]
    m = UNIT.match(name)
    if not m:
        raise ValueError(name)
    stem, num, unit, num2, unit2 = m.group('stem', 'num', 'unit', 'num2', 'unit2')
    if unit == '가' and not num and not num2:      # 가회동처럼 '가' 가 이름의 일부
        stem, unit = stem + '가', None
    # 필동1가 · 성수1가2동: 이름 끝의 동은 단위다
    tail = []
    if stem.endswith('동') and len(stem) > 1 and (num or unit):
        stem = stem[:-1]
        tail.append('-dong')
    head = roman(stem)
    head = head[0].upper() + head[1:]
    s = head + ''.join(tail)
    if num:
        s += f' {num.replace("·", ",")}'
    if unit:
        s += '-' + {'가동': 'ga-dong', '가': 'ga', '동': 'dong'}[unit]
    if num2:
        s += f' {num2}-dong'
    return s


assert dong_en('신림동') == 'Sillim-dong'
assert dong_en('종로1,2,3,4가동') == 'Jongno 1,2,3,4-ga-dong'
assert dong_en('왕십리도선동') == 'Wangsimnidoseon-dong'
assert dong_en('청량리동') == 'Cheongnyangni-dong'
assert dong_en('홍은1동') == 'Hongeun 1-dong'
assert dong_en('북아현동') == 'Bugahyeon-dong'
assert dong_en('연희동') == 'Yeonhui-dong'
assert dong_en('일원본동') == 'Irwonbon-dong'
assert dong_en('원효로4가') == 'Wonhyoro 4-ga'
assert dong_en('성수1가2동') == 'Seongsu 1-ga 2-dong'
assert dong_en('필동1가') == 'Pil-dong 1-ga'
assert dong_en('공릉1동') == 'Gongneung 1-dong'
assert dong_en('문래동') == 'Mullae-dong'
assert dong_en('가회동') == 'Gahoe-dong'
assert dong_en('신문로2가') == 'Sinmunno 2-ga' and dong_en('남대문로5가') == 'Namdaemunno 5-ga'

if __name__ == '__main__':
    path = DATA / 'kr-names.json'
    names = json.loads(path.read_text())
    tree = json.loads((DATA / 'kr-tree.json').read_text())
    n = 0
    for gu in (p for p in tree['children'] if p.startswith('seoul-gu/')):
        slug = tree['children'][gu]
        if not slug:
            continue
        for s in (slug, slug.replace('-dong', '-bdong')):
            f = DATA / f'{s}.course.json'
            if not f.exists():
                continue
            for it in json.loads(f.read_text())['items']:
                names[f'{s}/{it["name"]}'] = dong_en(it['name'])
                n += 1
    path.write_text(json.dumps(names, ensure_ascii=False, separators=(',', ':')))
    print(f'동 {n}곳')
