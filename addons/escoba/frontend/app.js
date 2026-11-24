/* Escoba addon for Offlined — the panel. MIT licence. */
(function () {
  'use strict';

  const ID = 'escoba';
  const C = window.SpanishCards, E = window.EscobaEngine;
  const $ = (id) => document.getElementById(id);
  const snd = (name, opts) => { try { window.GameSound.play(name, opts); } catch (_) {} };
  const params = new URLSearchParams(location.search);
  const ME = 0, AI = 1;
  const SKIP_SOUNDS = ['chip'];
  const SPEED = { slow: 1400, normal: 900, fast: 450 };

  // ── Language ────────────────────────────────────────────────────────────────────────────────────────
  const I18N = window.ESCOBA_I18N;
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
  $('cardDefs').innerHTML = C.defsSVG();

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
  const DEFAULTS = { sumHelp: true, showValue: true, sound: 'soft', speed: 'normal', theme: 'auto', level: 2, target: 21 };
  async function loadDB() {
    try {
      const r = await fetch(`/api/addons/${ID}/storage`, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      DB = (await r.json()).data;
    } catch (_) {
      storeMode = 'local';
      try { DB = JSON.parse(localStorage.getItem('ofl_escoba') || '{}'); } catch (__) { DB = {}; }
    }
    if (!DB || typeof DB !== 'object') DB = {};
    DB.v = 1;
    DB.users = DB.users && typeof DB.users === 'object' ? DB.users : {};
  }
  function save(now) { clearTimeout(saveTimer); saveTimer = setTimeout(doSave, now ? 0 : 600); }
  function doSave() {
    if (!DB) return;
    if (storeMode === 'local') { try { localStorage.setItem('ofl_escoba', JSON.stringify(DB)); } catch (_) {} return; }
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
  const statsOf = (l) => { const s = me().stats; return s[l] || (s[l] = { played: 0, won: 0, lost: 0, escobas: 0 }); };

  // ── Game state ──────────────────────────────────────────────────────────────────────────────────────
  // G: {level, target, pts:[me, ai], handNo, dealer, s (engine state), helped, over}
  let G = null, sel = null, picks = new Set(), reveal = null, busy = false, statLevel = 2;

  function newGame() {
    const S = settings();
    G = { level: S.level, target: S.target, pts: [0, 0], handNo: 1, dealer: AI, s: null, helped: false, over: false };
    statsOf(G.level).played++;
    me().game = G;
    startHand();
    closeDrawer();
  }
  function startHand() {
    G.s = E.newHand(G.dealer);
    snd('shuffle'); snd('deal', { n: 6, delay: 0.55 });
    sel = null; picks = new Set(); reveal = null;
    renderAll(); save();
    const ini = G.s.events.find((e) => e.type === 'initial');
    if (ini) { banner(t('escoba')); toast(t('initialEscoba')); snd('escoba', { delay: 1.1 }); }
    G.s.events = [];
    if (G.s.turn === AI) setTimeout(aiTurn, delay());
  }
  const delay = () => SPEED[settings().speed] || 900;
  function requestNew() {
    if (G && !G.over && (G.handNo > 1 || G.s.hands[ME].length < 3 || G.pts[0] + G.pts[1] > 0)) $('confirmDlg').classList.add('show');
    else newGame();
  }
  $('confirmYes').onclick = () => { $('confirmDlg').classList.remove('show'); newGame(); };
  $('confirmNo').onclick = () => $('confirmDlg').classList.remove('show');

  // ── Moves ───────────────────────────────────────────────────────────────────────────────────────────
  const val = (c) => E.val(c);
  function captureOptions(card) { return card === null ? [] : E.subsets(G.s.table, 15 - val(card)); }
  function canTake() {
    if (sel === null || !picks.size) return false;
    let sum = val(sel); for (const c of picks) sum += val(c);
    return sum === 15;
  }
  function myTurn() { return G && !G.over && !busy && G.s.turn === ME && G.s.hands[ME].length; }
  function doMove(p, mv) {
    const takesSiete = mv.take.length && (mv.take.includes(E.SIETE_OROS) || mv.card === E.SIETE_OROS);
    if (mv.take.length) snd('take'); else if (p === ME) snd('play');
    if (takesSiete) snd('coin', { delay: 0.12 });
    const r = E.play(G.s, mv);
    if (r.escoba) snd('escoba', { delay: 0.15 });
    if (r.dealt) snd('deal', { n: 6, delay: 0.35 });
    if (r.escoba) {
      banner(t('escoba'));
      if (p === ME) statsOf(G.level).escobas++;
      if (p === AI) toast(t('aiEscoba'));
    }
    const rest = G.s.events.find((e) => e.type === 'rest');
    if (rest) { toast(t('restTo', { who: rest.player === ME ? t('you') : t('computer') })); snd('take', { delay: 0.4 }); }
    G.s.events = [];
    sel = null; picks = new Set(); reveal = null;
    renderAll(); save();
    if (r.handOver) { setTimeout(scoreHand, 700); return; }
    if (G.s.turn === AI) setTimeout(aiTurn, delay());
    else if (p === AI) snd('turn', { delay: 0.35 });
  }
  function aiTurn() {
    if (!G || G.over || G.s.turn !== AI) return;
    busy = true; renderStatus();
    setTimeout(() => {
      const mv = E.choose(G.s, AI, G.level);
      // show the card and what it takes before applying it
      reveal = mv;
      snd('play');
      renderBoard();
      setTimeout(() => { busy = false; doMove(AI, mv); }, delay());
    }, 60);
  }

  // ── Scoring ─────────────────────────────────────────────────────────────────────────────────────────
  function scoreHand() {
    const sc = E.score(G.s);
    G.pts[0] += sc.total[0]; G.pts[1] += sc.total[1];
    const row = (k, a, b, det) => `<tr><td>${t(k)}${det ? `<span class="det">${det}</span>` : ''}</td><td>${a || '·'}</td><td>${b || '·'}</td></tr>`;
    const r = sc.rows, d = sc.detail;
    $('handRows').innerHTML =
      row('rowEscobas', r.escobas[0], r.escobas[1]) +
      row('rowCartas', r.cartas[0], r.cartas[1], d.cards[0] + ' · ' + d.cards[1]) +
      row('rowOros', r.oros[0], r.oros[1], d.oros[0] + ' · ' + d.oros[1]) +
      row('rowSieteOros', r.sieteOros[0], r.sieteOros[1]) +
      row('rowSietes', r.sietes[0], r.sietes[1], d.sietes[0] + ' · ' + d.sietes[1]) +
      `<tr class="tot"><td>${t('total')}</td><td>${sc.total[0]}</td><td>${sc.total[1]}</td></tr>` +
      `<tr class="tot"><td>${t('running')}</td><td>${G.pts[0]}</td><td>${G.pts[1]}</td></tr>`;
    const over = (G.pts[0] >= G.target || G.pts[1] >= G.target) && G.pts[0] !== G.pts[1];
    if (over) finishGame();
    save(true);
    renderAll();
    snd('handEnd');
    $('handDlg').classList.add('show');
  }
  $('nextHandBtn').onclick = () => {
    $('handDlg').classList.remove('show');
    if (G.over) { showEnd(); return; }
    G.handNo++; G.dealer = 1 - G.dealer;
    startHand();
  };
  function finishGame() {
    G.over = true;
    const s = statsOf(G.level), u = me(), won = G.pts[0] > G.pts[1];
    if (won) { s.won++; u.streak = G.helped ? 0 : u.streak + 1; } else { s.lost++; u.streak = 0; }
    u.game = null;
  }
  function showEnd() {
    const won = G.pts[0] > G.pts[1], s = statsOf(G.level);
    snd(won ? 'win' : 'lose');
    $('endTitle').textContent = won ? t('win') : t('loss');
    $('endSub').textContent = t('finalScore', { a: G.pts[0], b: G.pts[1], lv: lvName(G.level) }) + (G.helped ? ' · ' + t('withHelp') : '');
    $('endBadge').classList.toggle('lose', !won);
    $('endW').textContent = s.won; $('endL').textContent = s.lost; $('endE').textContent = s.escobas;
    renderStats();
    $('endDlg').classList.add('show');
  }
  $('endAgain').onclick = () => { $('endDlg').classList.remove('show'); newGame(); };
  $('endClose').onclick = () => $('endDlg').classList.remove('show');

  // ── Rendering ───────────────────────────────────────────────────────────────────────────────────────
  const cardHTML = (id, cls) => `<div class="card ${cls || ''}" data-c="${id}">${C.cardSVG(id, { value: settings().showValue })}</div>`;
  const backHTML = (cls) => `<div class="card ${cls || ''}">${C.backSVG()}</div>`;
  function renderBoard() {
    if (!G) return;
    const s = G.s, S = settings();
    const opts = captureOptions(sel);
    const can = new Set(); if (S.sumHelp) for (const o of opts) for (const c of o) can.add(c);
    // computer hand (backs)
    $('aiHand').innerHTML = s.hands[AI].map(() => backHTML()).join('');
    // table
    let tbl = '';
    for (const c of s.table) {
      let cls = 'btn-card';
      if (reveal && reveal.take.includes(c)) cls += ' pick';
      else if (picks.has(c)) cls += ' pick';
      else if (can.has(c)) cls += ' can';
      if (hintMv && hintMv.take.includes(c)) cls += ' hintc';
      tbl += cardHTML(c, cls);
    }
    if (reveal) tbl += cardHTML(reveal.card, 'played');
    $('table').innerHTML = tbl;
    // my hand
    $('myHand').innerHTML = s.hands[ME].map((c) => cardHTML(c, 'btn-card' + (c === sel ? ' sel' : '') + (hintMv && hintMv.card === c && c !== sel ? ' hintc' : ''))).join('');
    // piles, deck
    for (const [p, pile, cnt, esc] of [[ME, 'myPile', 'myCount', 'myEsc'], [AI, 'aiPile', 'aiCount', 'aiEsc']]) {
      $(pile).innerHTML = s.won[p].length ? backHTML('mini') : '';
      $(cnt).textContent = s.won[p].length;
      $(esc).innerHTML = '<i></i>'.repeat(s.escobas[p]);
    }
    $('deckStack').innerHTML = s.stock.length ? backHTML() : '';
    $('deckCount').textContent = s.stock.length;
    renderStatus();
  }
  function renderStatus() {
    if (!G) return;
    const s = G.s;
    $('seatMe').classList.toggle('turn', !G.over && s.turn === ME);
    $('seatAi').classList.toggle('turn', !G.over && s.turn === AI);
    $('sbMe').textContent = G.pts[0]; $('sbAi').textContent = G.pts[1];
    $('sbInfo').textContent = t('handN', { n: G.handNo }) + ' · ' + t('points', { n: G.target });
    $('aiLvl').textContent = lvName(G.level);
    $('infoScore').textContent = G.pts[0] + ' – ' + G.pts[1];
    $('infoHand').textContent = t('handN', { n: G.handNo });
    $('infoTarget').textContent = t('points', { n: G.target });
    $('infoEsc').textContent = s.escobas[0] + ' – ' + s.escobas[1];
    // message and buttons
    let msg = '';
    const mine = myTurn();
    if (G.over) msg = '';
    else if (s.turn === AI || busy) msg = t('aiTurn');
    else if (sel === null) msg = t('yourTurn');
    else {
      const opts = captureOptions(sel);
      if (!opts.length) msg = t('mustDrop');
      else if (picks.size) { let sum = val(sel); for (const c of picks) sum += val(c); msg = sum === 15 ? t('sumNow', { s: sum }) : t('sumNow', { s: sum }); }
      else msg = t('pickTake', { n: 15 - val(sel) });
    }
    $('msg').textContent = msg;
    $('takeBtn').disabled = !mine || !canTake();
    $('dropBtn').disabled = !mine || sel === null || picks.size > 0;
    $('hintBtn').disabled = !mine;
  }
  function renderLevels() {
    const S = settings();
    document.querySelectorAll('#levels .lvl').forEach((b, k) => b.classList.toggle('on', k + 1 === S.level));
    document.querySelectorAll('#targetSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === +S.target));
  }
  function renderStats() {
    document.querySelectorAll('#statTabs button').forEach((b, k) => b.classList.toggle('on', k + 1 === statLevel));
    const s = statsOf(statLevel);
    $('stW').textContent = s.won; $('stL').textContent = s.lost; $('stE').textContent = s.escobas;
    let wins = 0; for (const l in me().stats) wins += me().stats[l].won || 0;
    $('userSub').textContent = t('streakLine', { n: me().streak, w: wins });
  }
  function renderSettings() {
    const S = settings();
    document.querySelectorAll('.sw').forEach((s) => s.classList.toggle('on', !!S[s.dataset.k]));
    document.querySelectorAll('#themeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.theme));
    document.querySelectorAll('#soundSeg button').forEach((b) => { b.onclick = () => { settings().sound = b.dataset.v; window.GameSound.setLevel(b.dataset.v); renderSettings(); save(); if (b.dataset.v !== 'off') snd('play'); }; });
  document.querySelectorAll('#speedSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.speed));
    document.querySelectorAll('#soundSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.sound));
  }
  function renderUser() {
    const name = USER.name || t('you');
    $('userName').textContent = name;
    for (const av of [$('avatar'), $('meAv')]) {
      av.style.background = USER.color || '#6b7280'; av.style.color = '#fff';
      if (USER.photo && USER.id) av.innerHTML = `<img alt="" src="/api/users/${encodeURIComponent(USER.id)}/avatar">`;
      else av.textContent = (name.trim()[0] || '?').toUpperCase();
    }
  }
  function renderAll() { renderBoard(); renderLevels(); renderStats(); renderSettings(); }

  let bannerTimer = null, toastTimer = null;
  function banner(text) { const b = $('banner'); b.textContent = text; b.classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 1100); }
  function toast(text) { const el = $('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3000); }

  // ── Clicks ──────────────────────────────────────────────────────────────────────────────────────────
  let hintMv = null;
  $('myHand').addEventListener('click', (e) => {
    const el = e.target.closest('.card'); if (!el || !myTurn()) return;
    const c = +el.dataset.c;
    hintMv = null;
    if (sel === c) { sel = null; picks = new Set(); }
    else { sel = c; picks = new Set(); }
    renderBoard();
  });
  $('myHand').addEventListener('dblclick', (e) => {
    const el = e.target.closest('.card'); if (!el || !myTurn()) return;
    const c = +el.dataset.c, opts = captureOptions(c);
    if (opts.length === 1) doMove(ME, { card: c, take: opts[0] });
    else if (!opts.length) doMove(ME, { card: c, take: [] });
  });
  $('table').addEventListener('click', (e) => {
    const el = e.target.closest('.card'); if (!el || !myTurn() || sel === null) return;
    const c = +el.dataset.c;
    if (!G.s.table.includes(c)) return;
    if (picks.has(c)) picks.delete(c); else picks.add(c);
    hintMv = null;
    renderBoard();
  });
  $('takeBtn').onclick = () => { if (myTurn() && canTake()) doMove(ME, { card: sel, take: [...picks] }); };
  $('dropBtn').onclick = () => { if (myTurn() && sel !== null && !picks.size) doMove(ME, { card: sel, take: [] }); };
  $('hintBtn').onclick = () => {
    if (!myTurn()) return;
    $('hintBtn').disabled = true;
    setTimeout(() => {
      const mv = E.choose(G.s, ME, 'hint');
      hintMv = mv; sel = mv.card; picks = new Set(mv.take);
      const first = !G.helped; G.helped = true;
      renderBoard(); save();
      toast(t('hintText') + (first ? ' ' + t('helpNote') : ''));
    }, 30);
  };

  // ── Side panel ──────────────────────────────────────────────────────────────────────────────────────
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
  document.querySelectorAll('#targetSeg button').forEach((b) => { b.onclick = () => { settings().target = +b.dataset.v; renderLevels(); save(); }; });
  document.querySelectorAll('#speedSeg button').forEach((b) => { b.onclick = () => { settings().speed = b.dataset.v; renderSettings(); save(); }; });
  document.querySelectorAll('#themeSeg button').forEach((b) => { b.onclick = () => { settings().theme = b.dataset.v; renderSettings(); applyTheme(); save(); }; });
  document.querySelectorAll('.sw').forEach((s) => { s.onclick = () => { const S = settings(); S[s.dataset.k] = !S[s.dataset.k]; renderSettings(); renderBoard(); save(); }; });
  document.querySelectorAll('.sec-h').forEach((h) => { h.onclick = () => h.parentElement.classList.toggle('closed'); });
  $('newBtn').onclick = requestNew;
  const closeDrawer = () => $('app').classList.remove('drawer');
  $('menuBtn').onclick = () => $('app').classList.add('drawer');
  $('drawerClose').onclick = closeDrawer;
  $('main').addEventListener('pointerdown', (e) => { if (!e.target.closest('#menuBtn')) closeDrawer(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      for (const id of ['confirmDlg', 'endDlg']) if ($(id).classList.contains('show')) { $(id).classList.remove('show'); return; }
      sel = null; picks = new Set(); hintMv = null; closeDrawer(); renderBoard(); return;
    }
    if (document.querySelector('.overlay.show') || !myTurn()) return;
    const n = +e.key;
    if (n >= 1 && n <= 3 && G.s.hands[ME][n - 1] !== undefined) { const c = G.s.hands[ME][n - 1]; sel = sel === c ? null : c; picks = new Set(); hintMv = null; renderBoard(); }
    else if (e.key === 'Enter') { if (canTake()) $('takeBtn').click(); else if (sel !== null && !picks.size) $('dropBtn').click(); }
    else if (e.key.toLowerCase() === 'h') $('hintBtn').click();
  });
  window.addEventListener('pagehide', () => doSave());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); });

  // ── Start ───────────────────────────────────────────────────────────────────────────────────────────
  async function init() {
    applyTexts();
    buildLevels();
    await Promise.all([loadUser(), loadDB()]);
    $('storeNote').hidden = storeMode !== 'local';
    window.GameSound.init({ level: settings().sound, skip: SKIP_SOUNDS });
    applyTheme();
    renderUser();
    statLevel = settings().level;
    const saved = me().game;
    if (saved && saved.s && !saved.over) {
      G = saved;
      renderAll();
      if (G.s.turn === AI && (G.s.hands[0].length || G.s.hands[1].length)) setTimeout(aiTurn, delay());
      else if (!G.s.hands[0].length && !G.s.hands[1].length && !G.s.stock.length) scoreHand();
    } else newGame();
  }
  init();
})();
