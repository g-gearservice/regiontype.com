"""로마자 읽기 → 한글 표기. 국립국어원 외래어 표기법(일본어·중국어 표기)을 따른다.

build_capital.py 의 place_names 가 OSM·Wikidata 에 한국어 이름이 없는 곳에 쓴다.
읽기를 끝까지 못 풀면 None — 어설픈 표기를 지어내지 않는다.

    python3 tools/hangul.py      # 자체검사
"""
import re
import unicodedata

L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
T = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'


def syl(c, v, t=' '):
    return chr(0xAC00 + (L.index(c) * 21 + V.index(v)) * 28 + T.index(t))


def plain(s):
    """악센트·장음 부호를 뗀 소문자 로마자."""
    return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()


# ── 일본어 ─────────────────────────────────────────────
# 헵번식 로마자 마디 → (첫소리 어두, 첫소리 어중, 모음). 장음은 적지 않는다(도쿄).
JA_C = {'k': 'ㄱㅋ', 'g': 'ㄱㄱ', 's': 'ㅅㅅ', 'sh': 'ㅅㅅ', 'z': 'ㅈㅈ', 'j': 'ㅈㅈ', 't': 'ㄷㅌ', 'd': 'ㄷㄷ',
        'ch': 'ㅈㅊ', 'ts': 'ㅆㅆ', 'n': 'ㄴㄴ', 'h': 'ㅎㅎ', 'f': 'ㅎㅎ', 'b': 'ㅂㅂ', 'p': 'ㅍㅍ',
        'm': 'ㅁㅁ', 'r': 'ㄹㄹ', 'w': 'ㅇㅇ', 'y': 'ㅇㅇ', '': 'ㅇㅇ'}
JA_V = {'a': 'ㅏ', 'i': 'ㅣ', 'u': 'ㅜ', 'e': 'ㅔ', 'o': 'ㅗ'}
JA_Y = {'a': 'ㅑ', 'u': 'ㅠ', 'o': 'ㅛ', 'e': 'ㅖ'}
JA_W = {'a': 'ㅘ', 'o': 'ㅗ'}


def ja_hangul(roma):
    """'Nishi-Ochiai' → '니시오치아이'. 하이픈·띄어쓰기는 한 낱말로 붙인다."""
    s = re.sub(r"[\s\-'’]", '', plain(roma)).replace('ou', 'o').replace('oo', 'o').replace('uu', 'u')
    s = re.sub(r'm(?=[bpm])', 'n', s)   # 헵번 m(Shimbashi) 은 ん
    out, i = [], 0
    while i < len(s):
        m = re.match(r"(ch|sh|ts|[kgszjtdnhfbpmrwy]?)(y?)([aiueo])", s[i:])
        if m:
            c, y, v = m.groups()
            jamo = JA_C[c][1 if out else 0]
            if y or c in ('y', 'sh', 'ch', 'j'):
                vow = JA_Y.get(v, JA_V[v]) if v != 'i' else 'ㅣ'
                if c in ('ch', 'j'):   # 표기법: ㅈ·ㅊ 뒤 이중모음은 단모음(자·주·조)
                    vow = {'ㅑ': 'ㅏ', 'ㅠ': 'ㅜ', 'ㅛ': 'ㅗ', 'ㅖ': 'ㅔ'}.get(vow, vow)
            elif c == 'w':
                vow = JA_W.get(v, JA_V[v])
            elif v == 'u' and c in ('s', 'z', 'ts'):
                vow = 'ㅡ'
            else:
                vow = JA_V[v]
            out.append(syl(jamo, vow))
            i += m.end()
            continue
        ch = s[i]
        nxt = s[i + 1:i + 3]
        if ch == 'n':   # 발음 ん → 받침 ㄴ
            if not out:
                return None
            out[-1] = add_final(out[-1], 'ㄴ')
        elif ch in 'kstpcg' and out and (nxt.startswith(ch) or (ch == 't' and nxt.startswith('ch'))):
            out[-1] = add_final(out[-1], 'ㅅ')   # 촉음 っ → 받침 ㅅ(삿포로)
        else:
            return None
        i += 1
    return ''.join(out) or None


def add_final(s, t):
    code = ord(s) - 0xAC00
    if code % 28:
        return s
    return chr(ord(s) + T.index(t))


# 가나 → 헵번 로마자. 읽기 태그(name:ja-Hira·name:ja_kana)가 있을 때 쓴다
KANA = dict(zip(
    'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'
    'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ',
    'a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ha hi fu he ho '
    'ma mi mu me mo ya yu yo ra ri ru re ro wa o n '
    'ga gi gu ge go za ji zu ze zo da ji zu de do ba bi bu be bo pa pi pu pe po'.split()))


