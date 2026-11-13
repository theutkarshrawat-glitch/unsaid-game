#!/usr/bin/env python3
"""Capture required UNSAID screenshots at 390x844."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path("/workspace/game/unsaid/shots")
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://127.0.0.1:8766/"
logs = []

def attach(page):
    page.on("console", lambda m: logs.append({"type": m.type, "text": m.text}))
    page.on("pageerror", lambda e: logs.append({"type": "pageerror", "text": str(e)}))

def ready(page):
    page.wait_for_function("() => window.__UNSAID__ && window.__UNSAID__.ready")
    page.wait_for_function("() => document.fonts && document.fonts.status === 'loaded' || true")
    page.wait_for_timeout(500)

def dismiss_coach(page):
    page.evaluate("""() => {
      const b = document.getElementById('btnCoachOk');
      if (b) b.click();
    }""")
    page.wait_for_timeout(80)


def boot(page):
    page.goto(URL, wait_until="networkidle")
    ready(page)
    page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
    page.reload(wait_until="networkidle")
    ready(page)

with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="chrome",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
        headless=True,
    )
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    page = context.new_page()
    attach(page)
    boot(page)

    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / "01-title.png"), full_page=False)
    print("wrote 01-title.png")

    page.evaluate("() => window.__UNSAID__.startLevel('threshold')")
    page.wait_for_timeout(250)
    dismiss_coach(page)
    page.wait_for_timeout(250)
    page.screenshot(path=str(OUT / "02-level-1.png"), full_page=False)
    print("wrote 02-level-1.png")

    page.evaluate("() => window.__UNSAID__.startLevel('unsay')")
    page.wait_for_timeout(200)
    dismiss_coach(page)
    page.evaluate("() => window.__UNSAID__.playActions(['R','R','R','R','R','SAY:WALL'])")
    page.wait_for_timeout(220)
    page.screenshot(path=str(OUT / "03-say-burn.png"), full_page=False)
    print("wrote 03-say-burn.png")

    page.evaluate("() => window.__UNSAID__.startLevel('inside')")
    page.wait_for_timeout(200)
    dismiss_coach(page)
    page.evaluate("""() => {
      window.__UNSAID__.playActions(['R','R','R','R','R']);
      const chip = [...document.querySelectorAll('#vocabRow .chip')].find(b => b.textContent === 'ALL');
      if (chip) chip.click();
    }""")
    page.wait_for_timeout(280)
    page.screenshot(path=str(OUT / "04-substring.png"), full_page=False)
    print("wrote 04-substring.png")

    # Unlock a couple of rooms so the map has stars
    page.evaluate(
        """() => {
          const U = window.__UNSAID__;
          U.startLevel('threshold');
          U.playActions(Array(11).fill('R'));
        }"""
    )
    page.wait_for_timeout(200)
    page.evaluate("() => window.__UNSAID__.show('map')")
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / "05-map.png"), full_page=False)
    print("wrote 05-map.png")

    page.evaluate(
        """() => {
          const U = window.__UNSAID__;
          U.startLevel('spoken');
          U.playActions(['R','R','R','R','SAY:SAID']);
          U.setWorldSaid(['SAID','HINT']);
          U.show('title');
        }"""
    )
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / "06-menu-deletion.png"), full_page=False)
    print("wrote 06-menu-deletion.png")

    # Extra: play screen with HINT button scorched, for clarity
    page.evaluate("() => window.__UNSAID__.startLevel('hinted')")
    page.wait_for_timeout(200)
    dismiss_coach(page)
    page.evaluate("""() => {
      const U = window.__UNSAID__;
      U.setWorldSaid(['SAID','HINT']);
      U.say('HINT');
    }""")
    page.wait_for_timeout(240)
    page.screenshot(path=str(OUT / "06b-hint-scorch.png"), full_page=False)
    print("wrote 06b-hint-scorch.png")

    browser.close()

Path("/tmp/unsaid-shot-logs.json").write_text(json.dumps(logs, indent=2))
print("screenshots written to", OUT)
for row in logs:
    if row["type"] in ("error", "pageerror", "warning"):
        print(f"[{row['type']}] {row['text']}")
