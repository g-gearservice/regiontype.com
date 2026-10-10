"""서울 구·동 이름의 키릴 표기 — 화면 말이 우크라이나어·불가리아어일 때 칸에 보이는 이름.

콘체비치 방식(한국어의 표준 키릴 전사)을 소리대로 적는다. 소리 바뀜(받침 넘김, 비음화, ㄹ 동화)은
build_dong_roman 의 표(syl·LINK·CODA·NASAL)와 이름 풀이(UNIT)를 그대로 쓴다 — 여기서 다시 짜지 않는다.
첫소리 ㄱㄷㅂㅈ 은 말머리에서 맑게(к т п ч), 모음·ㄴㅁㅇㄹ 뒤에서 흐리게(г д б чж) 적는다.
거센소리는 чх кх тх пх, 받침 ㅇ 은 н, 받침 ㄹ 은 ль, ㄹㄹ 은 льл.
행정 단위는 -гу · -дон · -га · -га-дон, 숫자는 그대로 두고 앞에 공백(Хонин 1-дон).

kr-names.json 과 같은 키(구 25 + 동 890)로 data/kr-names.uk.json · data/kr-names.bg.json 을 쓴다.

    python3 tools/build_kr_cyr.py
"""
import json
from pathlib import Path

from build_dong_roman import CODA, LINK, NASAL, UNIT, syl

DATA = Path(__file__).resolve().parent.parent / 'data'

# 첫소리: (말머리·거센 뒤 맑은소리, 흐린소리). 흐림 짝이 없는 것은 하나만
INI = {'g': ('к', 'г'), 'd': ('т', 'д'), 'b': ('п', 'б'), 'j': ('ч', 'чж'), 'kk': ('кк',), 'tt': ('тт',),
       'pp': ('пп',), 'ss': ('сс',), 'jj': ('чч',), 'n': ('н',), 'r': ('р',), 'l': ('л',), 'm': ('м',),
       's': ('с',), 'ch': ('чх',), 'k': ('кх',), 't': ('тх',), 'p': ('пх',), 'h': ('х',), '': ('',)}
FINAL = {'': '', 'k': 'к', 'n': 'н', 't': 'т', 'l': 'ль', 'm': 'м', 'p': 'п', 'ng': 'н'}
VOICING = ('', 'n', 'm', 'ng', 'l')        # 이 받침(또는 모음) 뒤에서 ㄱㄷㅂㅈ 이 흐려진다

# 모음: 언어별 (자음 뒤, 첫머리). 한 글자면 둘 다 같다
VOWEL = {
    'uk': {'a': 'а', 'ae': 'е', 'ya': 'я', 'yae': ('є', 'є'), 'eo': 'о', 'e': 'е', 'yeo': ('ьо', 'йо'),
           'ye': ('є', 'є'), 'o': 'о', 'wa': 'ва', 'wae': 'ве', 'oe': 'ве', 'yo': ('ьо', 'йо'), 'u': 'у',
           'wo': 'во', 'we': 'ве', 'wi': 'ві', 'yu': 'ю', 'eu': 'и', 'ui': 'ий', 'i': 'і'},
    'bg': {'a': 'а', 'ae': 'е', 'ya': 'я', 'yae': ('е', 'йе'), 'eo': 'о', 'e': 'е', 'yeo': ('ьо', 'йо'),
           'ye': ('е', 'йе'), 'o': 'о', 'wa': 'ва', 'wae': 'ве', 'oe': 'ве', 'yo': ('ьо', 'йо'), 'u': 'у',
           'wo': 'во', 'we': 'ве', 'wi': 'ви', 'yu': 'ю', 'eu': 'ъ', 'ui': 'ъй', 'i': 'и'},
}


def sounds(word):
    """한 덩어리 한글 → [(첫소리, 모음, 끝소리)] — build_dong_roman.roman 과 같은 소리 바뀜."""
    s = [list(syl(c)) for c in word]
    out = []
    for k, (ini, med, fin) in enumerate(s):
        if k + 1 < len(s):
            nxt = s[k + 1]
            if nxt[0] == '':
                coda, nxt[0] = LINK[fin] if fin else ('', '')
            else:
                coda = CODA[fin]
                if nxt[0] == 'r':
                    if coda == 'n' and k + 2 == len(s) and nxt[1] == 'o':
                        nxt[0] = 'n'
                    elif coda in ('n', 'l'):
                        coda, nxt[0] = 'l', 'l'
                    elif coda:
                        nxt[0] = 'n'
                if nxt[0] in ('n', 'm') and coda in NASAL:
                    coda = NASAL[coda]
                if nxt[0] == 'l' and coda == 'n':
                    coda = 'l'
        else:
            coda = CODA[fin]
        out.append((ini, med, coda))
    return out