def kana_roma(kana):
    s = ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in kana)
    out, i = '', 0
    while i < len(s):
        c = s[i]
        if c == 'っ':
            nxt = KANA.get(s[i + 1:i + 2], '')
            out += 'c' if nxt.startswith('ch') else nxt[:1]
        elif c in 'ゃゅょ' and out.endswith('i'):
            v = {'ゃ': 'a', 'ゅ': 'u', 'ょ': 'o'}[c]
            out = out[:-1] + (v if re.search(r'(sh|ch|j)$', out[:-1]) else 'y' + v)
        elif c == 'ー':
            pass
        elif c in KANA:
            out += KANA[c]
        elif c in ' ・-':
            out += ' '
        else:
            return None
        i += 1
    return out


# ── 중국어 ─────────────────────────────────────────────
# 병음 첫소리 → 자모. 표기법 표 그대로(z ㅉ, c ㅊ, s ㅆ, x ㅅ, q ㅊ)
ZH_I = {'b': 'ㅂ', 'p': 'ㅍ', 'm': 'ㅁ', 'f': 'ㅍ', 'd': 'ㄷ', 't': 'ㅌ', 'n': 'ㄴ', 'l': 'ㄹ', 'g': 'ㄱ',
        'k': 'ㅋ', 'h': 'ㅎ', 'j': 'ㅈ', 'q': 'ㅊ', 'x': 'ㅅ', 'zh': 'ㅈ', 'ch': 'ㅊ', 'sh': 'ㅅ', 'r': 'ㄹ',
        'z': 'ㅉ', 'c': 'ㅊ', 's': 'ㅆ', '': 'ㅇ', 'y': 'ㅇ', 'w': 'ㅇ'}
# 끝소리 → 한글(첫 글자의 첫소리 ㅇ 을 병음 첫소리로 바꾼다)
ZH_F = {'a': '아', 'o': '오', 'e': '어', 'ai': '아이', 'ei': '에이', 'ao': '아오', 'ou': '어우', 'an': '안',
        'en': '언', 'ang': '앙', 'eng': '엉', 'er': '얼', 'ong': '웅', 'i': '이', 'ia': '야', 'ie': '예',
        'iao': '야오', 'iu': '유', 'ian': '옌', 'in': '인', 'iang': '양', 'ing': '잉', 'iong': '융',
        'u': '우', 'ua': '와', 'uo': '워', 'uai': '와이', 'ui': '우이', 'uan': '완', 'un': '운',
        'uang': '왕', 'ueng': '웡', 'v': '위', 've': '웨', 'van': '위안', 'vn': '윈', 'ue': '웨'}
# y·w 로 시작하는 마디는 통째로
ZH_YW = {'ya': '야', 'yo': '요', 'ye': '예', 'yao': '야오', 'you': '유', 'yan': '옌', 'yin': '인',
         'yang': '양', 'ying': '잉', 'yong': '융', 'yi': '이', 'yu': '위', 'yue': '웨', 'yuan': '위안',
         'yun': '윈', 'wa': '와', 'wo': '워', 'wai': '와이', 'wei': '웨이', 'wan': '완', 'wen': '원',
         'wang': '왕', 'weng': '웡', 'wu': '우'}


