/* ═══════════════════════════════════════════════════════════════════════════
   🌆 Arena Neón — el escenario propio de Arcade Flow Sky Defender (sin mapa ni descargas)
   Un valle de 28 km: la explanada de la torre en el centro, una ciudad synthwave de avenidas hasta ~3,7 km,
   colinas suaves y un anillo de montañas a 7–10 km con la rejilla de neón por las laderas.
   Pensado para ir ligero en una gráfica integrada (medido en un APU: 60 fps fijos, 3–5 ms por fotograma):
   - suelo: una sola malla (~51.000 triángulos) con avenidas, rejilla, anillo de la explanada y el tráfico
     de luces de las avenidas principales pintados en el sombreador;
   - edificios: un solo InstancedMesh de cajas (bloques, pisos escalonados y antenas) con las ventanas y el
     remate de neón de lo alto pintados en el sombreador (alto y color de cada uno, por instancia);
   - carteles luminosos: 4 InstancedMesh (uno por diseño, dibujados en un lienzo); luces rojas de las antenas,
     otro InstancedMesh que parpadea. ~7 llamadas de dibujo en total.
   El motor (fs-main.js, api.start({ arena })) le pregunta el suelo y los edificios a groundAt / buildingAt.
   ═══════════════════════════════════════════════════════════════════════════ */

// Dónde «está» la arena: en medio del Atlántico (para el sol, la hora y las estaciones; ahí no hay monumentos 3D)
export const ARENA_LL = { lat: 33.5, lon: -32 };

const SIZE = 28000, CELLS = 160;            // suelo: 28 km de lado, celdas de 175 m
const BLOCK = 200, STREET = 40;              // manzanas de 200 m con calles de 40 m (las líneas de la rejilla)
const AVENUE = 800;                          // cada 4 calles, una avenida principal con tráfico de luces
const AVE_HALF = 45;                         // media anchura libre de las avenidas (90 m): caben los aros «Flow» (r 36 m)
const CITY_R = 3700, PLAZA_R = 360;          // la ciudad, y el hueco de la explanada (torre y antiaéreos)
const NEON = ["#ff3fb4", "#29e6ff", "#ff9a3c", "#b45bff", "#3cff9e"];

// Paletas de la arena (mismo escenario, otros colores): suelo, líneas de la rejilla (ciudad / montañas), neones de los
// tejados, fachadas, cielo de día y de noche, sol de franjas y los dos acentos (antiaéreos, focos, perfil enemigo)
export const PALETTES = {
  sunset: {
    ground: ["#2a1b3d", "#241a30", "#3e1f48", "#5e2c5c"], lineA: "#19d9ff", lineB: "#ff38bf",
    neon: ["#ff3fb4", "#29e6ff", "#ff9a3c", "#b45bff", "#3cff9e"], bld: ["#3b3350", "#433a5c", "#352f45", "#4d3f5f", "#2f3448", "#463650"],
    zenD: "#3a2a7a", horD: "#ff8a7a", zenN: "#0a0620", horN: "#4a1240", sunTop: "#ffe14a", sunBot: "#ff3f8a", accA: "#29e6ff", accB: "#ff3fb4",
  },
  midnight: {
    ground: ["#10142a", "#0e1124", "#1a1f45", "#2b3070"], lineA: "#2fd0ff", lineB: "#6a5cff",
    neon: ["#2fd0ff", "#6a5cff", "#3cff9e", "#ff3fb4"], bld: ["#232a48", "#2a3156", "#1e2440", "#30375e", "#262b4a"],
    zenD: "#1a2a6a", horD: "#6a7ad0", zenN: "#02030c", horN: "#141a48", sunTop: "#b8f4ff", sunBot: "#6a5cff", accA: "#2fd0ff", accB: "#6a5cff",
  },
  vapor: {
    ground: ["#2a2440", "#2d2645", "#5a3a78", "#8a5aa0"], lineA: "#5ffbd2", lineB: "#ff7ad9",
    neon: ["#5ffbd2", "#ff7ad9", "#ffd37a", "#9a8cff"], bld: ["#4a3f66", "#54476f", "#463c5e", "#5e4d7a", "#3f3a5c"],
    zenD: "#7a6ad8", horD: "#ffb3d9", zenN: "#1a1036", horN: "#6a2a6a", sunTop: "#fff07a", sunBot: "#ff7ad9", accA: "#5ffbd2", accB: "#ff7ad9",
  },
};
export const PALETTE_IDS = Object.keys(PALETTES);

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Altura del terreno (la misma función para la malla y para los choques)
function heightFn(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const hills = (Math.sin(x * 0.00031 + 1.3) * Math.sin(z * 0.00027 + 0.4) + 0.5 * Math.sin(x * 0.0009 + z * 0.0007)) * 28 * smooth(CITY_R, CITY_R + 1600, r);
  const shape = 0.55 + 0.45 * Math.sin(a * 5 + 1.1) * (0.6 + 0.4 * Math.sin(a * 13 + 0.7)) + 0.18 * Math.sin(a * 29 + 2.0);
  const ring = smooth(6800, 10200, r) * (420 + 760 * Math.max(0, shape));
  return hills + ring;
}

