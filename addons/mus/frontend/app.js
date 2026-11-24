/* Mus addon for Offlined — the panel. MIT licence. */
(function () {
  'use strict';

  const ID = 'mus';
  const C = window.SpanishCards, M = window.MusEngine;
  const $ = (id) => document.getElementById(id);
  const snd = (name, opts) => { try { window.GameSound.play(name, opts); } catch (_) {} };
  const params = new URLSearchParams(location.search);
  const SKIP_SOUNDS = [];
  const SPEED = { slow: 1500, normal: 950, fast: 450 };
  const LANCE_LABEL = { grande: 'Grande', chica: 'Chica', pares: 'Pares', juego: 'Juego', punto: 'Punto' };

  // ── Language ────────────────────────────────────────────────────────────────────────────────────────
  const I18N = window.MUS_I18N;
  let lang = (params.get('lang') || navigator.language || 'en').slice(0, 2).toLowerCase();
  if (!I18N[lang]) lang = 'en';
  const t = (k, vars) => {
    let s = I18N[lang][k] !== undefined ? I18N[lang][k] : I18N.en[k];
    if (vars && typeof s === 'string') for (const v in vars) s = s.split('{' + v + '}').join(vars[v]);
    return s;
  };
  const lvName = (l) => t('lv')[l - 1];
  const seatName = (p) => [t('you'), t('right'), t('partner'), t('left')][p];
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
  const DEFAULTS = { handHelp: true, sound: 'soft', speed: 'normal', theme: 'auto', level: 2, target: 30, kings: 8 };
  async function loadDB() {
    try {
      const r = await fetch(`/api/addons/${ID}/storage`, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      DB = (await r.json()).data;
    } catch (_) {
      storeMode = 'local';
      try { DB = JSON.parse(localStorage.getItem('ofl_mus') || '{}'); } catch (__) { DB = {}; }
    }
    if (!DB || typeof DB !== 'object') DB = {};
    DB.v = 1;
    DB.users = DB.users && typeof DB.users === 'object' ? DB.users : {};
  }
  function save(now) { clearTimeout(saveTimer); saveTimer = setTimeout(doSave, now ? 0 : 600); }
  function doSave() {
    if (!DB) return;
    if (storeMode === 'local') { try { localStorage.setItem('ofl_mus', JSON.stringify(DB)); } catch (_) {} return; }
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
  const statsOf = (l) => { const s = me().stats; return s[l] || (s[l] = { played: 0, won: 0, lost: 0, vacas: 0, ordagos: 0 }); };

  // ── Game ────────────────────────────────────────────────────────────────────────────────────────────
  // G: {level, g (engine game), helped}
  let G = null, aiTimer = null, disc = new Set(), amount = 2, statLevel = 2;
  const delay = () => SPEED[settings().speed] || 950;

  function newGame() {
    clearTimeout(aiTimer);
    const S = settings();
    G = { level: S.level, g: M.newGame({ target: S.target, reyes8: +S.kings === 8, dealer: 3 }), helped: false };
    statsOf(G.level).played++;
    M.newHand(G.g);
    handSounds();
    me().game = G;
    disc = new Set(); amount = 2;
    save();
    closeDrawer();
    step();
  }
  function requestNew() {
    if (G && !G.g.over && (G.g.score[0] + G.g.score[1] > 0 || G.g.vacas[0] + G.g.vacas[1] > 0)) $('confirmDlg').classList.add('show');
    else newGame();
  }
  $('confirmYes').onclick = () => { $('confirmDlg').classList.remove('show'); newGame(); };
  $('confirmNo').onclick = () => $('confirmDlg').classList.remove('show');

  function handSounds() { snd('shuffle'); snd('deal', { n: 8, delay: 0.55 }); }
  let lastTurn = -1;
  function step() {
    clearTimeout(aiTimer);
    if (!G) return;
    const g = G.g, h = g.hand;
    render();
    if (h.phase === 'conteo') { h.countRows = M.conteo(g); afterHand(); return; }
    if (h.phase === 'handEnd') { afterHand(); return; }
    if (h.turn === 0) { if (lastTurn !== 0 && lastTurn !== -1) snd('turn'); lastTurn = 0; return; } // waiting for you
    lastTurn = h.turn;
    aiTimer = setTimeout(() => {
      const p = h.turn;
      const d = M.decide(g, p, G.level);
      apply(p, d);
      step();
    }, delay());
  }
  function apply(p, d) {
    const g = G.g, h = g.hand;
    const before = h.lance ? h.lance.name : null;
    const fx = { envido: 'envido', quiero: 'quiero', noquiero: 'noquiero', ordago: 'ordago' }[d.type];
    if (fx) snd(fx);
    if (d.type === 'discard') { snd('take'); snd('deal', { n: Math.max(1, d.cards.length), delay: 0.25 }); }
    if (h.phase === 'mus') M.musDecision(g, p, d.type === 'mus');
    else if (h.phase === 'discard') M.discard(g, p, d.cards);
    else M.act(g, p, d);
    // a refused bet scores at once
    if (before && h.results[before] && h.results[before].status === 'noquiero' && d.type === 'noquiero') {
      const r = h.results[before];
      toast(t('deje', { who: r.team === 0 ? t('us') : t('them'), n: r.pts }));
    }
    if (h.ordago) banner(t('ordagoWon', { who: h.ordago.team === 0 ? t('us') : t('them') }));
    save();
  }
  function afterHand() {
    const g = G.g, h = g.hand;
    if (h.vacaEnded && !h.statsDone) {
      h.statsDone = true;
      if (h.vacaWinner === 0) statsOf(G.level).vacas++;
      if (h.ordago && h.ordago.team === 0) statsOf(G.level).ordagos++;
      if (g.over) {
        const s = statsOf(G.level), u = me();
        if (g.winner === 0) { s.won++; u.streak = G.helped ? 0 : u.streak + 1; } else { s.lost++; u.streak = 0; }
        u.game = null;
      }
      save(true);
    }
    render();
    setTimeout(showCount, 500);
  }

  // ── Count dialog ────────────────────────────────────────────────────────────────────────────────────
  function describe(hand, r8) {
    const pr = M.pares(hand, r8), j = M.juego(hand, r8), R = t('ranks');
    let a = pr.type === 0 ? t('paresNone') : pr.type === 1 ? t('pares1', { r: R[pr.ranks[0]] }) : pr.type === 2 ? t('pares2', { r: R[pr.ranks[0]] }) : t('pares3', { a: R[pr.ranks[0]], b: R[pr.ranks[1]] });
    const b = j.has ? t('juegoYes', { n: j.sum }) : t('puntoN', { n: j.sum });
    return a + ' · ' + b;
  }
  function statusText(res) {
    if (!res) return '—';
    if (res.status === 'quiero') return t('st_quiero', { n: res.stake });
    return t('st_' + res.status);
  }
  function showCount() {
    const g = G.g, h = g.hand, r8 = h.reyes8;
    $('countHands').innerHTML = [0, 2, 1, 3].map((p) => `<div class="ch"><div class="nm">${seatName(p)}${p === h.mano ? ' · mano' : ''}</div>` +
      `<div class="cards">${h.hands[p].map((c) => `<div class="card">${C.cardSVG(c)}</div>`).join('')}</div><div class="lbl2">${describe(h.hands[p], r8)}</div></div>`).join('');
    const counted = {};
    for (const r of h.countRows || []) counted[r.lance] = r;
    let rows = '';
    for (const name of ['grande', 'chica', 'pares', 'juego', 'punto']) {
      const res = h.results[name];
      if (!res) continue;
      const pts = [0, 0];
      if (res.status === 'noquiero') pts[res.team] += res.pts;
      if (counted[name]) pts[counted[name].team] += counted[name].pts;
      rows += `<tr><td>${LANCE_LABEL[name]}</td><td>${statusText(res)}</td><td>${pts[0] || '·'}</td><td>${pts[1] || '·'}</td></tr>`;
    }
    rows += `<tr class="tot"><td>${t('points', { n: g.target })}</td><td></td><td>${g.score[0]}</td><td>${g.score[1]}</td></tr>`;
    $('countRows').innerHTML = rows;
    let note = '';
    if (h.ordago) note = t('ordagoWon', { who: h.ordago.team === 0 ? t('us') : t('them') });
    if (h.vacaEnded) note += (note ? ' · ' : '') + t('vacaFor', { who: h.vacaWinner === 0 ? t('us') : t('them') });
    $('countNote').textContent = note;
    $('countNextTxt').textContent = g.over ? t('close') : h.vacaEnded ? t('nextVaca') : t('nextHand');
    let handPts = 0;
    for (const r of h.countRows || []) handPts += r.pts;
    for (const n in h.results) if (h.results[n].status === 'noquiero') handPts += h.results[n].pts;
    if (handPts) snd('tantos', { n: handPts, delay: 0.2 });
    if (h.vacaEnded && !g.over) snd('vaca', { delay: 0.3 + Math.min(handPts, 10) * 0.1 });
    $('countDlg').classList.add('show');
  }
  $('countNext').onclick = () => {
    $('countDlg').classList.remove('show');
    const g = G.g;
    if (g.over) { showEnd(); return; }
    M.nextHand(g);
    handSounds();
    disc = new Set(); amount = 2;
    save();
    step();
  };
  function showEnd() {
    const g = G.g, won = g.winner === 0;
    snd(won ? 'win' : 'lose');
    $('endTitle').textContent = won ? t('win') : t('loss');
    $('endSub').textContent = t('finalScore', { a: g.vacas[0], b: g.vacas[1], lv: lvName(G.level) }) + (G.helped ? ' · ' + t('withHelp') : '');
    $('endBadge').classList.toggle('lose', !won);
    renderStats();
    $('endDlg').classList.add('show');
  }
  $('endAgain').onclick = () => { $('endDlg').classList.remove('show'); newGame(); };
  $('endClose').onclick = () => $('endDlg').classList.remove('show');

  // ── Rendering ───────────────────────────────────────────────────────────────────────────────────────
  function render() {
    if (!G) return;
    const g = G.g, h = g.hand, r8 = h.reyes8;
    const reveal = h.phase === 'conteo' || h.phase === 'handEnd';
    for (let p = 0; p < 4; p++) {
      const el = $('seat' + p);
      el.classList.toggle('turn', !reveal && h.turn === p);
      el.querySelector('.mano').hidden = p !== h.mano;
      const said = h.said[p];
      const b = el.querySelector('.bubble');
      b.textContent = said ? t('said_' + said.what, { n: said.extra }) : '';
      b.classList.toggle('strong', !!said && (said.what === 'ordago' || said.what === 'envido'));
      if (p === 0) continue;
      el.querySelector('.cards').innerHTML = h.hands[p].map((c) => `<div class="card">${reveal ? C.cardSVG(c) : C.backSVG()}</div>`).join('');
      el.querySelector('.decl').textContent = h.decl.pares ? `Pares: ${h.decl.pares[p] ? t('declYes') : t('declNo')} · Juego: ${h.decl.juego[p] ? t('declYes') : t('declNo')}` : '';
    }
    // my cards
    $('myCards').innerHTML = h.hands[0].map((c) => `<div class="card${disc.has(c) ? ' disc' : ''}${h.phase === 'discard' && h.turn === 0 ? ' btn-card' : ''}" data-c="${c}">${C.cardSVG(c)}</div>`).join('');
    $('handInfo').textContent = settings().handHelp ? describe(h.hands[0], r8) : '';
    // lances
    const names = ['grande', 'chica', 'pares', h.results.punto || (h.lance && h.lance.name === 'punto') || (h.decl.juego && !h.decl.juego.some((x) => x)) ? 'punto' : 'juego'];
    $('lances').innerHTML = names.map((n) => {
      const now = h.lance && h.lance.name === n;
      let st = h.results[n] ? statusText(h.results[n]) : '';
      if (now) st = h.lance.ordago ? 'Órdago' : h.lance.bettor >= 0 ? t('said_envido', { n: h.lance.stake }) : '…';
      return `<div class="lchip${now ? ' now' : ''}"><b>${LANCE_LABEL[n]}</b><span>${st || '·'}</span></div>`;
    }).join('');
    // message
    let msg = '';
    if (reveal) msg = '';
    else if (h.turn === 0) msg = h.phase === 'discard' ? t('pickDiscard') : h.lance ? t('lanceNow', { l: LANCE_LABEL[h.lance.name] }) + ' · ' + t('yourTurn') : t('yourTurn');
    else msg = t('waiting', { who: seatName(h.turn) });
    $('centerMsg').textContent = msg;
    // score
    $('sbUs').textContent = g.score[0]; $('sbThem').textContent = g.score[1];
    const dots = (n) => Array.from({ length: g.vacasToWin }, (_, k) => `<i class="${k < n ? 'f' : ''}"></i>`).join('');
    $('vUs').innerHTML = dots(g.vacas[0]); $('vThem').innerHTML = dots(g.vacas[1]);
    $('sbInfo').textContent = t('points', { n: g.target }) + ' · ' + (r8 ? t('k8') : t('k4')) + ' · ' + lvName(G.level);
    $('infoUs').textContent = g.score[0] + ' · ' + t('vacas') + ' ' + g.vacas[0];
    $('infoThem').textContent = g.score[1] + ' · ' + t('vacas') + ' ' + g.vacas[1];
    $('infoMano').textContent = t('manoIs', { who: seatName(h.mano) });
    $('infoTarget').textContent = t('points', { n: g.target });
    renderActions();
  }
  function renderActions() {
    const g = G.g, h = g.hand, box = $('actions');
    let html = '';
    if (h.turn === 0 && h.phase !== 'conteo' && h.phase !== 'handEnd') {
      if (h.phase === 'mus') html = btn('mus', t('mus'), true) + btn('noMus', t('noMus'));
      else if (h.phase === 'discard') html = btn('discard', t('discardN', { n: disc.size }), true, !disc.size);
      else {
        const L = h.lance, leg = M.legal(g);
        const step = `<span class="stepper"><button data-a="minus">−</button><b id="amt">${amount}</b><button data-a="plus">+</button></span>`;
        if (L.bettor < 0) html = btn('paso', t('paso')) + btn('envido', t('envido', { n: amount }), true) + step + btn('ordago', t('ordago'));
        else {
          html = btn('quiero', t('quiero'), true) + btn('noquiero', t('noQuiero'));
          if (leg.includes('envido')) html += btn('envido', t('raise', { n: amount })) + step;
          if (leg.includes('ordago')) html += btn('ordago', t('ordago'));
        }
      }
      html += `<button class="btn" data-a="hint"><svg class="i"><use href="#i-bulb"/></svg>${t('hint')}</button>`;
    }
    box.innerHTML = html;
  }
  const btn = (a, label, cta, disabled) => `<button class="btn${cta ? ' cta' : ''}" data-a="${a}"${disabled ? ' disabled' : ''}>${label}</button>`;

  $('actions').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !G) return;
    const g = G.g, h = g.hand; if (h.turn !== 0) return;
    const a = b.dataset.a;
    if (a === 'minus') { amount = Math.max(2, amount - 1); renderActions(); return; }
    if (a === 'plus') { amount = Math.min(30, amount + 1); renderActions(); return; }
    if (a === 'hint') { showHint(); return; }
    let d;
    if (a === 'mus' || a === 'noMus') d = { type: a };
    else if (a === 'discard') { if (!disc.size) return; d = { type: 'discard', cards: [...disc] }; disc = new Set(); }
    else if (a === 'envido') d = { type: 'envido', n: amount };
    else d = { type: a };
    amount = 2;
    apply(0, d);
    step();
  });
  $('myCards').addEventListener('click', (e) => {
    const el = e.target.closest('.card'); if (!el || !G) return;
    const h = G.g.hand; if (h.phase !== 'discard' || h.turn !== 0) return;
    const c = +el.dataset.c;
    if (disc.has(c)) disc.delete(c); else disc.add(c);
    render();
  });
  function showHint() {
    const g = G.g, h = g.hand;
    const d = M.decide(g, 0, 4);
    let text;
    if (d.type === 'discard') { disc = new Set(d.cards); text = t('discardN', { n: d.cards.length }); }
    else if (d.type === 'mus') text = t('mus');
    else if (d.type === 'noMus') text = t('noMus');
    else if (d.type === 'envido') { amount = d.n; text = h.lance.bettor < 0 ? t('envido', { n: d.n }) : t('raise', { n: d.n }); }
    else text = { paso: t('paso'), quiero: t('quiero'), noquiero: t('noQuiero'), ordago: t('ordago') }[d.type];
    const first = !G.helped; G.helped = true;
    render(); save();
    toast(t('hintText', { a: text }) + (first ? ' ' + t('helpNote') : ''));
  }

  function renderLevels() {
    const S = settings();
    document.querySelectorAll('#levels .lvl').forEach((b, k) => b.classList.toggle('on', k + 1 === S.level));
    document.querySelectorAll('#targetSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === +S.target));
    document.querySelectorAll('#kingsSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === +S.kings));
  }
  function renderStats() {
    document.querySelectorAll('#statTabs button').forEach((b, k) => b.classList.toggle('on', k + 1 === statLevel));
    const s = statsOf(statLevel);
    $('stW').textContent = s.won; $('stL').textContent = s.lost; $('stV').textContent = s.vacas; $('stO').textContent = s.ordagos;
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
    const av = $('avatar');
    av.style.background = USER.color || '#6b7280';
    if (USER.photo && USER.id) av.innerHTML = `<img alt="" src="/api/users/${encodeURIComponent(USER.id)}/avatar">`;
    else av.textContent = (name.trim()[0] || '?').toUpperCase();
  }

  let bannerTimer = null, toastTimer = null;
  function banner(text) { const b = $('banner'); b.textContent = text; b.classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 1600); }
  function toast(text) { const el = $('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200); }

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
  document.querySelectorAll('#kingsSeg button').forEach((b) => { b.onclick = () => { settings().kings = +b.dataset.v; renderLevels(); save(); }; });
  document.querySelectorAll('#speedSeg button').forEach((b) => { b.onclick = () => { settings().speed = b.dataset.v; renderSettings(); save(); }; });
  document.querySelectorAll('#themeSeg button').forEach((b) => { b.onclick = () => { settings().theme = b.dataset.v; renderSettings(); applyTheme(); save(); }; });
  document.querySelectorAll('.sw').forEach((s) => { s.onclick = () => { const S = settings(); S[s.dataset.k] = !S[s.dataset.k]; renderSettings(); if (G) render(); save(); }; });
  document.querySelectorAll('.sec-h').forEach((h) => { h.onclick = () => h.parentElement.classList.toggle('closed'); });
  $('newBtn').onclick = requestNew;
  const closeDrawer = () => $('app').classList.remove('drawer');
  $('menuBtn').onclick = () => $('app').classList.add('drawer');
  $('drawerClose').onclick = closeDrawer;
  $('main').addEventListener('pointerdown', (e) => { if (!e.target.closest('#menuBtn')) closeDrawer(); });
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
    renderUser(); renderLevels(); renderSettings();
    statLevel = settings().level;
    renderStats();
    const saved = me().game;
    if (saved && saved.g && saved.g.hand && !saved.g.over) { G = saved; step(); }
    else newGame();
  }
  init();
})();