def cyr(word, lang):
    out, prev = [], None                       # prev: 앞 음절의 끝소리, 없으면 말머리
    for k, (ini, med, coda) in enumerate(sounds(word)):
        c = INI[ini]
        c = c[1] if len(c) > 1 and prev in VOICING else c[0]
        v = VOWEL[lang][med]
        v = v if isinstance(v, str) else v[0 if ini else 1]
        out.append(c + v + FINAL[coda])
        prev = coda
    return ''.join(out)


def dong(name, lang):
    """build_dong_roman.dong_en 과 같은 풀이, 글자만 키릴."""
    m = UNIT.match(name)
    if not m:
        raise ValueError(name)
    stem, num, unit, num2, unit2 = m.group('stem', 'num', 'unit', 'num2', 'unit2')
    if unit == '가' and not num and not num2:
        stem, unit = stem + '가', None
    tail = []
    if stem.endswith('동') and len(stem) > 1 and (num or unit):
        stem = stem[:-1]
        tail.append('-дон')
    head = cyr(stem, lang)
    s = head[0].upper() + head[1:] + ''.join(tail)
    if num:
        s += f' {num.replace("·", ",")}'
    if unit:
        s += '-' + {'가동': 'га-дон', '가': 'га', '동': 'дон'}[unit]
    if num2:
        s += f' {num2}-дон'
    return s


def gu(name, lang):
    head = cyr(name[:-1], lang)
    return head[0].upper() + head[1:] + '-гу'


def display(key, lang):
    name = key.split('/', 1)[1]
    return gu(name, lang) if key.startswith('seoul-gu/') else dong(name, lang)


UK = {'명동': 'Мьон-дон', '신촌동': 'Сінчхон-дон', '압구정동': 'Апкучжон-дон', '이태원1동': 'Ітхевон 1-дон',
      '신림동': 'Сільлім-дон', '왕십리2동': 'Вансімні 2-дон', '청량리동': 'Чхоннянні-дон',
      '잠실2동': 'Чамсіль 2-дон', '여의동': 'Йоий-дон', '홍은1동': 'Хонин 1-дон', '종로1,2,3,4가동': 'Чонно 1,2,3,4-га-дон',
      '신문로2가': 'Сінмунно 2-га', '필동1가': 'Пхіль-дон 1-га', '성수1가2동': 'Сонсу 1-га 2-дон',
      '가회동': 'Кахве-дон', '문래동': 'Мульле-дон'}
BG = {'명동': 'Мьон-дон', '신촌동': 'Синчхон-дон', '압구정동': 'Апкучжон-дон', '이태원1동': 'Итхевон 1-дон',
      '신림동': 'Сильлим-дон', '왕십리2동': 'Вансимни 2-дон', '청량리동': 'Чхоннянни-дон',
      '잠실2동': 'Чамсиль 2-дон', '여의동': 'Йоъй-дон', '홍은1동': 'Хонън 1-дон', '종로1,2,3,4가동': 'Чонно 1,2,3,4-га-дон',
      '신문로2가': 'Синмунно 2-га', '필동1가': 'Пхиль-дон 1-га', '성수1가2동': 'Сонсу 1-га 2-дон',
      '가회동': 'Кахве-дон', '문래동': 'Мульле-дон'}
for _n, _w in UK.items():
    assert dong(_n, 'uk') == _w, (_n, dong(_n, 'uk'), _w)
for _n, _w in BG.items():
    assert dong(_n, 'bg') == _w, (_n, dong(_n, 'bg'), _w)
assert gu('강남구', 'uk') == gu('강남구', 'bg') == 'Каннам-гу'
assert gu('종로구', 'uk') == 'Чонно-гу' and gu('서초구', 'bg') == 'Сочхо-гу' and gu('마포구', 'uk') == 'Мапхо-гу'
assert gu('중구', 'uk') == 'Чун-гу' and gu('용산구', 'bg') == 'Йонсан-гу'

if __name__ == '__main__':
    keys = [k for k in json.loads((DATA / 'kr-names.json').read_text())
            if k.startswith('seoul-gu/') or k.split('/')[0].endswith(('-dong', '-bdong'))]
    for lang in ('uk', 'bg'):
        names = {k: display(k, lang) for k in keys}
        (DATA / f'kr-names.{lang}.json').write_text(json.dumps(names, ensure_ascii=False, separators=(',', ':')))
        print(f'{lang}: {len(names)}곳')
