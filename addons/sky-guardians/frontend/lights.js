/* ═══════════════════════════════════════════════════════════════════════════
   🔦 Sky Guardians — reflectores antiaéreos (v1.1)
   De noche, cuatro reflectores alrededor de lo que se defiende barren el cielo; cuando un enemigo se acerca,
   cada uno sigue a uno distinto (los que van a por la torre, primero). Un cono de luz con el brillo en el shader
   (aditivo, sin escribir profundidad): barato, una malla por reflector.
   ═══════════════════════════════════════════════════════════════════════════ */

const BEAM_L = 2200, BEAM_R = 85;

export function createSearchlights(api) {
  const { THREE, scene } = api;
  const beamGeo = new THREE.CylinderGeometry(1.6, BEAM_R, BEAM_L, 28, 1, true);
  beamGeo.translate(0, -BEAM_L / 2, 0); beamGeo.rotateX(-Math.PI / 2);   // del foco (0, 0, 0) hacia +Z
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.96, 0.86) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying float vAlong; varying float vEdge; varying float vNear;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vAlong = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vEdge = abs(dot(n, normalize(-mv.xyz)));
  vNear = smoothstep(25.0, 260.0, -mv.z);   // de cerca se apaga (no deslumbra al pasar por dentro)
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `uniform float uI; uniform vec3 uCol; varying float vAlong; varying float vEdge; varying float vNear;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  float a = uI * pow(vEdge, 2.0) * pow(vAlong, 1.6) * 0.13 * vNear;
  gl_FragColor = vec4(uCol, a);
}`,
  });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x4a4f56, roughness: 0.6, metalness: 0.5 });
  const glassOn = new THREE.MeshBasicMaterial({ color: 0xfff4d8 }), glassOff = new THREE.MeshBasicMaterial({ color: 0x2a2c30 });
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,250,235,1)"); gr.addColorStop(0.3, "rgba(255,240,210,.5)"); gr.addColorStop(1, "rgba(255,240,210,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  const list = [];
  const _d = new THREE.Vector3(), _w = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1), _q = new THREE.Quaternion();
  let time = 0;

  /** o: lo que se defiende; at: [{ x, y, z }] posiciones del suelo de cada reflector */
  function build(o, at, scale = 3) {
    for (const p of at) {
      const base = new THREE.Group(); base.position.set(p.x, p.y, p.z); scene.add(base);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 14), housingMat); drum.rotation.x = Math.PI / 2;
      const head = new THREE.Group(); head.position.y = 2.2 * scale / 3 + 1.4; base.add(head);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, head.position.y, 8), housingMat); stand.position.y = head.position.y / 2; base.add(stand);
      drum.scale.setScalar(scale / 2); head.add(drum);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(1.0 * scale / 2, 16), glassOff); glass.position.z = 0.82 * scale / 2; head.add(glass);
      const beam = new THREE.Mesh(beamGeo, beamMat); beam.frustumCulled = false; beam.renderOrder = 3; head.add(beam);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(6); glow.position.z = 1.2 * scale / 2; head.add(glow);
      const ph = list.length * 1.7;
      list.push({ o, base, head, glass, beam, glow, dir: new THREE.Vector3(Math.cos(ph), 1.3, Math.sin(ph)).normalize(), ph, tgt: null });
    }
  }
  /** dt, night (0…1), enemigos vivos [{ pos, alive, kind }], prio(e) → true si va a por la torre */
  function update(dt, night, enemies, prio) {
    time += dt;
    const I = Math.max(0, Math.min(1, (night - 0.3) / 0.4));
    beamMat.uniforms.uI.value = I;
    // a quién sigue cada uno: los enemigos cercanos que van a por la torre, primero; cada reflector a uno distinto
    const taken = new Set();
    for (const L of list) {
      const on = I > 0.01;
      L.beam.visible = on; L.glow.visible = on; L.glass.material = on ? glassOn : glassOff;
      if (!on) continue;
      if (L.tgt && (!L.tgt.alive || L.tgt.pos.distanceTo(L.base.position) > 2600)) L.tgt = null;
      if (!L.tgt) {
        let best = null, bd = 2400;
        for (const e of enemies) {
          if (!e.alive || taken.has(e) || e.kind === "hmissile") continue;
          const d = e.pos.distanceTo(L.base.position) * (prio(e) ? 1 : 1.5);
          if (d < bd) { bd = d; best = e; }
        }
        L.tgt = best;
      }
      if (L.tgt) taken.add(L.tgt);
      // barrido lento si no hay nadie; si lo hay, lo sigue (girando a una velocidad limitada)
      if (L.tgt) _w.copy(L.tgt.pos).sub(L.head.getWorldPosition(_d)).normalize();
      else { const a = L.ph + Math.sin(time * 0.23 + L.ph) * 1.4, el = 0.95 + 0.3 * Math.sin(time * 0.17 + L.ph * 2); _w.set(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)); }
      if (_w.y < 0.08) { _w.y = 0.08; _w.normalize(); }
      const ang = L.dir.angleTo(_w), k = ang > 1e-4 ? Math.min(1, (L.tgt ? 1.1 : 0.5) * dt / ang) : 1;
      L.dir.lerp(_w, k).normalize();
      _q.setFromUnitVectors(_z, L.dir); L.head.quaternion.copy(_q);
    }
  }
  function clear() { for (const L of list) scene.remove(L.base); list.length = 0; }
  // Arena Neón: haces de colores (a, b alternos); null = el blanco cálido de siempre
  const beamMatB = beamMat.clone(); beamMatB.uniforms.uI = beamMat.uniforms.uI;
  const warm = new THREE.Color(1.0, 0.96, 0.86), warmGlow = new THREE.Color(0xfff1d0);
  function setTint(a, b) {
    beamMat.uniforms.uCol.value.copy(a ? new THREE.Color(a) : warm);
    beamMatB.uniforms.uCol.value.copy(b ? new THREE.Color(b) : a ? new THREE.Color(a) : warm);
    list.forEach((L, i) => { L.beam.material = i % 2 && (a || b) ? beamMatB : beamMat; L.glow.material.color.copy(a ? new THREE.Color(i % 2 && b ? b : a) : warmGlow); });
    tint = [a, b];
  }
  let tint = [null, null];
  return { build: (...x) => { build(...x); if (tint[0]) setTint(tint[0], tint[1]); }, update, clear, setTint, get list() { return list; } };
}
