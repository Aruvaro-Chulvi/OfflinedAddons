/* Engine for the Offlined «Circuit» addon (a Slitherlink-style loop puzzle) — MIT licence.
 *
 * Board: R×C cells, (R+1)×(C+1) dots. Edges: horizontal first (id = r*C + c, r in 0..R), then vertical
 * (id = NH + r*(C+1) + c, r in 0..R-1). Edge states: 0 unknown, 1 line, 2 cross.
 *
 * - solve():    exact solver (propagation + backtracking), counts solutions up to a limit.
 * - grade():    "human" solver with tiers of techniques; the hardest tier needed decides the level.
 * - generate(): random single loop → clues → remove clues while the solution stays unique and the level
 *               fits. A JS generator function (yields between attempts) driven by a Web Worker.
 *
 * Changing the generator changes which puzzle a code gives: bump ENGINE_VERSION when you do.
 */
(function (root) {
  'use strict';
  const ENGINE_VERSION = 1;
  const UNK = 0, LINE = 1, CROSS = 2;

  // ── Geometry (cached per size) ────────────────────────────────────────────────────────────────────────
  const GEO = {};
  function geo(R, C) {
    const key = R + 'x' + C;
    if (GEO[key]) return GEO[key];
    const NH = (R + 1) * C, NV = R * (C + 1), NE = NH + NV, NP = (R + 1) * (C + 1), NC = R * C;
    const h = (r, c) => r * C + c, v = (r, c) => NH + r * (C + 1) + c, pt = (r, c) => r * (C + 1) + c;
    const cellEdges = [], pointEdges = [], edgePoints = [], edgeCells = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) cellEdges.push([h(r, c), h(r + 1, c), v(r, c), v(r, c + 1)]);
    for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) {
      const e = [];
      if (r > 0) e.push(v(r - 1, c));
      if (r < R) e.push(v(r, c));
      if (c > 0) e.push(h(r, c - 1));
      if (c < C) e.push(h(r, c));
      pointEdges.push(e);
    }
    for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) {
      edgePoints[h(r, c)] = [pt(r, c), pt(r, c + 1)];
      edgeCells[h(r, c)] = [r > 0 ? (r - 1) * C + c : -1, r < R ? r * C + c : -1];
    }
    for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) {
      edgePoints[v(r, c)] = [pt(r, c), pt(r + 1, c)];
      edgeCells[v(r, c)] = [c > 0 ? r * C + c - 1 : -1, c < C ? r * C + c : -1];
    }
    // corners of each cell: [point, the two cell edges at it, the two other edges at it (or -1)]
    const cellCorners = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const [top, bottom, left, right] = cellEdges[r * C + c];
      const corners = [];
      for (const [pr, pc, a, b] of [[r, c, top, left], [r, c + 1, top, right], [r + 1, c, bottom, left], [r + 1, c + 1, bottom, right]]) {
        const p = pt(pr, pc), others = pointEdges[p].filter((e) => e !== a && e !== b);
        while (others.length < 2) others.push(-1);
        corners.push([p, a, b, others[0], others[1]]);
      }
      cellCorners.push(corners);
    }
    return (GEO[key] = { R, C, NH, NV, NE, NP, NC, h, v, pt, cellEdges, pointEdges, edgePoints, edgeCells, cellCorners });
  }

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
    r.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = (next() * (i + 1)) | 0; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
    return r;
  }

  // ── Random loop: a region of cells, connected, without holes or pinch points; its border is the loop ──
  function randomRegion(R, C, rng) {
    const N = R * C, inR = new Uint8Array(N);
    const nb = (i) => { const r = (i / C) | 0, c = i % C, o = []; if (r > 0) o.push(i - C); if (r < R - 1) o.push(i + C); if (c > 0) o.push(i - 1); if (c < C - 1) o.push(i + 1); return o; };
    const inside = (r, c) => r >= 0 && r < R && c >= 0 && c < C && inR[r * C + c];
    function pinchFree(i) { // no 2×2 block around i in a diagonal (checkerboard) pattern
      const r = (i / C) | 0, c = i % C;
      for (const [dr, dc] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) {
        const r0 = r + dr, c0 = c + dc;
        const a = inside(r0, c0), b = inside(r0, c0 + 1), x = inside(r0 + 1, c0), y = inside(r0 + 1, c0 + 1);
        if (a === y && b === x && a !== b) return false;
      }
      return true;
    }
    function outsideConnected() { // every outside cell reaches the border through outside cells
      const seen = new Uint8Array(N), q = [];
      for (let i = 0; i < N; i++) {
        const r = (i / C) | 0, c = i % C;
        if (!inR[i] && (r === 0 || c === 0 || r === R - 1 || c === C - 1)) { seen[i] = 1; q.push(i); }
      }
      for (let k = 0; k < q.length; k++) for (const j of nb(q[k])) if (!inR[j] && !seen[j]) { seen[j] = 1; q.push(j); }
      for (let i = 0; i < N; i++) if (!inR[i] && !seen[i]) return false;
      return true;
    }
    function insideConnected() {
      let start = -1, count = 0;
      for (let i = 0; i < N; i++) if (inR[i]) { count++; if (start < 0) start = i; }
      if (!count) return false;
      const seen = new Uint8Array(N), q = [start]; seen[start] = 1;
      for (let k = 0; k < q.length; k++) for (const j of nb(q[k])) if (inR[j] && !seen[j]) { seen[j] = 1; q.push(j); }
      return q.length === count;
    }
    const target = Math.round(N * (0.42 + rng() * 0.16));
    inR[rng.int(N)] = 1;
    let size = 1, tries = 0;
    while (size < target && tries < N * 60) {
      tries++;
      // frontier cell to add
      const i = rng.int(N);
      if (inR[i] || !nb(i).some((j) => inR[j])) continue;
      inR[i] = 1;
      if (!pinchFree(i) || !outsideConnected()) { inR[i] = 0; continue; }
      size++;
      // sometimes carve one back out to make the shape wigglier
      if (size > 6 && rng() < 0.18) {
        const k = rng.int(N);
        if (inR[k]) {
          inR[k] = 0;
          if (!pinchFree(k) || !insideConnected() || !outsideConnected()) inR[k] = 1; else size--;
        }
      }
    }
    return inR;
  }
  function loopFromRegion(g, inR) {
    const sol = new Int8Array(g.NE);
    for (let e = 0; e < g.NE; e++) {
      const [a, b] = g.edgeCells[e];
      const ia = a >= 0 ? inR[a] : 0, ib = b >= 0 ? inR[b] : 0;
      sol[e] = ia !== ib ? LINE : CROSS;
    }
    return sol;
  }
  function cluesFromLoop(g, sol) {
    const cl = new Int8Array(g.NC);
    for (let i = 0; i < g.NC; i++) { let n = 0; for (const e of g.cellEdges[i]) if (sol[e] === LINE) n++; cl[i] = n; }
    return cl;
  }

  // ── Union-find over dots for line components ─────────────────────────────────────────────────────────
  function components(g, st) {
    const par = new Int32Array(g.NP);
    for (let i = 0; i < g.NP; i++) par[i] = i;
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    let lines = 0;
    for (let e = 0; e < g.NE; e++) if (st[e] === LINE) { lines++; const [p, q] = g.edgePoints[e]; const a = find(p), b = find(q); if (a !== b) par[a] = b; }
    return { find, lines };
  }

  // ── Exact propagation used by the solver and as the "basic" technique ───────────────────────────────
  // clues: Int8Array, -1 = no clue. Returns false on contradiction. Modifies st.
  function propagate(g, clues, st, useLoop) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < g.NC; i++) {
        const n = clues[i]; if (n < 0) continue;
        const E = g.cellEdges[i]; let L = 0, X = 0;
        for (let k = 0; k < 4; k++) { const s = st[E[k]]; if (s === LINE) L++; else if (s === CROSS) X++; }
        if (L > n || 4 - X < n) return false;
        if (L + X === 4) continue;
        if (L === n) { for (let k = 0; k < 4; k++) if (!st[E[k]]) { st[E[k]] = CROSS; } changed = true; }
        else if (4 - X === n) { for (let k = 0; k < 4; k++) if (!st[E[k]]) { st[E[k]] = LINE; } changed = true; }
      }
      for (let p = 0; p < g.NP; p++) {
        const E = g.pointEdges[p]; let L = 0, U = 0, last = -1;
        for (let k = 0; k < E.length; k++) { const s = st[E[k]]; if (s === LINE) L++; else if (!s) { U++; last = E[k]; } }
        if (L > 2 || (L === 1 && U === 0)) return false;
        if (!U) continue;
        if (L === 2) { for (const e of E) if (!st[e]) st[e] = CROSS; changed = true; }
        else if (L === 1 && U === 1) { st[last] = LINE; changed = true; }
        else if (L === 0 && U === 1) { st[last] = CROSS; changed = true; }
      }
      if (!changed && useLoop) {
        const r = loopRule(g, clues, st, false);
        if (r === false) return false;
        if (r) changed = true;
      }
    }
    return true;
  }
  // Premature loops: an unknown edge joining the two ends of one path closes a loop. That is only allowed
  // when it would be the whole solution. Returns false (contradiction), true (changed) or 0.
  function loopRule(g, clues, st, firstOnly) {
    const { find, lines } = components(g, st);
    if (!lines) return 0;
    // count lines per component and check for an already closed loop
    const compLines = new Map();
    for (let e = 0; e < g.NE; e++) if (st[e] === LINE) { const r = find(g.edgePoints[e][0]); compLines.set(r, (compLines.get(r) || 0) + 1); }
    let changed = 0;
    for (let e = 0; e < g.NE; e++) {
      if (st[e]) continue;
      const [p, q] = g.edgePoints[e];
      const a = find(p);
      if (a !== find(q)) continue;
      // would close a loop
      let ok = compLines.size === 1;
      if (ok) {
        // all clues satisfied with this edge as a line and every other unknown as a cross?
        st[e] = LINE;
        for (let i = 0; i < g.NC && ok; i++) {
          const n = clues[i]; if (n < 0) continue;
          let L = 0; for (const x of g.cellEdges[i]) if (st[x] === LINE) L++;
          if (L !== n) ok = false;
        }
        st[e] = UNK;
      }
      if (!ok) { st[e] = CROSS; changed = 1; if (firstOnly) return { e }; }
    }
    return changed ? true : 0;
  }
  function isSolution(g, clues, st) {
    for (let i = 0; i < g.NC; i++) {
      const n = clues[i]; if (n < 0) continue;
      let L = 0; for (const e of g.cellEdges[i]) if (st[e] === LINE) L++;
      if (L !== n) return false;
    }
    let lines = 0;
    for (let p = 0; p < g.NP; p++) {
      let L = 0; for (const e of g.pointEdges[p]) if (st[e] === LINE) L++;
      if (L !== 0 && L !== 2) return false;
    }
    const { find } = components(g, st);
    let root = -1;
    for (let e = 0; e < g.NE; e++) if (st[e] === LINE) { lines++; const r = find(g.edgePoints[e][0]); if (root < 0) root = r; else if (r !== root) return false; }
    return lines > 0;
  }

  const allKnown = (st) => { for (let e = 0; e < st.length; e++) if (!st[e]) return false; return true; };
  const fillCross = (st) => { const s = st.slice(); for (let e = 0; e < s.length; e++) if (!s[e]) s[e] = CROSS; return s; };

  /** Exact solver. Returns the number of solutions found (stops at `limit`); out receives the first. */
  function solve(g, clues, limit, out, start) {
    let count = 0, nodes = 0;
    function pickEdge(st) {
      // continue an open path first
      for (let p = 0; p < g.NP; p++) {
        const E = g.pointEdges[p]; let L = 0, u = -1;
        for (const e of E) { if (st[e] === LINE) L++; else if (!st[e]) u = e; }
        if (L === 1 && u >= 0) return u;
      }
      let best = -1, bs = -1;
      for (let i = 0; i < g.NC; i++) {
        if (clues[i] < 0) continue;
        for (const e of g.cellEdges[i]) if (!st[e]) { const s = clues[i] === 3 || clues[i] === 1 ? 2 : 1; if (s > bs) { bs = s; best = e; } }
      }
      if (best >= 0) return best;
      for (let e = 0; e < g.NE; e++) if (!st[e]) return e;
      return -1;
    }
    function rec(st) {
      if (count >= limit || ++nodes > 30000) return;
      if (!propagate(g, clues, st, true)) return;
      if (isSolution(g, clues, fillCross(st))) { count++; if (out && count === 1) out.set(fillCross(st)); return; }
      const e = pickEdge(st);
      if (e < 0) {
        if (isSolution(g, clues, st)) { count++; if (out && count === 1) out.set(st); }
        return;
      }
      const a = st.slice(); a[e] = LINE; rec(a);
      if (count >= limit) return;
      const b = st.slice(); b[e] = CROSS; rec(b);
    }
    rec(start ? Int8Array.from(start) : new Int8Array(g.NE));
    return nodes > 30000 ? Math.max(count, limit) : count; // give up = treat as not unique
  }

  // ── Human techniques ──────────────────────────────────────────────────────────────────────────────────
  // Each returns an array of deductions [[edge, state]...] (all it finds, or the first if `one`), plus info.
  function tBasic(g, clues, st, one) {
    const out = [], seen = new Set();
    const push = (e, s, why) => { if (!seen.has(e)) { seen.add(e); out.push([e, s, why]); } };
    for (let i = 0; i < g.NC; i++) {
      const n = clues[i]; if (n < 0) continue;
      const E = g.cellEdges[i]; let L = 0, X = 0;
      for (const e of E) { if (st[e] === LINE) L++; else if (st[e] === CROSS) X++; }
      if (L + X === 4) continue;
      if (L === n) for (const e of E) { if (!st[e]) push(e, CROSS, { cell: i }); }
      else if (4 - X === n) for (const e of E) { if (!st[e]) push(e, LINE, { cell: i }); }
      if (one && out.length) return out;
    }
    for (let p = 0; p < g.NP; p++) {
      const E = g.pointEdges[p]; let L = 0, U = 0, last = -1;
      for (const e of E) { if (st[e] === LINE) L++; else if (!st[e]) { U++; last = e; } }
      if (!U) continue;
      if (L === 2) for (const e of E) { if (!st[e]) push(e, CROSS, { point: p }); }
      else if (L === 1 && U === 1) push(last, LINE, { point: p });
      else if (L === 0 && U === 1) push(last, CROSS, { point: p });
      if (one && out.length) return out;
    }
    return out;
  }

  // Enumerate every way to fill a set of edges that respects the clues of `cells` and the 0-or-2 rule at
  // `points`; edges set in all of them are forced.
  function windowForce(g, clues, st, edges, cells, points) {
    const unk = edges.filter((e) => e >= 0 && !st[e]);
    if (!unk.length || unk.length > 13) return [];
    const idx = new Map(); unk.forEach((e, k) => idx.set(e, k));
    let andLine = (1 << unk.length) - 1, orLine = 0, any = false;
    const val = (e, mask) => (e < 0 ? CROSS : st[e] ? st[e] : (mask >> idx.get(e)) & 1 ? LINE : CROSS);
    const total = 1 << unk.length;
    for (let mask = 0; mask < total; mask++) {
      let ok = true;
      for (const i of cells) {
        let L = 0; for (const e of g.cellEdges[i]) if (val(e, mask) === LINE) L++;
        if (L !== clues[i]) { ok = false; break; }
      }
      if (!ok) continue;
      for (const p of points) {
        let L = 0; for (const e of g.pointEdges[p]) if (val(e, mask) === LINE) L++;
        if (L !== 0 && L !== 2) { ok = false; break; }
      }
      if (!ok) continue;
      any = true; andLine &= mask; orLine |= mask;
    }
    if (!any) return null; // contradiction
    const out = [];
    unk.forEach((e, k) => { if ((andLine >> k) & 1) out.push([e, LINE]); else if (!((orLine >> k) & 1)) out.push([e, CROSS]); });
    return out;
  }
  function cellWindow(g, i) {
    const edges = new Set(g.cellEdges[i]), points = [];
    for (const [p, a, b, o1, o2] of g.cellCorners[i]) { points.push(p); if (o1 >= 0) edges.add(o1); if (o2 >= 0) edges.add(o2); }
    return { edges: [...edges], points };
  }
  function tPattern(g, clues, st, one) {
    const out = [];
    for (let i = 0; i < g.NC; i++) {
      if (clues[i] < 0) continue;
      const w = cellWindow(g, i);
      const f = windowForce(g, clues, st, w.edges, [i], w.points);
      if (f === null) return null;
      for (const d of f) { d.push({ cell: i }); out.push(d); }
      if (one && out.length) return out;
    }
    return dedupe(out);
  }
  function tPair(g, clues, st, one) {
    const out = [];
    const { R, C } = g;
    for (let i = 0; i < g.NC; i++) {
      if (clues[i] < 0) continue;
      const r = (i / C) | 0, c = i % C;
      for (const j of [c < C - 1 ? i + 1 : -1, r < R - 1 ? i + C : -1, r < R - 1 && c < C - 1 ? i + C + 1 : -1, r < R - 1 && c > 0 ? i + C - 1 : -1]) {
        if (j < 0 || clues[j] < 0) continue;
        const a = cellWindow(g, i), b = cellWindow(g, j);
        const edges = [...new Set(a.edges.concat(b.edges))], points = [...new Set(a.points.concat(b.points))];
        const f = windowForce(g, clues, st, edges, [i, j], points);
        if (f === null) return null;
        for (const d of f) { d.push({ cells: [i, j] }); out.push(d); }
        if (one && out.length) return out;
      }
    }
    return dedupe(out);
  }
  function dedupe(arr) { const m = new Map(); for (const d of arr) if (!m.has(d[0])) m.set(d[0], d); return [...m.values()]; }
  function tLoop(g, clues, st, one) {
    const s = st.slice(), r = loopRule(g, clues, s, one);
    if (r === false) return null;
    const out = [];
    for (let e = 0; e < g.NE; e++) if (!st[e] && s[e]) out.push([e, s[e], { loop: true }]);
    return out;
  }

  // Inside / outside colouring with parity union-find. Node NC = outside of the board.
  function tColor(g, clues, st, one) {
    const N = g.NC + 1, par = new Int32Array(N), rel = new Int8Array(N); // rel: parity to parent
    for (let i = 0; i < N; i++) par[i] = i;
    function find(x) {
      let p = 0, y = x;
      while (par[y] !== y) { p ^= rel[y]; y = par[y]; }
      // compress
      let q = 0, z = x;
      while (par[z] !== z) { const nz = par[z], nr = rel[z]; par[z] = y; rel[z] = p ^ q; q ^= nr; z = nz; }
      return [y, p];
    }
    function union(a, b, d) {
      const [ra, pa] = find(a), [rb, pb] = find(b);
      if (ra === rb) return (pa ^ pb) === d;
      par[ra] = rb; rel[ra] = pa ^ pb ^ d;
      return true;
    }
    const side = (x) => (x < 0 ? g.NC : x);
    for (let e = 0; e < g.NE; e++) {
      if (!st[e]) continue;
      const [a, b] = g.edgeCells[e];
      if (!union(side(a), side(b), st[e] === LINE ? 1 : 0)) return null;
    }
    const out = [];
    const relOf = (a, b) => { const [ra, pa] = find(a), [rb, pb] = find(b); return ra === rb ? pa ^ pb : -1; };
    for (let e = 0; e < g.NE; e++) {
      if (st[e]) continue;
      const [a, b] = g.edgeCells[e];
      const r = relOf(side(a), side(b));
      if (r >= 0) { out.push([e, r ? LINE : CROSS, { color: true }]); if (one) return out; }
    }
    // clue + colours: the number of neighbours of another colour equals the clue
    for (let i = 0; i < g.NC; i++) {
      const n = clues[i]; if (n < 0) continue;
      const E = g.cellEdges[i];
      let D = 0, S = 0; const unknown = [];
      for (const e of E) {
        const [a, b] = g.edgeCells[e];
        const o = side(a === i ? b : a);
        const r = st[e] ? (st[e] === LINE ? 1 : 0) : relOf(i, o);
        if (r === 1) D++; else if (r === 0) S++; else unknown.push([e, o]);
      }
      if (!unknown.length) continue;
      // two unknown neighbours known to have the same / different colour from each other
      if (unknown.length >= 2) {
        for (let x = 0; x < unknown.length; x++) for (let y = x + 1; y < unknown.length; y++) {
          const r = relOf(unknown[x][1], unknown[y][1]);
          if (r === 1 && unknown.length === 2) {
            // exactly one of the two differs from i
            const need = n - D;
            if (need !== 1) return null;
          } else if (r === 0 && unknown.length === 2) {
            const need = n - D; // both differ (2) or both same (0)
            if (need === 0) { for (const [e] of unknown) out.push([e, CROSS, { color: true, cell: i }]); }
            else if (need === 2) { for (const [e] of unknown) out.push([e, LINE, { color: true, cell: i }]); }
            else return null;
            if (one && out.length) return out;
          }
        }
      }
    }
    return dedupe(out);
  }

  const TIERS = [
    ['basic', 1, tBasic],
    ['pattern', 2, tPattern],
    ['loop', 3, tLoop],
    ['pair', 3, tPair],
    ['color', 4, tColor],
  ];
  function applyAll(st, ds) { for (const d of ds) st[d[0]] = d[1]; }
  // Saturate with techniques up to `tier`; returns false on contradiction.
  function saturate(g, clues, st, tier) {
    for (let guard = 0; guard < 2000; guard++) {
      let progressed = false;
      for (const [, t, fn] of TIERS) {
        if (t > tier) break;
        const ds = fn(g, clues, st, false);
        if (ds === null) return false;
        if (ds.length) { applyAll(st, ds); progressed = true; break; }
      }
      if (!progressed) return checkConsistent(g, clues, st);
    }
    return true;
  }
  function checkConsistent(g, clues, st) {
    const s = st.slice();
    return propagate(g, clues, s, true);
  }
  // Cheap saturation for contradiction tests: basic rules, loops and inside/outside colouring.
  function saturateFast(g, clues, st) {
    for (let guard = 0; guard < 4000; guard++) {
      if (!propagate(g, clues, st, true)) return false;
      const ds = tColor(g, clues, st, false);
      if (ds === null) return false;
      if (!ds.length) return true;
      applyAll(st, ds);
    }
    return true;
  }
  // Contradiction: assume an edge, saturate with tiers 1–4; if it breaks, the other value is forced.
  function tContradiction(g, clues, st, one) {
    const out = [];
    const cand = [];
    for (let e = 0; e < g.NE; e++) {
      if (st[e]) continue;
      // near something known, to keep it fast
      const [p, q] = g.edgePoints[e];
      const deg1 = (pp) => { let L = 0; for (const x of g.pointEdges[pp]) if (st[x] === LINE) L++; return L === 1; };
      const near = deg1(p) || deg1(q) || g.edgeCells[e].some((c) => c >= 0 && (clues[c] === 3 || clues[c] === 1 || clues[c] === 2));
      if (near) cand.push(e);
    }
    for (const e of cand) {
      for (const [tryV, other] of [[LINE, CROSS], [CROSS, LINE]]) {
        const s = st.slice(); s[e] = tryV;
        if (!saturateFast(g, clues, s)) { out.push([e, other, { contradiction: true }]); if (one) return out; break; }
      }
      if (out.length >= 1) return out; // one at a time: it is expensive
    }
    return out;
  }
  const ALL_TIERS = TIERS.concat([['contradiction', 5, tContradiction]]);

  /** Next deduction from a position: {tech, tier, deductions:[[e,s,why]...]} or null. */
  function nextStep(g, clues, st, maxTier, one) {
    for (const [id, t, fn] of ALL_TIERS) {
      if (t > maxTier) break;
      const ds = fn(g, clues, st, one);
      if (ds === null) return { contradiction: true };
      if (ds.length) return { tech: id, tier: t, deductions: ds };
    }
    return null;
  }
  /** Grade: the hardest tier needed. {solved, tier, steps, hard}. */
  function grade(g, clues, opts) {
    opts = opts || {};
    const maxTier = opts.maxTier || 5;
    const st = new Int8Array(g.NE);
    let tier = 0, steps = 0, hard = 0;
    for (let guard = 0; guard < 5000; guard++) {
      if (isSolution(g, clues, fillCross(st))) break;
      const s = nextStep(g, clues, st, maxTier, false);
      if (!s || s.contradiction) return { solved: false, tier: maxTier + 1, steps };
      tier = Math.max(tier, s.tier); steps++;
      if (s.tier >= 4) hard++;
      applyAll(st, s.deductions);
      if (allKnown(st)) break;
    }
    // unknown edges left when the loop is complete become crosses
    return { solved: isSolution(g, clues, fillCross(st)), tier, steps, hard };
  }

  /** Hint from the player's marks: wrong marks first, otherwise the next deduction. */
  function hint(R, C, clueStr, solStr, user) {
    const g = geo(R, C), clues = parseClues(clueStr), sol = parseSol(solStr);
    const wrong = [];
    for (let e = 0; e < g.NE; e++) if (user[e] === LINE && sol[e] !== LINE) wrong.push(e); else if (user[e] === CROSS && sol[e] === LINE) wrong.push(e);
    if (wrong.length) return { wrong };
    const st = Int8Array.from(user);
    const s = nextStep(g, clues, st, 5, true);
    let ds, tech;
    if (s && !s.contradiction && s.deductions.length) { ds = s.deductions; tech = s.tech; }
    else {
      // beyond the techniques: show one edge of the solution
      const e = [...Array(g.NE).keys()].find((x) => !user[x] && sol[x] === LINE);
      if (e === undefined) return null;
      ds = [[e, LINE, {}]]; tech = 'trial';
    }
    const cells = new Set();
    for (const [e, , why] of ds) {
      if (why && why.cell !== undefined) cells.add(why.cell);
      if (why && why.cells) why.cells.forEach((c) => cells.add(c));
      for (const c of g.edgeCells[e]) if (c >= 0) cells.add(c);
    }
    return { tech, deductions: ds.map((d) => [d[0], d[1]]), cells: [...cells] };
  }

  // ── Generator ─────────────────────────────────────────────────────────────────────────────────────────
  const LEVELS = {
    1: { R: 5, C: 5, tier: 1, keep: [0.45, 0.6] },
    2: { R: 7, C: 7, tier: 1, keep: [0.35, 0.5] },
    3: { R: 8, C: 8, tier: 2 },
    4: { R: 10, C: 10, tier: 3 },
    5: { R: 12, C: 12, tier: 4 },
    6: { R: 15, C: 15, tier: 5 },
  };
  const clueStr = (cl) => Array.from(cl, (n) => (n < 0 ? '.' : String(n))).join('');
  function parseClues(s) { const a = new Int8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s[i] === '.' ? -1 : +s[i]; return a; }
  const solStr = (sol) => Array.from(sol, (x) => (x === LINE ? '1' : '0')).join('');
  function parseSol(s) { const a = new Int8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s[i] === '1' ? LINE : CROSS; return a; }

  function* generate(level, seed) {
    const cfg = LEVELS[level], g = geo(cfg.R, cfg.C);
    seed = seed >>> 0;
    for (let attempt = 0; ; attempt++) {
      const rng = makeRng(seed, attempt);
      const region = randomRegion(cfg.R, cfg.C, rng);
      const sol = loopFromRegion(g, region);
      const full = cluesFromLoop(g, sol);
      const clues = Int8Array.from(full);
      const minKeep = cfg.keep ? Math.round(g.NC * (cfg.keep[0] + rng() * (cfg.keep[1] - cfg.keep[0]))) : 0;
      let kept = g.NC;
      yield { attempt, phase: 'loop' };
      const order = rng.shuffle([...Array(g.NC).keys()]);
      // A clue can go if the puzzle is still solved by pure deduction within the target tier. Sound
      // deductions that reach the loop also prove the solution is unique, so no exact solver is needed.
      // The contradiction tier is expensive: carve up to tier 4 first, then try to take more clues away.
      const firstTier = Math.min(cfg.tier, 4);
      let n = 0;
      for (const i of order) {
        if (kept <= minKeep) break;
        const v = clues[i]; clues[i] = -1;
        if (grade(g, clues, { maxTier: firstTier }).solved) kept--; else clues[i] = v;
        if (++n % 12 === 0) yield { attempt, phase: 'carve' };
      }
      if (cfg.tier === 5) {
        let extra = 0;
        for (const i of order) {
          if (clues[i] < 0) continue;
          const v = clues[i]; clues[i] = -1;
          const r = grade(g, clues, { maxTier: 5 });
          if (r.solved) { kept--; if (r.tier === 5 && ++extra >= 3) break; } else clues[i] = v;
          yield { attempt, phase: 'deep' };
        }
      }
      const gr = grade(g, clues, { maxTier: cfg.tier });
      yield { attempt, phase: 'grade', tier: gr.tier };
      if (gr.solved && gr.tier === cfg.tier) {
        return { R: cfg.R, C: cfg.C, level, clues: clueStr(clues), solution: solStr(sol), tier: gr.tier, clueCount: kept,
          seed, code: encodeCode(level, seed), engine: ENGINE_VERSION };
      }
    }
  }
  function generateSync(level, seed) { const it = generate(level, seed); let r; while (!(r = it.next()).done); return r.value; }

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
    if (!(level >= 1 && level <= 6)) return null;
    let n = 0;
    for (const ch of raw.slice(1)) { const k = B32.indexOf(ch); if (k < 0) return null; n = n * 32 + k; }
    if (n > 0xffffffff) return null;
    return { level, seed: n >>> 0 };
  }

  const api = {
    ENGINE_VERSION, UNK, LINE, CROSS, LEVELS, geo, solve, grade, hint, generate, generateSync,
    encodeCode, decodeCode, parseClues, parseSol, isSolution, makeRng,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CircuitEngine = api;
})(typeof self !== 'undefined' ? self : this);
