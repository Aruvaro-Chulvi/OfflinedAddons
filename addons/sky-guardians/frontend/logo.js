/* ═══════════════════════════════════════════════════════════════════════════
   🛡️ Sky Guardians — logotipo: escudo con alas y la torre de comunicaciones dentro, con sus ondas.
   SVG en línea (sin archivos), en los colores de los Guardianes: plata, rojo y blanco, y ámbar en la señal.
   ═══════════════════════════════════════════════════════════════════════════ */

export function logoSvg(h = 64) {
  const wing = `<path d="M50 30 L6 16 L13 24 L2 25 L13 31 L4 34 L16 37 L8 41 L22 42 L46 44 Z" fill="#c9ced6" stroke="#8a919b" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M44 33 L16 26 M42 37 L14 33 M44 41 L18 39" stroke="#8a919b" stroke-width="1" fill="none"/>`;
  return `<svg class="sg-logo" viewBox="0 0 120 84" height="${h}" width="${Math.round(h * 120 / 84)}" role="img" aria-hidden="true">
    ${wing}<g transform="translate(120,0) scale(-1,1)">${wing}</g>
    <path d="M40 14 H80 V42 Q80 66 60 78 Q40 66 40 42 Z" fill="#b3261e" stroke="#eeeeea" stroke-width="3" stroke-linejoin="round"/>
    <path d="M45 19 H75 V42 Q75 61 60 71 Q45 61 45 42 Z" fill="none" stroke="#7d1a15" stroke-width="1.2"/>
    <g fill="#eeeeea">
      <path d="M53 66 L67 66 L64 52 L56 52 Z"/>
      <rect x="58.6" y="34" width="2.8" height="18"/>
      <rect x="55.5" y="36" width="9" height="4" rx="1"/>
      <rect x="56.8" y="30" width="6.4" height="3.2" rx="1"/>
      <rect x="59.4" y="21" width="1.2" height="9"/>
    </g>
    <circle cx="60" cy="20.5" r="1.8" fill="#ffb020"/>
    <path d="M54 17 Q60 11 66 17 M51 14 Q60 5 69 14" stroke="#ffb020" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg>`;
}
