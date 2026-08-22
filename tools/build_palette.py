"""기준색 하나에서 보드 에셋의 톤을 계산해 팔레트 CSS 를 뽑는다.

색마다 지붕·벽·바닥·차·차고지를 손으로 고르면 톤이 서로 어긋난다.
HSL 에서 밝기와 채도만 일정하게 움직여 계열을 맞춘다.
"""
import colorsys, sys

BASE = {
    "red":    "#e2695e",
    "orange": "#ef9a4a",
    "yellow": "#f2c94c",
    "green":  "#7cc17a",
    "teal":   "#4fb3a5",
    "blue":   "#5fa8d3",
    "purple": "#8f8ad6",
    "pink":   "#d982b4",
    "slate":  "#8b9aa5",
}

def hex2hls(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return colorsys.rgb_to_hls(r, g, b)

def hls2hex(h, l, s):
    r, g, b = colorsys.hls_to_rgb(h, max(0, min(1, l)), max(0, min(1, s)))
    return "#%02x%02x%02x" % tuple(round(c * 255) for c in (r, g, b))

def tones(base):
    h, l, s = hex2hls(base)
    return {
        "roof": hls2hex(h, l + .10, min(1, s + .06)),   # 햇빛 받는 윗면
        "wall": hls2hex(h, l - .06, s),                 # 기준
        "base": hls2hex(h, l - .16, min(1, s + .04)),   # 그늘진 밑동
        "car":  hls2hex(h, l - .02, min(1, s + .04)),
        "depot":      hls2hex(h, l + .08, min(1, s + .04)),
        "depot-base": hls2hex(h, l - .12, min(1, s + .04)),
    }

out = ["/* tools/build_palette.py 가 만든다. 직접 고치지 말 것. */",
       "/* 요소에 c-이름 클래스를 붙이면 그 계열로 칠해진다. */", ""]
for name, base in BASE.items():
    t = tones(base)
    out.append(f".c-{name}{{")
    out.append("  " + " ".join(f"--rt-{k}:{v};" for k, v in t.items()))
    out.append("}")
open(sys.argv[1], "w").write("\n".join(out) + "\n")

for name, base in BASE.items():
    t = tones(base)
    print(f"{name:>7} {base}  지붕 {t['roof']}  벽 {t['wall']}  바닥 {t['base']}")
