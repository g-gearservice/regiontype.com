"""서울 동 이름의 가타카나 — 화면 말이 일본어일 때 동 칸에 보이는 이름.

구는 정해진 한자(신자체)를 그대로 쓰고, 동은 일본 언론·위키백과식 가타카나로 옮기고
행정 단위만 한자로 남긴다(명동 ミョン洞, 성수1가2동 ソンス1街2洞).
소리 바뀜(받침 넘김·비음화·ㄹ 동화)은 build_dong_roman.roman 과 같은 모델을 따른다.
유성음화: ㄱㄷㅂㅈ 은 첫머리·장애음 받침 뒤에서 무성, 모음·ㄴㅁㅇ 뒤에서 유성.
ㄹ 받침 뒤는 무성으로 둔다(을지로 ウルチロ).

kr-names.json 의 서울 구·동 키만 골라 data/kr-names.ja.json 에 쓴다.

    python3 tools/build_kr_kana.py
"""
import json
from pathlib import Path

from build_dong_roman import DATA, CODA, LINK, NASAL, UNIT, syl

GU = {'종로구': '鍾路区', '중구': '中区', '용산구': '龍山区', '성동구': '城東区', '광진구': '広津区',
      '동대문구': '東大門区', '중랑구': '中浪区', '성북구': '城北区', '강북구': '江北区', '도봉구': '道峰区',
      '노원구': '蘆原区', '은평구': '恩平区', '서대문구': '西大門区', '마포구': '麻浦区', '양천구': '陽川区',
      '강서구': '江西区', '구로구': '九老区', '금천구': '衿川区', '영등포구': '永登浦区', '동작구': '銅雀区',
      '관악구': '冠岳区', '서초구': '瑞草区', '강남구': '江南区', '송파구': '松坡区', '강동구': '江東区'}
assert len(GU) == 25

# 행: a i u e o / ya yu yo / ye — 첫소리별 가나. 유성·무성이 갈리는 것은 둘 다 둔다
ROW = {
    'k': ['カ', 'キ', 'ク', 'ケ', 'コ', 'キャ', 'キュ', 'キョ', 'キェ'],
    'g': ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ', 'ギャ', 'ギュ', 'ギョ', 'ギェ'],
    't': ['タ', 'ティ', 'トゥ', 'テ', 'ト', 'ティャ', 'ティュ', 'ティョ', 'ティェ'],
    'd': ['ダ', 'ディ', 'ドゥ', 'デ', 'ド', 'ディャ', 'ディュ', 'ディョ', 'ディェ'],
    'p': ['パ', 'ピ', 'プ', 'ペ', 'ポ', 'ピャ', 'ピュ', 'ピョ', 'ピェ'],
    'b': ['バ', 'ビ', 'ブ', 'ベ', 'ボ', 'ビャ', 'ビュ', 'ビョ', 'ビェ'],
    'ch': ['チャ', 'チ', 'チュ', 'チェ', 'チョ', 'チャ', 'チュ', 'チョ', 'チェ'],
    'j': ['ジャ', 'ジ', 'ジュ', 'ジェ', 'ジョ', 'ジャ', 'ジュ', 'ジョ', 'ジェ'],
    'n': ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ニャ', 'ニュ', 'ニョ', 'ニェ'],
    'r': ['ラ', 'リ', 'ル', 'レ', 'ロ', 'リャ', 'リュ', 'リョ', 'リェ'],
    'm': ['マ', 'ミ', 'ム', 'メ', 'モ', 'ミャ', 'ミュ', 'ミョ', 'ミェ'],
    's': ['サ', 'シ', 'ス', 'セ', 'ソ', 'シャ', 'シュ', 'ショ', 'シェ'],
    'h': ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ', 'ヒャ', 'ヒュ', 'ヒョ', 'ヒェ'],
    '': ['ア', 'イ', 'ウ', 'エ', 'オ', 'ヤ', 'ユ', 'ヨ', 'イェ'],
}
KEY = ['a', 'i', 'u', 'e', 'o', 'ya', 'yu', 'yo', 'ye']
# 모음(로마자 MED) → 위 KEY 또는 w 모음(작은 가나로 붙인다)
VOW = {'a': 'a', 'ae': 'e', 'ya': 'ya', 'yae': 'ye', 'eo': 'o', 'e': 'e', 'yeo': 'yo', 'ye': 'ye', 'o': 'o',
       'yo': 'yo', 'u': 'u', 'yu': 'yu', 'eu': 'u', 'i': 'i'}
