"""리전 패스 몸 마감의 질감 그림 — 힉스필드 API 로 뽑아 assets/bloub/fin/<id>.jpg 로 찍는다.

질감이 맛인 마감(야경·노을·금박·홀로)만 그림이다. 몸 위에 한 장을 깔 뿐이라 색칠도 늘이기도 없다.
API 를 부르는 데 돈이 들고 결과가 매번 다르므로 한 번 찍고 그림을 커밋한다 — 다시 돌리면 다른 그림이 나온다.
고칠 마감만 고르려면 id 를 뒤에 적는다. 열쇠는 ~/.config/higgsfield/.env 의 HF_KEY(·HF_API_SECRET). macOS sips 로 줄인다.

    python3 tools/build_finish_tex.py assets/bloub/fin [night gold …]
"""
import json, os, subprocess, sys, time, urllib.request
from pathlib import Path

MODEL = "higgsfield-ai/soul/v2/standard"
SIZE = 512  # 봇은 커 봐야 180px 남짓이다 — 레티나 두 배에 여유를 둔다
TAIL = ", full-bleed texture filling the whole frame, no text, no logos, no people, no border, high detail"
PROMPTS = {
    "night": "bright long-exposure aerial night photograph of Seoul, extremely dense glowing golden and white city lights "
             "covering most of the frame, vivid light trails on boulevards, the Han river with brightly lit bridges, "
             "indigo blue glow between the lights, luminous and vibrant",
    "dusk": "Han river at sunset seen from above, water reflecting a warm gradient of golden orange, coral pink and violet sky, "
            "soft shimmering ripples, dreamy",
    "gold": "crumpled gold leaf foil sheet macro, rich warm metallic gold with bright specular highlights and deep amber folds",
    "holo": "holographic iridescent foil macro, smooth flowing rainbow of cyan, violet, pink and pale yellow, "
            "pearlescent sheen, soft folds",
    "hanji": "Korean hanji mulberry paper close-up, warm ivory with visible long plant fibres and soft translucent flecks, "
             "gentle natural light",
    "giwa": "traditional Korean palace roof tiles giwa seen from above, neat curved rows of dark charcoal grey clay tiles "
            "with round end caps, soft daylight",
    "blossom": "cherry blossom petals densely covering the frame, Yeouido spring, soft pink and white petals, "
               "pastel, dreamy light",
    "celadon": "Goryeo celadon glaze close-up, jade green crackled glaze with inlaid white cranes and clouds pattern, "
               "glossy ceramic",
    "dancheong": "Korean dancheong painted palace eaves pattern, vivid malachite green, cinnabar red, blue and yellow "
                 "lotus and geometric motifs, symmetric ornate",
    "maple": "autumn maple leaves on Namsan densely covering the frame, crimson, scarlet, orange and gold leaves, "
             "rich warm colours",
    "neon": "Seoul night street neon signs bokeh, glowing pink, cyan, violet and amber neon lights blurred, "
            "rainy reflections, vibrant",
    "najeon": "Korean najeon mother-of-pearl inlay on black lacquer, iridescent abalone shell pieces forming "
              "flowing floral and vine patterns, shimmering",
}

env = dict(l.strip().split("=", 1) for l in open(Path.home() / ".config/higgsfield/.env") if "=" in l)
auth = env["HF_KEY"] if ":" in env["HF_KEY"] else f'{env["HF_KEY"]}:{env["HF_API_SECRET"]}'


def call(url, body=None):
    req = urllib.request.Request(url, data=body and json.dumps(body).encode(), method="POST" if body else "GET",
                                 headers={"Authorization": "Key " + auth, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


dst = Path(sys.argv[1]); dst.mkdir(parents=True, exist_ok=True)
pick = sys.argv[2:] or list(PROMPTS)
jobs = {k: call(f"https://api.higgsfield.ai/{MODEL}", {"prompt": PROMPTS[k] + TAIL, "aspect_ratio": "1:1"})["status_url"] for k in pick}
for k, status in jobs.items():
    for _ in range(90):
        r = call(status)
        if r["status"] in ("completed", "failed", "nsfw"):
            break
        time.sleep(4)
    if r["status"] != "completed":
        sys.exit(f"{k}: {r['status']}")
    raw = dst / f"{k}.png"
    urllib.request.urlretrieve(r["images"][0]["url"], raw)
    subprocess.run(["sips", "-Z", str(SIZE), "-s", "format", "jpeg", "-s", "formatOptions", "82",
                    str(raw), "--out", str(dst / f"{k}.jpg")], check=True, capture_output=True)
    raw.unlink()
    print(k, "→", dst / f"{k}.jpg", os.path.getsize(dst / f"{k}.jpg") // 1024, "KB")
