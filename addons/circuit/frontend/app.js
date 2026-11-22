/* Circuit addon for Offlined — the panel. MIT licence. */
(function () {
  'use strict';

  const ID = 'circuit';
  const E = window.CircuitEngine;
  const { UNK, LINE, CROSS } = E;
  const POOL_TARGET = 2, LEVEL_COUNT = 6;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  // ── Language ────────────────────────────────────────────────────────────────────────────────────────
  const I18N = window.CIRCUIT_I18N;
  let lang = (params.get('lang') || navigator.language || 'en').slice(0, 2).toLowerCase();
  if (!I18N[lang]) lang = 'en';
  const t = (k, vars) => {
    let s = I18N[lang][k] !== undefined ? I18N[lang][k] : I18N.en[k];
    if (vars && typeof s === 'string') for (const v in vars) s = s.split('{' + v + '}').join(vars[v]);
    return s;
  };
  const lvName = (l) => t('lv')[l - 1] || String(l);
  const techName = (id) => (id ? t('t_' + id) : '—');
  const sizeOf = (l) => E.LEVELS[l].R + '×' + E.LEVELS[l].C;
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
  const DEFAULTS = { errMode: 'free', dimDone: true, timer: true, theme: 'auto', level: 2 };
  function normalize(d) {
    d = d && typeof d === 'object' ? d : {};
    d.v = 1;
    d.pool = d.pool && typeof d.pool === 'object' ? d.pool : {};
    for (let l = 1; l <= LEVEL_COUNT; l++) d.pool[l] = (d.pool[l] || []).filter((p) => p && p.engine === E.ENGINE_VERSION && p.clues && p.solution);
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
      try { DB = normalize(JSON.parse(localStorage.getItem('ofl_circuit') || '{}')); } catch (__) { DB = normalize({}); }
    }
  }
  function save(now) { clearTimeout(saveTimer); saveTimer = setTimeout(doSave, now ? 0 : 700); }
  function doSave() {
    if (!DB) return;
    if (storeMode === 'local') { try { localStorage.setItem('ofl_circuit', JSON.stringify(DB)); } catch (_) {} return; }
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
    u.streak = u.streak || { last: '', days: 0 };
    return u;
  }
  const settings = () => (DB ? me().settings : DEFAULTS);
  const statsOf = (l) => { const s = me().stats; return s[l] || (s[l] = { played: 0, won: 0, best: 0, total: 0 }); };

  // ── Game state ──────────────────────────────────────────────────────────────────────────────────────
  let G = null, geom = null, clues = null, sol = null, noClues = null;
  let crossMode = false, paused = false, busy = false, showErrors = false;
  let undoStack = [], redoStack = [], hint = null, hl = { cells: [], edges: [], wrong: [] };
  let uiLevel = 2, statLevel = 2, paint = null;

  function derive() {
    geom = E.geo(G.R, G.C);
    clues = E.parseClues(G.clues);
    sol = E.parseSol(G.solution);
    noClues = new Int8Array(geom.NC).fill(-1);
  }
  function startGame(p) {
    G = { code: p.code, level: p.level, R: p.R, C: p.C, clues: p.clues, solution: p.solution, tier: p.tier, clueCount: p.clueCount,
      edges: new Array(E.geo(p.R, p.C).NE).fill(0), time: 0, errors: 0, hints: 0, done: false };
    derive();
    statsOf(p.level).played++;
    settings().level = p.level;
    me().game = G;
    uiLevel = statLevel = p.level;
    undoStack = []; redoStack = []; hint = null; hl = { cells: [], edges: [], wrong: [] };
    showErrors = false; crossMode = false; setPause(false);
    hideToast();
    renderAll();
    save();
  }
  const hasProgress = () => G && !G.done && (G.time > 20 || G.edges.some((v) => v));

  // ── Generators ──────────────────────────────────────────────────────────────────────────────────────
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
    if (m.type === 'done') startGame(m.result); else showToast(String(m.message || 'error'));
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
      const p = DB.pool[level].shift(); save(); startGame(p); refill(); return;
    }
    fgJob = Date.now() + Math.random();
    showGen(true, level);
    fg.postMessage({ type: 'generate', id: fgJob, level, seed: seed === undefined ? randomSeed() : seed, slice: 60, rest: 0 });
  }
  let pendingConfirm = null;
  function confirmBox(text, yes, fn) { $('confirmText').textContent = text; $('confirmYes').textContent = yes; pendingConfirm = fn; $('confirmDlg').classList.add('show'); }
  $('confirmYes').onclick = () => { $('confirmDlg').classList.remove('show'); const f = pendingConfirm; pendingConfirm = null; if (f) f(); };
  $('confirmNo').onclick = () => { $('confirmDlg').classList.remove('show'); pendingConfirm = null; };
  function requestNew(level, seed) {
    if (hasProgress()) confirmBox(t('confirmNew'), t('yes'), () => go(level, seed));
    else go(level, seed);
  }
  $('genCancel').onclick = () => { fg.postMessage({ type: 'cancel' }); fgJob = 0; showGen(false); };

  // ── Board (SVG) ─────────────────────────────────────────────────────────────────────────────────────
  const board = $('board');
  function isBad(e) {
    if (!G) return false;
    if (hl.wrong.includes(e)) return true;
    if (settings().errMode !== 'strict' && !showErrors) return false;
    const v = G.edges[e];
    return (v === LINE && sol[e] !== LINE) || (v === CROSS && sol[e] === LINE);
  }
  function edgeXY(e) { // endpoints in board units
    const g = geom;
    if (e < g.NH) { const r = (e / g.C) | 0, c = e % g.C; return [c, r, c + 1, r]; }
    const k = e - g.NH, r = (k / (g.C + 1)) | 0, c = k % (g.C + 1);
    return [c, r, c, r + 1];
  }
  function insideCells() {
    const g = geom, out = [];
    for (let r = 0; r < g.R; r++) {
      let inside = false;
      for (let c = 0; c < g.C; c++) {
        if (sol[g.v(r, c)] === LINE) inside = !inside;
        if (inside) out.push(r * g.C + c);
      }
    }
    return out;
  }
  function renderBoard() {
    if (!G) { board.innerHTML = ''; return; }
    const g = geom, S = settings();
    const m = 0.5;
    board.setAttribute('viewBox', `${-m} ${-m} ${g.C + 2 * m} ${g.R + 2 * m}`);
    let h = '';
    if (G.done) for (const i of insideCells()) h += `<rect class="inside" x="${i % g.C}" y="${(i / g.C) | 0}" width="1" height="1"/>`;
    for (const i of hl.cells) h += `<rect class="hint-cell" x="${i % g.C}" y="${(i / g.C) | 0}" width="1" height="1"/>`;
    for (const e of hl.edges) { const [x1, y1, x2, y2] = edgeXY(e); h += `<line class="hint-edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width=".28"/>`; }
    for (let e = 0; e < g.NE; e++) {
      const v = G.edges[e];
      if (!v) continue;
      const [x1, y1, x2, y2] = edgeXY(e), bad = isBad(e) ? ' bad' : '';
      if (v === LINE) h += `<line class="ln${bad}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width=".12"/>`;
      else {
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, d = 0.09;
        h += `<path class="x${bad}" d="M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}" stroke-width=".045"/>`;
      }
    }
    for (let r = 0; r <= g.R; r++) for (let c = 0; c <= g.C; c++) h += `<circle class="dot" cx="${c}" cy="${r}" r=".075"/>`;
    for (let i = 0; i < g.NC; i++) {
      const n = clues[i]; if (n < 0) continue;
      let L = 0, X = 0;
      for (const e of g.cellEdges[i]) { if (G.edges[e] === LINE) L++; else if (G.edges[e] === CROSS) X++; }
      const cls = L > n || 4 - X < n ? ' over' : (S.dimDone && L === n && L + X === 4 ? ' done' : '');
      h += `<text class="clue${cls}" x="${(i % g.C) + 0.5}" y="${((i / g.C) | 0) + 0.53}" font-size=".6">${n}</text>`;
    }
    board.innerHTML = h;
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
    $('infoSize').textContent = G.R + '×' + G.C;
    $('infoTech').textContent = techName(['', 'basic', 'pattern', 'loop', 'color', 'contradiction'][G.tier]);
    $('infoErr').textContent = G.errors;
    $('infoHints').textContent = G.hints;
    $('code').textContent = G.code;
    let ok = 0, total = 0;
    for (let e = 0; e < geom.NE; e++) if (sol[e] === LINE) { total++; if (G.edges[e] === LINE) ok++; }
    const pct = total ? Math.round((ok / total) * 100) : 0;
    $('infoPct').textContent = pct + ' %';
    $('pctBar').style.width = pct + '%';
  }
  function renderTools() {
    const off = !G || G.done || busy;
    $('crossBtn').classList.toggle('on', crossMode);
    $('undoBtn').disabled = off || !undoStack.length;
    $('redoBtn').disabled = off || !redoStack.length;
    ['crossBtn', 'restartBtn', 'hintBtn'].forEach((id) => { $(id).disabled = off; });
    $('pauseBtn').disabled = off;
    $('pauseBtn').innerHTML = `<svg class="i"><use href="#i-${paused ? 'play' : 'pause'}"/></svg>`;
  }
  function renderLevels() { document.querySelectorAll('#levels .lvl').forEach((b, k) => b.classList.toggle('on', k + 1 === uiLevel)); }
  function renderStats() {
    document.querySelectorAll('#statTabs button').forEach((b, k) => b.classList.toggle('on', k + 1 === statLevel));
    const s = statsOf(statLevel);
    $('stPlayed').textContent = s.played; $('stWon').textContent = s.won;
    $('stBest').textContent = s.best ? fmtTime(s.best) : t('empty');
    $('stAvg').textContent = s.won ? fmtTime(s.total / s.won) : t('empty');
    let wins = 0; for (const l in me().stats) wins += me().stats[l].won || 0;
    $('userSub').textContent = t('streakLine', { d: daysText(streakDays()), w: wins });
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

  // ── Drawing ─────────────────────────────────────────────────────────────────────────────────────────
  const canEdit = () => G && !G.done && !paused && !busy;
  function edgeAt(ev) {
    const ctm = board.getScreenCTM(); if (!ctm || !G) return -1;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    const g = geom, x = p.x, y = p.y;
    let best = -1, bd = 0.36;
    const hr = Math.round(y), hc = Math.floor(x);
    if (hr >= 0 && hr <= g.R && hc >= 0 && hc < g.C) { const d = Math.abs(y - hr); if (d < bd) { bd = d; best = g.h(hr, hc); } }
    const vc = Math.round(x), vr = Math.floor(y);
    if (vc >= 0 && vc <= g.C && vr >= 0 && vr < g.R) { const d = Math.abs(x - vc); if (d < bd) { bd = d; best = g.v(vr, vc); } }
    return best;
  }
  function setEdge(patch, e, v) {
    if (G.edges[e] === v) return;
    patch.push([e, G.edges[e], v]);
    if (settings().errMode === 'strict' && ((v === LINE && sol[e] !== LINE) || (v === CROSS && sol[e] === LINE))) G.errors++;
    G.edges[e] = v;
  }
  board.addEventListener('contextmenu', (e) => e.preventDefault());
  board.addEventListener('pointerdown', (ev) => {
    if (!canEdit() || (ev.button !== 0 && ev.button !== 2)) return;
    const e = edgeAt(ev);
    if (e < 0) return;
    ev.preventDefault();
    clearHint();
    const cur = G.edges[e];
    let v;
    if (ev.button === 2 || crossMode) v = cur === CROSS ? UNK : CROSS;
    else v = cur === UNK ? LINE : cur === LINE ? CROSS : UNK;
    paint = { v, patch: [], seen: new Set([e]), last: { x: ev.clientX, y: ev.clientY } };
    setEdge(paint.patch, e, v);
    board.setPointerCapture(ev.pointerId);
    renderBoard();
  });
  board.addEventListener('pointermove', (ev) => {
    if (!paint) return;
    // sample the path since the last event so a fast drag does not skip edges
    const last = paint.last || { x: ev.clientX, y: ev.clientY };
    const steps = Math.max(1, Math.ceil(Math.hypot(ev.clientX - last.x, ev.clientY - last.y) / 6));
    let changed = false;
    for (let k = 1; k <= steps; k++) {
      const pt = { clientX: last.x + ((ev.clientX - last.x) * k) / steps, clientY: last.y + ((ev.clientY - last.y) * k) / steps };
      const e = edgeAt(pt);
      if (e < 0 || paint.seen.has(e)) continue;
      paint.seen.add(e);
      setEdge(paint.patch, e, paint.v);
      changed = true;
    }
    paint.last = { x: ev.clientX, y: ev.clientY };
    if (changed) renderBoard();
  });
  function endPaint() {
    if (!paint) return;
    const p = paint; paint = null;
    commit(p.patch);
  }
  board.addEventListener('pointerup', endPaint);
  board.addEventListener('pointercancel', endPaint);

  function commit(patch) {
    if (!patch.length) { renderBoard(); return; }
    undoStack.push(patch); if (undoStack.length > 800) undoStack.shift();
    redoStack = []; showErrors = false; hl.wrong = [];
    renderBoard(); renderTools(); save();
    checkComplete();
  }
  function undo() {
    if (!canEdit() || !undoStack.length) return;
    clearHint();
    const p = undoStack.pop();
    for (let k = p.length - 1; k >= 0; k--) G.edges[p[k][0]] = p[k][1];
    redoStack.push(p); renderBoard(); renderTools(); save();
  }
  function redo() {
    if (!canEdit() || !redoStack.length) return;
    clearHint();
    const p = redoStack.pop();
    for (const [e, , v] of p) G.edges[e] = v;
    undoStack.push(p); renderBoard(); renderTools(); save();
  }
  function restart() {
    if (!canEdit()) return;
    confirmBox(t('confirmRestart'), t('yesRestart'), () => {
      clearHint();
      const patch = []; for (let e = 0; e < geom.NE; e++) if (G.edges[e]) patch.push([e, G.edges[e], UNK]), G.edges[e] = UNK;
      commit(patch);
    });
  }
  function checkComplete() {
    const st = Int8Array.from(G.edges, (v) => (v === LINE ? LINE : CROSS));
    let same = true;
    for (let e = 0; e < geom.NE; e++) if ((st[e] === LINE) !== (sol[e] === LINE)) { same = false; break; }
    if (same) { win(); return; }
    if (E.isSolution(geom, noClues, st) && settings().errMode !== 'strict') {
      showToast(t('loopWrong'), t('showErrors'), () => { showErrors = true; renderBoard(); hideToast(); }, 'alert');
    }
  }

  // ── Hints ───────────────────────────────────────────────────────────────────────────────────────────
  function clearHint() {
    if (!hint && !hl.cells.length && !hl.edges.length) return;
    hint = null; hl.cells = []; hl.edges = [];
    if (toastKind === 'hint') hideToast();
    renderBoard();
  }
  function hintPress() {
    if (!canEdit()) return;
    const key = G.edges.join('');
    if (!hint || hint.key !== key) hint = { key, step: 0, data: E.hint(G.R, G.C, G.clues, G.solution, Int8Array.from(G.edges)) };
    showHintStep();
  }
  function nextHint() { if (hint) { hint.step++; showHintStep(); } }
  function showHintStep() {
    const d = hint.data;
    hl.cells = []; hl.edges = []; hl.wrong = [];
    if (!d) { hint = null; showToast(t('hintNone'), null, null, 'hint'); renderBoard(); return; }
    G.hints++;
    if (d.wrong) {
      hl.wrong = d.wrong.slice();
      showToast(t('hintWrong', { n: d.wrong.length }), t('removeThem'), () => {
        const patch = []; for (const e of d.wrong) { patch.push([e, G.edges[e], UNK]); G.edges[e] = UNK; }
        hint = null; commit(patch); hideToast();
      }, 'hint');
    } else if (hint.step === 0) {
      hl.cells = d.cells.slice();
      showToast(t('hintRegion'), t('moreHelp'), nextHint, 'hint');
    } else if (hint.step === 1) {
      hl.cells = d.cells.slice(); hl.edges = d.deductions.map((x) => x[0]);
      showToast(t('hintTech', { t: techName(d.tech) }), t('moreHelp'), nextHint, 'hint');
    } else {
      const patch = [];
      for (const [e, v] of d.deductions) { patch.push([e, G.edges[e], v]); G.edges[e] = v; }
      hint = null;
      showToast(t('hintPlace'), null, null, 'hint');
      commit(patch);
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
    // the remaining unknown edges are not part of the loop
    for (let e = 0; e < geom.NE; e++) if (G.edges[e] !== LINE) G.edges[e] = UNK;
    const s = statsOf(G.level);
    s.won++; s.total += G.time;
    const record = !s.best || G.time < s.best;
    if (record) s.best = G.time;
    const st = me().streak;
    if (st.last !== today()) { st.days = st.last === today(1) ? st.days + 1 : 1; st.last = today(); }
    me().game = null;
    hideToast(); clearHint(); paint = null;
    renderAll();
    save(true);
    $('winLvl').textContent = lvName(G.level) + ' · ' + G.R + '×' + G.C;
    $('winRec').hidden = !(record && s.won > 1);
    $('winTime').textContent = fmtTime(G.time);
    $('winErrBox').hidden = settings().errMode !== 'strict';
    $('winErr').textContent = G.errors;
    $('winHints').textContent = G.hints;
    $('winStreak').textContent = daysText(st.days);
    setTimeout(() => $('winDlg').classList.add('show'), 700);
  }
  $('winAgain').onclick = () => { $('winDlg').classList.remove('show'); go(G.level); };
  $('winLevel').onclick = () => { $('winDlg').classList.remove('show'); openDrawer(); $('levels').closest('.sec').classList.remove('closed'); };
  $('winClose').onclick = () => $('winDlg').classList.remove('show');

  // ── Side panel ──────────────────────────────────────────────────────────────────────────────────────
  function buildLevels() {
    for (let l = 1; l <= LEVEL_COUNT; l++) {
      const b = document.createElement('button');
      b.className = 'lvl';
      b.innerHTML = '<span class="n"></span><small class="sz"></small>';
      b.querySelector('.n').textContent = lvName(l);
      b.querySelector('.sz').textContent = sizeOf(l);
      b.title = lvName(l) + ' · ' + sizeOf(l);
      b.onclick = () => { uiLevel = statLevel = l; settings().level = l; renderLevels(); renderStats(); save(); };
      $('levels').appendChild(b);
      const tb = document.createElement('button');
      tb.textContent = lvName(l);
      tb.onclick = () => { statLevel = l; renderStats(); };
      $('statTabs').appendChild(tb);
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

  $('crossBtn').onclick = () => { crossMode = !crossMode; renderTools(); };
  $('undoBtn').onclick = undo;
  $('redoBtn').onclick = redo;
  $('restartBtn').onclick = restart;
  $('hintBtn').onclick = hintPress;
  $('pauseBtn').onclick = () => setPause(!paused);
  $('resumeBtn').onclick = () => setPause(false);
  document.addEventListener('pointerdown', (e) => {
    if (toastKind === 'hint' && !e.target.closest('#toast, #hintBtn, #board')) clearHint();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if ($('confirmDlg').classList.contains('show')) $('confirmNo').click();
      else if ($('winDlg').classList.contains('show')) $('winClose').click();
      else { hideToast(); clearHint(); closeDrawer(); }
      return;
    }
    if ($('winDlg').classList.contains('show') || $('confirmDlg').classList.contains('show')) return;
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'x') { crossMode = !crossMode; renderTools(); }
    else if (k === 'h') hintPress();
    else if (k === 'p' || k === ' ') { e.preventDefault(); if (G && !G.done) setPause(!paused); }
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
    if (saved && !saved.done && saved.clues && saved.solution && Array.isArray(saved.edges)) {
      G = saved; derive();
      uiLevel = statLevel = G.level;
      renderAll();
    } else { renderAll(); go(uiLevel); }
    setTimeout(refill, 1500);
  }
  init();
})();
