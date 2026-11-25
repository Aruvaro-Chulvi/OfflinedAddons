/* QR Generator addon for Offlined — the panel. MIT licence. */
(function () {
  'use strict';

  const ID = 'qr-generator';
  const Q = window.QREngine, R = window.QRRender;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  // ── Language ────────────────────────────────────────────────────────────────────────────────────────
  const I18N = window.QR_I18N;
  let lang = (params.get('lang') || navigator.language || 'en').slice(0, 2).toLowerCase();
  if (!I18N[lang]) lang = 'en';
  const t = (k, vars) => {
    let s = I18N[lang][k] !== undefined ? I18N[lang][k] : I18N.en[k];
    if (s === undefined) s = k;
    if (vars) for (const v in vars) s = s.split('{' + v + '}').join(vars[v]);
    return s;
  };
  document.documentElement.lang = lang;
  if (lang === 'ar') document.documentElement.dir = 'rtl';
  function applyTexts() {
    document.title = t('appName');
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-tt]').forEach((el) => { el.title = t(el.dataset.tt); el.setAttribute('aria-label', t(el.dataset.tt)); });
    document.querySelectorAll('#tabs button').forEach((b) => { b.title = b.textContent.trim(); });
    $('search').placeholder = t('search');
    $('nameIn').placeholder = t('namePh');
    $('caption').placeholder = t('captionPh');
    document.querySelectorAll('#eccSeg button').forEach((b) => { b.innerHTML = ''; b.append(b.dataset.v); const s = document.createElement('small'); s.textContent = t('ecc_' + b.dataset.v); b.append(s); });
  }

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

  // ── Storage (one section per Offlined user) ─────────────────────────────────────────────────────────
  const DEF_SETTINGS = { theme: 'auto', size: 1024 };
  const DEF_DESIGN = { fg: '#000000', bg: '#ffffff', fg2: '#4b5563', gradient: false, gradDir: 'diag', transparent: false, eyeSame: true, eyeColor: '#000000',
    body: 'square', eyes: 'square', margin: 4, ecl: 'M', caption: '', logo: null };
  async function loadDB() {
    try {
      const r = await fetch(`/api/addons/${ID}/storage`, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      DB = (await r.json()).data;
    } catch (_) {
      storeMode = 'local';
      try { DB = JSON.parse(localStorage.getItem('ofl_qr') || '{}'); } catch (__) { DB = {}; }
    }
    if (!DB || typeof DB !== 'object') DB = {};
    DB.v = 1;
    DB.users = DB.users && typeof DB.users === 'object' ? DB.users : {};
  }
  function save(now) { clearTimeout(saveTimer); saveTimer = setTimeout(doSave, now ? 0 : 600); }
  function doSave() {
    if (!DB) return;
    if (storeMode === 'local') { try { localStorage.setItem('ofl_qr', JSON.stringify(DB)); } catch (_) {} return; }
    const body = JSON.stringify({ data: DB });
    fetch(`/api/addons/${ID}/storage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: body.length < 60000 }).catch(() => {});
  }
  window.addEventListener('pagehide', () => { if (saveTimer) { clearTimeout(saveTimer); doSave(); } });
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
    if (!u.settings || typeof u.settings !== 'object') u.settings = {};
    for (const k in DEF_SETTINGS) if (!(k in u.settings)) u.settings[k] = DEF_SETTINGS[k];   // same object every call
    u.items = Array.isArray(u.items) ? u.items : [];
    return u;
  }
  const settings = () => (DB ? me().settings : DEF_SETTINGS);

  // ── Items ───────────────────────────────────────────────────────────────────────────────────────────
  // item: {id, name, type, fields: {<type>: {...}}, design, created, updated}
  let cur = null;           // item being edited (may be a draft not yet in the list)
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function newItem(type) {
    const last = me().items[0];
    const design = Object.assign({}, DEF_DESIGN, last ? JSON.parse(JSON.stringify(last.design)) : {}, { caption: '' });
    return { id: newId(), name: '', type: type || 'url', fields: {}, design, created: Date.now(), updated: Date.now() };
  }
  const fieldsOf = (it) => it.fields[it.type] || (it.fields[it.type] = defaultFields(it.type));
  function defaultFields(type) {
    if (type === 'wifi') return { security: 'WPA' };
    return {};
  }
  const payloadOf = (it) => R.payload(it.type, fieldsOf(it));
  const inList = (it) => me().items.indexOf(it) >= 0;

  function autoName(it) {
    const f = fieldsOf(it);
    switch (it.type) {
      case 'url': { const u = String(f.url || '').trim(); return u.replace(/^[a-z]+:\/\//i, '').replace(/\/$/, '').slice(0, 40); }
      case 'wifi': return f.ssid ? 'Wi‑Fi · ' + f.ssid : '';
      case 'vcard': return [f.first, f.last].filter(Boolean).join(' ') || f.org || '';
      case 'email': return f.to || '';
      case 'phone': case 'sms': case 'whatsapp': return f.number ? t('t_' + it.type) + ' · ' + f.number : '';
      case 'geo': return f.lat && f.lon ? t('t_geo') + ' · ' + f.lat + ', ' + f.lon : '';
      case 'event': return f.summary || '';
      case 'text': return String(f.text || '').split('\n')[0].slice(0, 40);
    }
    return '';
  }
  const displayName = (it) => (it.name || '').trim() || autoName(it) || t('untitled');

  // Draft enters the list as soon as it has content; after that every change is saved.
  function touch() {
    if (!cur) return;
    cur.updated = Date.now();
    if (!inList(cur)) {
      if (!payloadOf(cur)) { renderPreview(); return; }
      me().items.unshift(cur);
    }
    me().current = cur.id;
    save();
    flashSaved();
    renderPreview();
    renderList();
  }
  let savedTimer = null;
  function flashSaved() { $('savedMark').hidden = false; clearTimeout(savedTimer); savedTimer = setTimeout(() => { $('savedMark').hidden = true; }, 1500); }

  function open(it) {
    cur = it;
    if (inList(it)) { me().current = it.id; save(); }
    $('nameIn').value = it.name || '';
    $('nameIn').placeholder = autoName(it) || t('namePh');
    renderTypes(); renderFields(); renderDesign(); renderPreview(); renderList();
    closeDrawer();
  }

  // ── Sidebar list ────────────────────────────────────────────────────────────────────────────────────
  const thumbCache = new Map();
  function thumbSvg(it) {
    const key = it.id + ':' + it.updated;
    if (thumbCache.has(key)) return thumbCache.get(key);
    let s = '';
    const p = payloadOf(it);
    if (p) { try { s = R.svg(Q.encode(p, { ecl: it.design.logo ? 'H' : it.design.ecl }), Object.assign({}, it.design, { caption: '', margin: 1 })).svg; } catch (_) {} }
    thumbCache.set(key, s);
    return s;
  }
  const fmtDate = (ms) => { try { return new Date(ms).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return ''; } };
  function renderList() {
    const q = $('search').value.trim().toLowerCase();
    const list = $('list');
    list.innerHTML = '';
    const items = me().items.filter((it) => !q || (displayName(it) + ' ' + payloadOf(it)).toLowerCase().indexOf(q) >= 0);
    if (!items.length) {
      const d = document.createElement('div'); d.className = 'empty-list'; d.textContent = me().items.length ? t('noMatch') : t('emptyList'); list.append(d);
      return;
    }
    for (const it of items) {
      const b = document.createElement('button');
      b.className = 'item' + (cur && cur.id === it.id ? ' on' : '');
      const th = document.createElement('span'); th.className = 'th';
      const s = thumbSvg(it);
      if (s) th.innerHTML = s; else th.innerHTML = '<svg class="i"><use href="#i-qr"/></svg>';
      if (it.design.transparent) th.style.background = '#fff';
      else th.style.background = it.design.bg;
      const tx = document.createElement('span'); tx.className = 'tx';
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = displayName(it);
      const mt = document.createElement('div'); mt.className = 'mt';
      mt.innerHTML = '<svg class="i"><use href="#i-' + R.TYPES[it.type].icon + '"/></svg>';
      mt.append(t('t_' + it.type) + ' · ' + fmtDate(it.updated));
      tx.append(nm, mt);
      b.append(th, tx);
      b.title = displayName(it);
      b.onclick = () => open(it);
      list.append(b);
    }
  }

  // ── Type chips + fields ─────────────────────────────────────────────────────────────────────────────
  const FIELD = {
    text: { kind: 'textarea', full: true, ph: 'ph_text', big: true },
    url: { kind: 'url', full: true, ph: 'ph_url' },
    ssid: { kind: 'text', full: true }, security: { kind: 'select', opts: ['WPA', 'WEP', 'nopass'] }, password: { kind: 'password' }, hidden: { kind: 'check', full: true },
    first: { kind: 'text' }, last: { kind: 'text' }, org: { kind: 'text' }, title: { kind: 'text' }, mobile: { kind: 'tel', ph: 'ph_number' }, phone: { kind: 'tel' },
    email: { kind: 'email', ph: 'ph_email' }, web: { kind: 'url', ph: 'ph_url' }, street: { kind: 'text', full: true }, zip: { kind: 'text' }, city: { kind: 'text' },
    region: { kind: 'text' }, country: { kind: 'text' }, note: { kind: 'textarea', full: true },
    to: { kind: 'email', full: true, ph: 'ph_email' }, subject: { kind: 'text', full: true }, body: { kind: 'textarea', full: true },
    number: { kind: 'tel', full: true, ph: 'ph_number' }, message: { kind: 'textarea', full: true },
    lat: { kind: 'num', ph: 'ph_lat' }, lon: { kind: 'num', ph: 'ph_lon' },
    summary: { kind: 'text', full: true }, location: { kind: 'text', full: true }, allDay: { kind: 'check', full: true },
    start: { kind: 'when' }, end: { kind: 'when' }, description: { kind: 'textarea', full: true },
  };
  function renderTypes() {
    const box = $('types');
    box.innerHTML = '';
    for (const type of Object.keys(R.TYPES)) {
      const b = document.createElement('button');
      b.className = 'type' + (cur.type === type ? ' on' : '');
      b.innerHTML = '<svg class="i"><use href="#i-' + R.TYPES[type].icon + '"/></svg>';
      const s = document.createElement('span'); s.textContent = t('t_' + type); b.append(s);
      b.onclick = () => { if (cur.type === type) return; cur.type = type; renderTypes(); renderFields(); touch(); $('nameIn').placeholder = autoName(cur) || t('namePh'); };
      box.append(b);
    }
  }
  function renderFields() {
    const f = fieldsOf(cur);
    $('typeHelp').textContent = t('h_' + cur.type);
    const box = $('fields');
    box.innerHTML = '';
    const changed = () => { $('nameIn').placeholder = autoName(cur) || t('namePh'); touch(); };
    for (const key of R.TYPES[cur.type].fields) {
      const def = FIELD[key];
      if (cur.type === 'wifi' && key === 'password' && f.security === 'nopass') continue;
      const wrap = document.createElement('label');
      wrap.className = 'field' + (def.full ? ' full' : '') + (def.kind === 'check' ? ' check' : '');
      const lab = document.createElement('span'); lab.textContent = t('f_' + key);
      wrap.append(lab);
      let input;
      if (def.kind === 'check') {
        input = document.createElement('button'); input.type = 'button';
        input.className = 'sw' + (f[key] ? ' on' : '');
        input.onclick = (e) => { e.preventDefault(); f[key] = !f[key]; input.classList.toggle('on', !!f[key]); if (key === 'allDay') renderFields(); changed(); };
        wrap.append(input);
        box.append(wrap);
        continue;
      }
      if (def.kind === 'select') {
        input = document.createElement('select');
        for (const o of def.opts) { const op = document.createElement('option'); op.value = o; op.textContent = t('sec_' + o); input.append(op); }
        input.value = f[key] || def.opts[0];
        input.onchange = () => { f[key] = input.value; if (key === 'security') renderFields(); changed(); };
        wrap.append(input);
        box.append(wrap);
        continue;
      }
      if (def.kind === 'textarea') {
        input = document.createElement('textarea');
        if (def.big) input.rows = 6;
      } else {
        input = document.createElement('input');
        input.type = { url: 'text', tel: 'tel', email: 'email', num: 'text', password: 'password', when: f.allDay ? 'date' : 'datetime-local' }[def.kind] || 'text';
        if (def.kind === 'num') input.inputMode = 'decimal';
        if (def.kind === 'url') { input.inputMode = 'url'; input.autocapitalize = 'off'; }
        input.autocomplete = 'off';
        input.spellcheck = false;
      }
      if (def.ph) input.placeholder = t(def.ph);
      let val = f[key] == null ? '' : String(f[key]);
      if (def.kind === 'when' && val) val = f.allDay ? val.slice(0, 10) : (val.length === 10 ? val + 'T09:00' : val);
      input.value = val;
      input.oninput = () => { f[key] = input.value; changed(); if (def.big) updateCount(); };
      if (def.kind === 'password') {
        const row = document.createElement('div'); row.className = 'pw';
        const eye = document.createElement('button'); eye.type = 'button'; eye.className = 'icon-btn'; eye.title = t('showPwd');
        eye.innerHTML = '<svg class="i"><use href="#i-eye"/></svg>';
        eye.onclick = (e) => { e.preventDefault(); input.type = input.type === 'password' ? 'text' : 'password'; };
        row.append(input, eye); wrap.append(row);
      } else wrap.append(input);
      if (def.big) { const c = document.createElement('div'); c.className = 'count'; c.id = 'textCount'; wrap.append(c); }
      box.append(wrap);
    }
    updateCount();
  }
  function updateCount() {
    const c = $('textCount');
    if (!c) return;
    const n = [...String(fieldsOf(cur).text || '')].length;
    c.textContent = n ? n + ' · ' + (lastInfo && lastInfo.ok ? t('fill', { p: lastInfo.pct }) : '') : '';
  }

  // ── Design controls ─────────────────────────────────────────────────────────────────────────────────
  const PRESETS = {
    classic: { fg: '#000000', bg: '#ffffff', gradient: false, eyeSame: true, body: 'square', eyes: 'square' },
    soft:    { fg: '#2d2d2d', bg: '#ffffff', gradient: false, eyeSame: true, body: 'rounded', eyes: 'rounded' },
    dots:    { fg: '#1f1f1f', bg: '#ffffff', gradient: false, eyeSame: true, body: 'dots', eyes: 'circle' },
    ink:     { fg: '#1e3a8a', bg: '#ffffff', fg2: '#5b21b6', gradient: true, gradDir: 'diag', eyeSame: true, body: 'rounded', eyes: 'leaf' },
    forest:  { fg: '#14532d', bg: '#f3f7f1', gradient: false, eyeSame: false, eyeColor: '#3f6212', body: 'thin', eyes: 'rounded' },
    sunset:  { fg: '#9f1239', bg: '#fffaf5', fg2: '#9a3412', gradient: true, gradDir: 'vert', eyeSame: true, body: 'dots', eyes: 'circle' },
  };
  const BODIES = ['square', 'rounded', 'dots', 'thin', 'diamond'];
  const EYES = ['square', 'rounded', 'circle', 'leaf'];
  let sample = null;
  const sampleQR = () => sample || (sample = Q.encode('Offlined', { ecl: 'L', mask: 2 }));

  function buildDesignStatic() {
    const pbox = $('presets');
    for (const k of Object.keys(PRESETS)) {
      const b = document.createElement('button'); b.className = 'preset'; b.dataset.k = k;
      b.innerHTML = R.svg(sampleQR(), Object.assign({}, DEF_DESIGN, PRESETS[k], { margin: 1 })).svg;
      const s = document.createElement('span'); s.dataset.t = 'pr_' + k; b.append(s);
      b.onclick = () => { Object.assign(cur.design, PRESETS[k]); if (!PRESETS[k].fg2) cur.design.fg2 = DEF_DESIGN.fg2; renderDesign(); touch(); };
      pbox.append(b);
    }
    const bbox = $('bodySeg');
    for (const k of BODIES) {
      const b = document.createElement('button'); b.className = 'shape'; b.dataset.v = k;
      b.innerHTML = R.svg(sampleQR(), Object.assign({}, DEF_DESIGN, { fg: 'currentColor', transparent: true, body: k, margin: 0 })).svg.replace(/viewBox="[^"]*"/, 'viewBox="7 7 7 7"');
      const s = document.createElement('span'); s.dataset.t = 'body_' + k; b.append(s);
      b.onclick = () => { cur.design.body = k; renderDesign(); touch(); };
      bbox.append(b);
    }
    const ebox = $('eyeSeg');
    for (const k of EYES) {
      const b = document.createElement('button'); b.className = 'shape'; b.dataset.v = k;
      b.innerHTML = R.svg(sampleQR(), Object.assign({}, DEF_DESIGN, { fg: 'currentColor', transparent: true, eyes: k, margin: 0 })).svg.replace(/viewBox="[^"]*"/, 'viewBox="-0.5 -0.5 8 8"');
      const s = document.createElement('span'); s.dataset.t = 'eyes_' + k; b.append(s);
      b.onclick = () => { cur.design.eyes = k; renderDesign(); touch(); };
      ebox.append(b);
    }
    const color = (id, key) => { $(id).oninput = () => { cur.design[key] = $(id).value; renderDesignState(); touch(); }; };
    color('cFg', 'fg'); color('cFg2', 'fg2'); color('cBg', 'bg'); color('cEye', 'eyeColor');
    document.querySelectorAll('.card .sw[data-k]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.k, d = cur.design;
        if (k === 'logoPad' || k === 'logoRound') { if (!d.logo) return; const p = k === 'logoPad' ? 'pad' : 'round'; d.logo[p] = d.logo[p] === undefined ? (p === 'pad' ? false : true) : !d.logo[p]; }
        else d[k] = !d[k];
        renderDesignState(); touch();
      };
    });
    document.querySelectorAll('#gradSeg button').forEach((b) => { b.onclick = () => { cur.design.gradDir = b.dataset.v; renderDesignState(); touch(); }; });
    document.querySelectorAll('#eccSeg button').forEach((b) => { b.onclick = () => { if (cur.design.logo) return; cur.design.ecl = b.dataset.v; renderDesignState(); touch(); }; });
    $('margin').oninput = () => { cur.design.margin = +$('margin').value; $('marginVal').textContent = $('margin').value; touch(); };
    $('caption').oninput = () => { cur.design.caption = $('caption').value; touch(); };
    $('logoSize').oninput = () => { if (cur.design.logo) { cur.design.logo.size = +$('logoSize').value / 100; touch(); } };
    $('logoAdd').onclick = () => $('logoFile').click();
    $('logoDel').onclick = () => { cur.design.logo = null; renderDesign(); touch(); };
    $('logoFile').onchange = () => { const file = $('logoFile').files[0]; $('logoFile').value = ''; if (file) loadLogo(file); };
    $('resetDesign').onclick = () => { cur.design = Object.assign({}, DEF_DESIGN); renderDesign(); touch(); };
  }
  function loadLogo(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 240, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let src = c.toDataURL('image/webp', 0.9);
      if (src.indexOf('data:image/webp') !== 0) src = c.toDataURL('image/png');
      cur.design.logo = { src, size: 0.22, pad: true, round: false };
      renderDesign(); touch();
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast(t('imgTooBig'), true); };
    img.src = url;
  }
  function renderDesign() {
    const d = cur.design;
    $('cFg').value = d.fg; $('cFg2').value = d.fg2 || DEF_DESIGN.fg2; $('cBg').value = d.bg; $('cEye').value = d.eyeColor || d.fg;
    $('margin').value = d.margin; $('marginVal').textContent = d.margin;
    $('caption').value = d.caption || '';
    renderDesignState();
  }
  function renderDesignState() {
    const d = cur.design;
    const sw = (k, on) => { const b = document.querySelector('.card .sw[data-k="' + k + '"]'); if (b) b.classList.toggle('on', !!on); };
    sw('gradient', d.gradient); sw('transparent', d.transparent); sw('eyeSame', d.eyeSame !== false);
    sw('logoPad', d.logo && d.logo.pad !== false); sw('logoRound', d.logo && d.logo.round);
    $('gradSeg').hidden = !d.gradient;
    $('cFg2Wrap').classList.toggle('off', !d.gradient);
    $('cBgWrap').classList.toggle('off', !!d.transparent);
    $('cEyeWrap').classList.toggle('off', d.eyeSame !== false);
    document.querySelectorAll('#gradSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === (d.gradDir || 'diag')));
    const ecl = d.logo ? 'H' : d.ecl;
    document.querySelectorAll('#eccSeg button').forEach((b) => { b.classList.toggle('on', b.dataset.v === ecl); b.disabled = !!d.logo && b.dataset.v !== 'H'; });
    document.querySelectorAll('#bodySeg .shape').forEach((b) => b.classList.toggle('on', b.dataset.v === d.body));
    document.querySelectorAll('#eyeSeg .shape').forEach((b) => b.classList.toggle('on', b.dataset.v === d.eyes));
    document.querySelectorAll('#presets .preset').forEach((b) => {
      const p = PRESETS[b.dataset.k];
      b.classList.toggle('on', Object.keys(p).every((k) => k === 'fg2' && !d.gradient ? true : String(d[k]) === String(p[k]) || (k === 'eyeColor' && d.eyeSame !== false)));
    });
    $('logoOpts').hidden = !d.logo;
    $('logoDel').hidden = !d.logo;
    $('logoPrev').innerHTML = d.logo ? '<img alt="" src="' + d.logo.src + '">' : '<svg class="i"><use href="#i-image"/></svg>';
    if (d.logo) $('logoSize').value = Math.round((d.logo.size || 0.22) * 100);
  }

  // ── Preview ─────────────────────────────────────────────────────────────────────────────────────────
  let lastInfo = null, lastQR = null;
  function currentQR() {
    const p = payloadOf(cur);
    if (!p) return { empty: true };
    try { return { qr: Q.encode(p, { ecl: cur.design.logo ? 'H' : cur.design.ecl }), payload: p }; }
    catch (e) { return { tooLong: true, payload: p }; }
  }
  function renderPreview() {
    const r = currentQR();
    const box = $('qrBox'), emp = $('qrEmpty'), warns = $('warns');
    warns.innerHTML = '';
    $('payload').textContent = r.payload || '';
    $('payloadBtn').hidden = !r.payload;
    if (!r.payload) showPayload(false);
    const exp = ['pngBtn', 'svgBtn', 'copyBtn', 'printBtn'];
    lastQR = r.qr || null;
    if (!r.qr) {
      lastInfo = null;
      box.hidden = true; emp.hidden = false;
      emp.classList.toggle('err', !!r.tooLong);
      $('qrEmptyTxt').textContent = r.tooLong ? t('tooLong') : t('empty');
      $('qrInfo').textContent = '';
      exp.forEach((id) => { $(id).disabled = true; });
      updateCount();
      return;
    }
    exp.forEach((id) => { $(id).disabled = false; });
    const q = r.qr, d = cur.design;
    box.hidden = false; emp.hidden = true;
    box.parentElement.classList.toggle('checker', !!d.transparent);
    box.innerHTML = R.svg(q, d).svg;
    lastInfo = { ok: true, pct: Math.round((q.dataBits / q.capacityBits) * 100) };
    const W = q.size + 2 * (d.margin == null ? 4 : d.margin);
    const cm = Math.max(1.5, Math.ceil(W * 0.045 * 2) / 2);   // ~0.45 mm per module
    $('qrInfo').textContent = t('info', { v: q.version, n: q.size, e: q.ecl }) + ' · ' + t('fill', { p: lastInfo.pct });
    $('qrInfo').title = t('minPrint', { cm: cm.toLocaleString(lang) });
    const c = R.contrast(d);
    const warn = (txt) => { const w = document.createElement('div'); w.className = 'warn'; w.innerHTML = '<svg class="i"><use href="#i-alert"/></svg>'; const s = document.createElement('span'); s.textContent = txt; w.append(s); warns.append(w); };
    if (c.inverted) warn(t('warnInverted'));
    else if (c.ratio < 3.2) warn(t('warnContrast'));
    const tip = document.createElement('div'); tip.className = 'info'; tip.textContent = t('minPrint', { cm: cm.toLocaleString(lang) }); warns.append(tip);
    updateCount();
  }

  // ── Export ──────────────────────────────────────────────────────────────────────────────────────────
  const fileBase = () => (displayName(cur).replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60) || 'QR') ;
  async function saveFile(blob, filename) {
    try {
      const fd = new FormData();
      fd.append('file', blob, filename);
      fd.append('filename', filename);
      const r = await fetch('/api/exports/save-file', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      toast(t('savedTo', { f: j.name || filename }));
    } catch (_) {
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        toast(t('downloaded', { f: filename }));
      } catch (__) { toast(t('exportFail'), true); }
    }
  }
  async function pngBlob() {
    const o = R.svg(lastQR, cur.design);
    return R.png(o.svg, o.w, o.h, settings().size || 1024);
  }
  $('pngBtn').onclick = async () => { if (!lastQR) return; try { saveFile(await pngBlob(), fileBase() + '.png'); } catch (_) { toast(t('exportFail'), true); } };
  $('svgBtn').onclick = () => {
    if (!lastQR) return;
    const o = R.svg(lastQR, cur.design, { px: settings().size || 1024 });
    saveFile(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + o.svg], { type: 'image/svg+xml' }), fileBase() + '.svg');
  };
  $('copyBtn').onclick = async () => {
    if (!lastQR) return;
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob() })]);
      toast(t('copied'));
    } catch (_) { toast(t('copyFail'), true); }
  };
  // Size menu (applies to PNG, copy and the SVG's width/height)
  const sizeMenu = $('sizeMenu');
  $('sizeBtn').onclick = (e) => { e.stopPropagation(); sizeMenu.classList.toggle('show'); };
  sizeMenu.querySelectorAll('button').forEach((b) => { b.onclick = () => { settings().size = +b.dataset.v; renderSettings(); save(); sizeMenu.classList.remove('show'); }; });
  // What the code contains
  function showPayload(on) { $('payloadPop').classList.toggle('show', !!on); $('payloadBtn').classList.toggle('on', !!on); }
  $('payloadBtn').onclick = (e) => { e.stopPropagation(); showPayload(!$('payloadPop').classList.contains('show')); };
  $('payloadClose').onclick = () => showPayload(false);
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#sizeMenu, #sizeBtn')) sizeMenu.classList.remove('show');
    if (!e.target.closest('#payloadPop, #payloadBtn')) showPayload(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { sizeMenu.classList.remove('show'); showPayload(false); } });

  // Print
  let printN = 1, printCap = true;
  $('printBtn').onclick = () => {
    if (!lastQR) return;
    document.querySelectorAll('#printOpts .popt').forEach((b) => b.classList.toggle('on', +b.dataset.v === printN));
    $('printCap').classList.toggle('on', printCap);
    $('printDlg').classList.add('show');
  };
  document.querySelectorAll('#printOpts .popt').forEach((b) => { b.onclick = () => { printN = +b.dataset.v; document.querySelectorAll('#printOpts .popt').forEach((x) => x.classList.toggle('on', x === b)); }; });
  $('printCap').onclick = () => { printCap = !printCap; $('printCap').classList.toggle('on', printCap); };
  $('printNo').onclick = () => $('printDlg').classList.remove('show');
  $('printGo').onclick = () => {
    $('printDlg').classList.remove('show');
    const area = $('printArea');
    area.innerHTML = '';
    const sheet = document.createElement('div'); sheet.className = 'p-sheet n' + printN;
    const svgStr = R.svg(lastQR, cur.design).svg;
    for (let i = 0; i < printN; i++) {
      const c = document.createElement('div'); c.className = 'p-cell';
      c.innerHTML = svgStr;
      if (printCap && !(cur.design.caption || '').trim()) { const n = document.createElement('div'); n.textContent = displayName(cur); c.append(n); }
      sheet.append(c);
    }
    area.append(sheet);
    setTimeout(() => { window.print(); }, 50);
  };
  window.addEventListener('afterprint', () => { $('printArea').innerHTML = ''; });

  // ── Toast & confirm ─────────────────────────────────────────────────────────────────────────────────
  let toastTimer = null;
  function toast(text, err) {
    $('toastTxt').textContent = text;
    $('toast').classList.toggle('err', !!err);
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3500);
  }
  function confirmBox(text, onYes) {
    $('confirmTxt').textContent = text;
    $('confirmDlg').classList.add('show');
    $('confirmNo').onclick = () => $('confirmDlg').classList.remove('show');
    $('confirmYes').onclick = () => { $('confirmDlg').classList.remove('show'); onYes(); };
  }
  document.querySelectorAll('.overlay').forEach((o) => o.addEventListener('pointerdown', (e) => { if (e.target === o) o.classList.remove('show'); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')); });

  // ── Top bar & sidebar actions ───────────────────────────────────────────────────────────────────────
  $('nameIn').oninput = () => { cur.name = $('nameIn').value; touch(); };
  $('newBtn').onclick = () => open(newItem(cur ? cur.type : 'url'));
  $('dupBtn').onclick = () => {
    if (!cur || !inList(cur)) return;
    const c = JSON.parse(JSON.stringify(cur));
    c.id = newId(); c.created = c.updated = Date.now();
    c.name = displayName(cur) + ' (2)';
    me().items.unshift(c);
    save(); open(c);
  };
  $('delBtn').onclick = () => {
    if (!cur) return;
    if (!inList(cur)) { open(newItem(cur.type)); return; }
    confirmBox(t('confirmDelete', { n: displayName(cur) }), () => {
      const items = me().items, i = items.indexOf(cur);
      items.splice(i, 1);
      save(true);
      open(items[Math.min(i, items.length - 1)] || newItem(cur.type));
    });
  };
  $('search').oninput = renderList;
  document.querySelector('#setSec .sec-h').onclick = () => $('setSec').classList.toggle('closed');
  document.querySelectorAll('#themeSeg button').forEach((b) => { b.onclick = () => { settings().theme = b.dataset.v; renderSettings(); applyTheme(); save(); }; });
  function renderSettings() {
    document.querySelectorAll('#themeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === settings().theme));
    const size = +settings().size || 1024;
    sizeMenu.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === size));
    $('sizeVal').textContent = size;
  }

  // ── Layout: three zones, two zones (tabbed panel + QR) or stacked, by the width actually available ──────
  const app = $('app'), main = $('main');
  const phone = matchMedia('(max-width: 760px)');
  let mode = '', tab = 'style';
  function setTab(name) {
    if (name === 'content' && mode === 'wide') name = settings().tab && settings().tab !== 'content' ? settings().tab : 'style';
    tab = name;
    document.querySelectorAll('#tabs button').forEach((b) => { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === name));
    const titles = { content: 'content', style: 'presets', colors: 'colors', shapes: 'shapes', logo: 'logo', text: 'textMargin', ecc: 'ecc' };
    $('paneTitle').textContent = t(titles[name]);
    $('resetDesign').hidden = name === 'content';
    $('paneHead').hidden = name === 'content';
  }
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.setAttribute('role', 'tab');
    b.onclick = () => { setTab(b.dataset.tab); if (DB) { settings().tab = tab; save(); } };
  });
  function layout() {
    const w = main.clientWidth;
    const m = w >= 980 ? 'wide' : w >= 620 ? 'mid' : 'narrow';
    app.classList.toggle('compact', w < 860);
    app.classList.toggle('tiny', w < 520);
    if (m === mode) return;
    const was = mode;
    mode = m;
    app.classList.remove('wide', 'mid', 'narrow');
    app.classList.add(m);
    const body = $('contentBody');
    if (m === 'wide') { $('contentZone').append(body); if (tab === 'content' || !was) setTab('content'); }
    else { $('contentPane').append(body); if (was === 'wide' || !was) setTab('content'); }
  }
  new ResizeObserver(layout).observe(main);

  // Sidebar: folded to thumbnails on wide windows, a drawer on phones
  const openDrawer = () => app.classList.add('drawer');
  const closeDrawer = () => app.classList.remove('drawer');
  function renderSide() {
    const slim = !phone.matches && !!settings().slim;
    app.classList.toggle('slim', slim);
    const k = phone.matches ? 'menu' : slim ? 'expand' : 'collapse';
    $('sideBtn').title = t(k); $('sideBtn').setAttribute('aria-label', t(k));
  }
  $('sideBtn').onclick = () => {
    if (phone.matches) { openDrawer(); return; }
    settings().slim = !settings().slim; save(); renderSide();
  };
  phone.addEventListener('change', () => { closeDrawer(); renderSide(); });
  $('drawerClose').onclick = closeDrawer;
  $('main').addEventListener('pointerdown', (e) => { if (!e.target.closest('#sideBtn')) closeDrawer(); });
  // In the folded strip, the settings button unfolds the list first
  document.querySelector('#setSec .sec-h').addEventListener('click', () => {
    if (app.classList.contains('slim')) { settings().slim = false; save(); renderSide(); $('setSec').classList.remove('closed'); }
  });

  function renderUser() {
    $('userName').textContent = USER.name || t('appName');
    const av = $('avatar');
    if (USER.color) { av.style.background = USER.color; av.style.color = '#fff'; }
    av.textContent = (USER.name || 'QR').slice(0, 1).toUpperCase();
    if (USER.photo && USER.id) av.innerHTML = '<img alt="" src="/api/users/' + encodeURIComponent(USER.id) + '/avatar">';
  }

  // ── Start ───────────────────────────────────────────────────────────────────────────────────────────
  (async function init() {
    applyTexts();
    await Promise.all([loadDB(), loadUser()]);
    applyTheme();
    $('storeNote').hidden = storeMode !== 'local';
    renderUser();
    buildDesignStatic();
    applyTexts();
    renderSettings();
    renderSide();
    layout();
    setTab(mode === 'wide' ? 'content' : tab);
    const u = me();
    open(u.items.find((x) => x.id === u.current) || u.items[0] || newItem('url'));
  })();
})();
