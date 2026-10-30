"""로마자 읽기 → 한글 표기. 국립국어원 외래어 표기법(일본어·중국어 표기)을 따른다.

build_capital.py 의 place_names 가 OSM·Wikidata 에 한국어 이름이 없는 곳에 쓴다.
읽기를 끝까지 못 풀면 None — 어설픈 표기를 지어내지 않는다.

    python3 tools/translit.py    # 자체검사
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
ONSET = {'si': 'ㅅ', 'p': 'ㅍ', 'b': 'ㅂ', 't': 'ㅌ', 'd': 'ㄷ', 'k': 'ㅋ', 'g': 'ㄱ', 'f': 'ㅍ', 'v': 'ㅂ', 's': 'ㅅ', 'z': 'ㅈ',
         'sh': 'ㅅ', 'zh': 'ㅈ', 'ch': 'ㅊ', 'j': 'ㅈ', 'ts': 'ㅊ', 'dz': 'ㅈ', 'h': 'ㅎ', 'x': 'ㅎ', 'xi': 'ㅎ',
         'm': 'ㅁ', 'n': 'ㄴ', 'l': 'ㄹ', 'r': 'ㄹ', 'ny': 'ㄴ', 'kk': 'ㄲ', 'tt': 'ㄸ', 'pp': 'ㅃ', 'ss': 'ㅆ', 'jj': 'ㅉ'}
# 모음 없이 남은 자음은 '으' 를 붙여 따로 선다 — sh·zh·ch·j·xi 는 '이'
CODA_SYL = {'si': '시', 'sh': '시', 'zh': '지', 'ch': '치', 'j': '지', 'xi': '히', 'ny': '니'}
NUCLEI = set(VOW) | {'y', 'w'}


def compose(tokens, stops_final=False, mid_stops=False, drop_r=False):
    """음소 → 한글. stops_final 이면 모음 뒤 p·t·k 를 받침(ㅂ·ㅅ·ㄱ)으로(영어·동남아 말),
    mid_stops 면 자음 앞 k·p 만 받침으로(로망스 말)."""
    out = []   # [첫, 가운데, 끝] 자모
    tokens = ['ng' if t == 'N' else t for t in tokens]   # 콧소리 모음(N)은 한글에서 ㅇ 받침

    made = set()   # '으' 를 덧붙여 세운 마디 — 그 뒤 p·t·k 는 받침이 아니다(웨스트)

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
            if c in ('si', 'sh', 'zh', 'ny') and vow != 'ㅣ':
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
        elif c in ('p', 't', 'k', 'kk', 'tt', 'pp') and stops_final and open_last() and nxt not in ('s',) \
                and len(out) - 1 not in made:
            out[-1][2] = {'p': 'ㅂ', 'pp': 'ㅂ', 't': 'ㅅ', 'tt': 'ㅅ', 'k': 'ㄱ', 'kk': 'ㄱ'}[c]
        elif c == 'ng':
            out.append(['ㅇ', 'ㅡ', 'ㅇ'])   # 앞 마디가 닫혔거나 없으면 '응'
        elif c == 'h' or (c == 'r' and drop_r):
            pass   # 모음 뒤 h, 영어의 모음 뒤 r 은 소리가 없다
        elif c in ('k', 'p') and mid_stops and open_last() and nxt and nxt not in NUCLEI:
            out[-1][2] = 'ㄱ' if c == 'k' else 'ㅂ'   # 자음 앞 c·k·p 는 받침(섹토르·셉티엠브레)
        elif c == 'sh' and nxt and nxt not in NUCLEI:
            out.append(['ㅅ', 'ㅠ', ' '])   # 자음 앞 ʃ 는 '슈'(슈판다우), 끝은 '시'
        elif c in CODA_SYL:
            out.append([ONSET[c], 'ㅣ', ' '])
        elif c in ONSET:
            out.append([ONSET[c], 'ㅡ', ' '])
            made.add(len(out) - 1)
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
    'pt': rules(('nh', 'ny'), ('lh', 'y'), ('ch', 'sh'), ('ç', 's'), ('ão', 'a N'), ('õe', 'o N i'),
                ('qu(?=[eéií])', 'k'), ('gu(?=[eéií])', 'g'), ('c(?=[eéií])', 's'), ('g(?=[eéií])', 'zh'),
                ('j', 'zh'), ('x', 'sh'), (f'(?<=[{_V}])s(?=[{_V}])', 'z'), ('h', ''), ('rr', 'r'),
                ('o(?![a-z])', 'u'), ('e(?![a-z])', 'i'), ('m(?![a-záàâãéêíóôõúç])', 'N')),
    'it': rules(('gli', 'y i'), ('gn', 'ny'), ('sc(?=[eéi])', 'sh'), ('ch', 'k'), ('gh', 'g'), ('ci(?=[aou])', 'ch'),
                ('c(?=[eéi])', 'ch'), ('gi(?=[aou])', 'j'), ('g(?=[eéi])', 'j'), ('zz', 'ts'), ('z', 'ts'),
                ('qu', 'k w'), ('h', '')),
    'fr': rules(('(?<![a-z])des(?![a-z])', 'd e'), ('(?<![a-z])les(?![a-z])', 'l e'), ('(?<![a-z])mes(?![a-z])', 'm e'),
                ('(?<![a-z])de(?![a-z])', 'd eu'), ('(?<![a-z])le(?![a-z])', 'l eu'), ('eaux?(?![a-z])', 'o'), ('eau', 'o'), ('aux?(?![a-z])', 'o'), ('au', 'o'), ('oi', 'u a'),
                ('ou', 'u'), ('ps(?![a-z])', ''), ('oy', 'u a y'), ('ois?(?![a-z])', 'u a'), ('(?<=[aeiou])x(?=[aeiou])', 's'), ('ais?(?![a-z])', 'e'), ('aill', 'a y'), ('eill', 'e y'), ('ouill', 'u y'), ('ain(?![a-z])', 'ae N'), ('ain(?![aeiou])', 'ae N'), ('ein(?![aeiou])', 'ae N'),
                ('ien(?![aeiou])', 'y ae N'), ('ont(?![aeiouy])', 'o N'), ('[ae]nt(?![aeiouy])', 'a N'), ('[ai]n(?![aeiouny])', 'a N'), ('[ae]m(?![aeioumn])', 'a N'),
                ('en(?![aeioun])', 'a N'), ('on(?![aeioun])', 'o N'), ('om(?![aeioumn])', 'o N'),
                ('in(?![aeioun])', 'ae N'), ('un(?![aeioun])', 'ae N'), ('ai|ei', 'e'), ('eu|œu', 'oe'),
                ('(?<=[vm])ille', 'i l'), ('ille', 'i y u'), ('elle', 'e l'), ('ch', 'sh'), ('gn', 'ny'), ('qu', 'k'), ('ph', 'f'), ('th', 't'), ('ç', 's'),
                ('c(?=[eéèêiy])', 's'), ('g(?=[eéèêiy])', 'zh'), ('j', 'zh'), ('h', ''), ('ll', 'l'),
                (f'(?<=[{_V}])s(?=[{_V}])', 'z'), ('es?(?![a-z])', ''), ('[stdxz](?![a-z])', ''), ('[éèêë]', 'e'),
                ('u', 'ue'), (f'e(?![{_V}]|[a-z][a-z])', 'eu'), ('y', 'i')),
    'de': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('(?<=[a-zäöüß])st(?=adt)', 'sh t'), ('dt', 't'), ('ow(?![a-zäöüß])', 'o'),
                ('(?<![a-zß])ch(?=ar)', 'sh'), ('(?<=[^aeiouäöüy\\W])er(?=s)', 'eo'), ('d(?=[stfkpß])', 't'), ('(?<![a-zß])sch', 'sh'), ('tsch', 'ch'), ('sch', 'sh'), ('(?<![a-zß])s(?=[pt])', 'sh'),
                ('(?<![a-zß])ch', 'k'), ('(?<=[eiäöüy])ch', 'xi'), ('(?<=[lnr])ch', 'xi'), ('chs', 'k s'), ('ch', 'x'),
                ('ig(?![a-zßäöü])', 'i xi'), ('ck', 'k'), ('ß', 's'), ('tz|z', 'ts'), ('ph', 'f'), ('th', 't'),
                ('qu', 'k v'), ('v', 'f'), ('w', 'v'), ('j', 'y'), ('ier(?![aeiouäöü])', 'i eo'), ('ei|ai', 'a i'), ('eu|äu', 'o i'), ('ie', 'i'),
                ('ä', 'e'), ('ö', 'oe'), ('ü', 'ue'), ('y', 'ue'), ('(?<=[aeiouäöü])h(?![aeiouäöü])', ''), ('er(?![a-zßäöü])', 'eo'),
                ('b(?![a-zßäöü])', 'p'), ('d(?![a-zßäöü])', 't'), ('g(?![a-zßäöü])', 'k'), (f's(?=[{_V}])', 'z'),
                ('aa|ah(?![aeiouäöü])', 'a'), ('ee|eh(?![aeiouäöü])', 'e'), ('oo|oh(?![aeiouäöü])', 'o'),
                ('uh(?![aeiouäöü])', 'u'), ('ih(?![aeiouäöü])', 'i')),
    'nl': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('ee', 'e i'), ('th', 't'), ('ij|ei', 'e i'), ('oe', 'u'), ('ou|au', 'a u'), ('ui', 'oe i'), ('ie', 'i'), ('eu', 'oe'),
                ('sch', 's x'), ('ch', 'x'), ('g', 'x'), ('j', 'y'), ('w', 'v'), ('v', 'f'), ('uu|u', 'ue'),
                ('aa', 'a'), ('oo', 'o'), ('c(?=[eiy])', 's')),
    'sv': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('dj', 'y'), ('sj|skj|stj', 'sh'), ('sk(?=[eiyäö])', 'sh'), ('tj|kj', 'ch'), ('k(?=[eiyäö])', 'ch'),
                ('g(?=[eiyäö])', 'y'), ('j', 'y'), ('å', 'o'), ('ä', 'e'), ('ö', 'oe'), ('y', 'ue'), ('w', 'v'),
                ('ck', 'k')),
    'nb': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('sj|skj', 'sh'), ('kj', 'ch'), ('j', 'y'), ('ø', 'oe'), ('æ', 'e'), ('å', 'o'), ('y', 'ue')),
    'fi': rules(('y', 'ue'), ('ä', 'ae'), ('ö', 'oe'), ('j', 'y'), ('aa', 'a'), ('ee', 'e'), ('ii', 'i'),
                ('oo', 'o'), ('uu', 'u'), ('ää', 'ae')),
    'pl': rules(('szcz', 'sh ch'), ('sz', 'sh'), ('cz', 'ch'), ('rz|ż', 'zh'), ('ch', 'h'),
                ('dzi', 'j i'), ('dź|dż', 'j'), ('ś', 'si'), ('ć', 'ch'), ('ź', 'zh'), ('ń', 'n'), ('dz', 'dz'), ('ł', 'w'), ('w(?![a-ząęóśćźżńł])', 'f'), ('(rz|ż)(?![a-ząęóśćźżńł])', 'sh'),
                ('w', 'v'), ('c', 'ts'), ('j', 'y'), ('y', 'i'), ('ą', 'o N'), ('ę', 'e N'), ('ó', 'u')),
    'cs': rules(('ch', 'x'), ('č', 'ch'), ('š', 'sh'), ('ž', 'zh'), ('ř', 'r zh'), ('c', 'ts'), ('j', 'y'),
                ('ě', 'y e'), ('ň', 'ny'), ('ť', 't y'), ('ď', 'd y'), ('[yý]', 'i'), ('[ůú]', 'u'), ('w', 'v'), ('ž(?=[kptsc])', 'sh'),
                ('v(?![a-záčďéěíňóřšťúůýž])', 'f')),
    'hu': rules(('dzs', 'j'), ('sz', 's'), ('cs', 'ch'), ('zs', 'zh'), ('gy', 'j'), ('ny', 'ny'), ('ty', 'ch'),
                ('ly', 'y'), ('s', 'sh'), ('c', 'ts'), ('j', 'y'), ('[öő]', 'oe'), ('[üű]', 'ue'), ('y', 'i'), ('á', 'a'), ('a', 'eo')),
    'ro': rules(('[șş]', 'sh'), ('[țţ]', 'ts'), ('ă', 'eo'), ('[âî]', 'eu'), ('ch(?=[ei])', 'k'), ('gh(?=[ei])', 'g'),
                ('c(?=[ei])', 'ch'), ('g(?=[ei])', 'j'), ('j', 'zh')),
    'tr': rules(('c', 'j'), ('ç', 'ch'), ('ş', 'sh'), ('ğ', ''), ('ı', 'eu'), ('ö', 'oe'), ('ü', 'ue'), ('j', 'zh'),
                ('â', 'a'), ('î', 'i'), ('y', 'y')),
    'id': rules(('ng', 'ng'), ('ny', 'ny'), ('sy', 'sh'), ('kh', 'x'), ('ch', 'ch'), ('c', 'ch'), ('oe', 'u'), ('dj', 'j'),
                ('tj', 'ch'), ('y', 'y')),
    'vi': rules(('(?<![a-z])ngh?', 'ng'), ('ngh', 'ng'), ('ng', 'ng'), ('nh(?![a-zđăâêôơư])', 'n'), ('nh', 'ny'),
                ('(?<![a-z])gi', 'j'), ('tr|ch(?=[a-zđăâêôơư])', 'jj'), ('ch', 'k'), ('ph', 'p'), ('th', 't'),
                ('kh', 'k'), ('gh', 'g'), ('qu', 'kk w'), ('[ck]', 'kk'), ('t(?=[a-zđăâêôơư])', 'tt'),
                ('p(?=[a-zđăâêôơư])', 'pp'), ('đ', 'd'), ('d', 'j'), ('x', 'ss'), ('v', 'b'), ('uy', 'w i'),
                ('o(?=[ae])', 'w'), ('ă', 'a'), ('â', 'eo'), ('ê', 'e'), ('ô', 'o'), ('ơ', 'eo'), ('ư', 'eu'),
                ('y', 'i')),
    'th': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('kh', 'k'), ('k', 'kk'), ('th', 't'), ('t(?![aeiou]*(?![a-z]))', 'tt'),
                ('ph', 'p'), ('p(?![aeiou]*(?![a-z]))', 'pp'), ('ch', 'ch'), ('s', 'ss'), ('ue', 'eu'), ('oe', 'eu'),
                ('ae', 'ae'), ('y', 'y'), ('j', 'ch')),
    'en': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('sh', 'sh'), ('ch', 'ch'), ('th', 's'), ('ph', 'f'), ('gh', 'g'), ('ck', 'k'), ('wh', 'w'),
                ('c(?=[eiy])', 's'), ('ee|ea', 'i'), ('oo', 'u'), ('ay|ai', 'e i'), ('ou|ow(?![aeiou])', 'a u'),
                ('qu', 'k w'), ('e(?![a-z])', ''), ('y(?![a-z])', 'i')),
    # 인도·필리핀·아랍 지명의 영어 로마자 — 적힌 대로 읽는다
    'phon': rules(('ng(?![aeiouyäöüåæø])', 'ng'), ('sh', 'sh'), ('ch', 'ch'), ('th', 't'), ('ph', 'f'), ('kh', 'x'), ('gh', 'g'), ('dh', 'd'),
                  ('bh', 'b'), ('ck', 'k'), ('aa', 'a'), ('ee', 'i'), ('ii', 'i'), ('oo|uu', 'u'),
                  ('(?<=[aeiou][lnr])h', ''), ("['’`ʿʾ]", '')),
}
G2P['ms'] = G2P['id']
G2P['pb'] = rules(('d(?=i)', 'j'), ('t(?=i)', 'ch')) + G2P['pt']   # 브라질 — di·ti 는 지·치(세일랑지아)
# 성조 없는 병음 — 중국 지명을 한글 밖의 글자로 옮길 때 읽는다
G2P['py'] = rules(('ng(?![aeiou])', 'ng'), ('zh', 'j'), ('ch', 'ch'), ('sh', 'sh'), ('(?<=[zcs])i|(?<=[zcs]h)i|(?<=r)i(?![a-z])', 'eu'),
                  ('x', 'sh'), ('q', 'ch'), ('c', 'ts'), ('z', 'dz'), ('ian', 'y e n'), ('iao', 'y a o'), ('ia', 'y a'), ('ie', 'y e'), ('ui', 'w e i'), ('iu', 'y o u'),
                  ('ong', 'u ng'), ('(?<=[jqxy])u', 'ue'), ('v|ü', 'ue'), ('e(?![inr])', 'eo'), ('r(?![aeiou])', 'r'))
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


ROMAN = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100}


def roman(m):
    n = [ROMAN[c] for c in m.group(1)]
    return str(sum(-v if i + 1 < len(n) and v < n[i + 1] else v for i, v in enumerate(n)))


# 로마자 지명 속 영어 낱말 — 적힌 대로 읽으면 '노릇웨슷' 이 된다. 한글로만 쓰고, 다른 글자는 규칙으로 읽는다
EN_KO = {'north': '노스', 'south': '사우스', 'east': '이스트', 'west': '웨스트', 'central': '센트럴', 'new': '뉴',
         'old': '올드', 'sector': '섹터', 'nagar': '나가르', 'village': '빌리지', 'city': '시티', 'park': '파크',
         'valley': '밸리', 'creek': '크리크', 'river': '리버', 'hill': '힐', 'hills': '힐스', 'colony': '콜로니',
         'delhi': '델리', 'block': '블록', 'extension': '익스텐션', 'enclave': '엔클레이브', 'garden': '가든'}


def words(name, lang):
    """이름 → 낱말마다 음소 목록(숫자는 문자열 그대로). 못 읽는 글자가 있으면 None.
    로마 숫자(XXI. kerület, Roma I)는 아라비아 숫자로 읽는다."""
    name = re.sub(r'(?<![\w])([IVXLC]+)(?:\.|(?=$))', roman, name)
    s = vi_plain(name) if lang == 'vi' else unicodedata.normalize('NFC', name).lower()
    s = re.sub('[ªº]', '', s)   # 1ª sección
    if lang not in ('vi', 'de', 'pl', 'cs', 'hu', 'ro', 'tr', 'fi', 'sv', 'nb', 'pt', 'pb', 'fr', 'es', 'it', 'nl',
                    'uk', 'bg', 'el'):
        s = plain(s)
    out = []
    for word in re.findall(r"[^\W\d_]+(?:['’][^\W\d_]+)*|\d+", s):
        if word.isdigit():
            out.append(word)
            continue
        toks = phonemes(word, lang)
        if toks is None:
            return None
        toks = [t for t in toks if t]
        if not toks:
            continue   # 소리 없는 낱말(영어 'E.' 의 e)
        # 겹자음은 하나로(m·n 은 둔다 — 안나), k·g 앞 n 은 ng(앙카라·헬싱키)
        keep = () if lang in ('en', 'phon', 'py') else ('l',) if lang in ('de', 'fr', 'sv', 'nb', 'nl') else ('m', 'n', 'l')
        toks = [t for j, t in enumerate(toks) if not (j and t == toks[j - 1] and t not in keep and t not in VOW)]
        if lang != 'tr':   # 터키어는 n 을 그대로 적는다(찬카야)
            toks = ['ng' if t == 'n' and j + 1 < len(toks) and toks[j + 1] in ('k', 'g', 'kk') else t
                    for j, t in enumerate(toks)]
        out.append(toks)
    return out or None


def norm_lang(lang):
    return lang if lang in ('phon', 'py', 'pb') else lang.split('-')[0]


def latin_hangul(name, lang):
    """그 말로 적힌 지명 → 한글(국립국어원 표기 규칙을 줄인 것). 낱말은 붙여 쓰고 숫자는 띄어 둔다.
    못 읽는 글자가 있으면 None."""
    lang = norm_lang(lang)
    ws = words(name, lang)
    if not ws:
        return None
    stops = lang in ('en', 'id', 'ms', 'vi', 'th', 'phon', 'py', 'tr')
    parts = []
    plain_words = re.findall(r"[^\W\d_]+(?:['’][^\W\d_]+)*|\d+", plain(name)) if lang in ('phon', 'en') else []
    if len(plain_words) == len(ws):
        ws = [EN_KO.get(p, w) if not isinstance(w, str) else w for p, w in zip(plain_words, ws)]
    for w in ws:
        h = (' ' + w + ' ' if w.isdigit() else w) if isinstance(w, str) else \
            compose(w, stops, lang in ('es', 'pt', 'pb', 'it', 'ro'), lang == 'en')
        if not h:
            return None
        parts.append(h)
    return re.sub(r'\s+', ' ', ''.join(parts)).strip() or None


# ── 한글 밖의 글자 ─────────────────────────────────────
# 같은 음소를 화면 말 글자로 앉힌다. 모음은 다섯(a i u e o)으로 접는다 — eo(ʌ·ă·ơ)는 a, eu(ı·ư)는 u,
# ae(ä)는 e, oe(ö)는 e, ue(ü)는 y+u. 자음은 화면 말의 외래어 적기 관습을 따른 줄인 표다.
FIVE = {'a': 0, 'i': 1, 'u': 2, 'e': 3, 'o': 4, 'eo': 0, 'eu': 2, 'ae': 3, 'oe': 3}
SAME = {'si': 'sh', 'kk': 'k', 'tt': 't', 'pp': 'p', 'ss': 's', 'jj': 'ch', 'xi': 'x', 'dz': 'z', 'N': 'n'}


def syllables(toks):
    """음소 → [(첫소리, 반모음, 모음 0-4 | None, 받침)] — 받침은 다음 모음이 없는 자음 하나."""
    out, i = [], 0
    toks = [SAME.get(t, t) for t in toks]
    toks = ['n' if t == 'ng' and j + 1 < len(toks) and toks[j + 1] in ('k', 'g') else t for j, t in enumerate(toks)]
    while i < len(toks):
        c = toks[i]
        if c == 'ue':
            c, toks = 'y', toks[:i] + ['y', 'u'] + toks[i + 1:]
        nxt = toks[i + 1] if i + 1 < len(toks) else None
        if nxt == 'ue':
            toks = toks[:i + 1] + ['y', 'u'] + toks[i + 2:]
            nxt = 'y'
        nn = toks[i + 2] if i + 2 < len(toks) else None
        if c in ('i', 'u') and out and out[-1][2] in (0, 3, 4) and out[-1][3] is None and out[-1][2] != FIVE[c]:
            out[-1][3] = 'y' if c == 'i' else 'w'; i += 1; continue   # 이중모음 au·ai·ei·oi 는 반모음 받침
        if c in FIVE:
            out.append(['', None, FIVE[c], None]); i += 1; continue
        if c in ('y', 'w') and nxt in FIVE:
            out.append(['', c, FIVE[nxt], None]); i += 2; continue
        if nxt in FIVE:
            out.append([c, None, FIVE[nxt], None]); i += 2; continue
        if nxt in ('y', 'w') and nn in FIVE:
            out.append([c, nxt, FIVE[nn], None]); i += 3; continue
        if out and out[-1][2] is not None and out[-1][3] is None:
            out[-1][3] = c   # 앞 마디의 받침
        else:
            out.append([c, None, None, None])   # 모음 없는 자음
        i += 1
    return out


KATA = {
    '': 'ア イ ウ エ オ', 'k': 'カ キ ク ケ コ', 'g': 'ガ ギ グ ゲ ゴ', 's': 'サ シ ス セ ソ', 'z': 'ザ ジ ズ ゼ ゾ',
    't': 'タ ティ トゥ テ ト', 'd': 'ダ ディ ドゥ デ ド', 'n': 'ナ ニ ヌ ネ ノ', 'h': 'ハ ヒ フ ヘ ホ',
    'x': 'ハ ヒ フ ヘ ホ', 'b': 'バ ビ ブ ベ ボ', 'p': 'パ ピ プ ペ ポ', 'm': 'マ ミ ム メ モ', 'r': 'ラ リ ル レ ロ',
    'l': 'ラ リ ル レ ロ', 'f': 'ファ フィ フ フェ フォ', 'v': 'ヴァ ヴィ ヴ ヴェ ヴォ', 'sh': 'シャ シ シュ シェ ショ',
    'zh': 'ジャ ジ ジュ ジェ ジョ', 'j': 'ジャ ジ ジュ ジェ ジョ', 'ch': 'チャ チ チュ チェ チョ',
    'ts': 'ツァ ツィ ツ ツェ ツォ', 'ny': 'ニャ ニ ニュ ニェ ニョ', 'y': 'ヤ イ ユ イェ ヨ', 'w': 'ワ ウィ ウ ウェ ウォ',
    'ng': 'ンガ ンギ ング ンゲ ンゴ'}
KATA = {k: v.split() for k, v in KATA.items()}
K_CODA = {'m': 'ン', 'n': 'ン', 'ng': 'ン', 'l': 'ル', 'r': 'ル', 't': 'ト', 'd': 'ド', 'k': 'ク', 'g': 'グ',
          's': 'ス', 'z': 'ズ', 'sh': 'シュ', 'zh': 'ジュ', 'j': 'ジ', 'ch': 'チ', 'ts': 'ツ', 'x': 'ハ', 'h': '',
          'f': 'フ', 'v': 'ヴ', 'p': 'プ', 'b': 'ブ', 'y': 'イ', 'w': 'ウ', 'ny': 'ニ'}
K_Y = 'ャ ィ ュ ェ ョ'.split()
K_W = 'ァ ィ ゥ ェ ォ'.split()


def kana(ws):
    out = []
    for w in ws:
        if isinstance(w, str):
            out.append(w); continue
        s = ''
        for c, g, v, coda in syllables(w):
            if v is None:   # 낱말 첫머리의 m·n 은 ン 으로 시작할 수 없다 — Младост 는 ムラドスト
                s += KATA[c][2] if not s and c in ('m', 'n') else K_CODA.get(c, '')
            elif g == 'y' and c:
                s += KATA[c][1].rstrip('ィ') + ('' if v == 1 else K_Y[v]) if c in ('k', 'g', 'n', 'h', 'b', 'p', 'm', 'r', 'l', 'x') \
                    else KATA[c][v] if c in ('sh', 'zh', 'j', 'ch', 'ny') else KATA[c][1] + K_Y[v]
            elif g == 'w' and c:
                s += KATA[c][2] + K_W[v]
            else:
                s += KATA[g or c][v]
            if coda:
                s += K_CODA.get(coda, '')
        out.append(s)
    return '・'.join(out) or None


HANZI = {   # 新华 외국 지명 적기 표를 줄인 것 — 첫소리 줄 × 모음 a e i o u
    '': '阿埃伊奥乌', 'b': '巴贝比博布', 'p': '帕佩皮波普', 'm': '马梅米莫穆', 'f': '法费菲福富', 'v': '瓦韦维沃武',
    'd': '达德迪多杜', 't': '塔特蒂托图', 'n': '纳内尼诺努', 'l': '拉莱利洛卢', 'r': '拉雷里罗鲁', 'g': '加盖吉戈古',
    'k': '卡凯基科库', 'h': '哈赫希霍胡', 'x': '哈赫希霍胡', 'j': '贾杰吉乔朱', 'zh': '扎热日若茹',
    'ch': '查切奇乔丘', 'sh': '沙谢希肖舒', 's': '萨塞西索苏', 'z': '扎泽齐佐祖', 'ts': '察采齐措楚',
    'y': '亚耶伊约尤', 'w': '瓦韦维沃武', 'ny': '尼涅尼诺纽', 'ng': '加盖吉戈古'}
HANZI_N = {   # 같은 줄에 받침 n·m·ng 이 붙은 마디
    '': '安恩因翁温', 'b': '班本宾邦本', 'p': '潘彭平庞蓬', 'm': '曼门明蒙蒙', 'f': '凡芬芬丰丰', 'v': '万文温翁文',
    'd': '丹登丁东敦', 't': '坦滕廷通顿', 'n': '南嫩宁农农', 'l': '兰伦林隆伦', 'r': '兰伦林隆伦', 'g': '甘根金贡贡',
    'k': '坎肯金孔昆', 'h': '汉亨欣洪洪', 'x': '汉亨欣洪洪', 'j': '詹真金琼准', 'zh': '然仁任戎润',
    'ch': '钱琴钦琼春', 'sh': '尚申欣雄顺', 's': '桑森辛松孙', 'z': '赞曾津宗尊', 'ts': '灿岑钦聪村',
    'y': '扬延因永云', 'w': '万温温翁温', 'ny': '年宁宁农农', 'ng': '甘根金贡贡'}
HANZI = {k: v[0] + v[2] + v[4] + v[1] + v[3] for k, v in HANZI.items()}       # a e i o u → a i u e o
HANZI_N = {k: v[0] + v[2] + v[4] + v[1] + v[3] for k, v in HANZI_N.items()}
H_CODA = {'b': '布', 'p': '普', 't': '特', 'd': '德', 'k': '克', 'g': '格', 'f': '夫', 'v': '夫', 's': '斯', 'z': '兹',
          'sh': '什', 'zh': '日', 'ch': '奇', 'j': '吉', 'ts': '茨', 'h': '赫', 'x': '赫', 'm': '姆', 'n': '恩', 'ng': '恩',
          'l': '尔', 'r': '尔', 'y': '伊', 'w': '乌', 'ny': '尼'}


def hanzi(ws):
    out = []
    for w in ws:
        if isinstance(w, str):
            out.append(w); continue
        s = ''
        for c, g, v, coda in syllables(w):
            if v is None:
                s += H_CODA.get(c, ''); continue
            row = g if not c and g else c
            if coda in ('n', 'm', 'ng'):
                s += HANZI_N.get(row, HANZI_N[''])[v]; continue
            s += HANZI.get(row, HANZI[''])[v]
            if coda:
                s += H_CODA.get(coda, '')
        out.append(s)
    return '·'.join(out) or None


CYR_C = {'p': 'п', 'b': 'б', 't': 'т', 'd': 'д', 'k': 'к', 'g': 'ґ', 'f': 'ф', 'v': 'в', 's': 'с', 'z': 'з',
         'sh': 'ш', 'zh': 'ж', 'ch': 'ч', 'j': 'дж', 'ts': 'ц', 'h': 'г', 'x': 'х', 'm': 'м', 'n': 'н', 'ng': 'нг',
         'l': 'л', 'r': 'р', 'ny': 'нь', 'y': 'й', 'w': 'у'}
CYR_V = {'uk': ('а', 'і', 'у', 'е', 'о'), 'bg': ('а', 'и', 'у', 'е', 'о')}
CYR_Y = {'uk': ('я', 'ї', 'ю', 'є', 'йо'), 'bg': ('я', 'и', 'ю', 'йе', 'йо')}


def cyrillic(ws, lang):
    c_map = dict(CYR_C, **({'g': 'г', 'h': 'х'} if lang == 'bg' else {}))
    out = []
    for w in ws:
        if isinstance(w, str):
            out.append(w); continue
        s = ''
        for c, g, v, coda in syllables(w):
            if v is None:
                s += c_map.get(c, '')
            else:
                if c:
                    s += c_map.get(c, '')
                    if c == 'ny':
                        s = s[:-1] if s.endswith('ь') else s
                        g = g or 'y'
                s += CYR_Y[lang][v] if g == 'y' else ('в' if g == 'w' else '') + CYR_V[lang][v]
                if coda:
                    s += c_map.get(coda, '')
        out.append(s[:1].upper() + s[1:])
    return ' '.join(out) or None


GRK_C = {'p': 'π', 'b': 'μπ', 't': 'τ', 'd': 'ντ', 'k': 'κ', 'g': 'γκ', 'f': 'φ', 'v': 'β', 's': 'σ', 'z': 'ζ',
         'sh': 'σ', 'zh': 'ζ', 'ch': 'τσ', 'j': 'τζ', 'ts': 'τσ', 'h': 'χ', 'x': 'χ', 'm': 'μ', 'n': 'ν', 'ng': 'γκ',
         'l': 'λ', 'r': 'ρ', 'ny': 'νι', 'y': 'ι', 'w': 'ου'}
GRK_V = ('α', 'ι', 'ου', 'ε', 'ο')


def greek(ws):
    out = []
    for w in ws:
        if isinstance(w, str):
            out.append(w); continue
        s = ''
        for c, g, v, coda in syllables(w):
            if v is None:
                s += GRK_C.get(c, ''); continue
            s += GRK_C.get(c, '') + ('ι' if g == 'y' else 'ου' if g == 'w' else '') + GRK_V[v] + GRK_C.get(coda or '', '')
        s = re.sub('σ$', 'ς', s.replace('νντ', 'ντ').replace('μμπ', 'μπ').replace('νγκ', 'γκ'))
        out.append(s[:1].upper() + s[1:])
    return ' '.join(out) or None


AR_C = {'p': 'ب', 'b': 'ب', 't': 'ت', 'd': 'د', 'k': 'ك', 'g': 'غ', 'f': 'ف', 'v': 'ف', 's': 'س', 'z': 'ز',
        'sh': 'ش', 'zh': 'ج', 'ch': 'تش', 'j': 'ج', 'ts': 'تس', 'h': 'ه', 'x': 'خ', 'm': 'م', 'n': 'ن', 'ng': 'نغ',
        'l': 'ل', 'r': 'ر', 'ny': 'ني', 'y': 'ي', 'w': 'و'}
AR_V = ('ا', 'ي', 'و', 'ي', 'و')
AR_V0 = ('أ', 'إي', 'أو', 'إي', 'أو')


def arabic(ws):
    out = []
    for w in ws:
        if isinstance(w, str):
            out.append(w); continue
        s = ''
        for c, g, v, coda in syllables(w):
            if v is None:
                s += AR_C.get(c, ''); continue
            if not c and not g:
                s += AR_V0[v] if not s else AR_V[v] if v else 'ا'
            else:
                s += AR_C.get(c, '') + ('ي' if g == 'y' else 'و' if g == 'w' else '') + AR_V[v]
            s += AR_C.get(coda or '', '')
        out.append(s)
    return ' '.join(out) or None


TH_C = {'p': 'พ', 'b': 'บ', 't': 'ท', 'd': 'ด', 'k': 'ค', 'g': 'ก', 'f': 'ฟ', 'v': 'ว', 's': 'ซ', 'z': 'ซ',
        'sh': 'ช', 'zh': 'ช', 'ch': 'ช', 'j': 'จ', 'ts': 'ซ', 'h': 'ฮ', 'x': 'ค', 'm': 'ม', 'n': 'น', 'ng': 'ง',
        'l': 'ล', 'r': 'ร', 'ny': 'ญ', 'y': 'ย', 'w': 'ว', '': 'อ'}
TH_F = {'k': 'ก', 'g': 'ก', 'p': 'ป', 'b': 'บ', 't': 'ต', 'd': 'ด', 's': 'ส', 'z': 'ส', 'm': 'ม', 'n': 'น',
        'ng': 'ง', 'l': 'ล', 'r': 'ร', 'y': 'ย', 'w': 'ว', 'ch': 'ช', 'sh': 'ช', 'j': 'จ', 'ts': 'ซ', 'f': 'ฟ',
        'v': 'ฟ', 'x': 'ค', 'h': '', 'ny': 'ญ', 'zh': 'ช'}
# 열린 마디 · 닫힌 마디의 모음 틀 — C 는 첫소리, F 는 받침
TH_OPEN = ('Cา', 'Cี', 'Cู', 'เC', 'โC')
TH_SHUT = ('CัF', 'CิF', 'CุF', 'เCF', 'โCF')


def thai(ws):
    out = []
    for w in ws:
        if isinstance(w, str):
            out.append(w); continue
        s = ''
        for c, g, v, coda in syllables(w):
            if v is None:
                s += TH_C.get(c, ''); continue
            head = TH_C.get(c, 'อ') + ({'y': 'ย', 'w': 'ว'}.get(g, '') if c else '')
            if not c and g:
                head = TH_C[g]
            form = TH_SHUT[v] if coda and TH_F.get(coda) else TH_OPEN[v]
            if v == 0 and coda in ('w', 'y'):
                form, coda = ('เCา' if coda == 'w' else 'ไC'), None   # เดา · ไท
            s += form.replace('C', head).replace('F', TH_F.get(coda or '', ''))
        out.append(s)
    return ' '.join(out) or None


def transcribe(name, lang, target):
    """그 말(lang)로 적힌 이름을 화면 말(target) 글자로. 못 하면 None."""
    lang = norm_lang(lang)
    if target == 'ko':
        return latin_hangul(name, lang)
    ws = words(name, lang)
    if not ws:
        return None
    if target == 'ja':
        return kana(ws)
    if target == 'zh':
        return hanzi(ws)
    if target in ('uk', 'bg'):
        return cyrillic(ws, target)
    return {'el': greek, 'ar': arabic, 'th': thai}.get(target, lambda _: None)(ws)


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
    LAT = {('Spandau', 'de'): '슈판다우', ('Lichtenberg', 'de'): '리히텐베르크', ('Göttingen', 'de'): '괴팅겐',
         ('Tiergarten', 'de'): '티어가르텐', ('Carabanchel', 'es'): '카라반첼', ('Puente de Vallecas', 'es'): '푸엔테데바예카스',
         ('Montmartre', 'fr'): '몽마르트르', ('Belleville', 'fr'): '벨빌', ('Saint-Germain-des-Prés', 'fr'): '생제르맹데프레',
         ('Mokotów', 'pl'): '모코투프', ('Helsinki', 'fi'): '헬싱키', ('Kungsholmen', 'sv'): '쿵스홀멘',
         ('Jaffarpur Kalan', 'phon'): '자파르푸르칼란', ('Bồ Đề', 'vi'): '보데', ('Оболонь', 'uk'): '오볼론'}
    for (k, lang), v in LAT.items():
        assert latin_hangul(k, lang) == v, (k, latin_hangul(k, lang), v)
    assert transcribe('Berlin', 'de', 'ja') == 'ベルリン' and transcribe('München', 'de', 'ja') == 'ミュンヘン'
    assert transcribe('Младост', 'bg', 'ja') == 'ムラドスト' and transcribe('Bernstein', 'de', 'ja').startswith('ベルン')
    assert transcribe('Berlin', 'de', 'zh') == '贝尔林' and transcribe('Helsinki', 'fi', 'zh') == '赫尔辛基'
    assert transcribe('Berlin', 'de', 'uk') == 'Берлін' and transcribe('Montmartre', 'fr', 'bg') == 'Монмартр'
    assert transcribe('Spandau', 'de', 'th').endswith('เดา') and transcribe('Copacabana', 'pt', 'el') == 'Κοπακαμπανα'
    print('translit ok')
