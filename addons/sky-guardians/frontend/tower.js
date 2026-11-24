/* ═══════════════════════════════════════════════════════════════════════════
   🗼 Sky Guardians — torre de control y comunicaciones (por código, sin modelos externos)
   132 m en total:
     0–66 m    base de hormigón armado escalonada, con contrafuertes, entrada, ventanas y focos
     66–104 m  celosía de acero roja y blanca con núcleo de ascensor y parábolas
     104–116 m estación de control principal: octogonal, acristalada y abierta hacia fuera, con pantallas dentro
     117–124 m estación secundaria, más pequeña
     124–132 m aguja con la baliza de la punta
   Balizas de destello rojas de noche y blancas de día; rojas fijas en la celosía y focos cálidos en la base.
   11 estados: nivel 10 = 100 % … nivel 1 = 10 %, nivel 0 = ruina. El hormigón no se inclina: se quema, pierde
   trozos y le arden las ventanas; lo de encima (celosía y estaciones) se tuerce, se inclina y al final se desploma.
   Todo el daño sale de una semilla: cada torre se rompe a su manera, pero un estado siempre se ve igual.
   createTower(THREE, { seed, wind }) → { root, level, setLevel(L, animate), update(dt, ctx), aimPoint(v), dispose() }
   ctx = { night: bool, light: 0…1, camPos: Vector3 (mundo), scale: alto del lienzo en px / (2·tan(fov/2)) }
   THREE llega de fuera: el mismo que usa el motor de Wiki Flight.
   ═══════════════════════════════════════════════════════════════════════════ */

export const TOWER_H = 132, BASE_HALF = 31;               // BASE_HALF: media anchura de la explanada (para apoyarla)
export const TOWER_SCALE = 3;                             // en el juego, la torre va a 3× su tamaño (396 m): el modelo es el mismo
const PIVOT_Y = 66;                                       // por encima del hormigón es lo que se inclina y cae
const LAT_Y0 = 66, LAT_Y1 = 104, LAT_NS = 4, LAT_SH = (LAT_Y1 - LAT_Y0) / LAT_NS;
const SPIRE_Y = 124;
const hwL = y => 7.0 - 1.2 * (y - LAT_Y0) / (LAT_Y1 - LAT_Y0);                     // media anchura de la celosía
const TIERS = [[0, 24, 16.5, 13.5], [24, 44, 11.8, 10.4], [44, 66, 9.4, 8.0]];     // hormigón: y0, y1, media anchura abajo/arriba
const hwC = y => { for (const [a, b, w0, w1] of TIERS) if (y <= b) return w0 + (w1 - w0) * (y - a) / (b - a); return 8; };
const C_RED = 0xc8261e, C_WHITE = 0xeeeeea, C_GALV = 0x9aa1a8;

// Por nivel (índice = nivel 0…10)
const LIGHTS_OFF = [1, 0.95, 0.85, 0.7, 0.6, 0.45, 0.35, 0.25, 0.15, 0.1, 0];
const LEAN_DEG = [0, 10, 6.5, 4, 2, 0.8, 0, 0, 0, 0, 0];
const SPIRE_DEG = [0, 28, 20, 14, 9, 4, 0, 0, 0, 0, 0];
const REMOVE_N = [0, 10, 9, 8, 8, 7, 6, 5, 4, 3, 0];      // barras que arranca el impacto de ese nivel
const GLASS_BROKEN = [1, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.12, 0.06, 0];   // cristales rotos (además de los del impacto)
// Dónde golpea cada nivel: estación (cab), celosía (lat) u hormigón (con)
const HIT_ZONE = { 9: "cab", 8: "lat", 7: "con", 6: "lat", 5: "cab", 4: "con", 3: "lat", 2: "cab", 1: "con" };

function rng(seed) {   // mulberry32
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── Recursos compartidos (uno por instancia de THREE) ──
let R = null;
function resources(THREE) {
  if (R && R.THREE === THREE) return R;
  const canvas = n => { const c = document.createElement("canvas"); c.width = c.height = n; return c; };
  const tex = (draw, n = 64, repeat = false) => {
    const c = canvas(n); draw(c.getContext("2d"), n);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
    return t;
  };
  const radial = (stops, n = 64) => tex((g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); for (const [o, c] of stops) gr.addColorStop(o, c); g.fillStyle = gr; g.fillRect(0, 0, n, n); }, n);
  const smokeTex = tex((g, n) => {   // bola de humo con algo de textura
    const r = rng(7);
    for (let i = 0; i < 26; i++) {
      const x = n / 2 + (r() - 0.5) * n * 0.45, y = n / 2 + (r() - 0.5) * n * 0.45, rad = n * (0.14 + r() * 0.2);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, "rgba(255,255,255,0.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    }
    g.globalCompositeOperation = "destination-in";
    const m = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); m.addColorStop(0, "#fff"); m.addColorStop(0.65, "rgba(255,255,255,.8)"); m.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = m; g.fillRect(0, 0, n, n);
  }, 128);
  // Hormigón: placas con juntas, manchas verticales de lluvia y algo de grano
  const concreteTex = tex((g, n) => {
    const r = rng(11);
    g.fillStyle = "#b9b5ad"; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) { const v = 150 + r() * 70 | 0; g.fillStyle = `rgba(${v},${v - 3},${v - 8},.18)`; g.fillRect(r() * n, r() * n, 2, 2); }
    for (let i = 0; i < 18; i++) { const x = r() * n, w = 2 + r() * 6; const gr = g.createLinearGradient(0, 0, 0, n); gr.addColorStop(0, "rgba(70,66,60,.16)"); gr.addColorStop(1, "rgba(70,66,60,0)"); g.fillStyle = gr; g.fillRect(x, r() * n * 0.5, w, n * (0.3 + r() * 0.5)); }
    g.strokeStyle = "rgba(60,58,54,.45)"; g.lineWidth = 2;
    for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(0, k * n / 4); g.lineTo(n, k * n / 4); g.stroke(); }
    for (let k = 0; k <= 2; k++) { g.beginPath(); g.moveTo(k * n / 2, 0); g.lineTo(k * n / 2, n); g.stroke(); }
    g.fillStyle = "rgba(40,40,40,.35)";
    for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc((j + 0.5) * n / 4, (k + 0.5) * n / 4, 1.6, 0, 7); g.fill(); }   // agujeros de los encofrados
  }, 256, true);
  // Interior de las estaciones: oscuro, techo con tira roja, fila de pantallas azules y siluetas de puestos
  const interiorTex = tex((g, n) => {
    const r = rng(23);
    const gr = g.createLinearGradient(0, 0, 0, n); gr.addColorStop(0, "#1a1d24"); gr.addColorStop(1, "#0c0e12"); g.fillStyle = gr; g.fillRect(0, 0, n, n);
    g.fillStyle = "#ff3a2a"; g.fillRect(0, n * 0.06, n, n * 0.035);
    g.fillStyle = "#e8eef8"; for (let i = 0; i < 8; i++) g.fillRect(i * n / 8 + 6, n * 0.14, n / 8 - 12, n * 0.015);
    for (let i = 0; i < 16; i++) { const x = i * n / 16 + 3; g.fillStyle = `hsl(${205 + r() * 20},90%,${55 + r() * 20}%)`; g.fillRect(x, n * 0.52, n / 16 - 6, n * 0.12); }
    g.fillStyle = "#05070a"; for (let i = 0; i < 10; i++) { const x = r() * n; g.fillRect(x, n * 0.62, 10, n * 0.3); g.beginPath(); g.arc(x + 5, n * 0.6, 6, 0, 7); g.fill(); }
    g.fillStyle = "#2a2f38"; g.fillRect(0, n * 0.66, n, n * 0.08);
  }, 256, true);
  R = {
    THREE,
    cyl: new THREE.CylinderGeometry(1, 1, 1, 6, 1, false),
    box: new THREE.BoxGeometry(1, 1, 1),
    steel: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.35, roughness: 0.55 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.5, roughness: 0.5 }),
    dish: new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: 0.42, metalness: 0.1, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0x8fb3cc, metalness: 0.9, roughness: 0.08, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }),
    crater: new THREE.MeshStandardMaterial({ color: 0x2c2925, roughness: 1 }),
    glow: radial([[0, "rgba(255,255,255,1)"], [0.18, "rgba(255,255,255,.85)"], [0.45, "rgba(255,255,255,.18)"], [1, "rgba(255,255,255,0)"]]),
    fireTex: radial([[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,.6)"], [1, "rgba(255,255,255,0)"]]),
    smokeTex, concreteTex, interiorTex,
    scorch: radial([[0, "rgba(0,0,0,.88)"], [0.5, "rgba(12,9,6,.6)"], [1, "rgba(0,0,0,0)"]], 128),
  };
  return R;
}

