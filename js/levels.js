/**
 * UNSAID levels. Maps are rectangle strings.
 *  + PAGE (unsayable frame)   # WALL   . floor   @ start   E DOOR
 *  L LOCK   K KEY     W WATER   B BRIDGE
 *  R ROCK   H HINT    S SAID    N UNSAID
 *  Y DOORWAY  T LATER  U UNLOCK
 * PAGE and out-of-bounds are solid paper and cannot be unsaid.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UnsaidLevels = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  const LEVELS = [
    {
      id: 'threshold',
      name: 'Threshold',
      part: 1,
      parSays: 0,
      parMoves: 11,
      breaths: 0,
      vocab: [],
      teach: 'move',
      title: 'Walk to the word that means a way out.',
      hint: 'The door is already written. Swipe or tap toward it.',
      story: 'Every room begins as a sentence.',
      map: `
+++++++++++++
+@..........E+
+++++++++++++
`,
    },
    {
      id: 'unsay',
      name: 'Unsay',
      part: 1,
      parSays: 1,
      parMoves: 11,
      breaths: 1,
      vocab: ['WALL'],
      teach: 'say',
      title: 'Some words can be unsaid.',
      hint: 'Tap WALL, then Speak. The word will leave the page.',
      story: '',
      map: `
+++++++++++++
+@.....#....E+
+++++++++++++
`,
    },
    {
      id: 'inside',
      name: 'Inside',
      part: 1,
      parSays: 1,
      parMoves: 11,
      breaths: 1,
      vocab: ['ALL'],
      teach: 'substring',
      title: 'Listen to what a word contains.',
      hint: 'You cannot say WALL. But WALL holds another word you can say.',
      story: 'A word can hide another word.',
      map: `
+++++++++++++
+@.....#....E+
+++++++++++++
`,
    },
    {
      id: 'careful',
      name: 'Careful',
      part: 1,
      parSays: 1,
      parMoves: 11,
      breaths: 1,
      vocab: ['ALL', 'OR'],
      teach: 'trap',
      title: 'Not every word should be spoken.',
      hint: 'One word opens the way. The other erases the door.',
      story: '',
      map: `
+++++++++++++
+@.....#....E+
+++++++++++++
`,
    },
    {
      id: 'latch',
      name: 'Latch',
      part: 1,
      parSays: 2,
      parMoves: 11,
      breaths: 2,
      vocab: ['ALL', 'LOCK'],
      title: 'Two words stand in the way.',
      hint: 'The wall hides ALL. The latch is just LOCK. You will need both breaths.',
      story: '',
      map: `
+++++++++++++
+@.....#..L.E+
+++++++++++++
`,
    },
    {
      id: 'river',
      name: 'River',
      part: 1,
      parSays: 1,
      parMoves: 11,
      breaths: 1,
      vocab: ['WATER', 'OR'],
      teach: 'water',
      title: 'Some words you cannot stand on.',
      hint: 'The river is the word WATER. Do not say the other word.',
      story: 'The last line on the page is still a door.',
      map: `
+++++++++++++
+@.....WWWW.E+
+++++++++++++
`,
    },

    // ── Part 2 ──
    {
      id: 'crossing',
      name: 'Crossing',
      part: 2,
      parSays: 1,
      parMoves: 12,
      breaths: 1,
      vocab: ['WATER', 'BRIDGE'],
      teach: 'bridge',
      title: 'The river is the word. The bridge is a temptation.',
      hint: 'The bridge does not reach you. Unsay the water, not the bridge.',
      story: 'The page was not finished.',
      map: `
+++++++++++++
+@.....BB...+
+WWWWWWWWWWW+
+..........E+
+++++++++++++
`,
    },
    {
      id: 'stepping',
      name: 'Stepping',
      part: 2,
      parSays: 1,
      parMoves: 13,
      breaths: 1,
      vocab: ['LOCK', 'CK'],
      teach: 'ck-trap',
      title: 'One word can silence two.',
      hint: 'A stone holds CK, and so does the latch. Say only what you must.',
      story: '',
      map: `
+++++++++++++
+@......R...+
+WWWWWWW.WWW+
++++++++L++++
+..........E+
+++++++++++++
`,
    },
    {
      id: 'narrow',
      name: 'Narrow',
      part: 2,
      parSays: 2,
      parMoves: 3,
      breaths: 2,
      vocab: ['ALL', 'WATER', 'OR'],
      title: 'Two breaths. Three words. One of them is a mistake.',
      hint: 'Clear the wall, then the water. Leave OR unsaid.',
      story: '',
      map: `
+++++++++++++
+++++@+++++++
+++++#+++++++
+++++W+++++++
+++++E+++++++
+++++++++++++
`,
    },
    {
      id: 'keyring',
      name: 'Keyring',
      part: 2,
      parSays: 0,
      parMoves: 14,
      breaths: 1,
      vocab: ['LOCK'],
      teach: 'key',
      title: 'Not every lock has to be unsaid.',
      hint: 'There is a KEY on the page. Walk to it, then the lock will let you through.',
      story: '',
      map: `
+++++++++++++
+@.........K+
++++++++++L++
+..........E+
+++++++++++++
`,
    },
    {
      id: 'hinted',
      name: 'Hinted',
      part: 2,
      parSays: 1,
      parMoves: 11,
      breaths: 1,
      vocab: ['HINT', 'ALL'],
      teach: 'meta-hint',
      meta: true,
      title: 'Some buttons are also words.',
      hint: 'The thing in the way is the same word as the button you press for help.',
      story: 'The margin is not safe either.',
      map: `
+++++++++++++
+@....HHHHH.E+
+++++++++++++
`,
    },
    {
      id: 'spoken',
      name: 'Spoken',
      part: 2,
      parSays: 1,
      parMoves: 11,
      breaths: 1,
      vocab: ['SAID', 'OR'],
      teach: 'meta-title',
      meta: true,
      title: 'The name of the game was always a sentence.',
      hint: 'SAID lives inside UNSAID. Speak it, and the title will lose a piece of itself.',
      story: 'What is left when something has been said?',
      map: `
+++++++++++++
+@....S.....E+
+++++++++++++
`,
    },

    // ── Part 3 ──
    {
      id: 'doorway',
      name: 'Doorway',
      part: 3,
      parSays: 1,
      parMoves: 5,
      breaths: 1,
      vocab: ['WAY'],
      teach: 'recombine',
      recombine: true,
      title: 'Sometimes a word leaves another word behind.',
      hint: 'There is no door. There is a DOORWAY. Say what it contains.',
      story: 'Leftover letters can still be a way out.',
      map: `
+++++++++++++
+@....Y.....+
+++++++++++++
`,
    },
    {
      id: 'remain',
      name: 'Remain',
      part: 3,
      parSays: 1,
      parMoves: 5,
      breaths: 1,
      vocab: ['WAY', 'OR'],
      recombine: true,
      title: 'The wrong syllable leaves nothing.',
      hint: 'WAY leaves a door. OR leaves a ruin.',
      story: '',
      map: `
+++++++++++++
+@....Y.....+
+++++++++++++
`,
    },
    {
      id: 'double',
      name: 'Double',
      part: 3,
      parSays: 2,
      parMoves: 9,
      breaths: 2,
      vocab: ['ALL', 'WAY'],
      recombine: true,
      title: 'First open the wall. Then make the door.',
      hint: 'ALL unsays the wall. WAY turns the doorway into a door.',
      story: '',
      map: `
+++++++++++++
+@....#...Y.+
+++++++++++++
`,
    },
    {
      id: 'title-room',
      name: 'Title',
      part: 3,
      parSays: 1,
      parMoves: 11,
      breaths: 1,
      vocab: ['SAID', 'ALL'],
      recombine: true,
      meta: true,
      teach: 'title-room',
      title: 'The title was a room.',
      hint: 'UNSAID contains SAID. What remains is still a word, and you can walk through it.',
      story: 'UNSAID was always a hallway.',
      map: `
+++++++++++++
+@....NNNNN.E+
+++++++++++++
`,
    },
    {
      id: 'breath',
      name: 'Breath',
      part: 3,
      parSays: 2,
      parMoves: 8,
      breaths: 2,
      vocab: ['ALL', 'WAY', 'OR'],
      recombine: true,
      title: 'You have two breaths left. Spend them as if they were the last.',
      hint: 'A wall, then a doorway. Do not spend a breath on OR.',
      story: '',
      map: `
+++++++++++++
+@..........+
+..#######..+
+..#.....#..+
+..#..Y..#..+
+..#.....#..+
+..#######..+
+++++++++++++
`,
    },
    {
      id: 'unfinished',
      name: 'Unfinished',
      part: 3,
      parSays: 0,
      parMoves: 10,
      breaths: 1,
      vocab: ['OR'],
      title: 'The rest is still unsaid.',
      hint: 'You do not have to speak. Just walk to LATER.',
      story: 'Every ending is a sentence left unfinished.',
      map: `
+++++++++++++
+@.........T+
+++++++++++++
`,
    },
  ];

  const PARTS = [
    {
      id: 1,
      name: 'The Page',
      kicker: 'Part 1',
      rule: 'Walk, then unsay a word. What a word contains can vanish with it.',
      ids: ['threshold', 'unsay', 'inside', 'careful', 'latch', 'river'],
    },
    {
      id: 2,
      name: 'The Margin',
      kicker: 'Part 2',
      rule: 'Water, stones, keys — and the buttons on the page are words too.',
      ids: ['crossing', 'stepping', 'narrow', 'keyring', 'hinted', 'spoken'],
    },
    {
      id: 3,
      name: 'The Speaker',
      kicker: 'Part 3',
      rule: 'Leftover letters can become a new word. The title was a room.',
      ids: ['doorway', 'remain', 'double', 'title-room', 'breath', 'unfinished'],
    },
  ];

  const INTROS = {
    1: {
      kicker: 'Part 1 — The Page',
      line: 'The room is made of words.',
      question: 'Walk first. When you must speak, speak carefully.',
    },
    2: {
      kicker: 'Part 2 — The Margin',
      line: 'The page was not finished.',
      question: 'The words on the buttons were never safer than the words in the room.',
    },
    3: {
      kicker: 'Part 3 — The Speaker',
      line: 'A word can leave another word behind.',
      question: 'If you unsay the right syllable, a door may remain.',
    },
  };

  const ANCHORS = {
    1: {
      line: 'You have come to the last door on the page.',
      question: 'If a door can be unsaid, can an ending?',
    },
    2: {
      line: 'The title lost a word. The margin is burnt.',
      question: 'Who is speaking, if not you?',
    },
    3: {
      line: 'The rest is still unsaid.',
      question: 'A later page is already being typed.',
    },
  };

  function buildFlow() {
    return [
      { type: 'intro', part: 1, kicker: INTROS[1].kicker, line: INTROS[1].line, question: INTROS[1].question },
      { type: 'puzzle', id: 'threshold' },
      { type: 'puzzle', id: 'unsay' },
      { type: 'puzzle', id: 'inside' },
      { type: 'puzzle', id: 'careful' },
      { type: 'puzzle', id: 'latch' },
      { type: 'puzzle', id: 'river' },
      { type: 'anchor', part: 1, line: ANCHORS[1].line, question: ANCHORS[1].question },
      { type: 'cinematic', id: 'the-end' },
      { type: 'intro', part: 2, kicker: INTROS[2].kicker, line: INTROS[2].line, question: INTROS[2].question },
      { type: 'puzzle', id: 'crossing' },
      { type: 'puzzle', id: 'stepping' },
      { type: 'puzzle', id: 'narrow' },
      { type: 'puzzle', id: 'keyring' },
      { type: 'puzzle', id: 'hinted' },
      { type: 'puzzle', id: 'spoken' },
      { type: 'anchor', part: 2, line: ANCHORS[2].line, question: ANCHORS[2].question },
      { type: 'intro', part: 3, kicker: INTROS[3].kicker, line: INTROS[3].line, question: INTROS[3].question },
      { type: 'puzzle', id: 'doorway' },
      { type: 'puzzle', id: 'remain' },
      { type: 'puzzle', id: 'double' },
      { type: 'puzzle', id: 'title-room' },
      { type: 'puzzle', id: 'breath' },
      { type: 'puzzle', id: 'unfinished' },
      { type: 'teaser', kicker: 'Later', line: 'The rest is still unsaid.', question: 'A later page is already being typed.' },
    ];
  }

  const FLOW = buildFlow();

  function getLevel(id) {
    return LEVELS.find((l) => l.id === id);
  }
  function getPart(id) {
    return PARTS.find((p) => p.id === id);
  }

  return { LEVELS, PARTS, FLOW, INTROS, ANCHORS, getLevel, getPart, buildFlow };
});
