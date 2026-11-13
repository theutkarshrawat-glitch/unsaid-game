/**
 * UNSAID — game shell, input, save, flow, hints, meta-scorch.
 */
(function () {
  const SAVE_KEY = 'unsaid-save-v1';
  const Core = window.UnsaidCore;
  const Pack = window.UnsaidLevels;
  const HintBook = window.UnsaidHints;
  const Audio = window.UnsaidAudio;
  const Render = window.UnsaidRender;

  const Game = {
    screen: 'title',
    flowIndex: 0,
    level: null,
    state: null,
    history: [],
    selected: null,
    preview: [],
    worldSaid: [],
    progress: {},
    seenCoaches: {},
    hintUsed: 0,
    muted: false,
    dpad: false,
    mid: null,
    path: null,
    tween: null,
    demo: null,
    toastTimer: 0,
    time: 0,
    lastTick: 0,
    letterKind: null,
    letterBtn: null,
    fromPause: false,
  };

  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function scorchHTML(text, saidList) {
    const src = String(text);
    const marks = new Array(src.length).fill(false);
    const upper = src.toUpperCase();
    (saidList || Game.worldSaid).forEach((w) => {
      if (!w) return;
      const u = String(w).toUpperCase();
      let i = 0;
      while ((i = upper.indexOf(u, i)) !== -1) {
        for (let k = 0; k < u.length; k++) marks[i + k] = true;
        i += Math.max(1, u.length);
      }
    });
    let html = '';
    for (let i = 0; i < src.length; i++) {
      const ch = escapeHtml(src[i]);
      html += marks[i] ? '<span class="burnt">' + ch + '</span>' : ch;
    }
    return html;
  }

  function applyScorch() {
    const title = $('titleWord');
    if (title) title.innerHTML = scorchHTML('UNSAID');
    const pause = $('pauseTitle');
    if (pause) pause.innerHTML = scorchHTML('UNSAID');
    const hint = $('btnHint');
    if (hint) hint.innerHTML = scorchHTML('Hint');
    const kicker = $('hintKicker');
    if (kicker && Game.worldSaid.some((w) => 'HINT'.indexOf(w) >= 0 || w === 'HINT')) {
      kicker.innerHTML = scorchHTML('A hint');
    } else if (kicker) {
      kicker.textContent = 'A hint';
    }
  }

  function rememberWord(word) {
    const w = String(word).toUpperCase();
    if (Game.worldSaid.indexOf(w) < 0) Game.worldSaid.push(w);
    applyScorch();
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1) return;
      Game.flowIndex = data.flowIndex || 0;
      Game.progress = data.progress || {};
      Game.worldSaid = data.worldSaid || [];
      Game.seenCoaches = data.seenCoaches || {};
      Game.muted = !!data.muted;
      Game.dpad = !!data.dpad;
      Game.mid = data.mid || null;
    } catch (e) { /* ignore corrupt save */ }
  }

  function save() {
    try {
      const data = {
        v: 1,
        flowIndex: Game.flowIndex,
        progress: Game.progress,
        worldSaid: Game.worldSaid,
        seenCoaches: Game.seenCoaches,
        muted: Game.muted,
        dpad: Game.dpad,
        mid: Game.mid,
        t: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* quota */ }
  }

  function snapshotMid() {
    if (!Game.level || !Game.state) {
      Game.mid = null;
    } else {
      Game.mid = {
        id: Game.level.id,
        flowIndex: Game.flowIndex,
        state: Core.clone(Game.state),
        history: Game.history.map((h) => Core.clone(h)),
        hintUsed: Game.hintUsed,
      };
    }
    save();
  }

  function toast(msg, ms) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(Game.toastTimer);
    Game.toastTimer = setTimeout(() => el.classList.remove('is-on'), ms || 1600);
  }

  function hideAllScreens() {
    document.querySelectorAll('.screen, .overlay, #playHud, #playDock').forEach((n) => n.classList.remove('is-on'));
    $('coach').classList.remove('is-on');
  }

  function showScreen(name) {
    Game.screen = name;
    hideAllScreens();
    if (name === 'play') {
      $('playHud').classList.add('is-on');
      $('playDock').classList.add('is-on');
      $('muteFab').style.display = 'none';
      layout();
      refreshPlay();
      maybeCoach();
      return;
    }
    const map = {
      title: 'titleScreen',
      letter: 'letterScreen',
      map: 'mapScreen',
      hint: 'hintOverlay',
      win: 'winOverlay',
      pause: 'pauseOverlay',
    };
    const id = map[name];
    if (id) $(id).classList.add('is-on');
    $('muteFab').style.display = (name === 'play' || name === 'hint' || name === 'win') ? 'none' : '';
    if (name === 'title') {
      applyScorch();
      const has = Game.flowIndex > 0 || Game.mid || Object.keys(Game.progress).length;
      $('btnContinue').style.display = has ? '' : 'none';
    }
    if (name === 'map') renderMap();
    if (name === 'pause') {
      applyScorch();
      $('btnToggleDpad').textContent = 'D-pad: ' + (Game.dpad ? 'on' : 'off');
      if ($('btnPauseMute')) $('btnPauseMute').textContent = 'Sound: ' + (Game.muted ? 'off' : 'on');
    }
  }

  function showLetter(kind, item, btnLabel) {
    Game.letterKind = kind;
    Game.letterBtn = item;
    $('letterKicker').textContent = item.kicker || (kind === 'cinematic' ? 'THE END' : kind === 'teaser' ? 'Later' : kind === 'anchor' ? 'A pause' : '');
    $('letterLine').textContent = kind === 'cinematic' ? 'THE END' : (item.line || '');
    $('letterQ').textContent = item.question || '';
    $('btnTurnPage').textContent = btnLabel || 'Turn the page';
    if (kind === 'cinematic') {
      $('letterLine').style.letterSpacing = '0.28em';
      $('letterLine').style.fontSize = '42px';
    } else {
      $('letterLine').style.letterSpacing = '0.08em';
      $('letterLine').style.fontSize = '22px';
    }
    showScreen('letter');
    Audio.page();
  }

  function starsFor(def, says, moves) {
    if (says <= def.parSays && moves <= def.parMoves) return 3;
    if (says <= def.parSays) return 2;
    return 1;
  }

  function starGlyph(n) {
    return '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
  }

  function isUnlocked(id) {
    const all = Pack.LEVELS;
    const idx = all.findIndex((l) => l.id === id);
    if (idx <= 0) return true;
    if (Game.progress[id]) return true;
    const prev = all[idx - 1];
    return !!(prev && Game.progress[prev.id]);
  }

  function renderMap() {
    const root = $('mapList');
    root.innerHTML = '';
    Pack.PARTS.forEach((part) => {
      const wrap = document.createElement('div');
      wrap.className = 'map-part';
      const head = document.createElement('div');
      head.className = 'head';
      head.innerHTML = '<span>' + escapeHtml(part.kicker + ' — ' + part.name) + '</span>';
      wrap.appendChild(head);
      const grid = document.createElement('div');
      grid.className = 'map-grid';
      part.ids.forEach((id) => {
        const def = Pack.getLevel(id);
        const rec = Game.progress[id];
        const open = isUnlocked(id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'map-cell' + (open ? '' : ' is-locked');
        btn.disabled = !open;
        const stars = rec ? starGlyph(rec.stars) : (open ? '☆☆☆' : '');
        btn.innerHTML = escapeHtml(def.name) + '<span class="s">' + stars + '</span>';
        btn.addEventListener('click', () => { if (open) startLevel(id, true); });
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
      root.appendChild(wrap);
    });
  }

  function flowAt(i) {
    return Pack.FLOW[i] || null;
  }

  function playFlow(i) {
    Game.flowIndex = i;
    save();
    const item = flowAt(i);
    if (!item) {
      showLetter('teaser', {
        kicker: 'Later',
        line: 'The rest is still unsaid.',
        question: 'A later page is already being typed.',
      }, 'The Page');
      return;
    }
    if (item.type === 'puzzle') {
      startLevel(item.id, false);
      return;
    }
    if (item.type === 'intro') {
      showLetter('intro', item, 'Turn the page');
      return;
    }
    if (item.type === 'anchor') {
      showLetter('anchor', item, 'Continue');
      return;
    }
    if (item.type === 'cinematic') {
      showLetter('cinematic', { kicker: '', line: 'THE END', question: 'The last word was written.' }, 'Close the book');
      return;
    }
    if (item.type === 'teaser') {
      showLetter('teaser', item, 'The Page');
      return;
    }
  }

  function advanceFlow() {
    playFlow(Game.flowIndex + 1);
  }

  function onTurnPage() {
    Audio.ui();
    Audio.unlock();
    if (Game.letterKind === 'cinematic' && $('btnTurnPage').textContent === 'Close the book') {
      $('letterLine').innerHTML = 'THE <span class="burnt">END</span>';
      $('letterQ').textContent = 'Or so it seemed. The page was not finished.';
      $('btnTurnPage').textContent = 'Turn the page';
      rememberWord('END');
      Audio.say();
      return;
    }
    if (Game.letterKind === 'teaser') {
      showScreen('map');
      return;
    }
    advanceFlow();
  }

  function startLevel(id, fromMap) {
    const def = Pack.getLevel(id);
    if (!def) return;
    const parsed = Core.parseLevel(def);
    // keep metadata
    parsed.id = def.id;
    parsed.name = def.name;
    parsed.part = def.part;
    parsed.parSays = def.parSays;
    parsed.parMoves = def.parMoves;
    parsed.breaths = def.breaths;
    parsed.vocab = (def.vocab || []).slice();
    parsed.teach = def.teach;
    parsed.title = def.title;
    parsed.hint = def.hint;
    parsed.story = def.story;
    parsed.recombine = !!def.recombine;
    parsed.meta = !!def.meta;
    Game.level = parsed;
    Game.state = Core.createState(parsed);
    Game.history = [];
    Game.selected = null;
    Game.preview = [];
    Game.hintUsed = 0;
    Game.path = null;
    Game.tween = null;
    Game.demo = null;
    Game.fromPause = false;
    if (fromMap) {
      const idx = Pack.FLOW.findIndex((f) => f.type === 'puzzle' && f.id === id);
      if (idx >= 0) Game.flowIndex = idx;
    }
    snapshotMid();
    showScreen('play');
  }

  function resumeMid() {
    if (!Game.mid || !Game.mid.id) return false;
    startLevel(Game.mid.id, false);
    Game.flowIndex = Game.mid.flowIndex || Game.flowIndex;
    Game.state = Core.clone(Game.mid.state);
    Game.history = (Game.mid.history || []).map((h) => Core.clone(h));
    Game.hintUsed = Game.mid.hintUsed || 0;
    showScreen('play');
    return true;
  }

  function pushHist() {
    Game.history.push(Core.clone(Game.state));
    if (Game.history.length > 80) Game.history.shift();
  }

  function tryMove(dir) {
    if (Game.screen !== 'play' || Game.demo) return false;
    if (Game.tween) return false;
    const res = Core.applyMove(Game.level, Game.state, dir);
    if (!res.ok) {
      if (res.reason === 'water') {
        Audio.water();
        toast('The water still holds that place.');
      } else {
        Audio.bump();
      }
      return false;
    }
    pushHist();
    const from = { x: Game.state.x, y: Game.state.y };
    Game.state = res.state;
    Game.tween = { from, to: { x: Game.state.x, y: Game.state.y }, t: 0, dur: 90 };
    Audio.move();
    snapshotMid();
    if (Core.isWon(Game.level, Game.state)) {
      Game.tween.onDone = onWin;
    }
    refreshPlay();
    return true;
  }

  function findPath(tx, ty) {
    const level = Game.level;
    const state = Game.state;
    if (!Core.canEnter(level, state, tx, ty) && !(state.x === tx && state.y === ty)) return null;
    const key = (x, y) => x + ',' + y;
    const q = [{ x: state.x, y: state.y }];
    const prev = new Map();
    prev.set(key(state.x, state.y), null);
    while (q.length) {
      const n = q.shift();
      if (n.x === tx && n.y === ty) {
        const path = [];
        let cur = n;
        while (prev.get(key(cur.x, cur.y))) {
          path.push(cur);
          cur = prev.get(key(cur.x, cur.y));
        }
        path.reverse();
        return path;
      }
      Core.DIR_LIST.forEach((d) => {
        const v = Core.DIRS[d];
        const x = n.x + v.x, y = n.y + v.y;
        if (prev.has(key(x, y))) return;
        if (!Core.canEnter(level, state, x, y)) return;
        prev.set(key(x, y), n);
        q.push({ x, y });
      });
    }
    return null;
  }

  function wordAt(x, y) {
    return (Game.state && Game.state.grid[y] && Game.state.grid[y][x]) || '';
  }

  function vocabHits(word) {
    if (!word || !Game.level) return [];
    return Game.level.vocab.filter((v) => Game.state.said.indexOf(v) < 0 && Core.containsWord(word, v));
  }

  function selectWord(word) {
    if (!word || !Game.level) return;
    const w = String(word).toUpperCase();
    if (Game.level.vocab.indexOf(w) < 0) {
      toast('That word cannot be said here.');
      Audio.fail();
      return;
    }
    if (Game.state.said.indexOf(w) >= 0) {
      toast('Already unsaid.');
      return;
    }
    if (Game.state.breaths <= 0) {
      toast('No breaths left. Undo, or reset the page.');
      Audio.fail();
      return;
    }
    Game.selected = w;
    Game.preview = Core.affectedCells(Game.level, Game.state, w);
    refreshPlay();
    Audio.ui();
  }

  function cancelSay() {
    Game.selected = null;
    Game.preview = [];
    refreshPlay();
  }

  function confirmSay() {
    if (!Game.selected || Game.demo) return;
    const res = Core.applySay(Game.level, Game.state, Game.selected);
    if (!res.ok) {
      toast({ 'no-breath': 'No breaths left.', 'already-said': 'Already unsaid.', 'not-in-vocab': 'That word cannot be said here.' }[res.reason] || 'It will not be said.');
      Audio.fail();
      return;
    }
    pushHist();
    Game.state = res.state;
    rememberWord(Game.selected);
    Audio.say();
    res.affected.forEach((c) => {
      const p = Render.cellCenter(c.x, c.y);
      Render.burst(p.x, p.y, Math.random() < 0.55 ? '#e25822' : '#1a140e', 22, 70);
      Render.scorchAt(c.x, c.y);
      if (c.leftover) {
        toast('What remains is ' + c.leftover + '.', 1800);
      }
    });
    if (!res.affected.length) toast('Nothing on the page held that word.');
    Game.selected = null;
    Game.preview = [];
    snapshotMid();
    refreshPlay();
    if (Core.isWon(Game.level, Game.state)) onWin();
  }

  function undo() {
    if (Game.demo) return;
    if (!Game.history.length) {
      toast('Nothing to unsay of your last act.');
      return;
    }
    Game.state = Game.history.pop();
    Game.selected = null;
    Game.preview = [];
    Game.path = null;
    Game.tween = null;
    Audio.ui();
    snapshotMid();
    refreshPlay();
  }

  function resetLevel() {
    if (Game.demo) stopDemo(true);
    if (!Game.level) return;
    Game.state = Core.createState(Game.level);
    Game.history = [];
    Game.selected = null;
    Game.preview = [];
    Game.path = null;
    Game.tween = null;
    Audio.ui();
    snapshotMid();
    refreshPlay();
    toast('The page is written again.');
  }

  function onWin() {
    if (Game.screen === 'win') return;
    const def = Pack.getLevel(Game.level.id);
    const says = Game.state.says;
    const moves = Game.state.moves;
    const stars = starsFor(def, says, moves);
    const prev = Game.progress[def.id];
    const best = {
      stars: Math.max(stars, prev && prev.stars ? prev.stars : 0),
      says: prev ? Math.min(prev.says, says) : says,
      moves: prev ? Math.min(prev.moves, moves) : moves,
    };
    Game.progress[def.id] = best;
    Game.mid = null;
    save();
    Audio.win();
    $('winStars').textContent = starGlyph(stars);
    const lines = [];
    if (stars === 3) lines.push('Said in as few words as the page required.');
    else if (stars === 2) lines.push('The right words, if not the fewest steps.');
    else lines.push('The door opened.');
    lines.push(says + ' said · ' + moves + ' steps  ·  par ' + def.parSays + ' / ' + def.parMoves);
    $('winLine').textContent = lines.join(' ');
    showScreen('win');
  }

  function refreshPlay() {
    if (!Game.level || !Game.state) return;
    const part = Pack.getPart(Game.level.part);
    $('hudPart').textContent = part ? part.kicker : 'Part';
    $('hudName').textContent = Game.level.name;
    $('hudBreaths').textContent = 'breaths ' + Game.state.breaths;
    $('playTitle').textContent = Game.level.title || '';
    const row = $('vocabRow');
    row.innerHTML = '';
    (Game.level.vocab || []).forEach((w) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = w;
      if (Game.state.said.indexOf(w) >= 0) b.classList.add('is-used');
      if (Game.selected === w) b.classList.add('is-picked');
      b.addEventListener('click', () => selectWord(w));
      row.appendChild(b);
    });
    if (!Game.level.vocab.length) {
      const s = document.createElement('span');
      s.style.fontSize = '11px';
      s.style.letterSpacing = '0.08em';
      s.style.color = 'rgba(26,20,14,0.45)';
      s.textContent = 'Nothing here needs to be said.';
      row.appendChild(s);
    }
    const conf = $('confirmRow');
    if (Game.selected) {
      conf.classList.add('is-on');
      const n = Game.preview.length;
      const names = Array.from(new Set(Game.preview.map((c) => c.word)));
      $('confirmAsk').textContent = n
        ? 'Speak ' + Game.selected + '? It unsays ' + names.join(', ') + '.'
        : 'Speak ' + Game.selected + '? Nothing holds it.';
    } else {
      conf.classList.remove('is-on');
    }
    $('dpad').classList.toggle('is-on', !!Game.dpad);
    applyScorch();
    layout();
  }

  function maybeCoach() {
    if (!Game.level) return;
    const teach = Game.level.teach;
    if (!teach || Game.seenCoaches[teach]) return;
    const lines = {
      move: 'Swipe toward the door, or tap the word DOOR.',
      say: 'Tap the word WALL — on the page or in the tray — then Speak.',
      substring: 'WALL holds the word ALL. Saying ALL unsays every WALL.',
      trap: 'One of these words will also unsay the door. Choose carefully.',
      recombine: 'Sometimes leftover letters still make a word you can walk through.',
      'meta-hint': 'The button you press for help is also a word on the page.',
      'meta-title': 'The name of the game is a word too. SAID lives inside UNSAID.',
    };
    const text = lines[teach];
    if (!text) return;
    $('coachText').textContent = text;
    $('coach').classList.add('is-on');
  }

  function dismissCoach() {
    if (Game.level && Game.level.teach) {
      Game.seenCoaches[Game.level.teach] = true;
      save();
    }
    $('coach').classList.remove('is-on');
  }

  function openHint() {
    const book = HintBook.getHints(Game.level.id);
    if (!book) { toast('There is nothing more to say.'); return; }
    Game.hintUsed = Math.max(Game.hintUsed, 1);
    const tier = Math.min(Game.hintUsed, 3);
    $('hintBody').textContent = book.tiers[tier - 1];
    $('btnHintMore').style.display = tier < 2 ? '' : 'none';
    $('btnHintDemo').style.display = tier >= 2 || Game.hintUsed >= 2 ? '' : 'none';
    if (tier === 1) {
      $('btnHintMore').textContent = 'A stronger hint';
      $('btnHintDemo').style.display = 'none';
    }
    if (tier >= 2) {
      $('btnHintMore').style.display = Game.hintUsed < 3 ? '' : 'none';
      $('btnHintMore').textContent = 'Show me';
    }
    showScreen('hint');
    save();
  }

  function strongerHint() {
    const book = HintBook.getHints(Game.level.id);
    Game.hintUsed = Math.min(3, Game.hintUsed + 1);
    const tier = Math.min(Game.hintUsed, 3);
    $('hintBody').textContent = book.tiers[tier - 1];
    if (tier >= 2) {
      $('btnHintMore').style.display = 'none';
      $('btnHintDemo').style.display = '';
    }
    if (tier >= 3) startDemo();
  }

  function startDemo() {
    const book = HintBook.getHints(Game.level.id);
    if (!book || !book.solution) return;
    Game.hintUsed = 3;
    const snap = {
      state: Core.clone(Game.state),
      history: Game.history.map((h) => Core.clone(h)),
    };
    Game.state = Core.createState(Game.level);
    Game.history = [];
    Game.selected = null;
    Game.preview = [];
    Game.demo = { actions: book.solution.slice(), i: 0, snap, wait: 350 };
    showScreen('play');
    toast('Watch.', 800);
  }

  function stopDemo(restore) {
    if (!Game.demo) return;
    if (restore && Game.demo.snap) {
      Game.state = Game.demo.snap.state;
      Game.history = Game.demo.snap.history;
    }
    Game.demo = null;
    Game.tween = null;
    refreshPlay();
  }

  function tickDemo(dt) {
    const d = Game.demo;
    if (!d) return;
    if (Game.tween) return;
    d.wait -= dt;
    if (d.wait > 0) return;
    if (d.i >= d.actions.length) {
      const end = d.snap;
      Game.demo = null;
      setTimeout(() => {
        if (end) {
          Game.state = end.state;
          Game.history = end.history;
        }
        refreshPlay();
        toast('The page is yours again.');
      }, 700);
      return;
    }
    const a = d.actions[d.i++];
    if (String(a).indexOf('SAY:') === 0) {
      const word = String(a).slice(4);
      const res = Core.applySay(Game.level, Game.state, word);
      if (res.ok) {
        Game.state = res.state;
        rememberWord(word);
        Audio.say();
        res.affected.forEach((c) => {
          const p = Render.cellCenter(c.x, c.y);
          Render.burst(p.x, p.y, '#e25822', 18, 60);
          Render.scorchAt(c.x, c.y);
        });
        Game.preview = [];
      }
      d.wait = 520;
      refreshPlay();
    } else {
      const from = { x: Game.state.x, y: Game.state.y };
      const res = Core.applyMove(Game.level, Game.state, a);
      if (res.ok) {
        Game.state = res.state;
        Game.tween = { from, to: { x: Game.state.x, y: Game.state.y }, t: 0, dur: 80 };
        Audio.move();
      }
      d.wait = 160;
    }
  }

  function cameraPos() {
    const tw = playerDraw && Game.tween ? playerDraw() : null;
    if (tw) return tw;
    if (Game.state) return { x: Game.state.x, y: Game.state.y };
    return { x: 0, y: 0 };
  }

  function layout() {
    const app = $('app');
    const w = app.clientWidth;
    const h = app.clientHeight;
    if (w !== Render.w || h !== Render.h) Render.resize(w, h);
    if (Game.level) {
      const dock = 148 + (Game.dpad ? 88 : 0);
      const top = 70;
      Render.layout(Game.level, { x: 8, y: top, w: w - 16, h: Math.max(80, h - top - dock) }, cameraPos());
    }
  }

  function playerDraw() {
    if (!Game.tween) return null;
    const t = Math.min(1, Game.tween.t / Game.tween.dur);
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    return {
      x: Game.tween.from.x + (Game.tween.to.x - Game.tween.from.x) * e,
      y: Game.tween.from.y + (Game.tween.to.y - Game.tween.from.y) * e,
    };
  }

  function frame(now) {
    const dt = Math.min(40, now - (Game.lastTick || now));
    Game.lastTick = now;
    Game.time = now;
    if (Game.tween) {
      Game.tween.t += dt;
      if (Game.tween.t >= Game.tween.dur) {
        const done = Game.tween.onDone;
        Game.tween = null;
        if (Game.path && Game.path.length && Game.screen === 'play') {
          const step = Game.path.shift();
          const dx = step.x - Game.state.x;
          const dy = step.y - Game.state.y;
          const dir = dx === 1 ? 'R' : dx === -1 ? 'L' : dy === 1 ? 'D' : 'U';
          if (!tryMove(dir) || !Game.path.length) Game.path = null;
        } else if (done) {
          done();
        }
      }
    }
    if (Game.demo) tickDemo(dt);
    if (Game.level && (Game.screen === 'play' || Game.screen === 'hint' || Game.screen === 'pause' || Game.screen === 'win')) layout();
    Render.tickParticles(dt);
    const preview = Game.selected ? Game.preview : [];
    Render.draw({
      level: Game.screen === 'play' || Game.screen === 'hint' || Game.screen === 'pause' || Game.screen === 'win' ? Game.level : null,
      state: Game.state,
      preview,
      playerDraw: playerDraw(),
      pathDots: Game.path,
      demoDraw: Game.demo ? { x: Game.state.x, y: Game.state.y } : null,
      time: now,
    });
    requestAnimationFrame(frame);
  }

  // Input
  const swipe = { x: 0, y: 0, on: false, sx: 0, sy: 0 };

  function onPointerDown(e) {
    Audio.unlock();
    if (Game.screen !== 'play' || Game.demo) return;
    swipe.on = true;
    swipe.x = e.clientX;
    swipe.y = e.clientY;
    swipe.sx = e.clientX;
    swipe.sy = e.clientY;
  }
  function onPointerMove(e) {
    if (!swipe.on) return;
    swipe.x = e.clientX;
    swipe.y = e.clientY;
  }
  function onPointerUp(e) {
    if (!swipe.on) return;
    swipe.on = false;
    if (Game.screen !== 'play' || Game.demo) return;
    const dx = (e.clientX || swipe.x) - swipe.sx;
    const dy = (e.clientY || swipe.y) - swipe.sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 28) {
      Game.path = null;
      if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 'R' : 'L');
      else tryMove(dy > 0 ? 'D' : 'U');
      return;
    }
    const g = Render.screenToGrid(e.clientX, e.clientY, Game.level);
    if (!g) return;
    const word = wordAt(g.x, g.y);
    const hits = vocabHits(word);
    if (hits.length && !(g.x === Game.state.x && g.y === Game.state.y)) {
      selectWord(hits[0]);
      return;
    }
    if (g.x === Game.state.x && g.y === Game.state.y) return;
    const path = findPath(g.x, g.y);
    if (path && path.length) {
      Game.path = path;
      const step = Game.path.shift();
      const ddx = step.x - Game.state.x;
      const ddy = step.y - Game.state.y;
      const dir = ddx === 1 ? 'R' : ddx === -1 ? 'L' : ddy === 1 ? 'D' : 'U';
      tryMove(dir);
    } else if (word) {
      const maybe = vocabHits(word);
      if (maybe.length) selectWord(maybe[0]);
      else toast('There is no path to that word.');
    }
  }

  function onKey(e) {
    Audio.unlock();
    const k = e.key;
    if (k === 'm' || k === 'M') {
      toggleMute();
      return;
    }
    if (Game.screen === 'letter' && (k === 'Enter' || k === ' ')) { onTurnPage(); return; }
    if (Game.screen === 'win' && (k === 'Enter' || k === ' ')) { $('btnNext').click(); return; }
    if (Game.screen === 'play') {
      if (k === 'ArrowUp' || k === 'w') { e.preventDefault(); tryMove('U'); }
      else if (k === 'ArrowDown' || k === 's') { e.preventDefault(); tryMove('D'); }
      else if (k === 'ArrowLeft' || k === 'a') { e.preventDefault(); tryMove('L'); }
      else if (k === 'ArrowRight' || k === 'd') { e.preventDefault(); tryMove('R'); }
      else if (k === 'z' || k === 'Z' || k === 'Backspace') undo();
      else if (k === 'r' || k === 'R') resetLevel();
      else if (k === 'Enter' && Game.selected) confirmSay();
      else if (k === 'Escape') { if (Game.selected) cancelSay(); else showScreen('pause'); }
    } else if (k === 'Escape' && Game.screen === 'pause') {
      showScreen('play');
    }
  }

  function toggleMute() {
    Audio.unlock();
    Game.muted = Audio.toggleMute();
    $('muteFab').textContent = Game.muted ? 'MUTED' : 'SOUND';
    save();
  }

  function continueGame() {
    Audio.unlock();
    Audio.logo();
    if (Game.mid && Game.mid.id) {
      resumeMid();
      return;
    }
    playFlow(Game.flowIndex || 0);
  }

  function beginGame() {
    Audio.unlock();
    Audio.logo();
    playFlow(0);
  }

  function bind() {
    $('btnContinue').addEventListener('click', continueGame);
    $('btnBegin').addEventListener('click', beginGame);
    $('btnMap').addEventListener('click', () => { Audio.unlock(); Audio.ui(); showScreen('map'); });
    $('btnMapBack').addEventListener('click', () => {
      if (Game.level && Game.state && Game.mid) showScreen('play');
      else showScreen('title');
    });
    $('btnTurnPage').addEventListener('click', onTurnPage);
    $('btnSpeak').addEventListener('click', confirmSay);
    $('btnCancelSay').addEventListener('click', cancelSay);
    $('btnHint').addEventListener('click', () => { Audio.unlock(); Audio.ui(); openHint(); });
    $('btnHintClose').addEventListener('click', () => showScreen('play'));
    $('btnHintMore').addEventListener('click', strongerHint);
    $('btnHintDemo').addEventListener('click', startDemo);
    $('btnUndo').addEventListener('click', undo);
    $('btnReset').addEventListener('click', resetLevel);
    $('btnPause').addEventListener('click', () => { Audio.ui(); showScreen('pause'); });
    $('btnResume').addEventListener('click', () => showScreen('play'));
    $('btnPauseMap').addEventListener('click', () => showScreen('map'));
    $('btnWinMap').addEventListener('click', () => showScreen('map'));
    $('btnTitle').addEventListener('click', () => { snapshotMid(); showScreen('title'); });
    $('btnPauseMute').addEventListener('click', () => { toggleMute(); $('btnPauseMute').textContent = 'Sound: ' + (Game.muted ? 'off' : 'on'); });
    $('btnToggleDpad').addEventListener('click', () => {
      Game.dpad = !Game.dpad;
      $('btnToggleDpad').textContent = 'D-pad: ' + (Game.dpad ? 'on' : 'off');
      save();
      showScreen('play');
    });
    $('btnNext').addEventListener('click', () => { Audio.ui(); advanceFlow(); });
    $('btnCoachOk').addEventListener('click', dismissCoach);
    $('muteFab').addEventListener('click', toggleMute);
    document.querySelectorAll('#dpad button').forEach((b) => {
      b.addEventListener('click', () => tryMove(b.getAttribute('data-dir')));
    });

    const hit = $('boardHit');
    hit.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', () => { swipe.on = false; });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', () => setTimeout(layout, 80));
  }

  function boot() {
    load();
    Audio.setMuted(Game.muted);
    $('muteFab').textContent = Game.muted ? 'MUTED' : 'SOUND';
    Render.init($('paper'));
    bind();
    applyScorch();
    showScreen('title');
    layout();
    requestAnimationFrame(frame);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* offline ok */ });
    }
    // first-tap logo if they land and tap the title
    $('titleScreen').addEventListener('pointerdown', () => Audio.unlock(), { once: true });
  }


  function applyInstant(actions) {
    if (!Game.level) return { ok: false, reason: 'no-level' };
    Game.tween = null;
    Game.path = null;
    Game.demo = null;
    for (const a of actions) {
      let res;
      if (String(a).indexOf('SAY:') === 0) {
        const word = String(a).slice(4);
        res = Core.applySay(Game.level, Game.state, word);
        if (res.ok) {
          Game.state = res.state;
          rememberWord(word);
          res.affected.forEach((c) => {
            const pt = Render.cellCenter(c.x, c.y);
            Render.burst(pt.x, pt.y, '#e25822', 22, 70);
            Render.scorchAt(c.x, c.y);
          });
        }
      } else {
        res = Core.applyMove(Game.level, Game.state, a);
        if (res.ok) Game.state = res.state;
      }
      if (!res.ok) return { ok: false, failedAt: a, reason: res.reason, state: Game.state };
    }
    Game.selected = null;
    Game.preview = [];
    refreshPlay();
    const won = Core.isWon(Game.level, Game.state);
    if (won) onWin();
    return { ok: true, won, state: Game.state };
  }

  window.UnsaidGame = Game;
  window.__UNSAID__ = {
    ready: true,
    Game,
    getScreen() { return Game.screen; },
    startLevel(id) { startLevel(id, true); },
    say(word) { selectWord(word); confirmSay(); },
    playActions: applyInstant,
    move(dir) { return tryMove(dir); },
    reset: resetLevel,
    undo,
    show: showScreen,
    playFlow,
    advanceFlow,
    setWorldSaid(arr) { Game.worldSaid = arr.slice(); applyScorch(); save(); },
    applyScorch,
    starsFor,
    save, load,
    Core, Pack,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