def zh_one(ini, fin):
    if ini in 'jqx' and ini and fin.startswith('u'):   # j·q·x 뒤 u 는 ü
        fin = 'v' + fin[1:]
    h = ZH_F.get(fin)
    if h is None:
        return None
    if fin == 'i' and ini in ('zh', 'ch', 'sh', 'r', 'z', 'c', 's'):
        h = '으'
    if fin == 'o' and ini not in ('b', 'p', 'm', 'f', ''):
        return None
    first = ord(h[0]) - 0xAC00
    v, t = (first // 28) % 21, first % 28
    vow = V[v]
    if ZH_I[ini] in 'ㅈㅉㅊ':   # 표기법: ㅈ·ㅉ·ㅊ 뒤 ㅑㅖㅛㅠ 는 ㅏㅔㅗㅜ(자·제·자오·주)
        vow = {'ㅑ': 'ㅏ', 'ㅖ': 'ㅔ', 'ㅛ': 'ㅗ', 'ㅠ': 'ㅜ'}.get(vow, vow)
    return chr(0xAC00 + (L.index(ZH_I[ini]) * 21 + V.index(vow)) * 28 + t) + h[1:]


def _zh_table():
    """쓰인 병음 마디 → 한글. 첫소리 없는 마디는 a·o·e 로만 시작한다(i·u·ü 는 y·w 로 쓴다)."""
    t = dict(ZH_YW)
    for ini in ZH_I:
        if ini in ('y', 'w'):
            continue
        for fin in ZH_F:
            if (fin[0] == 'v' and ini not in ('l', 'n')) or (ini == '' and fin[0] not in 'aoe'):
                continue   # ü 는 l·n 뒤에서만 v 로 쓴다(lü·nü) — j·q·x 뒤는 u
            h = zh_one(ini, fin)
            if h:
                t.setdefault(ini + fin, h)
    return t


ZH_TAB = _zh_table()


def zh_hangul(pinyin):
    """'Youanmen' → '유안먼'. 낱말 사이(띄어쓰기·하이픈·')는 마디 경계다. 낱말 안은 마디 수가 가장
    적게 가른다 — 병음이 xi'an 처럼 어포스트로피를 찍는 까닭과 같다(xian 은 한 마디). 다 못 풀면 None."""
    out = []
    for word in re.split(r"[\s\-'’]+", plain(pinyin)):
        best = [None] * (len(word) + 1)
        best[0] = []
        for i in range(len(word)):
            if best[i] is None:
                continue
            for j in range(i + 1, min(len(word), i + 6) + 1):
                h = ZH_TAB.get(word[i:j])
                if h and (best[j] is None or len(best[j]) > len(best[i]) + 1):
                    best[j] = best[i] + [h]
        if best[-1] is None:
            return None
        out += best[-1]
    return ''.join(out) or None


# ── 그 밖의 말 ──────────────────────────────────────────
# 말마다 글자 → 소리(음소) 규칙을 앞에서부터 가장 먼저 맞는 것으로 읽고, 소리를 한 틀(compose)로
# 한글에 앉힌다. 음소: 모음 a e i o u eo(ㅓ) eu(ㅡ) ae(ㅐ) oe(ㅚ) ue(ㅟ), 반모음 y w,
# 자음 p b t d k g f v s z sh zh ch j ts dz h x(ㅎ) xi(히) m n ng l r ny kk tt pp ss jj.
VOW = {'a': 'ㅏ', 'e': 'ㅔ', 'i': 'ㅣ', 'o': 'ㅗ', 'u': 'ㅜ', 'eo': 'ㅓ', 'eu': 'ㅡ', 'ae': 'ㅐ', 'oe': 'ㅚ', 'ue': 'ㅟ'}
Y_V = {'ㅏ': 'ㅑ', 'ㅔ': 'ㅖ', 'ㅗ': 'ㅛ', 'ㅜ': 'ㅠ', 'ㅓ': 'ㅕ', 'ㅐ': 'ㅒ'}
W_V = {'ㅏ': 'ㅘ', 'ㅔ': 'ㅞ', 'ㅣ': 'ㅟ', 'ㅗ': 'ㅝ', 'ㅓ': 'ㅝ', 'ㅐ': 'ㅙ', 'ㅜ': 'ㅜ', 'ㅡ': 'ㅜ'}
ONSET = {'p': 'ㅍ', 'b': 'ㅂ', 't': 'ㅌ', 'd': 'ㄷ', 'k': 'ㅋ', 'g': 'ㄱ', 'f': 'ㅍ', 'v': 'ㅂ', 's': 'ㅅ', 'z': 'ㅈ',
         'sh': 'ㅅ', 'zh': 'ㅈ', 'ch': 'ㅊ', 'j': 'ㅈ', 'ts': 'ㅊ', 'dz': 'ㅈ', 'h': 'ㅎ', 'x': 'ㅎ', 'xi': 'ㅎ',
         'm': 'ㅁ', 'n': 'ㄴ', 'l': 'ㄹ', 'r': 'ㄹ', 'ny': 'ㄴ', 'kk': 'ㄲ', 'tt': 'ㄸ', 'pp': 'ㅃ', 'ss': 'ㅆ', 'jj': 'ㅉ'}
# 모음 없이 남은 자음은 '으' 를 붙여 따로 선다 — sh·zh·ch·j·xi 는 '이'
CODA_SYL = {'sh': '시', 'zh': '지', 'ch': '치', 'j': '지', 'xi': '히', 'ny': '니'}
NUCLEI = set(VOW) | {'y', 'w'}


def compose(tokens, stops_final=False, mid_stops=False):
    """음소 → 한글. stops_final 이면 모음 뒤 p·t·k 를 받침(ㅂ·ㅅ·ㄱ)으로(영어·동남아 말),
    mid_stops 면 자음 앞 k·p 만 받침으로(로망스 말)."""
    out = []   # [첫, 가운데, 끝] 자모

    def open_last():
        return out and out[-1][2] == ' '

    i = 0
    while i < len(tokens):
        c = tokens[i]
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        nn = tokens[i + 2] if i + 2 < len(tokens) else None
        if c in VOW or c in ('y', 'w'):   # 첫소리 없는 마디
            onset, glide, v = 'ㅇ', None, c
            if c in ('y', 'w'):
                if nxt not in VOW:
                    out.append(['ㅇ', 'ㅣ' if c == 'y' else 'ㅜ', ' '])
                    i += 1
                    continue
                glide, v = c, nxt
                i += 1
            vow = VOW[v]
            vow = Y_V.get(vow, vow) if glide == 'y' else W_V.get(vow, vow) if glide == 'w' else vow
            out.append([onset, vow, ' '])
            i += 1
            continue
        if c == 'ng' and nxt in NUCLEI:   # 응우옌 — ng 첫소리는 앞 마디 받침이나 '응'
            if open_last():
                out[-1][2] = 'ㅇ'
            else:
                out.append(['ㅇ', 'ㅡ', 'ㅇ'])
            i += 1
            continue
        if nxt in NUCLEI and (nxt in VOW or nn in VOW):
            glide = None
            if nxt in ('y', 'w'):
                glide, v, step = nxt, nn, 3
            else:
                v, step = nxt, 2
            vow = VOW[v]
            if c in ('sh', 'zh') and vow == 'ㅡ':
                vow = 'ㅣ'   # 수바시
            if c in ('sh', 'zh', 'ny') and vow != 'ㅣ':
                glide = glide or 'y'
            if glide == 'y':
                vow = Y_V.get(vow, vow)
                if c in ('ch', 'j', 'ts', 'dz', 'jj', 'zh'):   # ㅈ·ㅊ 뒤 이중모음은 단모음
                    vow = {'ㅑ': 'ㅏ', 'ㅖ': 'ㅔ', 'ㅛ': 'ㅗ', 'ㅠ': 'ㅜ', 'ㅕ': 'ㅓ', 'ㅒ': 'ㅐ'}.get(vow, vow)
            elif glide == 'w':
                vow = W_V.get(vow, vow)
            if c == 'l' and i > 0 and open_last():   # 모음 사이·자음 뒤 l 은 ㄹㄹ(밀라노·플로)
                out[-1][2] = 'ㄹ'
            out.append([ONSET[c], vow, ' '])
            i += step
            continue
        # 모음이 따르지 않는 자음
        if c in ('m', 'n', 'ng', 'l') and open_last():
            out[-1][2] = {'m': 'ㅁ', 'n': 'ㄴ', 'ng': 'ㅇ', 'l': 'ㄹ'}[c]
        elif c in ('p', 't', 'k', 'kk', 'tt', 'pp') and stops_final and open_last() and nxt not in ('s',):
            out[-1][2] = {'p': 'ㅂ', 'pp': 'ㅂ', 't': 'ㅅ', 'tt': 'ㅅ', 'k': 'ㄱ', 'kk': 'ㄱ'}[c]
        elif c == 'ng':
            out.append(['ㅇ', 'ㅡ', 'ㅇ'])   # 앞 마디가 닫혔거나 없으면 '응'
        elif c == 'h' or (c == 'r' and stops_final):
            pass   # 모음 뒤 h, 영어의 모음 뒤 r 은 소리가 없다
        elif c in ('k', 'p') and mid_stops and open_last() and nxt and nxt not in NUCLEI:
            out[-1][2] = 'ㄱ' if c == 'k' else 'ㅂ'   # 자음 앞 c·k·p 는 받침(섹토르·셉티엠브레)
        elif c == 'sh' and nxt and nxt not in NUCLEI:
            out.append(['ㅅ', 'ㅠ', ' '])   # 자음 앞 ʃ 는 '슈'(슈판다우), 끝은 '시'
        elif c in CODA_SYL:
            out.append([ONSET[c], 'ㅣ', ' '])
        elif c in ONSET:
            out.append([ONSET[c], 'ㅡ', ' '])
        else:
            return None
        i += 1
    return ''.join(chr(0xAC00 + (L.index(a) * 21 + V.index(b)) * 28 + T.index(t)) for a, b, t in out)


def rules(*pairs):
    return [(re.compile(p), t.split()) for p, t in pairs]


_V = 'aeiouyäöüåæøéèêëáàâíìîóòôúùûõãąęőűœ'
BASE = rules(  # 어느 말이든 마지막에 남는 글자
    ('a', 'a'), ('e', 'e'), ('i', 'i'), ('o', 'o'), ('u', 'u'), ('b', 'b'), ('c', 'k'), ('d', 'd'), ('f', 'f'),
    ('g', 'g'), ('h', 'h'), ('j', 'j'), ('k', 'k'), ('l', 'l'), ('m', 'm'), ('n', 'n'), ('p', 'p'), ('q', 'k'),
    ('r', 'r'), ('s', 's'), ('t', 't'), ('v', 'v'), ('w', 'w'), ('x', 'k s'), ('z', 'z'),
    (f'y(?=[{_V}])', 'y'), ('y', 'i'), ('[áàâãåā]', 'a'), ('[éèêëē]', 'e'), ('[íìîïī]', 'i'), ('[óòôōő]', 'o'),
    ('[úùûū]', 'u'), ('[äæ]', 'e'), ('[öøœ]', 'oe'), ('[üű]', 'ue'), ('ý', 'i'), ('ñ', 'ny'), ('ç', 's'),
    ('[şș]', 'sh'), ('[ţț]', 'ts'), ('ł', 'w'), ('ß', 's'), ('[čć]', 'ch'), ('[šś]', 'sh'), ('[žźż]', 'zh'),
    ('đ', 'd'), ('ğ', ''), ('ı', 'eu'), ("['’`ʿʾ.]", ''))
G2P = {
    'es': rules(('ch', 'ch'), ('ll', 'y'), ('ñ', 'ny'), ('qu(?=[eéií])', 'k'), ('gu(?=[eéií])', 'g'), ('gü', 'g w'),
                ('c(?=[eéií])', 's'), ('g(?=[eéií])', 'h'), ('j', 'h'), ('z', 's'), ('h', ''), ('v', 'b'),
                ('rr', 'r'), ('(?<![a-z])x', 's'), ('x', 'h')),
    'pt': rules(('nh', 'ny'), ('lh', 'y'), ('ch', 'sh'), ('ç', 's'), ('ão', 'a ng'), ('õe', 'o ng i'),
                ('qu(?=[eéií])', 'k'), ('gu(?=[eéií])', 'g'), ('c(?=[eéií])', 's'), ('g(?=[eéií])', 'zh'),
                ('j', 'zh'), ('x', 'sh'), (f'(?<=[{_V}])s(?=[{_V}])', 'z'), ('h', ''), ('rr', 'r'),
                ('o(?![a-z])', 'u'), ('e(?![a-z])', 'i'), (f'm(?![{_V}])', 'ng')),
    'it': rules(('gli', 'y i'), ('gn', 'ny'), ('sc(?=[eéi])', 'sh'), ('ch', 'k'), ('gh', 'g'), ('ci(?=[aou])', 'ch'),
                ('c(?=[eéi])', 'ch'), ('gi(?=[aou])', 'j'), ('g(?=[eéi])', 'j'), ('zz', 'ts'), ('z', 'ts'),
                ('qu', 'k w'), ('h', '')),
    'fr': rules(('eaux?(?![a-z])', 'o'), ('eau', 'o'), ('aux?(?![a-z])', 'o'), ('au', 'o'), ('oi', 'w a'),
                ('ou', 'u'), ('ais?(?![a-z])', 'e'), ('aill', 'a y'), ('eill', 'e y'), ('ouill', 'u y'), ('ain(?![a-z])', 'ae ng'), ('ain(?![aeiou])', 'ae ng'), ('ein(?![aeiou])', 'ae ng'),
                ('ien(?![aeiou])', 'y ae ng'), ('ont(?![aeiouy])', 'o ng'), ('[ae]nt(?![aeiouy])', 'a ng'), ('[ai]n(?![aeiouny])', 'a ng'), ('[ae]m(?![aeioumn])', 'a ng'),
                ('en(?![aeioun])', 'a ng'), ('on(?![aeioun])', 'o ng'), ('om(?![aeioumn])', 'o ng'),
                ('in(?![aeioun])', 'ae ng'), ('un(?![aeioun])', 'ae ng'), ('ai|ei', 'e'), ('eu|œu', 'oe'),
                ('(?<=[vm])ille', 'i l'), ('ille', 'i y u'), ('elle', 'e l'), ('ch', 'sh'), ('gn', 'ny'), ('qu', 'k'), ('ph', 'f'), ('th', 't'), ('ç', 's'),
                ('c(?=[eéèêiy])', 's'), ('g(?=[eéèêiy])', 'zh'), ('j', 'zh'), ('h', ''), ('ll', 'l'),
                (f'(?<=[{_V}])s(?=[{_V}])', 'z'), ('es?(?![a-z])', ''), ('[stdxz](?![a-z])', ''), ('[éèêë]', 'e'),
                ('u', 'ue'), (f'e(?![{_V}]|[a-z][a-z])', 'eu'), ('y', 'i')),
    'de': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('(?<![a-zß])sch', 'sh'), ('tsch', 'ch'), ('sch', 'sh'), ('(?<![a-zß])s(?=[pt])', 'sh'),
                ('(?<![a-zß])ch', 'k'), ('(?<=[eiäöüy])ch', 'xi'), ('(?<=[lnr])ch', 'xi'), ('chs', 'k s'), ('ch', 'x'),
                ('ig(?![a-zßäöü])', 'i xi'), ('ck', 'k'), ('ß', 's'), ('tz|z', 'ts'), ('ph', 'f'), ('th', 't'),
                ('qu', 'k v'), ('v', 'f'), ('w', 'v'), ('j', 'y'), ('ei|ai', 'a i'), ('eu|äu', 'o i'), ('ie', 'i'),
                ('ä', 'e'), ('ö', 'oe'), ('ü', 'ue'), ('y', 'ue'), (f'(?<=[{_V}])h', ''), ('er(?![a-zßäöü])', 'eo'),
                ('b(?![a-zßäöü])', 'p'), ('d(?![a-zßäöü])', 't'), ('g(?![a-zßäöü])', 'k'), (f's(?=[{_V}])', 'z'),
                ('aa|ah', 'a'), ('ee|eh', 'e'), ('oo|oh', 'o'), ('uh', 'u'), ('ih', 'i')),
    'nl': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('ij|ei', 'e i'), ('oe', 'u'), ('ou|au', 'a u'), ('ui', 'oe i'), ('ie', 'i'), ('eu', 'oe'),
                ('sch', 's x'), ('ch', 'x'), ('g', 'x'), ('j', 'y'), ('w', 'v'), ('v', 'f'), ('uu|u', 'ue'),
                ('aa', 'a'), ('ee', 'e'), ('oo', 'o'), ('c(?=[eiy])', 's')),
    'sv': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('sj|skj|stj', 'sh'), ('sk(?=[eiyäö])', 'sh'), ('tj|kj', 'ch'), ('k(?=[eiyäö])', 'ch'),
                ('g(?=[eiyäö])', 'y'), ('j', 'y'), ('å', 'o'), ('ä', 'e'), ('ö', 'oe'), ('y', 'ue'), ('w', 'v'),
                ('ck', 'k')),
    'nb': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('sj|skj', 'sh'), ('kj', 'ch'), ('j', 'y'), ('ø', 'oe'), ('æ', 'e'), ('å', 'o'), ('y', 'ue')),
    'fi': rules(('y', 'ue'), ('ä', 'ae'), ('ö', 'oe'), ('j', 'y'), ('aa', 'a'), ('ee', 'e'), ('ii', 'i'),
                ('oo', 'o'), ('uu', 'u'), ('ää', 'ae')),
    'pl': rules(('szcz', 'sh ch'), ('sz', 'sh'), ('cz', 'ch'), ('rz|ż', 'zh'), ('ch', 'h'),
                ('dzi(?=[aeiouyąęó])', 'j'), ('dź|dż', 'j'), ('si(?=[aeiouyąęó])', 'sh'), ('ś', 'sh'),
                ('ci(?=[aeiouyąęó])', 'ch'), ('ć', 'ch'), ('zi(?=[aeiouyąęó])', 'zh'), ('ź', 'zh'),
                ('ni(?=[aeiouyąęó])', 'ny'), ('ń', 'ny'), ('dz', 'dz'), ('ł', 'w'), ('w(?![a-ząęóśćźżńł])', 'f'), ('(rz|ż)(?![a-ząęóśćźżńł])', 'sh'),
                ('w', 'v'), ('c', 'ts'), ('j', 'y'), ('y', 'i'), ('ą', 'o ng'), ('ę', 'e ng'), ('ó', 'u')),
    'cs': rules(('ch', 'x'), ('č', 'ch'), ('š', 'sh'), ('ž', 'zh'), ('ř', 'r zh'), ('c', 'ts'), ('j', 'y'),
                ('ě', 'y e'), ('ň', 'ny'), ('ť', 't y'), ('ď', 'd y'), ('[yý]', 'i'), ('[ůú]', 'u'), ('w', 'v'), ('ž(?=[kptsc])', 'sh'),
                ('v(?![a-záčďéěíňóřšťúůýž])', 'f')),
    'hu': rules(('dzs', 'j'), ('sz', 's'), ('cs', 'ch'), ('zs', 'zh'), ('gy', 'j'), ('ny', 'ny'), ('ty', 'ch'),
                ('ly', 'y'), ('s', 'sh'), ('c', 'ts'), ('j', 'y'), ('[öő]', 'oe'), ('[üű]', 'ue'), ('y', 'i')),
    'ro': rules(('[șş]', 'sh'), ('[țţ]', 'ts'), ('ă', 'eo'), ('[âî]', 'eu'), ('ch(?=[ei])', 'k'), ('gh(?=[ei])', 'g'),
                ('c(?=[ei])', 'ch'), ('g(?=[ei])', 'j'), ('j', 'zh')),
    'tr': rules(('c', 'j'), ('ç', 'ch'), ('ş', 'sh'), ('ğ', ''), ('ı', 'eu'), ('ö', 'oe'), ('ü', 'ue'), ('j', 'zh'),
                ('â', 'a'), ('î', 'i'), ('y', 'y')),
    'id': rules(('ng', 'ng'), ('ny', 'ny'), ('sy', 'sh'), ('kh', 'x'), ('c', 'ch'), ('oe', 'u'), ('dj', 'j'),
                ('tj', 'ch'), ('y', 'y')),
    'vi': rules(('(?<![a-z])ngh?', 'ng'), ('ngh', 'ng'), ('ng', 'ng'), ('nh(?![a-zđăâêôơư])', 'n'), ('nh', 'ny'),
                ('(?<![a-z])gi', 'j'), ('tr|ch(?=[a-zđăâêôơư])', 'jj'), ('ch', 'k'), ('ph', 'p'), ('th', 't'),
                ('kh', 'k'), ('gh', 'g'), ('qu', 'kk w'), ('[ck]', 'kk'), ('t(?=[a-zđăâêôơư])', 'tt'),
                ('p(?=[a-zđăâêôơư])', 'pp'), ('đ', 'd'), ('d', 'j'), ('x', 'ss'), ('v', 'b'), ('uy', 'w i'),
                ('o(?=[ae])', 'w'), ('ă', 'a'), ('â', 'eo'), ('ê', 'e'), ('ô', 'o'), ('ơ', 'eo'), ('ư', 'eu'),
                ('y', 'i')),
    'th': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('kh', 'k'), ('k', 'kk'), ('th', 't'), ('t(?=[aeiou])', 'tt'), ('ph', 'p'), ('p(?=[aeiou])', 'pp'),
                ('ue', 'eu'), ('oe', 'eo'), ('ae', 'ae'), ('y', 'y'), ('j', 'ch')),
    'en': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('sh', 'sh'), ('ch', 'ch'), ('th', 's'), ('ph', 'f'), ('gh', 'g'), ('ck', 'k'), ('wh', 'w'),
                ('c(?=[eiy])', 's'), ('ee|ea', 'i'), ('oo', 'u'), ('ay|ai', 'e i'), ('ou|ow(?![aeiou])', 'a u'),
                ('qu', 'k w'), ('e(?![a-z])', ''), ('y(?![a-z])', 'i')),
    # 인도·필리핀·아랍 지명의 영어 로마자 — 적힌 대로 읽는다
    'phon': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('sh', 'sh'), ('ch', 'ch'), ('th', 't'), ('ph', 'f'), ('kh', 'x'), ('gh', 'g'), ('dh', 'd'),
                  ('bh', 'b'), ('ck', 'k'), ('aa', 'a'), ('ee', 'i'), ('ii', 'i'), ('oo|uu', 'u'),
                  ("['’`ʿʾ]", '')),
}
G2P['ms'] = G2P['id']
CYR = {'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'y e', 'ж': 'zh', 'з': 'z',
       'и': 'i', 'і': 'i', 'ї': 'y i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
       'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh t',
       'ъ': 'eo', 'ь': '', 'ю': 'y u', 'я': 'y a', "'": '', '’': ''}
