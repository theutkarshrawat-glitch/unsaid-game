/**
 * UNSAID simulation core — shared by the game and the Node solver.
 * No DOM. Deterministic.
 *
 * Saying a word W removes every tile whose text equals W or contains W
 * as a contiguous substring. If a level has recombine, a leftover that is
 * itself a known word (length >= 2) stays behind (DOORWAY - WAY = DOOR).
 *
 * Out-of-bounds is solid paper, not a word, so it cannot be unsaid.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UnsaidCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DIRS = {
    U: { x: 0, y: -1 },
    D: { x: 0, y: 1 },
    L: { x: -1, y: 0 },
    R: { x: 1, y: 0 },
  };
  const DIR_LIST = ['U', 'D', 'L', 'R'];

  const GLYPHS = {
    '#': 'WALL',
    '+': 'PAGE',
    '.': '',
    ' ': '',
    '@': '',
    'E': 'DOOR',
    'L': 'LOCK',
    'K': 'KEY',
    'W': 'WATER',
    'B': 'BRIDGE',
    'R': 'ROCK',
    'A': 'DARK',
    'I': 'LIGHT',
    'U': 'UNLOCK',
    'Y': 'DOORWAY',
    'H': 'HINT',
    'S': 'SAID',
    'N': 'UNSAID',
    'P': 'PAGE',
    'T': 'LATER',
    'O': 'BLOCK',
    'C': 'CLOCK',
    'G': 'BRIDGE',
  };

  const SOLID = new Set(['WALL', 'LOCK', 'UNLOCK', 'DARK', 'UNSAID', 'PAGE', 'BLOCK', 'CLOCK', 'HINT', 'SAID']);
  const EXIT = new Set(['DOOR', 'LATER']);
  const DEADLY = new Set(['WATER']);
  const PICKUP = new Set(['KEY']);

  const KNOWN = new Set([
    'WALL', 'DOOR', 'LOCK', 'KEY', 'WATER', 'BRIDGE', 'ROCK', 'LIGHT', 'DARK',
    'HINT', 'SAID', 'UNSAID', 'UNLOCK', 'DOORWAY', 'PAGE', 'ALL', 'UN', 'ME',
    'END', 'LATER', 'BLOCK', 'CLOCK', 'MENU', 'PAUSE', 'MORE', 'OR', 'WAY',
    'IN', 'AID', 'CK',
  ]);

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function parseLevel(def) {
    const raw = def.map.replace(/^\n/, '').replace(/\n$/, '');
    const rows = raw.split('\n').map((r) => r.replace(/\s+$/, ''));
    const height = rows.length;
    const width = Math.max(...rows.map((r) => r.length));
    const padded = rows.map((r) => r.padEnd(width, '.'));
    const grid = [];
    let start = null;
    let maxLen = 1;
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        const ch = padded[y][x];
        if (ch === '@') start = { x, y };
        let word = '';
        if (def.glyphs && def.glyphs[ch] != null) word = def.glyphs[ch];
        else if (GLYPHS[ch] != null) word = GLYPHS[ch];
        else if (ch === '#') word = 'WALL';
        grid[y][x] = word;
        if (word.length > maxLen) maxLen = word.length;
      }
    }
    if (!start) throw new Error('Level ' + def.id + ' missing start @');
    return {
      id: def.id,
      name: def.name,
      part: def.part || 1,
      title: def.title || '',
      hint: def.hint || '',
      story: def.story || '',
      teach: def.teach || '',
      vocab: (def.vocab || []).map((w) => String(w).toUpperCase()),
      breaths: def.breaths != null ? def.breaths : (def.vocab || []).length ? 1 : 0,
      parSays: def.parSays != null ? def.parSays : (def.par != null ? def.par : 0),
      parMoves: def.parMoves != null ? def.parMoves : 0,
      recombine: !!def.recombine,
      meta: !!def.meta,
      theme: def.theme || 'paper',
      width,
      height,
      grid,
      start,
      maxLen,
    };
  }

  function createState(level) {
    return {
      x: level.start.x,
      y: level.start.y,
      grid: clone(level.grid),
      said: [],
      breaths: level.breaths,
      keys: 0,
      moves: 0,
      says: 0,
    };
  }

  function inBounds(level, x, y) {
    return x >= 0 && y >= 0 && x < level.width && y < level.height;
  }

  function tileAt(state, x, y) {
    if (!inBounds({ width: state.grid[0].length, height: state.grid.length }, x, y)) return null;
    return state.grid[y][x] || '';
  }

  function isSolidWord(word, keys) {
    if (!word) return false;
    if (word === 'LOCK' && keys > 0) return false;
    return SOLID.has(word);
  }

  function isDeadlyWord(word) {
    return DEADLY.has(word);
  }

  function isExitWord(word) {
    return EXIT.has(word);
  }

  function canEnter(level, state, x, y) {
    if (!inBounds(level, x, y)) return false;
    const w = state.grid[y][x] || '';
    if (isDeadlyWord(w)) return false;
    if (isSolidWord(w, state.keys)) return false;
    return true;
  }

  function containsWord(tile, said) {
    if (!tile) return false;
    const t = tile.toUpperCase();
    const s = said.toUpperCase();
    return t === s || t.indexOf(s) !== -1;
  }

  function leftoverAfter(tile, said, recombine) {
    if (!containsWord(tile, said)) return tile;
    if (!recombine) return '';
    const t = tile.toUpperCase();
    const s = said.toUpperCase();
    const i = t.indexOf(s);
    const left = t.slice(0, i) + t.slice(i + s.length);
    if (left.length >= 2 && KNOWN.has(left)) return left;
    return '';
  }

  function affectedCells(level, state, word) {
    const cells = [];
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const t = state.grid[y][x];
        if (t && containsWord(t, word)) cells.push({ x, y, word: t, leftover: leftoverAfter(t, word, level.recombine) });
      }
    }
    return cells;
  }

  function applySay(level, state, word) {
    if (!word) return { ok: false, reason: 'no-word' };
    const w = String(word).toUpperCase();
    if (level.vocab.indexOf(w) < 0) return { ok: false, reason: 'not-in-vocab' };
    if (state.breaths <= 0) return { ok: false, reason: 'no-breath' };
    if (state.said.indexOf(w) >= 0) return { ok: false, reason: 'already-said' };
    const next = clone(state);
    const affected = affectedCells(level, next, w);
    for (const c of affected) {
      next.grid[c.y][c.x] = c.leftover || '';
    }
    next.said.push(w);
    next.breaths -= 1;
    next.says += 1;
    return { ok: true, state: next, affected };
  }

  function applyMove(level, state, dir) {
    const d = DIRS[dir];
    if (!d) return { ok: false, reason: 'bad-dir' };
    const nx = state.x + d.x;
    const ny = state.y + d.y;
    if (!inBounds(level, nx, ny)) return { ok: false, reason: 'blocked', blocked: { x: nx, y: ny } };
    const w = state.grid[ny][nx] || '';
    if (isDeadlyWord(w)) return { ok: false, reason: 'water', blocked: { x: nx, y: ny } };
    if (isSolidWord(w, state.keys)) return { ok: false, reason: 'blocked', blocked: { x: nx, y: ny } };
    const next = clone(state);
    next.x = nx;
    next.y = ny;
    next.moves += 1;
    if (PICKUP.has(w)) {
      next.keys += 1;
      next.grid[ny][nx] = '';
    }
    return { ok: true, state: next };
  }

  function isWon(level, state) {
    const w = state.grid[state.y][state.x] || '';
    return isExitWord(w);
  }

  function hashState(state, recombine) {
    let h = state.x + ',' + state.y + '|b' + state.breaths + '|k' + state.keys + '|s' + state.said.slice().sort().join(',');
    if (recombine) {
      h += '|' + state.grid.map((row) => row.map((c) => c || '.').join(':')).join('/');
    }
    return h;
  }

  function playActions(level, actions) {
    let state = createState(level);
    const log = [];
    for (const a of actions) {
      let res;
      if (a === 'REWIND' || a === 'UNDO') return { ok: false, failedAt: a, log, state, reason: 'no-undo-in-core' };
      if (String(a).indexOf('SAY:') === 0) res = applySay(level, state, String(a).slice(4));
      else res = applyMove(level, state, a);
      if (!res.ok) return { ok: false, failedAt: a, log, state, reason: res.reason };
      state = res.state;
      log.push(a);
    }
    return { ok: true, state, won: isWon(level, state), log };
  }

  function solveLevel(level, opts) {
    const options = opts || {};
    const maxActions = options.maxActions || 80;
    let totalStates = 0;
    const maxSays = options.maxSays != null ? options.maxSays : (level.breaths || 0);
    for (let cap = 0; cap <= maxSays; cap++) {
      const start = createState(level);
      const queue = [{ st: start, acts: [] }];
      let qh = 0;
      const seen = new Set([hashState(start, level.recombine)]);
      while (qh < queue.length && totalStates < 250000) {
        const n = queue[qh++];
        totalStates++;
        if (isWon(level, n.st)) {
          return {
            solvable: true,
            says: n.st.says,
            moves: n.st.moves,
            parSays: level.parSays,
            parMoves: level.parMoves,
            actions: n.acts,
            states: totalStates,
          };
        }
        if (n.acts.length >= maxActions) continue;
        for (const dir of DIR_LIST) {
          const res = applyMove(level, n.st, dir);
          if (!res.ok) continue;
          const k = hashState(res.state, level.recombine);
          if (seen.has(k)) continue;
          seen.add(k);
          queue.push({ st: res.state, acts: n.acts.concat([dir]) });
        }
        if (n.st.says < cap && n.st.breaths > 0) {
          for (const word of level.vocab) {
            if (n.st.said.indexOf(word) >= 0) continue;
            const res = applySay(level, n.st, word);
            if (!res.ok) continue;
            const k = hashState(res.state, level.recombine);
            if (seen.has(k)) continue;
            seen.add(k);
            queue.push({ st: res.state, acts: n.acts.concat(['SAY:' + word]) });
          }
        }
      }
    }
    return { solvable: false, reason: 'no-solution', states: totalStates, parSays: level.parSays, parMoves: level.parMoves };
  }

  return {
    DIRS,
    DIR_LIST,
    GLYPHS,
    SOLID,
    EXIT,
    DEADLY,
    PICKUP,
    KNOWN,
    clone,
    parseLevel,
    createState,
    inBounds,
    tileAt,
    isSolidWord,
    isDeadlyWord,
    isExitWord,
    canEnter,
    containsWord,
    leftoverAfter,
    affectedCells,
    applySay,
    applyMove,
    isWon,
    hashState,
    playActions,
    solveLevel,
  };
});
