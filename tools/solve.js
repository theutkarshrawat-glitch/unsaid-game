#!/usr/bin/env node
'use strict';
const path = require('path');
const core = require(path.join(__dirname, '..', 'js', 'core.js'));
const pack = require(path.join(__dirname, '..', 'js', 'levels.js'));

function fmt(actions) {
  return (actions || []).join(' ').replace(/SAY:/g, 'SAY ');
}

let failed = 0;
const rows = [];
for (const def of pack.LEVELS) {
  let level;
  try { level = core.parseLevel(def); }
  catch (e) {
    failed++;
    console.log('FAIL  ' + def.id + '  parse: ' + e.message);
    continue;
  }
  const t0 = Date.now();
  const r = core.solveLevel(level, { maxActions: 80 });
  const ms = Date.now() - t0;
  if (!r.solvable) {
    failed++;
    console.log('UNSOL ' + def.id.padEnd(14) + ' ' + (r.reason || '') + ' ' + ms + 'ms');
    continue;
  }
  const replay = core.playActions(level, r.actions);
  if (!replay.ok || !replay.won) {
    failed++;
    console.log('REPLAY ' + def.id + ' ' + replay.reason + ' at ' + replay.failedAt);
    continue;
  }
  const notes = [];
  if (r.says !== def.parSays) notes.push(r.says < def.parSays ? 'parSays HIGH (lower to ' + r.says + ')' : 'parSays LOW (min is ' + r.says + ')');
  if (def.parMoves && r.moves > def.parMoves) notes.push('parMoves LOW (need ' + r.moves + ')');
  if (def.parMoves && r.moves < def.parMoves) notes.push('parMoves HIGH (lower to ' + r.moves + ')');
  if (notes.length) failed++;
  const tag = notes.length ? 'PAR  ' : 'OK   ';
  console.log(tag + String(def.part).padEnd(2) + def.id.padEnd(14) + ' says=' + r.says + '/' + def.parSays + ' moves=' + r.moves + '/' + def.parMoves + ' ' + ms + 'ms  ' + fmt(r.actions) + (notes.length ? '  ' + notes.join('; ') : ''));
  rows.push({ id: def.id, part: def.part, actions: r.actions, says: r.says, moves: r.moves, parSays: def.parSays, parMoves: def.parMoves });
}
console.log('---');
console.log(failed === 0 ? 'All ' + pack.LEVELS.length + ' levels solvable, par achieved.' : failed + ' issue(s) in ' + pack.LEVELS.length + ' levels.');
const fs = require('fs');
fs.writeFileSync('/tmp/unsaid-solutions.json', JSON.stringify(rows, null, 2));
process.exit(failed ? 1 : 0);
