/* ═══════════════════════════════════════════════════════════════════════════
   ✈️ Sky Guardians — modelos de los enemigos (bando ficticio: gris oscuro y ámbar, sin insignias reales)
   Se hacen una vez con las piezas de Wiki Flight (P.build + PARTS) y cada enemigo usa un clon.
   Cabinas tintadas, sin pilotos. Diseños genéricos, sin modelos ni marcas reales.
   ═══════════════════════════════════════════════════════════════════════════ */
import { buildAttack } from "./planes.js";

const DARK = 0x3b3f44, AMBER = 0xd99a1e, BLACK = 0x1c1f22, SAND = 0x9c9480;

// Dron kamikaze: ala en delta, cuerpo fino, hélice empujando y aletas en las puntas (unos 3,5 m)
function drone(THREE, K) {
  const g = new THREE.Group(), body = K.paint(SAND, 40), dark = K.paint(BLACK, 30);
  const fus = K.cyl(0.2, 0.24, 3.2, body, 10); fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 10), dark); nose.rotation.x = -Math.PI / 2; nose.position.z = -1.85; g.add(nose);
  g.add(K.pair(() => K.wing({ root: 2.3, tip: 0.35, half: 1.35, sweep: 1.85, thick: 0.08, mat: body }), 0.15, 0, 0.35));
  g.add(K.pair(() => { const f = K.fin({ root: 0.5, tip: 0.25, height: 0.45, sweep: 0.25, thick: 0.04, mat: dark }); return f; }, 1.45, 0, 1.6));
  g.add(K.propeller(0.42, 2, 0, 0, 1.75));
  return g;
}
// Misil de crucero: cuerpo largo, ojiva, alas pequeñas y cola en cruz (unos 6 m)
function cruise(THREE, K) {
  const g = new THREE.Group(), body = K.paint(0x6e7378, 50), dark = K.paint(BLACK, 30), band = K.paint(AMBER, 40);
  const fus = K.cyl(0.32, 0.32, 5.4, body, 12); fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 12), dark); nose.rotation.x = -Math.PI / 2; nose.position.z = -3.15; g.add(nose);
  const b = K.cyl(0.33, 0.33, 0.3, band, 12); b.rotation.x = Math.PI / 2; b.position.z = -2.1; g.add(b);
  g.add(K.pair(() => K.wing({ root: 0.7, tip: 0.4, half: 1.25, sweep: 0.35, thick: 0.05, mat: body }), 0.2, -0.1, 0));
  for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.5), dark); f.position.z = 2.55; f.rotation.z = k * Math.PI / 2; f.translateY(0.45); g.add(f); }
  const inlet = K.cyl(0.18, 0.2, 0.9, dark, 10); inlet.rotation.x = Math.PI / 2; inlet.position.set(0, -0.36, 1.6); g.add(inlet);
  return g;
}
// Helicóptero de ataque: cabina en tándem, botalón, rotor principal y de cola, alas cortas con lanzacohetes
function heli(THREE, K) {
  const g = new THREE.Group(), body = K.paint(DARK, 45), dark = K.paint(BLACK, 30), band = K.paint(AMBER, 40);
  const fus = K.lathe([[-2.6, 0.2], [-1.5, 0.75], [0.5, 1.05], [2.6, 1.0], [4.2, 0.7], [5.0, 0.3]], 18, body); fus.scale.set(0.85, 1.15, 1); g.add(fus);
  const can = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), K.GLASS()); can.scale.set(0.9, 1.1, 2.4); can.position.set(0, 0.7, -2.4); g.add(can);
  const boom = K.cyl(0.42, 0.22, 7.5, body, 12); boom.rotation.x = Math.PI / 2; boom.position.set(0, 0.3, 6.0); g.add(boom);
  const stripe = K.cyl(0.43, 0.4, 0.5, band, 12); stripe.rotation.x = Math.PI / 2; stripe.position.set(0, 0.3, 4.0); g.add(stripe);
  const vf = K.fin({ root: 1.4, tip: 0.8, height: 1.8, sweep: 0.8, thick: 0.1, mat: body }); vf.position.set(0, 0.5, 9.2); g.add(vf);
  g.add(K.pair(() => K.wing({ root: 0.9, tip: 0.6, half: 1.3, sweep: 0.2, thick: 0.1, mat: body }), 0, 0.5, 9.0));
  const mast = K.cyl(0.18, 0.25, 0.7, dark, 10); mast.position.set(0, 1.55, 0.6); g.add(mast);
  const rotor = new THREE.Group(); rotor.name = "rotor"; rotor.position.set(0, 1.95, 0.6);
  for (let k = 0; k < 4; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 6.6), dark); bl.position.z = 3.3; const arm = new THREE.Group(); arm.rotation.y = k * Math.PI / 2; arm.add(bl); rotor.add(arm); }
  const hub = K.cyl(0.3, 0.3, 0.25, dark, 10); rotor.add(hub); g.add(rotor);
  const trotor = new THREE.Group(); trotor.name = "trotor"; trotor.position.set(0.25, 1.3, 9.6);
  for (let k = 0; k < 2; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.2, 0.2), dark); bl.rotation.x = k * Math.PI / 2; trotor.add(bl); }
  g.add(trotor);
  for (const sx of [-1, 1]) {   // alas cortas con lanzacohetes
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.9), body); w.position.set(sx * 1.6, -0.1, 0.2); g.add(w);
    const pod = K.cyl(0.24, 0.24, 1.7, K.paint(0x5d6268, 40), 10); pod.rotation.x = Math.PI / 2; pod.position.set(sx * 2.2, -0.45, 0.2); g.add(pod);
  }
  const gun = K.cyl(0.05, 0.05, 1.2, dark, 6); gun.rotation.x = Math.PI / 2; gun.position.set(0, -0.85, -3.0); g.add(gun);
  for (const sx of [-1, 1]) { const w = K.wheel(0.3, 0.16); w.position.set(sx * 1.2, -1.4, -0.6); g.add(w); }
  return g;
}
// Bombardero (medio o, a lo grande, el jefe): fuselaje torneado, ala alta o en flecha, motores bajo el ala
function bomber(THREE, K, P) {
  const big = P.boss, g = new THREE.Group(), body = K.paint(DARK, 50), dark = K.paint(BLACK, 30), band = K.paint(AMBER, 40);
  const s = big ? 1.9 : 1;
  const prof = [[-13, 0.3], [-11, 1.0], [-6, 1.55], [4, 1.65], [9, 1.45], [12, 0.95], [13.2, 0.35]].map(([a, r]) => [a * s, r * s]);
  const fus = K.lathe(prof, 22, body); g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.75 * s, 14, 10), K.GLASS()); nose.scale.set(1, 0.8, 1.5); nose.position.set(0, 0.25 * s, -12 * s); g.add(nose);
  const stripe = K.cyl(1.47 * s, 1.47 * s, 1.2 * s, band, 18); stripe.rotation.x = Math.PI / 2; stripe.position.z = 7 * s; g.add(stripe);
  const wy = big ? -0.6 * s : 0.95 * s;
  g.add(K.pair(() => K.wing({ root: (big ? 6.5 : 5) * s, tip: 2 * s, half: (big ? 15 : 12) * s, sweep: (big ? 6 : 2.4) * s, thick: 0.55 * s, dihedral: big ? 0.05 : 0.02, mat: body }), 0, wy, 0.5 * s));
  g.add(K.pair(() => K.wing({ root: 2.6 * s, tip: 1.2 * s, half: 4.6 * s, sweep: 1.4 * s, thick: 0.2 * s, mat: body }), 0, 0.5 * s, 11.2 * s));
  const vf = K.fin({ root: 4 * s, tip: 1.8 * s, height: 4.6 * s, sweep: 2.6 * s, thick: 0.25 * s, mat: body }); vf.position.set(0, 1.2 * s, 10.6 * s); g.add(vf);
  const tip = K.cyl(0.1 * s, 0.1 * s, 0.5 * s, band, 8); tip.position.set(0, 5.6 * s, 12.6 * s); g.add(tip);
  // Motores: 2 turbohélices (medio) o 4 reactores (jefe), con su posición guardada para los impactos
  const engines = [];
  const xs = big ? [-0.35, -0.7, 0.35, 0.7] : [-0.42, 0.42];
  const half = (big ? 15 : 12) * s, sweep = (big ? 6 : 2.4) * s;
  for (const f of xs) {
    const x = f * half, z = 0.5 * s - (big ? 6.5 : 5) * s * 0.3 + sweep * Math.abs(f), y = wy - (big ? 1.1 : 0.55) * s;
    if (big) {
      const n = K.cyl(0.85 * s * 0.6, 0.7 * s * 0.6, 5 * s * 0.6, K.paint(0x2c3035, 40), 14); n.rotation.x = Math.PI / 2; n.position.set(x, y, z); g.add(n);
      const ring = K.cyl(0.86 * s * 0.6, 0.86 * s * 0.6, 0.4, band, 14); ring.rotation.x = Math.PI / 2; ring.position.set(x, y, z - 1.4 * s * 0.6); g.add(ring);
    } else {
      const n = K.cyl(0.65, 0.55, 4.2, body, 12); n.rotation.x = Math.PI / 2; n.position.set(x, y, z); g.add(n);
      g.add(K.propeller(1.7, 4, x, y, z - 2.3));
    }
    engines.push([x, y, z]);
  }
  // Torretas (cola; y arriba en el jefe)
  const tur = (y, z) => { const t = new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 12, 8), K.GLASS()); t.position.set(0, y, z); g.add(t); const gun = K.cyl(0.05 * s, 0.05 * s, 1.6 * s, dark, 6); gun.rotation.x = Math.PI / 2; gun.position.set(0, y, z + (z > 0 ? 1 : -1) * s); g.add(gun); };
  tur(0.2 * s, 13.4 * s); if (big) tur(1.75 * s, -4 * s);
  g.userData.engines = engines;
  return g;
}