GRK = rules(('ου', 'u'), ('αι', 'e'), ('ει|οι', 'i'), ('(?<![α-ω])μπ', 'b'), ('μπ', 'm b'), ('(?<![α-ω])ντ', 'd'),
            ('ντ', 'n d'), ('γκ', 'g'), ('γγ', 'ng g'), ('γ(?=[εηιυ])', 'y'), ('α', 'a'), ('β', 'v'), ('γ', 'g'),
            ('δ', 'd'), ('ε', 'e'), ('ζ', 'z'), ('[ηιυ]', 'i'), ('θ', 's'), ('κ', 'k'), ('λ', 'l'), ('μ', 'm'),
            ('ν', 'n'), ('ξ', 'k s'), ('[οω]', 'o'), ('π', 'p'), ('ρ', 'r'), ('[σς]', 's'), ('τ', 't'),
            ('φ', 'f'), ('χ', 'x'), ('ψ', 'p s'))


def phonemes(word, lang):
    if lang in ('uk', 'bg'):
        word = re.sub('[иі]й$', 'и', word)   # -ський → 스키
        toks = []
        for i, ch in enumerate(word):
            m = CYR.get(ch)
            if m is None:
                return None
            if ch == 'г' and lang == 'uk':
                m = 'h'
            if ch == 'и' and lang == 'uk':
                m = 'i'
            if ch == 'щ' and lang == 'uk':
                m = 'sh ch'
            toks += m.split()
        return toks
    if lang == 'el':
        word = ''.join(c for c in unicodedata.normalize('NFD', word) if not unicodedata.combining(c))
    table = GRK if lang == 'el' else G2P.get(lang, []) + BASE
    toks, i = [], 0
    while i < len(word):
        for rx, t in table:
            m = rx.match(word, i)
            if m and m.end() > i:
                toks += t
                i = m.end()
                break
        else:
            return None
    return toks


