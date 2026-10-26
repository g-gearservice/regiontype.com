"""Seedance 2.5 text-to-video via the Higgsfield SDK. Run: .venv/bin/python main.py

Credentials: HF_KEY="key-id:key-secret" in .env.local (gitignored). Server-side only.
"""
import sys
from pathlib import Path

import higgsfield_client
from dotenv import load_dotenv
from higgsfield_client import Cancelled, Completed, Failed, NSFW

load_dotenv(Path(__file__).with_name(".env.local"))

last = None


def on_update(status):
    global last
    last = status
    print(type(status).__name__, flush=True)


try:
    result = higgsfield_client.subscribe(
        "bytedance/seedance-2.5/text-to-video",
        arguments={
            "prompt": "A cinematic scene at sunset",
            "duration": 5,
            "resolution": "720p",
            "aspect_ratio": "16:9",
        },
        on_queue_update=on_update,
    )
except Exception as e:  # CredentialsMissedError, HiggsfieldClientError, network
    sys.exit(f"Request error: {type(e).__name__}: {e}")

# subscribe() does not raise on terminal non-success states; check explicitly.
if isinstance(last, (Failed, NSFW, Cancelled)):
    sys.exit(f"No video: request ended as {type(last).__name__} (not a success).")
url = (result.get("video") or {}).get("url") if isinstance(result, dict) else None
if not isinstance(last, Completed) or not url:
    sys.exit(f"No video URL; last status={last!r}, result keys={list(result) if isinstance(result, dict) else type(result)}")
print(url)
