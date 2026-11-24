/* Spanish deck (40 cards) drawn in SVG — our own design. Shared by the Escoba and Mus addons. MIT licence.
 *
 * Design (chosen 2026-11-24): suits in a light medallion; figures (sota, caballo, rey) drawn with flat geometric
 * shapes in two tones of the suit colour, on a soft panel of that colour.
 *
 * Card id = suit * 10 + (rank - 1). Suits: 0 oros, 1 copas, 2 espadas, 3 bastos. Ranks 1..10, where 8 = sota,
 * 9 = caballo and 10 = rey (printed on the card with the traditional numbers 10, 11 and 12).
 */
(function (root) {
  'use strict';
  const SUITS = 4, RANKS = 10;
  const suitOf = (id) => (id / 10) | 0;
  const rankOf = (id) => (id % 10) + 1;
  const printed = (rank) => (rank <= 7 ? rank : rank + 2); // 8,9,10 → 10,11,12
  const COLORS = ['var(--oros)', 'var(--copas)', 'var(--espadas)', 'var(--bastos)'];

  // Suit symbols, 20×20, flat geometric shapes, filled with the current colour.
  const SYMBOLS = `
  <symbol id="s-oros" viewBox="0 0 20 20"><path fill-rule="evenodd" fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17zm0 4a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9z"/><circle cx="10" cy="10" r="2" fill="currentColor"/></symbol>
  <symbol id="s-copas" viewBox="0 0 20 20"><path d="M3 2h14l-3.5 8h-7z" fill="currentColor"/><rect x="9" y="10" width="2" height="5" fill="currentColor"/><rect x="5.5" y="15" width="9" height="2.5" fill="currentColor"/></symbol>
  <symbol id="s-espadas" viewBox="0 0 20 20"><path d="M10 1 12.2 11h-4.4z" fill="currentColor"/><rect x="4.5" y="11" width="11" height="2" fill="currentColor"/><rect x="9" y="13" width="2" height="4" fill="currentColor"/><rect x="8" y="17" width="4" height="2" fill="currentColor"/></symbol>
  <symbol id="s-bastos" viewBox="0 0 20 20"><g transform="rotate(-35 10 10)"><path d="M7.5 19h5l1.5-17h-8z" fill="currentColor"/><rect x="4.5" y="6" width="3" height="2.2" fill="currentColor"/><rect x="12.5" y="10" width="3" height="2.2" fill="currentColor"/></g></symbol>`;
  const SUIT_ID = ['s-oros', 's-copas', 's-espadas', 's-bastos'];

  /** A suit medallion centred on (x, y), w wide. */
  function med(s, x, y, w) {
    return `<g transform="translate(${x - w / 2} ${y - w / 2}) scale(${w / 20})"><circle cx="10" cy="10" r="9.8" fill="var(--card-bg)"/>` +
      `<circle cx="10" cy="10" r="9.8" fill="currentColor" fill-opacity=".14"/><use href="#${SUIT_ID[s]}" x="3" y="3" width="14" height="14"/></g>`;
  }

  // Pip positions inside the 60×90 card, for 1..7: [x, y, width].
  const PIPS = {
    1: [[30, 45, 34]],
    2: [[30, 26, 20], [30, 64, 20]],
    3: [[30, 22, 17], [30, 45, 17], [30, 68, 17]],
    4: [[19.5, 27, 17], [40.5, 27, 17], [19.5, 63, 17], [40.5, 63, 17]],
    5: [[19.5, 24, 15.5], [40.5, 24, 15.5], [30, 45, 15.5], [19.5, 66, 15.5], [40.5, 66, 15.5]],
    6: [[19.5, 23, 15], [40.5, 23, 15], [19.5, 45, 15], [40.5, 45, 15], [19.5, 67, 15], [40.5, 67, 15]],
    7: [[19.5, 20.5, 14], [40.5, 20.5, 14], [30, 32.5, 14], [19.5, 45, 14], [40.5, 45, 14], [19.5, 69.5, 14], [40.5, 69.5, 14]],
  };

  // Figures: flat shapes in two tones of the suit colour (C = solid, T = lighter tone), white details.
  const C = 'fill="currentColor"', T = 'fill="currentColor" fill-opacity=".55"', W = 'fill="var(--card-bg)"';
  function sota(s) {
    return `<path d="M36 16c3-3.6 6.5-4.4 8.2-3.4-1.6 2.6-4.6 4-7.4 4.6z" ${T}/>` +
      `<path d="M23.5 21h13l-2.4-6.2h-8.2z" ${C}/>` +
      `<circle cx="30" cy="25.5" r="4.6" ${C}/><rect x="28.4" y="29.6" width="3.2" height="3" ${C}/>` +
      `<path d="M23.3 32.6h13.4l3.4 24.9H19.9z" ${C}/>` +
      `<path d="M30 33v23" stroke="var(--card-bg)" stroke-opacity=".45" stroke-width=".8"/>` +
      `<circle cx="30" cy="37" r=".7" ${W}/><circle cx="30" cy="40.4" r=".7" ${W}/>` +
      `<rect x="21.4" y="43.6" width="17.2" height="2.3" ${W} fill-opacity=".65"/><rect x="28.8" y="43.4" width="2.4" height="2.7" ${C}/>` +
      `<path d="M23.6 34.5l-3.2 12.5" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><circle cx="20.3" cy="47.6" r="1.6" ${C}/>` +
      `<rect x="24.2" y="57.4" width="3.5" height="12.4" ${T}/><rect x="32.3" y="57.4" width="3.5" height="12.4" ${T}/>` +
      `<path d="M22.6 69.6h5.8q.8 2.6-1 2.6h-4.8zM31.6 69.6h5.8q.8 2.6-1 2.6h-4.8z" ${C}/>` +
      `<path d="M36.7 34.6l5.5 10.2" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>` + med(s, 43.6, 50.2, 12.4);
  }
  function caballo(s) {
    return `<path d="M14.5 55q-5.5 4-3.6 12" stroke="currentColor" stroke-opacity=".55" stroke-width="2.8" fill="none" stroke-linecap="round"/>` +
      `<rect x="15" y="50" width="27.5" height="12" rx="5.5" ${T}/>` +
      `<path d="M36 52.2 43 37.6 49.2 40.2 44.2 55.4z" ${T}/><path d="M42.4 38.4 50 35 53.8 39.6 48.6 42.2z" ${T}/>` +
      `<path d="M43.8 37.4l-1.1-4.2 3.2 2.5z" ${T}/>` +
      `<path d="M42.6 39.4l-5.7 12" stroke="currentColor" stroke-width="2.2"/>` +
      `<path d="M47.5 41.2 41 47" stroke="var(--card-bg)" stroke-opacity=".7" stroke-width=".7"/>` +
      `<rect x="21" y="47.2" width="12.5" height="7" rx="1.2" ${W} fill-opacity=".62"/><path d="M21 52.2h12.5" stroke="currentColor" stroke-width=".6" stroke-opacity=".7"/>` +
      [17.6, 23.2, 31.6, 37.2].map((x) => `<rect x="${x}" y="61" width="3.2" height="10" ${T}/><rect x="${x - 0.3}" y="70.4" width="3.8" height="2" rx=".6" ${C}/>`).join('') +
      `<path d="M23.4 20.4 26.8 15l1.4 4.6z" ${C}/>` +
      `<circle cx="26" cy="25.6" r="4.2" ${C}/>` +
      `<path d="M22.3 31h7.4l2.1 17.2H20.6z" ${C}/>` +
      `<rect x="21" y="39" width="10" height="2" ${W} fill-opacity=".6"/>` +
      `<path d="M26.2 48l-1.6 7.6" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M23.6 55.4h3.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M29.6 33.2l6.2-8.2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>` + med(s, 38.2, 21.2, 11.4);
  }
  function rey(s) {
    return `<path d="M21.5 21.8 23 13.4 26.8 18.4 30 10.8 33.2 18.4 37 13.4 38.5 21.8z" ${C}/>` +
      `<rect x="21.4" y="21.8" width="17.2" height="2.5" rx=".8" ${C}/>` +
      `<circle cx="26.3" cy="23" r=".8" ${W}/><circle cx="30" cy="23" r=".9" ${W}/><circle cx="33.7" cy="23" r=".8" ${W}/>` +
      `<circle cx="23" cy="13.4" r=".9" ${C}/><circle cx="30" cy="10.8" r=".9" ${C}/><circle cx="37" cy="13.4" r=".9" ${C}/>` +
      `<circle cx="30" cy="29" r="4.6" ${C}/>` +
      `<path d="M25.8 31.2h8.4L30 38.4z" ${T}/>` +
      `<path d="M20.4 37h19.2l4.6 36h-28.4z" ${C}/>` +
      `<path d="M27 37.4h6l2 30h-10z" ${T}/>` +
      `<rect x="24.6" y="36.6" width="10.8" height="2.6" rx="1" ${W} fill-opacity=".7"/>` +
      `<rect x="16.4" y="67.6" width="27.2" height="3.4" ${W} fill-opacity=".7"/>` +
      [20.6, 25.6, 30.6, 35.6, 40.2].map((x) => `<circle cx="${x}" cy="69.3" r=".7" ${C}/>`).join('') +
      `<path d="M39.6 40l4.2 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M45.2 30.6v36" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="45.2" cy="29" r="2.1" ${C}/>` +
      `<path d="M45.2 25.6v1.6M44.4 26.4h1.6" stroke="currentColor" stroke-width=".8"/>` + med(s, 30, 51.6, 13.2);
  }
  const FIGURE = { 8: sota, 9: caballo, 10: rey };

  /** SVG markup of a card. opts: {value: show the playing value badge on figures (Escoba)} */
  function cardSVG(id, opts) {
    opts = opts || {};
    const s = suitOf(id), r = rankOf(id), col = COLORS[s], num = printed(r);
    let body = '';
    if (r <= 7) for (const [x, y, w] of PIPS[r]) body += med(s, x, y, w);
    else body = `<rect x="11" y="15" width="38" height="60" rx="4" fill="currentColor" fill-opacity=".1"/>` + FIGURE[r](s);
    const idx = `<text x="7.5" y="12" font-size="10" font-weight="700" text-anchor="middle" fill="currentColor" font-family="Georgia,'Times New Roman',serif">${num}</text>` + med(s, 7.5, 19.5, 8);
    let badge = '';
    if (opts.value && r > 7) badge = `<g><rect x="21" y="78" width="18" height="9" rx="4.5" fill="var(--card-badge)"/><text x="30" y="85" font-size="7" font-weight="700" text-anchor="middle" fill="var(--card-badge-ink)">= ${r}</text></g>`;
    return `<svg class="card-svg" viewBox="0 0 60 90" style="color:${col}" aria-label="${num}">` +
      `<rect x=".5" y=".5" width="59" height="89" rx="5" fill="var(--card-bg)" stroke="var(--card-line)"/>` +
      idx + `<g transform="rotate(180 30 45)">${idx}</g>` + body + badge + `</svg>`;
  }
  function backSVG() {
    return `<svg class="card-svg" viewBox="0 0 60 90"><rect x=".5" y=".5" width="59" height="89" rx="5" fill="var(--back-bg)" stroke="var(--card-line)"/>` +
      `<rect x="5" y="5" width="50" height="80" rx="3" fill="none" stroke="var(--back-line)" stroke-width="1"/>` +
      `<path d="M30 20 44 45 30 70 16 45z" fill="none" stroke="var(--back-line)" stroke-width="1.2"/><circle cx="30" cy="45" r="5" fill="var(--back-line)"/></svg>`;
  }
  function defsSVG() { return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${SYMBOLS}</defs></svg>`; }

  function deck() { const d = []; for (let i = 0; i < SUITS * RANKS; i++) d.push(i); return d; }
  function shuffle(a, rnd) { rnd = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  const api = { suitOf, rankOf, printed, cardSVG, backSVG, defsSVG, deck, shuffle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SpanishCards = api;
})(typeof self !== 'undefined' ? self : this);
