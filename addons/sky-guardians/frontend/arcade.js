/* ═══════════════════════════════════════════════════════════════════════════
   🎮 Sky Guardians — mandos arcade (como los juegos de combate aéreo modernos)
   Sustituye los mandos de Wiki Flight (HOOK.input) mientras se juega.

   MANDO (como Ace Combat / Star Wars Squadrons en su modo sencillo):
   · Stick izquierdo: volar. ↑↓ morro (arriba = picar, como un avión; I lo invierte), ←→ girar: la nave se
     inclina sola y gira hacia donde empujas; al soltar se nivela.
   · Stick derecho: mirar alrededor (al soltarlo, la cámara vuelve detrás).
   · RT: arma 1 · LT: arma 2 (con el caza, mantener para fijar misiles y soltar para lanzarlos).
   · RB: acelerar (postcombustión en el caza) · LB: frenar. Sin tocarlos, velocidad de combate automática.
   · Y: siguiente objetivo; mantenido, la cámara mira al objetivo. · Cruceta ↑: cámara cerca/lejos · Start: pausa.

   TECLADO Y RATÓN (como el modo arcade de War Thunder: «apuntado con el ratón»):
   · Clic en la pantalla para capturar el ratón. Mueve el ratón y la nave vuela sola hacia donde apuntas
     (el círculo pequeño). Clic izquierdo: arma 1 · clic derecho: arma 2.
   · W acelerar (Shift también) · S frenar · Tab o E: siguiente objetivo; mantenido, cámara al objetivo.
   · Sin ratón: flechas o A/D para volar (↑↓ morro, ←→ girar), Espacio arma 1, V arma 2.
   · Esc suelta el ratón y pausa.
   ═══════════════════════════════════════════════════════════════════════════ */

import { bindings as B, kbAny, kbHas } from "./controls.js";

const TURN = { "sg-attack": 1.15, "sg-fighter": 0.95 };   // rad/s de giro con el mando a tope
const BANK = 0.95;                                        // alabeo que se ve al girar a tope (rad)
const HOLD = 0.3;                                         // s manteniendo Y / Tab / E para la cámara al objetivo
let MOUSE_SENS = 0.0022;                                  // rad por píxel de ratón (Ajustes: ×0,4–×2)
const PITCH_K = { "sg-attack": 0.6, "sg-fighter": 0.55 };     // fracción del cabeceo de la nave que se usa

