/* Engine for the Offlined «Minesweeper» addon — MIT licence.
 *
 * - generate(): mines placed after the first click, never on it or around it. In «no guessing» mode the
 *   board is accepted only if a logical solver can clear it from that first click.
 * - deduce():   the logical solver, also used for hints. Techniques, from simple to harder:
 *     full      a number already has all its mines → its other hidden neighbours are safe
 *     exact     a number needs as many mines as it has hidden neighbours → they are all mines
 *     subset    comparing two numbers whose hidden neighbours overlap
 *     count     the total number of mines left
 */
(function (root) {
  'use strict';

  const LEVELS = {
    1: { R: 9, C: 9, mines: 10 },
    2: { R: 16, C: 16, mines: 40 },
    3: { R: 16, C: 30, mines: 99 },
    4: { R: 24, C: 30, mines: 170 },
  };

  const NB = {};
  function neighbours(R, C) {
    const key = R + 'x' + C;
    if (NB[key]) return NB[key];
    const out = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const n = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < R && cc >= 0 && cc < C) n.push(rr * C + cc);
      }
      out.push(n);
    }
    return (NB[key] = out);
  }

  function makeRng(seed) {
    let a = (seed ^ 0xdeadbeef) >>> 0, b = 0x632be5ab, c = (Math.imul(seed, 0x85ebca6b) + 1) >>> 0, d = 0x1b873593;
    function next() {
      const t0 = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0; const t = (t0 + d) | 0; c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    }
    for (let i = 0; i < 16; i++) next();
    return next;
  }

  function counts(R, C, mine) {
    const nb = neighbours(R, C), n = new Int8Array(R * C);
    for (let i = 0; i < R * C; i++) { if (mine[i]) { n[i] = -1; continue; } let k = 0; for (const j of nb[i]) if (mine[j]) k++; n[i] = k; }
    return n;
  }

  /** Reveal from cell i (flood through zeros). Returns the list of newly revealed cells. */
  function flood(R, C, num, open, i) {
    const nb = neighbours(R, C), out = [];
    if (open[i]) return out;
    const stack = [i];
    open[i] = 1; out.push(i);
    while (stack.length) {
      const x = stack.pop();
      if (num[x] !== 0) continue;
      for (const j of nb[x]) if (!open[j]) { open[j] = 1; out.push(j); if (num[j] === 0) stack.push(j); }
    }
    return out;
  }

  /**
   * Logical deductions from what is visible. open[i]=1 revealed; known[i]=1 a mine already deduced (or
   * trusted flag). Returns {tech, safe:[...], mines:[...], from:[number cells used]} or null.
   */
  function deduce(R, C, num, open, known, totalMines, one) {
    const nb = neighbours(R, C), N = R * C;
    // simple rules on each number
    const front = [];
    for (let i = 0; i < N; i++) {
      if (!open[i] || num[i] <= 0) continue;
      let hidden = [], k = num[i];
      for (const j of nb[i]) { if (open[j]) continue; if (known[j]) k--; else hidden.push(j); }
      if (!hidden.length) continue;
      if (k === 0) return { tech: 'full', safe: hidden, mines: [], from: [i] };
      if (k === hidden.length) return { tech: 'exact', safe: [], mines: hidden, from: [i] };
      front.push({ i, k, hidden });
    }
    // two numbers: compare their hidden neighbours
    const byCell = new Map();
    for (const f of front) for (const h of f.hidden) { if (!byCell.has(h)) byCell.set(h, []); byCell.get(h).push(f); }
    const seenPair = new Set();
    for (const a of front) {
      const near = new Set();
      for (const h of a.hidden) for (const b of byCell.get(h)) if (b !== a) near.add(b);
      for (const b of near) {
        const key = a.i < b.i ? a.i * N + b.i : b.i * N + a.i;
        if (seenPair.has(key)) continue;
        seenPair.add(key);
        for (const [x, y] of [[a, b], [b, a]]) {
          const ys = new Set(y.hidden);
          const onlyX = x.hidden.filter((h) => !ys.has(h));
          const xs = new Set(x.hidden);
          const onlyY = y.hidden.filter((h) => !xs.has(h));
          // all of x inside y: the rest of y holds k_y - k_x mines
          if (!onlyX.length && onlyY.length) {
            const rest = y.k - x.k;
            if (rest === 0) return { tech: 'subset', safe: onlyY, mines: [], from: [x.i, y.i] };
            if (rest === onlyY.length) return { tech: 'subset', safe: [], mines: onlyY, from: [x.i, y.i] };
          }
          // y needs so many mines that its own part must be full and x's own part empty
          if (onlyY.length && y.k - x.k === onlyY.length && onlyX.length) {
            return { tech: 'subset', safe: onlyX, mines: onlyY, from: [x.i, y.i] };
          }
        }
      }
    }
    // mine count
    let unknown = [], left = totalMines;
    for (let i = 0; i < N; i++) { if (open[i]) continue; if (known[i]) left--; else unknown.push(i); }
    if (unknown.length) {
      if (left === 0) return { tech: 'count', safe: unknown, mines: [], from: [] };
      if (left === unknown.length) return { tech: 'count', safe: [], mines: unknown, from: [] };
    }
    return null;
  }

  /** Can the board be cleared from `first` without guessing? */
  function solvable(R, C, num, mineCount, first) {
    const N = R * C, open = new Uint8Array(N), known = new Uint8Array(N);
    flood(R, C, num, open, first);
    let safeLeft = N - mineCount;
    for (let i = 0; i < N; i++) if (open[i]) safeLeft--;
    for (let guard = 0; guard < N * 4 && safeLeft > 0; guard++) {
      const d = deduce(R, C, num, open, known, mineCount);
      if (!d) return false;
      for (const m of d.mines) known[m] = 1;
      for (const s of d.safe) { if (num[s] < 0) return false; for (const x of flood(R, C, num, open, s)) safeLeft--; }
    }
    return safeLeft === 0;
  }

  /**
   * Board for a first click. opts: {noGuess, seed, timeMs}. Returns {mines: [cell indexes], noGuess: bool, tries}.
   */
  function generate(level, first, opts) {
    opts = opts || {};
    const cfg = LEVELS[level], R = cfg.R, C = cfg.C, N = R * C;
    const rnd = makeRng(opts.seed === undefined ? (Math.random() * 4294967296) >>> 0 : opts.seed);
    const nb = neighbours(R, C);
    const banned = new Set([first, ...nb[first]]);
    const cells = [];
    for (let i = 0; i < N; i++) if (!banned.has(i)) cells.push(i);
    const t0 = Date.now(), limit = opts.timeMs || 2500;
    let tries = 0, last = null;
    while (true) {
      tries++;
      // partial Fisher–Yates for `mines` cells
      for (let k = 0; k < cfg.mines; k++) { const j = k + ((rnd() * (cells.length - k)) | 0); const t = cells[k]; cells[k] = cells[j]; cells[j] = t; }
      const mine = new Uint8Array(N);
      for (let k = 0; k < cfg.mines; k++) mine[cells[k]] = 1;
      last = mine;
      if (!opts.noGuess) break;
      const num = counts(R, C, mine);
      if (solvable(R, C, num, cfg.mines, first)) return { mines: listOf(mine), noGuess: true, tries };
      if (Date.now() - t0 > limit) break;
    }
    return { mines: listOf(last), noGuess: false, tries };
  }
  function listOf(mine) { const a = []; for (let i = 0; i < mine.length; i++) if (mine[i]) a.push(i); return a; }

  /** Hint for the player's position: wrong flags first, then a deduction, then (if none) a safe cell. */
  function hint(level, mines, open, flags) {
    const cfg = LEVELS[level], R = cfg.R, C = cfg.C, N = R * C;
    const mine = new Uint8Array(N); for (const m of mines) mine[m] = 1;
    const wrong = [];
    for (let i = 0; i < N; i++) if (flags[i] && !mine[i]) wrong.push(i);
    if (wrong.length) return { wrong };
    const num = counts(R, C, mine);
    const op = Uint8Array.from(open), known = new Uint8Array(N);
    // flags that are right count as known mines; a deduction is still explained from numbers only
    let d = deduce(R, C, num, op, known, cfg.mines);
    // skip deductions that only repeat flags the player already has
    for (let guard = 0; guard < N && d && !d.safe.length && d.mines.every((m) => flags[m]); guard++) {
      for (const m of d.mines) known[m] = 1;
      d = deduce(R, C, num, op, known, cfg.mines);
    }
    if (d) return { tech: d.tech, safe: d.safe.filter((s) => !open[s]), mines: d.mines.filter((m) => !flags[m]), from: d.from };
    // nothing logical: point to a safe hidden cell next to what is open, if any
    const nb = neighbours(R, C);
    let pick = -1;
    for (let i = 0; i < N && pick < 0; i++) if (!open[i] && !mine[i] && nb[i].some((j) => open[j])) pick = i;
    if (pick < 0) for (let i = 0; i < N && pick < 0; i++) if (!open[i] && !mine[i]) pick = i;
    return pick < 0 ? null : { tech: 'guess', safe: [pick], mines: [], from: [] };
  }

  const api = { LEVELS, neighbours, counts, flood, deduce, solvable, generate, hint };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MinesEngine = api;
})(typeof self !== 'undefined' ? self : this);
