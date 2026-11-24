/* ═══════════════════════════════════════════════════════════════════════════
   🎛️ Sky Guardians — asignación de controles (teclado y mando), reasignable desde el menú
   Se guarda en este equipo (localStorage). Los mandos arcade (arcade.js) y el combate (combat.js) leen de aquí.
   El ratón (apuntar, clic izquierdo/derecho) no se reasigna.
   ═══════════════════════════════════════════════════════════════════════════ */

const LS = "sg_bindings";
// Acciones: teclado (códigos de tecla, varias por acción) y mando (índice de botón, uno por acción)
export const ACTIONS = ["fire1", "fire2", "target", "accel", "brake", "up", "down", "left", "right", "cam", "pause"];
const DEFAULT = {
  kb: { fire1: ["Space"], fire2: ["KeyV"], target: ["Tab", "KeyE"], accel: ["KeyW", "ShiftLeft"], brake: ["KeyS", "ControlLeft"],
        up: ["ArrowDown"], down: ["ArrowUp"], left: ["ArrowLeft", "KeyA"], right: ["ArrowRight", "KeyD"], cam: ["KeyC"], pause: ["Escape"] },
  pad: { fire1: 7, fire2: 6, target: 3, accel: 5, brake: 4, cam: 12, pause: 9 },
};
// Lo que no se puede tocar: Escape (pausa del motor) y las del motor que no conviene pisar
export const KB_FIXED = { pause: true };
export const PAD_ACTIONS = ["fire1", "fire2", "target", "accel", "brake", "cam", "pause"];

const B = JSON.parse(JSON.stringify(DEFAULT));
try {
  const s = JSON.parse(localStorage.getItem(LS) || "null");
  if (s && s.kb) for (const a of ACTIONS) if (Array.isArray(s.kb[a]) && s.kb[a].length) B.kb[a] = s.kb[a].slice(0, 2);
  if (s && s.pad) for (const a of PAD_ACTIONS) if (Number.isInteger(s.pad[a])) B.pad[a] = s.pad[a];
} catch { }
const save = () => { try { localStorage.setItem(LS, JSON.stringify(B)); } catch { } };

export const bindings = B;   // objeto vivo: quien lo lee ve siempre lo último
export const kbHas = (action, code) => B.kb[action].includes(code);
export function kbAny(action, keys) { return B.kb[action].some(c => keys.has(c)); }
/** Asigna una tecla a una acción (la quita de cualquier otra para que no haya dos acciones en la misma) */
export function setKey(action, code) {
  if (KB_FIXED[action]) return;
  for (const a of ACTIONS) if (a !== action) B.kb[a] = B.kb[a].filter(c => c !== code);
  for (const a of ACTIONS) if (!B.kb[a].length) B.kb[a] = DEFAULT.kb[a].filter(c => c !== code).slice(0, 1);
  B.kb[action] = [code];
  save();
}
export function setPad(action, index) {
  for (const a of PAD_ACTIONS) if (a !== action && B.pad[a] === index) B.pad[a] = B.pad[action];   // intercambio
  B.pad[action] = index; save();
}
export function resetBindings() { const d = JSON.parse(JSON.stringify(DEFAULT)); B.kb = d.kb; B.pad = d.pad; save(); }

// Nombres para mostrar
const KEY_NAMES = { Space: "Espacio", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl",
  AltLeft: "Alt", Escape: "Esc", Tab: "Tab", Enter: "Enter", Backspace: "⌫" };
export function keyName(code, t) {
  if (code === "Space") return t ? t("kSpace") : "Space";
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return "Num " + code.slice(6);
  return code;
}
const PAD_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "Back", "Start", "L3", "R3", "↑", "↓", "←", "→", "Home"];
export const padName = i => PAD_NAMES[i] || "B" + i;
