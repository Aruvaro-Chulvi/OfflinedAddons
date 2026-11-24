/* Escoba del 15 — rules and computer players for the Offlined «Escoba» addon. MIT licence.
 *
 * Two players. Card values: 1..7 as printed, sota 8, caballo 9, rey 10. With one card from your hand you take
 * table cards that add up to 15 together with it; clearing the table is an «escoba». At the end of each hand:
 * 1 point per escoba, 1 for most cards, 1 for most oros, 1 for the siete de oros, 1 for most sietes.
 */
(function (root) {
  'use strict';
  const C = root.SpanishCards || (typeof require !== 'undefined' ? require('./cards.js') : null);
  const val = (id) => C.rankOf(id);
  const isOro = (id) => C.suitOf(id) === 0;
  const isSiete = (id) => C.rankOf(id) === 7;
  const SIETE_OROS = 6; // suit 0, rank 7

  /** Every subset of `table` that adds up to `need`. */
  function subsets(table, need) {
    const out = [], n = table.length;
    for (let m = 1; m < 1 << n; m++) {
      let s = 0;
      for (let k = 0; k < n; k++) if (m & (1 << k)) s += val(table[k]);
      if (s === need) { const sub = []; for (let k = 0; k < n; k++) if (m & (1 << k)) sub.push(table[k]); out.push(sub); }
    }
    return out;
  }
  /** Legal moves for a hand: {card, take: [] (drop) or [table cards]} */
  function moves(hand, table) {
    const out = [];
    for (const c of hand) {
      const caps = subsets(table, 15 - val(c));
      for (const sub of caps) out.push({ card: c, take: sub });
      out.push({ card: c, take: [] });
    }
    return out;
  }

  // ── Game state ────────────────────────────────────────────────────────────────────────────────────────
  // s = {hands:[[],[]], table:[], stock:[], won:[[],[]], escobas:[0,0], dealer, turn, last, log:[]}
  function newHand(dealer, rnd) {
    const stock = C.shuffle(C.deck(), rnd);
    const s = { hands: [[], []], table: [], stock, won: [[], []], escobas: [0, 0], dealer, turn: 1 - dealer, last: -1, events: [] };
    s.table = stock.splice(0, 4);
    deal(s);
    // The dealer takes an initial table of 15 (one escoba) or 30 (two).
    const sum = s.table.reduce((a, c) => a + val(c), 0);
    if (sum === 15 || sum === 30) {
      s.won[dealer].push(...s.table);
      s.escobas[dealer] += sum === 30 ? 2 : 1;
      s.events.push({ type: 'initial', player: dealer, cards: s.table.slice(), escobas: sum === 30 ? 2 : 1 });
      s.table = [];
      s.last = dealer;
    }
    return s;
  }
  function deal(s) {
    const first = 1 - s.dealer;
    for (let k = 0; k < 3; k++) for (const p of [first, s.dealer]) if (s.stock.length) s.hands[p].push(s.stock.shift());
  }
  /** Apply a move for the player to move. Returns {escoba, dealt, handOver}. */
  function play(s, mv) {
    const p = s.turn;
    const h = s.hands[p];
    h.splice(h.indexOf(mv.card), 1);
    let escoba = false;
    if (mv.take.length) {
      for (const c of mv.take) s.table.splice(s.table.indexOf(c), 1);
      s.won[p].push(mv.card, ...mv.take);
      s.last = p;
      if (!s.table.length) { s.escobas[p]++; escoba = true; }
    } else s.table.push(mv.card);
    s.turn = 1 - p;
    let dealt = false, handOver = false;
    if (!s.hands[0].length && !s.hands[1].length) {
      if (s.stock.length) { deal(s); dealt = true; s.turn = 1 - s.dealer; }
      else {
        // the last player who took anything gets what is left
        if (s.table.length && s.last >= 0) { s.won[s.last].push(...s.table); s.events.push({ type: 'rest', player: s.last, cards: s.table.slice() }); s.table = []; }
        handOver = true;
      }
    }
    return { escoba, dealt, handOver };
  }
  /** Points of a finished hand: {rows:{escobas, cartas, oros, sieteOros, sietes}: [a,b], total:[a,b]} */
  function score(s) {
    const cnt = (p, f) => s.won[p].filter(f).length;
    const most = (a, b) => (a > b ? [1, 0] : b > a ? [0, 1] : [0, 0]);
    const rows = {
      escobas: s.escobas.slice(),
      cartas: most(s.won[0].length, s.won[1].length),
      oros: most(cnt(0, isOro), cnt(1, isOro)),
      sieteOros: [s.won[0].includes(SIETE_OROS) ? 1 : 0, s.won[1].includes(SIETE_OROS) ? 1 : 0],
      sietes: most(cnt(0, isSiete), cnt(1, isSiete)),
    };
    const total = [0, 0];
    for (const k in rows) { total[0] += rows[k][0]; total[1] += rows[k][1]; }
    const detail = { cards: [s.won[0].length, s.won[1].length], oros: [cnt(0, isOro), cnt(1, isOro)], sietes: [cnt(0, isSiete), cnt(1, isSiete)] };
    return { rows, total, detail };
  }

  // ── Computer players ──────────────────────────────────────────────────────────────────────────────────
  // Immediate value of a move for the mover (cards taken, oros, sietes, escoba).
  function gain(mv, tableAfterEmpty) {
    if (!mv.take.length) return 0;
    const cards = [mv.card, ...mv.take];
    let g = cards.length * 1;
    for (const c of cards) { if (isOro(c)) g += 2; if (isSiete(c)) g += 3; if (c === SIETE_OROS) g += 10; }
    if (tableAfterEmpty) g += 22;
    return g;
  }
  function tableAfter(table, mv) {
    if (mv.take.length) return table.filter((c) => !mv.take.includes(c));
    return table.concat([mv.card]);
  }
  // Risk: how likely the opponent can sweep the table we leave, from the cards we cannot see.
  function risk(tbl, unseen) {
    const sum = tbl.reduce((a, c) => a + val(c), 0);
    const need = 15 - sum;
    let r = 0;
    if (need >= 1 && need <= 10) {
      const k = unseen.filter((c) => val(c) === need).length;
      r += (k / Math.max(1, unseen.length)) * 3 * 22; // ~3 cards in their hand
    }
    // valuable cards left on the table can be taken
    for (const c of tbl) { if (c === SIETE_OROS) r += 6; else if (isSiete(c)) r += 2; }
    return r;
  }
  function unseenFor(s, p) {
    const seen = new Set([...s.hands[p], ...s.table, ...s.won[0], ...s.won[1]]);
    return C.deck().filter((c) => !seen.has(c));
  }
  function heuristic(s, p, withRisk) {
    const ms = moves(s.hands[p], s.table);
    const unseen = withRisk ? unseenFor(s, p) : null;
    let best = null, bv = -Infinity;
    for (const mv of ms) {
      const t = tableAfter(s.table, mv);
      let v = gain(mv, mv.take.length && !t.length);
      if (!mv.take.length) v -= val(mv.card) === 7 ? 4 : isOro(mv.card) ? 1.5 : 0; // keep good cards
      if (withRisk) v -= risk(t, unseen);
      v += Math.random() * 0.01;
      if (v > bv) { bv = v; best = mv; }
    }
    return best;
  }
  function randomish(s, p) {
    const ms = moves(s.hands[p], s.table);
    const esc = ms.find((m) => m.take.length && m.take.length === s.table.length);
    if (esc) return esc;
    const caps = ms.filter((m) => m.take.length);
    if (caps.length && Math.random() < 0.6) return caps[(Math.random() * caps.length) | 0];
    return ms[(Math.random() * ms.length) | 0];
  }
  function clone(s) {
    return { hands: [s.hands[0].slice(), s.hands[1].slice()], table: s.table.slice(), stock: s.stock.slice(), won: [s.won[0].slice(), s.won[1].slice()],
      escobas: s.escobas.slice(), dealer: s.dealer, turn: s.turn, last: s.last, events: [] };
  }
  // Monte Carlo: give the hidden cards at random, play the rest of the hand with the heuristic, compare points.
  function monteCarlo(s, p, budgetMs) {
    const ms = moves(s.hands[p], s.table);
    if (ms.length === 1) return ms[0];
    const unseen = unseenFor(s, p);
    const oppN = s.hands[1 - p].length;
    const sum = new Float64Array(ms.length), n = new Int32Array(ms.length);
    const t0 = Date.now();
    let it = 0;
    while (Date.now() - t0 < budgetMs || it < ms.length * 6) {
      const pool = C.shuffle(unseen.slice());
      const base = clone(s);
      base.hands[1 - p] = pool.slice(0, oppN);
      base.stock = pool.slice(oppN);
      for (let k = 0; k < ms.length; k++) {
        const g = clone(base);
        play(g, { card: ms[k].card, take: ms[k].take.slice() });
        for (let guard = 0; guard < 80; guard++) {
          if (!g.hands[0].length && !g.hands[1].length) break;
          const q = g.turn;
          const mv = heuristic(g, q, true);
          const r = play(g, mv);
          if (r.handOver) break;
        }
        const sc = score(g);
        // points difference, plus a little for raw cards (tie breaks)
        sum[k] += sc.total[p] - sc.total[1 - p] + (sc.detail.cards[p] - sc.detail.cards[1 - p]) * 0.02;
        n[k]++;
      }
      it++;
      if (Date.now() - t0 > budgetMs * 3) break;
    }
    let best = 0;
    for (let k = 1; k < ms.length; k++) if (sum[k] / n[k] > sum[best] / n[best]) best = k;
    return ms[best];
  }
  /** Move for player p at level 1..4 ('hint' = level 4). */
  function choose(s, p, level) {
    if (level === 1) return randomish(s, p);
    if (level === 2) return heuristic(s, p, false);
    if (level === 3) return heuristic(s, p, true);
    return monteCarlo(s, p, level === 'hint' ? 500 : 350);
  }

  const api = { val, subsets, moves, newHand, deal, play, score, choose, SIETE_OROS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EscobaEngine = api;
})(typeof self !== 'undefined' ? self : this);