W = {'wa': 'ァ', 'wae': 'ェ', 'oe': 'ェ', 'wo': 'ォ', 'we': 'ェ', 'wi': 'ィ'}
# 소리 겹침 바탕: 된소리·거센소리 → 무성 행. 'l' 은 ㄹ 동화 뒤 첫소리
BASE = {'kk': 'k', 'tt': 't', 'pp': 'p', 'ss': 's', 'jj': 'ch', 'l': 'r'}
VOICE = {'g': ('k', 'g'), 'd': ('t', 'd'), 'b': ('p', 'b'), 'j': ('ch', 'j')}
TENSE = {'kk', 'tt', 'pp', 'ss', 'jj'}
END = {'n': 'ン', 'ng': 'ン', 'm': 'ム', 'l': 'ル', 'k': 'ク', 'p': 'プ', 't': 'ッ'}


def mora(ini, med, first, voiced):
    """첫소리+모음 한 음절의 가나(받침 제외)."""
    row = ini
    if ini in VOICE:
        row = VOICE[ini][voiced]
    row = BASE.get(row, row)
    if ini == '' and med == 'ui':
        return 'ウイ' if first else 'イ'
    # ㅈ·ㅊ 뒤 w 는 일본어에서 소리 나지 않는다 — 북가좌 プクカジャ, 좌 チャ (ジァ 로 쓰지 않는다)
    if med in W and med != 'wi' and row in ('ch', 'j'):
        med = {'wa': 'a', 'wo': 'o'}.get(med, 'e')
    if med in W:
        if ini == '':
            return {'ァ': 'ワ', 'ィ': 'ウィ', 'ェ': 'ウェ', 'ォ': 'ウォ'}[W[med]]
        return ROW[row][2][0] + W[med]
    if med == 'ui':
        med = 'i'
    k = ROW[row][KEY.index(VOW[med])]
    return ('ッ' if ini in TENSE and not first else '') + k


def kana(word):
    """한 덩어리 한글을 소리대로 가타카나로 — build_dong_roman.roman 과 같은 소리 바뀜."""
    s = [list(syl(c)) for c in word]
    out, prev = [], None          # prev: 앞 음절의 받침(로마자), None 이면 첫머리
    for k, (ini, med, fin) in enumerate(s):
        last = k + 1 == len(s)
        if not last:
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
        voiced = int(prev in ('', 'n', 'm', 'ng'))
        out.append(mora(ini, med, k == 0, voiced))
        if coda == 't' and last:
            out.append('ト')
        elif coda:
            out.append(END[coda])
        prev = coda
    return ''.join(out)


def dong_kana(name):
    m = UNIT.match(name)
    if not m:
        raise ValueError(name)
    stem, num, unit, num2, unit2 = m.group('stem', 'num', 'unit', 'num2', 'unit2')
    if unit == '가' and not num and not num2:      # 가회동처럼 '가' 가 이름의 일부
        stem, unit = stem + '가', None
    tail = ''
    if stem.endswith('동') and len(stem) > 1 and (num or unit):
        stem, tail = stem[:-1], '洞'
    s = kana(stem) + tail
    if num:
        s += num.replace('·', ',')
    if unit:
        s += {'가동': '街洞', '가': '街', '동': '洞'}[unit]
    if num2:
        s += num2 + '洞'
    return s


assert kana('강남') == 'カンナム'
assert dong_kana('북가좌1동') == 'プクカジャ1洞' and kana('좌') == 'チャ'
for _n, _k in [('명동', 'ミョン洞'), ('신촌동', 'シンチョン洞'), ('홍은1동', 'ホンウン1洞'),
               ('압구정동', 'アプクジョン洞'), ('이태원1동', 'イテウォン1洞'), ('신림동', 'シルリム洞'),
               ('왕십리2동', 'ワンシムニ2洞'), ('청량리동', 'チョンニャンニ洞'), ('잠실2동', 'チャムシル2洞'),
               ('여의동', 'ヨイ洞'), ('을지로동', 'ウルチロ洞'), ('성수1가2동', 'ソンス1街2洞'),
               ('필동1가', 'ピル洞1街'), ('종로1,2,3,4가동', 'チョンノ1,2,3,4街洞'),
               ('문래동', 'ムルレ洞'), ('공릉1동', 'コンヌン1洞'), ('연희동', 'ヨンヒ洞'),
               ('원효로4가', 'ウォンヒョロ4街'), ('신문로2가', 'シンムンノ2街'), ('독산1동', 'トクサン1洞'),
               ('삼성동', 'サムソン洞'), ('논현동', 'ノンヒョン洞'), ('대치동', 'テチ洞'),
               ('서초동', 'ソチョ洞'), ('목동', 'モク洞')]:
    assert dong_kana(_n) == _k, (_n, dong_kana(_n), _k)

if __name__ == '__main__':
    names = json.loads((DATA / 'kr-names.json').read_text())
    out = {}
    for key in names:
        pre, name = key.split('/', 1)
        if pre == 'seoul-gu':
            out[key] = GU[name]
        elif pre.endswith(('-dong', '-bdong')):
            out[key] = dong_kana(name)
    (DATA / 'kr-names.ja.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print(f'{len(out)}개')
