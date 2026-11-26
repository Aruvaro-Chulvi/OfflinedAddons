/* Minesweeper addon for Offlined — the panel. MIT licence. */
(function () {
  'use strict';

  const ID = 'minesweeper';
  const E = window.MinesEngine;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  // ── Language ────────────────────────────────────────────────────────────────────────────────────────
  const I18N = window.MINES_I18N;
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
    document.title = t('appName');
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-tt]').forEach((el) => { el.title = t(el.dataset.tt); el.setAttribute('aria-label', t(el.dataset.tt)); });
  }
  const fmtTime = (s) => {
    s = Math.max(0, s | 0);
    const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, x = s % 60;
    const mm = String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0');
    return h ? h + ':' + mm : mm;
  };

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

  // ── Storage ─────────────────────────────────────────────────────────────────────────────────────────
  const DEFAULTS = { noGuess: true, chord: true, colorNums: false, timer: true, sound: 'soft', theme: 'auto', level: 1 };
  // sounds and effects (engine/puzzle-fx.js)
  const SFX = window.PuzzleFX;
  const snd = (name, opts) => { try { SFX.play(name, opts); } catch (_) {} };
  async function loadDB() {
    try {
      const r = await fetch(`/api/addons/${ID}/storage`, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      DB = (await r.json()).data;
    } catch (_) {
      storeMode = 'local';
      try { DB = JSON.parse(localStorage.getItem('ofl_mines') || '{}'); } catch (__) { DB = {}; }
    }
    if (!DB || typeof DB !== 'object') DB = {};
    DB.v = 1;
    DB.users = DB.users && typeof DB.users === 'object' ? DB.users : {};
  }
  function save(now) { clearTimeout(saveTimer); saveTimer = setTimeout(doSave, now ? 0 : 700); }
  function doSave() {
    if (!DB) return;
    if (storeMode === 'local') { try { localStorage.setItem('ofl_mines', JSON.stringify(DB)); } catch (_) {} return; }
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
  const statsOf = (l) => { const s = me().stats; return s[l] || (s[l] = { played: 0, won: 0, best: 0, cleanWon: 0, cleanTotal: 0 }); };

  // ── Game state ──────────────────────────────────────────────────────────────────────────────────────
  // G: {level, R, C, total, mines:null|[...], open:[0/1], flags:[0/1], time, hints, helped, over:null|'win'|'lose', exploded}
  let G = null, mineSet = null, num = null, nb = null;
  let flagMode = false, paused = false, snapshot = null, hint = null, hl = { from: [], target: [], wrong: [] };
  let hintSeen = null;             // { key, step, data } of the last position whose hint was counted
  let uiLevel = 1, statLevel = 1;

  function newGame(level) {
    const cfg = E.LEVELS[level];
    G = { level, R: cfg.R, C: cfg.C, total: cfg.mines, mines: null, open: new Array(cfg.R * cfg.C).fill(0), flags: new Array(cfg.R * cfg.C).fill(0),
      time: 0, hints: 0, helped: false, over: null, exploded: -1 };
    derive();
    settings().level = level;
    me().game = G;
    uiLevel = statLevel = level;
    snapshot = null; hint = null; hintSeen = null; hl = { from: [], target: [], wrong: [] }; flagMode = false;
    setPause(false); hideToast();
    buildBoard();
    renderAll();
    save();
    closeDrawer();
  }
  function derive() {
    nb = E.neighbours(G.R, G.C);
    mineSet = null; num = null;
    if (G.mines) {
      mineSet = new Uint8Array(G.R * G.C); for (const m of G.mines) mineSet[m] = 1;
      num = E.counts(G.R, G.C, mineSet);
    }
  }
  const started = () => !!(G && G.mines);
  const live = () => G && !G.over && !paused;
  function requestNew(level) {
    if (started() && !G.over) $('confirmDlg').classList.add('show'), (pendingLevel = level);
    else newGame(level);
  }
  let pendingLevel = 1;
  $('confirmYes').onclick = () => { $('confirmDlg').classList.remove('show'); newGame(pendingLevel); };
  $('confirmNo').onclick = () => $('confirmDlg').classList.remove('show');

  // ── Board ───────────────────────────────────────────────────────────────────────────────────────────
  const board = $('board');
  let cellEls = [];
  function fitBoard() {
    if (!G) return;
    const main = $('main').getBoundingClientRect();
    // 1 px gaps between cells and a 1 px border on each side
    const availW = main.width - 44 - (G.C + 1), availH = main.height - 200 - (G.R + 1);
    let cs = Math.floor(Math.min(availW / G.C, availH / G.R, 44));
    // touch screens need bigger cells (the board scrolls); with a mouse, smaller cells fit the big levels
    cs = Math.max(cs, matchMedia('(pointer: coarse)').matches ? 26 : 16);
    board.style.setProperty('--cs', cs + 'px');
    board.style.setProperty('--cols', G.C);
    const bw = Math.min(cs * G.C + G.C + 1, main.width - 32);
    $('main').style.setProperty('--bw', Math.max(bw, 320) + 'px');
  }
  window.addEventListener('resize', fitBoard);
  function buildBoard() {
    board.innerHTML = '';
    cellEls = [];
    const n = G.R * G.C;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.className = 'mc'; d.dataset.i = i; frag.appendChild(d); cellEls.push(d); }
    board.appendChild(frag);
    fitBoard();
    // on small screens the big boards scroll: start in the middle, where the first click usually is
    const wrap = $('boardWrap');
    requestAnimationFrame(() => { wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2; wrap.scrollTop = (wrap.scrollHeight - wrap.clientHeight) / 2; });
  }
  const ICON_FLAG = '<svg viewBox="0 0 24 24"><use href="#i-flag" class="flag"/></svg>';
  const ICON_MINE = '<svg viewBox="0 0 24 24"><use href="#i-bomb"/></svg>';
  function renderBoard() {
    if (!G) return;
    board.classList.toggle('colornums', !!settings().colorNums);
    const over = G.over;
    for (let i = 0; i < cellEls.length; i++) {
      const el = cellEls[i];
      let cls = 'mc', html = '';
      if (G.open[i]) {
        const n = num ? num[i] : 0;
        cls += ' op n' + n;
        if (n > 0) html = String(n);
      } else if (over === 'lose' && mineSet && mineSet[i]) {
        cls += ' op'; html = G.flags[i] ? ICON_FLAG : ICON_MINE;
        if (i === G.exploded) cls += ' boom';
      } else if (G.flags[i]) {
        html = ICON_FLAG;
        if (over === 'lose' && mineSet && !mineSet[i]) cls += ' wrongflag';
      }
      if (hl.from.includes(i)) cls += ' hint';
      if (hl.target.includes(i)) cls += ' target';
      if (hl.wrong.includes(i)) cls += ' wrongflag';
      if (el.className !== cls) el.className = cls;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
    }
    renderInfo();
  }
  function renderInfo() {
    if (!G) return;
    let flags = 0, opened = 0;
    for (let i = 0; i < G.open.length; i++) { if (G.flags[i]) flags++; if (G.open[i]) opened++; }
    const safe = G.R * G.C - G.total;
    $('stLvl').textContent = lvName(G.level);
    $('minesLeft').textContent = G.total - flags;
    $('time').textContent = fmtTime(G.time);
    $('timerPill').style.visibility = settings().timer ? 'visible' : 'hidden';
    $('infoLvl').textContent = lvName(G.level);
    $('infoSize').textContent = G.C + '×' + G.R;
    $('infoMines').textContent = G.total;
    $('infoFlags').textContent = flags;
    $('infoHints').textContent = G.hints;
    const pct = Math.round((opened / safe) * 100);
    $('infoPct').textContent = pct + ' %';
    $('pctBar').style.width = pct + '%';
  }
  function renderTools() {
    const off = !G || !!G.over;
    $('flagBtn').classList.toggle('on', flagMode);
    $('flagBtn').disabled = off; $('hintBtn').disabled = off;
    $('pauseBtn').disabled = off || !started();
    $('pauseBtn').innerHTML = `<svg class="i"><use href="#i-${paused ? 'play' : 'pause'}"/></svg>`;
  }
  function renderLevels() { document.querySelectorAll('#levels .lvl').forEach((b, k) => b.classList.toggle('on', k + 1 === uiLevel)); }
  function renderStats() {
    document.querySelectorAll('#statTabs button').forEach((b, k) => b.classList.toggle('on', k + 1 === statLevel));
    const s = statsOf(statLevel);
    $('stPlayed').textContent = s.played; $('stWon').textContent = s.won;
    $('stRate').textContent = s.played ? Math.round((s.won / s.played) * 100) + ' %' : t('empty');
    $('stBest').textContent = s.best ? fmtTime(s.best) : t('empty');
    $('stAvg').textContent = s.cleanWon ? fmtTime(s.cleanTotal / s.cleanWon) : t('empty');
    let wins = 0; for (const l in me().stats) wins += me().stats[l].won || 0;
    $('userSub').textContent = t('streakLine', { n: me().streak, w: wins });
  }
  function renderSettings() {
    const S = settings();
    document.querySelectorAll('.sw').forEach((s) => s.classList.toggle('on', !!S[s.dataset.k]));
    document.querySelectorAll('#themeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.theme));
    document.querySelectorAll('#soundSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.sound));
  }
  function renderUser() {
    const name = USER.name || t('appName');
    $('userName').textContent = name;
    const av = $('avatar');
    av.style.background = USER.color || '';
    if (USER.photo && USER.id) av.innerHTML = `<img alt="" src="/api/users/${encodeURIComponent(USER.id)}/avatar">`;
    else av.textContent = (name.trim()[0] || '?').toUpperCase();
  }
  function renderAll() { renderBoard(); renderTools(); renderLevels(); renderStats(); renderSettings(); }

  // ── Playing ─────────────────────────────────────────────────────────────────────────────────────────
  function takeSnapshot() { snapshot = { open: G.open.slice(), flags: G.flags.slice() }; }
  function firstClick(i) {
    const r = E.generate(G.level, i, { noGuess: !!settings().noGuess, timeMs: 2500 });
    G.mines = r.mines;
    derive();
    statsOf(G.level).played++;
    renderStats();
    if (settings().noGuess && !r.noGuess) showToast(t('notNoGuess'));
  }
  function reveal(i) {
    if (!live()) return;
    clearHint();
    if (!started()) firstClick(i);
    if (G.flags[i]) return;
    takeSnapshot();
    const before = snapshot.open;
    if (G.open[i]) {
      // chord: a number with all its flags opens the rest around it
      if (!settings().chord || num[i] <= 0) return;
      let f = 0; for (const j of nb[i]) if (G.flags[j]) f++;
      if (f !== num[i]) { snd('chordFail'); SFX.shake(cellEls[i]); return; }
      for (const j of nb[i]) if (!G.open[j] && !G.flags[j]) { if (open1(j)) return; }
    } else if (open1(i)) return;
    if (!afterMove()) openedFx(before, i);
  }
  /** Sound and ripple for the cells a move just opened (after renderBoard): they appear ring by ring from the click. */
  function openedFx(before, from) {
    const fresh = [];
    for (let j = 0; j < G.open.length; j++) if (G.open[j] && !before[j]) fresh.push(j);
    if (!fresh.length) return;
    if (fresh.length === 1) { snd('open'); return; }
    snd('cascade', { n: Math.ceil(fresh.length / 6) });
    if (SFX.reduced()) return;
    const r0 = (from / G.C) | 0, c0 = from % G.C;
    const ring = (j) => Math.max(Math.abs(((j / G.C) | 0) - r0), Math.abs((j % G.C) - c0));
    let far = 1; for (const j of fresh) far = Math.max(far, ring(j));
    const dur = 170, step = Math.min(12, (450 - dur) / far);
    for (const j of fresh) {
      cellEls[j].animate([{ opacity: 0.25, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: dur, delay: ring(j) * step, easing: 'ease-out', fill: 'backwards' });
    }
  }
  // Opens one cell; returns true if it was a mine (game lost).
  function open1(i) {
    if (mineSet[i]) { lose(i); return true; }
    const op = Uint8Array.from(G.open);
    for (const j of E.flood(G.R, G.C, num, op, i)) { G.open[j] = 1; G.flags[j] = 0; }
    return false;
  }
  function toggleFlag(i) {
    if (!live() || G.open[i]) return;
    clearHint();
    G.flags[i] = G.flags[i] ? 0 : 1;
    renderBoard(); save();
    snd(G.flags[i] ? 'flag' : 'unflag'); SFX.pop(cellEls[i]);
  }
  // Renders after a move; returns true if it won the game.
  function afterMove() {
    renderBoard(); renderTools(); save();
    let opened = 0; for (const v of G.open) if (v) opened++;
    if (opened === G.R * G.C - G.total) { win(); return true; }
    return false;
  }
  function lose(i) {
    G.over = 'lose'; G.exploded = i;
    me().streak = 0;
    renderAll(); save(true);
    // the mine you hit flashes, then the others show up from it outwards; the dialog waits for them
    snd('lose');
    let total = 0;
    if (!SFX.reduced()) {
      cellEls[i].animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0.35, transform: 'scale(1.25)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 240, iterations: 3, easing: 'ease-in-out' });
      const r0 = (i / G.C) | 0, c0 = i % G.C, others = [];
      for (const m of G.mines) if (m !== i && !G.flags[m]) others.push([m, Math.hypot(((m / G.C) | 0) - r0, (m % G.C) - c0)]);
      const dur = 220, far = others.reduce((a, o) => Math.max(a, o[1]), 1), k = (900 - dur - 250) / far;
      for (const [m, d] of others) {
        const delay = 250 + d * k;
        cellEls[m].animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.15)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }],
          { duration: dur, delay, easing: 'ease-out', fill: 'backwards' });
        total = Math.max(total, delay + dur);
      }
      total = Math.max(total, 720);
    }
    const lost = G;
    setTimeout(() => {
      if (G !== lost || G.over !== 'lose') return; // undone or a new game meanwhile
      $('loseUndo').hidden = !snapshot; $('loseDlg').classList.add('show');
    }, Math.max(600, total + 100));
  }
  $('loseAgain').onclick = () => { $('loseDlg').classList.remove('show'); finishLost(); newGame(G.level); };
  $('loseClose').onclick = () => { $('loseDlg').classList.remove('show'); finishLost(); };
  $('loseUndo').onclick = () => {
    $('loseDlg').classList.remove('show');
    if (!snapshot) return;
    G.open = snapshot.open; G.flags = snapshot.flags; snapshot = null;
    G.over = null; G.exploded = -1;
    const first = !G.helped; G.helped = true;
    renderAll(); save();
    if (first) showToast(t('helpNote'));
  };
  function finishLost() { if (G && G.over === 'lose') { me().game = null; save(); } }

  function win() {
    G.over = 'win';
    for (const m of G.mines) G.flags[m] = 1;
    const s = statsOf(G.level), u = me();
    s.won++;
    let record = false;
    if (!G.helped) {
      s.cleanWon++; s.cleanTotal += G.time;
      record = !s.best || G.time < s.best;
      if (record) s.best = G.time;
      u.streak++;
    } else u.streak = 0;
    u.game = null;
    hideToast(); clearHint();
    renderAll(); save(true);
    $('winLvl').textContent = lvName(G.level) + ' · ' + G.C + '×' + G.R + (G.helped ? ' · ' + t('withHelp') : '');
    $('winRec').hidden = !(record && s.cleanWon > 1);
    $('winTime').textContent = fmtTime(G.time);
    $('winHints').textContent = G.hints;
    $('winRate').textContent = Math.round((s.won / s.played) * 100) + ' %';
    $('winStreak').textContent = u.streak;
    // a diagonal wave across the board with the fanfare, then the result
    const step = Math.min(40, 700 / (G.R + G.C));
    const wave = SFX.sweep(cellEls.map((el, k) => [el, (((k / G.C) | 0) + (k % G.C)) * step]), { scale: 1.08 });
    snd('win');
    const won = G;
    setTimeout(() => { if (G === won) $('winDlg').classList.add('show'); }, Math.max(500, wave - 150));
  }
  $('winAgain').onclick = () => { $('winDlg').classList.remove('show'); newGame(G.level); };
  $('winLevel').onclick = () => { $('winDlg').classList.remove('show'); openDrawer(); };
  $('winClose').onclick = () => $('winDlg').classList.remove('show');

  // Pointer: click opens, right click / long press / flag mode puts a flag.
  let press = null;
  board.addEventListener('contextmenu', (e) => e.preventDefault());
  board.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.mc'); if (!el || !G) return;
    const i = +el.dataset.i;
    if (e.button === 2) { toggleFlag(i); return; }
    if (e.button === 1) { e.preventDefault(); if (G.open[i]) reveal(i); return; }
    if (e.button !== 0) return;
    press = { i, done: false, timer: setTimeout(() => { if (press && press.i === i) { press.done = true; if (G.open[i]) reveal(i); else toggleFlag(i); if (navigator.vibrate) try { navigator.vibrate(20); } catch (_) {} } }, 420) };
  });
  function endPress(e, cancel) {
    if (!press) return;
    clearTimeout(press.timer);
    const p = press; press = null;
    if (p.done || cancel) return;
    const el = e.target.closest && e.target.closest('.mc');
    if (!el || +el.dataset.i !== p.i) return;
    if (flagMode && !G.open[p.i]) toggleFlag(p.i); else reveal(p.i);
  }
  board.addEventListener('pointerup', (e) => endPress(e, false));
  board.addEventListener('pointercancel', (e) => endPress(e, true));
  board.addEventListener('pointerleave', (e) => endPress(e, true));

  // ── Hints ───────────────────────────────────────────────────────────────────────────────────────────
  function clearHint() {
    if (!hint && !hl.from.length && !hl.target.length && !hl.wrong.length) return;
    hint = null; hl = { from: [], target: [], wrong: [] };
    if (toastKind === 'hint') hideToast();
    renderBoard();
  }
  function hintPress() {
    if (!live()) return;
    if (!started()) { showToast(t('firstClick'), null, null, 'hint'); return; }
    const key = G.open.join('') + G.flags.join('');
    if (!hint || hint.key !== key) {
      const seen = hintSeen && hintSeen.key === key ? hintSeen : null; // same position: same hint, same step
      hint = { key, step: seen ? seen.step : 0, data: seen ? seen.data : E.hint(G.level, G.mines, G.open, G.flags) };
    }
    showHintStep();
  }
  function nextHint() { if (hint) { hint.step++; showHintStep(); } }
  function markHelp() { G.hints++; if (!G.helped) { G.helped = true; } }
  // One hint = one board position: asking again on the same position shows the same step and is not
  // counted again; the steps of a hint («Más ayuda») are part of that same hint.
  function showHintStep() {
    const d = hint.data;
    hl = { from: [], target: [], wrong: [] };
    if (!d) { hint = null; showToast(t('hintNone'), null, null, 'hint'); renderBoard(); return; }
    if (!hintSeen || hintSeen.key !== hint.key) markHelp();
    hintSeen = { key: hint.key, step: hint.step, data: d };
    snd('hint');
    if (d.wrong) {
      hl.wrong = d.wrong.slice();
      showToast(t('hintWrong', { n: d.wrong.length }), t('removeThem'), () => {
        for (const i of d.wrong) G.flags[i] = 0;
        hint = null; hl = { from: [], target: [], wrong: [] }; hideToast(); renderBoard(); save();
      }, 'hint');
    } else if (d.tech === 'guess') {
      hl.target = d.safe.slice();
      hint = null;
      showToast(t('hintGuess'), null, null, 'hint');
      const i = d.safe[0];
      takeSnapshot();
      const before = snapshot.open;
      open1(i); if (!afterMove()) openedFx(before, i);
      return;
    } else if (hint.step === 0) {
      hl.from = d.from.length ? d.from.slice() : d.safe.concat(d.mines);
      showToast(t('hintRegion'), t('moreHelp'), nextHint, 'hint');
    } else if (hint.step === 1) {
      hl.from = d.from.slice(); hl.target = d.safe.concat(d.mines);
      showToast(t('hintTech', { t: t('t_' + d.tech) }), t('moreHelp'), nextHint, 'hint');
    } else {
      hint = null;
      for (const m of d.mines) G.flags[m] = 1;
      showToast(d.safe.length ? t('hintSafe') : t('hintMine'), null, null, 'hint');
      takeSnapshot();
      const before = snapshot.open;
      for (const s of d.safe) if (!G.open[s]) open1(s);
      if (!afterMove()) { if (d.safe.length) openedFx(before, d.safe[0]); else snd('flag'); }
      return;
    }
    renderBoard(); save();
  }

  // ── Toast ───────────────────────────────────────────────────────────────────────────────────────────
  let toastTimer = null, toastKind = '';
  function showToast(text, btnText, onBtn, kind) {
    toastKind = kind || '';
    $('toastTxt').textContent = text;
    const b = $('toastBtn');
    b.hidden = !btnText; b.textContent = btnText || ''; b.onclick = onBtn || null;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    if (!btnText) toastTimer = setTimeout(hideToast, 4000);
  }
  function hideToast() { $('toast').classList.remove('show'); toastKind = ''; }

  // ── Pause and timer ─────────────────────────────────────────────────────────────────────────────────
  function setPause(p) {
    paused = !!p && !!G && !G.over && started();
    $('pauseCover').hidden = !paused;
    renderTools();
    if (paused) save(true);
  }
  setInterval(() => {
    if (!G || G.over || paused || !started() || document.visibilityState !== 'visible') return;
    G.time++;
    $('time').textContent = fmtTime(G.time);
    if (G.time % 15 === 0) save();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (G && !G.over && started()) setPause(true); save(true); }
  });
  window.addEventListener('pagehide', () => doSave());

  // ── Side panel ──────────────────────────────────────────────────────────────────────────────────────
  function buildLevels() {
    for (let l = 1; l <= 4; l++) {
      const cfg = E.LEVELS[l];
      const b = document.createElement('button');
      b.className = 'lvl';
      b.innerHTML = '<span class="n"></span><small></small>';
      b.querySelector('.n').textContent = lvName(l);
      b.querySelector('small').textContent = cfg.C + '×' + cfg.R + ' · ' + cfg.mines;
      b.title = lvName(l) + ' · ' + cfg.C + '×' + cfg.R + ' · ' + t('minesN', { n: cfg.mines });
      b.onclick = () => { uiLevel = statLevel = l; settings().level = l; renderLevels(); renderStats(); save(); };
      $('levels').appendChild(b);
      const tb = document.createElement('button');
      tb.textContent = lvName(l);
      tb.onclick = () => { statLevel = l; renderStats(); };
      $('statTabs').appendChild(tb);
    }
  }
  $('genBtn').onclick = () => requestNew(uiLevel);
  $('restartBtn').onclick = () => requestNew(G ? G.level : uiLevel);
  document.querySelectorAll('.sec-h').forEach((h) => { h.onclick = () => h.parentElement.classList.toggle('closed'); });
  document.querySelectorAll('.sw').forEach((s) => { s.onclick = () => { const S = settings(); S[s.dataset.k] = !S[s.dataset.k]; renderSettings(); renderBoard(); save(); }; });
  document.querySelectorAll('#themeSeg button').forEach((b) => { b.onclick = () => { settings().theme = b.dataset.v; renderSettings(); applyTheme(); save(); }; });
  document.querySelectorAll('#soundSeg button').forEach((b) => { b.onclick = () => { settings().sound = b.dataset.v; SFX.setLevel(b.dataset.v); renderSettings(); save(); snd('tap'); }; });
  const openDrawer = () => $('app').classList.add('drawer');
  const closeDrawer = () => $('app').classList.remove('drawer');
  $('menuBtn').onclick = openDrawer;
  $('drawerClose').onclick = closeDrawer;
  $('main').addEventListener('pointerdown', (e) => { if (!e.target.closest('#menuBtn')) closeDrawer(); });
  $('flagBtn').onclick = () => { flagMode = !flagMode; renderTools(); };
  $('hintBtn').onclick = hintPress;
  $('pauseBtn').onclick = () => setPause(!paused);
  $('resumeBtn').onclick = () => setPause(false);
  document.addEventListener('pointerdown', (e) => {
    if (toastKind === 'hint' && !e.target.closest('#toast, #hintBtn')) clearHint();
  }, true);
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      for (const id of ['confirmDlg', 'winDlg', 'loseDlg']) if ($(id).classList.contains('show')) { $(id).classList.remove('show'); if (id === 'loseDlg') finishLost(); return; }
      hideToast(); clearHint(); closeDrawer(); return;
    }
    if (document.querySelector('.overlay.show') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'f') { flagMode = !flagMode; renderTools(); }
    else if (k === 'h') hintPress();
    else if (k === 'n') requestNew(G ? G.level : uiLevel);
    else if (k === 'p' || k === ' ') { e.preventDefault(); if (G && !G.over) setPause(!paused); }
  });

  // ── Start ───────────────────────────────────────────────────────────────────────────────────────────
  async function init() {
    applyTexts();
    buildLevels();
    await Promise.all([loadUser(), loadDB()]);
    $('storeNote').hidden = storeMode !== 'local';
    SFX.init({ level: settings().sound });
    applyTheme();
    renderUser();
    uiLevel = statLevel = settings().level;
    const saved = me().game;
    if (saved && !saved.over && Array.isArray(saved.open) && E.LEVELS[saved.level]) {
      G = saved; derive();
      uiLevel = statLevel = G.level;
      buildBoard(); renderAll();
    } else newGame(uiLevel);
  }
  init();
})();
