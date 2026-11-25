/* ═══════════════════════════════════════════════════════════════════════════
   🌅 Arcade Flow Sky Defender — escena 3D de la portada
   Atardecer: cielo en degradado con el sol rozando el horizonte, dos cordilleras en silueta, luces de ciudad,
   nubes teñidas, reflectores que barren el cielo, la torre y la nave elegida dibujando una estela de luz
   («flow») alrededor de ella; de vez en cuando cruza una formación enemiga a lo lejos.
   Todo por código (sin archivos). En «hangar», la nave grande girando con la torre detrás.
   ═══════════════════════════════════════════════════════════════════════════ */
import { createTower, TOWER_SCALE as TS, BASE_HALF } from "./tower.js";
import { enemyModels } from "./models.js";

const SUN_AZ = 0.35, SUN_EL = 0.045;          // sol bajo, casi en el horizonte
const TRAIL_N = 150;                          // puntos de la estela

// La portada se dibuja a 30 fps como mucho: es un fondo, y a 60 fps (o más) gastaba GPU y batería
// mientras solo se leen los menús. Con «Rendimiento» (opts.lite), además a resolución 1×.
const MENU_FRAME_MS = 1000 / 30;
export function createMenuScene(api, canvas, opts = {}) {
  const { THREE } = api;
  const dummy = { start() { }, stop() { }, plane() { }, view() { } };
  let r = null; try { r = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return dummy; }
  r.setPixelRatio(opts.lite ? 1 : Math.min(devicePixelRatio, 2)); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const sunDir = V(Math.cos(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), Math.sin(SUN_AZ) * Math.cos(SUN_EL)).normalize();

  const sc = new THREE.Scene();
  const FOG = new THREE.Color(0x3b2440);
  sc.fog = new THREE.Fog(FOG, 1400, 7600);
  const cam = new THREE.PerspectiveCamera(42, 1, 1, 12000);

  // ── Cielo: degradado + resplandor del sol + estrellas que aparecen arriba ──
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir }, uT: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uSun; uniform float uT; varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        vec3 d = normalize(vDir); float h = d.y;
        vec3 zen = vec3(0.020, 0.028, 0.085), mid = vec3(0.115, 0.085, 0.250), hor = vec3(0.92, 0.40, 0.33), low = vec3(0.23, 0.14, 0.25);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, h));
        c = mix(c, zen, smoothstep(0.12, 0.65, h));
        float s = max(dot(d, uSun), 0.0);
        float az = max(dot(normalize(d.xz), normalize(uSun.xz)), 0.0);
        c += vec3(1.0, 0.50, 0.22) * pow(az, 3.0) * exp(-max(h, 0.0) * 9.0) * 0.55;   // horizonte más cálido del lado del sol
        c += vec3(1.0, 0.62, 0.30) * pow(s, 24.0) * 0.9 + vec3(1.0, 0.92, 0.75) * smoothstep(0.9993, 0.99975, s) * 2.5;
        if (h < 0.0) c = mix(c, low, smoothstep(0.0, -0.05, h));
        vec3 q = floor(d * 420.0); float st = hash(q);
        float tw = 0.65 + 0.35 * sin(uT * 2.0 + st * 60.0);
        c += vec3(0.85, 0.9, 1.0) * step(0.9965, st) * smoothstep(0.18, 0.5, h) * tw * 0.9;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sc.add(sky);

  // ── Luz: hemisferio violeta, sol cálido rasante (contraluz en la torre) y luna fría ──
  sc.add(new THREE.HemisphereLight(0x7a64a8, 0x120c14, 0.7));
  const sun = new THREE.DirectionalLight(0xff9a62, 1.15); sun.position.copy(sunDir).multiplyScalar(2000); sc.add(sun);
  const moon = new THREE.DirectionalLight(0x9fb4ff, 0.45); moon.position.set(-600, 900, -300); sc.add(moon);

  // ── Suelo ──
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9000, 64), new THREE.MeshStandardMaterial({ color: 0x15121a, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; sc.add(ground);

  // ── Sol retro de los 80: disco en degradado oro → magenta con franjas horizontales que se abren hacia
  //    abajo y un halo rosa. Siempre detrás de la torre (se recoloca cada fotograma frente a la cámara),
  //    medio hundido tras la cordillera cercana, como en una portada de recreativa. ──
  const retroSun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5; float r = length(p);
        vec3 col = mix(vec3(1.0, 0.18, 0.56), vec3(1.0, 0.90, 0.42), smoothstep(-0.36, 0.30, p.y));
        float disc = smoothstep(0.362, 0.355, r);
        float k = clamp((0.22 - p.y) / 0.5, 0.0, 1.0);                  // 0 arriba de las franjas → 1 abajo
        float cut = p.y < 0.22 ? step(fract((p.y + 0.5) * 13.0), 0.07 + 0.6 * k) : 0.0;
        float a = disc * (1.0 - cut);
        float halo = exp(-max(r - 0.36, 0.0) * 16.0) * (1.0 - disc) * 0.45;
        gl_FragColor = vec4(col * a + vec3(1.0, 0.32, 0.62) * halo, max(a, halo));
      }`,
  }));
  // A 8.200 m: detrás de las DOS cordilleras (5.200 y 6.800 m), como un sol de verdad. A 6.300 m quedaba
  // entre ellas y parecía salir de en medio de las montañas.
  const SUN_DIST = 8200;
  retroSun.renderOrder = 1; retroSun.scale.set(4300, 4300, 1); sc.add(retroSun);

  // ── Rejilla de neón sobre el suelo (synthwave), que se apaga con la distancia ──
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(11000, 11000), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { uCam: { value: new THREE.Vector3() } },
    vertexShader: `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uCam; varying vec3 vW;
      void main() {
        vec2 g = vW.xz / 110.0;
        vec2 d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
        float line = 1.0 - min(min(d.x, d.y), 1.0);
        float dist = length(vW.xz - uCam.xz);
        // ni a lo lejos ni bajo la torre: empieza justo al borde de la explanada (antes a 140–420 m, y
        // alrededor de la torre quedaba un anillo negro y vacío)
        vec2 ab = abs(vW.xz);
        float fade = exp(-dist / 2300.0) * smoothstep(${(BASE_HALF * TS + 14).toFixed(1)}, ${(BASE_HALF * TS + 60).toFixed(1)}, max(ab.x, ab.y));
        vec3 c = mix(vec3(0.95, 0.20, 0.75), vec3(0.25, 0.75, 1.0), smoothstep(400.0, 2600.0, dist));
        gl_FragColor = vec4(c * line * fade * 0.9, line * fade);
      }`,
  }));
  grid.rotation.x = -Math.PI / 2; grid.position.y = 1.2; sc.add(grid);

  // ── Base de la torre integrada en la rejilla: marco de neón, cuatro avenidas con farolas y edificios
  //    bajos con el tejado perfilado (como una base alrededor de la torre) ──
  {
    const PH = BASE_HALF * TS;                                   // media anchura de la explanada
    const neon = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const PINK = 0xff3fb0, CYAN = 0x3fd8ff;
    const strip = (cx, cz, w, l, mat, y = 1.6) => {             // franja plana sobre el suelo
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat); m.rotation.x = -Math.PI / 2; m.position.set(cx, y, cz); sc.add(m); return m;
    };
    // Marco doble alrededor de la explanada
    for (const [off, wd, mat] of [[PH + 6, 3, neon(PINK, 0.9)], [PH + 20, 1.6, neon(CYAN, 0.65)]]) {
      strip(0, off, off * 2 + wd, wd, mat); strip(0, -off, off * 2 + wd, wd, mat);
      strip(off, 0, wd, off * 2 + wd, mat); strip(-off, 0, wd, off * 2 + wd, mat);
    }
    // Cuatro avenidas que salen de cada lado: bordes cian, raya central rosa discontinua, se apagan a lo lejos
    const avenueMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv;
        void main() {
          float x = abs(vUv.x - 0.5) * 2.0, far = vUv.y;              // vUv.y: 0 junto a la torre → 1 al final
          float edge = smoothstep(0.80, 0.90, x) * (1.0 - smoothstep(0.95, 1.0, x));
          float dash = step(0.5, fract(far * 26.0)) * (1.0 - smoothstep(0.03, 0.07, x));
          float fade = 1.0 - smoothstep(0.35, 1.0, far);
          vec3 c = vec3(0.25, 0.85, 1.0) * edge + vec3(1.0, 0.25, 0.7) * dash * 0.9;
          gl_FragColor = vec4(c * fade, (edge + dash) * fade * 0.9);
        }`,
    });
    const AV_W = 34, AV_L = 1500, a0 = PH + 22;
    for (let i = 0; i < 4; i++) {
      const g = new THREE.PlaneGeometry(AV_W, AV_L); g.translate(0, AV_L / 2, 0);
      const m = new THREE.Mesh(g, avenueMat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = i * Math.PI / 2;            // las cuatro direcciones
      const dx = [0, -1, 0, 1][i], dz = [-1, 0, 1, 0][i];
      m.position.set(dx * a0, 1.5, dz * a0); sc.add(m);
    }
    // Farolas a los lados de las avenidas (puntos cálidos que se apagan con la distancia por la niebla)
    {
      const pts = [];
      for (let i = 0; i < 4; i++) {
        const dx = [0, -1, 0, 1][i], dz = [-1, 0, 1, 0][i], sx = -dz, sz = dx;
        for (let d = a0 + 30; d < a0 + 900; d += 55) for (const s of [-1, 1]) pts.push(dx * d + sx * s * (AV_W / 2 + 4), 7, dz * d + sz * s * (AV_W / 2 + 4));
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      sc.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd9a0, size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0.95, fog: true })));
    }
    // Edificios bajos (hangares, almacenes) en las cuatro esquinas entre avenidas, con el tejado perfilado
    {
      const body = new THREE.MeshStandardMaterial({ color: 0x1a1522, roughness: 0.9, emissive: 0x0b0710 });
      const roofP = neon(PINK, 0.85), roofC = neon(CYAN, 0.7), win = new THREE.MeshBasicMaterial({ color: 0xffc98a });
      let k = 9173; const rnd = () => (k = (k * 16807) % 2147483647) / 2147483647;
      for (let q = 0; q < 4; q++) {
        const qa = Math.PI / 4 + q * Math.PI / 2;                    // diagonal de cada esquina
        for (let n = 0; n < 4; n++) {
          const r = PH + 70 + rnd() * 380, a = qa + (rnd() - 0.5) * 0.9;
          const w = 34 + rnd() * 60, d = 26 + rnd() * 44, h = 10 + rnd() * 26;
          const x = Math.cos(a) * r, z = Math.sin(a) * r, rotY = Math.round(rnd() * 3) * Math.PI / 2;
          if (Math.hypot(x - 420, z - 420) < 170) continue;          // ahí se enseña la nave en el Hangar
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), body); b.position.set(x, h / 2, z); b.rotation.y = rotY; sc.add(b);
          // perfil de neón del tejado (cuatro listones finos)
          const roof = new THREE.Group(); roof.position.set(x, h + 0.4, z); roof.rotation.y = rotY; sc.add(roof);
          const lm = n % 2 ? roofC : roofP;
          for (const [px, pz, sw, sd] of [[0, d / 2, w, 1.2], [0, -d / 2, w, 1.2], [w / 2, 0, 1.2, d], [-w / 2, 0, 1.2, d]]) {
            const s = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.8, sd), lm); s.position.set(px, 0, pz); roof.add(s);
          }
          // una fila de ventanas encendidas en la fachada
          const wr = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 2.2), win);
          wr.position.set(0, -h * 0.45, d / 2 + 0.05); roof.add(wr);
        }
      }
    }
  }

  // ── Cordilleras en silueta (dos anillos, el lejano más claro por la bruma) ──
  function ridge(R, hMin, hMax, color, seed) {
    const n = 220, pos = [], idx = [];
    let k = seed; const rnd = () => (k = (k * 16807) % 2147483647) / 2147483647;
    const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      const nz = 0.5 + 0.25 * Math.sin(a * 3 + ph[0]) + 0.15 * Math.sin(a * 11 + ph[1]) + 0.1 * Math.sin(a * 27 + ph[2]) + (rnd() - 0.5) * 0.08;
      const h = hMin + (hMax - hMin) * Math.max(0, nz);
      pos.push(Math.cos(a) * R, -20, Math.sin(a) * R, Math.cos(a) * R, h, Math.sin(a) * R);
      if (i < n) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide })); sc.add(m);
  }
  ridge(6800, 120, 760, 0x2c1c36, 11);
  ridge(5200, 60, 430, 0x170f1e, 97);

  // ── Luces de ciudad: puntos cálidos agrupados en barrios ──
  {
    const n = 3200, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
    let k = 4242; const rnd = () => (k = (k * 16807) % 2147483647) / 2147483647;
    const hubs = Array.from({ length: 14 }, () => { const a = rnd() * Math.PI * 2, d = 900 + rnd() * 3600; return [Math.cos(a) * d, Math.sin(a) * d, 120 + rnd() * 420]; });
    const warm = new THREE.Color(0xffb766), white = new THREE.Color(0xdfe6ff), amber = new THREE.Color(0xff8a3d);
    for (let i = 0; i < n; i++) {
      const hb = hubs[i % hubs.length], a = rnd() * Math.PI * 2, d = Math.pow(rnd(), 0.6) * hb[2];
      let x = hb[0] + Math.cos(a) * d, z = hb[1] + Math.sin(a) * d;
      if (Math.hypot(x, z) < 380) { x *= 2; z *= 2; }
      p.set([x, 2, z], i * 3);
      const col = rnd() < 0.7 ? warm : rnd() < 0.6 ? white : amber; c.set([col.r, col.g, col.b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    sc.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: true, transparent: true, opacity: 0.9 })));
  }

  // ── Nubes: manchas suaves teñidas por el atardecer, a la deriva ──
  const clouds = [];
  {
    const cv = document.createElement("canvas"); cv.width = cv.height = 128; const g = cv.getContext("2d");
    for (let i = 0; i < 9; i++) {
      const x = 30 + Math.random() * 68, y = 50 + Math.random() * 28, rr = 22 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(cv);
    let k = 777; const rnd = () => (k = (k * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, d = 1500 + rnd() * 3400, toSun = Math.max(0, Math.cos(a - SUN_AZ));
      const col = new THREE.Color(0x5a4a78).lerp(new THREE.Color(0xff9a7a), toSun * 0.85);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      s.position.set(Math.cos(a) * d, 650 + rnd() * 700, Math.sin(a) * d); s.scale.set(900 + rnd() * 1300, 260 + rnd() * 260, 1);
      s.userData = { a, d, w: (rnd() - 0.5) * 0.004 }; sc.add(s); clouds.push(s);
    }
  }

  // ── Torre ──
  const tower = createTower(THREE, { seed: 7, scale: TS, style: "neon" }); sc.add(tower.root);   // la de la Arena Neón: pega con la portada synthwave

  // ── Reflectores: conos aditivos desde las esquinas de la explanada ──
  const beams = [];
  {
    const L = 3200, R = 110;
    const geo = new THREE.CylinderGeometry(2, R, L, 28, 1, true); geo.translate(0, -L / 2, 0); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uCol: { value: new THREE.Color(1.0, 0.93, 0.82) } },
      vertexShader: `varying float vA; varying float vE; void main() { vA = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vE = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uCol; varying float vA; varying float vE; void main() { gl_FragColor = vec4(uCol, pow(vE, 2.2) * pow(vA, 1.8) * 0.11); }`,
    });
    const off = 31 * TS * 0.9;
    [[off, off], [-off, off], [off, -off], [-off, -off]].forEach(([x, z], i) => {
      const b = new THREE.Mesh(geo, mat); b.position.set(x, 4, z); b.userData = { ph: i * 1.7, sp: 0.18 + i * 0.04 }; sc.add(b); beams.push(b);
    });
  }

  // ── Formación enemiga lejana ──
  let foes = [];
  try {
    const mk = enemyModels(api);
    foes = [0, 1, 2].map(() => { const m = mk("escort"); m.scale.setScalar(2.2); sc.add(m); return m; });
  } catch { foes = []; }
  const foeOff = [[0, 0], [-34, -30], [34, -30]];

  // ── Estela de la nave (cinta aditiva que se desvanece) ──
  const trailPos = new Float32Array(TRAIL_N * 2 * 3), trailA = new Float32Array(TRAIL_N * 2);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute("alpha", new THREE.BufferAttribute(trailA, 1));
  { const idx = []; for (let i = 0; i < TRAIL_N - 1; i++) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } trailGeo.setIndex(idx); }
  const trail = new THREE.Mesh(trailGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `attribute float alpha; varying float vA; void main() { vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying float vA; void main() { vec3 hot = vec3(1.0, 0.78, 0.45), cool = vec3(1.0, 0.30, 0.48);
      gl_FragColor = vec4(mix(cool, hot, vA * vA), pow(vA, 1.3) * 0.85); }`,
  }));
  trail.frustumCulled = false; sc.add(trail);
  const hist = [];

  // ── Nave del jugador ──
  let plane = null, planeId = null, planeKey = null, mode = "home", run = false, last = 0, ang = 0.9, t0 = performance.now();
  function setPlane(id) {
    const P = api.AIRCRAFT.find(a => a.id === id); if (!P) return;
    const key = id + ":" + (P.livery || ""); if (key === planeKey) return; planeKey = key; planeId = id;
    if (plane) sc.remove(plane);
    plane = api.buildModel(P); plane.traverse(c => { if (c.name === "cockpit" || c.name === "gear") c.visible = false; }); sc.add(plane);
  }
  // Recorrido «flow»: órbita que respira (radio y altura ondulan) con un tonel cada vuelta
  const flowAt = (a, out) => { const R = 520 + 130 * Math.sin(a * 2 + 0.6); return out.set(Math.cos(a) * R, 215 + 70 * Math.sin(a * 3), Math.sin(a) * R); };
  const pA = V(0, 0, 0), pB = V(0, 0, 0), right = V(0, 0, 0), upV = V(0, 1, 0), fwd = V(0, 0, 0);
  const camPos = V(0, 0, 0), camLook = V(0, 0, 0), wantPos = V(0, 0, 0), wantLook = V(0, 0, 0), backDir = V(1, 0, 0);

  function frame(now) {
    if (!run) return; requestAnimationFrame(frame);
    if (now - last < MENU_FRAME_MS - 1) return;   // 30 fps como mucho
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    const T = (now - t0) / 1000;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * r.getPixelRatio()) || canvas.height !== Math.floor(h * r.getPixelRatio())) {
      r.setSize(w, h, false); cam.aspect = w / Math.max(1, h);
      const shift = w > 700 ? Math.min(230, w * 0.2) : 0;           // el centro de la escena, a la derecha del panel
      if (shift) cam.setViewOffset(w, h, -shift, 0, w, h); else cam.clearViewOffset();
      cam.updateProjectionMatrix();
    }
    sky.material.uniforms.uT.value = T;
    ang += dt * 0.045;
    const P = planeId && api.AIRCRAFT.find(a => a.id === planeId);

    if (mode === "hangar" && plane && P) {
      const L = Math.max(P.len, P.span);
      plane.scale.setScalar(1);
      plane.position.set(420, 60, 420); plane.rotation.set(0, now / 4000, 0);
      wantPos.set(420 + L * 1.25, 60 + L * 0.35, 420 + L * 1.25); wantLook.set(420 - L * 0.45, 60, 420 - L * 0.45);
      trail.visible = false; hist.length = 0;
    } else {
      if (plane) {
        const a = T * 0.16;
        flowAt(a, pA); flowAt(a + 0.01, pB);
        fwd.subVectors(pB, pA).normalize();
        // inclinación según la curva (giro a la izquierda → ala izquierda abajo) + tonel cada vuelta completa
        const ph = (a / (Math.PI * 2)) % 1, roll = ph > 0.62 && ph < 0.72 ? Math.sin((ph - 0.62) / 0.1 * Math.PI / 2) ** 2 * Math.PI * 2 : 0;
        plane.scale.setScalar(3.2);
        plane.position.copy(pA); plane.lookAt(pB); plane.rotateY(Math.PI); plane.rotateZ(0.55 + roll);
        right.crossVectors(fwd, upV).normalize().applyAxisAngle(fwd, -(0.55 + roll));
        hist.unshift({ p: pA.clone().addScaledVector(fwd, -14), r: right.clone() }); if (hist.length > TRAIL_N) hist.pop();
        trail.visible = true;
        for (let i = 0; i < TRAIL_N; i++) {
          const e = hist[Math.min(i, hist.length - 1)], f = 1 - i / (TRAIL_N - 1), wd = 3 + 15 * (1 - f);
          trailPos.set([e.p.x - e.r.x * wd, e.p.y - e.r.y * wd, e.p.z - e.r.z * wd, e.p.x + e.r.x * wd, e.p.y + e.r.y * wd, e.p.z + e.r.z * wd], i * 6);
          trailA[i * 2] = trailA[i * 2 + 1] = i < hist.length ? f : 0;
        }
        trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.alpha.needsUpdate = true;
        const prop = plane.getObjectByName("blades"); if (prop) prop.parent.rotation.z += dt * 30;
      }
      // cámara: órbita lenta y baja, mirando la torre hacia arriba (heroica)
      wantPos.set(Math.cos(ang) * 820, 55 + 25 * Math.sin(ang * 1.7), Math.sin(ang) * 820);
      wantLook.set(0, 62 * TS, 0);
    }
    const prop = plane && mode === "hangar" && plane.getObjectByName("blades"); if (prop) prop.parent.rotation.z += dt * 8;

    // formación enemiga: cruza el cielo lejos cada ~26 s
    if (foes.length) {
      const cyc = 26, u = (T % cyc) / cyc, vis = mode !== "hangar" && u < 0.7;
      const k = Math.floor(T / cyc), dirA = k * 2.1 + 0.4, d = 2300, s = (u / 0.7) * 2 - 1;
      const ox = Math.cos(dirA + Math.PI / 2) * 1400, oz = Math.sin(dirA + Math.PI / 2) * 1400;
      const dx = Math.cos(dirA), dz = Math.sin(dirA);
      foes.forEach((f, i) => {
        f.visible = vis; if (!vis) return;
        const [lx, lb] = foeOff[i];
        const x = ox + dx * s * d + dx * lb + -dz * lx, z = oz + dz * s * d + dz * lb + dx * lx;
        f.position.set(x, 620 + i * 6, z); f.lookAt(x + dx, 620 + i * 6, z + dz); f.rotateY(Math.PI);
      });
    }
    for (const c of clouds) { c.userData.a += c.userData.w * dt; c.position.x = Math.cos(c.userData.a) * c.userData.d; c.position.z = Math.sin(c.userData.a) * c.userData.d; }
    beams.forEach(b => { const u = b.userData, t = T * u.sp + u.ph; b.rotation.set(-0.55 - 0.35 * Math.sin(t * 1.3), t, 0, "YXZ"); });

    camPos.lerp(wantPos, 1 - Math.exp(-dt * 2.2)); camLook.lerp(wantLook, 1 - Math.exp(-dt * 2.2));
    cam.position.copy(camPos); cam.lookAt(camLook);
    // Sol retro siempre detrás de lo que mira la cámara (la torre) y, con él, el resplandor del cielo y la luz
    backDir.set(camLook.x - camPos.x, 0, camLook.z - camPos.z).normalize();
    retroSun.position.set(backDir.x * SUN_DIST, 830, backDir.z * SUN_DIST); retroSun.lookAt(cam.position);
    sunDir.set(backDir.x * Math.cos(SUN_EL), Math.sin(SUN_EL), backDir.z * Math.cos(SUN_EL)).normalize();
    sun.position.copy(sunDir).multiplyScalar(2000);
    grid.material.uniforms.uCam.value.copy(cam.position);
    sky.position.copy(cam.position);
    const scale = r.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360));
    tower.update(dt, { night: true, light: 0.35, camPos: cam.position, scale });
    r.render(sc, cam);
  }
  camPos.set(Math.cos(ang) * 820, 60, Math.sin(ang) * 820); camLook.set(0, 62 * TS, 0);
  return {
    start() { if (!run) { run = true; last = performance.now(); requestAnimationFrame(frame); } },
    stop() { run = false; },
    plane: setPlane,
    view(m) { mode = m; },
  };
}
