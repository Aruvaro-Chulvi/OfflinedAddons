/* Sudoku engine for the Offlined «Sudoku» addon — MIT licence.
 *
 * - search(): fast bitmask backtracking (count solutions, solve, random full grid)
 * - grade():  a "human" solver that only uses logical techniques, from the easiest to the hardest.
 *             The hardest technique it needs decides the level (1 = Muy fácil … 8 = Mortal).
 * - generate(): random puzzles with a unique solution that match a level, from a seed (so a game code
 *               always gives the same sudoku). It is a JS generator function: it yields after each
 *               attempt so a Web Worker can share the CPU and be stopped.
 *
 * IMPORTANT: changing the generator changes which sudoku a code gives. Bump ENGINE_VERSION when you do.
 */
(function (root) {
  'use strict';

  const ENGINE_VERSION = 1;

  // ── Geometry ──────────────────────────────────────────────────────────────────────────────────────────
  const ROW = new Uint8Array(81), COL = new Uint8Array(81), BOX = new Uint8Array(81);
  for (let i = 0; i < 81; i++) {
    ROW[i] = (i / 9) | 0; COL[i] = i % 9;
    BOX[i] = ((ROW[i] / 3) | 0) * 3 + ((COL[i] / 3) | 0);
  }
  const UNITS = [];
  for (let r = 0; r < 9; r++) { const u = []; for (let c = 0; c < 9; c++) u.push(r * 9 + c); UNITS.push(u); }
  for (let c = 0; c < 9; c++) { const u = []; for (let r = 0; r < 9; r++) u.push(r * 9 + c); UNITS.push(u); }
  for (let b = 0; b < 9; b++) {
    const u = [], r0 = ((b / 3) | 0) * 3, c0 = (b % 3) * 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) u.push((r0 + r) * 9 + c0 + c);
    UNITS.push(u);
  }
  const CU = []; // units of each cell: [row, 9+col, 18+box]
  for (let i = 0; i < 81; i++) CU.push([ROW[i], 9 + COL[i], 18 + BOX[i]]);
  const SEES = new Uint8Array(6561);
  const PEERS = [];
  for (let i = 0; i < 81; i++) {
    const p = [];
    for (let j = 0; j < 81; j++) {
      if (i !== j && (ROW[i] === ROW[j] || COL[i] === COL[j] || BOX[i] === BOX[j])) { SEES[i * 81 + j] = 1; p.push(j); }
    }
    PEERS.push(p);
  }
  const POP = new Uint8Array(512);
  for (let m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);
  const DIG = [];
  for (let m = 0; m < 512; m++) { const a = []; for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1))) a.push(d); DIG.push(a); }
  const bit = (d) => 1 << (d - 1);
  const dOf = (m) => 32 - Math.clz32(m); // digit of a single-bit mask

  function inUnit(u, i) { return u < 9 ? ROW[i] === u : u < 18 ? COL[i] === u - 9 : BOX[i] === u - 18; }

  // ── Seeded random numbers (sfc32) ─────────────────────────────────────────────────────────────────────
  function makeRng(seed, k) {
    let a = (seed ^ 0xdeadbeef) >>> 0, b = (Math.imul(k, 0x9e3779b1) + 0x632be5ab) >>> 0;
    let c = (Math.imul(seed, 0x85ebca6b) + k) >>> 0, d = (0x1b873593 ^ k) >>> 0;
    function next() {
      const t0 = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0; const t = (t0 + d) | 0; c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    }
    for (let i = 0; i < 24; i++) next();
    const r = next;
    r.int = (n) => (next() * n) | 0;
    r.shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) { const j = (next() * (i + 1)) | 0; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      return arr;
    };
    return r;
  }

  // ── Backtracking ──────────────────────────────────────────────────────────────────────────────────────
  function search(g, limit, rng, out) {
    const v = Int8Array.from(g), R = new Int16Array(9), C = new Int16Array(9), X = new Int16Array(9);
    for (let i = 0; i < 81; i++) {
      if (!v[i]) continue;
      const b = bit(v[i]);
      if ((R[ROW[i]] | C[COL[i]] | X[BOX[i]]) & b) return 0;
      R[ROW[i]] |= b; C[COL[i]] |= b; X[BOX[i]] |= b;
    }
    let count = 0;
    function rec() {
      let best = -1, bm = 0, bn = 10;
      for (let i = 0; i < 81; i++) {
        if (v[i]) continue;
        const m = 511 & ~(R[ROW[i]] | C[COL[i]] | X[BOX[i]]);
        const n = POP[m];
        if (n < bn) { bn = n; best = i; bm = m; if (n < 2) break; }
      }
      if (best < 0) { count++; if (out && count === 1) out.set(v); return count >= limit; }
      if (bn === 0) return false;
      const r = ROW[best], c = COL[best], x = BOX[best];
      const ds = rng ? rng.shuffle(DIG[bm].slice()) : DIG[bm];
      for (let k = 0; k < ds.length; k++) {
        const d = ds[k], b = bit(d);
        v[best] = d; R[r] |= b; C[c] |= b; X[x] |= b;
        if (rec()) return true;
        R[r] &= ~b; C[c] &= ~b; X[x] &= ~b;
      }
      v[best] = 0;
      return false;
    }
    rec();
    return count;
  }
  const countSolutions = (g, limit = 2) => search(g, limit, null, null);
  function solve(g) { const out = new Int8Array(81); return search(g, 1, null, out) ? out : null; }
  function randomFull(rng) { const out = new Int8Array(81); search(new Int8Array(81), 1, rng, out); return out; }

  // ── Candidate state ───────────────────────────────────────────────────────────────────────────────────
  function mkState(g) {
    const v = Int8Array.from(g), c = new Int16Array(81);
    for (let i = 0; i < 81; i++) {
      if (v[i]) continue;
      let m = 511;
      for (const p of PEERS[i]) if (v[p]) m &= ~bit(v[p]);
      c[i] = m;
    }
    return { v, c };
  }
  function placeRaw(v, c, i, d) {
    v[i] = d; c[i] = 0;
    const nb = ~bit(d), P = PEERS[i];
    for (let k = 0; k < 20; k++) c[P[k]] &= nb;
  }
  function applyStep(st, s) {
    if (s.place) placeRaw(st.v, st.c, s.place[0], s.place[1]);
    if (s.elim) for (const [i, d] of s.elim) st.c[i] &= ~bit(d);
  }
  function isSolved(st) { for (let i = 0; i < 81; i++) if (!st.v[i]) return false; return true; }
  function isBroken(v, c) {
    for (let i = 0; i < 81; i++) if (!v[i] && !c[i]) return true;
    for (let u = 0; u < 27; u++) {
      let placed = 0, cand = 0;
      for (const i of UNITS[u]) {
        if (v[i]) { const b = bit(v[i]); if (placed & b) return true; placed |= b; } else cand |= c[i];
      }
      if ((placed | cand) !== 511) return true;
    }
    return false;
  }
  function cellsWith(st, U, b) { const a = []; for (const i of U) if (!st.v[i] && (st.c[i] & b)) a.push(i); return a; }
  function unitHas(st, U, d) { for (const i of U) if (st.v[i] === d) return true; return false; }

  function combos(arr, n, cb) {
    const pick = [];
    function go(s) {
      if (pick.length === n) return cb(pick);
      for (let k = s; k <= arr.length - (n - pick.length); k++) {
        pick.push(arr[k]);
        if (go(k + 1)) return true;
        pick.pop();
      }
      return false;
    }
    return go(0);
  }

  // ── Techniques ────────────────────────────────────────────────────────────────────────────────────────
  // Each returns a step {id, place?:[cell,digit], elim?:[[cell,digit]...], hl:[cells], unit?, digit?} or null.

  function tFullHouse(st) {
    for (let u = 0; u < 27; u++) {
      let n = 0, at = -1;
      for (const i of UNITS[u]) if (!st.v[i]) { n++; at = i; }
      if (n === 1 && POP[st.c[at]] === 1) return { id: 'full_house', place: [at, dOf(st.c[at])], hl: UNITS[u], unit: u };
    }
    return null;
  }
  function hiddenSingle(st, u0, u1, id) {
    for (let u = u0; u < u1; u++) {
      const U = UNITS[u];
      for (let d = 1; d <= 9; d++) {
        const b = bit(d); let n = 0, at = -1, placed = false;
        for (const i of U) { if (st.v[i] === d) { placed = true; break; } if (st.c[i] & b) { n++; at = i; } }
        if (!placed && n === 1) return { id, place: [at, d], hl: U, unit: u, digit: d };
      }
    }
    return null;
  }
  const tHiddenBox = (st) => hiddenSingle(st, 18, 27, 'hidden_single_box');
  const tHiddenLine = (st) => hiddenSingle(st, 0, 18, 'hidden_single_line');
  function tNakedSingle(st) {
    for (let i = 0; i < 81; i++) if (!st.v[i] && POP[st.c[i]] === 1) return { id: 'naked_single', place: [i, dOf(st.c[i])], hl: [i] };
    return null;
  }

  function tPointing(st) {
    for (let u = 18; u < 27; u++) {
      for (let d = 1; d <= 9; d++) {
        const cells = cellsWith(st, UNITS[u], bit(d));
        if (cells.length < 2) continue;
        for (const line of [ROW, COL]) {
          const l = line[cells[0]];
          if (!cells.every((i) => line[i] === l)) continue;
          const lu = UNITS[(line === ROW ? 0 : 9) + l];
          const elim = [];
          for (const i of lu) if (BOX[i] !== u - 18 && !st.v[i] && (st.c[i] & bit(d))) elim.push([i, d]);
          if (elim.length) return { id: 'pointing', elim, hl: cells, unit: u, digit: d };
        }
      }
    }
    return null;
  }
  function tClaiming(st) {
    for (let u = 0; u < 18; u++) {
      for (let d = 1; d <= 9; d++) {
        const cells = cellsWith(st, UNITS[u], bit(d));
        if (cells.length < 2) continue;
        const bx = BOX[cells[0]];
        if (!cells.every((i) => BOX[i] === bx)) continue;
        const elim = [];
        for (const i of UNITS[18 + bx]) if (!inUnit(u, i) && !st.v[i] && (st.c[i] & bit(d))) elim.push([i, d]);
        if (elim.length) return { id: 'claiming', elim, hl: cells, unit: u, digit: d };
      }
    }
    return null;
  }

  function nakedSubset(n, id) {
    return (st) => {
      let res = null;
      for (let u = 0; u < 27 && !res; u++) {
        const U = UNITS[u];
        const empties = U.filter((i) => !st.v[i]);
        if (empties.length <= n) continue;
        const cand = empties.filter((i) => POP[st.c[i]] >= 2 && POP[st.c[i]] <= n);
        if (cand.length < n) continue;
        combos(cand, n, (pick) => {
          let m = 0; for (const i of pick) m |= st.c[i];
          if (POP[m] !== n) return false;
          const elim = [];
          for (const i of empties) if (!pick.includes(i)) for (const d of DIG[st.c[i] & m]) elim.push([i, d]);
          if (!elim.length) return false;
          res = { id, elim, hl: pick.slice(), unit: u, digits: DIG[m] };
          return true;
        });
      }
      return res;
    };
  }
  function hiddenSubset(n, id) {
    return (st) => {
      let res = null;
      for (let u = 0; u < 27 && !res; u++) {
        const U = UNITS[u];
        const pos = new Int16Array(10); const ds = []; let free = 0;
        for (let d = 1; d <= 9; d++) {
          if (unitHas(st, U, d)) continue;
          free++;
          let m = 0; for (let k = 0; k < 9; k++) if (!st.v[U[k]] && (st.c[U[k]] & bit(d))) m |= 1 << k;
          pos[d] = m;
          if (POP[m] >= 2 && POP[m] <= n) ds.push(d);
        }
        if (free <= n || ds.length < n) continue;
        combos(ds, n, (pick) => {
          let m = 0, pm = 0; for (const d of pick) { m |= pos[d]; pm |= bit(d); }
          if (POP[m] !== n) return false;
          const elim = [], hl = [];
          for (let k = 0; k < 9; k++) {
            if (!(m & (1 << k))) continue;
            const i = U[k]; hl.push(i);
            for (const d of DIG[st.c[i] & ~pm]) elim.push([i, d]);
          }
          if (!elim.length) return false;
          res = { id, elim, hl, unit: u, digits: pick.slice() };
          return true;
        });
      }
      return res;
    };
  }

  function fish(n, id) {
    return (st) => {
      for (let d = 1; d <= 9; d++) {
        const b = bit(d);
        for (const base of [0, 9]) {
          const lines = [], masks = new Int16Array(9);
          for (let l = 0; l < 9; l++) {
            const U = UNITS[base + l];
            if (unitHas(st, U, d)) continue;
            let m = 0; for (let k = 0; k < 9; k++) if (!st.v[U[k]] && (st.c[U[k]] & b)) m |= 1 << k;
            if (POP[m] >= 2 && POP[m] <= n) { lines.push(l); masks[l] = m; }
          }
          if (lines.length < n) continue;
          let res = null;
          combos(lines, n, (pick) => {
            let m = 0; for (const l of pick) m |= masks[l];
            if (POP[m] !== n) return false;
            const elim = [], hl = [];
            for (let k = 0; k < 9; k++) {
              if (!(m & (1 << k))) continue;
              for (const i of UNITS[(base === 0 ? 9 : 0) + k]) {
                if (st.v[i] || !(st.c[i] & b)) continue;
                const line = base === 0 ? ROW[i] : COL[i];
                if (pick.includes(line)) hl.push(i); else elim.push([i, d]);
              }
            }
            if (!elim.length) return false;
            res = { id, elim, hl, digit: d };
            return true;
          });
          if (res) return res;
        }
      }
      return null;
    };
  }

  function bivalues(st) { const a = []; for (let i = 0; i < 81; i++) if (!st.v[i] && POP[st.c[i]] === 2) a.push(i); return a; }
  function seenByAll(st, d, cells) {
    const b = bit(d), out = [];
    for (let i = 0; i < 81; i++) {
      if (st.v[i] || !(st.c[i] & b) || cells.includes(i)) continue;
      let ok = true; for (const x of cells) if (!SEES[x * 81 + i]) { ok = false; break; }
      if (ok) out.push([i, d]);
    }
    return out;
  }

  function tXYWing(st) {
    const bi = bivalues(st);
    for (const p of bi) {
      const [x, y] = DIG[st.c[p]];
      for (const a of bi) {
        if (a === p || !SEES[p * 81 + a]) continue;
        const ma = st.c[a];
        if (!(ma & bit(x)) || (ma & bit(y))) continue;
        const z = dOf(ma & ~bit(x));
        for (const q of bi) {
          if (q === p || q === a || !SEES[p * 81 + q] || st.c[q] !== (bit(y) | bit(z))) continue;
          const elim = seenByAll(st, z, [a, q]);
          if (elim.length) return { id: 'xy_wing', elim, hl: [p, a, q], digit: z };
        }
      }
    }
    return null;
  }
  function tXYZWing(st) {
    const bi = bivalues(st);
    for (let p = 0; p < 81; p++) {
      if (st.v[p] || POP[st.c[p]] !== 3) continue;
      const m = st.c[p];
      const pin = bi.filter((i) => SEES[p * 81 + i] && (st.c[i] & ~m) === 0);
      for (let x = 0; x < pin.length; x++) for (let y = x + 1; y < pin.length; y++) {
        const a = pin[x], q = pin[y];
        if (st.c[a] === st.c[q] || (st.c[a] | st.c[q]) !== m) continue;
        const z = dOf(st.c[a] & st.c[q]);
        const elim = seenByAll(st, z, [p, a, q]);
        if (elim.length) return { id: 'xyz_wing', elim, hl: [p, a, q], digit: z };
      }
    }
    return null;
  }

  function strongLinks(st, d) {
    const b = bit(d), links = [], seen = new Set();
    for (let u = 0; u < 27; u++) {
      const U = UNITS[u];
      if (unitHas(st, U, d)) continue;
      const cells = cellsWith(st, U, b);
      if (cells.length !== 2) continue;
      const key = cells[0] * 81 + cells[1];
      if (seen.has(key)) continue;
      seen.add(key); links.push([cells[0], cells[1], u]);
    }
    return links;
  }

  // Skyscraper, 2-string kite and turbot fish: two strong links on one digit joined by a weak link.
  function tTurbot(st) {
    for (let d = 1; d <= 9; d++) {
      const L = strongLinks(st, d);
      for (let x = 0; x < L.length; x++) for (let y = 0; y < L.length; y++) {
        if (x === y) continue;
        for (let o1 = 0; o1 < 2; o1++) for (let o2 = 0; o2 < 2; o2++) {
          const p = L[x][o1], q = L[x][1 - o1], r = L[y][o2], s = L[y][1 - o2];
          if (p === r || p === s || q === r || q === s || !SEES[q * 81 + r]) continue;
          const elim = seenByAll(st, d, [p, s]).filter(([i]) => i !== q && i !== r);
          if (!elim.length) continue;
          const u1 = L[x][2], u2 = L[y][2];
          let id = 'turbot';
          if (u1 < 18 && u2 < 18) id = (u1 < 9) === (u2 < 9) ? 'skyscraper' : (BOX[q] === BOX[r] ? 'two_string_kite' : 'turbot');
          return { id, elim, hl: [p, q, r, s], digit: d };
        }
      }
    }
    return null;
  }

  function tWWing(st) {
    const bi = bivalues(st), linkCache = [];
    for (let x = 0; x < bi.length; x++) for (let y = x + 1; y < bi.length; y++) {
      const A = bi[x], B = bi[y];
      if (st.c[A] !== st.c[B] || SEES[A * 81 + B]) continue;
      const [d1, d2] = DIG[st.c[A]];
      for (const [w, z] of [[d1, d2], [d2, d1]]) {
        const links = linkCache[w] || (linkCache[w] = strongLinks(st, w));
        for (const [a, b] of links) {
          for (const [p, q] of [[a, b], [b, a]]) {
            if (p === A || p === B || q === A || q === B) continue;
            if (!SEES[p * 81 + A] || !SEES[q * 81 + B]) continue;
            const elim = seenByAll(st, z, [A, B]);
            if (elim.length) return { id: 'w_wing', elim, hl: [A, B, p, q], digit: z };
          }
        }
      }
    }
    return null;
  }

  function tColoring(st) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d), L = strongLinks(st, d), adj = new Map();
      for (const [a, c] of L) {
        if (!adj.has(a)) adj.set(a, []); if (!adj.has(c)) adj.set(c, []);
        adj.get(a).push(c); adj.get(c).push(a);
      }
      const color = new Map();
      for (const start of adj.keys()) {
        if (color.has(start)) continue;
        const comp = [start]; color.set(start, 0);
        for (let k = 0; k < comp.length; k++) {
          for (const n of adj.get(comp[k])) if (!color.has(n)) { color.set(n, 1 - color.get(comp[k])); comp.push(n); }
        }
        if (comp.length < 3) continue;
        // Wrap: two cells of one colour in the same unit → that colour is false.
        for (let x = 0; x < comp.length; x++) for (let y = x + 1; y < comp.length; y++) {
          const a = comp[x], c = comp[y];
          if (color.get(a) === color.get(c) && SEES[a * 81 + c]) {
            const bad = color.get(a);
            const elim = comp.filter((i) => color.get(i) === bad).map((i) => [i, d]);
            return { id: 'coloring', elim, hl: comp, digit: d };
          }
        }
        // Trap: a cell that sees both colours.
        const elim = [];
        for (let i = 0; i < 81; i++) {
          if (st.v[i] || !(st.c[i] & b) || color.has(i)) continue;
          let s0 = false, s1 = false;
          for (const n of comp) if (SEES[n * 81 + i]) { if (color.get(n)) s1 = true; else s0 = true; }
          if (s0 && s1) elim.push([i, d]);
        }
        if (elim.length) return { id: 'coloring', elim, hl: comp, digit: d };
      }
    }
    return null;
  }

  function tUR1(st) {
    for (let r1 = 0; r1 < 9; r1++) for (let r2 = r1 + 1; r2 < 9; r2++) {
      const sameBand = ((r1 / 3) | 0) === ((r2 / 3) | 0);
      for (let c1 = 0; c1 < 9; c1++) for (let c2 = c1 + 1; c2 < 9; c2++) {
        const sameStack = ((c1 / 3) | 0) === ((c2 / 3) | 0);
        if (sameBand === sameStack) continue; // must span exactly two boxes
        const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
        if (cells.some((i) => st.v[i])) continue;
        const bis = cells.filter((i) => POP[st.c[i]] === 2);
        if (bis.length !== 3) continue;
        const m = st.c[bis[0]];
        if (st.c[bis[1]] !== m || st.c[bis[2]] !== m) continue;
        const f = cells.find((i) => !bis.includes(i));
        if ((st.c[f] & m) !== m) continue;
        return { id: 'ur1', elim: DIG[m].map((d) => [f, d]), hl: cells, digits: DIG[m] };
      }
    }
    return null;
  }

  // Alternating inference chains (X-chains, XY-chains and general AICs), shortest first.
  function tChain(st) {
    const nodeOf = new Int16Array(729).fill(-1), ncell = [], ndig = [];
    for (let i = 0; i < 81; i++) if (!st.v[i]) for (const d of DIG[st.c[i]]) { nodeOf[i * 9 + d - 1] = ncell.length; ncell.push(i); ndig.push(d); }
    const N = ncell.length;
    const strong = [], strongCell = [], weak = [];
    for (let n = 0; n < N; n++) {
      const i = ncell[n], d = ndig[n], s = new Set(), sc = new Set(), w = [];
      if (POP[st.c[i]] === 2) { const o = nodeOf[i * 9 + DIG[st.c[i] & ~bit(d)][0] - 1]; s.add(o); sc.add(o); }
      for (const u of CU[i]) {
        const cells = cellsWith(st, UNITS[u], bit(d));
        if (cells.length === 2 && !unitHas(st, UNITS[u], d)) s.add(nodeOf[(cells[0] === i ? cells[1] : cells[0]) * 9 + d - 1]);
      }
      for (const e of DIG[st.c[i]]) if (e !== d) w.push(nodeOf[i * 9 + e - 1]);
      for (const p of PEERS[i]) if (!st.v[p] && (st.c[p] & bit(d))) w.push(nodeOf[p * 9 + d - 1]);
      strong.push([...s]); strongCell.push(sc); weak.push(w);
    }
    const conflict = (x, y) => (ncell[x] === ncell[y] ? ndig[x] !== ndig[y] : ndig[x] === ndig[y] && SEES[ncell[x] * 81 + ncell[y]] === 1);
    const MAXLEN = 14;
    let best = null;
    const onPar = new Int32Array(N), offPar = new Int32Array(N), onSeen = new Int32Array(N), offSeen = new Int32Array(N), depth = new Int32Array(N);
    let stamp = 0;
    for (let s = 0; s < N; s++) {
      const confS = [];
      for (let x = 0; x < N; x++) if (x !== s && conflict(x, s)) confS.push(x);
      if (!confS.length || !strong[s].length) continue;
      stamp++;
      const limit = best ? best.len - 1 : MAXLEN;
      // queue holds encoded states: node*2 + (1 = on)
      let q = [s * 2], found = null;
      offSeen[s] = stamp; offPar[s] = -1; depth[s] = 0;
      for (let h = 0; h < q.length && !found; h++) {
        const n = q[h] >> 1, on = q[h] & 1;
        if (!on) {
          if (depth[n] >= limit) continue;
          for (const t of strong[n]) {
            if (onSeen[t] === stamp) continue;
            onSeen[t] = stamp; onPar[t] = n;
            const dep = depth[n] + 1;
            if (t !== s) {
              const elim = confS.filter((x) => x !== t && conflict(x, t));
              if (elim.length && dep >= 2) { found = { t, dep, elim }; break; }
            }
            q.push(t * 2 + 1);
            depthOn[t] = dep;
          }
        } else {
          for (const t of weak[n]) {
            if (offSeen[t] === stamp) continue;
            offSeen[t] = stamp; offPar[t] = n; depth[t] = depthOn[n];
            q.push(t * 2);
          }
        }
      }
      if (found && (!best || found.dep < best.len)) {
        // rebuild the chain: on(t) ← off ← on ← … ← off(s)
        const path = []; let n = found.t, on = 1, strongInCell = true, guard = 0;
        while (guard++ < 200) {
          path.push(n);
          if (on) { const p = onPar[n]; if (!strongCell[p].has(n)) strongInCell = false; n = p; on = 0; }
          else { if (n === s && offPar[n] === -1) break; n = offPar[n]; on = 1; }
        }
        best = { len: found.dep, elim: found.elim, path, strongInCell };
      }
    }
    if (!best) return null;
    const digits = new Set(best.path.map((n) => ndig[n]));
    const id = digits.size === 1 ? 'x_chain' : best.strongInCell ? 'xy_chain' : 'aic';
    return {
      id, len: best.len,
      elim: best.elim.map((x) => [ncell[x], ndig[x]]),
      hl: [...new Set(best.path.map((n) => ncell[n]))],
      digit: digits.size === 1 ? [...digits][0] : undefined,
    };
  }
  const depthOn = new Int32Array(729);

  // Singles-only propagation used by forcing chains. Returns false on a contradiction.
  function propagate(v, c) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < 81; i++) {
        if (v[i]) continue;
        const m = c[i];
        if (!m) return false;
        if ((m & (m - 1)) === 0) { placeRaw(v, c, i, dOf(m)); changed = true; }
      }
      for (let u = 0; u < 27; u++) {
        const U = UNITS[u];
        let once = 0, twice = 0, placed = 0;
        for (let k = 0; k < 9; k++) {
          const i = U[k];
          if (v[i]) { const b = bit(v[i]); if (placed & b) return false; placed |= b; }
          else { const m = c[i]; twice |= once & m; once |= m; }
        }
        if ((once | placed) !== 511) return false;
        let single = once & ~twice & ~placed;
        while (single) {
          const b = single & -single; single ^= b;
          for (let k = 0; k < 9; k++) { const i = U[k]; if (!v[i] && (c[i] & b)) { placeRaw(v, c, i, dOf(b)); break; } }
          changed = true;
        }
      }
    }
    return true;
  }
  // Stronger propagation (singles + locked candidates + pairs/triples) for forcing nets.
  function propagateNet(v, c) {
    const st = { v, c };
    for (;;) {
      if (!propagate(v, c)) return false;
      if (isSolved(st)) return true;
      let step = null;
      for (const t of NET_TECH) { step = t(st); if (step) break; }
      if (!step) return !isBroken(v, c);
      applyStep(st, step);
      if (isBroken(v, c)) return false;
    }
  }

  function branch(st, i, d, net) {
    const v = st.v.slice(), c = st.c.slice();
    placeRaw(v, c, i, d);
    const ok = net ? propagateNet(v, c) : propagate(v, c);
    return ok ? v : null;
  }
  function cellOrder(st) {
    const a = []; for (let i = 0; i < 81; i++) if (!st.v[i]) a.push(i);
    return a.sort((x, y) => POP[st.c[x]] - POP[st.c[y]] || x - y);
  }
  function contradiction(net, id) {
    return (st) => {
      for (const i of cellOrder(st)) for (const d of DIG[st.c[i]]) {
        if (!branch(st, i, d, net)) return { id, elim: [[i, d]], hl: [i], digit: d };
      }
      return null;
    };
  }
  function common(st, results, id, hl) {
    if (results.some((r) => !r)) return null;
    for (let j = 0; j < 81; j++) {
      if (st.v[j]) continue;
      const d = results[0][j];
      if (d && results.every((r) => r[j] === d)) return { id, place: [j, d], hl: hl.concat(j) };
    }
    return null;
  }
  function tCellForcing(st) {
    for (const i of cellOrder(st)) {
      if (POP[st.c[i]] > 3) continue;
      const s = common(st, DIG[st.c[i]].map((d) => branch(st, i, d, false)), 'cell_forcing', [i]);
      if (s) return s;
    }
    return null;
  }
  function tUnitForcing(st) {
    for (let u = 0; u < 27; u++) for (let d = 1; d <= 9; d++) {
      if (unitHas(st, UNITS[u], d)) continue;
      const cells = cellsWith(st, UNITS[u], bit(d));
      if (cells.length < 2 || cells.length > 3) continue;
      const s = common(st, cells.map((i) => branch(st, i, d, false)), 'unit_forcing', cells);
      if (s) return s;
    }
    return null;
  }

  // ── Technique table: [id, level, rating, fn] ─────────────────────────────────────────────────────────
  const TECH = [
    ['full_house', 1, 1.0, tFullHouse],
    ['hidden_single_box', 1, 1.2, tHiddenBox],
    ['hidden_single_line', 2, 1.5, tHiddenLine],
    ['naked_single', 2, 2.3, tNakedSingle],
    ['pointing', 3, 2.6, tPointing],
    ['claiming', 3, 2.8, tClaiming],
    ['naked_pair', 3, 3.0, nakedSubset(2, 'naked_pair')],
    ['naked_triple', 3, 3.6, nakedSubset(3, 'naked_triple')],
    ['hidden_pair', 4, 3.4, hiddenSubset(2, 'hidden_pair')],
    ['hidden_triple', 4, 4.0, hiddenSubset(3, 'hidden_triple')],
    ['naked_quad', 4, 5.0, nakedSubset(4, 'naked_quad')],
    ['hidden_quad', 4, 5.4, hiddenSubset(4, 'hidden_quad')],
    ['x_wing', 5, 3.2, fish(2, 'x_wing')],
    ['xy_wing', 5, 4.2, tXYWing],
    ['swordfish', 5, 3.8, fish(3, 'swordfish')],
    ['xyz_wing', 6, 4.4, tXYZWing],
    ['turbot', 6, 4.2, tTurbot],
    ['w_wing', 6, 4.4, tWWing],
    ['coloring', 6, 4.5, tColoring],
    ['ur1', 6, 4.5, tUR1],
    ['jellyfish', 6, 5.2, fish(4, 'jellyfish')],
    ['chain', 7, 6.5, tChain],
    ['nishio', 8, 7.5, contradiction(false, 'nishio')],
    ['cell_forcing', 8, 8.2, tCellForcing],
    ['unit_forcing', 8, 8.2, tUnitForcing],
    ['forcing_net', 8, 9.0, contradiction(true, 'forcing_net')],
  ];
  const NET_TECH = TECH.filter((t) => t[1] >= 3 && t[1] <= 4).map((t) => t[3]);
  const RATING = { skyscraper: 4.0, two_string_kite: 4.1, turbot: 4.2, x_chain: 6.5, xy_chain: 6.6, aic: 7.0, trial: 10 };
  for (const t of TECH) if (!(t[0] in RATING)) RATING[t[0]] = t[2];
  const LEVEL_OF = { skyscraper: 6, two_string_kite: 6, turbot: 6, x_chain: 7, xy_chain: 7, aic: 7, trial: 8 };
  for (const t of TECH) if (!(t[0] in LEVEL_OF)) LEVEL_OF[t[0]] = t[1];
  const ratingOf = (s) => (s.len ? Math.min(RATING[s.id] + 0.1 * Math.max(0, s.len - 3), 7.9) : RATING[s.id]);

  function nextStep(st, maxLevel, solution) {
    for (const t of TECH) {
      if (t[1] > maxLevel) break;
      const s = t[3](st);
      if (s) return s;
    }
    if (maxLevel >= 8 && solution) {
      // Nothing logical left: a guess (only happens for puzzles beyond every technique here).
      const i = cellOrder(st)[0];
      return { id: 'trial', place: [i, solution[i]], hl: [i] };
    }
    return null;
  }

  /** Grade a puzzle: the hardest technique needed decides the level. */
  function grade(g, opts) {
    opts = opts || {};
    const maxLevel = opts.maxLevel || 8;
    const st = mkState(g);
    if (isBroken(st.v, st.c)) return { solved: false, level: 0, broken: true };
    let level = 0, hardest = null, rating = 0, steps = 0, hard = 0, top = 0, sol = opts.solution || null;
    while (!isSolved(st)) {
      if (maxLevel >= 8 && !sol) sol = solve(g);
      const s = nextStep(st, maxLevel, sol);
      if (!s) return { solved: false, level: maxLevel + 1, hardest, rating, steps };
      const lv = LEVEL_OF[s.id], r = ratingOf(s);
      if (lv > level || (lv === level && r > rating)) { hardest = s.id; }
      level = Math.max(level, lv); rating = Math.max(rating, r);
      if (lv >= 5) hard++;
      if (lv === 8) top++;
      steps++;
      applyStep(st, s);
      if (isBroken(st.v, st.c)) return { solved: false, level: 0, broken: true };
    }
    return { solved: true, level, hardest, rating, steps, hard, top };
  }

  /** The next digit a person could place from this position, and how. */
  function hint(values, solution) {
    const wrong = [];
    for (let i = 0; i < 81; i++) if (values[i] && values[i] !== solution[i]) wrong.push(i);
    if (wrong.length) return { wrong };
    const st = mkState(values);
    let hardest = null, hardLv = -1;
    for (let guard = 0; guard < 400 && !isSolved(st); guard++) {
      const s = nextStep(st, 8, solution);
      if (!s) break;
      const lv = LEVEL_OF[s.id];
      if (lv > hardLv) { hardLv = lv; hardest = s; }
      if (s.place) {
        const [i, d] = s.place;
        const region = s.unit !== undefined ? UNITS[s.unit] : UNITS[18 + BOX[i]];
        return { cell: i, digit: d, tech: hardest.id, level: hardLv, techCells: hardest.hl || [i], region, techDigit: hardest.digit };
      }
      applyStep(st, s);
    }
    return null;
  }

  // ── Generator ─────────────────────────────────────────────────────────────────────────────────────────
  const LEVELS = {
    1: { sym: true, cap: 1, clues: [36, 40] },
    2: { sym: true, cap: 2, clues: [30, 34] },
    3: { sym: true },
    4: { sym: true },
    5: { sym: true },
    6: { sym: true },
    7: { sym: false, climb: 40 },
    // Mortal: forcing chains needed again and again (3+ times), or a stronger forcing net.
    8: { sym: false, climb: 150, accept: (g) => g.top >= 3 || g.rating >= 8.2 },
  };

  function toStr(g) { let s = ''; for (let i = 0; i < 81; i++) s += g[i]; return s; }
  function fromStr(s) { const g = new Int8Array(81); for (let i = 0; i < 81; i++) g[i] = +s[i] || 0; return g; }
  function clueCount(g) { let n = 0; for (let i = 0; i < 81; i++) if (g[i]) n++; return n; }

  function carve(full, rng, cfg) {
    const p = Int8Array.from(full);
    const order = rng.shuffle([...Array(cfg.sym ? 41 : 81).keys()]);
    const minClues = cfg.clues ? cfg.clues[0] + rng.int(cfg.clues[1] - cfg.clues[0] + 1) : 0;
    let clues = 81;
    for (const i of order) {
      const j = 80 - i, pair = cfg.sym && j !== i;
      const n = pair ? 2 : 1;
      if (clues - n < minClues) continue;
      const a = p[i], b = p[j];
      p[i] = 0; if (pair) p[j] = 0;
      let ok = countSolutions(p, 2) === 1;
      if (ok && cfg.cap) ok = grade(p, { maxLevel: cfg.cap }).solved;
      if (ok) clues -= n; else { p[i] = a; if (pair) p[j] = b; }
    }
    return p;
  }
  function minimize(p, rng) {
    for (const i of rng.shuffle([...Array(81).keys()])) {
      if (!p[i]) continue;
      const a = p[i]; p[i] = 0;
      if (countSolutions(p, 2) !== 1) p[i] = a;
    }
    return p;
  }
  // Same solution grid, one clue moved: remove one, add one or two others, then drop the redundant ones.
  function mutate(p, full, rng) {
    const q = Int8Array.from(p);
    const filled = [], empty = [];
    for (let i = 0; i < 81; i++) (q[i] ? filled : empty).push(i);
    q[filled[rng.int(filled.length)]] = 0;
    const add = 1 + rng.int(2);
    for (let k = 0; k < add; k++) { const i = empty.splice(rng.int(empty.length), 1)[0]; q[i] = full[i]; }
    if (countSolutions(q, 2) !== 1) return null;
    return minimize(q, rng);
  }
  const score = (g) => g.level * 1000 + Math.round(g.rating * 50) + Math.min(g.top || 0, 10) * 40 + Math.min(g.hard || 0, 40);

  /**
   * generate(level, seed) — JS generator. Yields {attempt, best} progress objects; returns the puzzle:
   * {puzzle, solution, level, tech, rating, clues, seed, code}.
   */
  function* generate(level, seed) {
    const cfg = LEVELS[level];
    seed = seed >>> 0;
    for (let attempt = 0; ; attempt++) {
      const rng = makeRng(seed, attempt);
      const full = randomFull(rng);
      let p = carve(full, rng, cfg);
      let g = grade(p, { solution: full });
      yield { attempt, level: g.level };
      // Too hard: give back clues of the solution, one by one, until it is not.
      for (let k = 0; k < 24 && g.level > level; k++) {
        const empty = []; for (let i = 0; i < 81; i++) if (!p[i]) empty.push(i);
        const i = empty[rng.int(empty.length)];
        p[i] = full[i];
        if (cfg.sym && !p[80 - i]) p[80 - i] = full[80 - i];
        g = grade(p, { solution: full });
      }
      const ok = (x) => x.solved && x.level === level && (!cfg.accept || cfg.accept(x));
      if (!ok(g) && cfg.climb && g.level >= level - 2 && g.level <= level) {
        // Hill climbing on the clue set of this grid towards the target level.
        let cur = score(g);
        for (let k = 0; k < cfg.climb && !ok(g); k++) {
          const q = mutate(p, full, rng);
          if (!q) continue;
          const gq = grade(q, { solution: full });
          if (gq.level > level) continue;
          const sq = score(gq);
          if (sq >= cur) { p = q; g = gq; cur = sq; }
          yield { attempt, step: k, level: g.level };
        }
      }
      if (ok(g)) {
        return { puzzle: toStr(p), solution: toStr(full), level, tech: g.hardest, rating: Math.round(g.rating * 10) / 10,
          clues: clueCount(p), seed, code: encodeCode(level, seed), engine: ENGINE_VERSION };
      }
    }
  }
  function generateSync(level, seed) { const it = generate(level, seed); let r; while (!(r = it.next()).done); return r.value; }

  // ── Game codes: level digit + 7 base-32 chars of the seed, shown as XXXX-XXXX ─────────────────────────
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function encodeCode(level, seed) {
    let s = '', n = seed >>> 0;
    for (let k = 0; k < 7; k++) { s = B32[n % 32] + s; n = Math.floor(n / 32); }
    const raw = String(level) + s;
    return raw.slice(0, 4) + '-' + raw.slice(4);
  }
  function decodeCode(code) {
    const raw = String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    if (raw.length !== 8) return null;
    const level = +raw[0];
    if (!(level >= 1 && level <= 8)) return null;
    let n = 0;
    for (const ch of raw.slice(1)) { const k = B32.indexOf(ch); if (k < 0) return null; n = n * 32 + k; }
    if (n > 0xffffffff) return null;
    return { level, seed: n >>> 0 };
  }

  const api = {
    ENGINE_VERSION, UNITS, ROW, COL, BOX, PEERS, SEES,
    makeRng, countSolutions, solve, randomFull, grade, hint, generate, generateSync,
    encodeCode, decodeCode, toStr, fromStr, LEVEL_OF,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SudokuEngine = api;
})(typeof self !== 'undefined' ? self : this);
