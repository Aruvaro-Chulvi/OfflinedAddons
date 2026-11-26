/* Engine for the Offlined «Calcudoku» addon — MIT licence.
 *
 * An N×N grid holds 1..N once in every row and column. The grid is split into cages; each cage shows a target
 * and an operation (+ − × ÷), or just a number for a single cell.
 *
 * - step(): logical solver, easiest technique first: singles, cage combinations, cage-in-a-line, naked / hidden
 *   pairs, line sums (a row adds up to N(N+1)/2), naked triples, X-Wing. Used for grading and hints.
 * - generate(): random Latin square → random cages → operations; a puzzle is accepted only if the logical
 *   solver finishes it with the techniques its level allows (which also proves the solution is unique) AND it
 *   needs at least the level's minimum technique: levels differ by the reasoning they ask for, not only by size.
 *   Seeded: a game code always gives the same puzzle. A JS generator function (yields between attempts) driven
 *   by a Web Worker.
 *
 * Changing the generator changes which puzzle a code gives: bump ENGINE_VERSION when you do.
 */
(function (root) {
  'use strict';
  const ENGINE_VERSION = 2;

  // minRank / maxRank: the hardest technique a puzzle of this level must need / may need (see RANK).
  const LEVELS = {
    1: { N: 4, ops: '+', maxCage: 3, singles: [1, 2], minRank: 0, maxRank: 2 },
    2: { N: 5, ops: '+-', maxCage: 3, singles: [1, 2], minRank: 2, maxRank: 3 },
    3: { N: 6, ops: '+-*/', maxCage: 4, singles: [1, 2], minRank: 3, maxRank: 4 },
    4: { N: 7, ops: '+-*/', maxCage: 4, singles: [0, 1], minRank: 4, maxRank: 5 },
    5: { N: 8, ops: '+-*/', maxCage: 4, singles: [0, 1], minRank: 5, maxRank: 6 },
    6: { N: 9, ops: '+-*/', maxCage: 5, singles: [0, 1], minRank: 6, maxRank: 6 },
  };
  // How hard each technique is for a person (the level of a puzzle is its hardest step).
  const RANK = { given: 0, naked_single: 1, hidden_single: 1, cage: 2, cage_line: 3, naked_pair: 4, hidden_pair: 4,
    line_sum: 5, naked_triple: 6, x_wing: 6 };

  const POP = new Uint8Array(1024);
  for (let m = 1; m < 1024; m++) POP[m] = POP[m >> 1] + (m & 1);
  const bit = (d) => 1 << (d - 1);
  const dOf = (m) => 32 - Math.clz32(m);
  const digits = (m) => { const a = []; for (let d = 1; m; d++, m >>= 1) if (m & 1) a.push(d); return a; };

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

  // ── Random Latin square (backtracking with random order) ──────────────────────────────────────────────
  function latin(N, rng) {
    const g = new Int8Array(N * N), rowU = new Int16Array(N), colU = new Int16Array(N);
    function rec(i) {
      if (i === N * N) return true;
      const r = (i / N) | 0, c = i % N;
      const free = ((1 << N) - 1) & ~(rowU[r] | colU[c]);
      const ds = rng.shuffle(digits(free));
      for (const d of ds) {
        const b = bit(d);
        g[i] = d; rowU[r] |= b; colU[c] |= b;
        if (rec(i + 1)) return true;
        rowU[r] &= ~b; colU[c] &= ~b;
      }
      g[i] = 0;
      return false;
    }
    rec(0);
    return g;
  }

  // ── Cages ─────────────────────────────────────────────────────────────────────────────────────────────
  function makeCages(N, sol, rng, cfg) {
    const owner = new Int16Array(N * N).fill(-1), cages = [];
    const nb = (i) => { const r = (i / N) | 0, c = i % N, o = []; if (r > 0) o.push(i - N); if (r < N - 1) o.push(i + N); if (c > 0) o.push(i - 1); if (c < N - 1) o.push(i + 1); return o; };
    const singlesWanted = cfg.singles[0] + rng.int(cfg.singles[1] - cfg.singles[0] + 1);
    let singles = 0;
    for (const start of rng.shuffle([...Array(N * N).keys()])) {
      if (owner[start] >= 0) continue;
      // size: mostly 2–3, some bigger
      const roll = rng();
      let size = roll < 0.42 ? 2 : roll < 0.78 ? 3 : roll < 0.94 ? 4 : 5;
      if (size > cfg.maxCage) size = cfg.maxCage;
      const cells = [start]; owner[start] = cages.length;
      while (cells.length < size) {
        const opts = [];
        for (const x of cells) for (const y of nb(x)) if (owner[y] < 0 && !opts.includes(y)) opts.push(y);
        if (!opts.length) break;
        const y = opts[rng.int(opts.length)];
        owner[y] = cages.length; cells.push(y);
      }
      if (cells.length === 1) {
        // merge a lonely cell into a neighbouring cage unless we still want singles
        if (singles < singlesWanted) singles++;
        else {
          const ns = nb(start).filter((y) => owner[y] >= 0 && owner[y] !== cages.length && cages[owner[y]].cells.length < cfg.maxCage);
          if (ns.length) { const k = owner[ns[rng.int(ns.length)]]; owner[start] = k; cages[k].cells.push(start); continue; }
        }
      }
      cages.push({ cells });
    }
    for (const cg of cages) assignOp(cg, sol, rng, cfg);
    return cages;
  }
  function assignOp(cg, sol, rng, cfg) {
    const v = cg.cells.map((i) => sol[i]);
    if (v.length === 1) { cg.op = '='; cg.target = v[0]; return; }
    const choices = [];
    if (v.length === 2) {
      const a = Math.max(v[0], v[1]), b = Math.min(v[0], v[1]);
      if (cfg.ops.includes('/') && a % b === 0 && a !== b) choices.push('/', '/');
      if (cfg.ops.includes('-')) choices.push('-', '-');
      if (cfg.ops.includes('*')) choices.push('*');
      choices.push('+');
    } else {
      choices.push('+');
      if (cfg.ops.includes('*')) choices.push('*');
    }
    const op = choices[rng.int(choices.length)];
    cg.op = op;
    if (op === '+') cg.target = v.reduce((s, x) => s + x, 0);
    else if (op === '*') cg.target = v.reduce((s, x) => s * x, 1);
    else if (op === '-') cg.target = Math.abs(v[0] - v[1]);
    else cg.target = Math.max(v[0], v[1]) / Math.min(v[0], v[1]);
  }

  // ── Logic ─────────────────────────────────────────────────────────────────────────────────────────────
  function setup(N, cages) {
    const cageOf = new Int16Array(N * N);
    cages.forEach((cg, k) => { for (const i of cg.cells) cageOf[i] = k; });
    return { N, cages, cageOf };
  }
  // All value tuples of a cage that fit the candidates, the operation and row/column uniqueness inside it.
  function cageOptions(P, cand, k, req) {
    const { N } = P, cg = typeof k === 'number' ? P.cages[k] : k, cells = cg.cells, n = cells.length;
    const union = new Int16Array(n);
    let count = 0;
    const vals = new Int8Array(n);
    const t = cg.target, op = cg.op;
    function ok() {
      if (op === '=') return vals[0] === t;
      if (op === '-') return Math.abs(vals[0] - vals[1]) === t;
      if (op === '/') { const a = Math.max(vals[0], vals[1]), b = Math.min(vals[0], vals[1]); return a === b * t; }
      return true;
    }
    function rec(j, acc) {
      if (j === n) {
        if (op === '+' && acc !== t) return;
        if (op === '*' && acc !== t) return;
        if (!ok()) return;
        if (req) { let has = false; for (let x = 0; x < n; x++) if (vals[x] === req.d && req.cells.has(cells[x])) { has = true; break; } if (!has) return; }
        count++;
        for (let x = 0; x < n; x++) union[x] |= bit(vals[x]);
        return;
      }
      const ci = cells[j], r = (ci / N) | 0, c = ci % N;
      let m = cand[ci];
      while (m) {
        const b = m & -m; m ^= b;
        const d = dOf(b);
        let clash = false;
        for (let x = 0; x < j; x++) { const cx = cells[x]; if (vals[x] === d && (((cx / N) | 0) === r || cx % N === c)) { clash = true; break; } }
        if (clash) continue;
        let na = acc;
        if (op === '+') { na = acc + d; if (na + (n - j - 1) > t) continue; if (na + (n - j - 1) * N < t) continue; }
        else if (op === '*') { na = acc * d; if (t % na !== 0) continue; }
        vals[j] = d;
        rec(j + 1, na);
      }
    }
    rec(0, op === '*' ? 1 : 0);
    return { count, union };
  }
  function initCand(P, values) {
    const { N } = P, full = (1 << N) - 1, cand = new Int16Array(N * N);
    for (let i = 0; i < N * N; i++) cand[i] = values && values[i] ? bit(values[i]) : full;
    // remove placed values from rows and columns
    for (let i = 0; i < N * N; i++) {
      if (!(values && values[i])) continue;
      const r = (i / N) | 0, c = i % N, b = bit(values[i]);
      for (let x = 0; x < N; x++) { if (x !== c) cand[r * N + x] &= ~b; if (x !== r) cand[x * N + c] &= ~b; }
    }
    return cand;
  }
  function lines(N) { const L = []; for (let r = 0; r < N; r++) { const u = []; for (let c = 0; c < N; c++) u.push(r * N + c); L.push(u); } for (let c = 0; c < N; c++) { const u = []; for (let r = 0; r < N; r++) u.push(r * N + c); L.push(u); } return L; }
  const LINES = {};
  const linesOf = (N) => LINES[N] || (LINES[N] = lines(N));

  /**
   * One deduction from candidates. Returns {tech, elim:[[cell, digit]...], place?:[cell, digit], cells:[...]} or
   * {contradiction:true} or null. Only techniques up to maxRank are tried (all when it is undefined).
   */
  function step(P, cand, done, maxRank) {
    const { N } = P, L = linesOf(N);
    const allow = (tech) => maxRank === undefined || RANK[tech] <= maxRank;
    // naked single (not yet "placed")
    for (let i = 0; i < N * N; i++) {
      if (!cand[i]) return { contradiction: true };
      if (!done[i] && POP[cand[i]] === 1) return { tech: P.cages[P.cageOf[i]].cells.length === 1 ? 'given' : 'naked_single', place: [i, dOf(cand[i])], elim: [], cells: [i] };
    }
    // hidden single in a row / column
    for (let u = 0; u < L.length; u++) {
      for (let d = 1; d <= N; d++) {
        const b = bit(d); let n = 0, at = -1;
        for (const i of L[u]) if (cand[i] & b) { n++; at = i; }
        if (n === 0) return { contradiction: true };
        if (n === 1 && !done[at]) return { tech: 'hidden_single', place: [at, d], elim: [], cells: L[u].slice() };
      }
    }
    // cage combinations
    if (!allow('cage')) return null;
    for (let k = 0; k < P.cages.length; k++) {
      const cg = P.cages[k];
      if (cg.cells.every((i) => done[i])) continue;
      const { count, union } = cageOptions(P, cand, k);
      if (!count) return { contradiction: true };
      const elim = [];
      cg.cells.forEach((i, x) => { for (const d of digits(cand[i] & ~union[x])) elim.push([i, d]); });
      if (elim.length) return { tech: 'cage', elim, cells: cg.cells.slice(), cage: k };
    }
    // a digit confined to one cage inside a line must be in that cage
    if (!allow('cage_line')) return null;
    for (let u = 0; u < L.length; u++) {
      for (let d = 1; d <= N; d++) {
        const b = bit(d), where = L[u].filter((i) => cand[i] & b);
        if (where.length < 2) continue;
        const k = P.cageOf[where[0]];
        if (!where.every((i) => P.cageOf[i] === k)) continue;
        // d must go in this line, and only cage k can hold it here: keep only the cage options that put d in
        // one of those cells, and remove what no such option uses
        const cg = P.cages[k];
        const { count, union } = cageOptions(P, cand, k, { d, cells: new Set(where) });
        if (!count) return { contradiction: true };
        const elim = [];
        cg.cells.forEach((i, x) => { for (const dd of digits(cand[i] & ~union[x])) elim.push([i, dd]); });
        if (elim.length) return { tech: 'cage_line', elim, cells: cg.cells.slice(), cage: k };
      }
    }
    // naked pair in a line
    if (!allow('naked_pair')) return null;
    for (let u = 0; u < L.length; u++) {
      const U = L[u];
      for (let a = 0; a < N; a++) {
        const ma = cand[U[a]]; if (POP[ma] !== 2) continue;
        for (let b2 = a + 1; b2 < N; b2++) {
          if (cand[U[b2]] !== ma) continue;
          const elim = [];
          for (let x = 0; x < N; x++) if (x !== a && x !== b2) for (const d of digits(cand[U[x]] & ma)) elim.push([U[x], d]);
          if (elim.length) return { tech: 'naked_pair', elim, cells: [U[a], U[b2]] };
        }
      }
    }
    // hidden pair in a line: two digits that can only go in the same two cells
    for (let u = 0; u < L.length; u++) {
      const U = L[u], pos = [];
      for (let d = 1; d <= N; d++) { let m = 0; U.forEach((i, x) => { if (cand[i] & bit(d)) m |= 1 << x; }); pos.push(m); }
      for (let d1 = 0; d1 < N; d1++) {
        if (POP[pos[d1]] !== 2) continue;
        for (let d2 = d1 + 1; d2 < N; d2++) {
          if (pos[d2] !== pos[d1]) continue;
          const keep = bit(d1 + 1) | bit(d2 + 1), cells = [], elim = [];
          U.forEach((i, x) => { if (pos[d1] & (1 << x)) { cells.push(i); for (const d of digits(cand[i] & ~keep)) elim.push([i, d]); } });
          if (elim.length) return { tech: 'hidden_pair', elim, cells };
        }
      }
    }
    // line sum: a row (or two neighbouring rows) adds up to N(N+1)/2 each; take away the sum cages that lie
    // entirely inside and what is already placed: the few cells left behave like a hidden «+» cage
    if (!allow('line_sum')) return null;
    for (const S of lineSets(N)) {
      const inSet = new Set(S.cells);
      let left = S.total;
      const rest = [], seen = new Set();
      for (const i of S.cells) {
        if (seen.has(i)) continue;
        const k = P.cageOf[i], cg = P.cages[k];
        if ((cg.op === '+' || cg.op === '=') && cg.cells.every((x) => inSet.has(x))) { left -= cg.target; for (const x of cg.cells) seen.add(x); continue; }
        seen.add(i);
        if (done[i]) left -= dOf(cand[i]); else rest.push(i);
      }
      if (!rest.length || rest.length > 4 || rest.length === S.cells.length) continue;
      const { count, union } = cageOptions(P, cand, { cells: rest, op: '+', target: left });
      if (!count) return { contradiction: true };
      const elim = [];
      rest.forEach((i, x) => { for (const d of digits(cand[i] & ~union[x])) elim.push([i, d]); });
      if (elim.length) return { tech: 'line_sum', elim, cells: rest.slice() };
    }
    // naked triple in a line: three cells that together can only hold three digits
    if (!allow('naked_triple')) return null;
    for (let u = 0; u < L.length; u++) {
      const U = L[u], open = U.filter((i) => POP[cand[i]] >= 2 && POP[cand[i]] <= 3);
      for (let a = 0; a < open.length; a++) for (let b2 = a + 1; b2 < open.length; b2++) for (let c2 = b2 + 1; c2 < open.length; c2++) {
        const m = cand[open[a]] | cand[open[b2]] | cand[open[c2]];
        if (POP[m] !== 3) continue;
        const trio = [open[a], open[b2], open[c2]], elim = [];
        for (const i of U) if (!trio.includes(i)) for (const d of digits(cand[i] & m)) elim.push([i, d]);
        if (elim.length) return { tech: 'naked_triple', elim, cells: trio };
      }
    }
    // X-Wing: in two rows a digit fits only in the same two columns → not elsewhere in those columns (and the
    // same with rows and columns swapped)
    for (let d = 1; d <= N; d++) {
      const b = bit(d);
      for (const byRow of [true, false]) {
        const at = (a, x) => (byRow ? a * N + x : x * N + a);
        const masks = [];
        for (let a = 0; a < N; a++) { let m = 0; for (let x = 0; x < N; x++) if (cand[at(a, x)] & b) m |= 1 << x; masks.push(m); }
        for (let a1 = 0; a1 < N; a1++) {
          if (POP[masks[a1]] !== 2) continue;
          for (let a2 = a1 + 1; a2 < N; a2++) {
            if (masks[a2] !== masks[a1]) continue;
            const xs = []; for (let x = 0; x < N; x++) if (masks[a1] & (1 << x)) xs.push(x);
            const elim = [];
            for (const x of xs) for (let a = 0; a < N; a++) if (a !== a1 && a !== a2 && (cand[at(a, x)] & b)) elim.push([at(a, x), d]);
            if (elim.length) return { tech: 'x_wing', elim, cells: [at(a1, xs[0]), at(a1, xs[1]), at(a2, xs[0]), at(a2, xs[1])] };
          }
        }
      }
    }
    return null;
  }
  // Rows, columns, and pairs of neighbouring rows / columns, with what their cells add up to.
  const SETS = {};
  function lineSets(N) {
    if (SETS[N]) return SETS[N];
    const T = (N * (N + 1)) / 2, out = [];
    const row = (r) => Array.from({ length: N }, (_, c) => r * N + c), col = (c) => Array.from({ length: N }, (_, r) => r * N + c);
    for (let k = 0; k < N; k++) { out.push({ cells: row(k), total: T }); out.push({ cells: col(k), total: T }); }
    for (let k = 0; k + 1 < N; k++) { out.push({ cells: row(k).concat(row(k + 1)), total: 2 * T }); out.push({ cells: col(k).concat(col(k + 1)), total: 2 * T }); }
    return (SETS[N] = out);
  }

  function applyStep(P, cand, done, s) {
    const { N } = P;
    for (const [i, d] of s.elim) cand[i] &= ~bit(d);
    if (s.place) {
      const [i, d] = s.place, r = (i / N) | 0, c = i % N, b = bit(d);
      cand[i] = b; done[i] = 1;
      for (let x = 0; x < N; x++) { if (x !== c) cand[r * N + x] &= ~b; if (x !== r) cand[x * N + c] &= ~b; }
    }
  }
  /** Solve by logic only, with techniques up to maxRank (all when undefined). {solved, hardest, steps}. */
  function grade(P, values, maxRank) {
    const N = P.N, cand = initCand(P, values), done = new Uint8Array(N * N);
    if (values) for (let i = 0; i < N * N; i++) if (values[i]) done[i] = 1;
    let hardest = 'given', steps = 0;
    for (let guard = 0; guard < 20000; guard++) {
      if (done.every((x) => x)) return { solved: true, hardest, steps };
      const s = step(P, cand, done, maxRank);
      if (!s || s.contradiction) return { solved: false, hardest, steps };
      if (RANK[s.tech] > RANK[hardest]) hardest = s.tech;
      applyStep(P, cand, done, s);
      steps++;
    }
    return { solved: false, hardest, steps };
  }

  /** Next placement a person can make from the board values; wrong values first. */
  function hint(N, cagesData, solStr, values) {
    const sol = [...solStr].map(Number);
    const wrong = [];
    for (let i = 0; i < N * N; i++) if (values[i] && values[i] !== sol[i]) wrong.push(i);
    if (wrong.length) return { wrong };
    const P = setup(N, cagesData);
    const cand = initCand(P, values), done = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) if (values[i]) done[i] = 1;
    let hardest = null, hl = null;
    for (let guard = 0; guard < 2000; guard++) {
      const s = step(P, cand, done);
      if (!s || s.contradiction) break;
      if (!hardest || RANK[s.tech] >= RANK[hardest]) { hardest = s.tech; hl = s.cells; }
      if (s.place) return { cell: s.place[0], digit: s.place[1], tech: hardest, techCells: hl, region: s.cells };
      applyStep(P, cand, done, s);
    }
    const i = values.findIndex((v) => !v);
    return i < 0 ? null : { cell: i, digit: sol[i], tech: 'trial', techCells: [i], region: [i] };
  }

  // ── Generator ─────────────────────────────────────────────────────────────────────────────────────────
  function* generate(level, seed) {
    const cfg = LEVELS[level], N = cfg.N;
    seed = seed >>> 0;
    for (let attempt = 0; ; attempt++) {
      const rng = makeRng(seed, attempt);
      const sol = latin(N, rng);
      for (let k = 0; k < 6; k++) {
        const cages = makeCages(N, sol, rng, cfg);
        const P = setup(N, cages);
        const g = grade(P, null, cfg.maxRank);
        yield { attempt, try: k };
        if (g.solved && RANK[g.hardest] >= cfg.minRank) {
          return { N, level, cages: cages.map((c) => ({ cells: c.cells, op: c.op, target: c.target })), solution: Array.from(sol).join(''),
            hardest: g.hardest, seed, code: encodeCode(level, seed), engine: ENGINE_VERSION };
        }
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

  // Exact count of solutions (tests only).
  function countSolutions(N, cagesData, limit) {
    const P = setup(N, cagesData);
    let count = 0;
    function rec(cand, done) {
      if (count >= limit) return;
      // propagate with the logical steps
      for (;;) {
        if (done.every((x) => x)) { count++; return; }
        const s = step(P, cand, done);
        if (s && s.contradiction) return;
        if (!s) break;
        applyStep(P, cand, done, s);
      }
      let best = -1;
      for (let i = 0; i < N * N; i++) if (!done[i] && (best < 0 || POP[cand[i]] < POP[cand[best]])) best = i;
      for (const d of digits(cand[best])) {
        const c2 = cand.slice(), d2 = done.slice();
        applyStep(P, c2, d2, { elim: [], place: [best, d] });
        rec(c2, d2);
      }
    }
    rec(initCand(P, null), new Uint8Array(N * N));
    return count;
  }

  const api = { ENGINE_VERSION, LEVELS, RANK, generate, generateSync, grade, hint, encodeCode, decodeCode, setup, countSolutions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalcEngine = api;
})(typeof self !== 'undefined' ? self : this);