export function createArcade(api, combat) {
  const { THREE, S } = api;
  const st = { turn: 0, pitch: 0, holdT: 0, on: false, look: 0,
    aimYaw: 0, aimPitch: 0, mouseOn: false, padPrev: [] };
  const dz = v => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);   // zona muerta con rampa
  const _q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), _aim = new THREE.Vector3(), _focus = new THREE.Vector3();
  const pad = () => (navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null);
  const canvas = api.renderer.domElement;

  // ── Ratón: se captura con un clic; mueve la dirección de apuntado ──
  canvas.addEventListener("click", () => { if (st.on && !S.paused && !document.pointerLockElement) canvas.requestPointerLock && canvas.requestPointerLock(); });
  document.addEventListener("pointerlockchange", () => { st.mouseOn = document.pointerLockElement === canvas; if (st.mouseOn) syncAimToPlane(); });
  addEventListener("mousemove", e => {
    if (!st.on || !st.mouseOn || S.paused) return;
    st.aimYaw -= e.movementX * MOUSE_SENS;
    st.aimPitch = THREE.MathUtils.clamp(st.aimPitch - e.movementY * MOUSE_SENS * (S.invert ? -1 : 1), -1.3, 1.3);
  });
  function syncAimToPlane() {
    const f = S.flight; if (!f) return;
    const { fwd } = f.axes();
    st.aimYaw = Math.atan2(fwd.x, fwd.z); st.aimPitch = Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1));
  }
  const aimDir = out => out.set(Math.sin(st.aimYaw) * Math.cos(st.aimPitch), Math.sin(st.aimPitch), Math.cos(st.aimYaw) * Math.cos(st.aimPitch));
  const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

  addEventListener("keydown", e => { if (st.on && !S.paused && e.code !== "KeyC" && kbHas("cam", e.code) && !e.repeat) api.setCam(api.rig.next()); });
  // ── Botones del mando que funcionan también en pausa (Start) ──
  (function poll() {
    requestAnimationFrame(poll);
    if (!st.on) return;
    const gp = pad(); if (!gp) return;
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const now = [b(B.pad.pause), b(B.pad.cam)];
    if (now[0] && !st.padPrev[0] && S.running && !S.waitT && !(S.crashT > 0)) api.pause(!S.paused);
    if (now[1] && !st.padPrev[1] && !S.paused) api.setCam(api.rig.next());
    st.padPrev = now;
  })();

  // ── HOOK.input: lo que el motor usa para mover la nave ──
  function input(dt) {
    if (!st.on) return null;
    const k = S.keys, f = S.flight, P = S.P;
    const has = (...c) => c.some(x => k.has(x));
    // Teclado sin ratón: flechas (y A/D para girar)
    // Teclado, según la asignación del jugador (controls.js)
    let pitchIn = (kbAny("up", k) ? 1 : 0) - (kbAny("down", k) ? 1 : 0);
    let turnIn = (kbAny("right", k) ? 1 : 0) - (kbAny("left", k) ? 1 : 0);
    let accel = kbAny("accel", k) || has("ShiftRight"), brake = kbAny("brake", k) || has("ControlRight");
    let hold = kbAny("target", k);
    let lookX = 0, lookY = 0;
    const gp = pad();
    if (gp) {
      const a = i => (gp.axes.length > i ? dz(gp.axes[i]) : 0);
      if (a(1)) pitchIn = a(1);                    // stick izquierdo ↑↓ (arriba = picar, como un avión)
      if (a(0)) turnIn = a(0);                     // stick izquierdo ←→ = girar
      lookX = a(2); lookY = a(3);                  // stick derecho = mirar alrededor
      const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
      if (btn(B.pad.accel)) accel = true; if (btn(B.pad.brake)) brake = true;
      if (btn(B.pad.target)) hold = true;
    }
    if (S.invert) pitchIn = -pitchIn;
    const manual = !!(pitchIn || turnIn);
    // Apuntado con el ratón: si no hay mando a mano, la nave vuela sola hacia donde apunta el ratón
    const { fwd, right } = f.axes();
    let bankMax = BANK;
    if (st.mouseOn && !manual) {
      aimDir(_aim);
      const hErr = wrap(st.aimYaw - Math.atan2(fwd.x, fwd.z));
      const vErr = st.aimPitch - Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1));
      turnIn = THREE.MathUtils.clamp(-hErr * 2.4, -1, 1);
      pitchIn = THREE.MathUtils.clamp(vErr * 3.2, -1, 1);
      bankMax = 0.7;
      combat.setMouseAim(_aim);
    } else {
      if (st.mouseOn) syncAimToPlane();   // con el mando o las flechas, el ratón se queda donde va la nave
      combat.setMouseAim(null);
    }
    // Suavizado
    const r = 1 - Math.exp(-dt * (st.mouseOn && !manual ? 10 : 7));
    st.pitch += (pitchIn - st.pitch) * r; st.turn += (turnIn - st.turn) * r;
    // Cámara: al objetivo (mantener Y / Tab / E), detrás de la mira del ratón, o libre con el stick derecho
    st.holdT = hold ? st.holdT + dt : 0;
    const tgt = st.holdT > HOLD ? combat.focusTarget() : null;
    if (tgt) api.rig.focus = tgt.pos;
    else if (st.mouseOn && !manual) api.rig.focus = _focus.copy(f.pos).addScaledVector(aimDir(_aim), 3000);
    else api.rig.focus = null;
    const o = api.rig.orbit;
    if (lookX || lookY) { st.look = 1; o.yaw = -lookX * 2.7; o.pitch = THREE.MathUtils.clamp(lookY * 0.9, -0.6, 1.2); o.idle = 0; }
    else if (st.look) { o.yaw *= Math.exp(-dt * 6); o.pitch *= Math.exp(-dt * 6); if (Math.abs(o.yaw) + Math.abs(o.pitch) < 0.01) { o.yaw = o.pitch = 0; st.look = 0; } }
    api.rig.aimPitch = 0; combat.setAim(0);
    // Alabeo automático: el que toca para el giro (al soltar, vuelve a nivel)
    const wantRY = -Math.sin(bankMax * st.turn);
    const roll = THREE.MathUtils.clamp((right.y - wantRY) * 3.2, -1, 1);
    // Velocidad: la de combate; acelerar / frenar mientras se pulsa
    const vt = P.vmax * (accel ? 1 : brake ? 0.45 : 0.72);
    st.vt = accel || brake ? vt : 0;
    f.throttle = accel ? 1 : THREE.MathUtils.clamp(P.cruise + (vt - f.speed) * 0.04, brake ? 0 : 0.15, 1);
    // Morro más tranquilo que en Wiki Flight (unos 60°/s a tope): arcade, sin bandazos
    const PK = PITCH_K[P.id] || 0.6;
    return { pitch: st.pitch * PK, roll, yaw: 0, brake: false, boost: accel };
  }

  // Después de la física: el giro directo (en planta), independiente del alabeo
  function post(dt) {
    if (!st.on) return;
    const f = S.flight;
    if (!f || f.onGround || !(S.crashT <= 0)) return;
    // Acelerar y frenar se notan enseguida (arcade): empujón directo hacia la velocidad pedida
    if (st.vt) { const dv = THREE.MathUtils.clamp((st.vt - f.speed) * 0.9, -30, 30) * dt; f.vel.addScaledVector(f.axes().fwd, dv); }
    const step = -st.turn * (TURN[S.P.id] || 1) * dt;
    if (Math.abs(step) < 1e-6) return;
    _q.setFromAxisAngle(UP, step);
    f.q.premultiply(_q).normalize(); f.vel.applyQuaternion(_q);
  }

  return {
    input, post,
    start() { Object.assign(st, { turn: 0, pitch: 0, holdT: 0, look: 0, on: true }); api.rig.lockDrag = true; syncAimToPlane(); },
    respawn() { st.turn = st.pitch = 0; syncAimToPlane(); },
    stop() {
      st.on = false; api.rig.focus = null; api.rig.aimPitch = 0; api.rig.lockDrag = false; combat.setAim(0); combat.setMouseAim(null);
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    },
    get mouseOn() { return st.mouseOn; },
    setSens(k) { MOUSE_SENS = 0.0022 * (k || 1); },
  };
}
