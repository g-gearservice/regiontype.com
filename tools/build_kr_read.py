"""화면 말로 칠 때의 읽기 — 칸에 보이는 이름을 [보이는 글자, 읽기] 마디로 나눈다.

한자·가나처럼 보이는 글자와 치는 글자가 다른 말만 찍는다. 판정 엔진(app.js 의 화면 말 치기)은
치는 것(IME 조합 중인 가나, 직접 친 로마자, 확정된 한자)을 모두 이 읽기로 접어 견주고,
마디 단위로 보이는 글자를 채운다.

  ja — 구는 한자 이름의 한국 소리(江西|カンソ + 区|ク), 동은 가타카나 그대로에
       행정 단위 한자만 읽기를 단다(洞 ドン, 街 ガ). 소리는 build_kr_kana.kana 와 같다.
  zh — 글자마다 성조 없는 병음(江|jiang 西|xi 区|qu). 표는 PINYIN 에 둔다.

kr-names.<말>.json 과 같은 키로 data/kr-read.<말>.json 을 쓴다. build_kr_kana.py ·
build_kr_hanja.py 다음에 돌린다.

    python3 tools/build_kr_read.py
"""
import json
from pathlib import Path

from build_kr_kana import GU, kana, dong_kana, UNIT

DATA = Path(__file__).resolve().parent.parent / 'data'

# 행정 단위 한자의 일본어 읽기 — 한국 지명에서 일본 언론이 붙이는 소리
JA_UNIT = {'洞': 'ドン', '街': 'ガ', '区': 'ク'}


def ja_segs(pre, name, shown):
    """보이는 이름 shown 을 [글자, 가타카나 읽기] 마디로. 가나·숫자·쉼표는 제 글자가 읽기다."""
    if pre == 'seoul-gu':
        stem = name[:-1]
        assert shown == GU[name] and shown.endswith('区'), (name, shown)
        return [[shown[:-1], kana(stem)], ['区', 'ク']]
    segs = []
    for ch in shown:
        read = JA_UNIT.get(ch, ch)
        if ch in JA_UNIT or not segs or segs[-1][0] in JA_UNIT or ch.isdigit() != segs[-1][0][-1].isdigit():
            segs.append([ch, read])
        else:
            segs[-1][0] += ch
            segs[-1][1] += read
    assert ''.join(s for s, _ in segs) == shown
    assert all(not ('一' <= c <= '鿿') or s in JA_UNIT for s, _ in segs for c in s), (name, segs)
    return segs


def zh_segs(shown, pinyin):
    """글자마다 [한자, 병음]. 숫자·쉼표는 붙여 둔다."""
    segs = []
    for ch in shown:
        if '一' <= ch <= '鿿':
            segs.append([ch, pinyin[ch]])
        elif segs and not ('一' <= segs[-1][0][-1] <= '鿿'):
            segs[-1][0] += ch
            segs[-1][1] += ch
        else:
            segs.append([ch, ch])
    return segs


assert ja_segs('seoul-gu', '강서구', '江西区') == [['江西', 'カンソ'], ['区', 'ク']]
assert ja_segs('x-dong', '성수1가2동', dong_kana('성수1가2동')) == [['ソンス', 'ソンス'], ['1', '1'], ['街', 'ガ'], ['2', '2'], ['洞', 'ドン']]
assert ja_segs('x-dong', '무악동', 'ムアク洞') == [['ムアク', 'ムアク'], ['洞', 'ドン']]
assert zh_segs('加阳1洞', {'加': 'jia', '阳': 'yang', '洞': 'dong'}) == [['加', 'jia'], ['阳', 'yang'], ['1', '1'], ['洞', 'dong']]

if __name__ == '__main__':
    ja = json.loads((DATA / 'kr-names.ja.json').read_text())
    out = {k: ja_segs(*k.split('/', 1), v) for k, v in ja.items()}
    (DATA / 'kr-read.ja.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print(f'ja {len(out)}개')
    pin = DATA.parent / 'tools' / 'zh-pinyin.json'
    if pin.exists():
        table = json.loads(pin.read_text())
        zh = json.loads((DATA / 'kr-names.zh.json').read_text())
        out = {k: zh_segs(v, table) for k, v in zh.items()}
        (DATA / 'kr-read.zh.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
        print(f'zh {len(out)}개')
