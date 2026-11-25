/* ═══════════════════════════════════════════════════════════════════════════
   🛡️ Arcade Flow Sky Defender — logotipo: un caza que sube dejando una estela de luz en degradado (ámbar → coral → magenta)
   y dos líneas de velocidad. SVG en línea (sin archivos).
   ═══════════════════════════════════════════════════════════════════════════ */
let n = 0;
export function logoSvg(h = 64) {
  const id = "saf-g" + (++n);
  return `<svg class="sg-logo" viewBox="0 0 100 100" height="${h}" width="${h}" role="img" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#c95a9c" stop-opacity="0"/><stop offset=".35" stop-color="#ff5d73"/><stop offset=".7" stop-color="#ff8a5c"/><stop offset="1" stop-color="#ffc56b"/>
    </linearGradient></defs>
    <path d="M6 94 C 30 88, 50 70, 68 40" stroke="url(#${id})" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M4 74 C 20 70, 34 60, 46 46" stroke="#ff8a5c" stroke-opacity=".55" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <path d="M30 97 C 46 94, 60 84, 70 70" stroke="#ff5d73" stroke-opacity=".45" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <g transform="translate(75 28) rotate(-58)">
      <path d="M17 0 L-7 -13 L-3 -3.5 L-11 -6.5 L-8.5 0 L-11 6.5 L-3 3.5 L-7 13 Z" fill="#f3f1f4" stroke="#1a1420" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M8 0 L1 -1.6 L1 1.6 Z" fill="#ffc56b"/>
    </g>
  </svg>`;
}
