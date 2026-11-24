/* QR Code encoder (ISO/IEC 18004) for the Offlined «QR Generator» addon. MIT licence.
 * Own implementation: numeric / alphanumeric / byte (UTF-8) mode, versions 1–40, levels L M Q H,
 * automatic mask choice. QREngine.encode(text, {ecl, minVersion, boostEcl}) → {size, version, ecl, mask, modules, isFunction}
 * modules[y][x] === true means a dark module. */
(function () {
  'use strict';

  const ECL = { L: 0, M: 1, Q: 2, H: 3 };
  const FORMAT_BITS = [1, 0, 3, 2];  // L M Q H
  const ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  ];
  const NUM_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  ];
  const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  const MODES = {
    numeric: { bits: 0x1, cc: [10, 12, 14] },
    alnum:   { bits: 0x2, cc: [9, 11, 13] },
    byte:    { bits: 0x4, cc: [8, 16, 16] },
  };
  const ccBits = (mode, ver) => mode.cc[ver <= 9 ? 0 : ver <= 26 ? 1 : 2];

  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(s));
    return Array.from(unescape(encodeURIComponent(s)), (c) => c.charCodeAt(0));
  }

  // One segment for the whole text, in the most compact mode that can hold it.
  function makeSegment(text) {
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    if (/^[0-9]*$/.test(text)) {
      for (let i = 0; i < text.length; i += 3) { const n = Math.min(3, text.length - i); put(parseInt(text.substr(i, n), 10), n * 3 + 1); }
      return { mode: MODES.numeric, count: text.length, bits };
    }
    if ([...text].every((c) => ALNUM.indexOf(c) >= 0)) {
      let i = 0;
      for (; i + 2 <= text.length; i += 2) put(ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
      if (i < text.length) put(ALNUM.indexOf(text[i]), 6);
      return { mode: MODES.alnum, count: text.length, bits };
    }
    const bytes = utf8(text);
    bytes.forEach((b) => put(b, 8));
    return { mode: MODES.byte, count: bytes.length, bits };
  }

  function rawDataModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const na = Math.floor(ver / 7) + 2;
      r -= (25 * na - 10) * na - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  const dataCodewords = (ver, e) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[e][ver] * NUM_BLOCKS[e][ver];

  function segBits(seg, ver) {
    const cc = ccBits(seg.mode, ver);
    if (seg.count >= (1 << cc)) return Infinity;
    return 4 + cc + seg.bits.length;
  }

  // ── Reed–Solomon over GF(256), polynomial 0x11D ──
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
    return z & 0xff;
  }
  function rsDivisor(degree) {
    const res = new Array(degree).fill(0);
    res[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) { res[j] = gfMul(res[j], root); if (j + 1 < degree) res[j] ^= res[j + 1]; }
      root = gfMul(root, 0x02);
    }
    return res;
  }
  function rsRemainder(data, div) {
    const res = new Array(div.length).fill(0);
    for (const b of data) {
      const f = b ^ res.shift();
      res.push(0);
      for (let i = 0; i < div.length; i++) res[i] ^= gfMul(div[i], f);
    }
    return res;
  }

  function addEccAndInterleave(data, ver, e) {
    const nb = NUM_BLOCKS[e][ver], eccLen = ECC_PER_BLOCK[e][ver];
    const raw = Math.floor(rawDataModules(ver) / 8);
    const nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
    const div = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const out = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((blk, j) => { if (i !== shortLen - eccLen || j >= nShort) out.push(blk[i]); });
    }
    return out;
  }

  function alignmentPositions(ver) {
    if (ver === 1) return [];
    const na = Math.floor(ver / 7) + 2;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
    const res = [6];
    for (let pos = ver * 4 + 17 - 7; res.length < na; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function encode(text, opts) {
    opts = opts || {};
    let e = ECL[opts.ecl] !== undefined ? ECL[opts.ecl] : ECL.M;
    const minVer = Math.max(1, Math.min(40, opts.minVersion | 0 || 1));
    const seg = makeSegment(String(text == null ? '' : text));

    let ver, used;
    for (ver = minVer; ; ver++) {
      const cap = dataCodewords(ver, e) * 8;
      used = segBits(seg, ver);
      if (used <= cap) break;
      if (ver >= 40) { const err = new Error('too-long'); err.code = 'too-long'; throw err; }
    }
    if (opts.boostEcl !== false) {
      for (let ne = e + 1; ne <= 3; ne++) if (used <= dataCodewords(ver, ne) * 8) e = ne;
    }

    // Data bit stream
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(seg.mode.bits, 4);
    put(seg.count, ccBits(seg.mode, ver));
    for (const b of seg.bits) bits.push(b);
    const capBits = dataCodewords(ver, e) * 8;
    put(0, Math.min(4, capBits - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }

    const all = addEccAndInterleave(data, ver, e);
    const size = ver * 4 + 17;
    const M = Array.from({ length: size }, () => new Array(size).fill(false));
    const F = Array.from({ length: size }, () => new Array(size).fill(false));
    const setF = (x, y, dark) => { M[y][x] = dark; F[y][x] = true; };

    // Function patterns
    for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setF(x, y, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = alignmentPositions(ver), na = ap.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const drawFormat = (mask) => {
      const d = (FORMAT_BITS[e] << 3) | mask;
      let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((d << 10) | rem) ^ 0x5412;
      const bit = (i) => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) setF(8, i, bit(i));
      setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i));
      setF(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const b = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = ((b >>> i) & 1) !== 0, a = size - 11 + (i % 3), c = Math.floor(i / 3);
        setF(a, c, bit); setF(c, a, bit);
      }
    }

    // Codewords, zig-zag
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if (!F[y][x] && k < all.length * 8) { M[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++; }
      }
    }

    const maskFn = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    const applyMask = (m) => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && maskFn[m](x, y)) M[y][x] = !M[y][x];
    };
    let best = 0, bestP = Infinity;
    const forced = opts.mask >= 0 && opts.mask <= 7 ? opts.mask : -1;
    if (forced >= 0) best = forced;
    else for (let m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      const p = penalty(M, size);
      if (p < bestP) { bestP = p; best = m; }
      applyMask(m);
    }
    applyMask(best); drawFormat(best);
    return { size, version: ver, ecl: 'LMQH'[e], mask: best, modules: M, isFunction: F, mode: seg.mode === MODES.byte ? 'byte' : seg.mode === MODES.alnum ? 'alnum' : 'numeric',
      dataBits: used, capacityBits: capBits };
  }

  function penalty(M, size) {
    let p = 0, dark = 0;
    const line = (get) => {
      let run = 1, s = 0;
      const seq = [];
      for (let i = 0; i < size; i++) seq.push(get(i));
      for (let i = 1; i <= size; i++) {
        if (i < size && seq[i] === seq[i - 1]) run++;
        else { if (run >= 5) s += 3 + run - 5; run = 1; }
      }
      // finder-like 1011101 with 4 light modules before or after
      for (let i = 0; i + 7 <= size; i++) {
        if (seq[i] && !seq[i + 1] && seq[i + 2] && seq[i + 3] && seq[i + 4] && !seq[i + 5] && seq[i + 6]) {
          let before = true, after = true;
          for (let j = 1; j <= 4; j++) { if (i - j >= 0 && seq[i - j]) before = false; if (i + 6 + j < size && seq[i + 6 + j]) after = false; }
          if (before || after) s += 40;
        }
      }
      return s;
    };
    for (let y = 0; y < size; y++) p += line((x) => M[y][x]);
    for (let x = 0; x < size; x++) p += line((y) => M[y][x]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = M[y][x];
      if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (M[y][x]) dark++;
    const total = size * size;
    const kk = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    return p + Math.max(0, kk) * 10;
  }

  // How many characters of this kind still fit at the largest version (for the counter in the form).
  function capacityInfo(text, ecl) {
    try { const q = encode(text, { ecl, boostEcl: false }); return { ok: true, version: q.version, pct: Math.round((q.dataBits / q.capacityBits) * 100), size: q.size }; }
    catch (_) { return { ok: false }; }
  }

  window.QREngine = { encode, capacityInfo, utf8 };
})();
