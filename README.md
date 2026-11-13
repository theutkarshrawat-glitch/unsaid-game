# UNSAID

A puzzle of words left behind. The rooms are typewritten words on cream paper. Walls are the word WALL. The door is DOOR. You are ME. You have a few breaths, and you may unsay a word — every object of that word, and every word that contains it, burns off the page.

This is a mobile-first PWA prototype. It runs in the browser, installs to the home screen, and saves progress locally.

**Play:** https://theutkarshrawat-glitch.github.io/unsaid-game/

## How to play

- Swipe, tap a tile to walk there, or turn on the D-pad from the Page menu.
- Tap a word in the room or in the tray, then **Speak**. Speaking spends a breath.
- Saying `ALL` unsays `WALL`. Saying `OR` unsays `DOOR`. Choose carefully.
- Later rooms leave leftover letters behind if those letters still form a word.
- Hints have three tiers (a nudge, a stronger hint, a ghost demonstration). Undo and reset are always free. There are no lives and no paywall.

Eighteen rooms in three parts. After Part 1 the game appears to end. It does not.

## Run locally

Serve the project root over HTTP (the service worker needs a origin):

```bash
python3 -m http.server 8766
```

Then open http://127.0.0.1:8766/

## Verify

```bash
node tools/solve.js
python3 tools/test-mobile.py
python3 tools/shots.py
```

Courier Prime is included under the SIL Open Font License (`fonts/OFL.txt`).
