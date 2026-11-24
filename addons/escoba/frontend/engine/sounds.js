/* Sound effects for the Spanish card games (Escoba, Mus). MIT licence.
 *
 * Card and chip sounds are recordings from Kenney's «Casino Audio» pack (CC0, kenney.nl), in sounds/.
 * Signals (your turn, escoba, órdago, vaca…) are synthesised here with Web Audio.
 * Levels: 'off' | 'soft' | 'normal'. Audio starts after the first click or key (browser rule) and goes quiet
 * while the addon is hidden.
 */
(function (root) {
  'use strict';
  const SAMPLES = {
    slide: ['card-slide-1.ogg', 'card-slide-2.ogg', 'card-slide-3.ogg'],
    place: ['card-place-1.ogg', 'card-place-2.ogg', 'card-place-3.ogg'],
    shove: ['card-shove-1.ogg', 'card-shove-2.ogg'],
    shuffle: ['card-shuffle.ogg'],
    chip: ['chip-lay-1.ogg', 'chip-lay-2.ogg', 'chip-lay-3.ogg'],
  };
  const LEVEL_GAIN = { off: 0, soft: 0.45, normal: 0.85 };
  let ctx = null, master = null, level = 'soft', buffers = {}, loading = null, base = 'sounds/';

  function ensure() {
    if (level === 'off') return null;
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = LEVEL_GAIN[level];
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && document.visibilityState === 'visible') ctx.resume().catch(() => {});
    if (!loading) loading = load();
    return ctx;
  }
  let skip = [];
  function load() {
    const jobs = [];
    for (const [name, files] of Object.entries(SAMPLES)) {
      buffers[name] = [];
      if (skip.includes(name)) continue;
      files.forEach((f, i) => jobs.push(fetch(base + f).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b))
        .then((buf) => { buffers[name][i] = buf; }).catch(() => {})));
    }
    return Promise.all(jobs);
  }
  function sample(name, t, gain) {
    const list = (buffers[name] || []).filter(Boolean);
    if (!list.length) return;
    const src = ctx.createBufferSource();
    src.buffer = list[(Math.random() * list.length) | 0];
    src.playbackRate.value = 0.96 + Math.random() * 0.08;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(master);
    src.start(t);
  }
  function noise(t0, dur, f1, f2, q, gain) {
    const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f1, t0); f.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f).connect(g).connect(master); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  function tone(t0, freq, dur, type, gain, f2) {
    const o = ctx.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  const knock = (t) => { tone(t, 240, 0.09, 'sine', 0.55, 180); noise(t, 0.02, 2500, 2000, 1, 0.3); };

  const FX = {
    deal: (t, n) => { for (let i = 0; i < Math.min(n || 4, 8); i++) sample('slide', t + i * 0.075, 0.55); },
    play: (t) => sample('place', t, 0.8),
    take: (t) => sample('shove', t, 0.7),
    shuffle: (t) => sample('shuffle', t, 0.45),
    turn: (t) => { tone(t, 659, 0.18, 'triangle', 0.16); tone(t + 0.11, 880, 0.25, 'triangle', 0.14); },
    escoba: (t) => { noise(t, 0.38, 700, 4200, 0.8, 0.55); tone(t + 0.3, 1319, 0.5, 'sine', 0.26); tone(t + 0.3, 1976, 0.4, 'sine', 0.08); },
    coin: (t) => { tone(t, 2093, 0.25, 'sine', 0.16); tone(t + 0.06, 2637, 0.3, 'sine', 0.14); },
    handEnd: (t) => [523, 659, 784].forEach((f, i) => tone(t + i * 0.09, f, 0.3, 'triangle', 0.18)),
    win: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.1, f, i === 3 ? 0.7 : 0.25, 'triangle', 0.2)),
    lose: (t) => [784, 659, 523].forEach((f, i) => tone(t + i * 0.14, f, 0.35, 'sine', 0.16)),
    envido: (t) => knock(t),
    quiero: (t) => { knock(t); knock(t + 0.13); },
    noquiero: (t) => tone(t, 150, 0.12, 'sine', 0.4, 110),
    ordago: (t) => { tone(t, 80, 0.5, 'sine', 0.8, 45); noise(t, 0.5, 300, 900, 0.7, 0.3); noise(t + 0.35, 0.45, 600, 3600, 0.8, 0.35); tone(t + 0.75, 988, 0.45, 'triangle', 0.18); },
    tantos: (t, n) => { for (let i = 0; i < Math.min(n || 1, 10); i++) sample('chip', t + i * 0.1, 0.6); },
    vaca: (t) => { [[880, 1], [1760, 0.4], [2429, 0.25]].forEach(([f, g]) => tone(t, f, 1.4, 'sine', 0.22 * g)); tone(t + 0.35, 1319, 1.1, 'sine', 0.13); },
  };

  /** Play an effect. delay in seconds; n = how many (deal, tantos). */
  function play(name, opts) {
    opts = opts || {};
    if (level === 'off' || document.visibilityState === 'hidden') return;
    const c = ensure(); if (!c || !FX[name]) return;
    const run = () => { try { FX[name](c.currentTime + 0.02 + (opts.delay || 0), opts.n); } catch (_) {} };
    // samples may still be loading the very first time
    if (loading && !Object.values(buffers).some((l) => l.some(Boolean))) loading.then(run); else run();
  }
  function setLevel(l) {
    level = LEVEL_GAIN[l] !== undefined ? l : 'soft';
    if (master) master.gain.value = LEVEL_GAIN[level];
  }
  function init(opts) {
    if (opts && opts.base) base = opts.base;
    if (opts && opts.skip) skip = opts.skip;
    if (opts && opts.level) setLevel(opts.level);
    const unlock = () => { ensure(); };
    root.addEventListener('pointerdown', unlock, { capture: true });
    root.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.visibilityState === 'hidden') ctx.suspend().catch(() => {}); else if (level !== 'off') ctx.resume().catch(() => {});
    });
  }

  root.GameSound = { init, play, setLevel };
})(typeof self !== 'undefined' ? self : this);