// Generador pseudoaleatorio con semilla (la misma arena siempre)
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Posición y normal en el mundo para los sombreadores (con o sin instancias)
const VERT = `
  vec4 sgWp = vec4(transformed, 1.0);
  vec3 sgWn = objectNormal;
  #ifdef USE_INSTANCING
    sgWp = instanceMatrix * sgWp; sgWn = mat3(instanceMatrix) * sgWn;
  #endif
  vWP = (modelMatrix * sgWp).xyz; vWN = normalize(mat3(modelMatrix) * sgWn);
`;
const addVaryings = (sh, extraV = "", extraF = "", extraMain = "") => {
  sh.vertexShader = "varying vec3 vWP;\nvarying vec3 vWN;\n" + extraV + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n" + VERT + extraMain);
  sh.fragmentShader = "varying vec3 vWP;\nvarying vec3 vWN;\nuniform float uNight;\nuniform float uTime;\nuniform vec3 uLineA;\nuniform vec3 uLineB;\n" + extraF + sh.fragmentShader;
};

// Carteles: 4 diseños synthwave propios (sin marcas), en un lienzo cada uno
function posterTexture(THREE, kind) {
  const W = 256, H = 128, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const grad = (y0, y1, a, b) => { const l = g.createLinearGradient(0, y0, 0, y1); l.addColorStop(0, a); l.addColorStop(1, b); return l; };
  g.fillStyle = "#0b0614"; g.fillRect(0, 0, W, H);
  if (kind === 0) {           // sol de franjas sobre el horizonte
    g.fillStyle = grad(0, H, "#2a0c4a", "#ff3fb4"); g.fillRect(0, 0, W, H);
    g.fillStyle = grad(20, 100, "#ffe14a", "#ff4f7a"); g.beginPath(); g.arc(W / 2, 92, 52, Math.PI, 0); g.fill();
    g.fillStyle = "#2a0c4a"; for (let i = 0; i < 5; i++) g.fillRect(W / 2 - 60, 60 + i * 7, 120, 2 + i * 0.6);
    g.fillStyle = "#29e6ff"; g.fillRect(0, 92, W, 2);
  } else {
    const words = ["NEON", "FLOW", "24 H"], col = ["#29e6ff", "#ff9a3c", "#3cff9e"][kind - 1];
    g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(8, 8, W - 16, H - 16);
    g.font = "italic 900 64px Arial Black, Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = col; g.fillText(words[kind - 1], W / 2, H / 2 + 4);
    g.shadowBlur = 0; g.fillStyle = "#ffffff"; g.globalAlpha = 0.85; g.fillText(words[kind - 1], W / 2, H / 2 + 4); g.globalAlpha = 1;
  }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
  return tx;
}

