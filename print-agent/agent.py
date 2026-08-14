"""
Marjona Med Service — Masofaviy Chop Etish Agenti.

Bu dastur shu kompyuterda doim ishlab turadi va serverdan (Vercel'dagi
backend) shu joyga (LOCATION_KEY) tegishli chop etish buyruqlarini olib,
ushbu kompyuterning standart (default) printeriga avtomatik chiqaradi.

Ishlatish: config.ini faylini to'ldiring, so'ng shu faylni ishga tushiring:
    python agent.py

To'xtatish uchun: konsol oynasida Ctrl+C bosing.
"""
import configparser
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.error
import json

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.ini")


def load_config():
    cfg = configparser.ConfigParser()
    if not os.path.exists(CONFIG_PATH):
        print(f"XATO: {CONFIG_PATH} topilmadi. config.ini.example asosida config.ini yarating.")
        sys.exit(1)
    cfg.read(CONFIG_PATH, encoding="utf-8")
    s = cfg["agent"]
    return {
        "api_base": s.get("api_base", "").rstrip("/"),
        "agent_token": s.get("agent_token", ""),
        "location_key": s.get("location_key", ""),
        "poll_seconds": s.getint("poll_seconds", fallback=4),
    }


def http_get(url, headers):
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_patch(url, headers):
    req = urllib.request.Request(url, headers=headers, method="PATCH", data=b"{}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read()


def print_text_content(title: str, content: str) -> bool:
    """Matnni vaqtinchalik faylga yozib, Windows standart printeriga yuboradi."""
    try:
        fd, path = tempfile.mkstemp(suffix=".txt", prefix="mms_print_")
        with os.fdopen(fd, "w", encoding="utf-8-sig") as f:
            f.write(content)

        # notepad /p — faylni standart printerga chiqaradi va avtomatik yopiladi.
        result = subprocess.run(
            ["notepad.exe", "/p", path],
            timeout=60,
            capture_output=True,
        )
        try:
            os.remove(path)
        except OSError:
            pass
        return result.returncode in (0, None)
    except Exception as e:
        print(f"  [XATO] Chop etishda muammo: {e}")
        return False


def main():
    cfg = load_config()
    if not cfg["api_base"] or not cfg["agent_token"] or not cfg["location_key"]:
        print("XATO: config.ini'da api_base, agent_token, location_key to'ldirilishi shart.")
        sys.exit(1)

    print("=" * 60)
    print("Marjona Med Service — Chop etish agenti ishga tushdi")
    print(f"  Manzil (location_key): {cfg['location_key']}")
    print(f"  Server: {cfg['api_base']}")
    print(f"  Tekshirish oralig'i: {cfg['poll_seconds']} soniya")
    print("  To'xtatish uchun: Ctrl+C")
    print("=" * 60)

    headers = {"X-Agent-Token": cfg["agent_token"]}
    poll_url = f"{cfg['api_base']}/api/print-jobs/pending?location_key={cfg['location_key']}"

    while True:
        try:
            jobs = http_get(poll_url, headers)
            for job in jobs:
                print(f"[{job['id']}] '{job['title']}' chop etilmoqda...")
                ok = print_text_content(job["title"], job["content"])
                if ok:
                    mark_url = f"{cfg['api_base']}/api/print-jobs/{job['id']}/mark-printed"
                    try:
                        http_patch(mark_url, headers)
                        print(f"  OK — chop etildi.")
                    except Exception as e:
                        print(f"  [OGOHLANTIRISH] Chop etildi, lekin serverga xabar berilmadi: {e}")
                else:
                    print(f"  [XATO] Chop etib bo'lmadi, keyingi urinishda qayta sinaladi.")
        except urllib.error.URLError as e:
            print(f"[OGOHLANTIRISH] Serverga ulanib bo'lmadi: {e}")
        except Exception as e:
            print(f"[XATO] {e}")

        time.sleep(cfg["poll_seconds"])


if __name__ == "__main__":
    main()
