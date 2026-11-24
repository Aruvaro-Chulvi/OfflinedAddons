/* QR Generator addon for Offlined — payload builders and SVG / PNG rendering. MIT licence. */
(function () {
  'use strict';

  // ── Payloads: what each kind of QR code contains ──────────────────────────────────────────────────
  const escWifi = (s) => String(s || '').replace(/([\\;,:"])/g, '\\$1');
  const escV = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([;,])/g, '\\$1');
  const digits = (s) => String(s || '').replace(/[^\d+]/g, '');
  const icsDate = (v, allDay) => {
    if (!v) return '';
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!m) return '';
    return allDay || !m[4] ? m[1] + m[2] + m[3] : m[1] + m[2] + m[3] + 'T' + m[4] + m[5] + '00';
  };

  const TYPES = {
    text:  { icon: 'type',     fields: ['text'] },
    url:   { icon: 'link',     fields: ['url'] },
    wifi:  { icon: 'wifi',     fields: ['ssid', 'security', 'password', 'hidden'] },
    vcard: { icon: 'contact',  fields: ['first', 'last', 'org', 'title', 'mobile', 'phone', 'email', 'web', 'street', 'zip', 'city', 'region', 'country', 'note'] },
    email: { icon: 'mail',     fields: ['to', 'subject', 'body'] },
    phone: { icon: 'phone',    fields: ['number'] },
    sms:   { icon: 'sms',      fields: ['number', 'message'] },
    whatsapp: { icon: 'chat',  fields: ['number', 'message'] },
    geo:   { icon: 'pin',      fields: ['lat', 'lon'] },
    event: { icon: 'calendar', fields: ['summary', 'location', 'allDay', 'start', 'end', 'description'] },
  };

  function payload(type, f) {
    f = f || {};
    const v = (k) => String(f[k] == null ? '' : f[k]).trim();
    switch (type) {
      case 'text': return String(f.text || '');
      case 'url': {
        const u = v('url');
        if (!u) return '';
        return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u;
      }
      case 'wifi': {
        if (!v('ssid')) return '';
        const sec = f.security || 'WPA';
        let s = 'WIFI:T:' + (sec === 'nopass' ? 'nopass' : sec) + ';S:' + escWifi(f.ssid) + ';';
        if (sec !== 'nopass') s += 'P:' + escWifi(f.password) + ';';
        if (f.hidden) s += 'H:true;';
        return s + ';';
      }
      case 'vcard': {
        const L = ['BEGIN:VCARD', 'VERSION:3.0'];
        const first = v('first'), last = v('last');
        if (!first && !last && !v('org') && !v('mobile') && !v('phone') && !v('email')) return '';
        L.push('N:' + escV(last) + ';' + escV(first) + ';;;');
        L.push('FN:' + escV([first, last].filter(Boolean).join(' ') || v('org')));
        if (v('org')) L.push('ORG:' + escV(v('org')));
        if (v('title')) L.push('TITLE:' + escV(v('title')));
        if (v('mobile')) L.push('TEL;TYPE=CELL:' + digits(v('mobile')));
        if (v('phone')) L.push('TEL;TYPE=WORK,VOICE:' + digits(v('phone')));
        if (v('email')) L.push('EMAIL:' + v('email'));
        if (v('web')) L.push('URL:' + v('web'));
        if (v('street') || v('city') || v('zip') || v('region') || v('country'))
          L.push('ADR;TYPE=HOME:;;' + [v('street'), v('city'), v('region'), v('zip'), v('country')].map(escV).join(';'));
        if (v('note')) L.push('NOTE:' + escV(v('note')));
        L.push('END:VCARD');
        return L.join('\r\n');
      }
      case 'email': {
        if (!v('to')) return '';
        const q = [];
        if (v('subject')) q.push('subject=' + encodeURIComponent(v('subject')));
        if (String(f.body || '').trim()) q.push('body=' + encodeURIComponent(String(f.body)));
        return 'mailto:' + v('to') + (q.length ? '?' + q.join('&') : '');
      }
      case 'phone': return v('number') ? 'tel:' + digits(v('number')) : '';
      case 'sms': return v('number') ? 'SMSTO:' + digits(v('number')) + ':' + String(f.message || '') : '';
      case 'whatsapp': {
        const n = digits(v('number')).replace(/^\+/, '').replace(/^00/, '');
        if (!n) return '';
        return 'https://wa.me/' + n + (String(f.message || '').trim() ? '?text=' + encodeURIComponent(String(f.message)) : '');
      }
      case 'geo': {
        const lat = parseFloat(String(f.lat).replace(',', '.')), lon = parseFloat(String(f.lon).replace(',', '.'));
        if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return '';
        return 'geo:' + +lat.toFixed(6) + ',' + +lon.toFixed(6);
      }
      case 'event': {
        if (!v('summary') || !v('start')) return '';
        const ad = !!f.allDay;
        const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'SUMMARY:' + escV(v('summary'))];
        L.push('DTSTART' + (ad ? ';VALUE=DATE:' : ':') + icsDate(v('start'), ad));
        if (v('end')) L.push('DTEND' + (ad ? ';VALUE=DATE:' : ':') + icsDate(v('end'), ad));
        if (v('location')) L.push('LOCATION:' + escV(v('location')));
        if (v('description')) L.push('DESCRIPTION:' + escV(v('description')));
        L.push('END:VEVENT', 'END:VCALENDAR');
        return L.join('\r\n');
      }
    }
    return '';
  }

  // ── Colours ───────────────────────────────────────────────────────────────────────────────────────
  function lum(hex) {
    const m = String(hex || '').match(/^#?([0-9a-f]{6})$/i);
    if (!m) return 1;
    const n = parseInt(m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); })
      .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
  }
  // → {ratio, inverted}: contrast between the darker of the dark colours and the background
  function contrast(d) {
    const bg = d.transparent ? '#ffffff' : d.bg;
    const fgs = [d.fg]; if (d.gradient) fgs.push(d.fg2); if (d.eyeColor && !d.eyeSame) fgs.push(d.eyeColor);
    const lb = lum(bg);
    let worst = Infinity, inverted = false;
    for (const c of fgs) {
      const lf = lum(c);
      if (lf > lb) inverted = true;
      const r = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
      worst = Math.min(worst, r);
    }
    return { ratio: worst, inverted };
  }

  // ── SVG ───────────────────────────────────────────────────────────────────────────────────────────
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n3 = (x) => +x.toFixed(3);

  function rr(x, y, w, h, tl, tr, br, bl) {
    // rounded rect path, each corner its own radius
    return 'M' + n3(x + tl) + ' ' + n3(y) + 'H' + n3(x + w - tr) + (tr ? 'A' + tr + ' ' + tr + ' 0 0 1 ' + n3(x + w) + ' ' + n3(y + tr) : '') +
      'V' + n3(y + h - br) + (br ? 'A' + br + ' ' + br + ' 0 0 1 ' + n3(x + w - br) + ' ' + n3(y + h) : '') +
      'H' + n3(x + bl) + (bl ? 'A' + bl + ' ' + bl + ' 0 0 1 ' + n3(x) + ' ' + n3(y + h - bl) : '') +
      'V' + n3(y + tl) + (tl ? 'A' + tl + ' ' + tl + ' 0 0 1 ' + n3(x + tl) + ' ' + n3(y) : '') + 'Z';
  }
  // ring/eye frame (7×7 outer, 5×5 hole) and ball (3×3) for each corner style
  function eyePaths(x, y, style) {
    const R = { square: [0, 0, 0], rounded: [2, 1.2, 0.9], circle: [3.5, 2.5, 1.5], leaf: [2.6, 1.8, 1.1] }[style] || [0, 0, 0];
    const leaf = style === 'leaf';
    const c = (r, i) => (leaf && (i === 1 || i === 3) ? 0 : r);  // leaf: two opposite sharp corners
    const sq = (ox, oy, s, r) => rr(ox, oy, s, s, c(r, 0), c(r, 1), c(r, 2), c(r, 3));
    // outer + inner hole drawn with evenodd
    const frame = sq(x, y, 7, R[0]) + sq(x + 1, y + 1, 5, R[1]);
    const ball = sq(x + 2, y + 2, 3, R[2]);
    return { frame, ball };
  }

  function inEye(x, y, n) {
    return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  }

  /* qr: QREngine result. d: design. Returns {svg, w, h} in module units (w = n + 2·margin). */
  function svg(qr, d, o) {
    o = o || {};
    const n = qr.size, m = Math.max(0, Math.min(10, d.margin == null ? 4 : d.margin | 0));
    const W = n + 2 * m;
    const cap = String(d.caption || '').trim();
    const capFs = W * 0.075 * (d.captionSize || 1);
    const capH = cap ? capFs * 1.9 + (m < 2 ? capFs * 0.4 : 0) : 0;
    const H = W + capH;
    const px = o.px || 0;
    const fg = d.fg || '#000000', bg = d.bg || '#ffffff';
    const eyeCol = d.eyeSame !== false || !d.eyeColor ? null : d.eyeColor;
    const uid = 'q' + Math.random().toString(36).slice(2, 8);

    // Logo hole (module coords, centred)
    let hole = null;
    if (d.logo && d.logo.src) {
      const frac = Math.max(0.1, Math.min(0.3, d.logo.size || 0.22));
      let s = Math.round(n * frac);
      if ((s & 1) !== (n & 1)) s++;
      const p = d.logo.pad === false ? 0 : 1;
      const a = (n - s) / 2;
      hole = { a, s, ex0: a - p * 0.5, ex1: a + s + p * 0.5 };
    }
    const cut = (x, y) => hole && x + 1 > hole.ex0 && x < hole.ex1 && y + 1 > hole.ex0 && y < hole.ex1;

    const body = d.body || 'square';
    const M = qr.modules;
    const dark = (x, y) => x >= 0 && y >= 0 && x < n && y < n && M[y][x] && !inEye(x, y, n) && !cut(x, y);
    let p = '';
    for (let y = 0; y < n; y++) {
      if (body === 'square') {
        for (let x = 0; x < n; x++) {
          if (!dark(x, y)) continue;
          let e = x; while (dark(e + 1, y)) e++;
          p += 'M' + (x + m) + ' ' + (y + m) + 'h' + (e - x + 1) + 'v1h-' + (e - x + 1) + 'z';
          x = e;
        }
        continue;
      }
      for (let x = 0; x < n; x++) {
        if (!dark(x, y)) continue;
        const X = x + m, Y = y + m;
        if (body === 'dots') { p += 'M' + (X + 0.5) + ' ' + (Y + 0.09) + 'a0.41 0.41 0 1 1 0 0.82a0.41 0.41 0 1 1 0-0.82z'; continue; }
        if (body === 'thin') { p += 'M' + (X + 0.12) + ' ' + (Y + 0.12) + 'h0.76v0.76h-0.76z'; continue; }
        if (body === 'diamond') { p += 'M' + (X + 0.5) + ' ' + (Y + 0.02) + 'L' + (X + 0.98) + ' ' + (Y + 0.5) + 'L' + (X + 0.5) + ' ' + (Y + 0.98) + 'L' + (X + 0.02) + ' ' + (Y + 0.5) + 'z'; continue; }
        // rounded (fluid): round only free corners
        const up = dark(x, y - 1), dn = dark(x, y + 1), lf = dark(x - 1, y), rt = dark(x + 1, y), r = 0.5;
        p += rr(X, Y, 1, 1, !up && !lf ? r : 0, !up && !rt ? r : 0, !dn && !rt ? r : 0, !dn && !lf ? r : 0);
      }
    }

    const eyes = [[0, 0], [n - 7, 0], [0, n - 7]].map(([x, y]) => eyePaths(x + m, y + m, d.eyes || 'square'));
    let defs = '', fill = fg;
    if (d.gradient && d.fg2) {
      const dir = d.gradDir || 'diag';
      const g = dir === 'radial'
        ? '<radialGradient id="' + uid + 'g" gradientUnits="userSpaceOnUse" cx="' + W / 2 + '" cy="' + W / 2 + '" r="' + W * 0.6 + '">'
        : '<linearGradient id="' + uid + 'g" gradientUnits="userSpaceOnUse" x1="' + m + '" y1="' + m + '" x2="' + (dir === 'vert' ? m : m + n) + '" y2="' + (dir === 'horiz' ? m : m + n) + '">';
      defs += g + '<stop offset="0" stop-color="' + esc(fg) + '"/><stop offset="1" stop-color="' + esc(d.fg2) + '"/>' + (dir === 'radial' ? '</radialGradient>' : '</linearGradient>');
      fill = 'url(#' + uid + 'g)';
    }
    const eyeFill = eyeCol ? esc(eyeCol) : fill;

    let out = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + n3(W) + ' ' + n3(H) + '"' +
      (px ? ' width="' + px + '" height="' + Math.round((px * H) / W) + '"' : '') + (body === 'square' ? ' shape-rendering="crispEdges"' : '') + '>';
    if (defs) out += '<defs>' + defs + '</defs>';
    if (!d.transparent) out += '<rect width="' + n3(W) + '" height="' + n3(H) + '" fill="' + esc(bg) + '"' + (d.bgRound ? ' rx="' + n3(W * 0.06) + '"' : '') + '/>';
    out += '<path fill="' + fill + '" d="' + p + '"/>';
    out += '<path fill="' + eyeFill + '" fill-rule="evenodd" shape-rendering="geometricPrecision" d="' + eyes.map((e) => e.frame).join('') + '"/>';
    out += '<path fill="' + eyeFill + '" shape-rendering="geometricPrecision" d="' + eyes.map((e) => e.ball).join('') + '"/>';
    if (hole) {
      const a = hole.a + m, s = hole.s;
      if (d.logo.pad !== false && !d.transparent) {
        out += '<rect x="' + n3(a - 0.25) + '" y="' + n3(a - 0.25) + '" width="' + n3(s + 0.5) + '" height="' + n3(s + 0.5) + '" rx="' + n3(s * 0.12) + '" fill="' + esc(bg) + '"/>';
      }
      const clip = d.logo.round ? ' clip-path="url(#' + uid + 'c)"' : '';
      if (d.logo.round) out += '<clipPath id="' + uid + 'c"><circle cx="' + n3(a + s / 2) + '" cy="' + n3(a + s / 2) + '" r="' + n3(s / 2) + '"/></clipPath>';
      out += '<image x="' + n3(a) + '" y="' + n3(a) + '" width="' + s + '" height="' + s + '" preserveAspectRatio="xMidYMid meet" href="' + esc(d.logo.src) + '" xlink:href="' + esc(d.logo.src) + '"' + clip + '/>';
    }
    if (cap) {
      const cy = W - (m < 2 ? 0 : m * 0.45) + capH / 2 + capFs * 0.35;
      out += '<text x="' + n3(W / 2) + '" y="' + n3(cy) + '" text-anchor="middle" font-family="Segoe UI, system-ui, -apple-system, Arial, sans-serif" font-weight="600" font-size="' + n3(capFs) + '" fill="' + esc(d.captionColor || fg) + '">' + esc(cap) + '</text>';
    }
    out += '</svg>';
    return { svg: out, w: W, h: H };
  }

  // SVG string → PNG Blob of `px` pixels wide
  function png(svgStr, w, h, px) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = px; c.height = Math.round((px * h) / w);
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png');
      };
      img.onerror = () => reject(new Error('svg'));
      img.src = url;
    });
  }

  window.QRRender = { TYPES, payload, svg, png, contrast };
})();
