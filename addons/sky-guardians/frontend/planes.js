/* ═══════════════════════════════════════════════════════════════════════════
   ✈️ Sky Guardians — las dos naves del jugador
   Se añaden a la lista de naves del motor (AIRCRAFT) en modo complemento:
   · Avioneta de combate: turbohélice de ataque ligero, cabina en tándem, hélice de 4 palas, cohetes bajo las alas.
     Modelo propio (P.build) hecho con las mismas piezas que las naves de Wiki Flight (PARTS).
   · Caza: modelo propio (tanda E): biplaza no, monoplaza bimotor con dos derivas inclinadas, extensiones en la
     raíz del ala, tomas de aire laterales, dos toberas con postcombustión y misiles en las puntas.
   · Libreas por rango: se desbloquean al subir de rango (cadete → guardián) y valen para las dos naves.
   Diseños genéricos, sin modelos ni marcas reales.
   ═══════════════════════════════════════════════════════════════════════════ */

const KMH = 1 / 3.6;
export const SG_ATTACK = "sg-attack", SG_FIGHTER = "sg-fighter";

// Libreas por rango (índice = rango de stats.js: cadete, piloto, teniente, capitán, as, guardián)
export const LIVERIES = [
  { id: "std",      rank: 0, base: "#68727a", belly: "#a9b1b7", stripe: "#b3261e", camo: "rgba(78,86,93,.4)",    wing: 0x68727a, trim: 0xb3261e },
  { id: "desert",   rank: 1, base: "#a8916a", belly: "#d6c8ab", stripe: "#6e4a26", camo: "rgba(120,96,60,.45)",  wing: 0xa8916a, trim: 0x6e4a26 },
  { id: "navy",     rank: 2, base: "#2f3f56", belly: "#a4b0bf", stripe: "#e0b028", camo: "rgba(30,40,58,.4)",    wing: 0x2f3f56, trim: 0xe0b028 },
  { id: "arctic",   rank: 3, base: "#dfe4e8", belly: "#f3f5f6", stripe: "#c8302a", camo: "rgba(150,162,172,.35)", wing: 0xdfe4e8, trim: 0xc8302a },
  { id: "night",    rank: 4, base: "#1d2024", belly: "#353a40", stripe: "#8c2a2a", camo: "rgba(8,8,10,.45)",     wing: 0x1d2024, trim: 0x8c2a2a },
  { id: "guardian", rank: 5, base: "#22303f", belly: "#c9a441", stripe: "#d8b24a", camo: "rgba(14,22,30,.35)",   wing: 0x22303f, trim: 0xd8b24a },
];
export const liveryOf = id => LIVERIES.find(l => l.id === id) || LIVERIES[0];
/** Pone la librea en las dos naves de los Guardianes (colores de alas y detalles; el fuselaje la lee al construirse) */
export function applyLivery(AIRCRAFT, id) {
  const L = liveryOf(id);
  for (const P of AIRCRAFT) if (P.id === SG_ATTACK || P.id === SG_FIGHTER) { P.livery = L.id; P.color = L.wing; P.trim = L.trim; }
}
const _livCache = new Map();
// Textura del fuselaje: color base, panza clara, manchas suaves, franja cerca de la cola y el escudo de los Guardianes
function attackLivery(THREE, enemy = false, L = LIVERIES[0]) {   // enemy: librea del bando enemigo (gris oscuro y ámbar, sin escudo)
  const key = enemy ? "enemy" : L.id; if (_livCache.has(key)) return _livCache.get(key);
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = enemy ? "#3b3f44" : L.base; g.fillRect(0, 0, 512, 512);
  g.fillStyle = enemy ? "#5d6268" : L.belly; g.fillRect(180, 0, 152, 512);                                 // panza (u .35–.65)
  const r = (() => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 26; i++) { g.fillStyle = enemy ? "rgba(78,86,93,.4)" : L.camo; g.beginPath(); g.ellipse(r() * 512, r() * 512, 30 + r() * 50, 14 + r() * 26, r() * 3, 0, 7); g.fill(); }
  g.fillStyle = enemy ? "#d99a1e" : L.stripe; g.fillRect(0, 380, 512, 26);                                  // franja cerca de la cola
  g.fillStyle = enemy ? "#1c1f22" : "#eeeeea"; g.fillRect(0, 372, 512, 6); g.fillRect(0, 408, 512, 6);
  const shield = (cx, cy, s) => {                                                       // escudo con alas
    g.save(); g.translate(cx, cy); g.rotate(Math.PI / 2);
    g.fillStyle = "#eeeeea"; g.beginPath(); g.moveTo(-s * 2.1, -s * 0.2); g.lineTo(-s * 0.7, -s * 0.55); g.lineTo(-s * 0.7, s * 0.15); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(s * 2.1, -s * 0.2); g.lineTo(s * 0.7, -s * 0.55); g.lineTo(s * 0.7, s * 0.15); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-s * 0.75, -s * 0.8); g.lineTo(s * 0.75, -s * 0.8); g.lineTo(s * 0.75, 0); g.quadraticCurveTo(s * 0.7, s * 0.7, 0, s); g.quadraticCurveTo(-s * 0.7, s * 0.7, -s * 0.75, 0); g.closePath();
    g.fill(); g.fillStyle = L.stripe; g.scale(0.78, 0.78); g.fill();
    g.fillStyle = "#eeeeea"; g.font = `bold ${s * 0.9}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("G", 0, -s * 0.05);
    g.restore();
  };
  if (!enemy) { shield(128, 300, 28); shield(384, 300, 28); }                                          // a los dos lados (u .25 / .75)
  g.strokeStyle = "rgba(0,0,0,.14)"; g.lineWidth = 1.5;
  for (let v = 60; v < 512; v += 56) { g.beginPath(); g.moveTo(0, v); g.lineTo(512, v); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  _livCache.set(key, t);
  return t;
}

export function buildAttack(THREE, K, P) {
  const g = new THREE.Group();
  const body = K.paint(P.color), trim = K.paint(P.trim), dark = K.DARK(), metal = K.paint(0x5d646b, 40);
  // Fuselaje: largo y esbelto, morro largo del turbohélice; algo más alto que ancho
  const fus = K.lathe([[-5.7, 0.06], [-4.9, 0.28], [-3.2, 0.52], [-1, 0.68], [1.2, 0.72], [2.8, 0.68], [4.2, 0.58], [5.2, 0.44], [5.75, 0.3]], 26,
    K.std({ map: attackLivery(THREE, !!P.enemy, liveryOf(P.livery)), shininess: 55, specular: 0x444444, envMapIntensity: 0.55 }));
  fus.scale.set(1, 1.18, 1); g.add(fus);
  // Toma de aire bajo el morro y escapes a los lados
  const inlet = K.cyl(0.26, 0.2, 1.2, dark, 12); inlet.rotation.x = Math.PI / 2; inlet.position.set(0, -0.62, -4.2); g.add(inlet);
  for (const sx of [-1, 1]) { const ex = K.cyl(0.11, 0.13, 0.5, metal, 10); ex.rotation.z = sx * 1.2; ex.position.set(sx * 0.62, 0.15, -3.9); g.add(ex); }
  // Cabina en tándem: burbuja larga con su marco
  const can = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), K.GLASS());
  can.scale.set(1, 0.95, 3.6); can.position.set(0, 0.7, -0.6); g.add(can);
  for (const z of [-2.0, -0.6, 0.9]) { const fr = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.03, 6, 18, Math.PI), dark); fr.scale.y = 0.95; fr.position.set(0, 0.7, z); g.add(fr); }
  // Ala baja con diedro, alerones y flaps
  g.add(K.pair(() => K.wing({ root: 2.4, tip: 1.15, half: 5.55, sweep: 0.35, thick: 0.32, dihedral: 0.09, mat: body,
    flap: { name: "ail", s0: 0.55, s1: 0.95, chord: 0.4, mat: trim }, flap2: { name: "flap", s0: 0.1, s1: 0.5, chord: 0.45, mat: body } }), 0, -0.48, 0.4));
  // Cola: estabilizador, deriva con aleta dorsal
  g.add(K.pair(() => K.wing({ root: 1.35, tip: 0.7, half: 2.2, sweep: 0.35, thick: 0.1, mat: body, flap: { name: "elev", s0: 0.1, s1: 0.95, chord: 0.35, mat: trim } }), 0, 0.12, 4.9));
  const vf = K.fin({ root: 1.9, tip: 0.8, height: 2.0, sweep: 1.1, thick: 0.12, mat: body, rudder: { chord: 0.4, mat: trim } }); vf.position.set(0, 0.45, 4.7); g.add(vf);
  const dors = K.fin({ root: 2.2, tip: 0.2, height: 0.45, sweep: 2.0, thick: 0.06, mat: body }); dors.position.set(0, 0.62, 3.3); g.add(dors);
  // Hélice de 4 palas
  g.add(K.propeller(1.2, 4, 0, 0, -5.95));
  // Bajo las alas: dos lanzacohetes por lado
  for (const sx of [-1, 1]) for (const x of [2.3, 3.6]) {
    const py = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 1.0), metal); py.position.set(sx * x, -0.78 + x * 0.09 * 0.5, 0.35); g.add(py);
    const pod = K.cyl(0.22, 0.22, 1.9, K.paint(0x9aa1a7, 50), 12); pod.rotation.x = Math.PI / 2; pod.position.set(sx * x, -1.02 + x * 0.045, 0.35); g.add(pod);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 12), K.paint(0x6b7178, 50)); cone.rotation.x = -Math.PI / 2; cone.position.set(sx * x, -1.02 + x * 0.045, -0.8); g.add(cone);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), dark); face.position.set(sx * x, -1.02 + x * 0.045, 1.31); g.add(face);
  }
  // Ametralladoras en las alas (cañones que asoman por el borde de ataque)
  for (const sx of [-1, 1]) { const gun = K.cyl(0.04, 0.04, 0.9, dark, 6); gun.rotation.x = Math.PI / 2; gun.position.set(sx * 1.6, -0.45, -1.1); g.add(gun); }
  // Antena y pitot
  const ant = K.cyl(0.02, 0.04, 0.6, dark, 6); ant.position.set(0, 1.0, 1.6); ant.rotation.x = 0.4; g.add(ant);
  const pit = K.cyl(0.02, 0.02, 0.8, metal, 6); pit.rotation.x = Math.PI / 2; pit.position.set(4.6, -0.5, -0.6); g.add(pit);
  // Tren retráctil
  const gear = new THREE.Group(); gear.name = "gear";
  const gm = K.paint(0xb9bec4, 90);
  for (const sx of [-1, 1]) { const w = K.wheel(0.32, 0.18); w.position.set(sx * 1.7, -1.28, 0.55); gear.add(w); gear.add(K.strut([sx * 1.6, -0.55, 0.55], [sx * 1.7, -1.25, 0.55], 0.07, gm)); }
  const nw = K.wheel(0.24, 0.14); nw.position.set(0, -1.38, -3.6); gear.add(nw); gear.add(K.strut([0, -0.6, -3.6], [0, -1.32, -3.6], 0.06, gm));
  g.add(gear);
  return g;
}

// Caza de los Guardianes: bimotor, dos derivas inclinadas hacia fuera, LERX, tomas laterales, dos toberas
export function buildFighter(THREE, K, P) {
  const g = new THREE.Group();
  const body = K.paint(P.color), trim = K.paint(P.trim), dark = K.DARK(), metal = K.paint(0x4a4e53, 30);
  // Fuselaje ancho y plano (los dos motores van dentro), morro afilado
  const fus = K.lathe([[-8.3, 0.02], [-7.5, 0.24], [-6.1, 0.52], [-4.2, 0.82], [-1.6, 1.02], [2, 1.08], [5, 1.02], [6.9, 0.96], [7.7, 0.9]], 26,
    K.std({ map: attackLivery(THREE, false, liveryOf(P.livery)), shininess: 60, specular: 0x444444, envMapIntensity: 0.55 }));
  fus.scale.set(1.28, 0.78, 1); g.add(fus);
  // Cabina: burbuja tintada y su arco
  const can = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    K.std({ color: 0x9a7a2a, shininess: 160, specular: 0xffffff, transparent: true, opacity: 0.55 }));
  can.scale.set(1, 1.15, 3.3); can.position.set(0, 0.62, -4.3); g.add(can);
  const fr = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.035, 6, 18, Math.PI), dark); fr.scale.y = 1.15; fr.position.set(0, 0.62, -3.3); g.add(fr);
  const spine = K.lathe([[-2.6, 0.02], [-1.6, 0.32], [2.5, 0.36], [5.5, 0.08]], 12, body); spine.scale.set(1.2, 0.9, 1); spine.position.set(0, 0.62, 0.6); g.add(spine);
  // Tomas de aire a los lados, con la boca oscura
  g.add(K.pair(() => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 4.4), body); return b; }, 1.25, -0.28, -0.9));
  g.add(K.pair(() => { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), dark); d.rotation.y = Math.PI; return d; }, 1.25, -0.28, -3.12));
  // Ala en flecha con extensión en la raíz (LERX) hasta la cabina
  g.add(K.pair(() => K.wing({ root: 6.4, tip: 1.4, half: 5.3, sweep: 4.5, thick: 0.2, dihedral: -0.02, mat: body,
    flap: { name: "ail", s0: 0.45, s1: 0.9, chord: 0.75, mat: trim }, flap2: { name: "flap", s0: 0.05, s1: 0.42, chord: 0.8, mat: body } }), 0.95, -0.12, 0.9));
  g.add(K.pair(() => K.wing({ root: 3.8, tip: 0.25, half: 0.9, sweep: 3.4, thick: 0.08, mat: body }), 0.95, -0.06, -3.0));
  // Estabilizadores y dos derivas inclinadas hacia fuera
  g.add(K.pair(() => K.wing({ root: 2.7, tip: 0.9, half: 2.7, sweep: 1.7, thick: 0.1, mat: body, flap: { name: "elev", s0: 0.1, s1: 0.95, chord: 0.5, mat: trim } }), 1.0, -0.12, 6.3));
  g.add(K.pair(() => { const f = K.fin({ root: 3.2, tip: 1.2, height: 2.9, sweep: 2.3, thick: 0.12, mat: body, rudder: { chord: 0.55, mat: trim } }); f.rotation.z = -0.38; return f; }, 1.25, 0.45, 4.9));
  // Dos toberas y su postcombustión (el motor la enciende con el turbo)
  for (const sx of [-0.7, 0.7]) {
    const noz = K.cyl(0.5, 0.44, 1.2, metal, 16); noz.rotation.x = Math.PI / 2; noz.position.set(sx, -0.05, 8.1); g.add(noz);
    const inside = new THREE.Mesh(new THREE.CircleGeometry(0.4, 14), dark); inside.position.set(sx, -0.05, 8.68); g.add(inside);
  }
  const ab = new THREE.Group(); ab.name = "afterburner"; ab.visible = false;
  for (const sx of [-0.7, 0.7]) {
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.42, 4, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    outer.rotation.x = -Math.PI / 2; outer.position.set(sx, -0.05, 10.7); ab.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.26, 2.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xa8d0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    inner.rotation.x = -Math.PI / 2; inner.position.set(sx, -0.05, 9.8); ab.add(inner);
  }
  g.add(ab);
  // Misiles: en las puntas y bajo las alas; cañón a la derecha del morro; pitot
  g.add(K.pair(() => K.missile(3.0, 0.1), 6.35, -0.15, 2.9));
  g.add(K.pair(() => K.missile(3.2, 0.12), 3.2, -0.62, 1.6));
  g.add(K.pair(() => new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 1.6), metal), 3.2, -0.38, 1.6));
  const gun = K.cyl(0.05, 0.05, 0.7, dark, 6); gun.rotation.x = Math.PI / 2; gun.position.set(0.95, 0.32, -5.6); g.add(gun);
  const pit = K.cyl(0.025, 0.025, 1.1, K.paint(0x9aa0a6, 60), 6); pit.rotation.x = Math.PI / 2; pit.position.set(0, 0, -8.8); g.add(pit);
  // Tren retráctil
  const gear = new THREE.Group(); gear.name = "gear";
  const gm = K.paint(0xb9bec4, 90);
  for (const sx of [-1, 1]) { const w = K.wheel(0.4, 0.24); w.position.set(sx * 1.7, -1.75, 1.0); gear.add(w); gear.add(K.strut([sx * 1.4, -0.5, 1.1], [sx * 1.6, -1.7, 1.0], 0.08, gm)); }
  const nw = K.wheel(0.3, 0.16); nw.position.set(0, -1.8, -5.2); gear.add(nw); gear.add(K.strut([0, -0.6, -5.1], [0, -1.75, -5.2], 0.07, gm));
  g.add(gear);
  return g;
}

/** Las dos naves de los Guardianes, con los valores del motor (ver aircraft.js) */
export function sgPlanes(AIRCRAFT) {
  const base = AIRCRAFT.find(a => a.id === "fighter") || {};
  return [
    { id: SG_ATTACK, name: { es: "Avioneta de combate", en: "Light attack plane" }, desc: { es: "", en: "" },
      vmax: 590 * KMH, vstall: 125 * KMH, accel: 9.5, roll: 3.3, pitch: 1.7, yaw: 0.65, spawnAlt: 700, camDist: 19, gear: 1.6,
      model: "sgattack", retract: true, len: 11.4, span: 11.1, color: 0x68727a, trim: 0xb3261e, trim2: 0x2b3440,
      eye: [0, 0.95, -1.5], cruise: 0.75, runway: 400, build: buildAttack },
    { ...base, id: SG_FIGHTER, name: { es: "Caza", en: "Fighter" },
      vmax: 1150 * KMH, vstall: 200 * KMH, accel: 20, roll: 4.2, pitch: 1.9, yaw: 0.55, spawnAlt: 900, camDist: 26,
      color: 0x68727a, trim: 0xb3261e, trim2: 0x262c33, cruise: 0.65, model: "fighter", build: buildFighter, retract: true,
      len: 16.6, span: 12.6, eye: [0, 1.15, -4.6] },
  ];
}