def vi_plain(s):
    """베트남어 성조 부호만 뗀다 — ă·â·ê·ô·ơ·ư 의 모음 부호는 남긴다."""
    d = unicodedata.normalize('NFD', s)
    return unicodedata.normalize('NFC', re.sub('[̣̀́̃̉]', '', d)).lower()


def latin_hangul(name, lang):
    """그 말로 적힌 지명 → 한글(국립국어원 표기 규칙을 줄인 것). 낱말은 붙여 쓰고 숫자는 띄어 둔다.
    못 읽는 글자가 있으면 None."""
    lang = lang[:2]
    stops = lang in ('en', 'id', 'ms', 'vi', 'th', 'phon')
    s = vi_plain(name) if lang == 'vi' else unicodedata.normalize('NFC', name).lower()
    s = re.sub('[ªº]', '', s)   # 1ª sección
    if lang not in ('vi', 'de', 'pl', 'cs', 'hu', 'ro', 'tr', 'fi', 'sv', 'nb', 'pt', 'fr', 'es', 'it', 'nl',
                    'uk', 'bg', 'el'):
        s = plain(s)
    parts = []
    for word in re.findall(r"[^\W\d_]+(?:['’][^\W\d_]+)*|\d+", s):
        if word.isdigit():
            parts.append(' ' + word + ' ')
            continue
        toks = phonemes(word, lang)
        if toks is None:
            return None
        toks = [t for t in toks if t]
        if not toks:
            continue   # 소리 없는 낱말(영어 'E.' 의 e)
        # 겹자음은 하나로(m·n 은 둔다 — 안나), k·g 앞 n 은 ng(앙카라·헬싱키)
        keep = () if lang in ('en', 'phon') else ('m', 'n', 'l')
        toks = [t for j, t in enumerate(toks) if not (j and t == toks[j - 1] and t not in keep and t not in VOW)]
        toks = ['ng' if t == 'n' and j + 1 < len(toks) and toks[j + 1] in ('k', 'g', 'kk') else t
                for j, t in enumerate(toks)]
        h = compose(toks, stops, lang in ('es', 'pt', 'it', 'ro'))
        if not h:
            return None
        parts.append(h)
    out = re.sub(r'\s+', ' ', ''.join(parts)).strip()
    return out or None