/** Fábrica de modelos: cada tipo se hace una vez y se clona */
// Perfil de neón de los enemigos (Arena Neón): intensidad 0 = apagado (en «Tu ciudad»)
export const ENEMY_RIM = { k: { value: 0 }, col: { value: null } };
function addRim(THREE, mat) {
  if (!mat || mat.userData.sgRim || !mat.isMeshStandardMaterial) return;
  mat.userData.sgRim = true;
  if (!ENEMY_RIM.col.value) ENEMY_RIM.col.value = new THREE.Color(0xff3fb4);
  mat.onBeforeCompile = sh => {
    sh.uniforms.uRimK = ENEMY_RIM.k; sh.uniforms.uRimC = ENEMY_RIM.col;
    sh.fragmentShader = "uniform float uRimK;\nuniform vec3 uRimC;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      { float rim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition))); totalEmissiveRadiance += uRimC * pow(rim, 2.2) * uRimK; }`);
  };
  mat.customProgramCacheKey = () => "sgRim";
  mat.needsUpdate = true;
}

export function enemyModels(api) {
  const base = api.AIRCRAFT.find(a => a.id === "fighter");
  const cache = {};
  const P = (id, extra) => ({ ...base, id, color: DARK, trim: AMBER, trim2: BLACK, ...extra });
  const make = {
    escort: () => api.buildModel(P("sge-escort")),
    attacker: () => api.buildModel(P("sge-attacker", { model: "sgattack", enemy: true, len: 11.4, span: 11.1, eye: [0, 0.95, -1.5], build: buildAttack })),
    drone: () => api.buildModel(P("sge-drone", { model: "drone", len: 3.5, span: 2.7, eye: [0, 0, 0], build: drone })),
    cruise: () => api.buildModel(P("sge-cruise", { model: "cruise", len: 6.3, span: 2.9, eye: [0, 0, 0], build: cruise })),
    hmissile: () => api.buildModel(P("sge-hmissile", { model: "cruise", len: 6.3, span: 2.9, eye: [0, 0, 0], build: cruise })),
    heli: () => api.buildModel(P("sge-heli", { model: "heli", len: 14, span: 13, eye: [0, 0.8, -2.6], build: heli })),
    bomber: () => api.buildModel(P("sge-bomber", { model: "bomber", len: 26, span: 24, eye: [0, 0.9, -10], build: bomber })),
    boss: () => api.buildModel(P("sge-boss", { model: "bomber", boss: true, len: 50, span: 57, eye: [0, 1.5, -20], build: bomber })),
  };
  return kind => {
    if (!cache[kind]) {
      const m = make[kind]();
      m.traverse(o => { if (o.name === "cockpit" || o.name === "gear") o.visible = false; });
      if (kind === "hmissile") m.scale.setScalar(0.45);
      m.traverse(o => { if (o.isMesh) for (const mm of [].concat(o.material)) addRim(api.THREE, mm); });
      cache[kind] = m;
    }
    const c = cache[kind].clone(true);
    c.traverse(o => { if (o.isMesh) o.castShadow = kind !== "drone" && kind !== "hmissile"; });
    c.userData.engines = cache[kind].userData.engines || (cache[kind].children[0] && cache[kind].children[0].userData.engines);
    return c;
  };
}
