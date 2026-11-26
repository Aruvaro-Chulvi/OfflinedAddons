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
  const FX_SPEED = { slow: 1.3, normal: 1, fast: 0.7 };   // card flights follow the game speed
  const DEAL_GAP = 110, FLY = 300;                        // ms between dealt cards, ms per flight
  const FX = window.CardFX;

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
  // anim: cards are moving (no input). ghost: cards still drawn on the table that already belong to a pile
  // (initial escoba, the rest at the end) until they fly there. epoch: bumps on a new game so old timers stop.
  let anim = false, ghost = null, epoch = 0;
  const later = (fn, ms) => { const ep = epoch; setTimeout(() => { if (ep === epoch) fn(); }, ms); };

  function newGame() {
    epoch++; FX.cancel();
    busy = false; anim = false; ghost = null;
    $('handDlg').classList.remove('show');
    const S = settings();
    G = { level: S.level, target: S.target, pts: [0, 0], handNo: 1, dealer: AI, s: null, helped: false, over: false };
    statsOf(G.level).played++;
    me().game = G;
    startHand();
    closeDrawer();
  }
  function startHand() {
    const ep = epoch;
    G.s = E.newHand(G.dealer);
    delete G.scored;
    const ini = G.s.events.find((e) => e.type === 'initial');
    G.s.events = [];
    sel = null; picks = new Set(); reveal = null; hintMv = null;
    ghost = ini ? ini.cards.slice() : null;
    anim = true;
    renderAll(); save();
    // shuffle, then each card leaves the deck with its own sound: the 4 on the table first, then 3 each
    snd('shuffle');
    dealAnim(dealTargets(true), 550).then(async () => {
      if (ep !== epoch) return;
      if (ini) {
        // a table of 15 (or 30) goes straight to the dealer: an escoba
        await FX.wait(250);
        if (ep !== epoch) return;
        const items = ghost.map((c) => [c, FX.rect(tableCardEl(c))]);
        ghost = null; renderBoard();
        await sweep(items, ini.player);
        if (ep !== epoch) return;
        banner(t('escoba')); toast(t('initialEscoba')); snd('escoba');
      }
      anim = false; renderBoard();
      if (G.s.turn === AI) later(aiTurn, delay());
    });
  }

  // ── Card movement (animation and sound together) ──────────────────────────────────────────────────
  const face = (c) => C.cardSVG(c, { value: settings().showValue });
  const handEl = (p) => $(p === ME ? 'myHand' : 'aiHand');
  const tableCardEl = (c) => $('table').querySelector(`.card[data-c="${c}"]`);
  /** Elements in dealing order: optionally the table, then 3 rounds of one card each, non-dealer first. */
  function dealTargets(withTable) {
    const out = withTable ? [...$('table').children] : [];
    const first = 1 - G.s.dealer;
    for (let k = 0; k < 3; k++) for (const p of [first, G.s.dealer]) { const el = handEl(p).children[k]; if (el) out.push(el); }
    return out;
  }
  function dealAnim(targets, start) {
    const from = FX.rect($('deckStack'));
    FX.hide(targets);
    return Promise.all(targets.map((el, i) => FX.fly({ from, to: el, html: el.innerHTML, delay: start + i * DEAL_GAP, dur: FLY, onStart: () => snd('card') })));
  }
  /** Cards [[id, rect]] fly to a player's pile; the siete de oros chimes when it lands. */
  function sweep(items, p) {
    const to = $(p === ME ? 'myPile' : 'aiPile');
    return Promise.all(items.map(([c, r], i) => FX.fly({
      from: r, to, hideTarget: false, html: face(c), delay: i * 45, dur: FLY + 80,
      onStart: i === 0 ? () => snd('take') : null,
      onLand: c === E.SIETE_OROS ? () => snd('coin') : null,
    })));
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
  function myTurn() { return G && !G.over && !busy && !anim && G.s.turn === ME && G.s.hands[ME].length; }
  function doMove(p, mv) {
    const ep = epoch;
    // where the cards are now, before the move changes the table
    const src = p === ME ? handEl(ME).querySelector(`.card[data-c="${mv.card}"]`) : $('table').querySelector('.card.played');
    const fromCard = FX.rect(src);
    const takeRects = mv.take.map((c) => [c, FX.rect(tableCardEl(c))]);
    const r = E.play(G.s, mv);
    const rest = G.s.events.find((e) => e.type === 'rest');
    G.s.events = [];
    if (r.escoba && p === ME) statsOf(G.level).escobas++;
    sel = null; picks = new Set(); reveal = null; hintMv = null;
    ghost = rest ? rest.cards.slice() : null;
    anim = true;
    renderAll(); save();
    const dealt = r.dealt ? dealTargets(false) : [];
    FX.hide(dealt);
    let moved;
    if (mv.take.length) moved = sweep([[mv.card, fromCard], ...takeRects], p);
    else if (p === ME) moved = FX.fly({ from: fromCard, to: tableCardEl(mv.card), html: face(mv.card), dur: FLY, onLand: () => snd('play') });
    else moved = Promise.resolve(true);   // the computer's card is already on the table
    moved.then(async () => {
      if (ep !== epoch) return;
      if (r.escoba) {
        banner(t('escoba')); snd('escoba');
        if (p === AI) toast(t('aiEscoba'));
        await FX.wait(900);
      }
      if (ep !== epoch) return;
      if (r.dealt) { await FX.wait(250); if (ep !== epoch) return; await dealAnim(dealt, 0); }
      if (ep !== epoch) return;
      if (rest) {
        // what is left on the table goes to whoever took last
        await FX.wait(350);
        if (ep !== epoch) return;
        const items = ghost.map((c) => [c, FX.rect(tableCardEl(c))]);
        ghost = null; renderBoard();
        toast(t('restTo', { who: rest.player === ME ? t('you') : t('computer') }));
        await sweep(items, rest.player);
      }
      if (ep !== epoch) return;
      anim = false; renderBoard();
      if (r.handOver) { later(scoreHand, 500); return; }
      if (G.s.turn === AI) later(aiTurn, delay());
      else if (p === AI) snd('turn');
    });
  }
  function aiTurn() {
    if (!G || G.over || G.s.turn !== AI || anim) return;
    busy = true; renderStatus();
    later(() => {
      const mv = E.choose(G.s, AI, G.level);
      // the card travels from the computer's hand to the table, then what it takes is shown before applying it
      const backs = $('aiHand').children;
      const from = FX.rect(backs[backs.length - 1]);
      reveal = mv;
      renderBoard();
      FX.fly({ from, to: $('table').querySelector('.card.played'), html: face(mv.card), dur: FLY, onLand: () => snd('play') })
        .then((ok) => { if (ok) later(() => { busy = false; doMove(AI, mv); }, delay()); });
    }, 60);
  }

  // ── Scoring ─────────────────────────────────────────────────────────────────────────────────────────
  function scoreHand() {
    if (!G) return;
    // add the points once: reopening the addon with this dialog open must not count the hand again
    if (!G.scored) {
      const s0 = E.score(G.s);
      G.pts[0] += s0.total[0]; G.pts[1] += s0.total[1];
      G.scored = s0;
      if ((G.pts[0] >= G.target || G.pts[1] >= G.target) && G.pts[0] !== G.pts[1]) finishGame();
      save(true);
    }
    const sc = G.scored;
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
    $('aiHand').innerHTML = s.hands[AI].slice(reveal ? 1 : 0).map(() => backHTML()).join('');
    // table
    let tbl = '';
    for (const c of ghost ? s.table.concat(ghost) : s.table) {
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
  document.querySelectorAll('#speedSeg button').forEach((b) => { b.onclick = () => { settings().speed = b.dataset.v; FX.setSpeed(FX_SPEED[b.dataset.v]); renderSettings(); save(); }; });
  document.querySelectorAll('#themeSeg button').forEach((b) => { b.onclick = () => { settings().theme = b.dataset.v; renderSettings(); applyTheme(); save(); }; });
  document.querySelectorAll('.sw').forEach((s) => { s.onclick = () => { const S = settings(); S[s.dataset.k] = !S[s.dataset.k]; renderSettings(); if (!anim) renderBoard(); save(); }; });
  document.querySelectorAll('.sec-h').forEach((h) => { h.onclick = () => h.parentElement.classList.toggle('closed'); });
  $('newBtn').onclick = requestNew;
  const closeDrawer = () => $('app').classList.remove('drawer');
  $('menuBtn').onclick = () => $('app').classList.add('drawer');
  $('drawerClose').onclick = closeDrawer;
  $('main').addEventListener('pointerdown', (e) => { if (!e.target.closest('#menuBtn')) closeDrawer(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      for (const id of ['confirmDlg', 'endDlg']) if ($(id).classList.contains('show')) { $(id).classList.remove('show'); return; }
      closeDrawer();
      if (!anim) { sel = null; picks = new Set(); hintMv = null; renderBoard(); }
      return;
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
    FX.setSpeed(FX_SPEED[settings().speed]);
    applyTheme();
    renderUser();
    statLevel = settings().level;
    const saved = me().game;
    if (saved && saved.s && !saved.over) {
      G = saved;
      renderAll();
      if (G.s.turn === AI && (G.s.hands[0].length || G.s.hands[1].length)) later(aiTurn, delay());
      else if (!G.s.hands[0].length && !G.s.hands[1].length && !G.s.stock.length) scoreHand();   // shows the result, adds nothing twice
    } else newGame();
  }
  init();
})();
