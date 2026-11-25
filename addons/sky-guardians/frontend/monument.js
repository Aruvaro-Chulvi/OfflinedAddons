/* ═══════════════════════════════════════════════════════════════════════════
   🏛️ Sky Guardians — defender un monumento 3D (v1.1)
   En vez de la torre, uno de los monumentos de Offlined Landmarks 3D que el jugador tenga descargados (los pone
   Wiki Flight en su sitio real: S.lm). Aquí solo se envuelve con lo mismo que da la torre (tower.js): nivel de
   daño 10…0, choques, actualizar y quitar. El modelo no se rompe: con el daño le salen fuegos y humo y se va
   ennegreciendo; a 0 %, gran explosión y una columna de humo que se queda.
   ═══════════════════════════════════════════════════════════════════════════ */
import { Particles } from "./tower.js";

function tex(THREE, soft) {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (soft) { gr.addColorStop(0, "rgba(255,255,255,.5)"); gr.addColorStop(0.6, "rgba(255,255,255,.25)"); gr.addColorStop(1, "rgba(255,255,255,0)"); }
  else { gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); }
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** L: entrada de S.lm.list (X, Z, y, k, m: meta del modelo) */
export function createMonument(api, L) {
  const { THREE, scene } = api;
  const k = L.k || 1, H = Math.max(12, (L.m.height || 20) * k), R = Math.max(15, (L.m.radius || 30) * k);
  const root = new THREE.Group(); root.name = "sg-monument"; scene.add(root);
  root.position.set(L.X, L.y ?? api.groundAt(L.X, L.Z), L.Z);
  const fire = new Particles(THREE, 700, tex(THREE, false), true), smoke = new Particles(THREE, 900, tex(THREE, true), false);
  scene.add(fire.points); scene.add(smoke.points);
  // Puntos de fuego: sobre la planta (en el mundo), a varias alturas; salen más cuanto más daño
  const rnd = (() => { let a = 1234567; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let x = Math.imul(a ^ a >>> 15, 1 | a); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; })();
  const fp = L.fp && L.fp.length >= 3 ? L.fp : null;
  const spots = [];
  for (let i = 0; i < 10; i++) {
    let x = L.X + (rnd() - 0.5) * R, z = L.Z + (rnd() - 0.5) * R;
    if (fp) { const [ax, az] = fp[(rnd() * fp.length) | 0]; const u = 0.25 + rnd() * 0.5; x = L.X + (ax - L.X) * u; z = L.Z + (az - L.Z) * u; }
    spots.push({ x, z, h: (0.35 + rnd() * 0.6) * H, acc: 0 });
  }
  let level = 10, time = 0, char = 1, charWant = 1, boomT = 0;
  const _v = new THREE.Vector3();

  // Ennegrecer: se baja el color de los materiales del modelo que esté a la vista (completo o de lejos) y se
  // devuelve al acabar. Se miran de nuevo si el motor cambia de versión (cerca / lejos)
  const touched = new Map();   // material → color original
  let seenObjs = [];
  function applyChar() {
    const objs = [L.full, L.lod].filter(Boolean);
    for (const o of objs) o.traverse(c => {
      if (!c.material) return;
      for (const m of [].concat(c.material)) {
        if (!m.color) continue;
        if (!touched.has(m)) touched.set(m, m.color.clone());
        m.color.copy(touched.get(m)).multiplyScalar(char);
      }
    });
    seenObjs = objs;
  }
  function restore() { for (const [m, c] of touched) m.color.copy(c); touched.clear(); }

  function setLevel(Lv, animate = false) {
    Lv = Math.max(0, Math.min(10, Math.round(Lv)));
    const prev = level; level = Lv;
    charWant = Lv >= 7 ? 1 : 0.35 + 0.65 * Lv / 7;
    if (animate && Lv < prev) boomT = Lv === 0 ? 2.5 : 0.6;   // explosión (grande si cae)
    if (!animate) char = charWant;
    applyChar();
  }
  function burst(x, y, z, size) {
    for (let i = 0; i < 26 * size; i++) { const v = (8 + Math.random() * 22) * size; fire.spawn(x, y, z, (Math.random() - 0.5) * v, (Math.random() - 0.3) * v, (Math.random() - 0.5) * v, 0.4 + Math.random() * 0.5, 8 * size + Math.random() * 6 * size, 2, [1, 0.85, 0.5, 1], [0.9, 0.25, 0.05, 0], 2.5, 0); }
    for (let i = 0; i < 14 * size; i++) smoke.spawn(x, y, z, (Math.random() - 0.5) * 12, Math.random() * 8, (Math.random() - 0.5) * 12, 4 + Math.random() * 3, 8 * size, 30 * size, [0.12, 0.11, 0.1, 0.75], [0.25, 0.24, 0.23, 0], 0.8, -0.4);
  }
  function update(dt, ctx = {}) {
    time += dt;
    if (L.y !== null && L.y !== undefined) root.position.y = L.y;
    const by = root.position.y;
    if (Math.abs(char - charWant) > 0.002) { char += (charWant - char) * Math.min(1, dt * 1.5); applyChar(); }
    else if ((L.full && !seenObjs.includes(L.full)) || (L.lod && !seenObjs.includes(L.lod))) applyChar();
    if (boomT > 0) {
      const big = level === 0;
      if ((boomT -= dt) > 0 && Math.random() < (big ? 0.5 : 0.25)) { const s = spots[(Math.random() * spots.length) | 0]; burst(s.x, by + s.h, s.z, big ? 1.6 : 0.8); }
    }
    // fuegos y humo: uno por cada 10 % perdido; en ruina, todos y una columna grande
    const n = 10 - level;
    for (let i = 0; i < n; i++) {
      const s = spots[i]; if ((s.acc += dt) < 0.06) continue; s.acc = 0;
      const y = by + s.h * (level === 0 ? 0.5 : 1);
      fire.spawn(s.x + (Math.random() - 0.5) * 4, y, s.z + (Math.random() - 0.5) * 4, 0, 4 + Math.random() * 3, 0, 0.7 + Math.random() * 0.5, 9 + n * 0.4, 3, [1, 0.8, 0.35, 1], [0.9, 0.25, 0.05, 0], 0.4, -2);
      smoke.spawn(s.x, y + 4, s.z, (Math.random() - 0.5) * 2, 5 + Math.random() * 3, (Math.random() - 0.5) * 2, 5 + Math.random() * 4, 6, 26 + n * 2, [0.1, 0.09, 0.09, 0.6], [0.3, 0.3, 0.3, 0], 0.3, -0.6);
    }
    const scale = ctx.scale || 800, light = ctx.light ?? 1;
    fire.update(dt, 0, 0, scale); smoke.update(dt, 2, 1, scale, light);
  }
  return {
    root,
    kind: "monument", H, R, X: L.X, Z: L.Z,
    get level() { return level; },
    setLevel,
    update,
    /** ¿Dentro del monumento? (su volumen de choque si lo tiene; si no, la planta hasta su altura) */
    hit(p) {
      if (Math.abs(p.x - L.X) > R * 1.2 || Math.abs(p.z - L.Z) > R * 1.2) return false;
      if (api.S.lm && api.S.lm.hit(p.x, p.y, p.z) !== null) return true;
      return p.y >= root.position.y && p.y <= root.position.y + H && Math.hypot(p.x - L.X, p.z - L.Z) < R * 0.6;
    },
    aimPoint(out = new THREE.Vector3()) { return out.set(L.X, root.position.y + H * 0.7, L.Z); },
    dispose() {
      restore();
      scene.remove(root); scene.remove(fire.points); scene.remove(smoke.points);
      fire.dispose(); smoke.dispose();
    },
  };
}
