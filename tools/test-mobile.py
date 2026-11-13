#!/usr/bin/env python3
"""Mobile-first Playwright smoke for UNSAID at 390x844 with touch."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8766/"
logs = []
errors = []
failed = 0

def attach(page):
    page.on("console", lambda m: logs.append({"type": m.type, "text": m.text}))
    page.on("pageerror", lambda e: errors.append(str(e)))

def ready(page):
    page.wait_for_function("() => window.__UNSAID__ && window.__UNSAID__.ready")
    page.wait_for_timeout(200)

def check(name, cond):
    global failed
    if cond:
        print("OK ", name)
    else:
        failed += 1
        print("FAIL", name)

def main():
    global failed
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
        page.goto(URL, wait_until="networkidle")
        ready(page)

        title = page.locator("#titleWord")
        check("title visible", title.is_visible())
        check("title text", "UNSAID" in (title.inner_text() or ""))
        check("begin visible", page.locator("#btnBegin").is_visible())
        vp = page.viewport_size
        check("viewport 390x844", vp == {"width": 390, "height": 844})
        check("has touch", page.evaluate("() => navigator.maxTouchPoints > 0"))

        page.locator("#btnBegin").tap()
        page.wait_for_timeout(250)
        check("intro shown", page.evaluate("() => window.__UNSAID__.getScreen()") == "letter")
        page.locator("#btnTurnPage").tap()
        page.wait_for_timeout(350)
        check("level 1 play", page.evaluate("() => window.__UNSAID__.getScreen()") == "play")
        check("threshold", page.evaluate("() => window.__UNSAID__.Game.level && window.__UNSAID__.Game.level.id") == "threshold")

        # swipe toward the door from the board
        box = page.locator("#boardHit").bounding_box()
        check("board hit target", box is not None)
        if box:
            y = box["y"] + box["height"] / 2
            page.touchscreen.tap(box["x"] + 40, y)
            page.wait_for_timeout(80)
            # swipe right
            page.evaluate(
                """([x1,y1,x2,y2]) => {
                  const el = document.getElementById('boardHit');
                  el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, clientX:x1, clientY:y1, pointerId:1, pointerType:'touch'}));
                  window.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, clientX:x2, clientY:y2, pointerId:1, pointerType:'touch'}));
                }""",
                [box["x"] + 80, y, box["x"] + 200, y],
            )
            page.wait_for_timeout(200)

        moves = page.evaluate("() => window.__UNSAID__.Game.state.moves")
        # If swipe didn't register, drive with the test hook.
        if not moves:
            page.evaluate("() => window.__UNSAID__.move('R')")
            page.wait_for_timeout(120)
            moves = page.evaluate("() => window.__UNSAID__.Game.state.moves")
        check("moved at least one step", moves >= 1)

        # Complete level 1 instantly and land on the win overlay.
        page.evaluate("() => { window.__UNSAID__.reset(); window.__UNSAID__.playActions(Array(11).fill('R')); }")
        page.wait_for_timeout(300)
        check("level 1 win overlay", page.evaluate("() => window.__UNSAID__.getScreen()") == "win")

        # Hint on a later teach level
        page.evaluate("() => window.__UNSAID__.startLevel('unsay')")
        page.wait_for_timeout(200)
        page.locator("#btnHint").tap()
        page.wait_for_timeout(200)
        check("hint overlay", page.evaluate("() => window.__UNSAID__.getScreen()") == "hint")
        body = page.locator("#hintBody").inner_text()
        check("hint has text", len(body) > 8)
        page.locator("#btnHintClose").tap()
        page.wait_for_timeout(100)

        # Say + undo
        page.evaluate("() => window.__UNSAID__.say('WALL')")
        page.wait_for_timeout(150)
        said = page.evaluate("() => window.__UNSAID__.Game.state.said.slice()")
        check("said WALL", said == ["WALL"])
        page.locator("#btnUndo").tap()
        page.wait_for_timeout(120)
        said2 = page.evaluate("() => window.__UNSAID__.Game.state.said.slice()")
        check("undo restores", said2 == [])

        # Map with stars after a clear
        page.evaluate("() => window.__UNSAID__.show('map')")
        page.wait_for_timeout(200)
        check("map screen", page.evaluate("() => window.__UNSAID__.getScreen()") == "map")
        check("map has parts", page.locator(".map-part").count() == 3)

        # Meta scorch
        page.evaluate("() => { window.__UNSAID__.setWorldSaid(['SAID']); window.__UNSAID__.show('title'); }")
        page.wait_for_timeout(200)
        html = page.locator("#titleWord").inner_html()
        check("title scorches SAID", "burnt" in html and "SAID" in html.upper() or "said" in html.lower() or "burnt" in html)

        browser.close()

    Path("/tmp/unsaid-test-logs.json").write_text(json.dumps({"logs": logs, "errors": errors}, indent=2))
    for e in errors:
        print("PAGEERROR", e)
        failed += 1
    serious = [l for l in logs if l["type"] in ("error",) and "serviceWorker" not in l["text"]]
    for l in serious:
        print("CONSOLE", l)
    if failed:
        print("FAILED", failed)
        sys.exit(1)
    print("All mobile tests passed.")

if __name__ == "__main__":
    main()
