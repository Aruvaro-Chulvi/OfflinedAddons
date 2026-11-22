/* Chess engine for the Offlined «Chess» addon — MIT licence.
 *
 * Position: 0x88 board, legal move generation (castling, en passant, promotion), make/unmake, Zobrist
 * hashing, SAN/UCI/FEN/PGN, game end (checkmate, stalemate, threefold repetition, fifty moves,
 * insufficient material).
 * Search: iterative deepening, alpha-beta with PVS, transposition table, null move, late move
 * reductions, killers/history, quiescence search. Evaluation: material, piece-square tables (tapered
 * middlegame/endgame), bishop pair, pawn structure, passed pawns, rooks on open files, king shelter.
 */
(function (root) {
  'use strict';

  const WHITE = 0, BLACK = 1;
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const pc = (c, t) => t | (c << 3);
  const LET = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
  const FLAG_CAP = 1, FLAG_EP = 2, FLAG_CASTLE = 4, FLAG_DOUBLE = 8;
  const mFrom = (m) => m & 127, mTo = (m) => (m >> 7) & 127, mPromo = (m) => (m >> 14) & 7, mFlag = (m) => m >> 17;
  const mk = (f, t, pr, fl) => f | (t << 7) | (pr << 14) | (fl << 17);
  const sqName = (s) => 'abcdefgh'[s & 7] + ((s >> 4) + 1);
  const sqParse = (n) => (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97);

  const KN = [33, 31, 18, 14, -33, -31, -18, -14], KG = [1, -1, 16, -16, 17, 15, -17, -15];
  const DIAG = [17, 15, -17, -15], ORTH = [16, -16, 1, -1];
  const CASTLE_MASK = new Uint8Array(128).fill(15);
  CASTLE_MASK[0] = 15 & ~2; CASTLE_MASK[7] = 15 & ~1; CASTLE_MASK[4] = 15 & ~3;
  CASTLE_MASK[112] = 15 & ~8; CASTLE_MASK[119] = 15 & ~4; CASTLE_MASK[116] = 15 & ~12;

  // Zobrist keys (two 32-bit halves), fixed seed.
  let zs = 0x9e3779b9;
  const zr = () => { zs ^= zs << 13; zs ^= zs >>> 17; zs ^= zs << 5; return zs | 0; };
  const ZP_LO = new Int32Array(16 * 128), ZP_HI = new Int32Array(16 * 128);
  for (let i = 0; i < 16 * 128; i++) { ZP_LO[i] = zr(); ZP_HI[i] = zr(); }
  const ZC_LO = new Int32Array(16), ZC_HI = new Int32Array(16);
  for (let i = 0; i < 16; i++) { ZC_LO[i] = zr(); ZC_HI[i] = zr(); }
  const ZE_LO = new Int32Array(8), ZE_HI = new Int32Array(8);
  for (let i = 0; i < 8; i++) { ZE_LO[i] = zr(); ZE_HI[i] = zr(); }
  const ZS_LO = zr(), ZS_HI = zr();

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const MAXPLY = 1024;

  // ── Position ──────────────────────────────────────────────────────────────────────────────────────────
  function Position(fen) {
    this.board = new Int8Array(128);
    this.king = new Int32Array(2);
    this.sMove = new Int32Array(MAXPLY); this.sCap = new Int8Array(MAXPLY); this.sCastle = new Int8Array(MAXPLY);
    this.sEp = new Int16Array(MAXPLY); this.sHalf = new Int16Array(MAXPLY);
    this.hLo = new Int32Array(MAXPLY + 1); this.hHi = new Int32Array(MAXPLY + 1);
    this.setFen(fen || START_FEN);
  }
  const PP = Position.prototype;

  PP.setFen = function (fen) {
    const [bd, side, cas, ep, half, full] = fen.trim().split(/\s+/);
    this.board.fill(0);
    let r = 7, f = 0;
    for (const ch of bd) {
      if (ch === '/') { r--; f = 0; continue; }
      if (ch >= '1' && ch <= '8') { f += +ch; continue; }
      const lower = ch.toLowerCase(), c = ch === lower ? BLACK : WHITE;
      const t = 'pnbrqk'.indexOf(lower) + 1;
      const s = r * 16 + f;
      this.board[s] = pc(c, t);
      if (t === K) this.king[c] = s;
      f++;
    }
    this.side = side === 'b' ? BLACK : WHITE;
    this.castle = 0;
    if (cas && cas !== '-') { if (cas.includes('K')) this.castle |= 1; if (cas.includes('Q')) this.castle |= 2; if (cas.includes('k')) this.castle |= 4; if (cas.includes('q')) this.castle |= 8; }
    this.ep = ep && ep !== '-' ? sqParse(ep) : -1;
    this.half = +half || 0; this.full = +full || 1;
    this.ply = 0;
    this.computeHash();
    this.hLo[0] = this.lo; this.hHi[0] = this.hi;
  };
  PP.computeHash = function () {
    let lo = 0, hi = 0;
    for (let s = 0; s < 128; s++) { if (s & 0x88) continue; const p = this.board[s]; if (p) { lo ^= ZP_LO[p * 128 + s]; hi ^= ZP_HI[p * 128 + s]; } }
    lo ^= ZC_LO[this.castle]; hi ^= ZC_HI[this.castle];
    if (this.ep >= 0) { lo ^= ZE_LO[this.ep & 7]; hi ^= ZE_HI[this.ep & 7]; }
    if (this.side) { lo ^= ZS_LO; hi ^= ZS_HI; }
    this.lo = lo; this.hi = hi;
  };
  PP.fen = function () {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let e = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 16 + f];
        if (!p) { e++; continue; }
        if (e) { s += e; e = 0; }
        const ch = 'pnbrqk'[(p & 7) - 1];
        s += p >> 3 ? ch : ch.toUpperCase();
      }
      if (e) s += e;
      if (r) s += '/';
    }
    let c = ''; if (this.castle & 1) c += 'K'; if (this.castle & 2) c += 'Q'; if (this.castle & 4) c += 'k'; if (this.castle & 8) c += 'q';
    return `${s} ${this.side ? 'b' : 'w'} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
  };
  PP.key = function () { return this.fen().split(' ').slice(0, 4).join(' '); };

  PP.attacked = function (s, by) {
    const b = this.board;
    if (by === WHITE) {
      if (!((s - 15) & 0x88) && b[s - 15] === 1) return true;
      if (!((s - 17) & 0x88) && b[s - 17] === 1) return true;
    } else {
      if (!((s + 15) & 0x88) && b[s + 15] === 9) return true;
      if (!((s + 17) & 0x88) && b[s + 17] === 9) return true;
    }
    const kn = pc(by, N), kg = pc(by, K), bi = pc(by, B), ro = pc(by, R), qu = pc(by, Q);
    for (let i = 0; i < 8; i++) { const t = s + KN[i]; if (!(t & 0x88) && b[t] === kn) return true; }
    for (let i = 0; i < 8; i++) { const t = s + KG[i]; if (!(t & 0x88) && b[t] === kg) return true; }
    for (let i = 0; i < 4; i++) {
      const d = DIAG[i]; let t = s + d;
      while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === bi || p === qu) return true; break; } t += d; }
    }
    for (let i = 0; i < 4; i++) {
      const d = ORTH[i]; let t = s + d;
      while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === ro || p === qu) return true; break; } t += d; }
    }
    return false;
  };
  PP.inCheck = function () { return this.attacked(this.king[this.side], this.side ^ 1); };

  /** Pseudo-legal moves into `out` (Int32Array); returns the count. */
  PP.gen = function (out, capsOnly) {
    const b = this.board, us = this.side, them = us ^ 1;
    let n = 0;
    const dir = us === WHITE ? 16 : -16, startR = us === WHITE ? 1 : 6, promoR = us === WHITE ? 7 : 0;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s];
      if (!p || (p >> 3) !== us) continue;
      const t = p & 7;
      if (t === P) {
        const to = s + dir;
        if (!(to & 0x88) && !b[to]) {
          if ((to >> 4) === promoR) { out[n++] = mk(s, to, Q, 0); if (!capsOnly) { out[n++] = mk(s, to, R, 0); out[n++] = mk(s, to, B, 0); out[n++] = mk(s, to, N, 0); } }
          else if (!capsOnly) {
            out[n++] = mk(s, to, 0, 0);
            if ((s >> 4) === startR && !b[to + dir]) out[n++] = mk(s, to + dir, 0, FLAG_DOUBLE);
          }
        }
        for (const d of [dir - 1, dir + 1]) {
          const c = s + d;
          if (c & 0x88) continue;
          if (b[c] && (b[c] >> 3) === them) {
            if ((c >> 4) === promoR) { out[n++] = mk(s, c, Q, FLAG_CAP); out[n++] = mk(s, c, R, FLAG_CAP); out[n++] = mk(s, c, B, FLAG_CAP); out[n++] = mk(s, c, N, FLAG_CAP); }
            else out[n++] = mk(s, c, 0, FLAG_CAP);
          } else if (c === this.ep) out[n++] = mk(s, c, 0, FLAG_CAP | FLAG_EP);
        }
        continue;
      }
      if (t === N || t === K) {
        const offs = t === N ? KN : KG;
        for (let i = 0; i < 8; i++) {
          const to = s + offs[i];
          if (to & 0x88) continue;
          const q = b[to];
          if (!q) { if (!capsOnly) out[n++] = mk(s, to, 0, 0); }
          else if ((q >> 3) === them) out[n++] = mk(s, to, 0, FLAG_CAP);
        }
        continue;
      }
      const dirs = t === B ? DIAG : t === R ? ORTH : KG;
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i]; let to = s + d;
        while (!(to & 0x88)) {
          const q = b[to];
          if (!q) { if (!capsOnly) out[n++] = mk(s, to, 0, 0); }
          else { if ((q >> 3) === them) out[n++] = mk(s, to, 0, FLAG_CAP); break; }
          to += d;
        }
      }
    }
    if (!capsOnly) {
      if (us === WHITE) {
        if ((this.castle & 1) && !b[5] && !b[6] && !this.attacked(4, BLACK) && !this.attacked(5, BLACK) && !this.attacked(6, BLACK)) out[n++] = mk(4, 6, 0, FLAG_CASTLE);
        if ((this.castle & 2) && !b[3] && !b[2] && !b[1] && !this.attacked(4, BLACK) && !this.attacked(3, BLACK) && !this.attacked(2, BLACK)) out[n++] = mk(4, 2, 0, FLAG_CASTLE);
      } else {
        if ((this.castle & 4) && !b[117] && !b[118] && !this.attacked(116, WHITE) && !this.attacked(117, WHITE) && !this.attacked(118, WHITE)) out[n++] = mk(116, 118, 0, FLAG_CASTLE);
        if ((this.castle & 8) && !b[115] && !b[114] && !b[113] && !this.attacked(116, WHITE) && !this.attacked(115, WHITE) && !this.attacked(114, WHITE)) out[n++] = mk(116, 114, 0, FLAG_CASTLE);
      }
    }
    return n;
  };

  PP.xorPiece = function (p, s) { this.lo ^= ZP_LO[p * 128 + s]; this.hi ^= ZP_HI[p * 128 + s]; };

  /** Plays a pseudo-legal move; returns false (and undoes it) if it leaves the king in check. */
  PP.make = function (m) {
    const b = this.board, from = mFrom(m), to = mTo(m), promo = mPromo(m), fl = mFlag(m);
    const us = this.side, p = b[from];
    const ply = this.ply;
    this.sMove[ply] = m; this.sCastle[ply] = this.castle; this.sEp[ply] = this.ep; this.sHalf[ply] = this.half;
    let cap = 0, capSq = to;
    if (fl & FLAG_EP) { capSq = to + (us === WHITE ? -16 : 16); cap = b[capSq]; b[capSq] = 0; }
    else cap = b[to];
    this.sCap[ply] = cap;
    if (cap) this.xorPiece(cap, capSq);
    this.xorPiece(p, from);
    b[from] = 0;
    const np = promo ? pc(us, promo) : p;
    b[to] = np;
    this.xorPiece(np, to);
    if (fl & FLAG_CASTLE) {
      let rf, rt;
      if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 118) { rf = 119; rt = 117; } else { rf = 112; rt = 115; }
      const rk = b[rf]; b[rf] = 0; b[rt] = rk; this.xorPiece(rk, rf); this.xorPiece(rk, rt);
    }
    if ((p & 7) === K) this.king[us] = to;
    this.lo ^= ZC_LO[this.castle]; this.hi ^= ZC_HI[this.castle];
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.lo ^= ZC_LO[this.castle]; this.hi ^= ZC_HI[this.castle];
    if (this.ep >= 0) { this.lo ^= ZE_LO[this.ep & 7]; this.hi ^= ZE_HI[this.ep & 7]; }
    this.ep = fl & FLAG_DOUBLE ? (from + to) >> 1 : -1;
    if (this.ep >= 0) { this.lo ^= ZE_LO[this.ep & 7]; this.hi ^= ZE_HI[this.ep & 7]; }
    this.half = (p & 7) === P || cap ? 0 : this.half + 1;
    if (us === BLACK) this.full++;
    this.side ^= 1; this.lo ^= ZS_LO; this.hi ^= ZS_HI;
    this.ply = ply + 1;
    this.hLo[this.ply] = this.lo; this.hHi[this.ply] = this.hi;
    if (this.attacked(this.king[us], us ^ 1)) { this.unmake(); return false; }
    return true;
  };
  PP.unmake = function () {
    const ply = --this.ply;
    const m = this.sMove[ply], b = this.board, from = mFrom(m), to = mTo(m), promo = mPromo(m), fl = mFlag(m);
    this.side ^= 1;
    const us = this.side;
    if (us === BLACK) this.full--;
    const moved = b[to];
    b[from] = promo ? pc(us, P) : moved;
    b[to] = 0;
    const cap = this.sCap[ply];
    if (fl & FLAG_EP) b[to + (us === WHITE ? -16 : 16)] = cap; else b[to] = cap;
    if (fl & FLAG_CASTLE) {
      let rf, rt;
      if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 118) { rf = 119; rt = 117; } else { rf = 112; rt = 115; }
      b[rf] = b[rt]; b[rt] = 0;
    }
    if ((b[from] & 7) === K) this.king[us] = from;
    this.castle = this.sCastle[ply]; this.ep = this.sEp[ply]; this.half = this.sHalf[ply];
    this.lo = this.hLo[ply]; this.hi = this.hHi[ply];
  };
  PP.makeNull = function () {
    const ply = this.ply;
    this.sMove[ply] = 0; this.sEp[ply] = this.ep; this.sHalf[ply] = this.half; this.sCastle[ply] = this.castle; this.sCap[ply] = 0;
    if (this.ep >= 0) { this.lo ^= ZE_LO[this.ep & 7]; this.hi ^= ZE_HI[this.ep & 7]; }
    this.ep = -1; this.half = 0;
    this.side ^= 1; this.lo ^= ZS_LO; this.hi ^= ZS_HI;
    this.ply = ply + 1; this.hLo[this.ply] = this.lo; this.hHi[this.ply] = this.hi;
  };
  PP.unmakeNull = function () {
    const ply = --this.ply;
    this.side ^= 1; this.ep = this.sEp[ply]; this.half = this.sHalf[ply];
    this.lo = this.hLo[ply]; this.hi = this.hHi[ply];
  };

  const BUF = new Int32Array(256);
  PP.legalMoves = function () {
    const n = this.gen(BUF, false), out = [];
    const tmp = BUF.slice(0, n);
    for (let i = 0; i < n; i++) { if (this.make(tmp[i])) { this.unmake(); out.push(tmp[i]); } }
    return out;
  };
  /** How many times the current position appeared since the last irreversible move (including now). */
  PP.repetitions = function () {
    let count = 1;
    const lo = this.lo, hi = this.hi;
    for (let i = this.ply - 2; i >= 0 && i >= this.ply - this.half; i -= 2) if (this.hLo[i] === lo && this.hHi[i] === hi) count++;
    return count;
  };
  PP.insufficient = function () {
    const b = this.board; let minors = 0, bishopsColor = [], other = 0;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const t = b[s] & 7;
      if (!t || t === K) continue;
      if (t === N) minors++;
      else if (t === B) { minors++; bishopsColor.push(((s >> 4) + (s & 7)) & 1); }
      else other++;
    }
    if (other) return false;
    if (minors <= 1) return true;
    // only bishops, all on the same colour of square
    if (bishopsColor.length === minors && bishopsColor.every((c) => c === bishopsColor[0])) return true;
    return false;
  };

  PP.uci = (m) => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? 'nbrq'[mPromo(m) - 2] : '');
  PP.fromUci = function (u) {
    const lm = this.legalMoves();
    return lm.find((m) => this.uci(m) === u) || 0;
  };
  PP.san = function (m, legal) {
    const b = this.board, from = mFrom(m), to = mTo(m), fl = mFlag(m), t = b[from] & 7;
    let s;
    if (fl & FLAG_CASTLE) s = (to & 7) === 6 ? 'O-O' : 'O-O-O';
    else {
      s = t === P ? '' : LET[t];
      if (t !== P) {
        legal = legal || this.legalMoves();
        const others = legal.filter((o) => o !== m && mTo(o) === to && (b[mFrom(o)] & 7) === t);
        if (others.length) {
          const sameFile = others.some((o) => (mFrom(o) & 7) === (from & 7));
          const sameRank = others.some((o) => (mFrom(o) >> 4) === (from >> 4));
          if (!sameFile) s += 'abcdefgh'[from & 7];
          else if (!sameRank) s += (from >> 4) + 1;
          else s += sqName(from);
        }
      }
      if (fl & FLAG_CAP) { if (t === P) s += 'abcdefgh'[from & 7]; s += 'x'; }
      s += sqName(to);
      if (mPromo(m)) s += '=' + LET[mPromo(m)];
    }
    this.make(m);
    if (this.inCheck()) s += this.legalMoves().length ? '+' : '#';
    this.unmake();
    return s;
  };
  PP.fromSan = function (san) {
    const clean = (x) => x.replace(/[+#?!]/g, '').replace(/0/g, 'O');
    const want = clean(san);
    const lm = this.legalMoves();
    return lm.find((m) => clean(this.san(m, lm)) === want) || 0;
  };

  /** Game status after the current position. */
  PP.status = function () {
    const lm = this.legalMoves();
    if (!lm.length) {
      if (this.inCheck()) return { over: true, result: this.side === WHITE ? '0-1' : '1-0', reason: 'checkmate' };
      return { over: true, result: '1/2-1/2', reason: 'stalemate' };
    }
    if (this.insufficient()) return { over: true, result: '1/2-1/2', reason: 'material' };
    if (this.half >= 100) return { over: true, result: '1/2-1/2', reason: 'fifty' };
    if (this.repetitions() >= 3) return { over: true, result: '1/2-1/2', reason: 'repetition' };
    return { over: false, check: this.inCheck() };
  };

  // ── Evaluation ────────────────────────────────────────────────────────────────────────────────────────
  const VAL_MG = [0, 82, 337, 365, 477, 1025, 0], VAL_EG = [0, 94, 281, 297, 512, 936, 0];
  const PHASE = [0, 0, 1, 1, 2, 4, 0];
  // Piece-square tables from White's side, rank 8 first (a8..h8, …, a1..h1). Our own values.
  const T = (a) => Int16Array.from(a);
  const PST_MG = [null,
    T([0, 0, 0, 0, 0, 0, 0, 0, 60, 70, 60, 70, 70, 60, 70, 60, 15, 20, 30, 40, 40, 30, 20, 15, 5, 8, 14, 28, 28, 14, 8, 5,
      0, 0, 8, 22, 22, 6, 0, 0, 4, -2, -6, 4, 4, -8, -2, 4, 2, 8, 6, -18, -18, 8, 10, 2, 0, 0, 0, 0, 0, 0, 0, 0]),
    T([-60, -35, -25, -20, -20, -25, -35, -60, -35, -15, 0, 5, 5, 0, -15, -35, -25, 5, 15, 20, 20, 15, 5, -25, -20, 5, 18, 25, 25, 18, 5, -20,
      -20, 0, 15, 22, 22, 15, 0, -20, -25, 5, 12, 15, 15, 12, 5, -25, -35, -15, 0, 5, 5, 0, -15, -35, -55, -30, -25, -20, -20, -25, -30, -55]),
    T([-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 6, 10, 10, 6, 0, -10, -10, 6, 6, 12, 12, 6, 6, -10,
      -10, 0, 12, 12, 12, 12, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 6, 0, 0, 0, 0, 6, -10, -20, -10, -12, -10, -10, -12, -10, -20]),
    T([5, 5, 5, 8, 8, 5, 5, 5, 10, 14, 14, 14, 14, 14, 14, 10, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -6, 0, 0, 0, 0, 0, 0, -6, -2, 0, 2, 8, 8, 4, 0, -2]),
    T([-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      -5, 0, 5, 5, 5, 5, 0, -5, -10, 4, 5, 5, 5, 5, 0, -10, -10, 0, 4, 0, 0, 0, 0, -10, -20, -10, -10, -2, -5, -10, -10, -20]),
    T([-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -22, -22, -20, -20, -10, 15, 15, -5, -10, -10, -5, 15, 15, 18, 28, 8, -5, 0, 6, 30, 18]),
  ];
  const PST_EG = [null,
    T([0, 0, 0, 0, 0, 0, 0, 0, 90, 85, 80, 75, 75, 80, 85, 90, 55, 50, 45, 40, 40, 45, 50, 55, 30, 25, 20, 15, 15, 20, 25, 30,
      15, 12, 8, 5, 5, 8, 12, 15, 5, 4, 2, 0, 0, 2, 4, 5, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0]),
    T([-50, -35, -20, -15, -15, -20, -35, -50, -30, -15, -5, 0, 0, -5, -15, -30, -20, -5, 8, 12, 12, 8, -5, -20, -15, 0, 12, 18, 18, 12, 0, -15,
      -15, 0, 12, 18, 18, 12, 0, -15, -20, -5, 5, 12, 12, 5, -5, -20, -30, -15, -5, 0, 0, -5, -15, -30, -50, -35, -20, -15, -15, -20, -35, -50]),
    T([-15, -10, -8, -5, -5, -8, -10, -15, -10, -4, 0, 2, 2, 0, -4, -10, -8, 0, 4, 6, 6, 4, 0, -8, -5, 2, 6, 8, 8, 6, 2, -5,
      -5, 2, 6, 8, 8, 6, 2, -5, -8, 0, 4, 6, 6, 4, 0, -8, -10, -4, 0, 2, 2, 0, -4, -10, -15, -10, -8, -5, -5, -8, -10, -15]),
    T([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2,
      0, 0, 0, 0, 0, 0, 0, 0, -2, -2, -2, -2, -2, -2, -2, -2, -4, -4, -4, -4, -4, -4, -4, -4, -6, -4, -2, 0, 0, -2, -4, -6]),
    T([-15, -10, -5, -2, -2, -5, -10, -15, -10, 0, 5, 8, 8, 5, 0, -10, -5, 5, 10, 12, 12, 10, 5, -5, -2, 8, 12, 15, 15, 12, 8, -2,
      -2, 8, 12, 15, 15, 12, 8, -2, -5, 5, 10, 12, 12, 10, 5, -5, -10, 0, 5, 8, 8, 5, 0, -10, -15, -10, -5, -2, -2, -5, -10, -15]),
    T([-50, -35, -25, -20, -20, -25, -35, -50, -30, -15, -5, 0, 0, -5, -15, -30, -25, -5, 15, 22, 22, 15, -5, -25, -20, 0, 22, 30, 30, 22, 0, -20,
      -20, 0, 22, 30, 30, 22, 0, -20, -25, -5, 15, 22, 22, 15, -5, -25, -30, -15, -5, 0, 0, -5, -15, -30, -50, -35, -25, -20, -20, -25, -35, -50]),
  ];
  const PASSED_MG = [0, 0, 5, 10, 18, 30, 50, 0], PASSED_EG = [0, 8, 15, 28, 48, 80, 120, 0];
  const pstIdx = (c, s) => (c === WHITE ? (7 - (s >> 4)) * 8 + (s & 7) : (s >> 4) * 8 + (s & 7));

  /** Static evaluation in centipawns from the side to move. */
  PP.evaluate = function () {
    const b = this.board;
    const mg = [0, 0], eg = [0, 0], bishops = [0, 0];
    const pawnFiles = [new Int8Array(8), new Int8Array(8)];
    const pawnMost = [new Int8Array(8).fill(-1), new Int8Array(8).fill(8)]; // white: most advanced rank per file (max), black: min
    let phase = 0;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if (!p) continue;
      const t = p & 7, c = p >> 3, i = pstIdx(c, s);
      mg[c] += VAL_MG[t] + PST_MG[t][i];
      eg[c] += VAL_EG[t] + PST_EG[t][i];
      phase += PHASE[t];
      if (t === B) bishops[c]++;
      else if (t === P) { pawnFiles[c][s & 7]++; }
    }
    // pawn structure
    for (let c = 0; c < 2; c++) {
      const own = pawnFiles[c], opp = pawnFiles[c ^ 1];
      for (let f = 0; f < 8; f++) {
        if (!own[f]) continue;
        if (own[f] > 1) { mg[c] -= 10 * (own[f] - 1); eg[c] -= 20 * (own[f] - 1); }
        const isolated = (f === 0 || !own[f - 1]) && (f === 7 || !own[f + 1]);
        if (isolated) { mg[c] -= 10 * own[f]; eg[c] -= 12 * own[f]; }
      }
    }
    // passed pawns, rooks on files
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if (!p) continue;
      const t = p & 7, c = p >> 3, f = s & 7, r = s >> 4;
      if (t === P) {
        let passed = true;
        const dir = c === WHITE ? 16 : -16;
        for (let df = -1; df <= 1 && passed; df++) {
          const ff = f + df; if (ff < 0 || ff > 7) continue;
          for (let x = s + dir + df; !(x & 0x88) && x >= 0; x += dir) { if (b[x] === pc(c ^ 1, P)) { passed = false; break; } }
        }
        if (passed) { const rr = c === WHITE ? r : 7 - r; mg[c] += PASSED_MG[rr]; eg[c] += PASSED_EG[rr]; }
      } else if (t === R) {
        if (!pawnFiles[c][f]) { const open = !pawnFiles[c ^ 1][f]; mg[c] += open ? 22 : 10; eg[c] += open ? 10 : 5; }
      }
    }
    // king shelter (middlegame)
    for (let c = 0; c < 2; c++) {
      const ks = this.king[c], f = ks & 7, dir = c === WHITE ? 16 : -16;
      let shield = 0;
      for (let df = -1; df <= 1; df++) {
        const ff = f + df; if (ff < 0 || ff > 7) continue;
        const a = ks + dir + df, a2 = a + dir;
        if (!(a & 0x88) && b[a] === pc(c, P)) shield += 12; else if (!(a2 & 0x88) && b[a2] === pc(c, P)) shield += 6;
      }
      mg[c] += shield;
    }
    if (bishops[0] >= 2) { mg[0] += 30; eg[0] += 45; }
    if (bishops[1] >= 2) { mg[1] += 30; eg[1] += 45; }
    if (phase > 24) phase = 24;
    const mgS = mg[0] - mg[1], egS = eg[0] - eg[1];
    let score = ((mgS * phase + egS * (24 - phase)) / 24) | 0;
    score += this.side === WHITE ? 10 : -10; // tempo
    return this.side === WHITE ? score : -score;
  };
  PP.hasPieces = function (c) {
    for (let s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } const p = this.board[s]; if (p && (p >> 3) === c && (p & 7) !== P && (p & 7) !== K) return true; }
    return false;
  };

  // ── Search ────────────────────────────────────────────────────────────────────────────────────────────
  const INF = 32000, MATE = 30000;
  const TT_BITS = 19, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  const ORDER_VAL = [0, 100, 320, 330, 500, 900, 2000];

  function Searcher() {
    this.ttLo = new Int32Array(TT_SIZE); this.ttHi = new Int32Array(TT_SIZE); this.ttMove = new Int32Array(TT_SIZE);
    this.ttScore = new Int16Array(TT_SIZE); this.ttDepth = new Int8Array(TT_SIZE); this.ttFlag = new Uint8Array(TT_SIZE);
    this.killers = new Int32Array(256 * 2); this.hist = new Int32Array(16 * 128);
    this.moveBufs = []; this.scoreBufs = [];
    for (let i = 0; i < 128; i++) { this.moveBufs.push(new Int32Array(256)); this.scoreBufs.push(new Int32Array(256)); }
  }
  const SP = Searcher.prototype;

  SP.ttStore = function (pos, depth, score, flag, move, ply) {
    const i = pos.lo & TT_MASK;
    if (score > MATE - 500) score += ply; else if (score < -MATE + 500) score -= ply;
    this.ttLo[i] = pos.lo; this.ttHi[i] = pos.hi; this.ttMove[i] = move; this.ttScore[i] = score; this.ttDepth[i] = depth; this.ttFlag[i] = flag;
  };

  SP.order = function (pos, moves, scores, n, ttMove, ply) {
    const b = pos.board;
    for (let i = 0; i < n; i++) {
      const m = moves[i];
      let s;
      if (m === ttMove) s = 10000000;
      else if (mFlag(m) & FLAG_CAP) { const v = mFlag(m) & FLAG_EP ? P : b[mTo(m)] & 7; s = 1000000 + ORDER_VAL[v] * 10 - (b[mFrom(m)] & 7); }
      else if (mPromo(m)) s = 900000 + mPromo(m);
      else if (m === this.killers[ply * 2]) s = 800000;
      else if (m === this.killers[ply * 2 + 1]) s = 790000;
      else s = this.hist[b[mFrom(m)] * 128 + mTo(m)];
      scores[i] = s;
    }
  };
  function pick(moves, scores, n, i) {
    let best = i;
    for (let j = i + 1; j < n; j++) if (scores[j] > scores[best]) best = j;
    if (best !== i) { const m = moves[i]; moves[i] = moves[best]; moves[best] = m; const s = scores[i]; scores[i] = scores[best]; scores[best] = s; }
    return moves[i];
  }

  SP.checkTime = function () {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.stop = true;
  };

  SP.qsearch = function (pos, alpha, beta, ply) {
    this.checkTime();
    if (this.stop) return 0;
    const stand = pos.evaluate();
    if (ply >= 120) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const moves = this.moveBufs[ply], scores = this.scoreBufs[ply];
    const n = pos.gen(moves, true);
    this.order(pos, moves, scores, n, 0, ply);
    for (let i = 0; i < n; i++) {
      const m = pick(moves, scores, n, i);
      // delta pruning
      if (!mPromo(m)) { const v = mFlag(m) & FLAG_EP ? P : pos.board[mTo(m)] & 7; if (stand + ORDER_VAL[v] + 200 < alpha) continue; }
      if (!pos.make(m)) continue;
      const sc = -this.qsearch(pos, -beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stop) return 0;
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  };

  SP.negamax = function (pos, depth, alpha, beta, ply, allowNull) {
    this.checkTime();
    if (this.stop) return 0;
    if (ply > 0) {
      if (pos.half >= 100 || pos.repetitions() >= 2 || pos.insufficient()) return 0;
      // mate distance pruning
      const ma = Math.max(alpha, -MATE + ply), mb = Math.min(beta, MATE - ply - 1);
      if (ma >= mb) return ma;
    }
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0 || ply >= 120) return this.qsearch(pos, alpha, beta, ply);

    const ti = pos.lo & TT_MASK;
    let ttMove = 0;
    if (this.ttLo[ti] === pos.lo && this.ttHi[ti] === pos.hi) {
      ttMove = this.ttMove[ti];
      if (ply > 0 && this.ttDepth[ti] >= depth) {
        let s = this.ttScore[ti];
        if (s > MATE - 500) s -= ply; else if (s < -MATE + 500) s += ply;
        const f = this.ttFlag[ti];
        if (f === 1) return s;
        if (f === 2 && s >= beta) return s;
        if (f === 3 && s <= alpha) return s;
      }
    }
    const pv = beta - alpha > 1;
    if (allowNull && !inCheck && !pv && depth >= 3 && ply > 0 && pos.hasPieces(pos.side) && pos.evaluate() >= beta) {
      pos.makeNull();
      const s = -this.negamax(pos, depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmakeNull();
      if (this.stop) return 0;
      if (s >= beta) return beta;
    }

    const moves = this.moveBufs[ply], scores = this.scoreBufs[ply];
    const n = pos.gen(moves, false);
    this.order(pos, moves, scores, n, ttMove, ply);
    let best = -INF, bestMove = 0, legal = 0;
    const alpha0 = alpha;
    for (let i = 0; i < n; i++) {
      const m = pick(moves, scores, n, i);
      if (!pos.make(m)) continue;
      legal++;
      const quiet = !(mFlag(m) & FLAG_CAP) && !mPromo(m);
      let sc;
      if (legal === 1) sc = -this.negamax(pos, depth - 1, -beta, -alpha, ply + 1, true);
      else {
        let red = 0;
        if (depth >= 3 && legal > 3 && quiet && !inCheck && m !== this.killers[ply * 2] && m !== this.killers[ply * 2 + 1] && !pos.inCheck()) red = legal > 8 ? 2 : 1;
        sc = -this.negamax(pos, depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (sc > alpha && red) sc = -this.negamax(pos, depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (sc > alpha && sc < beta) sc = -this.negamax(pos, depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (this.stop) return 0;
      if (sc > best) {
        best = sc; bestMove = m;
        if (sc > alpha) {
          alpha = sc;
          if (sc >= beta) {
            if (quiet) {
              if (this.killers[ply * 2] !== m) { this.killers[ply * 2 + 1] = this.killers[ply * 2]; this.killers[ply * 2] = m; }
              const hi = pos.board[mFrom(m)] * 128 + mTo(m);
              this.hist[hi] += depth * depth; if (this.hist[hi] > 700000) for (let k = 0; k < this.hist.length; k++) this.hist[k] >>= 1;
            }
            break;
          }
        }
      }
    }
    if (!legal) return inCheck ? -MATE + ply : 0;
    this.ttStore(pos, depth, best, best >= beta ? 2 : best > alpha0 ? 1 : 3, bestMove, ply);
    return best;
  };

  // ── Opening book (our own selection of common lines, in SAN) ─────────────────────────────────────────
  const BOOK_LINES = [
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O',
    'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5',
    'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
    'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6',
    'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7',
    'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6',
    'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7',
    'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6',
    'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 Be2 a6',
    'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6',
    'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6',
    'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7',
    'e4 e6 d4 d5 Nd2 c5 exd5 exd5 Ngf3 Nc6',
    'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6',
    'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6',
    'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5',
    'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 Bf5',
    'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6',
    'e4 Nf6 e5 Nd5 d4 d6 Nf3 g6 Bc4 Nb6',
    'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6',
    'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6',
    'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6',
    'd4 d5 Nf3 Nf6 Bf4 e6 e3 c5 c3 Nc6',
    'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5',
    'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5',
    'd4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O',
    'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7',
    'd4 Nf6 Nf3 e6 Bf4 d5 e3 c5 c3 Nc6',
    'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6',
    'd4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O',
    'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5',
    'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 Nf6',
    'c4 Nf6 Nc3 e6 e4 d5 e5 d4',
    'Nf3 d5 g3 Nf6 Bg2 c6 O-O Bg4 d3 Nbd7',
    'Nf3 Nf6 c4 g6 Nc3 Bg7 e4 d6 d4 O-O',
  ];
  let BOOK = null;
  function book() {
    if (BOOK) return BOOK;
    BOOK = new Map();
    const pos = new Position();
    for (const line of BOOK_LINES) {
      pos.setFen(START_FEN);
      for (const san of line.split(' ')) {
        const m = pos.fromSan(san);
        if (!m) break;
        const k = pos.key();
        if (!BOOK.has(k)) BOOK.set(k, []);
        const u = pos.uci(m);
        if (!BOOK.get(k).includes(u)) BOOK.get(k).push(u);
        pos.make(m);
      }
    }
    return BOOK;
  }

  // ── Levels ────────────────────────────────────────────────────────────────────────────────────────────
  // noise: random centipawns added to every root score; blunder: chance of a random legal move.
  const LEVELS = {
    1: { maxDepth: 1, allScores: true, noise: 260, blunder: 0.12, book: false },
    2: { maxDepth: 3, allScores: true, noise: 70, blunder: 0.03, book: true },
    3: { maxDepth: 6, timeMs: 900, noise: 0, blunder: 0, book: true },
    4: { maxDepth: 64, timeMs: 2500, noise: 0, blunder: 0, book: true },
    hint: { maxDepth: 64, timeMs: 1200, noise: 0, blunder: 0, book: false },
  };

  /** Position from the list of UCI moves played since the start (keeps repetition history). */
  function fromMoves(uciList, startFen) {
    const pos = new Position(startFen || START_FEN);
    for (const u of uciList || []) {
      const m = pos.fromUci(u);
      if (!m) break;
      pos.make(m);
    }
    return pos;
  }

  /**
   * Choose a move for `level` (1–4 or 'hint'). opts: {timeMs?, random?}. Returns {uci, score, depth, book}.
   */
  let SEARCHER = null;
  function think(uciList, level, opts) {
    opts = opts || {};
    const cfg = LEVELS[level] || LEVELS[3];
    const rnd = opts.random || Math.random;
    const pos = fromMoves(uciList);
    const legal = pos.legalMoves();
    if (!legal.length) return null;
    if (cfg.book && uciList.length < 20) {
      const opts2 = book().get(pos.key());
      if (opts2 && opts2.length) { const u = opts2[(rnd() * opts2.length) | 0]; if (pos.fromUci(u)) return { uci: u, score: 0, depth: 0, book: true }; }
    }
    if (cfg.blunder && rnd() < cfg.blunder) {
      const m = legal[(rnd() * legal.length) | 0];
      return { uci: pos.uci(m), score: 0, depth: 0, blunder: true };
    }
    const searcher = SEARCHER || (SEARCHER = new Searcher());
    const timeMs = Math.min(cfg.timeMs || 1e9, opts.timeMs || 1e9);
    const res = searcher.searchRoot(pos, { maxDepth: cfg.maxDepth, timeMs, allScores: cfg.allScores });
    let move = res.move;
    if (cfg.noise && res.scores && res.scores.length) {
      let best = -Infinity;
      for (const [m, s] of res.scores) {
        const v = Math.max(-5000, Math.min(5000, s)) + (rnd() * 2 - 1) * cfg.noise;
        if (v > best) { best = v; move = m; }
      }
    }
    return { uci: pos.uci(move), score: res.score, depth: res.depth, nodes: res.nodes };
  }
  SP.searchRoot = function (pos, opts) {
    // Same as search() but keeps pos.ply (history) — the move buffers are indexed by distance from root.
    const maxDepth = opts.maxDepth || 64, timeMs = opts.timeMs || 1e9;
    const t0 = Date.now();
    this.deadline = t0 + timeMs; this.stop = false; this.nodes = 0;
    this.killers.fill(0);
    for (let k = 0; k < this.hist.length; k++) this.hist[k] >>= 2;
    const root = pos.legalMoves();
    if (!root.length) return { move: 0, score: pos.inCheck() ? -MATE : 0, depth: 0 };
    let bestMove = root[0], bestScore = -INF, depthDone = 0, scored = null;
    const rootScores = new Map();
    for (let d = 1; d <= maxDepth; d++) {
      root.sort((a, b) => (a === bestMove ? -1 : b === bestMove ? 1 : (rootScores.get(b) ?? -INF) - (rootScores.get(a) ?? -INF)));
      let alpha = -INF, curBest = 0, curScore = -INF;
      for (let i = 0; i < root.length; i++) {
        const m = root[i];
        pos.make(m);
        let sc;
        if (opts.allScores) sc = -this.negamax(pos, d - 1, -INF, INF, 1, true);
        else if (i === 0) sc = -this.negamax(pos, d - 1, -INF, -alpha, 1, true);
        else {
          sc = -this.negamax(pos, d - 1, -alpha - 1, -alpha, 1, true);
          if (sc > alpha && !this.stop) sc = -this.negamax(pos, d - 1, -INF, -alpha, 1, true);
        }
        pos.unmake();
        if (this.stop) break;
        rootScores.set(m, sc);
        if (sc > curScore) { curScore = sc; curBest = m; }
        if (sc > alpha) alpha = sc;
      }
      if (curBest && (!this.stop || curScore > bestScore || d === 1)) { bestMove = curBest; bestScore = curScore; }
      if (this.stop) break;
      depthDone = d;
      if (opts.allScores) scored = root.map((m) => [m, rootScores.get(m)]);
      if (Math.abs(bestScore) > MATE - 200) break;
      if (Date.now() - t0 > timeMs * 0.55) break;
    }
    return { move: bestMove, score: bestScore, depth: depthDone, nodes: this.nodes, scores: scored };
  };

  /** Would the engine (playing engineColor) accept a draw offer here? */
  function acceptsDraw(uciList, engineColor) {
    const pos = fromMoves(uciList);
    if (pos.insufficient()) return true;
    const r = think(uciList, 'hint', { timeMs: 400 });
    if (!r) return true;
    const score = pos.side === engineColor ? r.score : -r.score; // from the engine's side
    return score <= -120 || (Math.abs(score) <= 25 && uciList.length >= 60);
  }

  function perft(pos, depth) {
    if (!depth) return 1;
    const moves = new Int32Array(256), n = pos.gen(moves, false);
    let total = 0;
    for (let i = 0; i < n; i++) { if (!pos.make(moves[i])) continue; total += perft(pos, depth - 1); pos.unmake(); }
    return total;
  }

  /** PGN text for a game. tags: {White, Black, Result, Date, Event}. */
  function pgn(uciList, tags) {
    const pos = new Position();
    let txt = '';
    const sans = [];
    for (const u of uciList) { const m = pos.fromUci(u); if (!m) break; sans.push(pos.san(m)); pos.make(m); }
    for (const k of ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result']) txt += `[${k} "${(tags && tags[k]) || (k === 'Result' ? '*' : '?')}"]\n`;
    txt += '\n';
    let line = '';
    sans.forEach((s, i) => { line += (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + s + ' '; });
    line += (tags && tags.Result) || '*';
    // wrap at 80 columns
    let out = '', cur = '';
    for (const w of line.split(' ')) { if ((cur + ' ' + w).trim().length > 80) { out += cur.trim() + '\n'; cur = ''; } cur += ' ' + w; }
    return txt + out + cur.trim() + '\n';
  }

  const api = {
    WHITE, BLACK, P, N, B, R, Q, K, START_FEN, MATE,
    Position, Searcher, fromMoves, think, acceptsDraw, perft, pgn, book,
    sqName, sqParse, mFrom, mTo, mPromo, mFlag, FLAG_CAP, FLAG_EP, FLAG_CASTLE,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChessEngine = api;
})(typeof self !== 'undefined' ? self : this);