// ── Partículas (fuego, humo, chispas): un THREE.Points con tamaño, color y alfa por partícula ──
export class Particles {
  constructor(THREE, max, map, additive) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.age = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4); this.c1 = new Float32Array(max * 4);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", this.aPos); g.setAttribute("aSize", this.aSize); g.setAttribute("aCol", this.aCol);
    g.setDrawRange(0, 0);
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, uScale: { value: 800 }, uLight: { value: 1 } }]);
    uniforms.map.value = map;
    this.mat = new THREE.ShaderMaterial({
      uniforms, fog: !additive, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float aSize; attribute vec4 aCol; uniform float uScale; varying vec4 vC;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = min(aSize * uScale / max(-mvPosition.z, 1.0), 600.0);
  vC = aCol;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`,
      fragmentShader: `uniform sampler2D map; uniform float uLight; varying vec4 vC;
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vC.rgb * t.rgb * uLight, vC.a * t.a);
  if (gl_FragColor.a < 0.004) discard;
  #include <fog_fragment>
}`,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 3 : 2;
  }
  // c0/c1: [r,g,b,a] al nacer y al morir
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag = 0, grav = 0) {
    if (this.n >= this.max) return;
    const i = this.n++, i3 = i * 3, i4 = i * 4;
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z; this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.life[i] = life; this.age[i] = 0; this.s0[i] = s0; this.s1[i] = s1; this.drag[i] = drag; this.grav[i] = grav;
    for (let k = 0; k < 4; k++) { this.c0[i4 + k] = c0[k]; this.c1[i4 + k] = c1[k]; }
  }
  update(dt, wx, wz, scale, light = 1) {
    this.mat.uniforms.uLight.value = light;
    const P = this.aPos.array, S = this.aSize.array, C = this.aCol.array;
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {   // se cambia por la última
        const j = --this.n; if (i !== j) this._move(j, i); continue;
      }
      const i3 = i * 3, i4 = i * 4, f = this.age[i] / this.life[i], d = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i3] = this.v[i3] * d + (wx - this.v[i3]) * Math.min(1, this.drag[i] * dt) * 0.5;
      this.v[i3 + 2] = this.v[i3 + 2] * d + (wz - this.v[i3 + 2]) * Math.min(1, this.drag[i] * dt) * 0.5;
      this.v[i3 + 1] = this.v[i3 + 1] * d - this.grav[i] * dt;
      for (let k = 0; k < 3; k++) { this.p[i3 + k] += this.v[i3 + k] * dt; P[i3 + k] = this.p[i3 + k]; }
      S[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(f);
      for (let k = 0; k < 4; k++) C[i4 + k] = this.c0[i4 + k] + (this.c1[i4 + k] - this.c0[i4 + k]) * f;
      C[i4 + 3] *= Math.min(1, f * 8);   // entra suave
      i++;
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aCol.needsUpdate = true;
    this.mat.uniforms.uScale.value = scale;
  }
  _move(j, i) {
    const a3 = [this.p, this.v], a1 = [this.life, this.age, this.s0, this.s1, this.drag, this.grav], a4 = [this.c0, this.c1];
    for (const a of a3) for (let k = 0; k < 3; k++) a[i * 3 + k] = a[j * 3 + k];
    for (const a of a1) a[i] = a[j];
    for (const a of a4) for (let k = 0; k < 4; k++) a[i * 4 + k] = a[j * 4 + k];
  }
  clear() { this.n = 0; this.points.geometry.setDrawRange(0, 0); }
  dispose() { this.points.geometry.dispose(); this.mat.dispose(); }
}

export function createTower(THREE, opts = {}) {
  const RS = resources(THREE), seed = opts.seed || 1, rnd = rng(seed);
  const wind = opts.wind || new THREE.Vector3(3, 0, 1.2);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const SQ2 = Math.SQRT2, UP = V(0, 1, 0);
  const P = (r, th, y) => V(r * Math.sin(th), y, r * Math.cos(th));   // polar: θ = 0 → +z, θ = π/2 → +x
  const OCT = i => Math.PI / 8 + i * Math.PI / 4;                       // vértices de los octógonos (caras hacia los ejes)
  const root = new THREE.Group(); root.name = "sg-tower";
  const SC = opts.scale || 1; root.scale.setScalar(SC);   // todo crece igual; las partículas, también (abajo)
  const upper = new THREE.Group(); upper.matrixAutoUpdate = false; root.add(upper);    // celosía y estaciones (se inclinan)
  const spireG = new THREE.Group(); spireG.matrixAutoUpdate = false; upper.add(spireG); // la aguja (se dobla)
  const disposables = [];

  // Materiales propios de esta torre (se ensucian con el daño)
  const concrete = new THREE.MeshStandardMaterial({ map: RS.concreteTex, emissiveMap: RS.concreteTex, emissive: 0x000000, roughness: 0.95 });   // de noche, como iluminada por los focos
  const shell = new THREE.MeshStandardMaterial({ color: 0xe6e6e2, roughness: 0.5, metalness: 0.2 });
  const redPaint = new THREE.MeshStandardMaterial({ color: C_RED, roughness: 0.5, metalness: 0.2 });
  const interior = new THREE.MeshBasicMaterial({ map: RS.interiorTex });
  const winOn = new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), winOff = new THREE.MeshBasicMaterial({ color: 0x15171a });
  const redStrip = new THREE.MeshBasicMaterial({ color: 0xff2a1a }), led = new THREE.MeshBasicMaterial({ color: 0xdfe8ff });
  disposables.push(concrete, shell, redPaint, interior, winOn, winOff, redStrip, led);

  const mesh = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = root) => {
    const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz);
    o.castShadow = o.receiveShadow = !mat.transparent && mat.type !== "MeshBasicMaterial"; parent.add(o); return o;
  };
  const own = g => { disposables.push(g); return g; };
  const scaleUV = (g, su, sv) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; };
  const sqFrustum = (w0, w1, h) => own(new THREE.CylinderGeometry(w1 * SQ2, w0 * SQ2, h, 4, 1, false, Math.PI / 4));
  const octPrism = (r0, r1, h, open = false) => own(new THREE.CylinderGeometry(r1, r0, h, 8, 1, open, Math.PI / 8));
  const wedge = (pts, depth) => {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2);
    return scaleUV(own(g), 1 / 16, 1 / 16);
  };

  // ═══ Barras de acero (una sola InstancedMesh) ═══
  const M = [];   // { a, b, r, kind, col, removeAt, bentAt, ja, jb }
  const add = (a, b, r, kind, col) => { M.push({ a, b, r, kind, col, removeAt: -1, bentAt: -1 }); };
  const corner = (c, y) => { const w = hwL(y), s = [[1, 1], [-1, 1], [-1, -1], [1, -1]][c]; return V(s[0] * w, y, s[1] * w); };
  for (let c = 0; c < 4; c++) add(corner(c, 63), corner(c, LAT_Y0), 0.75, "leg", C_RED);              // las patas entran en el hormigón
  for (let i = 0; i < LAT_NS; i++) {
    const y0 = LAT_Y0 + i * LAT_SH, y1 = y0 + LAT_SH;
    for (let c = 0; c < 4; c++) add(corner(c, y0), corner(c, y1), 0.72 - 0.06 * i, "leg", C_RED);
    for (let c = 0; c < 4; c++) {
      const n = (c + 1) % 4;
      if (i === 0) add(corner(c, y0), corner(n, y0), 0.32, "hor", C_WHITE);
      add(corner(c, y1), corner(n, y1), 0.32, "hor", C_WHITE);
      const dc = i % 2 ? C_WHITE : C_RED;
      add(corner(c, y0), corner(n, y1), 0.24, "diag", dc); add(corner(n, y0), corner(c, y1), 0.24, "diag", dc);
      // celosía secundaria: un montante a media cara
      const m0 = corner(c, y0).lerp(corner(n, y0), 0.5), m1 = corner(c, y1).lerp(corner(n, y1), 0.5);
      add(m0, m1, 0.14, "diag", C_WHITE);
    }
    add(corner(i % 2, y1), corner((i % 2) + 2, y1), 0.1, "plan", C_WHITE);
  }
  // Montantes de los cristales y barandillas de las estaciones
  const CABS = [
    { y0: 105, y1: 112, rB: 11.2, rT: 12.7, railR: 12.2, railY: 113.4 },   // principal
    { y0: 118.6, y1: 122.6, rB: 6.8, rT: 7.6, railR: 7.3, railY: 123.6 },  // secundaria
  ];
  for (const c of CABS) for (let i = 0; i < 8; i++) {
    add(P(c.rB, OCT(i), c.y0), P(c.rT, OCT(i), c.y1), 0.16, "mull", C_WHITE);
    add(P(c.railR, OCT(i), c.railY), P(c.railR, OCT(i), c.railY + 1.1), 0.06, "rail", C_GALV);
    add(P(c.railR, OCT(i), c.railY + 1.1), P(c.railR, OCT(i + 1), c.railY + 1.1), 0.05, "rail", C_GALV);
  }
  // Antenas de látigo en el techo principal y la aguja
  const whipTops = [];
  for (let i = 0; i < 4; i++) { const th = OCT(i * 2) + 0.2, b = P(10.4, th, 113.4), t = P(10.4, th, 121.5); add(b, t, 0.07, "whip", C_GALV); whipTops.push(t); }
  {
    const sc = (c, y) => { const w = 2.0 * (1 - (y - SPIRE_Y) / 7), s = [[1, 1], [-1, 1], [-1, -1], [1, -1]][c]; return V(s[0] * w, y, s[1] * w); };
    const lv = [124, 126.2, 128.4, 130.6];
    for (let k = 0; k < 3; k++) for (let c = 0; c < 4; c++) {
      const n = (c + 1) % 4;
      add(sc(c, lv[k]), sc(c, lv[k + 1]), 0.18, "spire", k % 2 ? C_WHITE : C_RED);
      add(sc(c, lv[k + 1]), sc(n, lv[k + 1]), 0.08, "spire", C_WHITE);
      add(sc(c, lv[k]), sc(n, lv[k + 1]), 0.06, "spire", C_RED);
    }
    add(V(0, 130.6, 0), V(0, 133, 0), 0.08, "spire", C_GALV);
  }
  // Valla de la explanada
  const FW = 30.2;
  for (let s = 0; s < 4; s++) {
    const d = [[1, 0], [0, 1], [-1, 0], [0, -1]][s], st = [[-FW, -FW], [FW, -FW], [FW, FW], [-FW, FW]][s], n = 10, L = 2 * FW / n;
    for (let k = 0; k < n; k++) {
      const x = st[0] + d[0] * k * L, z = st[1] + d[1] * k * L, x2 = x + d[0] * L, z2 = z + d[1] * L;
      if (s === 1 && Math.abs((x + x2) / 2) < 8) continue;   // hueco de la entrada
      add(V(x, 1.8, z), V(x, 3.6, z), 0.05, "fence", C_GALV);
      add(V(x, 3.6, z), V(x2, 3.6, z2), 0.03, "fence", C_GALV);
    }
  }
  // Hierros del hormigón roto (solo en la ruina)
  const rr = rng(seed * 5 + 3);
  for (let i = 0; i < 22; i++) {
    const th = rr() * Math.PI * 2, r = 2 + rr() * 6, a = P(r, th, 65.5), b = a.clone().add(V((rr() - 0.5) * 3, 1.5 + rr() * 4, (rr() - 0.5) * 3));
    add(a, b, 0.06, "rebar", 0x5a4a3c);
  }
  const inst = new THREE.InstancedMesh(RS.cyl, RS.steel, M.length);
  inst.castShadow = true; inst.receiveShadow = true; inst.frustumCulled = false;
  root.add(inst);
  const _col = new THREE.Color();
  M.forEach((m, i) => inst.setColorAt(i, _col.setHex(m.col)));
  M.forEach(m => { m.ja = V((rnd() - 0.5) * 1.6, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.6); m.jb = V((rnd() - 0.5) * 1.6, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.6); });

  // ═══ Base de hormigón (0–66 m) ═══
  {
    const g = scaleUV(own(new THREE.BoxGeometry(2 * FW + 1.6, 4.2, 2 * FW + 1.6)), 4, 0.3);
    mesh(g, concrete, 0, -1.5, 0);                                                       // explanada (se hunde en la ladera)
    const wallG = scaleUV(own(new THREE.BoxGeometry(1, 1, 1)), 3, 0.2);
    for (const [x, z, sx, sz] of [[0, -FW, 2 * FW, 0.7], [FW, 0, 0.7, 2 * FW], [-FW, 0, 0.7, 2 * FW], [-(FW + 8) / 2, FW, FW - 8, 0.7], [(FW + 8) / 2, FW, FW - 8, 0.7]]) mesh(wallG, concrete, x, 1.2, z, sx, 1.4, sz);
  }
  for (const [a, b, w0, w1] of TIERS) {
    const g = sqFrustum(w0, w1, b - a); scaleUV(g, (w0 + w1) * 4 / 16, (b - a) / 16);
    mesh(g, concrete, 0, (a + b) / 2, 0);
    const lg = sqFrustum(w1 + 1.1, w1 + 0.7, 0.9); scaleUV(lg, 4, 0.1);
    mesh(lg, concrete, 0, b + 0.45, 0);                                                 // cornisa
  }
  // Contrafuertes: grandes en las esquinas, a los lados de la entrada y en el centro de las otras caras; pequeños arriba
  const buttress = (pts, depth, r, th, y = 0) => { const o = mesh(wedge(pts, depth), concrete, r * Math.sin(th), y, r * Math.cos(th)); o.rotation.y = th - Math.PI / 2; return o; };
  for (let k = 0; k < 4; k++) buttress([[-11, 0], [13, 0], [-8.5, 40], [-11, 40]], 3.4, 16.5 * SQ2, Math.PI / 4 + k * Math.PI / 2);
  for (let k = 1; k < 4; k++) buttress([[-7, 0], [8, 0], [-5.2, 26], [-7, 26]], 2.6, 16.5, k * Math.PI / 2);
  for (const dx of [-8.5, 8.5]) { const o = buttress([[-7, 0], [9, 0], [-5.2, 28], [-7, 28]], 2.8, 16.5, 0); o.position.x += dx; }
  for (let k = 0; k < 4; k++) buttress([[-6, 0], [5, 0], [-4.4, 18], [-6, 18]], 2.2, 11.8 * SQ2, Math.PI / 4 + k * Math.PI / 2, 24.9);
  // Entrada (cara +z): pórtico, hueco oscuro, puerta iluminada y rótulo
  mesh(scaleUV(own(new THREE.BoxGeometry(1, 1, 1)), 1, 0.6), concrete, 0, 5.2, 18.6, 13, 9.2, 5.2);
  mesh(RS.box, RS.crater, 0, 3.8, 21.25, 8.4, 5.6, 0.3);
  const doorMesh = mesh(RS.box, winOn, 0, 3.5, 21.45, 7, 4.4, 0.1);
  mesh(RS.box, winOn, 0, 7.6, 21.3, 6, 0.5, 0.1);
  // Ventanas: rendijas verticales en cada cara (luz cálida de noche)
  const windows = [];
  const WIN = [[12, 6, [-6, 6]], [33, 6, [-4.5, 0, 4.5]], [53, 6, [-3.5, 3.5]], [60, 2.5, [-5, -2.5, 0, 2.5, 5]]];
  for (let k = 0; k < 4; k++) {
    const th = k * Math.PI / 2, tang = V(Math.cos(th), 0, -Math.sin(th));
    for (const [y, h, xs] of WIN) for (const x of xs) {
      if (k === 0 && y < 20) continue;   // en la cara de la entrada, abajo no
      const p = P(hwC(y) + 0.12, th, y).addScaledVector(tang, x * hwC(y) / 10);
      const o = mesh(RS.box, winOn, p.x, p.y, p.z, 0.9, h, 0.3); o.rotation.y = th;
      windows.push({ o, p, th, offAt: -1 });
    }
  }
  windows.push({ o: doorMesh, p: V(0, 3.5, 21.4), th: 0, offAt: -1 });
  // Restos del hormigón roto arriba (solo en la ruina)
  const crumble = [];
  for (let i = 0; i < 12; i++) {
    const th = rr() * Math.PI * 2, r = rr() * 6.5, s = 2 + rr() * 3.5;
    const o = mesh(RS.box, concrete, r * Math.sin(th), 66.5 + rr() * 1.5, r * Math.cos(th), s, 1.5 + rr() * 2.5, s * (0.6 + rr() * 0.6));
    o.rotation.set((rr() - 0.5) * 0.8, rr() * 3, (rr() - 0.5) * 0.8); o.visible = false; crumble.push(o);
  }

  // ═══ Núcleo del ascensor dentro de la celosía ═══
  mesh(scaleUV(own(new THREE.BoxGeometry(1, 1, 1)), 0.4, 2.4), concrete, 0, 85, 0, 4.6, 38, 4.6, upper);
  for (const th of [0, Math.PI]) { const p = P(2.35, th, 85); const o = mesh(RS.box, winOn, p.x, p.y, p.z, 0.6, 34, 0.1, upper); o.rotation.y = th; }

  // ═══ Estaciones de control ═══
  const panes = [];
  const quad = (a, b, c, d) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); return own(g);
  };
  const cabGroups = CABS.map((c, ci) => {
    const g = new THREE.Group(); upper.add(g);
    const big = ci === 0;
    const fl = big ? [8.4, 11.6, 2.4, 103.8] : [5.2, 7.0, 1.6, 117.8];
    mesh(octPrism(fl[0], fl[1], fl[2]), shell, 0, fl[3], 0, 1, 1, 1, g);                                         // suelo, abierto hacia fuera
    mesh(octPrism(fl[0] + 0.1, fl[0] + 0.15, 0.3, true), led, 0, fl[3] - fl[2] / 2 + 0.1, 0, 1, 1, 1, g);       // tira de luz debajo
    const ig = scaleUV(octPrism(c.rB - 1.0, c.rT - 1.6, c.y1 - c.y0, true), big ? 4 : 2, 1);
    mesh(ig, interior, 0, (c.y0 + c.y1) / 2, 0, 1, 1, 1, g);                                                      // pantallas y puestos
    for (let i = 0; i < 8; i++) {
      const a = P(c.rB, OCT(i), c.y0), b = P(c.rB, OCT(i + 1), c.y0), d = P(c.rT, OCT(i), c.y1), e = P(c.rT, OCT(i + 1), c.y1);
      const o = new THREE.Mesh(quad(a, b, e, d), RS.glass); o.renderOrder = 1; g.add(o);
      panes.push({ o, c: a.clone().add(b).add(d).add(e).multiplyScalar(0.25), breakAt: -1 });
    }
    const rf = big ? [12.9, 12.3, 1.4, 112.7] : [7.9, 7.3, 1.0, 123.1];
    mesh(octPrism(rf[0], rf[1], rf[2]), shell, 0, rf[3], 0, 1, 1, 1, g);                                          // techo
    mesh(octPrism(rf[0] + 0.05, rf[0] + 0.05, 0.3, true), redStrip, 0, rf[3] - rf[2] / 2 + 0.25, 0, 1, 1, 1, g); // tira roja del borde
    return g;
  });
  mesh(own(new THREE.CylinderGeometry(3.4, 3.4, 4.4, 16)), shell, 0, 115.6, 0, 1, 1, 1, cabGroups[0]);            // cuello entre las dos
  mesh(own(new THREE.CylinderGeometry(3.45, 3.45, 0.8, 16)), redPaint, 0, 115.6, 0, 1, 1, 1, cabGroups[0]);

  // ═══ Parábolas (en las caras de la celosía y una en el techo) ═══
  const dishGeo = D => {
    const f = 0.38 * D, R0 = D / 2, pts = [];
    for (let i = 0; i <= 12; i++) { const r = R0 * i / 12; pts.push(new THREE.Vector2(r, r * r / (4 * f))); }
    return { g: own(new THREE.LatheGeometry(pts, 28)), f, depth: R0 * R0 / (4 * f) };
  };
  const DISH_SPEC = [[99, 0.08, 4.6], [92, Math.PI / 2 + 0.05, 4.0], [84, Math.PI - 0.06, 4.2], [76, 1.5 * Math.PI, 3.6], [97, 1.25 * Math.PI, 3.2], [114.4, 0.9, 2.4, 11.4]];
  const dishes = DISH_SPEC.map(([y, th, D, rOver]) => {
    const { g, f, depth } = dishGeo(D);
    const grp = new THREE.Group();
    const bowl = new THREE.Group(); bowl.rotation.x = Math.PI / 2; grp.add(bowl);   // eje del plato → +Z
    const dm = new THREE.Mesh(g, RS.dish); dm.castShadow = true; bowl.add(dm);
    const rim = new THREE.Mesh(own(new THREE.TorusGeometry(D / 2, 0.06, 6, 28)), RS.dish); rim.rotation.x = Math.PI / 2; rim.position.y = depth; bowl.add(rim);
    mesh(RS.cyl, RS.darkMetal, 0, -0.35, 0, D * 0.12, 0.7, D * 0.12, bowl);
    mesh(RS.cyl, RS.darkMetal, 0, f, 0, 0.16, 0.5, 0.16, bowl);
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI * 2 / 3, p = V(Math.cos(a) * D * 0.45, depth * 0.95, Math.sin(a) * D * 0.45), q = V(0, f, 0);
      const s = new THREE.Mesh(RS.cyl, RS.darkMetal), d = q.clone().sub(p);
      s.position.copy(p).add(q).multiplyScalar(0.5); s.quaternion.setFromUnitVectors(UP, d.clone().normalize()); s.scale.set(0.03, d.length(), 0.03); bowl.add(s);
    }
    mesh(RS.cyl, RS.darkMetal, 0, 0, -0.9, 0.12, 0.12, 1.4, grp).rotation.x = Math.PI / 2;   // brazo hasta la celosía
    const r = rOver || hwL(y) + 1.4 + D * 0.12;
    const home = { pos: P(r, th, y), rotY: th };
    grp.position.copy(home.pos); grp.rotation.y = th;
    upper.add(grp);
    return { grp, home, D, th, state: 0 };
  });

  // ═══ Balizas y focos ═══
  const lights = [];
  const lightAt = (p, kind, parent) => {
    const house = mesh(RS.box, new THREE.MeshBasicMaterial({ color: 0x330a08 }), p.x, p.y, p.z, 0.5, 0.5, 0.5, parent);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: RS.glow, color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    glow.position.copy(p); parent.add(glow);
    lights.push({ house, glow, kind, off: false, offAt: -1 });
  };
  for (let i = 0; i < 8; i++) lightAt(P(12.95, OCT(i), 113.6), "med", upper);
  for (let i = 0; i < 4; i++) lightAt(P(7.95, OCT(i * 2 + 1), 124.2), "med", upper);
  for (const t of whipTops) lightAt(t.clone().setY(t.y + 0.3), "med", upper);
  for (let c = 0; c < 4; c++) { const p = corner(c, 85); lightAt(p.multiplyScalar(1.06).setY(85), "low", upper); }
  for (let c = 0; c < 4; c++) { const s = [[1, 1], [-1, 1], [-1, -1], [1, -1]][c]; lightAt(V(s[0] * 8.9, 67.3, s[1] * 8.9), "low", root); }
  for (let c = 0; c < 4; c++) { const s = [[1, 1], [-1, 1], [-1, -1], [1, -1]][c]; lightAt(V(s[0] * 12.4, 45.2, s[1] * 12.4), "lamp", root); lightAt(V(s[0] * 17.3, 25.2, s[1] * 17.3), "lamp", root); }
  for (let k = 0; k < 4; k++) for (const x of [-18, 18]) { const th = k * Math.PI / 2; if (k === 0 && Math.abs(x) < 9) continue; const p = P(29.6, th, 2.4).addScaledVector(V(Math.cos(th), 0, -Math.sin(th)), x); lightAt(p, "lamp", root); }
  lightAt(V(0, 133.4, 0), "tip", spireG);
  {
    const order = lights.slice(0, -1).sort(() => rnd() - 0.5); order.push(lights[lights.length - 1]);   // la de la punta, la última
    order.forEach((l, i) => { for (let L = 10; L >= 0; L--) if (i < Math.round(LIGHTS_OFF[L] * lights.length)) l.offAt = Math.max(l.offAt, L); });
  }

  // ═══ Impactos: dónde golpea cada nivel ═══
  const hits = [];
  for (let L = 9; L >= 1; L--) {
    const zone = HIT_ZONE[L];
    if (zone === "cab") {
      const big = rnd() < 0.7, th = rnd() * Math.PI * 2;
      hits[L] = { zone, p: big ? P(11.9, th, 106 + rnd() * 5) : P(7.2, th, 119.5 + rnd() * 2.5), th };
    } else if (zone === "lat") {
      const y = 68 + rnd() * 34, f = Math.floor(rnd() * 4);
      hits[L] = { zone, p: corner(f, y).lerp(corner((f + 1) % 4, y), rnd()), th: 0 };
    } else {
      const y = 8 + rnd() * 54, k = Math.floor(rnd() * 4), th = k * Math.PI / 2, x = (rnd() - 0.5) * 1.2 * hwC(y);
      hits[L] = { zone, p: P(hwC(y) + 0.1, th, y).addScaledVector(V(Math.cos(th), 0, -Math.sin(th)), x), th };
    }
  }
  const mid = m => V((m.a.x + m.b.x) / 2, (m.a.y + m.b.y) / 2, (m.a.z + m.b.z) / 2);
  const elig = M.map((m, i) => i).filter(i => ["hor", "diag", "plan", "rail", "mull"].includes(M[i].kind));
  for (let L = 9; L >= 1; L--) {
    const h = hits[L].p;
    const near = elig.filter(i => M[i].removeAt < 0).map(i => [i, mid(M[i]).distanceTo(h)]).filter(x => x[1] < 11).sort((a, b) => a[1] - b[1]);
    near.slice(0, REMOVE_N[L]).forEach(([i]) => { M[i].removeAt = L; });
    M.forEach(m => { if (m.bentAt < 0 && m.kind !== "fence" && m.kind !== "rebar" && mid(m).distanceTo(h) < 7) m.bentAt = L; });
    for (const w of windows) if (w.offAt < 0 && w.p.distanceTo(h) < 10) w.offAt = L;
    for (const g of panes) if (g.breakAt < 0 && g.c.distanceTo(h) < 12) g.breakAt = L;
  }
  { // más cristales rotos según el nivel, al azar; y ventanas apagadas con mucho daño
    const order = panes.filter(g => g.breakAt < 0).sort(() => rnd() - 0.5);
    order.forEach((g, i) => { for (let L = 10; L >= 0; L--) if (i < Math.round(GLASS_BROKEN[L] * panes.length)) g.breakAt = Math.max(g.breakAt, L); });
    for (const w of windows) if (w.offAt < 0 && rnd() < 0.5) w.offAt = 2;
  }
  // Cráteres y quemaduras del hormigón
  const scars = [];
  for (let L = 9; L >= 1; L--) {
    const h = hits[L];
    if (h.zone !== "con") continue;
    const g = new THREE.Group(); g.position.copy(h.p); g.rotation.y = h.th; root.add(g); g.visible = false;
    mesh(RS.box, RS.crater, 0, 0, 0, 4.6, 3.6, 2.0, g);
    for (let k = 0; k < 6; k++) { const o = mesh(RS.cyl, RS.darkMetal, (rnd() - 0.5) * 3.6, (rnd() - 0.5) * 2.8, 0.9, 0.05, 1.4 + rnd() * 1.6, 0.05, g); o.rotation.set(1.2 + rnd() * 0.6, 0, (rnd() - 0.5) * 1.2); }
    const dec = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: RS.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    disposables.push(dec.material); dec.scale.set(15, 15, 1); dec.position.z = 0.35; g.add(dec);
    scars.push({ g, L });
  }
  // Parábolas: en qué nivel se doblan (1, 2), se descuelgan (3) o caen (4)
  const DISH_PLAN = [{ 1: 9, 2: 7, 4: 6 }, { 1: 8, 3: 6, 4: 5 }, { 1: 7, 2: 5, 4: 3 }, { 1: 6, 4: 4 }, { 1: 5, 3: 2 }, { 1: 3 }];
  dishes.slice().sort(() => rnd() - 0.5).forEach((d, j) => { d.plan = DISH_PLAN[j]; });
  const dishStateAt = (d, L) => { let s = 0; for (const k of [1, 2, 3, 4]) if (d.plan[k] != null && L <= d.plan[k]) s = k; return L === 0 ? 4 : s; };

  // ═══ Deformación: inclinación por encima del hormigón, aguja doblada y, al derrumbarse, la caída ═══
  const axis = V(rnd() - 0.5, 0, rnd() - 0.5).normalize();
  const fallDir = new THREE.Vector3().crossVectors(axis, UP).normalize();
  const side = new THREE.Vector3().crossVectors(fallDir, UP);
  const spireAxis = V(rnd() - 0.5, 0, rnd() - 0.5).normalize();
  const st = { lean: 0, spire: 0, off: V(0, 0, 0) };
  const _q = new THREE.Quaternion(), _qs = new THREE.Quaternion(), PIV = V(0, PIVOT_Y, 0), SPIV = V(0, SPIRE_Y, 0);
  function deform(p, out) {
    out.copy(p);
    if (p.y > SPIRE_Y + 0.01 && st.spire) out.sub(SPIV).applyQuaternion(_qs).add(SPIV);
    if (p.y > PIVOT_Y + 0.01) { if (st.lean) out.sub(PIV).applyQuaternion(_q).add(PIV); out.add(st.off); }
    return out;
  }
  const pivotMatrix = (q, piv, off, m) => m.makeTranslation(piv.x + off.x, piv.y + off.y, piv.z + off.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-piv.x, -piv.y, -piv.z));
  const ZOFF = V(0, 0, 0);
  function applyDeform() {
    _q.setFromAxisAngle(axis, st.lean); _qs.setFromAxisAngle(spireAxis, st.spire);
    pivotMatrix(_q, PIV, st.off, upper.matrix); upper.matrixWorldNeedsUpdate = true;
    pivotMatrix(_qs, SPIV, ZOFF, spireG.matrix); spireG.matrixWorldNeedsUpdate = true;
  }

  // ═══ Recolocar las barras según el nivel ═══
  const _a = V(0, 0, 0), _b = V(0, 0, 0), _d = V(0, 0, 0), _m4 = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _s = V(0, 0, 0);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function setMember(i, a, b, r) {
    _d.subVectors(b, a); const len = _d.length();
    if (len < 1e-4) { inst.setMatrixAt(i, ZERO); return; }
    _qq.setFromUnitVectors(UP, _d.multiplyScalar(1 / len)); _s.set(r, len, r);
    _m4.compose(_a.addVectors(a, b).multiplyScalar(0.5), _qq, _s); inst.setMatrixAt(i, _m4);
  }
  const ruinRnd = rng(seed * 31 + 7);
  const ruinPos = M.map(() => null);
  const ALONG0 = 15;   // la parte de arriba cae fuera de la base
  function ruinPoint(p, j) {   // dónde queda tirado un punto de la parte de arriba (a lo largo de la caída)
    const s = Math.max(0, p.y - PIVOT_Y), across = (p.x * side.x + p.z * side.z) * 1.5 + (ruinRnd() - 0.5) * 4;
    const along = ALONG0 + s * 0.97;
    return V(fallDir.x * along + side.x * across + j.x * 2, 0.5 + ruinRnd() * 2.2, fallDir.z * along + side.z * across + j.z * 2);
  }
  const LAT_KINDS = { leg: 1, hor: 1, diag: 1, plan: 1 };
  function layoutMembers(L) {
    const ruin = L === 0;
    M.forEach((m, i) => {
      if (m.kind === "rebar") { if (ruin) setMember(i, m.a, m.b, m.r); else inst.setMatrixAt(i, ZERO); return; }
      const top = Math.max(m.a.y, m.b.y);
      const stub = ruin && LAT_KINDS[m.kind] && top < 76.5;          // el arranque de la celosía queda, retorcido
      if (ruin && top > PIVOT_Y + 0.01 && m.kind !== "fence" && !stub) {
        if (!ruinPos[i]) ruinPos[i] = [ruinPoint(m.a, m.ja), ruinPoint(m.b, m.jb), ruinRnd() < 0.2];
        if (ruinPos[i][2]) { inst.setMatrixAt(i, ZERO); return; }
        setMember(i, ruinPos[i][0], ruinPos[i][1], m.r); return;
      }
      if (stub && m.kind !== "leg" && (i % 3) !== 0) { inst.setMatrixAt(i, ZERO); return; }
      if (m.removeAt >= L && m.removeAt >= 0) { inst.setMatrixAt(i, ZERO); return; }
      const A = deform(m.a, V(0, 0, 0)), B = deform(m.b, V(0, 0, 0));
      if ((m.bentAt >= L && m.bentAt >= 0) || stub) {
        const k = stub ? 2.2 : 1, kl = m.kind === "leg" ? 0.3 : 0.6;
        A.addScaledVector(m.ja, kl * k * (stub ? 0.3 : 1)); B.addScaledVector(m.jb, kl * k);
      }
      setMember(i, A, B, m.r);
    });
    inst.instanceMatrix.needsUpdate = true;
  }
  function colorMembers(L) {
    M.forEach((m, i) => {
      _col.setHex(m.col);
      let dk = 0;
      const p = mid(m);
      for (let k = 9; k >= Math.max(L, 1); k--) { const d = p.distanceTo(hits[k].p); dk += Math.exp(-d * d / 72); }
      if (L === 0 && m.kind !== "fence") dk += 0.45 + ruinRnd() * 0.4;
      _col.multiplyScalar(1 - 0.85 * Math.min(1, dk));
      inst.setColorAt(i, _col);
    });
    inst.instanceColor.needsUpdate = true;
  }

  // ═══ Parábolas según su estado ═══
  const DISH_ROT = [[0, 0], [-0.26, 0.14], [-0.6, 0.35], [1.3, 0.4]];
  function dishRest(d) {
    const gr = rng(seed * 97 + Math.round(d.th * 1000));
    let pos;
    if (L_now === 0) { const s = d.home.pos.y - PIVOT_Y, along = ALONG0 + s * 0.97 + (gr() - 0.5) * 6; pos = V(fallDir.x * along + side.x * (gr() - 0.5) * 12, d.D * 0.18 + 0.5, fallDir.z * along + side.z * (gr() - 0.5) * 12); }
    else { const r = 21 + gr() * 7, a = d.th + (gr() - 0.5) * 0.5; pos = P(r, a, 0.6 + d.D * 0.18); }
    return { pos, rot: new THREE.Euler(Math.PI / 2 + (gr() - 0.5) * 0.5 + (gr() < 0.5 ? Math.PI : 0), gr() * Math.PI * 2, (gr() - 0.5) * 0.4, "YXZ") };
  }
  function placeDish(d, s, animate) {
    const prev = d.state; d.state = s;
    if (s < 4) {
      if (d.grp.parent !== upper) upper.add(d.grp);
      d.grp.position.copy(d.home.pos); d.grp.rotation.set(DISH_ROT[s][0], d.home.rotY, DISH_ROT[s][1], "YXZ");
      if (s === 3) { d.grp.position.y -= 1.6; d.grp.position.addScaledVector(P(1, d.th, 0), 0.8); }
      d.grp.scale.set(1, s >= 2 ? 0.86 : 1, 1);
      d.fall = null; return;
    }
    const rest = dishRest(d);
    if (animate && prev < 4) {
      root.attach(d.grp);
      const out = P(7, d.th, 0);
      d.fall = { v: V(out.x, 2, out.z), w: V(rnd() * 3 - 1.5, rnd() * 2 - 1, rnd() * 3 - 1.5), rest };
    } else {
      root.add(d.grp); d.fall = null;
      d.grp.position.copy(rest.pos); d.grp.rotation.copy(rest.rot); d.grp.scale.set(1, 0.7, 1);
    }
  }
  // Estaciones: en su sitio, o tiradas al final de la caída
  function placeCabs(L) {
    cabGroups.forEach((g, ci) => {
      if (L > 0) { if (g.parent !== upper) upper.add(g); g.position.set(0, 0, 0); g.quaternion.identity(); return; }
      const s = (ci === 0 ? 108 : 120) - PIVOT_Y, along = ALONG0 + s * 0.97;
      root.add(g);
      const q = new THREE.Quaternion().setFromAxisAngle(axis, 1.32 + (ruinRnd() - 0.5) * 0.2);
      // el grupo tiene su contenido a la altura original: se gira alrededor de su centro y se deja en el suelo
      const c = V(0, ci === 0 ? 108 : 120, 0), rot = c.clone().applyQuaternion(q);
      g.quaternion.copy(q);
      g.position.set(fallDir.x * along - rot.x, (ci === 0 ? 6.5 : 4.5) - rot.y, fallDir.z * along - rot.z);
    });
  }

  // ═══ Efectos ═══
  const fire = new Particles(THREE, 360, RS.fireTex, true);
  const smoke = new Particles(THREE, 460, RS.smokeTex, false);
  const sparks = new Particles(THREE, 260, RS.fireTex, true);
  root.add(fire.points, smoke.points, sparks.points);
  const scorch = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: RS.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  disposables.push(scorch.material);
  scorch.rotation.x = -Math.PI / 2; scorch.visible = false; root.add(scorch);
  let emitters = [];
  const chunks = [];
  function buildEmitters(L) {
    emitters = [];
    if (L === 10) return;
    const dark = L <= 3, smokeCol = dark ? [0.1, 0.09, 0.085] : [0.5, 0.5, 0.52];
    for (let k = 9; L > 0 && k >= L; k--) {
      const h = hits[k], lv = k - L;
      let at = h.p;
      if (h.zone === "cab") at = h.p.clone().multiplyScalar(0.85).setY(h.p.y);   // dentro de la estación
      emitters.push({ kind: "sparks", at, rate: 0.35 + 0.1 * lv, acc: rnd() });
      if (k <= 8) emitters.push({ kind: "smoke", at, rate: dark ? 14 : 5 + lv, size: dark ? 8 : 6, col: smokeCol, acc: 0 });
      if (k <= 7) emitters.push({ kind: "fire", at, rate: 22 + 8 * lv, size: (h.zone === "cab" ? 5 : 4) + 1.1 * lv, acc: 0 });
    }
    if (L <= 3 && L > 0) {   // ventanas ardiendo
      windows.filter(w => w.offAt >= L).slice(0, 3).forEach(w => {
        const p = w.p.clone().addScaledVector(P(1, w.th, 0), 0.6);
        emitters.push({ kind: "fire", at: p, rate: 20, size: 3.5, acc: 0, fixed: true }, { kind: "smoke", at: p, rate: 6, size: 6, col: smokeCol, acc: 0, fixed: true });
      });
    }
    if (L === 0) {
      for (let k = 0; k < 5; k++) {
        const s = ALONG0 + 6 + k * 13, p = V(fallDir.x * s, 2, fallDir.z * s);
        emitters.push({ kind: "fire", at: p, rate: k === 3 ? 30 : 16, size: k === 3 ? 7 : 4, acc: 0, fixed: true });
        emitters.push({ kind: "smoke", at: p, rate: 6, size: 11, col: [0.09, 0.085, 0.08], acc: 0, fixed: true });
      }
      const top = V(0, 67, 0);
      emitters.push({ kind: "fire", at: top, rate: 18, size: 5, acc: 0, fixed: true }, { kind: "smoke", at: top, rate: 8, size: 9, col: [0.12, 0.11, 0.1], acc: 0, fixed: true }, { kind: "sparks", at: top, rate: 0.5, acc: 0, fixed: true });
      windows.filter((w, i) => i % 4 === 0).forEach(w => { const p = w.p.clone().addScaledVector(P(1, w.th, 0), 0.6); emitters.push({ kind: "fire", at: p, rate: 10, size: 3, acc: 0, fixed: true }); });
    }
  }
  const _e = V(0, 0, 0);
  function emit(dt) {
    for (const e of emitters) {
      const p = e.fixed ? _e.copy(e.at) : deform(e.at, _e);
      e.acc += dt * e.rate;
      if (e.kind === "sparks") { if (e.acc >= 1) { e.acc = 0; burstSparks(p, 14 + (rnd() * 18) | 0, 1); } continue; }
      while (e.acc >= 1) {
        e.acc -= 1;
        if (e.kind === "fire") {
          const s = e.size * (0.7 + rnd() * 0.6);
          fire.spawn(p.x + (rnd() - 0.5) * e.size * 0.6, p.y + (rnd() - 0.5) * e.size * 0.4, p.z + (rnd() - 0.5) * e.size * 0.6, (rnd() - 0.5) * 1.5, 3 + rnd() * 5, (rnd() - 0.5) * 1.5,
            0.55 + rnd() * 0.55, s * 1.6, s * 0.5, [1, 0.8, 0.4, 1], [1, 0.25, 0.05, 0], 0.6, -3);
        } else {
          const s = e.size * (0.6 + rnd() * 0.5), c = e.col, cv = 0.85 + rnd() * 0.3, a = c[0] < 0.2 ? 0.34 : 0.3;
          smoke.spawn(p.x + (rnd() - 0.5) * 2, p.y + 1, p.z + (rnd() - 0.5) * 2, (rnd() - 0.5) * 2, 7 + rnd() * 5, (rnd() - 0.5) * 2,
            9 + rnd() * 6, s, s * 3.2, [c[0] * cv, c[1] * cv, c[2] * cv, a], [c[0] * cv * 1.6, c[1] * cv * 1.6, c[2] * cv * 1.6, 0], 0.12, -1.2);
        }
      }
    }
  }
  function burstSparks(p, n, power) {
    for (let i = 0; i < n; i++) {
      const v = 6 + rnd() * 14 * power;
      sparks.spawn(p.x, p.y, p.z, (rnd() - 0.5) * v, rnd() * v * 0.7, (rnd() - 0.5) * v, 0.6 + rnd() * 0.9, 0.5 + rnd() * 0.4, 0.15, [1, 0.9, 0.6, 1], [1, 0.4, 0.1, 0], 0.3, 9.8);
    }
  }
  function explosion(p, size = 1, concreteBits = false) {
    for (let i = 0; i < 26 * size; i++) {
      const v = 8 + rnd() * 18;
      fire.spawn(p.x, p.y, p.z, (rnd() - 0.5) * v, (rnd() - 0.3) * v, (rnd() - 0.5) * v, 0.35 + rnd() * 0.45, 6 * size + rnd() * 6 * size, 2, [1, 0.85, 0.5, 1], [0.8, 0.2, 0.05, 0], 2.5, 0);
    }
    for (let i = 0; i < 12 * size; i++) smoke.spawn(p.x, p.y, p.z, (rnd() - 0.5) * 8, rnd() * 6, (rnd() - 0.5) * 8, 4 + rnd() * 3, 6 * size, 22 * size, [0.12, 0.11, 0.1, 0.7], [0.2, 0.19, 0.18, 0], 0.8, -0.3);
    burstSparks(p, 50 * size, 1.5);
    for (let i = 0; i < 6 * size; i++) {   // trozos: barras, o cascotes si es el hormigón
      const c = concreteBits ? new THREE.Mesh(RS.box, concrete) : new THREE.Mesh(RS.cyl, RS.steel);
      if (concreteBits) c.scale.set(0.6 + rnd() * 1.4, 0.5 + rnd(), 0.6 + rnd() * 1.4); else c.scale.set(0.12, 1.5 + rnd() * 2.5, 0.12);
      c.position.copy(p); c.castShadow = true; root.add(c);
      chunks.push({ o: c, v: V((rnd() - 0.5) * 16, 4 + rnd() * 10, (rnd() - 0.5) * 16), w: V(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4), t: 0 });
    }
  }

  // ═══ Nivel ═══
  let L_now = -1, collapse = null;
  const _cw = new THREE.Color(1, 1, 1), _cd = new THREE.Color(0x5e5a55), _sw = new THREE.Color(0xe6e6e2), _sd = new THREE.Color(0x4f4c48);
  function setLevel(L, animate = false) {
    L = Math.max(0, Math.min(10, Math.round(L)));
    const prev = L_now;
    if (L === prev && !animate) return;
    if (animate && L === 0 && prev > 0) {   // se viene abajo: primero cae, luego queda la ruina
      collapse = { t: 0, from: st.lean, prev }; L_now = 0; buildEmitters(prev); return;
    }
    L_now = L; collapse = null;
    st.lean = LEAN_DEG[L] * Math.PI / 180; st.spire = SPIRE_DEG[L] * Math.PI / 180; st.off.set(0, 0, 0);
    applyDeform(); layoutMembers(L); colorMembers(L);
    upper.visible = L > 0;   // en la ruina, estaciones y parábolas pasan a root (tiradas); el resto de upper no se ve
    placeCabs(L);
    for (const d of dishes) placeDish(d, dishStateAt(d, L), animate);
    for (const l of lights) l.off = L <= l.offAt;
    for (const g of panes) g.o.visible = !(L <= g.breakAt) && L > 0;
    for (const w of windows) w.o.material = L <= w.offAt || L === 0 ? winOff : winOn;
    for (const s of scars) s.g.visible = L <= s.L;
    for (const c of crumble) c.visible = L === 0;
    const dirt = (10 - L) / 10;
    concrete.color.copy(_cw).lerp(_cd, dirt * 0.7); shell.color.copy(_sw).lerp(_sd, dirt * 0.8);
    scorch.visible = L <= 5;
    if (L === 0) { scorch.scale.set(40, 100, 1); scorch.position.set(fallDir.x * (ALONG0 + 35), 0.65, fallDir.z * (ALONG0 + 35)); scorch.rotation.z = Math.atan2(fallDir.x, fallDir.z); }
    else { const s = 30 + (5 - L) * 6; scorch.scale.set(s, s, 1); scorch.position.set(0, 0.65, 0); scorch.rotation.z = 0; }
    buildEmitters(L);
    if (animate && L < prev && L > 0) { const h = hits[L]; explosion(deform(h.p, V(0, 0, 0)), 1, h.zone === "con"); }
  }

  // ═══ Cada fotograma ═══
  let time = rnd() * 10;
  const _wp = V(0, 0, 0), _hp = V(0, 0, 0), _hq = V(0, 0, 0), _hqi = new THREE.Quaternion();
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function update(dt, ctx = {}) {
    time += dt;
    const scale = ctx.scale || 800, night = !!ctx.night;
    // Derrumbe: gira sobre lo alto del hormigón y, al ladearse, resbala y cae al suelo
    if (collapse) {
      collapse.t += dt;
      st.lean = collapse.from + 0.25 * collapse.t * collapse.t;
      const k = smooth(0.3, 1.38, st.lean);
      st.off.set(fallDir.x * ALONG0 * k, -PIVOT_Y * k * 0.97, fallDir.z * ALONG0 * k);
      applyDeform(); layoutMembers(collapse.prev);
      if (collapse.t > 0.2 && !collapse.boom) { collapse.boom = true; explosion(V(0, PIVOT_Y + 2, 0), 1.6, true); }
      if (st.lean > 1.38) {
        collapse = null; L_now = -1; setLevel(0, false);
        for (let i = 0; i < 80; i++) {   // polvo al caer
          const a = rnd() * Math.PI * 2, s = ALONG0 + rnd() * 70, p = V(fallDir.x * s, 2, fallDir.z * s);
          smoke.spawn(p.x, p.y, p.z, Math.cos(a) * 9, 1 + rnd() * 3, Math.sin(a) * 9, 5 + rnd() * 4, 10, 32, [0.45, 0.42, 0.38, 0.6], [0.55, 0.52, 0.48, 0], 0.6, -0.2);
        }
        explosion(V(fallDir.x * (ALONG0 + 42), 4, fallDir.z * (ALONG0 + 42)), 1.8);
      }
    }
    // Parábolas que caen
    for (const d of dishes) {
      const f = d.fall; if (!f) continue;
      f.v.y -= 9.8 * dt; d.grp.position.addScaledVector(f.v, dt);
      d.grp.rotation.x += f.w.x * dt; d.grp.rotation.y += f.w.y * dt; d.grp.rotation.z += f.w.z * dt;
      if (d.grp.position.y <= f.rest.pos.y) {
        const r = Math.hypot(d.grp.position.x, d.grp.position.z), k = r > 29 ? 29 / r : 1;   // se queda en la explanada
        d.grp.position.set(d.grp.position.x * k, f.rest.pos.y, d.grp.position.z * k);
        d.grp.rotation.copy(f.rest.rot); d.grp.scale.set(1, 0.7, 1); d.fall = null;
        burstSparks(d.grp.position, 20, 0.6);
        for (let i = 0; i < 8; i++) smoke.spawn(d.grp.position.x, 1, d.grp.position.z, (rnd() - 0.5) * 6, rnd() * 2, (rnd() - 0.5) * 6, 3, 4, 12, [0.5, 0.47, 0.43, 0.5], [0.6, 0.57, 0.53, 0], 0.8, 0);
      }
    }
    // Trozos
    for (let i = chunks.length - 1; i >= 0; i--) {
      const c = chunks[i]; c.t += dt;
      if (c.o.position.y > 0.8) { c.v.y -= 9.8 * dt; c.o.position.addScaledVector(c.v, dt); c.o.rotation.x += c.w.x * dt; c.o.rotation.z += c.w.z * dt; }
      else c.o.position.y = 0.8;
      if (c.t > 8) { root.remove(c.o); chunks.splice(i, 1); }
    }
    // Luces de la torre: ventanas, interior de las estaciones, tiras
    const flick = L_now > 0 && L_now <= 4 && rnd() < 0.12 ? 0.25 : 1;
    winOn.color.setHex(night ? 0xffd9a0 : 0x3d434b);
    concrete.emissive.setHex(night && L_now > 0 ? 0x4a3a28 : 0x000000); concrete.emissiveIntensity = 0.55 * flick;
    const ib = (night ? 1 : 0.55) * (L_now === 0 ? 0 : 0.35 + 0.065 * L_now) * flick;
    interior.color.setRGB(ib, ib, ib);
    redStrip.color.setHex(L_now === 0 ? 0x220806 : night ? 0xff2a1a : 0x9a2018);
    led.color.setHex(L_now === 0 ? 0x111111 : night ? 0xdfe8ff : 0x9aa3ad);
    // Balizas
    const cam = ctx.camPos;
    for (const l of lights) {
      let on = 0;
      const red = l.kind === "lamp" ? false : night;
      if (!l.off) {
        if (l.kind === "low" || l.kind === "lamp") on = night ? 1 : 0;                       // fijas, solo de noche
        else if (night) { const p = time % 1.5; on = p < 0.7 ? Math.min(1, p * 12, (0.7 - p) * 12) : 0; }   // rojas a destellos
        else on = time % 1.5 < 0.09 ? 1 : 0;                                                  // blancas de destello, de día
        if (L_now > 0 && L_now <= 3) on *= rnd() < 0.15 ? 0.1 : 1;
        if (L_now === 1 && l.kind === "tip") on *= 0.5 + 0.5 * Math.sin(time * 23) * Math.sin(time * 7.3);
      }
      const col = l.kind === "lamp" ? 0xffc27a : red ? 0xff2a1a : 0xf4f8ff;
      l.house.material.color.setHex(on > 0.05 ? col : 0x2a1210);
      l.glow.material.color.setHex(col);
      l.glow.material.opacity = on * (l.kind === "low" ? 0.7 : l.kind === "lamp" ? 0.55 : 1);
      l.glow.visible = on > 0.01;
      if (l.glow.visible && cam) {
        l.glow.getWorldPosition(_wp);
        const dist = _wp.distanceTo(cam);
        const [base, k] = l.kind === "lamp" ? [5, 0.006] : l.kind === "low" ? [3.5, 0.012] : night ? [7, 0.024] : [8, 0.022];
        l.glow.scale.setScalar((base + dist * k) / Math.sqrt(SC));   // el halo, a escala de la torre pero sin exagerar
      }
    }
    emit(dt);
    fire.update(dt, wind.x, wind.z, scale * SC);
    smoke.update(dt, wind.x, wind.z, scale * SC, ctx.light ?? (night ? 0.16 : 1));
    sparks.update(dt, wind.x * 0.2, wind.z * 0.2, scale * SC);
  }

  setLevel(10);
  return {
    root,
    get level() { return L_now; },
    setLevel,
    update,
    /** ¿Está este punto (mundo) dentro de la parte maciza de la torre? Para los choques */
    hit(world) {
      const p = root.worldToLocal(_hp.copy(world)), r = Math.max(Math.abs(p.x), Math.abs(p.z)), y = p.y;
      if (y < 0 || y > TOWER_H + 2) return false;
      if (y < PIVOT_Y + 1.2) return r < hwC(y) + 1.5 || (y < 26 && r < 23 && Math.hypot(p.x, p.z) < 23 * (1 - y / 26) + 4);   // hormigón y contrafuertes
      if (L_now === 0) return false;
      const lp = _hq.copy(p);      // se deshace la inclinación: el punto, en la torre derecha
      if (st.lean) lp.sub(PIV).applyQuaternion(_hqi.copy(_q).invert()).add(PIV);
      const rr = Math.hypot(lp.x, lp.z);
      if (lp.y < LAT_Y1) return r < hwL(lp.y) + 1.5;
      if (lp.y < 113.6) return rr < 13;
      if (lp.y < 117.5) return rr < 4;
      if (lp.y < 124.2) return rr < 8;
      return rr < 2.2;
    },
    /** Punto al que apuntan los enemigos (mundo): la estación de control, o lo que queda */
    aimPoint(out = new THREE.Vector3()) { return root.localToWorld(out.set(0, L_now > 0 ? 100 : 40, 0)); },
    dispose() {
      root.parent && root.parent.remove(root);
      fire.dispose(); smoke.dispose(); sparks.dispose(); inst.dispose();
      for (const g of disposables) g.dispose && g.dispose();
      for (const l of lights) { l.house.material.dispose(); l.glow.material.dispose(); }
    },
  };
}
