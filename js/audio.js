/**
 * UNSAID WebAudio — synthesized typewriter, no samples.
 * Logo: three keys and a bell. Moves clack. Saying a word strikes a match.
 */
(function (root) {
  const Audio = {
    ctx: null,
    master: null,
    sfx: null,
    muted: false,
    unlocked: false,
    combo: 0,
    lastMove: 0,
  };

  function now() { return Audio.ctx ? Audio.ctx.currentTime : 0; }

  function envGain(t, a, h, r, peak) {
    const g = Audio.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + h);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + r);
    return g;
  }

  function tone({ freq, t, dur, type, peak, attack, release, filter, Q, dest, detune }) {
    const ac = Audio.ctx;
    const osc = ac.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (detune) osc.detune.setValueAtTime(detune, t);
    let node = osc;
    if (filter) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(filter, t);
      if (Q) f.Q.setValueAtTime(Q, t);
      node.connect(f);
      node = f;
    }
    const a = attack != null ? attack : 0.004;
    const rel = release != null ? release : Math.max(0.04, dur * 0.5);
    const h = Math.max(0, dur - a - 0.01);
    const g = envGain(t, a, h, rel, peak != null ? peak : 0.12);
    node.connect(g);
    g.connect(dest || Audio.sfx);
    osc.start(t);
    osc.stop(t + a + h + rel + 0.02);
    return osc;
  }

  function noiseBurst({ t, dur, peak, from, to, dest, type }) {
    const ac = Audio.ctx;
    const length = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, length, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.setValueAtTime(from || 2000, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = 1.2;
    const g = envGain(t, 0.004, dur * 0.2, dur * 0.7, peak != null ? peak : 0.2);
    src.connect(f);
    f.connect(g);
    g.connect(dest || Audio.sfx);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  function ready() { return Audio.ctx && Audio.unlocked && !Audio.muted; }

  Audio.unlock = function () {
    if (!Audio.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      Audio.ctx = new AC();
      Audio.master = Audio.ctx.createGain();
      Audio.master.gain.value = 0.85;
      const comp = Audio.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 3;
      Audio.sfx = Audio.ctx.createGain();
      Audio.sfx.gain.value = 1;
      Audio.sfx.connect(comp);
      comp.connect(Audio.master);
      Audio.master.connect(Audio.ctx.destination);
    }
    if (Audio.ctx.state === 'suspended') Audio.ctx.resume();
    Audio.unlocked = true;
  };

  Audio.setMuted = function (m) {
    Audio.muted = !!m;
    if (Audio.master) Audio.master.gain.value = Audio.muted ? 0 : 0.85;
  };
  Audio.toggleMute = function () {
    Audio.setMuted(!Audio.muted);
    return Audio.muted;
  };

  Audio.haptic = function (ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) { /* ignore */ }
  };

  // Three keys + a bell — the sonic logo.
  Audio.logo = function () {
    if (!ready()) return;
    const t = now() + 0.02;
    const keys = [392, 330, 494];
    keys.forEach((f, i) => {
      const tt = t + i * 0.11;
      noiseBurst({ t: tt, dur: 0.035, peak: 0.16, from: 2500, to: 1200 });
      tone({ freq: f * 2, t: tt, dur: 0.05, type: 'square', peak: 0.06, filter: 1800, attack: 0.001, release: 0.04 });
    });
    const bell = t + 0.38;
    tone({ freq: 1568, t: bell, dur: 0.7, type: 'sine', peak: 0.16, attack: 0.002, release: 0.65 });
    tone({ freq: 2349, t: bell, dur: 0.45, type: 'sine', peak: 0.06, attack: 0.002, release: 0.4 });
    Audio.haptic(18);
  };

  Audio.move = function () {
    if (!ready()) return;
    const t = now();
    const since = t - (Audio.lastMove || 0);
    if (since < 0.7) Audio.combo = (Audio.combo + 1) % 6;
    else Audio.combo = 0;
    Audio.lastMove = t;
    const f = 1400 + Audio.combo * 80;
    noiseBurst({ t, dur: 0.028, peak: 0.14, from: f, to: 600, type: 'bandpass' });
    tone({ freq: 180 + Audio.combo * 12, t, dur: 0.03, type: 'square', peak: 0.04, filter: 900, attack: 0.001, release: 0.03 });
    Audio.haptic(8);
  };

  Audio.bump = function () {
    if (!ready()) return;
    noiseBurst({ t: now(), dur: 0.06, peak: 0.1, from: 200, to: 90, type: 'lowpass' });
    Audio.haptic(18);
  };

  Audio.fail = function () {
    if (!ready()) return;
    const t = now();
    tone({ freq: 196, t, dur: 0.18, type: 'triangle', peak: 0.08, filter: 400, release: 0.16 });
    noiseBurst({ t, dur: 0.1, peak: 0.08, from: 400, to: 120, type: 'lowpass' });
    Audio.haptic(30);
  };

  Audio.say = function () {
    if (!ready()) return;
    const t = now();
    // match-strike
    noiseBurst({ t, dur: 0.07, peak: 0.22, from: 5000, to: 1800, type: 'highpass' });
    // burn whoosh
    noiseBurst({ t: t + 0.05, dur: 0.45, peak: 0.16, from: 900, to: 180, type: 'lowpass' });
    tone({ freq: 110, t: t + 0.04, dur: 0.4, type: 'sine', peak: 0.07, filter: 300, release: 0.35 });
    Audio.haptic([12, 30, 20]);
  };

  Audio.ding = function () {
    if (!ready()) return;
    const t = now();
    tone({ freq: 1319, t, dur: 0.55, type: 'sine', peak: 0.18, attack: 0.001, release: 0.5 });
    tone({ freq: 1976, t, dur: 0.3, type: 'sine', peak: 0.07, attack: 0.001, release: 0.28 });
    Audio.haptic(20);
  };

  Audio.win = function () {
    if (!ready()) return;
    Audio.ding();
    const t = now() + 0.22;
    tone({ freq: 1568, t, dur: 0.7, type: 'sine', peak: 0.12, release: 0.6 });
    tone({ freq: 1175, t: t + 0.02, dur: 0.8, type: 'sine', peak: 0.08, release: 0.7 });
  };

  Audio.page = function () {
    if (!ready()) return;
    noiseBurst({ t: now(), dur: 0.28, peak: 0.09, from: 1800, to: 400, type: 'bandpass' });
  };

  Audio.end = function () {
    if (!ready()) return;
    const t = now();
    tone({ freq: 784, t, dur: 1.1, type: 'sine', peak: 0.14, attack: 0.01, release: 1 });
    tone({ freq: 1175, t: t + 0.15, dur: 1.0, type: 'sine', peak: 0.1, release: 0.9 });
    tone({ freq: 1568, t: t + 0.32, dur: 1.2, type: 'sine', peak: 0.08, release: 1.1 });
    Audio.haptic([20, 40, 30]);
  };

  Audio.ui = function () {
    if (!ready()) return;
    noiseBurst({ t: now(), dur: 0.02, peak: 0.08, from: 2200, to: 1400 });
  };

  Audio.water = function () {
    if (!ready()) return;
    noiseBurst({ t: now(), dur: 0.12, peak: 0.1, from: 800, to: 300, type: 'lowpass' });
    Audio.haptic(16);
  };

  root.UnsaidAudio = Audio;
})(typeof globalThis !== 'undefined' ? globalThis : this);
