"""CRT 터미널 베타(beta/crt)가 띄우는 구 지도를 찍어낸다 → data/crt/*.jpg, data/crt.json

maps/<구>-지도/ 원본(CMYK JPG, 한 장 1~2.5MB)은 .assetsignore 에 묶여 배포되지 않는다.
구마다 윤곽선 지도(→ <slug>.line.jpg)와 이름 붙은 흑백 지도(→ <slug>.name.jpg)를
긴 변 960px 회색조 JPG 로 줄이고 색 프로필을 뗀다. 형광체 색은 화면이 캔버스에서 입힌다.
줄이기는 macOS 의 sips 로 한다 — 도구 하나 때문에 PIL 을 들이지 않는다.

구 목록은 행정동 코스(*-dong.course.json)에서 온다. 지도가 없는 구도 목록에는 서고 map 이 false 다.
원본 오른쪽 아래의 출처 표기는 자르지 않는다.

    python3 tools/build_crt.py maps/ data/
"""
import json, subprocess, sys, unicodedata
from pathlib import Path

maps_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
SIDE, QUALITY = 960, 55
GRAY = "/System/Library/ColorSync/Profiles/Generic Gray Gamma 2.2 Profile.icc"
KINDS = {"line": "윤곽선 지도", "name": "흑백 지도"}

nfc = lambda s: unicodedata.normalize("NFC", s)


def map_dir(name):
    """'종로구' → maps/종로구-지도, '중구' → maps/서울특별시-중구-지도. 폴더 이름 끝 두 마디로 견준다"""
    for d in maps_dir.iterdir():
        parts = nfc(d.name).split("-")
        if d.is_dir() and len(parts) >= 2 and parts[-1] == "지도" and parts[-2] == name:
            return d


def shrink(src, dst):
    subprocess.run(["sips", "-Z", str(SIDE), "-m", GRAY, "-s", "format", "jpeg", "-s", "formatOptions", str(QUALITY),
                    str(src), "--out", str(dst)], check=True, capture_output=True)
    subprocess.run(["sips", "-d", "profile", str(dst)], check=True, capture_output=True)


(out_dir / "crt").mkdir(exist_ok=True)
districts = []
for f in sorted(out_dir.glob("*-dong.course.json")):
    course = json.loads(f.read_text())
    slug = f.name[: -len("-dong.course.json")]
    name = course["title"].split()[0]
    d = map_dir(name)
    found = {}
    if d:
        for k, label in KINDS.items():
            src = next((p for p in d.iterdir() if nfc(p.name).endswith(" " + label + ".jpg")), None)
            if src:
                shrink(src, out_dir / "crt" / f"{slug}.{k}.jpg")
                found[k] = True
    districts.append({"slug": slug, "name": name, "course": f.stem.replace(".course", ""),
                      "count": len(course["items"]), "map": len(found) == len(KINDS)})
    print(f"{name:6} {'MAP ' if districts[-1]['map'] else '----'} {len(course['items'])}")

districts.sort(key=lambda x: x["name"])
(out_dir / "crt.json").write_text(json.dumps({"credit": "greenblog.co.kr", "districts": districts},
                                             ensure_ascii=False, separators=(",", ":")) + "\n")
