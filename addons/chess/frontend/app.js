/* Chess addon for Offlined — the panel. MIT licence. */
(function () {
  'use strict';

  const ID = 'chess';
  const C = window.ChessEngine;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const W = C.WHITE, Bk = C.BLACK;
  const TYPE = ['', 'p', 'n', 'b', 'r', 'q', 'k'];
  const LEVEL_TIME = { 1: 0, 2: 0, 3: 900, 4: 2500 };

  // ── Language ────────────────────────────────────────────────────────────────────────────────────────
  const I18N = window.CHESS_I18N;
  let lang = (params.get('lang') || navigator.language || 'en').slice(0, 2).toLowerCase();
  if (!I18N[lang]) lang = 'en';
  const t = (k, vars) => {
    let s = I18N[lang][k] !== undefined ? I18N[lang][k] : I18N.en[k];
    if (vars && typeof s === 'string') for (const v in vars) s = s.split('{' + v + '}').join(vars[v]);
    return s;
  };
  const lvName = (l) => t('lv')[l - 1];
  document.documentElement.lang = lang;
  if (lang === 'ar') document.documentElement.dir = 'rtl';
  function applyTexts() {
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-tt]').forEach((el) => { el.title = t(el.dataset.tt); el.setAttribute('aria-label', t(el.dataset.tt)); });
    document.querySelectorAll('#clockSeg button').forEach((b) => { if (b.dataset.v !== '0') b.textContent = t('min', { n: b.dataset.v }); });
  }
  const PZ = (type, color, extra) => `<svg class="pz ${color === undefined ? 'line' : color === W ? 'w' : 'b'}${extra ? ' ' + extra : ''}"><use href="#p-${type}"/></svg>`;

  // ── Theme ───────────────────────────────────────────────────────────────────────────────────────────
  let DB = null, storeMode = 'offlined', saveTimer = null;
  let offlinedTheme = params.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function applyTheme() {
    const pref = DB ? settings().theme : 'auto';
    document.documentElement.dataset.theme = pref === 'auto' ? offlinedTheme : pref;
  }
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'theme' && (e.data.value === 'light' || e.data.value === 'dark')) { offlinedTheme = e.data.value; applyTheme(); }
  });
  applyTheme();

  // ── Storage (one object, a section per Offlined user) ───────────────────────────────────────────────
  const DEFAULTS = { legal: true, last: true, coords: true, theme: 'auto', level: 2, color: 'w', clock: 0 };
  async function loadDB() {
    try {
      const r = await fetch(`/api/addons/${ID}/storage`, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      DB = (await r.json()).data;
    } catch (_) {
      storeMode = 'local';
      try { DB = JSON.parse(localStorage.getItem('ofl_chess') || '{}'); } catch (__) { DB = {}; }
    }
    if (!DB || typeof DB !== 'object') DB = {};
    DB.v = 1;
    DB.users = DB.users && typeof DB.users === 'object' ? DB.users : {};
  }
  function save(now) { clearTimeout(saveTimer); saveTimer = setTimeout(doSave, now ? 0 : 600); }
  function doSave() {
    if (!DB) return;
    if (storeMode === 'local') { try { localStorage.setItem('ofl_chess', JSON.stringify(DB)); } catch (_) {} return; }
    const body = JSON.stringify({ data: DB });
    fetch(`/api/addons/${ID}/storage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: body.length < 60000 }).catch(() => {});
  }
  let UID = 'default', USER = { name: '', color: '', photo: false, id: null };
  async function loadUser() {
    try {
      const s = await (await fetch('/api/users/session', { cache: 'no-store' })).json();
      const id = s.active || s.last_user;
      if (id) UID = String(id);
      const u = (s.users || []).find((x) => x.id === id);
      if (u) USER = { name: u.name || '', color: u.color || '', photo: !!u.has_photo, id: u.id };
    } catch (_) {}
  }
  function me() {
    const u = DB.users[UID] || (DB.users[UID] = {});
    u.settings = Object.assign({}, DEFAULTS, u.settings || {});
    u.stats = u.stats || {};
    u.streak = u.streak || 0;
    return u;
  }
  const settings = () => (DB ? me().settings : DEFAULTS);
  const statsOf = (l) => { const s = me().stats; return s[l] || (s[l] = { won: 0, draw: 0, lost: 0, wonHelped: 0 }); };

  // ── Game state ──────────────────────────────────────────────────────────────────────────────────────
  // G (saved): {moves:[uci], level, me:0|1, clock:{base, t:[msWhite, msBlack]}|null, helped, result:{result, reason}|null}
  let G = null, pos = null, legal = [], sel = -1, userFlip = false, thinking = false, endShown = false;
  let worker = null, jobId = 0, turnStart = 0, hintArrow = null, drag = null;

  function rebuild() {
    pos = C.fromMoves(G.moves);
    legal = G.result ? [] : pos.legalMoves();
  }
  const myTurn = () => G && !G.result && pos.side === G.me && !thinking;

  function newGame() {
    const S = settings();
    const meColor = S.color === 'r' ? (Math.random() < 0.5 ? W : Bk) : S.color === 'b' ? Bk : W;
    const base = (+S.clock || 0) * 60000;
    G = { moves: [], level: S.level, me: meColor, clock: base ? { base, t: [base, base] } : null, helped: false, result: null };
    me().game = G;
    stopWorker();
    sel = -1; userFlip = false; hintArrow = null; endShown = false;
    rebuild();
    turnStart = performance.now();
    renderAll();
    save();
    closeDrawer();
    if (pos.side !== G.me) engineTurn();
  }
  let pendingConfirm = null;
  function confirmBox(text, yes, fn) {
    $('confirmText').textContent = text; $('confirmYes').textContent = yes;
    pendingConfirm = fn; $('confirmDlg').classList.add('show');
  }
  $('confirmYes').onclick = () => { $('confirmDlg').classList.remove('show'); const f = pendingConfirm; pendingConfirm = null; if (f) f(); };
  $('confirmNo').onclick = () => { $('confirmDlg').classList.remove('show'); pendingConfirm = null; };
  function requestNew() {
    if (G && !G.result && G.moves.length >= 2) confirmBox(t('confirmNew'), t('yesNew'), newGame);
    else newGame();
  }

  // ── Worker (the computer thinks there) ──────────────────────────────────────────────────────────────
  function inlineWorker() {
    const w = { onmessage: null, terminate() { w.dead = true; } };
    w.postMessage = (m) => setTimeout(() => {
      if (w.dead) return;
      let data;
      if (m.type === 'think') data = { type: 'move', id: m.id, result: C.think(m.moves, m.level, { timeMs: m.timeMs }) };
      else data = { type: 'draw', id: m.id, accept: C.acceptsDraw(m.moves, m.engineColor) };
      if (!w.dead && w.onmessage) w.onmessage({ data });
    }, 30);
    return w;
  }
  function getWorker() {
    if (worker) return worker;
    try { worker = new Worker('worker.js'); } catch (_) { worker = inlineWorker(); }
    worker.onmessage = onWorker;
    return worker;
  }
  function stopWorker() {
    if (worker) { worker.terminate(); worker = null; }
    thinking = false; jobId++;
  }
  const pending = {};
  function ask(msg) {
    const id = ++jobId;
    return new Promise((res) => { pending[id] = res; getWorker().postMessage(Object.assign({ id }, msg)); });
  }
  function onWorker(e) {
    const m = e.data, f = pending[m.id];
    delete pending[m.id];
    if (f && m.id === jobId) f(m);
  }

  function engineTurn() {
    if (!G || G.result) return;
    thinking = true; renderStatus(); renderTools();
    const started = performance.now();
    let timeMs = LEVEL_TIME[G.level] || undefined;
    if (G.clock) {
      const left = G.clock.t[pos.side];
      timeMs = Math.max(150, Math.min(timeMs || 1e9, left / 30));
    }
    const forGame = G;
    ask({ type: 'think', moves: G.moves.slice(), level: G.level, timeMs }).then((m) => {
      if (G !== forGame || !thinking) return;
      const wait = Math.max(0, 450 - (performance.now() - started));
      setTimeout(() => {
        if (G !== forGame || !thinking) return;
        thinking = false;
        if (m.type === 'move' && m.result) applyMove(m.result.uci);
        else { renderAll(); }
      }, wait);
    });
  }

  // ── Moves ───────────────────────────────────────────────────────────────────────────────────────────
  function spendClock() {
    if (!G.clock || G.result) return;
    const now = performance.now();
    G.clock.t[pos.side] = Math.max(0, G.clock.t[pos.side] - (now - turnStart));
    turnStart = now;
  }
  function applyMove(uci) {
    spendClock();
    G.moves.push(uci);
    hintArrow = null; sel = -1;
    rebuild();
    const st = pos.status();
    if (st.over) finish(st.result, st.reason);
    renderAll();
    save();
    if (!G.result && pos.side !== G.me) engineTurn();
  }
  function tryMove(from, to) {
    const cand = legal.filter((m) => C.mFrom(m) === from && C.mTo(m) === to);
    if (!cand.length) return false;
    if (cand.length > 1) { askPromo(cand); return true; }
    applyMove(pos.uci(cand[0]));
    return true;
  }
  function askPromo(cand) {
    const box = $('promoPieces'); box.innerHTML = '';
    for (const pr of [C.Q, C.R, C.B, C.N]) {
      const m = cand.find((x) => C.mPromo(x) === pr);
      if (!m) continue;
      const b = document.createElement('button');
      b.innerHTML = PZ(TYPE[pr], G.me);
      b.onclick = () => { $('promo').classList.remove('show'); applyMove(pos.uci(m)); };
      box.appendChild(b);
    }
    $('promo').classList.add('show');
  }

  function resultFor(result) { // from my side
    if (result === '1/2-1/2') return 'draw';
    return (result === '1-0') === (G.me === W) ? 'win' : 'loss';
  }
  function finish(result, reason) {
    if (G.result) return;
    G.result = { result, reason };
    stopWorker();
    const out = resultFor(result), s = statsOf(G.level), u = me();
    if (out === 'win') { s.won++; if (G.helped) s.wonHelped++; u.streak = G.helped ? 0 : u.streak + 1; }
    else if (out === 'draw') { s.draw++; u.streak = 0; }
    else { s.lost++; u.streak = 0; }
    u.game = null;
    legal = [];
    save(true);
    setTimeout(showEnd, 500);
  }
  function showEnd() {
    if (!G || !G.result || endShown) return;
    endShown = true;
    const out = resultFor(G.result.result), s = statsOf(G.level);
    $('endTitle').textContent = out === 'win' ? t('win') : out === 'loss' ? t('loss') : t('drawT');
    $('endBadge').classList.toggle('lose', out !== 'win');
    $('endBadge').innerHTML = PZ(out === 'draw' ? 'p' : 'k', undefined);
    const moves = Math.ceil(G.moves.length / 2);
    $('endSub').textContent = t('endSub', { reason: t('r_' + G.result.reason), moves, lv: lvName(G.level) }) + (G.helped ? ' · ' + t('withHelp') : '');
    $('endW').textContent = s.won; $('endD').textContent = s.draw; $('endL').textContent = s.lost;
    renderAll();
    $('endDlg').classList.add('show');
  }
  $('endAgain').onclick = () => { $('endDlg').classList.remove('show'); newGame(); };
  $('endClose').onclick = () => $('endDlg').classList.remove('show');
  $('endPgn').onclick = () => copyPgn();

  // ── Board ───────────────────────────────────────────────────────────────────────────────────────────
  const board = $('board'), sqEls = [];
  for (let k = 0; k < 64; k++) { const d = document.createElement('div'); board.appendChild(d); sqEls.push(d); }
  const flipped = () => (G ? G.me === Bk : false) !== userFlip;
  function sqOfIndex(k) { // display index (row-major from the top) → 0x88 square
    const row = k >> 3, col = k & 7;
    return flipped() ? row * 16 + (7 - col) : (7 - row) * 16 + col;
  }
  function indexOfSq(s) { const r = s >> 4, f = s & 7; return flipped() ? r * 8 + (7 - f) : (7 - r) * 8 + f; }
  function sqAtPoint(x, y) {
    const rc = board.getBoundingClientRect();
    const col = Math.floor(((x - rc.left) / rc.width) * 8), row = Math.floor(((y - rc.top) / rc.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
    return sqOfIndex(row * 8 + col);
  }

  function renderBoard() {
    const S = settings();
    const b = pos ? pos.board : new Int8Array(128);
    const last = G && G.moves.length ? G.moves[G.moves.length - 1] : null;
    const lastF = last ? C.sqParse(last.slice(0, 2)) : -1, lastT = last ? C.sqParse(last.slice(2, 4)) : -1;
    const dests = sel >= 0 && S.legal ? legal.filter((m) => C.mFrom(m) === sel).map((m) => C.mTo(m)) : [];
    const checkSq = pos && !G.result && pos.inCheck() ? pos.king[pos.side] : (G && G.result && G.result.reason === 'checkmate' ? pos.king[pos.side] : -1);
    const bottomRow = 7, leftCol = 0;
    for (let k = 0; k < 64; k++) {
      const s = sqOfIndex(k), r = s >> 4, f = s & 7, el = sqEls[k];
      let cls = 'sq ' + ((r + f) % 2 ? 'l' : 'd');
      if (S.last && (s === lastF || s === lastT)) cls += ' last';
      if (s === sel) cls += ' sel';
      if (s === checkSq) cls += ' check';
      if (drag && drag.moved && drag.sq === s) cls += ' dragging';
      let html = '';
      const p = b[s];
      if (p) html += PZ(TYPE[p & 7], p >> 3);
      if (dests.includes(s)) html += p ? '<div class="ring"></div>' : '<div class="dot"></div>';
      if (S.coords) {
        const row = k >> 3, col = k & 7;
        if (row === bottomRow) html += `<span class="co f">${'abcdefgh'[f]}</span>`;
        if (col === leftCol) html += `<span class="co r">${r + 1}</span>`;
      }
      if (el.className !== cls) el.className = cls;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
    }
    renderArrow();
  }
  function renderArrow() {
    const a = $('arrow');
    if (!hintArrow) { a.innerHTML = ''; return; }
    const xy = (s) => { const k = indexOfSq(s); return [(k & 7) + 0.5, (k >> 3) + 0.5]; };
    const [p, q] = [xy(hintArrow[0]), xy(hintArrow[1])];
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy), ex = q[0] - (dx / len) * 0.25, ey = q[1] - (dy / len) * 0.25;
    a.innerHTML = `<defs><marker id="ah" viewBox="0 0 10 10" refX="4" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--acc)"/></marker></defs>` +
      `<line x1="${p[0]}" y1="${p[1]}" x2="${ex}" y2="${ey}" stroke="var(--acc)" stroke-width=".17" stroke-linecap="round" opacity=".9" marker-end="url(#ah)"/>`;
  }

  // Captured pieces and material balance.
  const START_COUNT = [0, 8, 2, 2, 2, 1, 0], VAL = [0, 1, 3, 3, 5, 9, 0];
  function renderCaps() {
    if (!pos) return;
    const cnt = [new Array(7).fill(0), new Array(7).fill(0)];
    for (let s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } const p = pos.board[s]; if (p) cnt[p >> 3][p & 7]++; }
    let mat = [0, 0];
    const html = (byColor) => { // pieces of the other colour taken by `byColor`
      const victim = byColor ^ 1; let h = '';
      for (const ty of [5, 4, 3, 2, 1]) { const lost = Math.max(0, START_COUNT[ty] - cnt[victim][ty]); for (let i = 0; i < lost; i++) h += PZ(TYPE[ty], victim); }
      return h;
    };
    for (let c = 0; c < 2; c++) for (let ty = 1; ty <= 5; ty++) mat[c] += cnt[c][ty] * VAL[ty];
    const meC = G.me, ai = meC ^ 1, diff = mat[meC] - mat[ai];
    $('capsBot').innerHTML = html(meC) + (diff > 0 ? `<b>+${diff}</b>` : '');
    $('capsTop').innerHTML = html(ai) + (diff < 0 ? `<b>+${-diff}</b>` : '');
  }

  function sanHtml(san) {
    return san.replace(/^([KQRBN])/, (_, l) => PZ(l.toLowerCase())).replace(/=([QRBN])/, (_, l) => '=' + PZ(l.toLowerCase()));
  }
  function renderMoves() {
    const box = $('moves');
    if (!G || !G.moves.length) { box.innerHTML = `<div class="empty">${t('noMoves')}</div>`; return; }
    const p = new C.Position(); const sans = [];
    for (const u of G.moves) { const m = p.fromUci(u); if (!m) break; sans.push(p.san(m)); p.make(m); }
    let h = '';
    for (let i = 0; i < sans.length; i += 2) {
      h += `<span class="n">${i / 2 + 1}.</span><span class="m${i === sans.length - 1 ? ' cur' : ''}">${sanHtml(sans[i])}</span>` +
        `<span class="m${i + 1 === sans.length - 1 ? ' cur' : ''}">${sans[i + 1] ? sanHtml(sans[i + 1]) : ''}</span>`;
    }
    box.innerHTML = h;
    box.scrollTop = box.scrollHeight;
  }
  function fmtClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60), x = s % 60;
    return m + ':' + String(x).padStart(2, '0');
  }
  function renderClocks() {
    const on = !!(G && G.clock);
    $('clockTop').hidden = $('clockBot').hidden = !on;
    if (!on) return;
    const running = !G.result && document.visibilityState === 'visible';
    for (const [el, c] of [[$('clockBot'), G.me], [$('clockTop'), G.me ^ 1]]) {
      let ms = G.clock.t[c];
      const active = running && pos.side === c;
      if (active) ms -= performance.now() - turnStart;
      el.textContent = fmtClock(ms);
      el.classList.toggle('run', active && ms > 20000);
      el.classList.toggle('low', ms <= 20000 && (active || ms <= 0));
      if (active && ms <= 0 && !G.result) timeout(c);
    }
  }
  function timeout(c) {
    G.clock.t[c] = 0;
    // The side with time left wins, unless it cannot mate at all.
    const p = new C.Position(pos.fen());
    let winnerCanMate = false;
    for (let s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } const q = p.board[s]; if (q && (q >> 3) !== c && (q & 7) !== C.K) { winnerCanMate = true; break; } }
    finish(winnerCanMate ? (c === W ? '0-1' : '1-0') : '1/2-1/2', 'timeout');
    renderAll();
  }
  function renderStatus() {
    if (!G) return;
    $('aiLvl').textContent = lvName(G.level);
    $('thinking').hidden = !thinking;
    $('meColor').textContent = G.me === W ? t('white') : t('black');
    $('aiAv').innerHTML = PZ('k', G.me ^ 1);
    $('pBot').classList.toggle('turn', !G.result && pos.side === G.me);
    $('pTop').classList.toggle('turn', !G.result && pos.side !== G.me);
  }
  function renderTools() {
    const live = G && !G.result;
    $('undoBtn').disabled = !live || G.moves.length < (G.me === W ? 1 : 2);
    $('hintBtn').disabled = !myTurn();
    $('drawBtn').disabled = !live || thinking || G.moves.length < 2;
    $('resignBtn').disabled = !live;
  }
  function renderLevels() {
    const S = settings();
    document.querySelectorAll('#levels .lvl').forEach((b, k) => b.classList.toggle('on', k + 1 === S.level));
    document.querySelectorAll('#colors button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.color));
    document.querySelectorAll('#clockSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === +S.clock));
  }
  let statLevel = 2;
  function renderStats() {
    document.querySelectorAll('#statTabs button').forEach((b, k) => b.classList.toggle('on', k + 1 === statLevel));
    const s = statsOf(statLevel);
    $('stW').textContent = s.won; $('stD').textContent = s.draw; $('stL').textContent = s.lost;
    $('stHelp').textContent = s.wonHelped ? t('wonHelped', { n: s.wonHelped }) : '';
    let wins = 0; for (const l in me().stats) wins += me().stats[l].won || 0;
    const n = me().streak;
    $('userSub').textContent = t('streakLine', { s: n === 0 ? t('streak0') : n === 1 ? t('streak1') : t('streakN', { n }), w: wins });
  }
  function renderSettings() {
    const S = settings();
    document.querySelectorAll('.sw').forEach((s) => s.classList.toggle('on', !!S[s.dataset.k]));
    document.querySelectorAll('#themeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.theme));
  }
  function renderUser() {
    const name = USER.name || t('you');
    $('userName').textContent = name;
    for (const av of [$('avatar'), $('meAv')]) {
      av.style.background = USER.color || '#6b7280';
      if (USER.photo && USER.id) av.innerHTML = `<img alt="" src="/api/users/${encodeURIComponent(USER.id)}/avatar">`;
      else av.textContent = (name.trim()[0] || '?').toUpperCase();
    }
  }
  function renderAll() {
    if (!G) return;
    renderBoard(); renderCaps(); renderMoves(); renderStatus(); renderTools(); renderClocks(); renderLevels(); renderStats(); renderSettings();
  }

  // ── Pointer: click-click and drag ───────────────────────────────────────────────────────────────────
  const wrap = $('boardWrap');
  wrap.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !G) return;
    const s = sqAtPoint(e.clientX, e.clientY);
    if (s < 0) return;
    if (sel >= 0 && s !== sel && myTurn() && tryMove(sel, s)) { e.preventDefault(); return; }
    const p = pos.board[s];
    if (myTurn() && p && (p >> 3) === G.me) {
      sel = sel === s ? -1 : s;
      drag = { sq: s, x0: e.clientX, y0: e.clientY, moved: false, wasSel: sel === -1 };
      if (sel === -1) { sel = s; drag.toggleOff = true; }
      wrap.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else sel = -1;
    renderBoard();
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      const p = pos.board[drag.sq];
      const g = document.createElement('div'); g.className = 'ghost'; g.innerHTML = PZ(TYPE[p & 7], p >> 3);
      wrap.appendChild(g); drag.ghost = g;
      renderBoard();
    }
    const rc = wrap.getBoundingClientRect();
    drag.ghost.style.left = (e.clientX - rc.left) + 'px';
    drag.ghost.style.top = (e.clientY - rc.top) + 'px';
  });
  function endDrag(e, cancel) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    if (d.moved && !cancel) {
      const s = sqAtPoint(e.clientX, e.clientY);
      if (s >= 0 && s !== d.sq && tryMove(d.sq, s)) return;
    } else if (!d.moved && d.toggleOff) sel = -1;
    renderBoard();
  }
  wrap.addEventListener('pointerup', (e) => endDrag(e, false));
  wrap.addEventListener('pointercancel', (e) => endDrag(e, true));

  // ── Tools ───────────────────────────────────────────────────────────────────────────────────────────
  let toastTimer = null;
  function toast(text) {
    const el = $('toast'); el.textContent = text; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }
  function markHelped() { if (!G.helped) { G.helped = true; return true; } return false; }

  $('undoBtn').onclick = () => {
    if (!G || G.result) return;
    stopWorker();
    spendClock();
    // take back to the last position where it is my turn
    let n = 0;
    if (pos.side !== G.me) n = 1; else n = 2;
    n = Math.min(n, G.moves.length);
    G.moves.splice(G.moves.length - n, n);
    if (C.fromMoves(G.moves).side !== G.me && G.moves.length) G.moves.pop();
    const first = markHelped();
    sel = -1; hintArrow = null;
    rebuild(); turnStart = performance.now();
    renderAll(); save();
    if (first) toast(t('helpNote'));
    if (pos.side !== G.me) engineTurn();
  };
  $('hintBtn').onclick = () => {
    if (!myTurn()) return;
    const forGame = G, ply = G.moves.length;
    $('hintBtn').disabled = true;
    ask({ type: 'think', moves: G.moves.slice(), level: 'hint' }).then((m) => {
      if (G !== forGame || G.moves.length !== ply || !m.result) { renderTools(); return; }
      const u = m.result.uci;
      hintArrow = [C.sqParse(u.slice(0, 2)), C.sqParse(u.slice(2, 4))];
      const first = markHelped();
      renderBoard(); renderTools(); save();
      toast(t('hintShown') + (first ? ' ' + t('helpNote') : ''));
    });
  };
  $('flipBtn').onclick = () => { userFlip = !userFlip; renderBoard(); };
  $('drawBtn').onclick = () => {
    if (!G || G.result || thinking) return;
    const forGame = G;
    $('drawBtn').disabled = true;
    ask({ type: 'draw', moves: G.moves.slice(), engineColor: G.me ^ 1 }).then((m) => {
      if (G !== forGame || G.result) return;
      if (m.accept) { spendClock(); finish('1/2-1/2', 'agreed'); renderAll(); }
      else { toast(t('drawDeclined')); renderTools(); }
    });
  };
  $('resignBtn').onclick = () => {
    if (!G || G.result) return;
    confirmBox(t('confirmResign'), t('yesResign'), () => { spendClock(); finish(G.me === W ? '0-1' : '1-0', 'resign'); renderAll(); });
  };
  function pgnText() {
    const name = USER.name || t('you');
    const d = new Date(), date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const ai = `Offlined (${lvName(G.level)})`;
    return C.pgn(G.moves, { Event: 'Offlined', Site: 'Offlined', Date: date, White: G.me === W ? name : ai, Black: G.me === W ? ai : name, Result: G.result ? G.result.result : '*' });
  }
  async function copyPgn() {
    if (!G) return;
    const text = pgnText();
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (_) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (__) {} ta.remove();
    }
    if (ok) toast(t('copied'));
  }
  $('pgnBtn').onclick = copyPgn;

  // ── Side panel controls ─────────────────────────────────────────────────────────────────────────────
  function buildLevels() {
    for (let l = 1; l <= 4; l++) {
      const b = document.createElement('button');
      b.className = 'lvl';
      b.innerHTML = '<span></span><small></small>';
      b.firstChild.textContent = lvName(l); b.lastChild.textContent = t('lvDesc')[l - 1];
      b.onclick = () => { settings().level = l; statLevel = l; renderLevels(); renderStats(); save(); };
      $('levels').appendChild(b);
      const tb = document.createElement('button');
      tb.textContent = lvName(l);
      tb.onclick = () => { statLevel = l; renderStats(); };
      $('statTabs').appendChild(tb);
    }
  }
  document.querySelectorAll('#colors button').forEach((b) => { b.onclick = () => { settings().color = b.dataset.v; renderLevels(); save(); }; });
  document.querySelectorAll('#clockSeg button').forEach((b) => { b.onclick = () => { settings().clock = +b.dataset.v; renderLevels(); save(); }; });
  $('newBtn').onclick = requestNew;
  document.querySelectorAll('.sec-h').forEach((h) => { h.onclick = () => h.parentElement.classList.toggle('closed'); });
  document.querySelectorAll('.sw').forEach((s) => { s.onclick = () => { const S = settings(); S[s.dataset.k] = !S[s.dataset.k]; renderSettings(); renderBoard(); save(); }; });
  document.querySelectorAll('#themeSeg button').forEach((b) => { b.onclick = () => { settings().theme = b.dataset.v; renderSettings(); applyTheme(); save(); }; });
  const closeDrawer = () => $('app').classList.remove('drawer');
  $('menuBtn').onclick = () => $('app').classList.add('drawer');
  $('drawerClose').onclick = closeDrawer;
  $('main').addEventListener('pointerdown', (e) => { if (!e.target.closest('#menuBtn')) closeDrawer(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('confirmDlg').classList.contains('show')) $('confirmNo').click();
      else if ($('endDlg').classList.contains('show')) $('endClose').click();
      else { sel = -1; closeDrawer(); renderBoard(); }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!$('undoBtn').disabled) $('undoBtn').click(); }
    else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) $('flipBtn').click();
  });

  // Clocks tick; they stop while the addon is hidden.
  setInterval(() => { if (G && G.clock && !G.result) renderClocks(); }, 200);
  document.addEventListener('visibilitychange', () => {
    if (!G || !G.clock || G.result) { if (document.visibilityState === 'hidden') save(true); return; }
    if (document.visibilityState === 'hidden') { spendClock(); save(true); }
    else turnStart = performance.now();
  });
  window.addEventListener('pagehide', () => { if (G && G.clock && !G.result) spendClock(); doSave(); });

  // ── Start ───────────────────────────────────────────────────────────────────────────────────────────
  async function init() {
    applyTexts();
    buildLevels();
    await Promise.all([loadUser(), loadDB()]);
    $('storeNote').hidden = storeMode !== 'local';
    applyTheme();
    renderUser();
    statLevel = settings().level;
    const saved = me().game;
    if (saved && Array.isArray(saved.moves) && !saved.result) {
      G = saved;
      rebuild();
      if (pos.status().over) { const st = pos.status(); finish(st.result, st.reason); }
      turnStart = performance.now();
      renderAll();
      if (!G.result && pos.side !== G.me) engineTurn();
    } else newGame();
  }
  init();
})();
