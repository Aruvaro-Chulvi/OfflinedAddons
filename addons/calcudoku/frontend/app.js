/* Calcudoku addon for Offlined — the panel. MIT licence. */
(function () {
  'use strict';

  const ID = 'calcudoku';
  const E = window.CalcEngine;
  const POOL_TARGET = 2;           // ready-made sudokus kept per level
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  // ── Language ────────────────────────────────────────────────────────────────────────────────────────
  const I18N = window.CALC_I18N, TECH = window.CALC_TECH;
  let lang = (params.get('lang') || navigator.language || 'en').slice(0, 2).toLowerCase();
  if (!I18N[lang]) lang = 'en';
  const t = (k, vars) => {
    let s = (I18N[lang] && I18N[lang][k] !== undefined) ? I18N[lang][k] : I18N.en[k];
    if (vars && typeof s === 'string') for (const v in vars) s = s.split('{' + v + '}').join(vars[v]);
    return s;
  };
  const lvName = (l) => t('lv')[l - 1] || String(l);
  const techName = (id) => (TECH[lang] && TECH[lang][id]) || TECH.en[id] || id || '—';
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
  const daysText = (n) => (n === 1 ? t('day1') : t('days', { n }));

  // ── Theme: Offlined's, unless the user picked one here ──────────────────────────────────────────────
  let DB = null, storeMode = 'offlined', saveTimer = null;
  let offlinedTheme = params.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function applyTheme() {
    const pref = (DB && settings().theme) || 'auto';
    document.documentElement.dataset.theme = pref === 'auto' ? offlinedTheme : pref;
  }
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'theme' && (e.data.value === 'light' || e.data.value === 'dark')) { offlinedTheme = e.data.value; applyTheme(); }
  });
  applyTheme();

  // ── Storage: one JSON object for the addon, a section per Offlined user ─────────────────────────────
  const DEFAULTS = { errMode: 'free', peers: true, same: true, autoclean: true, timer: true, theme: 'auto', level: 2 };
  function normalize(d) {
    d = d && typeof d === 'object' ? d : {};
    d.v = 1;
    d.pool = d.pool && typeof d.pool === 'object' ? d.pool : {};
    for (let l = 1; l <= 6; l++) d.pool[l] = (d.pool[l] || []).filter((p) => p && p.engine === E.ENGINE_VERSION && p.cages && p.solution);
    d.users = d.users && typeof d.users === 'object' ? d.users : {};
    return d;
  }
  async function loadDB() {
    try {
      const r = await fetch(`/api/addons/${ID}/storage`, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      DB = normalize((await r.json()).data);
    } catch (_) {
      storeMode = 'local';
      try { DB = normalize(JSON.parse(localStorage.getItem('ofl_calcudoku') || '{}')); } catch (__) { DB = normalize({}); }
    }
  }
  function save(now) { clearTimeout(saveTimer); saveTimer = setTimeout(doSave, now ? 0 : 700); }
  function doSave() {
    if (!DB) return;
    if (storeMode === 'local') { try { localStorage.setItem('ofl_calcudoku', JSON.stringify(DB)); } catch (_) {} return; }
    const body = JSON.stringify({ data: DB });
    fetch(`/api/addons/${ID}/storage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: body.length < 60000 }).catch(() => {});
  }

  // ── Who is playing ──────────────────────────────────────────────────────────────────────────────────
  let UID = 'default', USER = { name: '', color: '', photo: false, id: null };
  async function loadUser() {
    try {
      const s = await (await fetch('/api/users/session', { cache: 'no-store' })).json();
      const id = s.active || s.last_user;
      if (id) UID = String(id);
      const u = (s.users || []).find((x) => x.id === id);
      if (u) USER = { name: u.name || '', color: u.color || '', photo: !!u.has_photo, id: u.id };
    } catch (_) { /* outside Offlined: one anonymous player */ }
  }
  function me() {
    const u = DB.users[UID] || (DB.users[UID] = {});
    u.settings = Object.assign({}, DEFAULTS, u.settings || {});
    u.stats = u.stats || {};
    u.streak = u.streak || { last: '', days: 0 };
    return u;
  }
  const settings = () => (DB ? me().settings : DEFAULTS);
  const statsOf = (l) => { const s = me().stats; return s[l] || (s[l] = { played: 0, won: 0, best: 0, total: 0 }); };

  // ── Game state ──────────────────────────────────────────────────────────────────────────────────────
  let G = null;                    // the game (saved)
  let given = [], sol = [], N = 4, cageOf = [], labelCell = [];
  let sel = 0, notesMode = false, paused = false, showErrors = false, busy = false;
  let undoStack = [], redoStack = [], hint = null, hl = { region: [], cells: [], target: -1, wrong: [] };
  let uiLevel = 3, statLevel = 3, popCell = -1;
  const bit = (d) => 1 << (d - 1);

  function derive() {
    N = G.N;
    given = new Array(N * N).fill(false);
    sol = [...G.solution].map(Number);
    cageOf = new Array(N * N).fill(0);
    labelCell = [];
    G.cages.forEach((cg, k) => { for (const i of cg.cells) cageOf[i] = k; labelCell.push(Math.min(...cg.cells)); });
  }
  const OPS = { '+': '+', '-': '−', '*': '×', '/': '÷', '=': '' };
  const peersOf = (i) => { const r = (i / N) | 0, c = i % N, o = []; for (let x = 0; x < N; x++) { if (x !== c) o.push(r * N + x); if (x !== r) o.push(x * N + c); } return o; };
  function startGame(p) {
    G = { code: p.code, level: p.level, N: p.N, cages: p.cages, solution: p.solution, tech: p.hardest,
      values: new Array(p.N * p.N).fill(0), notes: new Array(p.N * p.N).fill(0), time: 0, errors: 0, hints: 0, done: false };
    derive();
    buildBoard();
    statsOf(p.level).played++;
    settings().level = p.level;
    me().game = G;
    uiLevel = statLevel = p.level;
    undoStack = []; redoStack = []; hint = null; hl = { region: [], cells: [], target: -1, wrong: [] };
    showErrors = false; notesMode = false; setPause(false);
    sel = 0;
    hideToast();
    renderAll();
    save();
  }
  const hasProgress = () => G && !G.done && (G.time > 20 || G.values.some((v, i) => v && !given[i]));

  // ── Generators (Web Workers, with an in-page fallback) ──────────────────────────────────────────────
  function inlineWorker() {
    const w = { onmessage: null, job: null };
    w.postMessage = (m) => {
      if (m.type === 'cancel') { w.job = null; return; }
      const job = { id: m.id, it: E.generate(m.level, m.seed >>> 0), slice: Math.min(m.slice || 30, 30), rest: Math.max(m.rest || 0, 15) };
      w.job = job;
      const run = () => {
        if (w.job !== job) return;
        const t0 = Date.now(); let r = null;
        while (Date.now() - t0 < job.slice) {
          r = job.it.next();
          if (r.done) { w.job = null; w.onmessage && w.onmessage({ data: { type: 'done', id: job.id, result: r.value } }); return; }
        }
        w.onmessage && w.onmessage({ data: { type: 'progress', id: job.id, info: r && r.value } });
        setTimeout(run, job.rest);
      };
      setTimeout(run, 0);
    };
    return w;
  }
  function makeWorker() { try { return new Worker('worker.js'); } catch (_) { return inlineWorker(); } }
  const fg = makeWorker(), bg = makeWorker();
  let fgJob = 0, bgJob = 0, bgLevel = 0;
  const randomSeed = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (_) { return (Math.random() * 4294967296) >>> 0; } };

  fg.onmessage = (e) => {
    const m = e.data;
    if (m.id !== fgJob) return;
    if (m.type === 'progress') { $('genSub').textContent = t('attempt', { n: ((m.info && m.info.attempt) || 0) + 1 }); return; }
    fgJob = 0; showGen(false);
    if (m.type === 'done') startGame(m.result);
    else showToast(String(m.message || 'error'));
  };
  bg.onmessage = (e) => {
    const m = e.data;
    if (m.id !== bgJob || m.type === 'progress') return;
    bgJob = 0;
    if (m.type === 'done' && DB) { DB.pool[bgLevel] = (DB.pool[bgLevel] || []).concat([m.result]).slice(-POOL_TARGET); save(); }
    setTimeout(refill, 800);
  };
  function refill() {
    if (!DB || bgJob || document.visibilityState === 'hidden') return;
    const order = [uiLevel, 1, 2, 3, 4, 5, 6];
    const l = order.find((x) => (DB.pool[x] || []).length < POOL_TARGET);
    if (!l) return;
    bgLevel = l; bgJob = Date.now() + Math.random();
    bg.postMessage({ type: 'generate', id: bgJob, level: l, seed: randomSeed(), slice: 40, rest: 60 });
  }
  function showGen(on, level) {
    busy = on;
    $('genCover').hidden = !on;
    if (on) { $('genTitle').textContent = t('searching', { lv: lvName(level) }); $('genSub').textContent = ''; }
    renderTools();
  }
  function go(level, seed) {
    closeDrawer();
    if (seed === undefined && DB.pool[level] && DB.pool[level].length) {
      const p = DB.pool[level].shift();
      save();
      startGame(p);
      refill();
      return;
    }
    fgJob = Date.now() + Math.random();
    showGen(true, level);
    fg.postMessage({ type: 'generate', id: fgJob, level, seed: seed === undefined ? randomSeed() : seed, slice: 60, rest: 0 });
  }
  let pendingNew = null;
  function requestNew(level, seed) {
    if (hasProgress()) { pendingNew = [level, seed]; $('confirmDlg').classList.add('show'); return; }
    go(level, seed);
  }
  $('confirmYes').onclick = () => { $('confirmDlg').classList.remove('show'); if (pendingNew) go(pendingNew[0], pendingNew[1]); pendingNew = null; };
  $('confirmNo').onclick = () => { $('confirmDlg').classList.remove('show'); pendingNew = null; };
  $('genCancel').onclick = () => { fg.postMessage({ type: 'cancel' }); fgJob = 0; showGen(false); };

  // ── Board ───────────────────────────────────────────────────────────────────────────────────────────
  const board = $('board'), pad = $('pad');
  let cells = [], padBtns = [];
  function buildBoard() {
    board.innerHTML = ''; pad.innerHTML = '';
    cells = []; padBtns = [];
    board.style.setProperty('--n', N);
    pad.style.setProperty('--n', N);
    for (let i = 0; i < N * N; i++) {
      const d = document.createElement('div');
      d.addEventListener('pointerdown', () => { sel = i; renderBoard(); });
      board.appendChild(d); cells.push(d);
    }
    for (let n = 1; n <= N; n++) {
      const b = document.createElement('button');
      b.className = 'num'; b.innerHTML = `<b>${n}</b><small></small>`;
      b.onclick = () => input(n, false);
      pad.appendChild(b); padBtns.push(b);
    }
  }
  function cageEdges(i) { // thick borders where the neighbour belongs to another cage
    const r = (i / N) | 0, c = i % N, k = cageOf[i];
    let e = r === 0 ? ' r0' : cageOf[i - N] !== k ? ' bt' : '';
    e += c === 0 ? ' c0' : cageOf[i - 1] !== k ? ' bl' : '';
    return e;
  }

  function isBad(i) {
    if (!G || given[i] || !G.values[i]) return false;
    if (hl.wrong.includes(i)) return true;
    if (settings().errMode === 'strict' || showErrors) return G.values[i] !== sol[i];
    return false;
  }
  function renderBoard() {
    const S = settings();
    if (!G) return;
    const v = G.values;
    const selV = v[sel] || 0;
    for (let i = 0; i < N * N; i++) {
      const r = (i / N) | 0, c = i % N;
      let cls = 'cell' + cageEdges(i);
      {
        if (given[i]) cls += ' given'; else if (v[i]) cls += ' user';
        if (S.peers && i !== sel && (((sel / N) | 0) === r || sel % N === c)) cls += ' peer';
        if (S.same && selV && v[i] === selV && i !== sel) cls += ' same';
        if (hl.region.includes(i) || hl.cells.includes(i)) cls += ' hint';
        if (hl.target === i) cls += ' hint-cell';
        if (i === sel && !G.done) cls += ' sel';
        if (isBad(i)) cls += ' bad';
        if (i === popCell) cls += ' pop';
      }
      const el = cells[i];
      if (el.className !== cls) el.className = cls;
      let html = '';
      const k = cageOf[i];
      if (labelCell[k] === i) { const cg = G.cages[k]; html += `<span class="cage-l">${cg.target}${OPS[cg.op]}</span>`; }
      if (v[i]) html += `<span class="val">${v[i]}</span>`;
      else if (G.notes[i]) {
        html += `<div class="notes${N <= 4 ? ' n4' : ''}">`;
        for (let n = 1; n <= N; n++) html += `<span${S.same && n === selV ? ' class="hl"' : ''}>${G.notes[i] & bit(n) ? n : ''}</span>`;
        html += '</div>';
      }
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
    }
    popCell = -1;
    // number pad
    const cnt = new Array(N + 1).fill(0);
    for (let i = 0; i < N * N; i++) if (v[i]) cnt[v[i]]++;
    padBtns.forEach((b, k) => {
      const n = k + 1, left = N - cnt[n];
      b.querySelector('small').textContent = left > 0 ? left : '✓';
      b.classList.toggle('done', left <= 0);
      b.classList.toggle('on', !!G && n === selV);
    });
    pad.classList.toggle('notes-mode', notesMode);
    renderInfo();
  }
  function renderInfo() {
    const strict = settings().errMode === 'strict';
    $('errPill').hidden = !strict;
    $('infoErrRow').hidden = !strict;
    $('timerPill').style.visibility = settings().timer ? 'visible' : 'hidden';
    if (!G) return;
    $('stLvl').textContent = lvName(G.level);
    $('time').textContent = fmtTime(G.time);
    $('errs').textContent = G.errors;
    $('infoLvl').textContent = lvName(G.level);
    $('infoGiven').textContent = N + '×' + N;
    $('infoTech').textContent = techName(G.tech);
    $('infoErr').textContent = G.errors;
    $('infoHints').textContent = G.hints;
    $('code').textContent = G.code;
    let ok = 0, empty = 0;
    for (let i = 0; i < N * N; i++) if (!given[i]) { empty++; if (G.values[i] === sol[i]) ok++; }
    const pct = empty ? Math.round((ok / empty) * 100) : 0;
    $('infoPct').textContent = pct + ' %';
    $('pctBar').style.width = pct + '%';
  }
  function renderTools() {
    const off = !G || G.done || busy;
    $('notesBtn').classList.toggle('on', notesMode);
    $('undoBtn').disabled = off || !undoStack.length;
    $('redoBtn').disabled = off || !redoStack.length;
    ['notesBtn', 'autoBtn', 'eraseBtn', 'hintBtn'].forEach((id) => { $(id).disabled = off; });
    $('pauseBtn').disabled = off;
    $('pauseBtn').innerHTML = `<svg class="i"><use href="#i-${paused ? 'play' : 'pause'}"/></svg>`;
  }
  function renderLevels() {
    document.querySelectorAll('#levels .lvl').forEach((b, k) => b.classList.toggle('on', k + 1 === uiLevel));
  }
  function renderStats() {
    document.querySelectorAll('#statTabs button').forEach((b, k) => b.classList.toggle('on', k + 1 === statLevel));
    const s = statsOf(statLevel);
    $('stPlayed').textContent = s.played;
    $('stWon').textContent = s.won;
    $('stBest').textContent = s.best ? fmtTime(s.best) : t('empty');
    $('stAvg').textContent = s.won ? fmtTime(s.total / s.won) : t('empty');
    const u = me();
    let wins = 0; for (const l in u.stats) wins += u.stats[l].won || 0;
    const days = streakDays();
    $('userSub').textContent = t('streakLine', { d: daysText(days), w: wins });
  }
  function renderSettings() {
    const S = settings();
    document.querySelectorAll('.sw').forEach((s) => s.classList.toggle('on', !!S[s.dataset.k]));
    document.querySelectorAll('#errMode button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.errMode));
    document.querySelectorAll('#themeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.theme));
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

  // ── Editing ─────────────────────────────────────────────────────────────────────────────────────────
  function change(patch, i, v, n) {
    if (G.values[i] === v && G.notes[i] === n) return;
    patch.push([i, G.values[i], G.notes[i], v, n]);
    G.values[i] = v; G.notes[i] = n;
  }
  function commit(patch) {
    if (!patch.length) return false;
    undoStack.push(patch); if (undoStack.length > 500) undoStack.shift();
    redoStack = [];
    showErrors = false; hl.wrong = [];
    renderBoard(); renderTools(); save();
    return true;
  }
  function canEdit() { return G && !G.done && !paused && !busy; }
  function placeDigit(patch, i, n) {
    change(patch, i, n, 0);
    if (n && settings().autoclean) for (const p of peersOf(i)) if (G.notes[p] & bit(n)) change(patch, p, G.values[p], G.notes[p] & ~bit(n));
  }
  function input(n, forceNote) {
    if (!canEdit() || given[sel] || n > N) return;
    clearHint();
    const patch = [];
    if (forceNote || notesMode) {
      if (G.values[sel]) return;
      change(patch, sel, 0, G.notes[sel] ^ bit(n));
      commit(patch);
      return;
    }
    const nv = G.values[sel] === n ? 0 : n;
    placeDigit(patch, sel, nv);
    if (nv && settings().errMode === 'strict' && nv !== sol[sel]) G.errors++;
    if (nv) popCell = sel;
    if (commit(patch)) checkComplete();
  }
  function erase() {
    if (!canEdit() || given[sel]) return;
    clearHint();
    const patch = []; change(patch, sel, 0, 0); commit(patch);
  }
  function autoNotes() {
    if (!canEdit()) return;
    clearHint();
    const patch = [];
    for (let i = 0; i < N * N; i++) {
      if (G.values[i]) continue;
      let m = (1 << N) - 1;
      for (const p of peersOf(i)) if (G.values[p]) m &= ~bit(G.values[p]);
      change(patch, i, 0, m);
    }
    commit(patch);
  }
  function undo() {
    if (!canEdit() || !undoStack.length) return;
    clearHint();
    const p = undoStack.pop();
    for (let k = p.length - 1; k >= 0; k--) { const [i, ov, on] = p[k]; G.values[i] = ov; G.notes[i] = on; }
    redoStack.push(p); sel = p[0][0];
    renderBoard(); renderTools(); save();
  }
  function redo() {
    if (!canEdit() || !redoStack.length) return;
    clearHint();
    const p = redoStack.pop();
    for (const [i, , , nv, nn] of p) { G.values[i] = nv; G.notes[i] = nn; }
    undoStack.push(p); sel = p[0][0];
    renderBoard(); renderTools(); save();
  }
  function checkComplete() {
    if (G.values.some((v) => !v)) return;
    if (G.values.every((v, i) => v === sol[i])) { win(); return; }
    if (settings().errMode !== 'strict') showToast(t('fullWrong'), t('showErrors'), () => { showErrors = true; renderBoard(); hideToast(); }, 'alert');
  }

  // ── Hints: zone → technique → digit ─────────────────────────────────────────────────────────────────
  function clearHint() {
    if (!hint && !hl.region.length && !hl.cells.length && hl.target < 0) return;
    hint = null; hl.region = []; hl.cells = []; hl.target = -1;
    if (toastKind === 'hint') hideToast();
    renderBoard();
  }
  function hintPress() {
    if (!canEdit()) return;
    const key = G.values.join('');
    if (!hint || hint.key !== key) hint = { key, step: 0, data: E.hint(G.N, G.cages, G.solution, G.values) };
    showHintStep();
  }
  function nextHint() { if (hint) { hint.step++; showHintStep(); } }
  function showHintStep() {
    const d = hint.data;
    hl.region = []; hl.cells = []; hl.target = -1; hl.wrong = [];
    if (!d) { hint = null; showToast(t('hintNone'), null, null, 'hint'); renderBoard(); return; }
    G.hints++;
    if (d.wrong) {
      hl.wrong = d.wrong.slice();
      showToast(t('hintWrong', { n: d.wrong.length }), t('removeThem'), () => {
        const patch = []; for (const i of d.wrong) change(patch, i, 0, 0);
        hint = null; commit(patch); hideToast();
      }, 'hint');
    } else if (hint.step === 0) {
      hl.region = d.region.slice();
      showToast(t('hintRegion'), t('moreHelp'), nextHint, 'hint');
    } else if (hint.step === 1) {
      hl.cells = d.techCells.slice(); hl.target = d.cell;
      showToast(t('hintTech', { t: techName(d.tech) }), t('moreHelp'), nextHint, 'hint');
    } else {
      sel = d.cell;
      const patch = []; placeDigit(patch, d.cell, d.digit); popCell = d.cell;
      hint = null;
      showToast(t('hintPlace', { d: d.digit }), null, null, 'hint');
      if (commit(patch)) checkComplete();
      return;
    }
    renderBoard(); renderInfo(); save();
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

  // ── Pause, timer, win ───────────────────────────────────────────────────────────────────────────────
  function setPause(p) {
    paused = !!p && !!G && !G.done;
    $('pauseCover').hidden = !paused;
    renderTools();
    if (paused) save(true);
  }
  setInterval(() => {
    if (!G || G.done || paused || busy || document.visibilityState !== 'visible' || $('winDlg').classList.contains('show')) return;
    G.time++;
    $('time').textContent = fmtTime(G.time);
    if (G.time % 15 === 0) save();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (G && !G.done && !busy) setPause(true); save(true); }
    else refill();
  });
  window.addEventListener('pagehide', () => doSave());

  const today = (off) => { const d = new Date(); d.setDate(d.getDate() - (off || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function streakDays() { const s = me().streak; return s.last === today() || s.last === today(1) ? s.days : 0; }
  function win() {
    G.done = true;
    const s = statsOf(G.level);
    s.won++; s.total += G.time;
    const record = !s.best || G.time < s.best;
    if (record) s.best = G.time;
    const st = me().streak;
    if (st.last !== today()) { st.days = st.last === today(1) ? st.days + 1 : 1; st.last = today(); }
    me().game = null;
    hideToast(); clearHint();
    renderAll();
    save(true);
    $('winLvl').textContent = lvName(G.level) + ' · ' + N + '×' + N;
    $('winRec').hidden = !(record && s.won > 1);
    $('winTime').textContent = fmtTime(G.time);
    $('winErrBox').hidden = settings().errMode !== 'strict';
    $('winErr').textContent = G.errors;
    $('winHints').textContent = G.hints;
    $('winStreak').textContent = daysText(st.days);
    setTimeout(() => $('winDlg').classList.add('show'), 350);
  }
  $('winAgain').onclick = () => { $('winDlg').classList.remove('show'); go(G.level); };
  $('winLevel').onclick = () => { $('winDlg').classList.remove('show'); openDrawer(); const s = $('levels').closest('.sec'); s.classList.remove('closed'); };
  $('winClose').onclick = () => $('winDlg').classList.remove('show');

  // ── Side panel controls ─────────────────────────────────────────────────────────────────────────────
  function buildLevels() {
    const box = $('levels'), tabs = $('statTabs');
    for (let l = 1; l <= 6; l++) {
      const b = document.createElement('button');
      const n = E.LEVELS[l].N;
      b.className = 'lvl';
      b.innerHTML = '<span class="n"></span><small></small>';
      b.querySelector('.n').textContent = lvName(l);
      b.querySelector('small').textContent = n + '×' + n;
      b.title = lvName(l);
      b.onclick = () => { uiLevel = statLevel = l; settings().level = l; renderLevels(); renderStats(); save(); };
      box.appendChild(b);
      const tb = document.createElement('button');
      tb.textContent = lvName(l);
      tb.onclick = () => { statLevel = l; renderStats(); };
      tabs.appendChild(tb);
    }
  }
  $('genBtn').onclick = () => requestNew(uiLevel);
  $('codeBtn').onclick = () => { const f = $('codeForm'); f.hidden = !f.hidden; $('codeErr').hidden = true; if (!f.hidden) $('codeInput').focus(); };
  $('codeForm').onsubmit = (e) => {
    e.preventDefault();
    const d = E.decodeCode($('codeInput').value);
    if (!d) { $('codeErr').hidden = false; return; }
    $('codeErr').hidden = true; $('codeForm').hidden = true; $('codeInput').value = '';
    uiLevel = statLevel = d.level; renderLevels(); renderStats();
    requestNew(d.level, d.seed);
  };
  $('copyBtn').onclick = async () => {
    if (!G) return;
    let ok = false;
    try { await navigator.clipboard.writeText(G.code); ok = true; } catch (_) {
      const ta = document.createElement('textarea'); ta.value = G.code; document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (__) {} ta.remove();
    }
    if (ok) showToast(t('copied') + ': ' + G.code);
  };
  document.querySelectorAll('.sec-h').forEach((h) => { h.onclick = () => h.parentElement.classList.toggle('closed'); });
  document.querySelectorAll('.sw').forEach((s) => { s.onclick = () => { const S = settings(); S[s.dataset.k] = !S[s.dataset.k]; renderSettings(); renderBoard(); save(); }; });
  document.querySelectorAll('#errMode button').forEach((b) => { b.onclick = () => { settings().errMode = b.dataset.v; renderSettings(); renderBoard(); save(); }; });
  document.querySelectorAll('#themeSeg button').forEach((b) => { b.onclick = () => { settings().theme = b.dataset.v; renderSettings(); applyTheme(); save(); }; });
  const openDrawer = () => $('app').classList.add('drawer');
  const closeDrawer = () => $('app').classList.remove('drawer');
  $('menuBtn').onclick = openDrawer;
  $('drawerClose').onclick = closeDrawer;
  $('main').addEventListener('pointerdown', (e) => { if (!e.target.closest('#menuBtn')) closeDrawer(); });

  // ── Tools & keyboard ────────────────────────────────────────────────────────────────────────────────
  $('notesBtn').onclick = () => { notesMode = !notesMode; renderBoard(); renderTools(); };
  $('autoBtn').onclick = autoNotes;
  $('eraseBtn').onclick = erase;
  $('undoBtn').onclick = undo;
  $('redoBtn').onclick = redo;
  $('hintBtn').onclick = hintPress;
  $('pauseBtn').onclick = () => setPause(!paused);
  $('resumeBtn').onclick = () => setPause(false);
  document.addEventListener('pointerdown', (e) => {
    if (toastKind === 'hint' && !e.target.closest('#toast, #hintBtn, .cell')) clearHint();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'Escape') {
      if ($('confirmDlg').classList.contains('show')) $('confirmNo').click();
      else if ($('winDlg').classList.contains('show')) $('winClose').click();
      else { hideToast(); clearHint(); closeDrawer(); }
      return;
    }
    if ($('winDlg').classList.contains('show') || $('confirmDlg').classList.contains('show')) return;
    const dm = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || '') || /^([1-9])$/.exec(e.key);
    if (dm && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); input(+dm[1], e.shiftKey); return; }
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const mv = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] }[k];
    if (mv) {
      e.preventDefault();
      const r = (sel / N) | 0, c = sel % N;
      sel = ((r + mv[0] + N) % N) * N + ((c + mv[1] + N) % N);
      renderBoard();
    } else if (k === 'backspace' || k === 'delete' || k === '0') { e.preventDefault(); erase(); }
    else if (k === 'n') { notesMode = !notesMode; renderBoard(); renderTools(); }
    else if (k === 'p' || k === ' ') { e.preventDefault(); if (G && !G.done) setPause(!paused); }
    else if (k === 'h') hintPress();
  });

  // ── Start ───────────────────────────────────────────────────────────────────────────────────────────
  async function init() {
    applyTexts();
    buildLevels();
    renderTools();
    await Promise.all([loadUser(), loadDB()]);
    $('storeNote').hidden = storeMode !== 'local';
    applyTheme();
    renderUser();
    uiLevel = statLevel = settings().level;
    const saved = me().game;
    if (saved && !saved.done && saved.cages && saved.solution && Array.isArray(saved.values)) {
      G = saved; derive(); buildBoard();
      G.notes = Array.isArray(G.notes) ? G.notes : new Array(N * N).fill(0);
      uiLevel = statLevel = G.level;
      sel = Math.max(0, G.values.findIndex((v) => !v));
      renderAll();
    } else {
      renderAll();
      go(uiLevel);
    }
    setTimeout(refill, 1500);
  }
  init();
})();
