/* Mus — rules and computer players for the Offlined «Mus» addon. MIT licence.
 *
 * Four players in two pairs: seats 0 (you) and 2 (your partner) against 1 and 3. Play goes 0 → 1 → 2 → 3.
 * With «8 reyes» (default) the threes count as kings and the twos as aces.
 * A hand: Mus (discards until someone says «no hay mus»), then the lances Grande, Chica, Pares and Juego (or
 * Punto if nobody has juego), each with its bets (envido, re-envido, órdago, quiero, no quiero), then the count.
 */
(function (root) {
  'use strict';
  const C = root.SpanishCards || (typeof require !== 'undefined' ? require('./cards.js') : null);
  const LANCES = ['grande', 'chica', 'pares', 'juego'];
  const team = (p) => p & 1;

  // ── Card values ───────────────────────────────────────────────────────────────────────────────────────
  function rank8(id, reyes8) {
    const r = C.rankOf(id);
    if (reyes8 && r === 3) return 10;
    if (reyes8 && r === 2) return 1;
    return r; // 1..7, 8 sota, 9 caballo, 10 rey
  }
  const juegoVal = (id, reyes8) => { const r = rank8(id, reyes8); return r >= 8 ? 10 : r; };
  const handSum = (h, r8) => h.reduce((a, c) => a + juegoVal(c, r8), 0);

  // ── Hand evaluation ───────────────────────────────────────────────────────────────────────────────────
  function grandeKey(h, r8) { return h.map((c) => rank8(c, r8)).sort((a, b) => b - a); }
  function chicaKey(h, r8) { return h.map((c) => rank8(c, r8)).sort((a, b) => a - b); }
  /** {type: 0 none, 1 par, 2 medias, 3 duples, ranks:[...]} */
  function pares(h, r8) {
    const cnt = {};
    for (const c of h) { const r = rank8(c, r8); cnt[r] = (cnt[r] || 0) + 1; }
    const groups = Object.entries(cnt).map(([r, n]) => [+r, n]).filter((g) => g[1] >= 2).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    if (!groups.length) return { type: 0, ranks: [] };
    if (groups[0][1] === 4) return { type: 3, ranks: [groups[0][0], groups[0][0]] };
    if (groups.length === 2) return { type: 3, ranks: [Math.max(groups[0][0], groups[1][0]), Math.min(groups[0][0], groups[1][0])] };
    if (groups[0][1] === 3) return { type: 2, ranks: [groups[0][0]] };
    return { type: 1, ranks: [groups[0][0]] };
  }
  const JUEGO_ORDER = [31, 32, 40, 37, 36, 35, 34, 33];
  function juego(h, r8) { const s = handSum(h, r8); return { has: s >= 31, sum: s, rank: s >= 31 ? 8 - JUEGO_ORDER.indexOf(s) : 0 }; }
  const lexCmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  /** >0 if hand a beats hand b in the lance (ties are broken by the caller with «mano»). */
  function cmp(lance, a, b, r8) {
    if (lance === 'grande') return lexCmp(grandeKey(a, r8), grandeKey(b, r8));
    if (lance === 'chica') return -lexCmp(chicaKey(a, r8), chicaKey(b, r8));
    if (lance === 'pares') { const pa = pares(a, r8), pb = pares(b, r8); return pa.type - pb.type || lexCmp(pa.ranks, pb.ranks); }
    if (lance === 'juego') return juego(a, r8).rank - juego(b, r8).rank;
    return handSum(a, r8) - handSum(b, r8); // punto
  }
  /** Winning seat of a lance among `seats` (ties go to the one closest to mano). */
  function winner(lance, hands, seats, mano, r8) {
    const order = [0, 1, 2, 3].map((k) => (mano + k) % 4).filter((p) => seats.includes(p));
    let best = order[0];
    for (const p of order.slice(1)) if (cmp(lance, hands[p], hands[best], r8) > 0) best = p;
    return best;
  }
  const paresPoints = (h, r8) => pares(h, r8).type; // par 1, medias 2, duples 3
  const juegoPoints = (h, r8) => { const j = juego(h, r8); return !j.has ? 0 : j.sum === 31 ? 3 : 2; };
  /** Who may speak in a lance. */
  function eligible(s, lance) {
    if (lance === 'pares') return [0, 1, 2, 3].filter((p) => pares(s.hands[p], s.reyes8).type > 0);
    if (lance === 'juego') return [0, 1, 2, 3].filter((p) => juego(s.hands[p], s.reyes8).has);
    return [0, 1, 2, 3];
  }

  // ── State ─────────────────────────────────────────────────────────────────────────────────────────────
  function newGame(opts) {
    return { reyes8: opts.reyes8 !== false, target: opts.target || 30, vacasToWin: opts.vacasToWin || 2, score: [0, 0], vacas: [0, 0],
      dealer: opts.dealer === undefined ? 3 : opts.dealer, over: false, hand: null };
  }
  function newHand(g, rnd) {
    const deck = C.shuffle(C.deck(), rnd);
    const mano = (g.dealer + 1) % 4;
    const h = { hands: [[], [], [], []], deck, discards: [], mano, phase: 'mus', turn: mano, musCount: 0, round: 0,
      lanceIdx: 0, lance: null, results: {}, said: [null, null, null, null], log: [], reyes8: g.reyes8, decl: {}, vacaEnded: false };
    for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) h.hands[(mano + i) % 4].push(h.deck.pop());
    g.hand = h;
    return h;
  }
  const say = (h, p, what, extra) => { h.said[p] = { what, extra }; h.log.push({ p, what, extra, lance: h.lance ? h.lance.name : null }); };

  // Points (immediate). Returns true if this ended the vaca.
  function award(g, t, pts) {
    if (!pts || g.hand.vacaEnded) return g.hand.vacaEnded;
    g.score[t] += pts;
    if (g.score[t] >= g.target) { endVaca(g, t); return true; }
    return false;
  }
  function endVaca(g, t) {
    g.vacas[t]++;
    g.hand.vacaEnded = true;
    g.hand.vacaWinner = t;
    if (g.vacas[t] >= g.vacasToWin) { g.over = true; g.winner = t; }
  }

  // ── Mus phase ─────────────────────────────────────────────────────────────────────────────────────────
  function musDecision(g, p, wantMus) {
    const h = g.hand;
    say(h, p, wantMus ? 'mus' : 'noMus');
    if (!wantMus) { startLances(g); return; }
    h.musCount++;
    if (h.musCount === 4) { h.phase = 'discard'; h.discarded = [false, false, false, false]; h.turn = h.mano; return; }
    h.turn = (p + 1) % 4;
  }
  function discard(g, p, cards) {
    const h = g.hand;
    if (!cards.length) cards = [h.hands[p][0]];
    for (const c of cards) { h.hands[p].splice(h.hands[p].indexOf(c), 1); h.discards.push(c); }
    for (let k = 0; k < cards.length; k++) {
      if (!h.deck.length) { h.deck = C.shuffle(h.discards.splice(0)); }
      h.hands[p].push(h.deck.pop());
    }
    say(h, p, 'discard', cards.length);
    h.discarded[p] = true;
    if (h.discarded.every((x) => x)) { h.phase = 'mus'; h.musCount = 0; h.round++; h.turn = h.mano; h.said = [null, null, null, null]; }
    else h.turn = (p + 1) % 4;
  }

  // ── Lances ────────────────────────────────────────────────────────────────────────────────────────────
  function startLances(g) {
    const h = g.hand;
    h.phase = 'lance'; h.lanceIdx = 0;
    // declarations of pares and juego are shown to everyone
    h.decl.pares = [0, 1, 2, 3].map((p) => pares(h.hands[p], h.reyes8).type > 0);
    h.decl.juego = [0, 1, 2, 3].map((p) => juego(h.hands[p], h.reyes8).has);
    openLance(g);
  }
  function openLance(g) {
    const h = g.hand;
    while (h.lanceIdx < 4) {
      let name = LANCES[h.lanceIdx];
      if (name === 'juego' && !h.decl.juego.some((x) => x)) name = 'punto';
      const seats = name === 'punto' ? [0, 1, 2, 3] : eligible(h, name);
      const teams = new Set(seats.map(team));
      if (seats.length === 0) { h.results[name] = { status: 'none' }; h.lanceIdx++; continue; }
      if (teams.size === 1) { h.results[name] = { status: 'only', team: [...teams][0] }; h.lanceIdx++; continue; }
      const order = [0, 1, 2, 3].map((k) => (h.mano + k) % 4).filter((p) => seats.includes(p));
      h.lance = { name, seats, order, pos: 0, stake: 0, prev: 0, bettor: -1, responder: -1, ordago: false };
      h.said = [null, null, null, null];
      h.turn = order[0];
      return;
    }
    h.lance = null;
    h.phase = 'conteo';
  }
  /** Actions: {type:'paso'} | {type:'envido', n} | {type:'ordago'} | {type:'quiero'} | {type:'noquiero'} */
  function legal(g) {
    const h = g.hand, L = h.lance;
    if (!L) return [];
    if (L.bettor < 0) return ['paso', 'envido', 'ordago'];
    return ['quiero', 'noquiero', 'envido', 'ordago'].filter((a) => !(L.ordago && (a === 'envido' || a === 'ordago')));
  }
  function act(g, p, a) {
    const h = g.hand, L = h.lance;
    if (L.bettor < 0) {
      if (a.type === 'paso') {
        say(h, p, 'paso');
        L.pos++;
        if (L.pos >= L.order.length) { closeLance(g, { status: 'paso' }); return; }
        h.turn = L.order[L.pos];
        return;
      }
      // first bet
      if (a.type === 'ordago') { L.ordago = true; L.prev = 1; L.stake = 0; say(h, p, 'ordago'); }
      else { L.prev = 1; L.stake = Math.max(2, a.n | 0); say(h, p, 'envido', L.stake); }
      L.bettor = p; nextResponder(g, p);
      return;
    }
    // answering a bet
    if (a.type === 'quiero') {
      say(h, p, 'quiero');
      if (L.ordago) { resolveOrdago(g); return; }
      closeLance(g, { status: 'quiero', stake: L.stake });
      return;
    }
    if (a.type === 'noquiero') {
      say(h, p, 'noquiero');
      // the other side may still accept: the responder's partner, if eligible and not asked yet
      const partner = (p + 2) % 4;
      if (L.asked && !L.asked.includes(partner) && L.seats.includes(partner)) { L.asked.push(partner); h.turn = partner; return; }
      const bt = team(L.bettor);
      // score first: if this «deje» reaches the target, closeLance ends the hand instead of opening the next lance
      award(g, bt, L.prev);
      closeLance(g, { status: 'noquiero', team: bt, pts: L.prev });
      return;
    }
    // raise or órdago
    if (a.type === 'ordago') { L.prev = L.ordago ? L.prev : Math.max(L.stake, 1); L.ordago = true; say(h, p, 'ordago'); }
    else { L.prev = L.stake; L.stake += Math.max(2, a.n | 0); say(h, p, 'envido', L.stake); }
    L.bettor = p; nextResponder(g, p);
  }
  function nextResponder(g, p) {
    const h = g.hand, L = h.lance;
    // the opponents answer, starting with the next eligible one in play order
    let q = (p + 1) % 4;
    while (team(q) === team(p) || !L.seats.includes(q)) q = (q + 1) % 4;
    L.asked = [q];
    h.turn = q;
  }
  function closeLance(g, res) {
    const h = g.hand;
    h.results[h.lance.name] = res;
    h.lanceIdx++;
    if (h.vacaEnded) { h.phase = 'handEnd'; return; }
    openLance(g);
  }
  function resolveOrdago(g) {
    const h = g.hand, L = h.lance;
    const w = winner(L.name, h.hands, L.seats, h.mano, h.reyes8);
    h.results[L.name] = { status: 'ordago', team: team(w) };
    h.ordago = { lance: L.name, team: team(w) };
    g.score[team(w)] = Math.max(g.score[team(w)], g.target);
    endVaca(g, team(w));
    h.lance = null;
    h.phase = 'handEnd';
  }

  // ── Count ─────────────────────────────────────────────────────────────────────────────────────────────
  /** Count the hand. Returns [{lance, team, pts, detail}] in order; stops when a vaca ends. */
  function conteo(g) {
    const h = g.hand, out = [], r8 = h.reyes8;
    for (const name of ['grande', 'chica', 'pares', 'juego', 'punto']) {
      const res = h.results[name];
      if (!res || res.status === 'none') continue;
      let pts = 0, t;
      if (name === 'grande' || name === 'chica' || name === 'punto') {
        if (res.status === 'noquiero') continue;
        const w = winner(name, h.hands, [0, 1, 2, 3], h.mano, r8); t = team(w);
        pts = res.status === 'quiero' ? res.stake : 1;
        if (name === 'punto' && res.status !== 'quiero') pts = 1; else if (name === 'punto') pts = res.stake + 1;
      } else {
        const seats = eligible(h, name);
        const w = res.status === 'only' ? seats.find((p) => team(p) === res.team) : winner(name, h.hands, seats, h.mano, r8);
        t = team(w);
        const val = name === 'pares' ? paresPoints : juegoPoints;
        for (const p of [t, t + 2]) pts += val(h.hands[p], r8);
        if (res.status === 'quiero') pts += res.stake;
      }
      out.push({ lance: name, team: t, pts, status: res.status });
      if (award(g, t, pts)) break;
    }
    h.phase = 'handEnd';
    return out;
  }
  function nextHand(g) {
    if (g.hand && g.hand.vacaEnded && !g.over) g.score = [0, 0];
    g.dealer = (g.dealer + 1) % 4;
    return newHand(g);
  }

  // ── Computer players ──────────────────────────────────────────────────────────────────────────────────
  const LEVEL = {
    1: { samples: 24, bluff: 0.18, noise: 0.35 },
    2: { samples: 80, bluff: 0, noise: 0.08 },
    3: { samples: 200, bluff: 0.08, noise: 0.03 },
    4: { samples: 400, bluff: 0.1, noise: 0 },
  };
  // Chance that p's pair wins a lance, sampling the cards p cannot see, consistent with the declarations.
  // A hand good enough to bet in a lance (used to read the opponents' bets).
  function decent(hd, lance, r8) {
    const rs = hd.map((c) => rank8(c, r8));
    const kings = rs.filter((r) => r === 10).length, aces = rs.filter((r) => r === 1).length;
    if (lance === 'grande') return kings >= 2 || (kings === 1 && rs.filter((r) => r >= 9).length >= 2);
    if (lance === 'chica') return aces >= 2 || (aces === 1 && rs.filter((r) => r <= 4).length >= 2);
    if (lance === 'pares') { const pr = pares(hd, r8); return pr.type >= 2 || pr.ranks[0] >= 9; }
    if (lance === 'juego') { const j = juego(hd, r8); return j.sum === 31 || j.sum === 32 || j.sum === 40; }
    return handSum(hd, r8) >= 27;
  }
  function strength(g, p, lance, samples, bettor) {
    const h = g.hand, r8 = h.reyes8, mine = h.hands[p];
    const unseen = C.deck().filter((c) => !mine.includes(c));
    let win = 0, n = 0;
    for (let k = 0; k < samples * 3 && n < samples; k++) {
      const pool = C.shuffle(unseen.slice());
      const hands = [null, null, null, null];
      hands[p] = mine;
      let i = 0;
      for (let q = 0; q < 4; q++) if (q !== p) { hands[q] = pool.slice(i, i + 4); i += 4; }
      if (h.decl.pares && !hands.every((hh, q) => (pares(hh, r8).type > 0) === h.decl.pares[q])) continue;
      if (h.decl.juego && !hands.every((hh, q) => juego(hh, r8).has === h.decl.juego[q])) continue;
      // reading the bet: the bettor usually has a good hand (but may be bluffing)
      if (bettor !== undefined && bettor >= 0 && team(bettor) !== team(p) && !decent(hands[bettor], lance, r8) && Math.random() > 0.25) continue;
      const seats = lance === 'punto' ? [0, 1, 2, 3] : lance === 'pares' ? [0, 1, 2, 3].filter((q) => pares(hands[q], r8).type > 0)
        : lance === 'juego' ? [0, 1, 2, 3].filter((q) => juego(hands[q], r8).has) : [0, 1, 2, 3];
      if (!seats.length) continue;
      if (team(winner(lance, hands, seats, h.mano, r8)) === team(p)) win++;
      n++;
    }
    return n ? win / n : 0.5;
  }
  // Is the hand good enough to cut the mus?
  function wantsMus(g, p, level) {
    const h = g.hand, r8 = h.reyes8, hd = h.hands[p];
    const pr = pares(hd, r8), j = juego(hd, r8);
    let q = 0;
    if (j.has) q += j.sum === 31 ? 3 : 1.6;
    if (pr.type) q += pr.type + (pr.ranks[0] >= 9 ? 0.6 : 0);
    const kings = hd.filter((c) => rank8(c, r8) === 10).length, aces = hd.filter((c) => rank8(c, r8) === 1).length;
    q += kings * 0.6 + aces * 0.4;
    if (level === 1) q += (Math.random() - 0.5) * 2;
    return q < 3; // true = ask for mus
  }
  function chooseDiscard(g, p) {
    const h = g.hand, r8 = h.reyes8, hd = h.hands[p];
    const pr = pares(hd, r8);
    const keepRanks = new Set(pr.ranks);
    let out = hd.filter((c) => { const r = rank8(c, r8); return !(r === 10 || r === 1 || keepRanks.has(r)); });
    if (!out.length) { // keep the best, drop one of the middle/low cards
      const sorted = hd.slice().sort((a, b) => rank8(a, r8) - rank8(b, r8));
      const cand = sorted.find((c) => rank8(c, r8) !== 1 && !keepRanks.has(rank8(c, r8)));
      out = [cand !== undefined ? cand : sorted[1]];
    }
    return out.slice(0, 4);
  }
  /** Decision for the computer in the current situation: returns an action or {type:'mus'|'noMus'|'discard', cards}. */
  function decide(g, p, level) {
    const h = g.hand, cfg = LEVEL[level] || LEVEL[3];
    if (h.phase === 'mus') return { type: wantsMus(g, p, level) ? 'mus' : 'noMus' };
    if (h.phase === 'discard') return { type: 'discard', cards: chooseDiscard(g, p) };
    const L = h.lance;
    let s = strength(g, p, L.name, cfg.samples, level >= 4 ? L.bettor : -1) + (Math.random() - 0.5) * cfg.noise;
    const bluff = Math.random() < cfg.bluff;
    const myT = team(p), oppT = 1 - myT;
    const behind = g.score[oppT] - g.score[myT];
    const oppNear = g.score[oppT] >= g.target - 6;
    if (level === 1) {
      const r = Math.random();
      if (L.bettor < 0) return r < 0.6 ? { type: 'paso' } : r < 0.95 ? { type: 'envido', n: 2 } : { type: 'ordago' };
      return r < 0.5 ? { type: 'quiero' } : r < 0.9 ? { type: 'noquiero' } : { type: 'envido', n: 2 };
    }
    if (level >= 4) return decideEV(g, p, L, s, myT, oppT, bluff);
    if (L.bettor < 0) {
      if (s > 0.82) return { type: 'envido', n: s > 0.9 ? 4 : 3 };
      if (s > 0.62 || bluff) return { type: 'envido', n: 2 };
      return { type: 'paso' };
    }
    // facing a bet
    if (L.ordago) {
      const need = level >= 4 ? (oppNear ? 0.5 : g.score[myT] >= g.target - 6 ? 0.68 : 0.6) : 0.6;
      return s > need ? { type: 'quiero' } : { type: 'noquiero' };
    }
    const need = 0.42 + Math.min(0.3, L.stake / 30);
    if (s > 0.9 && level >= 3 && L.stake >= 4) return { type: 'ordago' };
    if (s > 0.8) return { type: 'envido', n: 2 };
    if (s > need || (bluff && L.stake <= 3)) return { type: 'quiero' };
    return { type: 'noquiero' };
  }

  // Master: compare what is expected from each answer. Accepting a bet S with chance s gives (2s−1)·S;
  // refusing gives −v (what the bettors take). Órdagos are weighed against the whole vaca.
  function decideEV(g, p, L, s, myT, oppT, bluff) {
    const target = g.target, mine = g.score[myT], theirs = g.score[oppT];
    if (L.bettor < 0) {
      if (s > 0.93 && L.name !== 'grande' && (theirs >= target - 8 || theirs - mine >= 12)) return { type: 'ordago' };
      if (s > 0.8) return { type: 'envido', n: s > 0.9 ? 5 : 3 };
      if (s > 0.6 || (bluff && s > 0.35)) return { type: 'envido', n: 2 };
      return { type: 'paso' };
    }
    if (L.ordago) {
      if (theirs + L.prev >= target) return { type: 'quiero' };          // refusing loses the vaca anyway
      const need = mine + L.prev >= target ? 0.7 : theirs >= target - 8 ? 0.45 : 0.55;
      return s > need ? { type: 'quiero' } : { type: 'noquiero' };
    }
    const S = L.stake, v = L.prev;
    if (s > 0.86 && S >= 4 && theirs >= target - 10) return { type: 'ordago' };
    if (s > 0.74) return { type: 'envido', n: 2 };
    const need = 0.5 - v / (2 * S) + 0.05;
    return s > need ? { type: 'quiero' } : { type: 'noquiero' };
  }

  const api = { LANCES, team, rank8, juegoVal, handSum, pares, juego, cmp, winner, eligible, paresPoints, juegoPoints,
    newGame, newHand, nextHand, musDecision, discard, legal, act, conteo, decide, strength, chooseDiscard, wantsMus };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MusEngine = api;
})(typeof self !== 'undefined' ? self : this);