// maxH: alto máximo de un edificio entero (pisos y antena incluidos): la mitad de la torre, para que destaque
// palette: una de PALETTES · shadows: los edificios hacen sombra (en «Rendimiento», no)
export function createArena(THREE, { seed = 7, maxH = 198, palette = "sunset", shadows = true } = {}) {
  const PAL = PALETTES[palette] || PALETTES.sunset, NEON = PAL.neon;
  const root = new THREE.Group(); root.name = "sg-arena";
  const U = { uNight: { value: 0 }, uTime: { value: 0 }, uLineA: { value: new THREE.Color(PAL.lineA) }, uLineB: { value: new THREE.Color(PAL.lineB) } };
  const disposables = [];
  const keep = x => { disposables.push(x); return x; };

  // ── Suelo ──
  const N = CELLS + 1, H = new Float32Array(N * N), step = SIZE / CELLS, half = SIZE / 2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = heightFn(-half + i * step, -half + j * step);
  const geo = keep(new THREE.PlaneGeometry(SIZE, SIZE, CELLS, CELLS)); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const [cLow, cCity, cHigh, cTop] = PAL.ground.map(x => new THREE.Color(x)), c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k), i = Math.round((x + half) / step), j = Math.round((z + half) / step), h = H[j * N + i];
    pos.setY(k, h);
    c.copy(Math.hypot(x, z) < CITY_R ? cCity : cLow).lerp(cHigh, smooth(60, 500, h)).lerp(cTop, smooth(600, 1100, h));
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const gMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const F = v => v.toFixed(1);
  gMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U); addVaryings(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <color_fragment>", `#include <color_fragment>
        float sgD = length(vWP.xz);
        vec2 sgB = abs(fract(vWP.xz / ${F(BLOCK)} + 0.5) - 0.5) * ${F(BLOCK)};   // distancia al eje de la calle
        vec2 sgA = abs(fract(vWP.xz / ${F(AVENUE)} + 0.5) - 0.5) * ${F(AVENUE)};  // … y al de la avenida principal
        float sgCity = 1.0 - smoothstep(${F(CITY_R - 200)}, ${F(CITY_R + 300)}, sgD);
        float sgIn = sgCity * step(${F(PLAZA_R)}, sgD);
        float sgStreet = max(1.0 - step(${F(STREET / 2)}, min(sgB.x, sgB.y)), 1.0 - step(${F(AVE_HALF - 4)}, min(sgA.x, sgA.y))) * sgIn;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.06, 0.09), sgStreet);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.11, 0.17), 1.0 - smoothstep(${F(PLAZA_R - 40)}, ${F(PLAZA_R)}, sgD));`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        {
          float camD = distance(vWP, cameraPosition);
          float sgFade = 1.0 - smoothstep(2500.0, 9000.0, camD);
          float glow = 0.35 + 0.65 * uNight;
          vec2 g1 = vWP.xz / ${F(BLOCK)}; vec2 f1 = abs(fract(g1 - 0.5) - 0.5) / max(fwidth(g1), vec2(1e-4));
          float l1 = 1.0 - min(min(f1.x, f1.y), 1.0);
          vec2 g2 = vWP.xz / 600.0; vec2 f2 = abs(fract(g2 - 0.5) - 0.5) / max(fwidth(g2), vec2(1e-4));
          float l2 = 1.0 - min(min(f2.x, f2.y), 1.0);
          float mtn = smoothstep(150.0, 450.0, vWP.y);                    // en las laderas, la rejilla más viva
          totalEmissiveRadiance += (l1 * sgIn * uLineA * 0.5 * sgFade
            + l2 * (1.0 - sgCity) * uLineB * (0.4 + 0.5 * mtn) * (1.0 - smoothstep(9000.0, 16000.0, camD))) * glow;
          // anillo de luz alrededor de la explanada
          totalEmissiveRadiance += (1.0 - smoothstep(2.0, 5.0, abs(sgD - ${F(PLAZA_R - 20)}))) * uLineA * (0.6 + 0.6 * uNight);
          // tráfico de las avenidas principales: dos carriles (faros blancos que van, pilotos rojos que vienen)
          if (sgIn > 0.0 && camD < 4500.0) {
            float near = 1.0 - smoothstep(1500.0, 4500.0, camD);
            vec2 lane = sgA;                                   // .x: distancia a una avenida «norte-sur»; .y: «este-oeste»
            float onX = 1.0 - step(9.0, lane.y), onZ = 1.0 - step(9.0, lane.x);
            float sideX = sign(fract(vWP.z / ${F(AVENUE)} + 0.5) - 0.5), sideZ = sign(fract(vWP.x / ${F(AVENUE)} + 0.5) - 0.5);
            float dx = fract((vWP.x + uTime * 22.0 * sideX) / 36.0), dz = fract((vWP.z - uTime * 22.0 * sideZ) / 36.0);
            float laneX = step(3.0, lane.y), laneZ = step(3.0, lane.x);
            float carX = onX * laneX * step(dx, 0.16), carZ = onZ * laneZ * step(dz, 0.16);
            vec3 cx = mix(vec3(1.0, 0.2, 0.18), vec3(1.0, 0.92, 0.75), step(0.0, sideX));
            vec3 cz = mix(vec3(1.0, 0.2, 0.18), vec3(1.0, 0.92, 0.75), step(0.0, sideZ));
            totalEmissiveRadiance += (carX * cx + carZ * cz) * near * (0.5 + 1.3 * uNight);
            // la avenida, algo más clara (farolas)
            totalEmissiveRadiance += max(onX, onZ) * vec3(0.9, 0.55, 0.35) * 0.05 * near * uNight;
          }
        }`);
  };
  const ground = new THREE.Mesh(geo, gMat); ground.receiveShadow = true; ground.name = "sg-arena-ground";
  root.add(ground);

  // ── Ciudad ──
  const R = rng(seed), boxes = [], parts = [], grid = new Map(), tall = [];
  const addToGrid = (b, bi, bj) => { const key = bi + "," + bj; (grid.get(key) || grid.set(key, []).get(key)).push(b); };
  const nb = Math.ceil(CITY_R / BLOCK);
  // [centro, media anchura] en un eje, apartado de la avenida más cercana; null si queda demasiado estrecho
  const setback = (c, hw) => {
    const A = Math.round(c / AVENUE) * AVENUE, s = Math.sign(c - A) || 1;
    if (Math.abs(c - A) - hw >= AVE_HALF) return [c, hw];
    const far = c + s * hw, near = A + s * AVE_HALF;
    if ((far - near) * s < 18) return null;
    return [(far + near) / 2, Math.abs(far - near) / 2];
  };
  for (let bj = -nb; bj < nb; bj++) for (let bi = -nb; bi < nb; bi++) {
    const cx = (bi + 0.5) * BLOCK, cz = (bj + 0.5) * BLOCK, r = Math.hypot(cx, cz);
    if (r > CITY_R || r < PLAZA_R + BLOCK * 0.45) continue;
    const k = r / CITY_R, dens = 0.92 - 0.55 * k, lot = (BLOCK - STREET) / 2;
    for (let q = 0; q < 4; q++) {
      if (R() > dens) continue;
      const lx = cx + (q & 1 ? lot / 2 : -lot / 2), lz = cz + (q & 2 ? lot / 2 : -lot / 2);
      let w = lot * (0.62 + 0.3 * R()), d = lot * (0.62 + 0.3 * R());
      let h = 18 + 150 * (1 - k) * (1 - k) * R() + 25 * R();
      if (R() < 0.05 * (1 - k)) h = maxH * (0.62 + 0.18 * R());     // algún rascacielos, más cerca del centro
      h = Math.min(h, maxH * 0.8);
      let x = lx + (lot - w) * (R() - 0.5) * 0.8, z = lz + (lot - d) * (R() - 0.5) * 0.8;
      // Junto a una avenida principal, el edificio se retira hasta dejarla de 90 m (si no cabe, la parcela queda vacía)
      const fx = setback(x, w / 2), fz = setback(z, d / 2);
      if (!fx || !fz) continue;
      [x, w] = [fx[0], fx[1] * 2]; [z, d] = [fz[0], fz[1] * 2];
      const y0 = heightFn(x, z) - 2;
      const neon = R() < 0.55 ? NEON[(R() * NEON.length) | 0] : null;
      parts.push({ x, z, y: y0, w, d, h: h + 2, top: y0 + h + 2, neon });
      const b = { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, top: y0 + h + 2 };
      boxes.push(b); addToGrid(b, bi, bj);
      let topY = y0 + h + 2, tw = w, td = d;
      // escalonados: los altos, con uno o dos pisos más estrechos encima
      for (let tier = 0; tier < 2 && h > 80 && R() < (tier ? 0.35 : 0.65); tier++) {
        const room = y0 + maxH - topY - 8; if (room < 14) break;   // sin pasarse del tope
        tw *= 0.55 + 0.2 * R(); td *= 0.55 + 0.2 * R();
        const th = Math.min(room, 14 + (h * 0.35) * R());
        parts.push({ x, z, y: topY, w: tw, d: td, h: th, top: topY + th, neon: neon || (R() < 0.5 ? NEON[(R() * NEON.length) | 0] : null) });
        const bt = { x0: x - tw / 2, z0: z - td / 2, x1: x + tw / 2, z1: z + td / 2, top: topY + th };
        boxes.push(bt); addToGrid(bt, bi, bj);
        topY += th;
      }
      const ah = 18 + 22 * R();
      if (topY - y0 > maxH * 0.72 && topY - y0 + ah <= maxH) {           // antena con luz roja
        parts.push({ x, z, y: topY, w: 1.6, d: 1.6, h: ah, top: topY + ah, neon: null, mast: true });
        tall.push({ x, z, y: topY + ah, w, d, base: y0, topY });
      } else if (topY - y0 > maxH * 0.48) tall.push({ x, z, w, d, base: y0, topY });
    }
  }
  const bGeo = keep(new THREE.BoxGeometry(1, 1, 1)); bGeo.translate(0, 0.5, 0);
  const bMat = keep(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  bMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    addVaryings(sh, "attribute float aTop;\nattribute vec3 aNeon;\nvarying float vTop;\nvarying vec3 vNeon;\n", "varying float vTop;\nvarying vec3 vNeon;\n", "vTop = aTop; vNeon = aNeon;\n");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        {
          float camD = distance(vWP, cameraPosition);
          float side = 1.0 - step(0.5, abs(vWN.y));
          vec2 cell = vec2((abs(vWN.x) > 0.5 ? vWP.z : vWP.x) / 7.0, vWP.y / 4.2);
          vec2 fc = fract(cell);
          float win = step(0.18, fc.x) * step(fc.x, 0.78) * step(0.32, fc.y) * step(fc.y, 0.82) * step(3.5, vWP.y) * step(vWP.y, vTop - 4.0);
          float hsh = fract(sin(dot(floor(cell) + floor(vWP.xz / 97.0), vec2(12.9898, 78.233))) * 43758.5453);
          float near = 1.0 - smoothstep(1800.0, 5000.0, camD);
          diffuseColor.rgb *= 1.0 - 0.35 * side * win * near;
          vec3 wc = mix(vec3(1.0, 0.72, 0.42), vec3(0.35, 0.9, 1.0), step(0.86, hsh));
          totalEmissiveRadiance += side * win * step(0.5, hsh) * wc * (0.08 + 0.9 * uNight) * mix(0.35, 1.0, near);
          // remate de neón: una franja en lo alto (más gruesa de lejos, para que no parpadee)
          float th = 2.4 + camD * 0.0022;
          float band = step(vTop - 1.0 - th, vWP.y) * step(vWP.y, vTop - 1.0);
          totalEmissiveRadiance += band * vNeon * (0.55 + 0.9 * uNight);
        }`);
  };
  const city = new THREE.InstancedMesh(bGeo, bMat, parts.length); city.name = "sg-arena-city";
  const aTop = new Float32Array(parts.length), aNeon = new Float32Array(parts.length * 3);
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const facades = PAL.bld.map(x => new THREE.Color(x)), mastC = new THREE.Color("#1d1b24");
  parts.forEach((b, i) => {
    m4.compose(p.set(b.x, b.y, b.z), q0, s.set(b.w, b.h, b.d));
    city.setMatrixAt(i, m4); city.setColorAt(i, b.mast ? mastC : facades[(R() * facades.length) | 0]);
    aTop[i] = b.mast ? -1e4 : b.top;
    if (b.neon) { c.set(b.neon); aNeon[i * 3] = c.r; aNeon[i * 3 + 1] = c.g; aNeon[i * 3 + 2] = c.b; }
  });
  bGeo.setAttribute("aTop", new THREE.InstancedBufferAttribute(aTop, 1));
  bGeo.setAttribute("aNeon", new THREE.InstancedBufferAttribute(aNeon, 3));
  city.castShadow = !!shadows; city.receiveShadow = true;
  city.computeBoundingSphere();
  root.add(city);

  // ── Luces rojas de las antenas (todas a la vez, como las de verdad) ──
  const masts = tall.filter(t => t.y);
  const lGeo = keep(new THREE.SphereGeometry(2.6, 8, 6)), lMat = keep(new THREE.MeshBasicMaterial({ color: 0xff2a2a, fog: true }));
  const lights = new THREE.InstancedMesh(lGeo, lMat, Math.max(1, masts.length)); lights.count = masts.length;
  masts.forEach((t, i) => { m4.makeTranslation(t.x, t.y + 1.5, t.z); lights.setMatrixAt(i, m4); });
  lights.computeBoundingSphere(); root.add(lights);

  // ── Carteles luminosos: en la fachada de los edificios altos, mirando hacia la torre ──
  const posters = [], pGeo = keep(new THREE.PlaneGeometry(1, 1));
  const spots = tall.filter(() => R() < 0.45).slice(0, 48);
  const byKind = [[], [], [], []];
  for (const t of spots) {
    // la fachada que mira al centro
    const ax = Math.abs(t.x) > Math.abs(t.z), sx = ax ? -Math.sign(t.x) : 0, sz = ax ? 0 : -Math.sign(t.z);
    const face = ax ? t.w / 2 : t.d / 2, wide = (ax ? t.d : t.w) * 0.8, hgt = Math.min(wide * 0.5, 26);
    const y = t.base + (t.topY - t.base) * (0.5 + 0.2 * R());
    byKind[(R() * 4) | 0].push({ x: t.x + sx * (face + 0.6), z: t.z + sz * (face + 0.6), y, rot: Math.atan2(sx, sz), wide, hgt });
  }
  byKind.forEach((L, kind) => {
    if (!L.length) return;
    const tx = keep(posterTexture(THREE, kind)), mat = keep(new THREE.MeshBasicMaterial({ map: tx, fog: true, side: THREE.DoubleSide }));
    const im = new THREE.InstancedMesh(pGeo, mat, L.length);
    L.forEach((b, i) => { m4.compose(p.set(b.x, b.y, b.z), q0.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot), s.set(b.wide, b.hgt, 1)); im.setMatrixAt(i, m4); });
    q0.identity();
    im.computeBoundingSphere(); root.add(im); posters.push(im);
  });


  let t = 0;
  // ── Cielo synthwave: los colores del motor, teñidos con los de la paleta (antes de aplicarlos: niebla incluida) ──
  const sk = { zD: new THREE.Color(PAL.zenD), hD: new THREE.Color(PAL.horD), zN: new THREE.Color(PAL.zenN), hN: new THREE.Color(PAL.horN), z: new THREE.Color(), h: new THREE.Color(), sunL: new THREE.Color(PAL.sunTop).lerp(new THREE.Color(PAL.sunBot), 0.4) };
  const sunDir = new THREE.Vector3(0.3, 0.1, -1).normalize();
  function skyTint(SKY, dir) {
    const n = SKY.night || 0;
    sk.z.copy(sk.zD).lerp(sk.zN, n); sk.h.copy(sk.hD).lerp(sk.hN, n);
    SKY.zen.lerp(sk.z, 0.8); SKY.hor.lerp(sk.h, 0.8); if (SKY.hemS) SKY.hemS.lerp(sk.z, 0.35);
    if (SKY.sun) SKY.sun.lerp(sk.sunL, 0.45);
    sunDir.copy(dir);
    return { hideSun: true };   // el sol lo pone la arena: el de franjas
  }
  // ── Sol de franjas (como el de la portada): un disco lejano, detrás de las montañas, que sigue al sol de verdad ──
  const sunMat = keep(new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(PAL.sunTop) }, uBot: { value: new THREE.Color(PAL.sunBot) }, uOp: { value: 1 } },
    transparent: true, depthWrite: false, fog: false,
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 uTop; uniform vec3 uBot; uniform float uOp; varying vec2 vUv;
      void main() {
        vec2 q = vUv * 2.0 - 1.0; float r = length(q); if (r > 1.0) discard;
        float y = vUv.y;
        if (y < 0.55) { float s = fract(y * 9.0); if (s < mix(0.55, 0.06, y / 0.55)) discard; }
        vec3 c = mix(uBot, uTop, smoothstep(0.05, 0.95, y)) * 1.5;
        gl_FragColor = vec4(c, smoothstep(1.0, 0.97, r) * uOp);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const sunGeo = keep(new THREE.PlaneGeometry(1, 1));
  const sun = new THREE.Mesh(sunGeo, sunMat); sun.frustumCulled = false; sun.renderOrder = -1; sun.name = "sg-arena-sun";
  root.add(sun);
  function placeSun(camera) {
    const D = Math.min(15000, camera.far * 0.9);
    const d = sunDir.y < -0.03 ? sunDir.clone().setY(-0.03).normalize() : sunDir;
    sun.visible = sunDir.y > -0.22;
    sunMat.uniforms.uOp.value = THREE.MathUtils.smoothstep(sunDir.y, -0.22, -0.02);
    sun.position.copy(camera.position).addScaledVector(d, D);
    sun.position.y = Math.max(sun.position.y, camera.position.y + sunDir.y * D);
    sun.scale.setScalar(D * 0.26);
    sun.quaternion.copy(camera.quaternion);
  }

  // ── Puertas «Flow»: aros de neón sobre las avenidas principales, a baja altura. Cruzarlos da turbo y sube la racha ──
  const GATE_N = 8, GATE_R = 36;
  const gGeo = keep(new THREE.TorusGeometry(GATE_R, 1.8, 6, 36));
  const gMatA = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.accA).multiplyScalar(1.6), fog: true }));
  const gMatB = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.accB).multiplyScalar(1.4), fog: true }));
  const gates = [], gR = rng(seed * 31 + 5);
  function gateSpot(g) {
    for (let tries = 0; tries < 40; tries++) {
      const along = gR() < 0.5, k = Math.round((gR() * 2 - 1) * 4) * AVENUE, tt = (gR() * 2 - 1) * (CITY_R - 300);
      const x = along ? tt : k, z = along ? k : tt, r = Math.hypot(x, z);
      if (r < 700 || r > CITY_R - 250 || Math.abs(tt) < 300) continue;
      if (gates.some(o => o !== g && o.on && Math.hypot(o.x - x, o.z - z) < 900)) continue;
      g.x = x; g.z = z; g.y = heightFn(x, z) + 55 + gR() * 30; g.nx = along ? 1 : 0; g.nz = along ? 0 : 1;
      g.mesh.position.set(g.x, g.y, g.z); g.mesh.rotation.set(0, along ? Math.PI / 2 : 0, 0);
      return;
    }
  }
  for (let i = 0; i < GATE_N; i++) {
    const g = { mesh: new THREE.Mesh(gGeo, i % 2 ? gMatB : gMatA), on: true, cd: 0, x: 0, y: 0, z: 0, nx: 1, nz: 0, flash: 0 };
    g.mesh.name = "sg-flow-gate"; gates.push(g); gateSpot(g); root.add(g.mesh);
  }
  const lastP = new THREE.Vector3(), _q = new THREE.Vector3(); let haveLast = false, gatesOn = false;
  /** Cada fotograma con la partida en marcha: pos = la nave; onPass(gate) al cruzar una */
  function updateGates(dt, pos, onPass) {
    for (const g of gates) {
      if (!g.on) { if ((g.cd -= dt) <= 0) { g.on = true; gateSpot(g); g.mesh.visible = gatesOn; } continue; }
      const s = 1 + 0.06 * Math.sin(t * 3 + g.x * 0.01) + g.flash * 0.6; g.mesh.scale.setScalar(s);
      if (g.flash > 0) { g.flash -= dt * 2.5; if (g.flash <= 0) { g.on = false; g.cd = 16; g.mesh.visible = false; } continue; }
      if (!haveLast || !pos) continue;
      const a = (lastP.x - g.x) * g.nx + (lastP.z - g.z) * g.nz, b2 = (pos.x - g.x) * g.nx + (pos.z - g.z) * g.nz;
      if ((a < 0) === (b2 < 0)) continue;
      const k = a / (a - b2); _q.copy(lastP).lerp(pos, k);
      const lat = Math.hypot((_q.x - g.x) * g.nz, (_q.z - g.z) * g.nx, _q.y - g.y);
      if (lat < GATE_R) { g.flash = 1; onPass && onPass(g); }
    }
    if (pos) { lastP.copy(pos); haveLast = true; }
  }
  function showGates(on) { gatesOn = !!on; haveLast = false; for (const g of gates) g.mesh.visible = gatesOn && g.on; }
  showGates(false);

  // ── Lo que pregunta el motor ──
  function groundAt(X, Z) {
    const fx = (X + half) / step, fz = (Z + half) / step;
    if (fx < 0 || fz < 0 || fx >= CELLS || fz >= CELLS) return heightFn(X, Z);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    // los mismos dos triángulos que PlaneGeometry
    const a = H[j * N + i], b = H[j * N + i + 1], cc = H[(j + 1) * N + i], d = H[(j + 1) * N + i + 1];
    return u + v < 1 ? a + (b - a) * u + (cc - a) * v : d + (cc - d) * (1 - u) + (b - d) * (1 - v);
  }
  function buildingAt(X, Y, Z) {
    const L = grid.get(Math.floor(X / BLOCK) + "," + Math.floor(Z / BLOCK)); if (!L) return null;
    let top = null;
    for (const b of L) if (X >= b.x0 && X <= b.x1 && Z >= b.z0 && Z <= b.z1 && Y <= b.top) top = Math.max(top ?? -Infinity, b.top);
    return top;
  }
  return {
    root, groundAt, buildingAt, count: parts.length, palette: PAL, skyTint, updateGates, showGates,
    update(night, dt = 0, camera = null) {
      U.uNight.value = night || 0; t += dt; U.uTime.value = t % 3600;
      lights.visible = (t % 1.6) < 0.5;   // parpadeo de las antenas
      if (camera) placeSun(camera);
    },
    dispose() { root.removeFromParent(); for (const x of disposables) x.dispose(); city.dispose(); lights.dispose(); for (const im of posters) im.dispose(); },
  };
}
