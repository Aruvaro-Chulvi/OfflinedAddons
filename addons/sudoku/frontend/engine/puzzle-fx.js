/* Sounds and small effects for the Offlined puzzle and board games (Sudoku, Calcudoku, Circuit, Minesweeper,
 * Chess). MIT licence. Same file in every one of those addons: if you change it, copy it to all of them.
 *
 * Sounds are synthesised with Web Audio (no files). Levels: 'off' | 'soft' | 'normal'. Audio starts after the first
 * click or key (browser rule), goes quiet while the addon is hidden and obeys Offlined's global mute («ofl:mute»).
 * Effects use the Web Animations API, so they survive the games re-setting class names on every render, and they
 * respect «reduce motion». Each effect returns how long it lasts (ms), so a dialog can wait for it.
 */
(function (root) {
  'use strict';
  const LEVEL_GAIN = { off: 0, soft: 0.5, normal: 0.9 };
  let ctx = null, master = null, level = 'soft', oflMuted = false, noiseBuf = null;
  root.addEventListener('message', (e) => {
    if (e.origin !== root.location.origin || !e.data || e.data.type !== 'ofl:mute') return;
    oflMuted = !!e.data.on; if (master) master.gain.value = oflMuted ? 0 : LEVEL_GAIN[level];
  });

  function ensure() {
    if (level === 'off') return null;
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = oflMuted ? 0 : LEVEL_GAIN[level];
      master.connect(comp).connect(ctx.destination);
      const n = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, n, n);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended' && document.visibilityState === 'visible') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(t0, freq, dur, type, gain, f2) {
    const o = ctx.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, f1, f2, q, gain, type) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f1, t0); f.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.006, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(f).connect(g).connect(master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  }
  const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
  const wood = (t, f, gain) => { tone(t, f, 0.07, 'sine', gain, f * 0.8); noise(t, 0.025, 2200, 1600, 1.2, gain * 0.55); };

  const FX = {
    // writing
    tap: (t) => { tone(t, 880, 0.07, 'triangle', 0.16, 700); noise(t, 0.015, 4000, 3000, 1, 0.05); },
    note: (t) => tone(t, 1568, 0.045, 'sine', 0.07),
    erase: (t) => noise(t, 0.09, 2600, 900, 0.9, 0.16),
    error: (t) => { tone(t, 233, 0.11, 'square', 0.06); tone(t + 0.1, 196, 0.16, 'square', 0.06); },
    hint: (t) => { tone(t, 1319, 0.35, 'sine', 0.1); tone(t + 0.07, 1976, 0.3, 'sine', 0.05); },
    // a finished row / column / box / cage: n = how many at once (1..3) makes it brighter
    unit: (t, n) => { const k = Math.max(1, Math.min(3, n || 1)); for (let i = 0; i < 2 + k; i++) tone(t + i * 0.055, PENTA[3 + i * 2 - (i > 2 ? 1 : 0)], 0.22, 'triangle', 0.11); },
    win: (t) => {
      [0, 2, 4, 5, 7].forEach((s, i) => tone(t + i * 0.09, PENTA[s], i === 4 ? 0.9 : 0.3, 'triangle', 0.15));
      noise(t + 0.4, 0.8, 5000, 9000, 0.7, 0.05, 'highpass');
    },
    lose: (t) => {
      tone(t, 90, 0.6, 'sine', 0.6, 38); noise(t, 0.7, 900, 120, 0.6, 0.45, 'lowpass');
      [659, 587, 494].forEach((f, i) => tone(t + 0.35 + i * 0.16, f, 0.3, 'sine', 0.08));
    },
    // Minesweeper
    open: (t) => tone(t, 620, 0.05, 'sine', 0.12, 900),
    cascade: (t, n) => { const k = Math.min(n || 4, 12); for (let i = 0; i < k; i++) tone(t + i * 0.028, 600 + i * 60, 0.04, 'sine', 0.06); },
    flag: (t) => wood(t, 520, 0.2),
    unflag: (t) => wood(t, 400, 0.14),
    chordFail: (t) => tone(t, 180, 0.08, 'triangle', 0.1),
    // Circuit
    line: (t) => tone(t, 740, 0.045, 'triangle', 0.1, 820),
    unline: (t) => tone(t, 520, 0.05, 'triangle', 0.08, 420),
    cross: (t) => noise(t, 0.03, 3500, 2500, 1.5, 0.1),
    // Chess
    move: (t) => wood(t, 210, 0.42),
    capture: (t) => { wood(t, 170, 0.5); noise(t + 0.02, 0.06, 1400, 700, 0.8, 0.25); },
    castle: (t) => { wood(t, 220, 0.38); wood(t + 0.11, 200, 0.38); },
    check: (t) => { tone(t, 988, 0.18, 'triangle', 0.12); tone(t + 0.09, 1319, 0.24, 'triangle', 0.1); },
    promote: (t) => [784, 988, 1175].forEach((f, i) => tone(t + i * 0.06, f, 0.25, 'triangle', 0.1)),
    draw: (t) => { tone(t, 659, 0.35, 'sine', 0.1); tone(t + 0.12, 659, 0.35, 'sine', 0.08); },
  };

  /** Play a sound. opts: {delay (s), n}. */
  function play(name, opts) {
    opts = opts || {};
    if (level === 'off' || oflMuted || document.visibilityState === 'hidden' || !FX[name]) return;
    const c = ensure(); if (!c) return;
    try { FX[name](c.currentTime + 0.01 + (opts.delay || 0), opts.n); } catch (_) {}
  }
  function setLevel(l) {
    level = LEVEL_GAIN[l] !== undefined ? l : 'soft';
    if (master) master.gain.value = oflMuted ? 0 : LEVEL_GAIN[level];
  }
  function init(opts) {
    if (opts && opts.level) setLevel(opts.level);
    const unlock = () => { ensure(); };
    root.addEventListener('pointerdown', unlock, { capture: true });
    root.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.visibilityState === 'hidden') ctx.suspend().catch(() => {}); else if (level !== 'off') ctx.resume().catch(() => {});
    });
  }

  // ── Effects ─────────────────────────────────────────────────────────────────────────────────────────
  const reduced = () => { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  /** Colour of a flash: the page's --fx-flash if it defines one, else a neutral grey that works on both themes. */
  function flashColour(el) {
    const v = getComputedStyle(el || document.documentElement).getPropertyValue('--fx-flash').trim();
    return v || 'rgba(128, 128, 128, .38)';
  }
  /**
   * Light up elements one after another (a finished row, the whole board when you win…).
   * order: array of elements, or of [element, delayMs]. Returns the total time in ms.
   */
  function sweep(order, opts) {
    opts = opts || {};
    const step = opts.step === undefined ? 35 : opts.step, dur = opts.dur || 460, scale = opts.scale === undefined ? 1.06 : opts.scale;
    if (reduced()) return 0;
    let end = 0;
    order.forEach((it, k) => {
      const el = Array.isArray(it) ? it[0] : it, delay = Array.isArray(it) ? it[1] : k * step;
      if (!el || !el.animate) return;
      const c = opts.colour || flashColour(el);
      el.animate([
        { backgroundColor: c, transform: 'scale(1)', offset: 0 },
        { backgroundColor: c, transform: `scale(${scale})`, offset: 0.35 },
        { transform: 'scale(1)' },
      ], { duration: dur, delay, easing: 'ease-out' });
      end = Math.max(end, delay + dur);
    });
    return end;
  }
  /** A quick "pop" on one element (a digit written, a flag placed). */
  function pop(el, opts) {
    if (!el || !el.animate || reduced()) return 0;
    const s = (opts && opts.scale) || 1.18, dur = (opts && opts.dur) || 180;
    el.animate([{ transform: 'scale(1)' }, { transform: `scale(${s})` }, { transform: 'scale(1)' }], { duration: dur, easing: 'ease-out' });
    return dur;
  }
  /** Shake (a wrong move, a chord that cannot open). */
  function shake(el, opts) {
    if (!el || !el.animate || reduced()) return 0;
    const d = (opts && opts.px) || 4, dur = (opts && opts.dur) || 260;
    el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(-${d}px)` }, { transform: `translateX(${d}px)` },
      { transform: `translateX(-${d / 2}px)` }, { transform: 'translateX(0)' }], { duration: dur, easing: 'ease-in-out' });
    return dur;
  }

  root.PuzzleFX = { init, play, setLevel, sweep, pop, shake, reduced };
})(typeof self !== 'undefined' ? self : this);