if __name__ == '__main__':
    J = {'Nerima': '네리마', 'Shinjuku': '신주쿠', 'Tōkyō': '도쿄', 'Shibuya': '시부야', 'Nishi-Ochiai': '니시오치아이',
         'Setagaya': '세타가야', 'Chiyoda': '지요다', 'Sapporo': '삿포로', 'Shimbashi': '신바시', 'Ōta': '오타',
         'Katsushika': '가쓰시카', 'Bunkyō': '분쿄', 'Itabashi': '이타바시', 'Kōtō': '고토'}
    for k, v in J.items():
        assert ja_hangul(k) == v, (k, ja_hangul(k), v)
    assert kana_roma('しんじゅく') == 'shinjuku' and kana_roma('さっぽろ') == 'sapporo'
    Z = {'Beijing': '베이징', 'Dongcheng': '둥청', 'Xicheng': '시청', 'Chaoyang': '차오양', 'Haidian': '하이뎬',
         'Fengtai': '펑타이', 'Youanmen': '유안먼', 'Tianjin': '톈진', 'Xian': '셴', 'Zhongzheng': '중정',
         'Daan': '다안', 'Xinyi': '신이', 'Shunyi': '순이', 'Huairou': '화이러우', 'Jiangsu': '장쑤',
         'Qinghe': '칭허', 'Xueyuan': '쉐위안', 'Guangzhou': '광저우'}
    for k, v in Z.items():
        assert zh_hangul(k) == v, (k, zh_hangul(k), v)
    assert zh_hangul('Central and Western') is None, '병음이 아니면 None'
    assert zh_hangul('Lvti') == '뤼티' and zh_hangul('xiao tang shan') == '샤오탕산'
    print('hangul ok')
