/* ═══════════════════════════════════════════════════════════════════════════
   ⚔️ Sky Guardians — combate (fase 4)
   Armas de las dos naves, proyectiles, ayuda de apuntado al estilo arcade, fijar objetivos, daño, el primer
   enemigo (caza de escolta) con su IA, oleadas sencillas, vida/escudo del jugador, puntos con racha y un HUD de
   combate provisional (el definitivo es de la fase 6).
   Mandos: Espacio / X (mando) = arma 1 · V / clic derecho / Y = arma 2 · Tab / LB = fijar objetivo.
   ═══════════════════════════════════════════════════════════════════════════ */
import { Particles, TOWER_SCALE as TS } from "./tower.js";
// Una sola torre, 3× más grande: recibe una cuarta parte del daño (antes se repartía entre 5) y los kits valen más
const TOWER_DMG_K = 0.72, KIT_REPAIR = 15;   // 0.72 desde la tanda C: las torretas paran muchos drones y misiles
import { enemyModels, ENEMY_RIM } from "./models.js";
import { createSearchlights } from "./lights.js";
import { bindings as B, kbHas, kbAny, keyName, padName } from "./controls.js";

// Armas de cada nave
export const WEAPONS = {
  "sg-attack": {
    gun: { name: "gun2", rate: 14, dmg: 7, speed: 950, heat: 0.03, cool: 0.38, spread: 0.0045, len: 14, muzzles: [[-1.6, -0.45, -1.6], [1.6, -0.45, -1.6]] },
    sec: { kind: "rockets", name: "rockets", ammo: 16, salvo: 8, gap: 0.07, speed: 360, dmg: 45, splash: 30, reload: 1.4, muzzles: [[-3, -1, -1], [3, -1, -1], [-2.3, -1, -1], [2.3, -1, -1]] },
  },
  "sg-fighter": {
    gun: { name: "cannon", rate: 24, dmg: 4.5, speed: 1050, heat: 0.022, cool: 0.4, spread: 0.003, len: 18, muzzles: [[0.95, 0.32, -6]] },
    sec: { kind: "missiles", name: "missiles", ammo: 4, maxLock: 4, lockTime: 0.5, cone: 0.4, range: 3200, speed: 250, accel: 300, vmax: 720, turn: 3.6, dmg: 95, reload: 4.5, muzzles: [[-3.2, -0.8, 1.6], [3.2, -0.8, 1.6]] },
  },
};
// Ayuda de apuntado: dentro del cono, las balas se desvían hacia el punto de impacto; en el centro del todo,
// tanto como ASSIST_K, y menos cuanto más al borde (hay que apuntar). Ajustes: baja / media / alta
let ASSIST_CONE = 0.12, ASSIST_K = 0.8;   // 0,12 rad ≈ 7°
const ASSIST_RANGE = 2300;
const PLAYER_R = 7;
const HULL = 100, SHIELD = 50, SHIELD_WAIT = 4, SHIELD_REGEN = 12;
const REST = 18;                // s de respiro entre oleadas (desde la 7.ª)
// Partidas rápidas: respiros cortos al principio, cuando aún hay poco que preparar; en Blitz, casi ninguno
const restFor = (wave, mode) => mode === "blitz" ? 3 : wave <= 3 ? 8 : wave <= 6 ? 13 : REST;
const CALL_PTS = 15;            // llamar ya a la oleada: puntos por segundo de respiro ahorrado × nº de oleada
const BLITZ_S = 300;            // Blitz: 5 minutos
const COMBO_MAX = 8;            // racha: multiplicador ×1…×8 (un derribo más = ×1 más)
const LOW_AGL = 140;                   // m sobre el suelo: por debajo, el derribo vale ×1,5 (vuelo rasante)
const comboWin = m => Math.max(3.5, 6.5 - 0.4 * (m - 1));   // s para el siguiente derribo; menos cuanto más alta
// Potenciadores: caen a veces al derribar; se cogen pasando por encima. dur 0 = efecto al momento
const POWER = {
  rapid:  { css: "#ffb020", dur: 15 },   // fuego rápido: cadencia ×1,6 y el arma no se calienta
  ammo:   { css: "#c58cff", dur: 15 },   // arma 2 sin límite
  repair: { css: "#5ab8ff", dur: 0 },    // nave reparada: escudo y casco al máximo
  double: { css: "#ffd23a", dur: 20 },   // puntos dobles
};
const POWER_P = { boss: 1, bomber: 0.2, heli: 0.12, attacker: 0.08, escort: 0.08, cruise: 0.06, drone: 0.03 };
// Torretas antiaéreas: 4 en las esquinas de la explanada; se apagan con la torre por debajo del 30 %
const AA_MIN = 30, AA_RANGE = 1500, AA_SPEED = 900, AA_RATE = 6, AA_DMG = 2, AA_SPREAD = 0.02;   // con la simulación: 25–50 derribos por partida, misma duración que sin torretas
const SAVE_R = 900, SAVE_PTS = 100;   // «¡Salvada!»: derribar a quien ya estaba a menos de 900 m de la torre
// Ventajas entre oleadas (v1.1): cada PERK_EVERY oleadas se elige 1 de 3, solo para esa partida. max: veces que se
// puede coger. Los efectos se aplican donde se usan (pk("…") = nivel)
export const PERKS = {
  dmg:    { icon: "🎯", max: 3 },   // arma 1: +20 % de daño por nivel
  rate:   { icon: "⚡", max: 3 },   // arma 1: +15 % de cadencia y se calienta un 15 % menos
  sec:    { icon: "🚀", max: 2 },   // arma 2: +25 % de munición y recarga un 20 % más rápida
  armor:  { icon: "🛡️", max: 3 },   // casco +25
  shield: { icon: "🔷", max: 2 },   // escudo +20 y empieza a recargarse antes
  aa:     { icon: "🗼", max: 3 },   // torretas: +35 % de daño y +15 % de alcance
  kits:   { icon: "🔧", max: 2 },   // kits: reparan +5 % y caen un 30 % más
  regen:  { icon: "🧱", max: 2 },   // respiro: la torre recupera +4 % más
  magnet: { icon: "🧲", max: 1 },   // kits, anillo y potenciadores se cogen desde más lejos
  flares: { icon: "✨", max: 2 },   // +1 bengala y se recargan un 25 % antes
  power:  { icon: "⏳", max: 1 },   // potenciadores: +50 % de duración y caen un 40 % más
};
const PERK_EVERY = 3;
// Misiles enemigos contra el jugador (cazas de escolta desde el nivel 4 y el jefe furioso) y bengalas para desviarlos
const MSL = { lv: 4, speed0: 60, accel: 140, turn: 1.55, life: 9, fuse: 18, max: { easy: 1, normal: 2, hard: 3 }, dmg: { easy: 22, normal: 30, hard: 38 },
  cd: { easy: 26, normal: 17, hard: 13 }, decoyP: { easy: 0.92, normal: 0.85, hard: 0.75 } };
const FLARES = 3, FLARE_RECHARGE = 12, FLARE_GAP = 0.6;
const WX_SPREAD = { clear: 1, rain: 1.15, snow: 1.15, storm: 1.35 };   // con mal tiempo los enemigos fallan más

export function createCombat(api, { t, towers, onGameOver, sound, onWeather }) {
  const snd = (n, ...a) => { if (sound) sound.play(n, ...a); };
  const rum = (a, b, ms) => { if (sound) sound.rumble(a, b, ms); };
  const distToMe = p => (S.flight ? S.flight.pos.distanceTo(p) : 9999);
  const { THREE, S, scene, camera } = api;
  const V = () => new THREE.Vector3();
  const rnd = Math.random;
  let wrnd = Math.random;   // azar de las oleadas (composición, tema, lados); con semilla en la partida diaria
  const seeded = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let x = Math.imul(a ^ a >>> 15, 1 | a); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const ZONE = 5500;

  // ── Efectos compartidos ──
  const fx = {
    fire: new Particles(THREE, 900, fxTex("fire"), true),
    smoke: new Particles(THREE, 900, fxTex("smoke"), false),
    sparks: new Particles(THREE, 700, fxTex("fire"), true),
  };
  for (const p of Object.values(fx)) scene.add(p.points);
  function fxTex(kind) {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (kind === "fire") { gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); }
    else { gr.addColorStop(0, "rgba(255,255,255,.5)"); gr.addColorStop(0.6, "rgba(255,255,255,.25)"); gr.addColorStop(1, "rgba(255,255,255,0)"); }
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  }
  const puff = (p, n = 6, size = 4, dark = 0.3) => { for (let i = 0; i < n; i++) fx.smoke.spawn(p.x, p.y, p.z, (rnd() - 0.5) * 6, rnd() * 4, (rnd() - 0.5) * 6, 2 + rnd() * 2, size, size * 3, [dark, dark, dark, 0.5], [dark * 1.4, dark * 1.4, dark * 1.4, 0], 0.8, -0.5); };
  const sparkBurst = (p, n = 10, v0 = 18) => { for (let i = 0; i < n; i++) { const v = v0 * (0.4 + rnd()); fx.sparks.spawn(p.x, p.y, p.z, (rnd() - 0.5) * v, (rnd() - 0.3) * v, (rnd() - 0.5) * v, 0.3 + rnd() * 0.5, 0.6, 0.2, [1, 0.9, 0.6, 1], [1, 0.4, 0.1, 0], 0.5, 9.8); } };
  const boom = (p, size = 1) => {
    if (REC.on) REC.ev.push({ t: game.time, p: [p.x, p.y, p.z], s: size });   // para la repetición
    for (let i = 0; i < 22 * size; i++) { const v = (8 + rnd() * 20) * size; fx.fire.spawn(p.x, p.y, p.z, (rnd() - 0.5) * v, (rnd() - 0.4) * v, (rnd() - 0.5) * v, 0.3 + rnd() * 0.4, 7 * size + rnd() * 5 * size, 2, [1, 0.85, 0.5, 1], [0.9, 0.25, 0.05, 0], 2.5, 0); }
    for (let i = 0; i < 10 * size; i++) fx.smoke.spawn(p.x, p.y, p.z, (rnd() - 0.5) * 10, rnd() * 6, (rnd() - 0.5) * 10, 3 + rnd() * 3, 6 * size, 22 * size, [0.12, 0.11, 0.1, 0.7], [0.25, 0.24, 0.23, 0], 0.8, -0.4);
    sparkBurst(p, 30 * size, 25 * size);
  };

  // ── Balas (una InstancedMesh: trazadoras alargadas) ──
  const MAXB = 700;
  const bGeo = new THREE.BoxGeometry(0.45, 0.45, 1);
  const bMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const bMesh = new THREE.InstancedMesh(bGeo, bMat, MAXB); bMesh.frustumCulled = false; bMesh.count = 0; scene.add(bMesh);
  const bullets = [];   // { p, v, life, dmg, own: "p"|"e", len }
  const C_PB = new THREE.Color(1.0, 0.82, 0.45), C_EB = new THREE.Color(1.0, 0.3, 0.18), C_AB = new THREE.Color(0.7, 1.0, 0.78);
  // ── Cohetes y misiles ──
  const rGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8); rGeo.rotateX(Math.PI / 2);
  const mGeo = new THREE.CylinderGeometry(0.16, 0.16, 2.8, 8); mGeo.rotateX(Math.PI / 2);
  const rMat = new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.5, metalness: 0.3 });
  const shots = [];     // { kind, mesh, p, v, life, target, dmg, splash }

  // ── Jugador ──
  const pl = { hull: HULL, shield: SHIELD, sinceHit: 99, heat: 0, over: false, gunCD: 0, ammo: 0, reloadT: 0, salvoLeft: 0, salvoCD: 0, salvoSide: 0,
    locks: [], lockT: 0, lockTarget: null, streak: 0, alive: true, hitT: 0, dmgT: 0, pw: {}, flares: FLARES, flareT: 0, flareCD: 0, firedT: 0 };
  let W = WEAPONS["sg-attack"], playerCruise = 120;
  const game = { on: false, wave: 0, lv: 1, phase: "rest", restT: 6, score: 0, kills: 0, spawnT: 0, banner: null, bannerT: 0, feed: [], queue: [], sectors: [],
    D: null, diff: "normal", time: 0, shots: 0, hits: 0, killsBy: {}, bestStreak: 0, towerLost: [], kitsDelivered: 0, over: false, overT: 0, reported: false,
    perks: {}, perkList: [], offer: null, weather: "clear", wxMode: "auto" };
  // Ventajas: nivel de cada una y lo que cambian
  const pk = k => game.perks[k] || 0;
  const maxHull = () => HULL + 25 * pk("armor"), maxShield = () => SHIELD + 20 * pk("shield");
  const ammoMax = () => Math.round(W.sec.ammo * (1 + 0.25 * pk("sec")));
  const flaresMax = () => FLARES + pk("flares");
  const reach = r => r * (pk("magnet") ? 1.8 : 1);
  // Repetición: los últimos 32 s de la partida (20 fotos por segundo) y las explosiones
  const REC = { on: false, frames: [], ev: [], acc: 0, eid: 0 };
  let warmCache = null;   // muestras para compilar los shaders en la carga (warmObjects)

  // ── Mandos ──
  const keys = new Set(); let mouseR = false, mouseL = false, padPrev = [], mouseAim = null;
  addEventListener("keydown", e => {
    if (RP.on) { replayKey(e.code); e.preventDefault(); return; }
    if (!game.on) return;
    if (kbHas("fire1", e.code) || kbHas("fire2", e.code) || kbHas("target", e.code)) { keys.add(e.code); e.preventDefault(); }
    if (kbHas("target", e.code) && !e.repeat) cycleLock();
    if (kbHas("flare", e.code) && !e.repeat && !S.paused) dropFlares();
    if (kbHas("callWave", e.code) && !e.repeat && !S.paused) callWave();
    const pi = PERK_KEYS.indexOf(e.code) % 3; if (game.offer && pi >= 0 && !e.repeat && !S.paused) choosePerk(pi);
  });
  addEventListener("keyup", e => keys.delete(e.code));
  addEventListener("blur", () => { keys.clear(); mouseR = false; mouseL = false; });
  addEventListener("contextmenu", e => { if (game.on) e.preventDefault(); });
  // Ratón: con el puntero capturado (apuntado con el ratón), clic izquierdo = arma 1 y derecho = arma 2
  addEventListener("pointerdown", e => { if (!game.on) return; if (e.button === 2) mouseR = true; if (e.button === 0 && document.pointerLockElement) mouseL = true; });
  addEventListener("pointerup", e => { if (e.button === 2) mouseR = false; if (e.button === 0) mouseL = false; });
  function readPad() {
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null;
    // Mando: RT = arma 1, LT = arma 2 (mantener para fijar misiles), Y = siguiente objetivo
    const v = i => (gp && gp.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0);
    const now = [v(B.pad.fire1) > 0.3, v(B.pad.fire2) > 0.3, v(B.pad.target) > 0.5, v(B.pad.flare) > 0.5, v(14) > 0.5, v(13) > 0.5, v(15) > 0.5, v(B.pad.callWave) > 0.5];
    if (now[2] && !padPrev[2]) cycleLock();
    if (now[3] && !padPrev[3]) dropFlares();
    if (now[7] && !padPrev[7] && !S.paused) callWave();
    if (game.offer) for (let i = 0; i < 3; i++) if (now[4 + i] && !padPrev[4 + i]) { choosePerk(i); break; }   // cruceta ← ↓ →
    padPrev = now;
    return { fire1: now[0], fire2: now[1] };
  }

  // ── Enemigos ──
  const enemies = [];
  const models = enemyModels(api);
  const KIND = {   // radio para los impactos, vida, puntos y si va a por las torres
    escort:   { R: 9,   hp: 60,  pts: 100,  tower: false },
    attacker: { R: 9,   hp: 80,  pts: 150,  tower: true },
    drone:    { R: 5,   hp: 14,  pts: 50,   tower: true },
    cruise:   { R: 5,   hp: 10,  pts: 120,  tower: true },
    hmissile: { R: 3.5, hp: 4,   pts: 20,   tower: true },
    heli:     { R: 10,  hp: 140, pts: 200,  tower: true },
    bomber:   { R: 16,  hp: 320, pts: 300,  tower: true },
    boss:     { R: 28,  hp: 900, pts: 2000, tower: true },
    dummy:    { R: 10,  hp: 40,  pts: 0,    tower: false },   // blanco de prácticas (entrenamiento)
  };
  const aliveTowers = () => towers().filter(o => o.hp > 0);
  function pickTower(from, not) {   // la torre viva más cercana (a veces otra, al azar)
    let list = aliveTowers(); if (not) { const l2 = list.filter(o => !not.has(o)); if (l2.length) list = l2; }
    if (!list.length) return null;
    list.sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
    return list[rnd() < 0.6 ? 0 : (rnd() * list.length) | 0];
  }
  // Medidas del blanco: la torre (396 m, explanada de 93 m) o un monumento 3D (su altura y su radio)
  const tH = o => o.H || 132 * TS, tR = o => o.R || 31 * TS;
  const towerAim = (o, out, y = 100) => out.set(o.x, o.tw.root.position.y + y / 132 * tH(o), o.z);   // y: altura en la torre sin escalar (0–132)
  function spawnPoint() {   // en el borde de la zona, por uno de los sectores de la oleada
    const s = game.sectors[(rnd() * game.sectors.length) | 0] ?? rnd() * Math.PI * 2, a = s + (rnd() - 0.5) * 0.7, r = ZONE - 150;
    return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  function spawn(kind, at = null, opts = {}) {
    const K0 = KIND[kind], lv = game.lv;
    const p = at ? at.clone() : spawnPoint();
    if (!at) p.y = api.groundAt(p.x, p.z) + { escort: 700 + rnd() * 500, attacker: 500 + rnd() * 200, drone: 260 + rnd() * 80, cruise: 70, hmissile: 0, heli: 320, bomber: 650 + rnd() * 120, boss: 850 }[kind];
    const model = models(kind === "dummy" ? "attacker" : kind); scene.add(model);
    const dir = opts.dir ? opts.dir.clone().normalize() : new THREE.Vector3(-p.x, 0, -p.z).normalize();
    const hpK = kind === "boss" ? 1 : 1 + Math.min(lv, 20) * 0.03;
    const e = { id: ++REC.eid, kind, model, pos: p, dir, vel: V(), bank: 0, R: K0.R, hp: K0.hp * hpK, maxHp: K0.hp * hpK, alive: true, smokeAcc: 0, expl: null,
      state: "go", stT: 0, fireCD: 2 + rnd() * 2, burst: 0, burstCD: 0, gunT: 0, breakDir: V(), tgt: null, turn: 1, speed: 100, cur: 0 };
    e.dmg = 2 + 0.12 * Math.min(lv, 15); e.spread = Math.max(0.016, 0.065 - lv * 0.003);
    const sp = playerCruise * game.D.speedK;
    switch (kind) {
      case "escort":   e.speed = sp * Math.min(1.02, 0.8 + 0.018 * lv); e.turn = Math.min(1.05, 0.5 + 0.035 * lv); e.state = "attack"; e.fireCD = 3 + rnd() * 2; e.mslCD = 6 + rnd() * MSL.cd[game.diff]; break;
      case "attacker": e.speed = sp * Math.min(0.95, 0.72 + 0.012 * lv); e.turn = Math.min(0.9, 0.55 + 0.02 * lv); break;
      case "drone":    e.speed = sp * 0.85 + lv * 2; e.turn = 1.5; break;
      case "cruise":   e.speed = Math.max(200, sp * 1.1); e.turn = 0.9; break;
      case "hmissile": e.speed = 150; e.turn = 2.2; break;
      case "heli":     e.speed = 70; e.turn = 1.0; e.fireCD = 3; break;
      case "bomber":   e.speed = sp * 0.5; e.turn = 0.32; e.fireCD = 2; break;
      case "dummy":    e.speed = 60; e.turn = 0.5; e.home = (opts.home || p).clone(); break;
      case "boss":     e.speed = e.baseSpeed = sp * 0.42; e.turn = 0.22; e.fireCD = 2; e.droneT = 20; e.done = new Set(); e.phase = 1;
        e.engines = (model.userData.engines || []).map(o => ({ off: new THREE.Vector3(...o), hp: 220, alive: true, w: V(), smoke: 0 })); break;
    }
    if (K0.tower) e.tgt = opts.tgt || pickTower(p);
    enemies.push(e);
    return e;
  }
  function killEnemy(e, byPlayer = true) {
    if (!e.alive) return;
    e.alive = false;
    const big = { boss: 3, bomber: 2, drone: 0.6, hmissile: 0.4, cruise: 0.7 }[e.kind] || 1.2;
    // explosión con trozos solo para los aviones; drones y misiles, solo fuego y humo (en enjambre pesa mucho)
    if (!["hmissile", "drone", "cruise", "dummy"].includes(e.kind)) e.expl = new api.Explosion(scene, e.model, e.pos, e.vel, e.R * 1.5);
    scene.remove(e.model);
    boom(e.pos, big);
    { const d = distToMe(e.pos); snd("explosion", d, Math.min(2, big)); if (d < 400) rum(0.35, 0.5, 160); if (d < 700) shake(2.6 * (1 - d / 700) * Math.min(2, big)); }
    if (byPlayer) { if (e.kind === "boss") { slowMo(0.3, 1600); shake(5); } else slowMo(0.15, 70); }
    if (byPlayer) {
      // Racha (combo): cada derribo sube el multiplicador hasta ×8, pero hay que encadenarlos: si pasa
      // demasiado tiempo sin derribar (cada vez menos cuanto más alta), se pierde. Daño a la torre o a ti, también.
      pl.streak = Math.min(pl.streak + 1, COMBO_MAX); pl.comboT = comboWin(pl.streak); game.bestStreak = Math.max(game.bestStreak, pl.streak);
      // Vuelo rasante: derribo volando a menos de LOW_AGL sobre el suelo → ×1,5
      const fp = S.flight && S.flight.pos, low = !!fp && fp.y - api.groundAt(fp.x, fp.z) < LOW_AGL;
      const mult = Math.max(1, pl.streak) * (pl.pw.double > 0 ? 2 : 1), pts = Math.round(KIND[e.kind].pts * mult * (low ? 1.5 : 1));
      game.score += pts; game.kills++; game.killsBy[e.kind] = (game.killsBy[e.kind] || 0) + 1; if (low) game.lowKills = (game.lowKills || 0) + 1;
      game.feed.push({ txt: `+${pts}${mult > 1 ? "  ×" + mult : ""}${low ? "  · " + t("lowBonus") : ""}`, t: 1.6, col: low ? "#7ff0ff" : undefined });
      // ¡Salvada!: derribado cuando ya estaba encima de la torre
      if (KIND[e.kind].tower && e.kind !== "boss" && !game.training && e.tgt && e.tgt.hp > 0 && Math.hypot(e.pos.x - e.tgt.x, e.pos.z - e.tgt.z) < SAVE_R) {
        game.score += SAVE_PTS; game.saves = (game.saves || 0) + 1; game.feed.push({ txt: t("saved", { p: SAVE_PTS }), t: 1.8, col: "#7ee08a" }); snd("saved");
      }
      maybeKit(e); maybePower(e);
      if (e.kind === "boss") banner(t("bossDown"), 3, "good");
    }
    pl.locks = pl.locks.filter(l => l !== e); if (pl.lockTarget === e) pl.lockTarget = null;
  }
  function damageEnemy(e, dmg, at, mine = true, src = "a") {
    const other = () => { if (src === "w") { game.wingKills = (game.wingKills || 0) + 1; if (rnd() < 0.5) game.feed.push({ txt: t("wingKill"), t: 1.8, col: "#8fd0ff" }); } else game.aaKills = (game.aaKills || 0) + 1; };
    if (!e.alive) return;
    if (mine) { pl.hitT = 0.15; game.hits++; }
    if (at) sparkBurst(at, 5, 12);
    if (e.kind === "boss") {   // los motores reciben el daño entero; el fuselaje, la cuarta parte
      let eng = null, bd = Infinity;
      if (at) for (const m of e.engines) if (m.alive) { const d = m.w.distanceTo(at); if (d < 10 && d < bd) { bd = d; eng = m; } }
      if (eng) { eng.hp -= dmg; if (eng.hp <= 0) { eng.alive = false; boom(eng.w, 1.3); e.speed *= 0.85; game.feed.push({ txt: t("engineDown"), t: 1.8 }); } }
      else e.hp -= dmg * 0.25;
      if (e.hp <= 0 || !e.engines.some(m => m.alive)) { if (!mine) other(); killEnemy(e, mine); }
      return;
    }
    e.hp -= dmg; if (mine) snd("hit");
    if (e.hp <= 0) { if (!mine) other(); killEnemy(e, mine); }
  }

  // ── Daño al jugador ──
  function damagePlayer(d) {
    if (!pl.alive || S.crashT > 0) return;
    pl.sinceHit = 0; pl.dmgT = 0.35; pl.streak = 0;
    snd("playerHit"); rum(0.55, 0.4, 170); shake(1.2);
    if (pl.shield > 0 && pl.shield <= d) snd("shieldDown");
    const s = Math.min(pl.shield, d); pl.shield -= s; d -= s;
    pl.hull -= d;
    if (pl.hull <= 0) { pl.hull = 0; pl.alive = false; pl.kit = false; api.crash("shot"); }
  }
  function resetPlayer() {
    Object.assign(pl, { hull: maxHull(), shield: maxShield(), sinceHit: 99, heat: 0, over: false, gunCD: 0, ammo: ammoMax(), reloadT: 0, salvoLeft: 0, locks: [], lockT: 0, alive: true, pw: {},
      flares: flaresMax(), flareT: 0 });
    for (const m of emissiles) m.target = null;   // los misiles que te perseguían se pierden
  }

  // ── Bengalas: desvían los misiles que te persiguen (se recargan de una en una) ──
  const flares = [];   // { p, v, life }
  function dropFlares() {
    const f = S.flight; if (!f || !pl.alive || S.crashT > 0 || !game.on || game.over || pl.flareCD > 0) return;
    if (pl.flares <= 0) { snd("empty"); return; }
    pl.flares--; pl.flareCD = FLARE_GAP; game.flaresUsed = (game.flaresUsed || 0) + 1;
    const { fwd, up, right } = f.axes();
    const fresh = [];
    for (let i = 0; i < 6; i++) {
      const side = (i % 2 ? 1 : -1) * (0.6 + rnd() * 0.6);
      const v = f.vel.clone().multiplyScalar(0.55).addScaledVector(right, side * 28).addScaledVector(up, -12 - rnd() * 14).addScaledVector(fwd, -25 - rnd() * 20);
      const r = { p: f.pos.clone().addScaledVector(fwd, -S.P.len * 0.4), v, life: 3.2 + rnd() * 0.8 }; flares.push(r); fresh.push(r);
    }
    snd("flare"); rum(0.1, 0.25, 90);
    // cada misil que te persigue se va (casi siempre) detrás de una bengala
    for (const m of emissiles) if (m.target === "player" && m.p.distanceTo(f.pos) < 2800 && rnd() < MSL.decoyP[game.diff]) { m.target = null; m.decoy = fresh[(rnd() * fresh.length) | 0]; m.decoyed = true; }
  }
  function updateFlares(dt) {
    if (pl.flareCD > 0) pl.flareCD -= dt;
    if (pl.flares < flaresMax() && (pl.flareT += dt) >= FLARE_RECHARGE * (1 - 0.25 * pk("flares"))) { pl.flareT = 0; pl.flares++; }
    if (pl.flares >= flaresMax()) pl.flareT = 0;
    for (let i = flares.length - 1; i >= 0; i--) {
      const r = flares[i]; r.life -= dt; r.v.y -= 9.8 * dt * 0.5; r.v.multiplyScalar(1 - 0.6 * dt); r.p.addScaledVector(r.v, dt);
      fx.sparks.spawn(r.p.x, r.p.y, r.p.z, 0, 0, 0, 0.12, 4.5, 2, [1, 1, 0.9, 1], [1, 0.7, 0.3, 0], 0, 0);
      if ((r.sm = (r.sm || 0) + dt) > 0.05) { r.sm = 0; fx.smoke.spawn(r.p.x, r.p.y, r.p.z, 0, 0.6, 0, 2, 1.5, 6, [0.9, 0.9, 0.9, 0.45], [0.95, 0.95, 0.95, 0], 0.5, -0.2); }
      if (r.life <= 0) flares.splice(i, 1);
    }
  }

  // ── Misiles enemigos contra el jugador ──
  const emissiles = [];   // { mesh, p, v, life, target: "player"|null, decoy }
  const emGeo = new THREE.CylinderGeometry(0.18, 0.18, 3, 8); emGeo.rotateX(Math.PI / 2);
  const emMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.3 });
  function fireAtPlayer(from, vel0) {
    const f = S.flight; if (!f || !pl.alive || S.crashT > 0 || game.over || game.training) return false;
    if (emissiles.filter(m => m.target === "player").length >= MSL.max[game.diff]) return false;
    const mesh = new THREE.Mesh(emGeo, emMat); mesh.position.copy(from); scene.add(mesh);
    const v = vel0.clone(); v.setLength(v.length() + MSL.speed0);
    emissiles.push({ mesh, p: from.clone(), v, life: MSL.life, target: "player", decoy: null, trail: 0, sp: v.length() });
    snd("missileLaunch", distToMe(from));
    return true;
  }
  const _mW = V(), _mQ = new THREE.Quaternion();
  function updateEMissiles(dt) {
    const f = S.flight, alive = f && pl.alive && !(S.crashT > 0);
    for (let i = emissiles.length - 1; i >= 0; i--) {
      const m = emissiles[i]; m.life -= dt; _prev.copy(m.p);
      if (m.target === "player" && !alive) m.target = null;
      m.sp = Math.min(Math.max(playerCruise * 1.9, 330), m.sp + MSL.accel * dt);
      const dir = _a.copy(m.v).normalize();
      let aim = null;
      if (m.target === "player") aim = leadPoint(m.p, _mW.set(0, 0, 0), { pos: f.pos, vel: f.vel }, m.sp, _c);
      else if (m.decoy && m.decoy.life > 0) aim = _c.copy(m.decoy.p);
      if (aim) {
        const want = _b.copy(aim).sub(m.p).normalize(), ang = dir.angleTo(want);
        const turn = MSL.turn * (game.weather === "storm" ? 0.85 : 1);
        if (ang > 1e-4) { _mQ.setFromUnitVectors(dir, want); _mQ.slerp(_I, 1 - Math.min(1, turn * dt / ang)); dir.applyQuaternion(_mQ); }
      }
      m.v.copy(dir).multiplyScalar(m.sp);
      m.p.addScaledVector(m.v, dt);
      m.mesh.position.copy(m.p); m.mesh.lookAt(_b.copy(m.p).add(m.v));
      if ((m.trail += dt) > 0.025) { m.trail = 0; fx.smoke.spawn(_prev.x, _prev.y, _prev.z, 0, 0.4, 0, 1.8, 1.2, 5, [0.75, 0.75, 0.75, 0.5], [0.9, 0.9, 0.9, 0], 0.6, -0.2); fx.fire.spawn(_prev.x, _prev.y, _prev.z, 0, 0, 0, 0.05, 2, 0.6, [1, 0.8, 0.4, 1], [1, 0.4, 0.1, 0], 0, 0); }
      let done = m.life <= 0 || m.p.y < api.groundAt(m.p.x, m.p.z), hitMe = false;
      if (!done && m.target === "player" && segSphere(_prev, m.p, f.pos, MSL.fuse)) { damagePlayer(MSL.dmg[game.diff]); done = hitMe = true; }
      if (!done && m.decoy && m.p.distanceTo(m.decoy.p) < 16) done = true;
      if (!done && m.decoy && m.decoy.life <= 0) m.decoy = null;
      if (done) {
        // esquivado: se lo llevó una bengala o se quedó sin combustible persiguiéndote
        if (!hitMe && alive && (m.decoyed || m.target === "player")) { game.dodged = (game.dodged || 0) + 1; game.feed.push({ txt: t("dodged"), t: 1.6, col: "#7ee08a" }); }
        boom(m.p, 0.5); snd("explosion", distToMe(m.p), 0.5); scene.remove(m.mesh); emissiles.splice(i, 1);
      }
    }
  }
  const missileOnMe = () => emissiles.some(m => m.target === "player");

  // ── Apuntado ──
  // La mira puede ir unos grados por encima o por debajo del morro (stick derecho ↑↓ / R-F): todo apunta a ella
  let aimPitch = 0;
  const _aimV = V(), _rtA = V(), _UPA = new THREE.Vector3(0, 1, 0);
  function aimFwd(f) {
    const { fwd } = f.axes(); _aimV.copy(fwd);
    if (aimPitch) { _rtA.crossVectors(fwd, _UPA); if (_rtA.lengthSq() > 1e-6) _aimV.applyAxisAngle(_rtA.normalize(), aimPitch); }
    return _aimV;
  }
  const _a = V(), _b = V(), _c = V(), _d = V(), _q = new THREE.Quaternion();
  function leadPoint(from, fromVel, e, speed, out) {
    out.copy(e.pos); let tt = 0;
    for (let k = 0; k < 3; k++) { tt = out.distanceTo(from) / speed; out.copy(e.pos).addScaledVector(_d.copy(e.vel).sub(fromVel), tt); }
    return out;
  }
  // El enemigo más alineado con el morro dentro del cono (o el fijado si está dentro)
  function assistTarget(from, fwd, speed) {
    let best = null, ba = ASSIST_CONE;
    const cand = pl.lockTarget && pl.lockTarget.alive ? [pl.lockTarget, ...enemies] : enemies;
    for (const e of cand) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(from); if (d > ASSIST_RANGE) continue;
      leadPoint(from, S.flight.vel, e, speed, _c);
      const ang = _a.copy(_c).sub(from).normalize().angleTo(fwd);
      const lim = e === pl.lockTarget ? ASSIST_CONE * 1.3 : ASSIST_CONE;
      if (ang < Math.min(ba, lim)) { ba = ang; best = e; if (e === pl.lockTarget) break; }
    }
    return best;
  }
  // Dirección de disparo: el morro (o la mira), desviado hacia el punto de impacto según lo centrado que esté
  function assistDir(p, f, fwd, tgt, speed) {
    const dir = _a.copy(fwd);
    if (!tgt) return dir;
    const lead = leadPoint(p, f.vel, tgt, speed, _c).sub(p).normalize();
    const cone = tgt === pl.lockTarget ? ASSIST_CONE * 1.3 : ASSIST_CONE;
    const k = Math.max(0, 1 - dir.angleTo(lead) / cone) * ASSIST_K;
    return dir.lerp(lead, k).normalize();
  }
  function cycleLock() {   // el siguiente enemigo más cerca del centro de la pantalla
    const f = S.flight; if (!f) return;
    const fwd = aimFwd(f);
    const list = enemies.filter(e => e.alive).map(e => [e, _a.copy(e.pos).sub(f.pos).normalize().angleTo(fwd)]).sort((a, b) => a[1] - b[1]);   // primero los de delante; si no hay, cualquiera (como en los juegos modernos)
    if (!list.length) { pl.lockTarget = null; return; }
    const i = list.findIndex(x => x[0] === pl.lockTarget);
    pl.lockTarget = list[(i + 1) % list.length][0];
  }

  // ── Disparos ──
  function muzzle(m, f, out) { const { fwd, up, right } = f.axes(); return out.copy(f.pos).addScaledVector(right, m[0]).addScaledVector(up, m[1]).addScaledVector(fwd, -m[2]); }
  function addBullet(p, v, dmg, own, len, tower = null) {
    if (bullets.length >= MAXB) bullets.shift();
    bullets.push({ p: p.clone(), v: v.clone(), life: 1.8, dmg, own, len, tower });
    if (own === "p") game.shots++;
  }
  function firePlayerGun(dt) {
    const f = S.flight, G = W.gun;
    pl.gunCD -= dt;
    if (pl.over || pl.gunCD > 0) return;
    const rapid = pl.pw.rapid > 0;
    pl.gunCD += 1 / (G.rate * (rapid ? 1.6 : 1) * (1 + 0.15 * pk("rate"))); if (pl.gunCD < 0) pl.gunCD = 0;
    pl.firedT = 0.12;
    const fwd = aimFwd(f).clone();
    const tgt = assistTarget(f.pos, fwd, G.speed);
    for (const m of G.muzzles) {
      const p = muzzle(m, f, _b);
      const dir = assistDir(p, f, fwd, tgt, G.speed);
      dir.x += (rnd() - 0.5) * G.spread * 2; dir.y += (rnd() - 0.5) * G.spread * 2; dir.z += (rnd() - 0.5) * G.spread * 2; dir.normalize();
      addBullet(p, _d.copy(f.vel).addScaledVector(dir, G.speed), G.dmg * (1 + 0.2 * pk("dmg")), "p", G.len);
      fx.fire.spawn(p.x, p.y, p.z, f.vel.x, f.vel.y, f.vel.z, 0.05, 2.2, 1, [1, 0.85, 0.5, 1], [1, 0.5, 0.1, 0], 0, 0);
    }
    if (!rapid) { pl.heat += G.heat * (1 - 0.15 * pk("rate")); if (pl.heat >= 1) { pl.heat = 1; pl.over = true; } }
    snd(G.name === "cannon" ? "cannon" : "gun"); rum(0, 0.12, 35);
  }
  function launch(kind, p, v, target, sec) {
    const mesh = new THREE.Mesh(kind === "missile" ? mGeo : rGeo, rMat); mesh.position.copy(p); scene.add(mesh);
    shots.push({ kind, mesh, p: p.clone(), v: v.clone(), life: kind === "missile" ? 7 : 4, target, sec, trailAcc: 0 });
    game.shots++;
  }
  function fireRocket() {
    snd("rocket"); rum(0.15, 0.3, 80);
    const f = S.flight, R = W.sec, fwd = aimFwd(f).clone();
    const m = R.muzzles[pl.salvoSide++ % R.muzzles.length], p = muzzle(m, f, _b);
    const tgt = assistTarget(f.pos, fwd, R.speed);
    const dir = assistDir(p, f, fwd, tgt, R.speed);
    dir.x += (rnd() - 0.5) * 0.02; dir.y += (rnd() - 0.5) * 0.02; dir.z += (rnd() - 0.5) * 0.02; dir.normalize();
    launch("rocket", p, _d.copy(f.vel).addScaledVector(dir, R.speed), null, R);
  }
  function fireMissile(target) {
    snd("missile"); rum(0.2, 0.3, 120);
    const f = S.flight, Mi = W.sec, fwd = aimFwd(f).clone();
    const m = Mi.muzzles[pl.salvoSide++ % Mi.muzzles.length], p = muzzle(m, f, _b);
    launch("missile", p, _d.copy(f.vel).addScaledVector(fwd, Mi.speed * 0.3), target, Mi);
  }
  let fire2Prev = false;
  function secondary(dt, fire2) {
    const sec = W.sec;
    const AM = ammoMax(), RL = sec.reload * (1 - 0.2 * pk("sec"));
    if (pl.pw.ammo > 0) { pl.ammo = AM; pl.reloadT = 0; }
    // Recarga: de uno en uno
    if (pl.ammo < AM) { pl.reloadT += dt; if (pl.reloadT >= RL) { pl.reloadT = 0; pl.ammo++; } } else pl.reloadT = 0;
    if (sec.kind === "rockets") {
      if (fire2 && !fire2Prev && pl.salvoLeft === 0 && pl.ammo > 0) pl.salvoLeft = Math.min(sec.salvo, pl.ammo);
      if (pl.salvoLeft > 0) {
        pl.salvoCD -= dt;
        if (pl.salvoCD <= 0) { pl.salvoCD = sec.gap; pl.salvoLeft--; pl.ammo--; fireRocket(); }
      }
    } else {
      // Misiles: mantener = fijar hasta 4 en el cono; soltar = lanzar uno a cada fijado
      const f = S.flight, fwd = aimFwd(f).clone();
      if (fire2) {
        pl.lockT += dt;
        if (pl.lockT >= sec.lockTime && pl.locks.length < Math.min(sec.maxLock, pl.ammo)) {
          const c = enemies.filter(e => e.alive && !pl.locks.includes(e) && e.pos.distanceTo(f.pos) < sec.range && _a.copy(e.pos).sub(f.pos).normalize().angleTo(fwd) < sec.cone)
            .sort((a, b) => a.pos.distanceTo(f.pos) - b.pos.distanceTo(f.pos));
          if (c.length) { pl.locks.push(c[0]); pl.lockT = 0; snd("lock"); }
          else snd("locking");
        }
      } else if (fire2Prev) {
        if (pl.locks.length) { for (const e of pl.locks) if (pl.ammo > 0) { pl.ammo--; fireMissile(e); } }
        else if (pl.ammo > 0) { pl.ammo--; fireMissile(pl.lockTarget && pl.lockTarget.alive ? pl.lockTarget : null); }
        pl.locks = []; pl.lockT = 0;
      }
      pl.locks = pl.locks.filter(e => e.alive);
    }
    fire2Prev = fire2;
  }

  // ── IA de los enemigos ──
  const UP = new THREE.Vector3(0, 1, 0), _look = V(), _e1 = V(), _e2 = V(), _e3 = V(), _I = new THREE.Quaternion();
  function steer(e, desired, dt) {
    desired.normalize();
    const ang = e.dir.angleTo(desired);
    const prevDir = _b.copy(e.dir);
    if (ang > 1e-4) { _q.setFromUnitVectors(e.dir, desired); const k = Math.min(1, e.turn * dt / ang); _q.slerp(_I, 1 - k); e.dir.applyQuaternion(_q).normalize(); }
    const turnY = prevDir.x * e.dir.z - prevDir.z * e.dir.x;   // alabeo hacia dentro de la curva
    const rate = dt > 0 ? Math.asin(Math.max(-1, Math.min(1, turnY))) / dt : 0;
    const want = Math.max(-1.25, Math.min(1.25, rate * e.speed / 9.81 * 0.12));
    e.bank += (want - e.bank) * Math.min(1, dt * 3);
  }
  // Suelo, techo, zona y (salvo la que ataca en ese momento) torres
  function avoid(e, desired, minAgl = 220, skip = null, towersToo = true) {
    const agl = e.pos.y - api.groundAt(e.pos.x, e.pos.z);
    if (agl < minAgl) desired.y += (minAgl - agl) / 80;
    if (agl > 2500) desired.y -= 0.5;
    const r = Math.hypot(e.pos.x, e.pos.z); if (r > ZONE) desired.addScaledVector(_a.set(-e.pos.x, 0, -e.pos.z).normalize(), (r - ZONE) / 300);
    if (towersToo) for (const o of towers()) {
      if (o === skip) continue;
      const dx = e.pos.x - o.x, dz = e.pos.z - o.z, hd = Math.hypot(dx, dz) || 1, top = o.tw.root.position.y + tH(o) * 1.14 + 30, rr = Math.max(160, tR(o) * 3.66);
      if (hd < rr && e.pos.y < top) { desired.x += dx / hd * (rr - hd) / 80; desired.z += dz / hd * (rr - hd) / 80; desired.y += 0.3; }
    }
  }
  function move(e, dt) {
    e.vel.copy(e.dir).multiplyScalar(e.speed);
    e.pos.addScaledVector(e.vel, dt);
    if (e.pos.y < api.groundAt(e.pos.x, e.pos.z) + 3) { killEnemy(e, false); return false; }
    _look.copy(e.pos).sub(e.dir);
    e.model.position.copy(e.pos); e.model.up.copy(UP); e.model.lookAt(_look); e.model.rotateZ(-e.bank);
    const back = e.R * 0.8;
    if (e.hp < e.maxHp * 0.5 && (e.smokeAcc += dt) > 0.05) { e.smokeAcc = 0; const p = _b.copy(e.pos).addScaledVector(e.dir, -back); fx.smoke.spawn(p.x, p.y, p.z, 0, 1, 0, 2.5, 3, 9, [0.15, 0.14, 0.13, 0.6], [0.3, 0.3, 0.3, 0], 0.5, -0.3); }
    return true;
  }
  // Ráfaga contra el jugador (balas «e») o contra una torre (balas «t»)
  function shoot(e, from, at, speed, dmg, spread, own, tower = null) {
    const dir = _a.copy(at).sub(from).normalize();
    dir.x += (rnd() - 0.5) * spread * 2; dir.y += (rnd() - 0.5) * spread * 2; dir.z += (rnd() - 0.5) * spread * 2; dir.normalize();
    addBullet(from, _d.copy(e.vel).addScaledVector(dir, speed), dmg, own, 12, tower);
  }
  function burstAtPlayer(e, dt, from, maxDist, cone, n, rate, spread) {
    const f = S.flight; if (!f || !pl.alive || S.crashT > 0) return;
    e.fireCD -= dt;
    if (e.burst > 0) {
      e.burstCD -= dt;
      if (e.burstCD <= 0) { e.burstCD = 1 / rate; e.burst--; leadPoint(from, e.vel, { pos: f.pos, vel: f.vel }, 800, _e3); shoot(e, from, _e3, 800, e.dmg, spread * (WX_SPREAD[game.weather] || 1), "e"); }
      return;
    }
    const d = f.pos.distanceTo(from);
    if (e.fireCD <= 0 && d < maxDist && cone(f)) { e.burst = n; e.fireCD = 2.2 + rnd() * 1.6 - Math.min(game.lv, 10) * 0.08; }
  }
  const AI = {
    escort(e, dt) {
      const f = S.flight, alive = pl.alive && !(S.crashT > 0), desired = _c;
      if (e.state === "attack" && alive) {
        leadPoint(e.pos, e.vel, { pos: f.pos, vel: f.vel }, 800, desired); desired.sub(e.pos);
        const dist = f.pos.distanceTo(e.pos);
        if (dist < 230) { e.state = "break"; e.stT = 0; e.breakDir.set(rnd() - 0.5, 0.25 + rnd() * 0.3, rnd() - 0.5).normalize(); }
        const ang = e.dir.angleTo(_e1.copy(desired).normalize());
        burstAtPlayer(e, dt, _e2.copy(e.pos).addScaledVector(e.dir, 8), 950, () => ang < 0.1, 8, 12, e.spread);
        // misil contra el jugador (desde el nivel 4): de frente o por detrás, a media distancia
        if (game.lv >= MSL.lv && e.mslCD !== undefined && (e.mslCD -= dt) <= 0) {
          const ma = e.dir.angleTo(_e1.copy(f.pos).sub(e.pos).normalize());
          if (dist < 1800 && dist > 350 && ma < 0.45) e.mslCD = fireAtPlayer(_e2.copy(e.pos).addScaledVector(e.dir, 6).addScaledVector(UP, -1.5), e.vel) ? MSL.cd[game.diff] * (0.8 + 0.4 * rnd()) : 3;
        }
      } else if (e.state === "break") {
        desired.copy(e.breakDir);
        if (e.stT > 3) { e.state = "attack"; e.stT = 0; }
      } else desired.set(-e.pos.x, 0, -e.pos.z).normalize().addScaledVector(e.dir, 2);
      desired.normalize(); avoid(e, desired); steer(e, desired, dt); move(e, dt);
    },
    // Avión de ataque: llega por arriba, pasada en picado con cañón y cohetes contra la torre, sale y vuelve
    attacker(e, dt) {
      const o = e.tgt, desired = _c;
      if (!o) desired.set(-e.pos.x, 0, -e.pos.z).normalize().addScaledVector(e.dir, 3);
      else {
        const aim = towerAim(o, _e1, 95), d = aim.distanceTo(e.pos);
        if (e.state === "go") {
          desired.copy(aim).sub(e.pos); desired.y += 150 * Math.min(1, d / 2000);
          if (d < 2200 && e.dir.angleTo(_e2.copy(aim).sub(e.pos).normalize()) < 0.9) { e.state = "run"; e.stT = 0; e.rk = 2; e.rkT = 0; }
        } else if (e.state === "run") {
          desired.copy(aim).sub(e.pos);
          const ang = e.dir.angleTo(_e2.copy(desired).normalize());
          if (d < 1200 && ang < 0.2 && (e.gunT -= dt) <= 0) { e.gunT = 0.1; shoot(e, _e3.copy(e.pos).addScaledVector(e.dir, 8), aim, 800, 0.15, 0.007, "t", o); }
          if (d < 850 && e.rk > 0 && (e.rkT -= dt) <= 0) { e.rk--; e.rkT = 0.35; enemyShot("erocket", _e3.copy(e.pos).addScaledVector(e.dir, 6), _e2.copy(aim).sub(e.pos).normalize().multiplyScalar(e.speed + 260), o, 1.6); }
          if (d < 400 || e.stT > 14) { e.state = "out"; e.stT = 0; e.breakDir.copy(e.dir).setY(0).normalize().applyAxisAngle(UP, (rnd() < 0.5 ? 1 : -1) * 0.7).setY(0.45).normalize(); }
        } else {
          desired.copy(e.breakDir);
          if (e.stT > 5) { e.state = "go"; e.stT = 0; }
        }
      }
      desired.normalize(); avoid(e, desired, e.state === "run" ? 50 : 150, e.state === "run" ? o : null); steer(e, desired, dt); move(e, dt);
    },
    // Blanco de prácticas: da vueltas despacio alrededor de su punto, sin disparar
    dummy(e, dt) {
      const to = _e1.copy(e.home).sub(e.pos); to.y = 0;
      const desired = _c.set(-to.z, 0, to.x).normalize().addScaledVector(to.normalize(), Math.max(0, e.pos.distanceTo(e.home) - 500) / 300);
      desired.y = (e.home.y - e.pos.y) / 200; desired.normalize();
      steer(e, desired, dt); move(e, dt);
    },
    // Dron kamikaze, misil de crucero y misil del helicóptero: directos contra la torre
    drone(e, dt) { kamikaze(e, dt, 6, 0); },
    cruise(e, dt) { kamikaze(e, dt, 12, 70); },
    hmissile(e, dt) { kamikaze(e, dt, 2, 0); if (Math.random() < 0.5) fx.smoke.spawn(e.pos.x, e.pos.y, e.pos.z, 0, 0.4, 0, 1.2, 1, 3.5, [0.8, 0.8, 0.8, 0.4], [0.9, 0.9, 0.9, 0], 0.6, -0.2); },
    // Helicóptero: se aparta a 1,3 km de su torre, se queda quieto y le lanza misiles
    heli(e, dt) {
      const o = e.tgt;
      const rotor = e.model.getObjectByName("rotor"); if (rotor) rotor.rotation.y += dt * 28;
      const tr = e.model.getObjectByName("trotor"); if (tr) tr.rotation.x += dt * 40;
      let want = 70;
      const desired = _c;
      if (!o) { desired.set(-e.pos.x, 0, -e.pos.z); }
      else {
        if (!e.hold || e.holdFor !== o) { const away = _e1.set(e.pos.x - o.x, 0, e.pos.z - o.z).normalize(); e.hold = new THREE.Vector3(o.x + away.x * 1300, 0, o.z + away.z * 1300); e.holdFor = o; }
        e.hold.y = o.tw.root.position.y + 300;
        const hd = Math.hypot(e.hold.x - e.pos.x, e.hold.z - e.pos.z);
        if (hd > 90) desired.set(e.hold.x - e.pos.x, 0, e.hold.z - e.pos.z);
        else {
          want = 0;
          const aim = towerAim(o, _e1, 100);
          desired.set(aim.x - e.pos.x, 0, aim.z - e.pos.z);
          if ((e.fireCD -= dt) <= 0) {
            e.fireCD = Math.max(3.5, 6 - game.lv * 0.12);
            spawn("hmissile", _e2.copy(e.pos).addScaledVector(e.dir, 5).setY(e.pos.y - 1.5), { tgt: o, dir: _e3.copy(aim).sub(e.pos) });
          }
        }
        e.pos.y += ((e.hold.y) - e.pos.y) * Math.min(1, dt * 0.5);
      }
      desired.y = 0; if (desired.lengthSq() < 1e-6) desired.copy(e.dir); desired.normalize();
      e.dir.y = 0; e.dir.normalize();
      const ang = e.dir.angleTo(desired); if (ang > 1e-4) { _q.setFromUnitVectors(e.dir, desired); _q.slerp(_I, 1 - Math.min(1, e.turn * dt / ang)); e.dir.applyQuaternion(_q).normalize(); }
      e.cur += (want - e.cur) * Math.min(1, dt * 0.8);
      e.vel.copy(e.dir).multiplyScalar(e.cur);
      e.pos.addScaledVector(e.vel, dt);
      const gY = api.groundAt(e.pos.x, e.pos.z); if (e.pos.y < gY + 60) e.pos.y = gY + 60;
      _look.copy(e.pos).sub(e.dir);
      e.model.position.copy(e.pos); e.model.up.copy(UP); e.model.lookAt(_look); e.model.rotateX(-0.15 * e.cur / 70);
      if (e.hp < e.maxHp * 0.5 && (e.smokeAcc += dt) > 0.05) { e.smokeAcc = 0; fx.smoke.spawn(e.pos.x, e.pos.y + 1, e.pos.z, 0, 1, 0, 2.5, 3, 9, [0.15, 0.14, 0.13, 0.6], [0.3, 0.3, 0.3, 0], 0.5, -0.3); }
    },
    // Bombardero: pasa por encima de su torre soltando bombas; ametralladora de cola contra el jugador
    bomber(e, dt) { bomberRun(e, dt, 650, 6, 2.5, 800, false); },
    // Jefe: bombardero estratégico; cada pasada sobre una torre le quita un 40 %; motores destruibles, torretas y drones
    boss(e, dt) {
      e.model.updateMatrixWorld(true);
      for (const m of e.engines) {
        m.w.copy(m.off).applyMatrix4(e.model.matrixWorld);
        if (!m.alive && (m.smoke += dt) > 0.04) { m.smoke = 0; fx.smoke.spawn(m.w.x, m.w.y, m.w.z, 0, 1, 0, 3, 4, 14, [0.1, 0.09, 0.09, 0.7], [0.25, 0.25, 0.25, 0], 0.5, -0.3); fx.fire.spawn(m.w.x, m.w.y, m.w.z, 0, 0, 0, 0.3, 4, 1.5, [1, 0.7, 0.3, 1], [1, 0.3, 0.05, 0], 0, 0); }
      }
      // Fases: 1 con 3–4 motores · 2 (furioso) con 2: más drones y misiles contra la torre · 3 con 1: se lanza contra la torre
      const nEng = e.engines.filter(m => m.alive).length, ph = nEng >= 3 ? 1 : nEng === 2 ? 2 : 3;
      if (ph > e.phase) {
        e.phase = ph; snd("boss"); shake(2.5); rum(0.4, 0.3, 600);
        if (ph === 2) { banner(t("bossP2"), 3, "boss"); e.droneT = 0; e.speed = Math.max(e.speed, e.baseSpeed); }
        else { banner(t("bossP3"), 4.5, "warn", t("bossP3sub")); e.speed = e.baseSpeed * 1.6; e.turn = 0.5; e.aimY = 70; e.bombs = 0; e.p3 = "out";
          if (!e.tgt || e.tgt.hp <= 0) e.tgt = pickTower(e.pos); }
      }
      if (e.phase === 3) {
        // primero se aleja hasta 2 km de la torre (tiempo para reaccionar) y luego se lanza contra ella
        const o = e.tgt;
        if (e.p3 === "out" && o) {
          const out = _c.set(e.pos.x - o.x, 0, e.pos.z - o.z); const hd = out.length(); out.normalize(); out.y = (o.tw.root.position.y + 700 - e.pos.y) / 400;
          if (hd > 2000) e.p3 = "dive";
          out.normalize(); avoid(e, out, 300, null, false); steer(e, out, dt); move(e, dt); return;
        }
        kamikaze(e, dt, 35, 0);   // choque del jefe: ~25 % de la torre en Normal
        if (!e.alive) banner(t("bossRam"), 3, "warn");
        return;
      }
      // furioso: también misiles contra ti si andas cerca
      if (e.phase >= 2 && (e.pmT = (e.pmT ?? 8) - dt) <= 0) { e.pmT = 16; if (S.flight && S.flight.pos.distanceTo(e.pos) < 2500) fireAtPlayer(_e2.copy(e.pos).addScaledVector(UP, -6), e.vel); }
      if (e.phase === 2 && (e.msT = (e.msT ?? 3) - dt) <= 0) {
        e.msT = 10; const o = pickTower(e.pos);
        if (o) for (let k = 0; k < 2; k++) spawn("hmissile", _e2.copy(e.pos).add(_e3.set((k ? 1 : -1) * 14, -8, 0)), { tgt: o, dir: _e3.set(o.x - e.pos.x, -200, o.z - e.pos.z) });
      }
      if ((e.droneT -= dt) <= 0) {
        e.droneT = e.phase >= 2 ? 20 : 30;
        for (let k = 0; k < 3; k++) spawn("drone", _e2.copy(e.pos).add(_e3.set((k - 1) * 25, -12, 0)), { dir: e.dir, tgt: pickTower(e.pos) });
      }
      bomberRun(e, dt, 850, 10, 4, 1100, true);
    },
  };
  function kamikaze(e, dt, dmg, cruiseAgl) {
    const o = e.tgt, desired = _c;
    if (!o) { killEnemy(e, false); return; }
    if (e.aimY === undefined) e.aimY = 60 + rnd() * 55;   // a qué altura de la torre va
    const aim = towerAim(o, _e1, e.aimY), d = aim.distanceTo(e.pos);
    desired.copy(aim).sub(e.pos);
    if (cruiseAgl && d > 700) { const agl = e.pos.y - api.groundAt(e.pos.x, e.pos.z); desired.y = 0; desired.normalize(); desired.y = (cruiseAgl - agl) / 120; }
    else if (!cruiseAgl && d > 900) { desired.normalize(); desired.y *= 0.3; }
    desired.normalize();
    if (cruiseAgl || d > 900) avoid(e, desired, cruiseAgl ? 40 : 120, o, false);
    steer(e, desired, dt);
    if (!move(e, dt)) return;
    if (o.tw.hit(e.pos) || e.pos.distanceTo(aim) < 14 * TS) { damageTower(o, dmg, e.pos.clone()); killEnemy(e, false); }
  }
  function bomberRun(e, dt, alt, nBombs, bombDmg, gunRange, boss) {
    let o = e.tgt;
    if (!o || o.hp <= 0) o = e.tgt = boss ? pickTower(e.pos, e.done) : pickTower(e.pos);
    const desired = _c, base = o ? o.tw.root.position.y : api.groundAt(e.pos.x, e.pos.z);
    if (!o) desired.copy(e.dir);
    else if (e.state === "go") {
      desired.set(o.x - e.pos.x, 0, o.z - e.pos.z);
      const hd = desired.length(); desired.normalize(); desired.y = (base + alt - e.pos.y) / 300;
      // Suelta cuando, con lo que avanza la bomba al caer, va a dar en la torre
      const fallT = Math.sqrt(2 * Math.max(10, e.pos.y - base) / 9.8), lead = e.speed * 0.3 * fallT;
      if (hd < lead + 40 && !e.dropped && e.dir.angleTo(_e1.set(o.x - e.pos.x, 0, o.z - e.pos.z).normalize()) < 0.5) {
        e.dropped = true; e.bombs = nBombs; e.bombT = 0; e.state = "out"; e.stT = 0; if (boss) e.done.add(o);
      }
    } else {
      desired.copy(e.dir).setY(0).normalize().setY((base + alt - e.pos.y) / 300);
      if (e.stT > 14) { e.state = "go"; e.dropped = false; if (boss) { if (e.done.size >= aliveTowers().length) e.done.clear(); e.tgt = pickTower(e.pos, e.done); } }
    }
    if (e.bombs > 0 && (e.bombT -= dt) <= 0) { e.bombT = 0.2; e.bombs--; enemyShot("bomb", _e2.copy(e.pos).addScaledVector(UP, -3), _e3.copy(e.vel).multiplyScalar(0.3), e.tgt, bombDmg); }
    // Ametralladora de cola (y torreta de arriba en el jefe) contra el jugador si lo tiene cerca y por detrás o al lado
    burstAtPlayer(e, dt, _e2.copy(e.pos).addScaledVector(e.dir, boss ? -40 : -14), gunRange, f => _a.copy(f.pos).sub(e.pos).normalize().angleTo(_e1.copy(e.dir).negate()) < (boss ? 2.2 : 1.3), boss ? 8 : 5, 9, boss ? 0.035 : 0.05);
    desired.y = Math.max(-0.25, Math.min(0.25, desired.y));
    desired.normalize(); avoid(e, desired, 300, null, false); steer(e, desired, dt); move(e, dt);
  }
  function updateEnemy(e, dt) {
    e.stT += dt;
    if (KIND[e.kind].tower && e.tgt && e.tgt.hp <= 0 && e.kind !== "boss" && e.kind !== "bomber") e.tgt = pickTower(e.pos);
    AI[e.kind](e, dt);
  }

  // Proyectiles enemigos contra las torres: cohetes y bombas
  const eshots = [];
  const bombGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.8, 8); bombGeo.rotateX(Math.PI / 2);
  const bombMat = new THREE.MeshStandardMaterial({ color: 0x2c3035, roughness: 0.6 });
  function enemyShot(kind, p, v, tower, dmg) {
    const mesh = new THREE.Mesh(kind === "bomb" ? bombGeo : rGeo, kind === "bomb" ? bombMat : rMat); mesh.position.copy(p); scene.add(mesh);
    eshots.push({ kind, mesh, p: p.clone(), v: v.clone(), tower, dmg, life: 12, trailAcc: 0 });
  }
  function updateEnemyShots(dt) {
    for (let i = eshots.length - 1; i >= 0; i--) {
      const s = eshots[i]; s.life -= dt; _prev.copy(s.p);
      s.v.y -= 9.8 * dt * (s.kind === "bomb" ? 1 : 0.2);
      s.p.addScaledVector(s.v, dt);
      s.mesh.position.copy(s.p); s.mesh.lookAt(_b.copy(s.p).add(s.v));
      if (s.kind === "erocket" && (s.trailAcc += dt) > 0.03) { s.trailAcc = 0; fx.smoke.spawn(_prev.x, _prev.y, _prev.z, 0, 0.5, 0, 1.4, 1, 4, [0.7, 0.7, 0.7, 0.4], [0.85, 0.85, 0.85, 0], 0.6, -0.2); }
      const g = api.groundAt(s.p.x, s.p.z);
      let done = s.life <= 0, hitTower = false;
      if (s.tower && s.tower.hp > 0 && s.tower.tw.hit(s.p)) { done = true; hitTower = true; }
      if (!done && s.p.y < g) {
        done = true;
        if (s.kind === "bomb" && s.tower && Math.hypot(s.p.x - s.tower.x, s.p.z - s.tower.z) < Math.max(60, tR(s.tower) * 1.45)) hitTower = true;
      }
      if (done) {
        if (hitTower) damageTower(s.tower, s.dmg, s.p.clone()); else if (s.p.y < g + 2) puff(s.p, 8, 6, 0.3);
        boom(s.p, s.kind === "bomb" ? 0.9 : 0.5);
        { const d = distToMe(s.p); snd("explosion", d, s.kind === "bomb" ? 1 : 0.6); if (d < 400) shake(1.6 * (1 - d / 400)); }
        scene.remove(s.mesh); eshots.splice(i, 1);
      }
    }
  }

  // ── Proyectiles ──
  const _seg = V(), _rel = V();
  function segSphere(a, b, c, r) {   // ¿el segmento a→b pasa a menos de r de c?
    _seg.subVectors(b, a); const L2 = _seg.lengthSq();
    const tt = L2 > 0 ? Math.max(0, Math.min(1, _rel.subVectors(c, a).dot(_seg) / L2)) : 0;
    return _rel.copy(a).addScaledVector(_seg, tt).distanceToSquared(c) < r * r;
  }
  const _prev = V(), _m4 = new THREE.Matrix4(), _s3 = V(), _z = new THREE.Vector3(0, 0, 1);
  function updateBullets(dt) {
    const f = S.flight;
    let n = 0;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; b.life -= dt;
      _prev.copy(b.p); b.v.y -= 9.8 * dt * 0.3; b.p.addScaledVector(b.v, dt);
      let dead = b.life <= 0;
      if (!dead && (b.own === "p" || b.own === "a" || b.own === "w")) {
        for (const e of enemies) if (e.alive && segSphere(_prev, b.p, e.pos, e.R)) { damageEnemy(e, b.dmg, b.p, b.own === "p", b.own); dead = true; break; }
      } else if (!dead && b.own === "e" && f && pl.alive && !(S.crashT > 0)) {
        if (segSphere(_prev, b.p, f.pos, PLAYER_R)) { damagePlayer(b.dmg); sparkBurst(b.p, 4, 10); dead = true; }
      } else if (!dead && b.own === "t" && b.tower && b.tower.hp > 0 && b.tower.tw.hit(b.p)) { damageTower(b.tower, b.dmg, b.p); dead = true; }
      if (!dead && b.p.y < api.groundAt(b.p.x, b.p.z)) { dead = true; puff(b.p, 2, 2, 0.45); }
      if (dead) { bullets.splice(i, 1); continue; }
    }
    for (const b of bullets) {
      if (n >= MAXB) break;
      _q.setFromUnitVectors(_z, _a.copy(b.v).normalize());
      _m4.compose(b.p, _q, _s3.set(1, 1, b.len)); bMesh.setMatrixAt(n, _m4); bMesh.setColorAt(n, b.own === "p" || b.own === "w" ? C_PB : b.own === "a" ? C_AB : C_EB); n++;
    }
    bMesh.count = n; bMesh.instanceMatrix.needsUpdate = true; if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true;
  }
  function explodeAt(p, sec) {
    boom(p, sec.kind === "missiles" ? 0.8 : 0.6);
    for (const e of enemies) if (e.alive) {
      const d = e.pos.distanceTo(p), r = (sec.splash || 14) + e.R * 0.5;
      if (d < r) damageEnemy(e, sec.dmg * (1 - d / r * 0.6), p);
    }
  }
  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.life -= dt; _prev.copy(s.p);
      if (s.kind === "missile") {
        const Mi = s.sec, sp = Math.min(Mi.vmax, s.v.length() + Mi.accel * dt);
        let dir = _a.copy(s.v).normalize();
        if (s.target && s.target.alive) {
          const want = leadPoint(s.p, V(), s.target, sp, _c).sub(s.p).normalize();
          const ang = dir.angleTo(want);
          if (ang > 1e-4) { _q.setFromUnitVectors(dir, want); _q.slerp(new THREE.Quaternion(), 1 - Math.min(1, Mi.turn * dt / ang)); dir.applyQuaternion(_q); }
        }
        s.v.copy(dir).multiplyScalar(sp);
      } else s.v.y -= 9.8 * dt * 0.5;
      s.p.addScaledVector(s.v, dt);
      s.mesh.position.copy(s.p); s.mesh.lookAt(_b.copy(s.p).add(s.v));
      // estela
      if ((s.trailAcc += dt) > 0.02) { s.trailAcc = 0; fx.smoke.spawn(_prev.x, _prev.y, _prev.z, 0, 0.5, 0, 1.6, 1.2, 4.5, [0.8, 0.8, 0.8, 0.45], [0.9, 0.9, 0.9, 0], 0.6, -0.2); fx.fire.spawn(_prev.x, _prev.y, _prev.z, 0, 0, 0, 0.06, 1.8, 0.6, [1, 0.8, 0.4, 1], [1, 0.4, 0.1, 0], 0, 0); }
      let hit = s.life <= 0 || s.p.y < api.groundAt(s.p.x, s.p.z);
      if (!hit) for (const e of enemies) if (e.alive && segSphere(_prev, s.p, e.pos, s.kind === "missile" ? e.R + 8 : e.R + 2)) { hit = true; break; }
      if (hit) { explodeAt(s.p, s.sec); scene.remove(s.mesh); shots.splice(i, 1); }
    }
  }

  function banner(txt, sec = 2.5, kind = "info", sub = "") { game.banner = txt; game.bannerT = sec; game.bannerMax = sec; game.bannerKind = kind; game.bannerSub = sub; }
  // Sensación: cámara lenta / parón (S.timeScale del motor, en tiempo real) y sacudida de cámara (rig.shake)
  let slowUntil = 0;
  function slowMo(scale, ms) { S.timeScale = Math.min(S.timeScale ?? 1, scale); slowUntil = Math.max(slowUntil, performance.now() + ms); }
  function shake(m) { api.rig.shake = Math.max(api.rig.shake || 0, m); }
  // ── Torres: vida, daño, reparación ──
  function setTowerHp(o, hp, animate) {
    o.hp = Math.max(0, Math.min(100, hp));
    const L = Math.ceil(o.hp / 10);
    if (L !== o.tw.level) o.tw.setLevel(L, animate && L < o.tw.level);
  }
  function damageTower(o, pct, at) {
    if (!o || o.hp <= 0 || !game.on || game.over) return;
    setTowerHp(o, o.hp - pct * game.D.towerDmgK * TOWER_DMG_K, true);
    if (pl.streak > 1 && !game.training) game.feed.push({ txt: t("streakLost"), t: 1.8, col: "#ff6a50" });
    pl.streak = 0;
    game.waveMinHp = Math.min(game.waveMinHp ?? 100, o.hp);
    o.attackedT = 3;
    if (at && pct >= 1) boom(at, 0.5); else if (at) sparkBurst(at, 4, 10);
    if ((o.warnT || 0) <= 0 && o.hp > 0) { o.warnT = 8; api.flash(t("towerHit", { n: o.n }), 2500); snd("towerAlarm"); }
    if (o.hp <= 0) {
      banner(t("towerDown", { n: o.n }), 3, "warn"); snd("collapse"); rum(0.8, 0.8, 700); slowMo(0.3, 1800); shake(4);
      game.towerLost.push({ n: o.n, wave: game.wave, t: game.time });
      if (pl.kit && ring.for === o) ring.for = null;
      if (!aliveTowers().length) gameOver();
    }
  }
  function gameOver() {
    game.over = true; game.overT = 0; game.queue = []; game.hpLog.push([Math.round(game.time), 0]);
    banner(t("gameOver"), 5, "warn");
  }

  // ── Kits de reparación: caen en paracaídas; se recogen volando por encima y se entregan en el anillo verde ──
  const kits = [];
  const ring = { mesh: null, for: null, pos: V() };
  const kitMatBox = new THREE.MeshStandardMaterial({ color: 0x4f6b3a, roughness: 0.7 }), kitMatWhite = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 });
  const kitMatChute = new THREE.MeshStandardMaterial({ color: 0xf08a24, roughness: 0.8, side: THREE.DoubleSide });
  const kitGlow = new THREE.MeshBasicMaterial({ color: 0x6dff8a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  function kitMesh() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.4), kitMatBox); g.add(box);
    for (const r of [0, Math.PI / 2]) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.05), kitMatWhite); c.position.z = 1.23; c.rotation.z = r; const c2 = c.clone(); c2.position.z = -1.23; g.add(c, c2); }
    const chute = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), kitMatChute); chute.position.y = 9; chute.name = "chute"; g.add(chute);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8.5, 4), kitMatWhite); l.position.set(Math.cos(a) * 2, 4.8, Math.sin(a) * 2); l.rotation.set(Math.sin(a) * 0.38, 0, -Math.cos(a) * 0.38); g.add(l); }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), kitGlow); glow.name = "glow"; g.add(glow);
    return g;
  }
  function maybeKit(e) {
    if (!["attacker", "bomber", "heli", "boss"].includes(e.kind) || kits.length >= 2 || game.over) return;
    const p = game.D.kitP * (1 + 0.3 * pk("kits")) * Math.max(0.4, 1 - game.wave * 0.04) * (e.kind === "boss" ? 3 : e.kind === "bomber" ? 1.5 : 1);
    if (rnd() > p) return;
    const mesh = kitMesh(); mesh.position.copy(e.pos); scene.add(mesh);
    kits.push({ p: e.pos.clone(), state: "fall", t: 0, mesh });
    game.feed.push({ txt: t("kit"), t: 2 });
  }
  function ringTarget() {   // la torre viva más dañada
    const list = aliveTowers().filter(o => o.hp < 100).sort((a, b) => a.hp - b.hp);
    return list[0] || aliveTowers()[0] || null;
  }
  function updateKits(dt) {
    const f = S.flight, flying = f && pl.alive && !(S.crashT > 0);
    for (let i = kits.length - 1; i >= 0; i--) {
      const k = kits[i]; k.t += dt;
      const roof = api.roofAt ? api.roofAt(k.p.x, k.p.z) : null;   // si cae sobre un edificio, se queda en la azotea
      const g = Math.max(api.groundAt(k.p.x, k.p.z), roof ?? -Infinity);
      if (k.state === "fall") { k.p.y -= 7 * dt; k.p.x += Math.sin(k.t * 0.8) * 2 * dt; if (k.p.y <= g + 0.9) { k.p.y = g + 0.9; k.state = "ground"; k.t = 0; const ch = k.mesh.getObjectByName("chute"); if (ch) ch.visible = false; } }
      else if (k.t > 45) { scene.remove(k.mesh); kits.splice(i, 1); continue; }
      k.mesh.position.copy(k.p); k.mesh.rotation.y += dt * 0.6;
      const gl = k.mesh.getObjectByName("glow"); if (gl) gl.material.opacity = 0.35 + 0.3 * Math.sin(k.t * 6);
      if (flying && !pl.kit && f.pos.distanceTo(k.p) < reach(35)) {
        pl.kit = true; scene.remove(k.mesh); kits.splice(i, 1);
        banner(t("kitGot"), 2.5, "good"); ring.for = null; snd("kit");
      }
    }
    // Anillo verde junto a la torre más dañada, mientras se lleva un kit
    if (pl.kit && !game.over) {
      if (!ring.for || ring.for.hp <= 0) {
        ring.for = ringTarget();
        if (ring.for) {
          const o = ring.for, out = _e1.set(o.x, 0, o.z); if (out.lengthSq() < 1) out.set(1, 0, 0); out.normalize();
          const rd = Math.max(300, tR(o) * 3); ring.pos.set(o.x + out.x * rd, o.tw.root.position.y + Math.max(85 / 132 * tH(o), 160), o.z + out.z * rd);
          if (!ring.mesh) { ring.mesh = new THREE.Mesh(new THREE.TorusGeometry(26, 1.6, 10, 48), new THREE.MeshBasicMaterial({ color: 0x5dff7a, transparent: true, opacity: 0.85 })); scene.add(ring.mesh); }
          ring.mesh.position.copy(ring.pos); ring.mesh.lookAt(o.x, ring.pos.y, o.z);
        }
      }
      if (ring.mesh) { ring.mesh.visible = !!ring.for; ring.mesh.material.opacity = 0.55 + 0.35 * Math.sin(game.time * 5); }
      if (ring.for && flying && f.pos.distanceTo(ring.pos) < reach(28)) {
        const o = ring.for; setTowerHp(o, o.hp + KIT_REPAIR + 5 * pk("kits"), false);
        pl.kit = false; game.kitsDelivered++; game.score += 150;
        banner(t("repaired", { n: o.n, p: Math.round(o.hp) }), 2.5, "good"); sparkBurst(ring.pos, 40, 20); snd("repair");
        ring.for = null;
      }
    } else if (ring.mesh) ring.mesh.visible = false;
    if (!pl.kit) ring.for = null;
  }

  // ── Potenciadores ──
  const powers = [];
  const pwGeo = new THREE.OctahedronGeometry(3.2, 0), pwGlowGeo = new THREE.SphereGeometry(7, 12, 8), pwMat = {};
  function powerMesh(k) {
    const m = pwMat[k] ||= { core: new THREE.MeshBasicMaterial({ color: POWER[k].css }),
      glow: new THREE.MeshBasicMaterial({ color: POWER[k].css, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }) };
    const g = new THREE.Group(), glow = new THREE.Mesh(pwGlowGeo, m.glow); glow.name = "glow";
    g.add(new THREE.Mesh(pwGeo, m.core), glow); g.scale.setScalar(1.6); return g;
  }
  function dropPower(k, at) {
    const p = at.clone(); p.y = Math.max(p.y, api.groundAt(p.x, p.z) + 120);
    const mesh = powerMesh(k); mesh.position.copy(p); scene.add(mesh);
    powers.push({ k, p, mesh, t: 0 }); game.feed.push({ txt: t("pw_" + k), t: 2, col: POWER[k].css });
  }
  function maybePower(e) {
    if (game.over || game.training || powers.length >= 2 || rnd() > (POWER_P[e.kind] || 0) * (pk("power") ? 1.4 : 1)) return;
    const ks = Object.keys(POWER); let k = ks[(rnd() * ks.length) | 0];
    if (k === "repair" && pl.hull >= maxHull() * 0.8) k = "double";
    dropPower(k, e.pos);
  }
  function updatePowers(dt) {
    for (const k in pl.pw) if (pl.pw[k] > 0) pl.pw[k] = Math.max(0, pl.pw[k] - dt);
    const f = S.flight, flying = f && pl.alive && !(S.crashT > 0);
    for (let i = powers.length - 1; i >= 0; i--) {
      const w = powers[i]; w.t += dt;
      if (w.t > 25 || game.over) { scene.remove(w.mesh); powers.splice(i, 1); continue; }
      w.mesh.position.set(w.p.x, w.p.y + Math.sin(w.t * 2) * 3, w.p.z); w.mesh.rotation.y += dt * 2; w.mesh.rotation.x += dt * 0.7;
      w.mesh.visible = w.t < 20 || (w.t * 6 | 0) % 2 === 0;   // parpadea los 5 últimos segundos
      const gl = w.mesh.getObjectByName("glow"); if (gl) gl.material.opacity = 0.25 + 0.15 * Math.sin(w.t * 7);
      if (flying && f.pos.distanceTo(w.p) < reach(45)) {
        scene.remove(w.mesh); powers.splice(i, 1);
        if (w.k === "repair") { pl.hull = maxHull(); pl.shield = maxShield(); } else pl.pw[w.k] = POWER[w.k].dur * (pk("power") ? 1.5 : 1);
        if (w.k === "ammo") { pl.ammo = ammoMax(); pl.reloadT = 0; }
        if (w.k === "rapid") { pl.heat = 0; pl.over = false; }
        banner(t("pw_" + w.k), 2, "good"); snd("powerup"); rum(0.2, 0.3, 150);
      }
    }
  }

  // ── Torretas antiaéreas en la explanada de la torre (y, de noche, reflectores) ──
  const turrets = [];
  const lights = createSearchlights(api);
  const tMat = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.6, metalness: 0.4 }), tDark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.7 });
  const tLampOn = new THREE.MeshBasicMaterial({ color: 0x6dff8a }), tLampOff = new THREE.MeshBasicMaterial({ color: 0xff4030 });
  function turretMesh() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 2, 12), tDark); base.position.y = 1; g.add(base);
    const yaw = new THREE.Group(); yaw.position.y = 2.6; g.add(yaw);
    yaw.add(new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 2.6), tMat));
    const pitch = new THREE.Group(); pitch.position.y = 0.3; yaw.add(pitch);
    for (const x of [-0.7, 0.7]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5, 6), tDark); b.rotation.x = Math.PI / 2; b.position.set(x, 0, -3); pitch.add(b); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), tLampOn); lamp.position.set(0, 1.1, 1); yaw.add(lamp);
    g.scale.setScalar(TS); return { g, yaw, pitch, lamp };
  }
  function buildTurrets() {
    removeTurrets();
    for (const o of towers()) {
      if (o.kind === "monument") {   // alrededor del monumento, en el suelo (o en la azotea que haya allí)
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + Math.PI / 4, r = tR(o) + 45, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
          const m = turretMesh(); scene.add(m.g);
          const u = { o, m, pos: new THREE.Vector3(x, 0, z), muz: new THREE.Vector3(x, 0, z), cd: rnd() * 0.3, burstT: rnd() * 1.2, scanT: 0, tgt: null, on: true, free: true, settleT: 0 };
          settleTurret(u); turrets.push(u);
        }
        continue;
      }
      // en la explanada, delante de cada cara y a un lado (lejos de los contrafuertes y de la entrada); medidas sin escalar
      const ry = o.tw.root.rotation.y || 0, cr = Math.cos(ry), sr = Math.sin(ry);
      for (let k = 0; k < 4; k++) {
        const th = k * Math.PI / 2 + Math.PI / 6, lx = 26 * Math.sin(th), lz = 26 * Math.cos(th);
        const x = o.x + (lx * cr + lz * sr) * TS, z = o.z + (-lx * sr + lz * cr) * TS, y = o.tw.root.position.y + 0.6 * TS;
        const m = turretMesh(); m.g.position.set(x, y, z); m.yaw.rotation.y = Math.atan2(x - o.x, z - o.z) + Math.PI; scene.add(m.g);
        turrets.push({ o, m, pos: new THREE.Vector3(x, y, z), muz: new THREE.Vector3(x, y + 2.9 * TS, z), cd: rnd() * 0.3, burstT: rnd() * 1.2, scanT: 0, tgt: null, on: true });
      }
      // reflectores: en las esquinas de la explanada, entre las torretas
      const at = [];
      for (let k = 0; k < 4; k++) { const th = k * Math.PI / 2 + Math.PI * 0.42, lx = 27 * Math.sin(th), lz = 27 * Math.cos(th);
        at.push({ x: o.x + (lx * cr + lz * sr) * TS, y: o.tw.root.position.y + 0.6 * TS, z: o.z + (-lx * sr + lz * cr) * TS }); }
      lights.build(o, at, TS);
    }
    for (const o of towers()) if (o.kind === "monument") {   // monumento: reflectores entre las torretas
      const at = []; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, r = tR(o) + 40, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r, rf = api.roofAt ? api.roofAt(x, z) : null; at.push({ x, y: rf ?? api.groundAt(x, z), z }); }
      lights.build(o, at, TS);
    }
  }
  function settleTurret(u) {   // torretas sueltas (monumento): en el suelo o la azotea; el suelo se afina al llegar teselas
    const roof = api.roofAt ? api.roofAt(u.pos.x, u.pos.z) : null, y = roof !== null && roof !== undefined ? roof : api.groundAt(u.pos.x, u.pos.z);
    u.pos.y = y; u.muz.set(u.pos.x, y + 2.9 * TS, u.pos.z);
    u.m.g.position.copy(u.pos); u.m.yaw.rotation.y = Math.atan2(u.pos.x - u.o.x, u.pos.z - u.o.z) + Math.PI;
  }
  function removeTurrets() { for (const u of turrets) scene.remove(u.m.g); turrets.length = 0; lights.clear(); }
  const _tA = V(), _tB = V(), _tZ = V();
  function updateTurrets(dt) {
    for (const u of turrets) {
      if (u.free && game.time < 40 && (u.settleT -= dt) <= 0) { u.settleT = 2; settleTurret(u); }
      const on = u.o.hp >= AA_MIN && !game.over && !game.training;
      if (u.on !== on) { u.on = on; u.m.lamp.material = on ? tLampOn : tLampOff; }
      if (!on) { u.m.pitch.rotation.x += (-0.2 - u.m.pitch.rotation.x) * Math.min(1, dt * 2); continue; }
      if ((u.scanT -= dt) <= 0) {   // blanco: el más cercano; los que van a por la torre, primero
        u.scanT = 0.5; u.tgt = null; let bd = AA_RANGE * (1 + 0.15 * pk("aa"));
        for (const e of enemies) if (e.alive && e.kind !== "dummy" && e.pos.y > u.pos.y + 15) { const d = e.pos.distanceTo(u.pos) * (KIND[e.kind].tower ? 1 : 1.6); if (d < bd) { bd = d; u.tgt = e; } }
      }
      const e = u.tgt; if (!e || !e.alive) { u.tgt = null; continue; }
      const lp = leadPoint(u.muz, _tZ, e, AA_SPEED, _tA), dir = _tB.copy(lp).sub(u.muz).normalize();
      u.m.yaw.rotation.y = Math.atan2(-dir.x, -dir.z); u.m.pitch.rotation.x = Math.asin(Math.max(-1, Math.min(1, dir.y)));
      if ((u.burstT -= dt) <= -0.9) u.burstT = 1.2;   // ráfagas de 1,2 s con 0,9 s de pausa
      if (u.burstT > 0 && (u.cd -= dt) <= 0 && lp.distanceTo(u.muz) < AA_RANGE * (1 + 0.15 * pk("aa"))) {
        u.cd = 1 / AA_RATE;
        dir.x += (rnd() - 0.5) * AA_SPREAD * 2; dir.y += (rnd() - 0.5) * AA_SPREAD * 2; dir.z += (rnd() - 0.5) * AA_SPREAD * 2; dir.normalize();
        const p0 = _tA.copy(u.muz).addScaledVector(dir, 4 * TS);
        addBullet(p0, _tB.copy(dir).multiplyScalar(AA_SPEED), AA_DMG * game.D.aaK * (1 + 0.35 * pk("aa")), "a", 10);
        if (rnd() < 0.5) fx.fire.spawn(p0.x, p0.y, p0.z, 0, 0, 0, 0.05, 3, 1, [1, 0.9, 0.6, 1], [1, 0.5, 0.1, 0], 0, 0);
        snd("aa", distToMe(u.muz));
      }
    }
  }

  // ── Compañero IA: vuela tu misma nave; va a por lo que amenaza la torre (el jefe, primero) y, si no hay nada,
  //    se pone en formación a tu derecha. No lo pueden derribar; sus derribos no dan puntos (como las torretas) ──
  let wing = null;
  const WING = { rate: 7, dmg: 3.2, speed: 950, spread: 0.012, range: 750 };
  const _wD = V(), _wT = V(), _wZ = V();
  function makeWing(planeId) {
    removeWing();
    const P = api.AIRCRAFT.find(a => a.id === planeId); if (!P || !S.flight) return;
    const model = api.buildModel(P);
    model.traverse(c => { if (c.name === "cockpit" || c.name === "gear") c.visible = false; });
    scene.add(model);
    const f = S.flight, ax = f.axes();
    wing = { model, P, pos: f.pos.clone().addScaledVector(ax.right, 60).addScaledVector(ax.fwd, -40), dir: ax.fwd.clone(), vel: V(), bank: 0,
      turn: 1.15, speed: playerCruise, tgt: null, scanT: 0, cd: 0, burstT: 1, breakT: 0, R: 8 };
  }
  function removeWing() { if (wing) scene.remove(wing.model); wing = null; }
  function updateWing(dt) {
    const w = wing; if (!w) return;
    const f = S.flight, o = towers()[0];
    if ((w.scanT -= dt) <= 0) {   // blanco: lo que va a por la torre cerca de ella; si no, lo que te ataca
      w.scanT = 0.8; w.tgt = null; let bd = Infinity;
      for (const e of enemies) {
        if (!e.alive || e.kind === "dummy" || e.kind === "hmissile") continue;
        const dW = e.pos.distanceTo(w.pos), dT = o ? Math.hypot(e.pos.x - o.x, e.pos.z - o.z) : Infinity;
        if (dT > 3200 && dW > 1600) continue;
        const sc = dW + (KIND[e.kind].tower ? 0 : 900) - (e.kind === "boss" ? 1500 : 0);
        if (sc < bd) { bd = sc; w.tgt = e; }
      }
    }
    const desired = _wD, e = w.tgt && w.tgt.alive ? w.tgt : null;
    let want = playerCruise * 1.05;
    if (e) {
      const d = e.pos.distanceTo(w.pos);
      if (w.breakT > 0) { w.breakT -= dt; desired.copy(w.dir).setY(0.35); }
      else { leadPoint(w.pos, w.vel, e, WING.speed, desired).sub(w.pos); if (d < 140) w.breakT = 1.6; }
      // ráfagas cuando lo tiene delante
      const ang = w.dir.angleTo(_wT.copy(leadPoint(w.pos, w.vel, e, WING.speed, _wZ)).sub(w.pos).normalize());
      if ((w.burstT -= dt) <= -0.8) w.burstT = 1.1;
      if (w.burstT > 0 && d < WING.range && ang < 0.09 && (w.cd -= dt) <= 0) {
        w.cd = 1 / WING.rate;
        const p0 = _wZ.copy(w.pos).addScaledVector(w.dir, 8), dir = _wT.copy(w.dir);
        dir.x += (rnd() - 0.5) * WING.spread * 2; dir.y += (rnd() - 0.5) * WING.spread * 2; dir.z += (rnd() - 0.5) * WING.spread * 2; dir.normalize();
        addBullet(p0, dir.multiplyScalar(WING.speed).add(w.vel), WING.dmg, "w", 12);
        snd("aa", distToMe(p0));
      }
    } else if (f && pl.alive && !(S.crashT > 0)) {   // formación: a tu derecha, algo adelantado y más alto (para que se vea con la cámara de persecución)
      const ax = f.axes(), slot = _wT.copy(f.pos).addScaledVector(ax.right, 38).addScaledVector(ax.fwd, 12).addScaledVector(ax.up, 6);
      desired.copy(slot).sub(w.pos);
      const d = desired.length();
      want = f.vel.length() + Math.max(-40, Math.min(80, (d - 20) * 0.6 * Math.sign(desired.dot(w.dir) || 1)));
      if (d < 60) desired.addScaledVector(ax.fwd, 60);   // ya en su sitio: rumbo paralelo
    } else if (o) desired.set(o.x - w.pos.x, 0, o.z - w.pos.z).normalize().add(_wT.set(-(o.z - w.pos.z), 0, o.x - w.pos.x).normalize());   // da vueltas a la torre
    else desired.copy(w.dir);
    avoid(w, desired, 160, null, true);
    steer(w, desired, dt);
    w.speed += (Math.max(playerCruise * 0.6, Math.min(playerCruise * 1.5, want)) - w.speed) * Math.min(1, dt * 1.2);
    w.vel.copy(w.dir).multiplyScalar(w.speed);
    w.pos.addScaledVector(w.vel, dt);
    const gY = api.groundAt(w.pos.x, w.pos.z); if (w.pos.y < gY + 40) w.pos.y = gY + 40;
    _look.copy(w.pos).sub(w.dir);
    w.model.position.copy(w.pos); w.model.up.copy(UP); w.model.lookAt(_look); w.model.rotateZ(-w.bank);
    const bl = w.model.getObjectByName("blades"); if (bl) bl.rotation.z += dt * 40;
  }

  // ── Oleadas: presupuesto de amenaza que crece ×1,18 por oleada, tipos que se van desbloqueando ──
  const DIFF = {
    easy:   { budget: 0.75, lvOff: 0, speedK: 0.9,  towerDmgK: 0.75, kitP: 0.55, respawn: 3.2, aaK: 1 },
    normal: { budget: 1,    lvOff: 0, speedK: 1,    towerDmgK: 1,    kitP: 0.38, respawn: 4.5, aaK: 0.85 },
    hard:   { budget: 1.15, lvOff: 3, speedK: 1.05, towerDmgK: 1.2,  kitP: 0.22, respawn: 8, aaK: 0.7 },
  };
  const COST = { escort: 1, attacker: 1.2, drones: 1.5, bomber: 2.5, heli: 2, cruise: 1 };
  const UNLOCK = { escort: 1, attacker: 1, drones: 3, bomber: 4, heli: 6, cruise: 8 };
  const WEIGHT = { escort: 2, attacker: 3, drones: 2, bomber: 1.5, heli: 1.2, cruise: 1 };
  // Oleadas con identidad: desde la 2.ª, 3 de cada 4 tienen un tema que multiplica el peso de unos tipos
  // (el presupuesto de amenaza es el mismo: cambia la mezcla, no la dificultad)
  const THEMES = {
    strike:   { min: 2, w: { attacker: 4 } },
    dogfight: { min: 2, w: { escort: 5 } },
    swarm:    { min: 3, w: { drones: 5 } },
    bombers:  { min: 4, w: { bomber: 5 } },
    helis:    { min: 6, w: { heli: 5 } },
    lowlevel: { min: 8, w: { cruise: 5, attacker: 1.5 } },
  };
  // ── Tiempo de la oleada ──
  function setWx(w) {
    if (!w || w === game.weather) return;
    game.weather = w; if (onWeather) onWeather(w);
    if (game.on && game.wave > 0) game.feed.push({ txt: t("wx_" + w), t: 2.2, col: "#cfe8ff" });
  }

  // ── Ventajas entre oleadas: 3 al azar (sin las que ya están al máximo); se elige con 1-2-3, la cruceta o el ratón ──
  const PERK_KEYS = ["Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3"];
  let prnd = Math.random;
  const perkCss = document.createElement("style");
  perkCss.textContent = `#sg-perks { position: fixed; left: 50%; top: 196px; transform: translateX(-50%); z-index: 46; font: 14px/1.35 system-ui, sans-serif; color: #e9e9ea; text-align: center; width: min(760px, calc(100vw - 32px)); }
  #sg-perks .t { font-weight: 800; font-size: 1.15rem; margin-bottom: 8px; color: #ffd23a; } #sg-perks .t small { display: block; font-weight: 600; font-size: .8rem; color: #cfd6dd; }
  #sg-perks .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  #sg-perks button { font: inherit; color: inherit; text-align: center; background: rgba(23,24,26,.92); border: 1px solid #3a3d44; border-radius: 12px; padding: 12px 10px 10px; cursor: pointer; pointer-events: auto; }
  #sg-perks button:hover { border-color: #8a8f98; background: rgba(42,44,49,.95); }
  #sg-perks i { display: block; font-style: normal; font-size: 1.8rem; line-height: 1.2; } #sg-perks b { display: block; margin: 4px 0 3px; }
  #sg-perks span { display: block; color: #b9c0c8; font-size: .82rem; min-height: 2.6em; } #sg-perks small { display: block; color: #8f99a5; font-size: .75rem; margin-top: 5px; }
  #sg-perks kbd { display: inline-block; margin-top: 6px; font: 600 .75rem system-ui; background: #222327; border: 1px solid #3a3d44; border-radius: 5px; padding: 1px 7px; }
  #sg-perks.sg-hide { display: none; }`;
  document.head.appendChild(perkCss);
  const perkBox = document.createElement("div"); perkBox.id = "sg-perks"; perkBox.className = "sg-hide"; document.body.appendChild(perkBox);
  perkBox.onclick = e => { const b = e.target && e.target.closest && e.target.closest("[data-i]"); if (b) choosePerk(+b.dataset.i); };
  function offerPerks() {
    if (game.training || game.over) return;
    const pool = Object.keys(PERKS).filter(k => pk(k) < PERKS[k].max && !(k === "aa" && !turrets.length)), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice((prnd() * pool.length) | 0, 1)[0]);
    if (!out.length) return;
    game.offer = out; snd("waveDone");
    const pad = navigator.getGamepads && [...navigator.getGamepads()].some(g => g);
    perkBox.innerHTML = `<div class="t">${t("perkTitle")}<small>${t("perkSub")}</small></div><div class="cards">${out.map((k, i) => {
      const lv = pk(k);
      return `<button data-i="${i}"><i>${PERKS[k].icon}</i><b>${t("perk_" + k)}</b><span>${t("perkd_" + k)}</span><small>${lv ? t("perkLv", { n: lv + 1, m: PERKS[k].max }) : PERKS[k].max > 1 ? t("perkLv", { n: 1, m: PERKS[k].max }) : t("perkOnce")}</small><kbd>${pad ? ["←", "↓", "→"][i] : i + 1}</kbd></button>`; }).join("")}</div>`;
    perkBox.classList.remove("sg-hide");
  }
  function choosePerk(i) {
    const k = game.offer && game.offer[i]; if (!k) return;
    game.perks[k] = pk(k) + 1; game.perkList.push(k); game.offer = null;
    perkBox.classList.add("sg-hide");
    // lo que se nota al momento
    if (k === "armor") pl.hull = Math.min(maxHull(), pl.hull + 25);
    if (k === "shield") pl.shield = Math.min(maxShield(), pl.shield + 20);
    if (k === "sec") pl.ammo = ammoMax();
    if (k === "flares") pl.flares = Math.min(flaresMax(), pl.flares + 1);
    banner(t("perk_" + k), 2.2, "good", t("perkd_" + k)); snd("powerup"); rum(0.2, 0.3, 150);
  }

  function planWave(n) {
    const lv = n + game.D.lvOff;
    let budget = 4 * Math.pow(1.18, lv - 1) * game.D.budget;
    const list = [];
    const boss = n % 5 === 0;
    if (boss) budget *= 0.5;
    let theme = boss ? "boss" : null;
    if (!boss && n >= 2 && wrnd() < 0.75) {
      const opts = Object.keys(THEMES).filter(k => lv >= THEMES[k].min && k !== game.lastTheme);
      if (opts.length) theme = opts[(wrnd() * opts.length) | 0];
    }
    const TW = theme && THEMES[theme] ? THEMES[theme].w : {};
    const kinds = Object.keys(COST).filter(k => lv >= UNLOCK[k]);
    for (let guard = 0; budget > 0.9 && guard < 300; guard++) {
      const avail = kinds.filter(k => COST[k] <= budget + 0.3); if (!avail.length) break;
      const wt = k => WEIGHT[k] * (TW[k] || 1);
      const tot = avail.reduce((s, k) => s + wt(k), 0); let r = wrnd() * tot, k = avail[0];
      for (const a of avail) { r -= wt(a); if (r <= 0) { k = a; break; } }
      list.push(k); budget -= COST[k];
    }
    if (!list.some(k => k !== "escort")) list.push("attacker");
    for (let i = list.length - 1; i > 0; i--) { const j = (wrnd() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
    if (boss) list.splice(Math.min(2, list.length), 0, "boss");
    // Tiempo: fijo (despejado, tormenta, noche) o cambiante desde la 3.ª oleada (los jefes traen tormenta a menudo)
    let weather = game.wxPlan || "clear";
    if (game.wxMode === "storm") weather = "storm";
    else if (game.wxMode !== "auto") weather = "clear";
    else if (n >= 3) { const r = wrnd(), w = wrnd(); if (boss ? r < 0.6 : r < (game.wxPlan === "storm" ? 0.75 : 0.4)) weather = boss ? (w < 0.6 ? "storm" : game.cold ? "snow" : "rain") : (w < 0.4 ? "clear" : w < 0.75 ? (game.cold ? "snow" : "rain") : "storm"); }
    game.wxPlan = weather;
    // Por cuántos lados entran: 1 al principio, hasta 4
    const nS = Math.min(4, 1 + Math.floor((lv - 1) / 3)), a0 = wrnd() * Math.PI * 2;
    const sectors = Array.from({ length: nS }, (_, i) => a0 + i * Math.PI * 2 / nS + (wrnd() - 0.5) * 0.5);
    return { n, lv, list, sectors, theme, weather };
  }
  // Rumbo (N, NE, E…) de un ángulo de sector: en el mundo, x = este y z = sur
  const DIRS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  function dirOf(a) { const b = Math.atan2(Math.cos(a), -Math.sin(a)); return DIRS[((Math.round(b / (Math.PI / 4)) % 8) + 8) % 8]; }
  function nextInfo() {
    const nx = game.next; if (!nx) return "";
    const ds = [...new Set(nx.sectors.map(dirOf))].map(d => t("dir_" + d)).join(", ");
    const wx = nx.weather && (nx.weather !== "clear" || game.weather !== "clear") ? " · " + t("wx_" + nx.weather) : "";
    return t("nextWave", { th: t("th_" + (nx.theme || "mixed")), d: ds }) + wx;
  }
  function victory() {
    const o = towers()[0], hp = o ? Math.round(o.hp) : 0, bonus = 2000 + hp * 50;
    game.score += bonus; game.won = true; game.over = true; game.overT = 0; game.queue = []; game.next = null;
    game.hpLog.push([Math.round(game.time), hp]);
    banner(t("victory"), 5, "good", t("victorySub", { b: bonus.toLocaleString(api.LOCALE) })); snd("record"); rum(0.3, 0.3, 600);
  }
  // Llamar ya a la siguiente oleada (tecla N / botón X): puntos por cada segundo de respiro que te ahorras
  const callBonus = () => Math.round(Math.max(0, game.restT)) * CALL_PTS * (game.wave + 1);
  const canCall = () => game.on && !game.over && !game.training && game.phase === "rest" && game.wave > 0 && !game.offer && game.restT > 1;
  function callWave() {
    if (!canCall()) return;
    const b = callBonus(); game.score += b; game.restT = 0;
    game.feed.push({ txt: t("calledEarly", { p: b.toLocaleString(api.LOCALE) }), t: 1.8, col: "#ffd23a" }); snd("click");
  }
  // Blitz: se acaba el tiempo con la torre en pie → puntos por lo que queda de torre
  function timeUp() {
    const o = towers()[0], hp = o ? Math.round(o.hp) : 0, bonus = hp * 30;
    game.score += bonus; game.won = hp > 0; game.over = true; game.overT = 0; game.queue = []; game.next = null;
    game.hpLog.push([Math.round(game.time), hp]);
    banner(t("timeUp"), 5, "good", t("timeUpSub", { b: bonus.toLocaleString(api.LOCALE) })); snd("record"); rum(0.3, 0.3, 600);
  }
  function updateWaves(dt) {
    if (game.over || game.training) return;
    if (game.phase === "rest") {
      if (game.offer) return;   // eligiendo ventaja: el respiro espera
      game.restT -= dt;
      if (game.restT <= 0) {
        game.wave++; game.phase = "fight"; game.spawnT = 0;
        const nx = game.next && game.next.n === game.wave ? game.next : planWave(game.wave);
        game.lv = nx.lv; game.queue = nx.list.slice(); game.sectors = nx.sectors; game.theme = nx.theme; game.next = null; setWx(nx.weather);
        if (nx.theme && nx.theme !== "boss") game.lastTheme = nx.theme;
        banner(game.maxWave ? t("waveOf", { n: game.wave, m: game.maxWave }) : t("wave", { n: game.wave }), 3, nx.theme === "boss" ? "boss" : "info", nx.theme && nx.theme !== "boss" ? t("th_" + nx.theme) : "");
        snd("waveStart"); game.waveTimes.push(Math.round(game.time));
      }
      return;
    }
    const alive = enemies.filter(e => e.alive).length;
    if (game.queue.length && (game.spawnT -= dt) <= 0 && alive < Math.min(16, 6 + game.lv / 2)) {
      const k = game.queue.shift();
      game.spawnT = Math.max(0.6, 2.2 - game.lv * 0.06) * (0.7 + rnd() * 0.6);
      if (k === "drones") {
        const p = spawnPoint(); p.y = api.groundAt(p.x, p.z) + 280; const o = pickTower(p), d = new THREE.Vector3(-p.x, 0, -p.z).normalize(), sd = new THREE.Vector3(-d.z, 0, d.x);
        for (let i = 0; i < 3; i++) spawn("drone", p.clone().addScaledVector(sd, (i - 1) * 40).addScaledVector(d, -Math.abs(i - 1) * 30), { tgt: o, dir: d });
      } else {
        spawn(k);
        if (k === "boss") { banner(t("boss"), 3, "boss"); snd("boss"); rum(0.4, 0.2, 900); }
        if (k === "cruise" && (game.cruiseWarnT || 0) <= 0) { game.cruiseWarnT = 10; api.flash(t("cruiseWarn"), 2500); }
      }
    }
    if (!game.queue.length && !enemies.some(e => e.alive)) {
      game.phase = "rest"; game.restT = restFor(game.wave, game.mode);
      const bonus = 250 * game.wave + 100 * aliveTowers().filter(o => o.hp >= 100).length; game.score += bonus;
      for (const o of aliveTowers()) setTowerHp(o, o.hp + 5 + 4 * pk("regen"), false);   // respiro: las torres en pie recuperan un 5 % (+4 % por ventaja)
      // Al límite: superar una oleada con la torre al 10 % o menos · Intacta: oleadas seguidas sin bajar del 50 %
      if (aliveTowers().some(o => o.hp <= 10)) game.lastStand = true;
      if (!game.perfectBroken && (game.waveMinHp ?? 100) >= 50) game.perfectUpTo = game.wave; else game.perfectBroken = true;
      game.waveMinHp = 100;
      if (game.maxWave && game.wave >= game.maxWave) { victory(); return; }
      game.next = planWave(game.wave + 1); setWx(game.next.weather);   // el tiempo cambia en el respiro
      if (game.wave % PERK_EVERY === 0 && game.mode !== "blitz") offerPerks();   // Blitz: sin pararse a elegir
      banner(t("waveDone", { n: game.wave, b: bonus }), 3.5, "good", nextInfo()); snd("waveDone");
    }
  }

  // Torres (barra de arriba), marcas de torres atacadas, kits, anillo y jefe
  function drawTowersHud(W2, H2, f, dt) {
    const list = towers(); if (!list.length) return;
    const one = list.length === 1, bw = one ? 260 : 66, gap = 6, x0 = W2 / 2 - (list.length * (bw + gap) - gap) / 2, y0 = 88;
    g2.textAlign = "center"; g2.font = "700 12px system-ui";
    list.forEach((o, i) => {
      if (o.attackedT > 0) o.attackedT -= dt;
      if (o.warnT > 0) o.warnT -= dt;
      const x = x0 + i * (bw + gap), dead = o.hp <= 0, blink = o.attackedT > 0 && (performance.now() / 250 | 0) % 2 === 0;
      g2.fillStyle = blink ? "rgba(160,30,20,.8)" : "rgba(10,12,16,.6)"; g2.fillRect(x, y0, bw, 22);
      const col = dead ? "#6b7078" : o.hp > 60 ? "#7ee08a" : o.hp > 30 ? "#ffb020" : "#ff5040";
      if (!dead) { g2.fillStyle = col; g2.fillRect(x + 2, y0 + 17, (bw - 4) * o.hp / 100, 3); }
      g2.fillStyle = col; const lbl = one ? t("towerLbl") : `T${o.n}`; g2.fillText(dead ? `${lbl} ✕` : `${lbl} ${Math.ceil(o.hp)}%`, x + bw / 2, y0 + 14);
      // en el mundo: rombo sobre la torre atacada; si no se ve, flecha en el borde
      if (!dead && o.attackedT > 0) marker(towerAim(o, _e1, 150), "#ff9a3a", one ? t("towerLbl") : `T${o.n}`, W2, H2, "diamond");
    });
    for (const k of kits) marker(k.p, "#6dff8a", "+", W2, H2, "plus", f);
    if (wing && wing.pos.distanceTo(f.pos) > 300) marker(wing.pos, "#8fd0ff", t("wingLbl"), W2, H2, "ring", f);   // en formación no hace falta
    for (const w of powers) if (w.p.distanceTo(f.pos) < 3000) marker(w.p, POWER[w.k].css, t("pw_" + w.k), W2, H2, "diamond", f);
    if (turrets.length && list[0].hp > 0 && list[0].hp < AA_MIN && !game.training) { g2.textAlign = "center"; g2.font = "700 12px system-ui"; g2.fillStyle = "#ffb020"; g2.fillText(t("aaOff"), W2 / 2, y0 + 38); }
    if (pl.kit && ring.for) marker(ring.pos, "#6dff8a", t("ringLbl"), W2, H2, "ring", f);
    if (pl.kit) { g2.textAlign = "center"; g2.font = "700 14px system-ui"; g2.fillStyle = "#6dff8a"; g2.fillText(ring.for ? t("kitCarry", { n: ring.for.n }) : t("kitGot"), W2 / 2, 188); }
    const boss = enemies.find(e => e.alive && e.kind === "boss");
    if (boss) {
      const bw2 = 360, bx = W2 / 2 - bw2 / 2, by = H2 - 154;   // por encima del aviso «Haz clic para apuntar»
      g2.fillStyle = "rgba(10,12,16,.6)"; g2.fillRect(bx - 8, by - 20, bw2 + 16, 40);
      g2.fillStyle = "#ffb020"; g2.font = "700 12px system-ui"; g2.textAlign = "left"; g2.fillText(`${t("bossLbl")} · ${t("phaseN", { n: boss.phase || 1 })}`, bx, by - 6);
      g2.fillStyle = "rgba(255,255,255,.12)"; g2.fillRect(bx, by, bw2, 8); g2.fillStyle = "#ffb020"; g2.fillRect(bx, by, bw2 * Math.max(0, boss.hp) / boss.maxHp, 8);
      boss.engines.forEach((m, i) => { g2.fillStyle = m.alive ? "#f2f4f6" : "#ff5040"; g2.fillRect(bx + bw2 - 4 * 22 + i * 22, by - 16, 18, 8); });
    }
  }
  // Radar: la zona de combate vista desde arriba, girando con la nave (arriba = adonde vas)
  function drawRadar(W2, H2, f) {
    const R = 78, cx = 18 + R, cy = H2 - 18 - R, range = 6200;
    const { fwd } = f.axes(), fl = Math.hypot(fwd.x, fwd.z) || 1, fx = fwd.x / fl, fz = fwd.z / fl;
    const P = (x, z) => { const dx = x - f.pos.x, dz = z - f.pos.z; let sx = (dx * -fz + dz * fx) / range * R, sy = -(dx * fx + dz * fz) / range * R; const l = Math.hypot(sx, sy); if (l > R - 4) { sx *= (R - 4) / l; sy *= (R - 4) / l; } return [cx + sx, cy + sy]; };
    g2.fillStyle = "rgba(8,12,16,.62)"; g2.beginPath(); g2.arc(cx, cy, R, 0, 7); g2.fill();
    g2.strokeStyle = "rgba(160,200,220,.25)"; g2.lineWidth = 1;
    for (const k of [0.33, 0.66]) { g2.beginPath(); g2.arc(cx, cy, R * k, 0, 7); g2.stroke(); }
    g2.beginPath(); g2.moveTo(cx - R, cy); g2.lineTo(cx + R, cy); g2.moveTo(cx, cy - R); g2.lineTo(cx, cy + R); g2.stroke();
    // borde de la zona (6 km) como círculo alrededor del centro del mapa
    const [zx, zy] = P(0, 0); g2.strokeStyle = "rgba(255,176,32,.45)"; g2.beginPath(); g2.arc(zx, zy, 6000 / range * R, 0, 7); g2.save(); g2.beginPath(); g2.arc(cx, cy, R, 0, 7); g2.clip(); g2.beginPath(); g2.arc(zx, zy, 6000 / range * R, 0, 7); g2.stroke(); g2.restore();
    for (const o of towers()) { const [x, y] = P(o.x, o.z); g2.fillStyle = o.hp <= 0 ? "#6b7078" : o.attackedT > 0 && (performance.now() / 250 | 0) % 2 ? "#ff5040" : o.hp > 60 ? "#7ee08a" : o.hp > 30 ? "#ffb020" : "#ff5040"; g2.fillRect(x - 4, y - 4, 8, 8); }
    if (game.phase === "rest" && game.next && !game.over) for (const a of game.next.sectors) {   // por dónde llega la siguiente oleada
      const [x, y] = P(Math.cos(a) * ZONE, Math.sin(a) * ZONE), ang = Math.atan2(y - cy, x - cx);
      g2.save(); g2.translate(x, y); g2.rotate(ang + Math.PI); g2.fillStyle = (performance.now() / 400 | 0) % 2 ? "#ffb020" : "#b77a10";
      g2.beginPath(); g2.moveTo(7, 0); g2.lineTo(-5, -6); g2.lineTo(-5, 6); g2.closePath(); g2.fill(); g2.restore();
    }
    if (wing) { const [x, y] = P(wing.pos.x, wing.pos.z); g2.fillStyle = "#8fd0ff"; g2.beginPath(); g2.arc(x, y, 3.5, 0, 7); g2.fill(); }
    for (const k of kits) { const [x, y] = P(k.p.x, k.p.z); g2.strokeStyle = "#6dff8a"; g2.lineWidth = 2; g2.beginPath(); g2.moveTo(x - 4, y); g2.lineTo(x + 4, y); g2.moveTo(x, y - 4); g2.lineTo(x, y + 4); g2.stroke(); }
    if (pl.kit && ring.for) { const [x, y] = P(ring.pos.x, ring.pos.z); g2.strokeStyle = "#6dff8a"; g2.lineWidth = 2; g2.beginPath(); g2.arc(x, y, 5, 0, 7); g2.stroke(); }
    for (const m of emissiles) { const [x, y] = P(m.p.x, m.p.z); g2.lineWidth = 1.5; shapeIcon("cruise", x, y, 3, "#ff3b30"); }
    // con tormenta, el radar falla a ratos (estática)
    const jam = game.weather === "storm" && (performance.now() / 1000) % 7 < 0.6;
    if (game.weather === "storm") { g2.fillStyle = "rgba(200,220,235,.25)"; for (let i = 0; i < (jam ? 60 : 8); i++) { const a2 = Math.random() * 7, r2 = Math.sqrt(Math.random()) * (R - 3); g2.fillRect(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2, 1.5, 1.5); } }
    for (const e of enemies) {
      if (!e.alive || jam) continue;
      const [x, y] = P(e.pos.x, e.pos.z), big = e.kind === "boss" ? 5 : e.kind === "bomber" ? 4 : 3;
      g2.lineWidth = 1.5; shapeIcon(e.kind, x, y, big, e === pl.lockTarget ? "#ffffff" : KIND[e.kind].tower ? "#ff8c2a" : "#ff5040", true); g2.lineWidth = 2;
    }
    g2.fillStyle = "#e6f2ff"; g2.beginPath(); g2.moveTo(cx, cy - 7); g2.lineTo(cx + 5, cy + 5); g2.lineTo(cx, cy + 2); g2.lineTo(cx - 5, cy + 5); g2.closePath(); g2.fill();
    g2.lineWidth = 2;
    // ventajas que llevas: encima del radar
    const owned = Object.keys(PERKS).filter(k => pk(k) > 0);
    if (owned.length) {
      let y = cy - R - 16; g2.font = "15px system-ui"; g2.textAlign = "left"; let x = 18;
      for (const k of owned) { g2.fillStyle = "#fff"; g2.fillText(PERKS[k].icon, x, y); if (pk(k) > 1) { g2.font = "700 10px system-ui"; g2.fillStyle = "#ffd23a"; g2.fillText(String(pk(k)), x + 15, y + 3); g2.font = "15px system-ui"; } x += pk(k) > 1 ? 26 : 21; if (x > 2 * R) { x = 18; y -= 20; } }
    }
    if (game.weather && game.weather !== "clear") { g2.font = "600 11px system-ui"; g2.textAlign = "center"; g2.fillStyle = "#cfe8ff"; g2.fillText(t("wx_" + game.weather), cx, cy + R + 13); }
  }
  function marker(p, col, label, W2, H2, shape, f) {
    const s = toScreen(p, W2, H2), on = s.front && s.x > 0 && s.x < W2 && s.y > 0 && s.y < H2;
    g2.strokeStyle = col; g2.fillStyle = col; g2.lineWidth = 2;
    if (on) {
      if (shape === "diamond") { g2.beginPath(); g2.moveTo(s.x, s.y - 10); g2.lineTo(s.x + 10, s.y); g2.lineTo(s.x, s.y + 10); g2.lineTo(s.x - 10, s.y); g2.closePath(); g2.stroke(); }
      else if (shape === "plus") { g2.beginPath(); g2.moveTo(s.x - 8, s.y); g2.lineTo(s.x + 8, s.y); g2.moveTo(s.x, s.y - 8); g2.lineTo(s.x, s.y + 8); g2.stroke(); g2.beginPath(); g2.arc(s.x, s.y, 13, 0, 7); g2.stroke(); }
      else { g2.beginPath(); g2.arc(s.x, s.y, 16, 0, 7); g2.stroke(); }
      g2.textAlign = "center"; g2.font = "700 12px system-ui";
      g2.fillText(f ? `${label}  ${Math.round(p.distanceTo(f.pos))} m` : label, s.x, s.y - 16);
    } else {
      let dx = s.x - W2 / 2, dy = s.y - H2 / 2; if (!s.front) { dx = -dx; dy = -dy; }
      const a = Math.atan2(dy, dx), R = Math.min(W2, H2) * 0.4, ex = W2 / 2 + Math.cos(a) * R, ey = H2 / 2 + Math.sin(a) * R;
      g2.save(); g2.translate(ex, ey); g2.rotate(a); g2.beginPath(); g2.moveTo(14, 0); g2.lineTo(-7, -9); g2.lineTo(-7, 9); g2.closePath(); g2.fill(); g2.restore();
      g2.textAlign = "center"; g2.font = "700 11px system-ui"; g2.fillText(label, ex - Math.cos(a) * 20, ey - Math.sin(a) * 20 + 4);
    }
  }

  // ── HUD de combate (lienzo propio encima de todo) ──
  const hc = document.createElement("canvas"); hc.id = "sg-hud";
  Object.assign(hc.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: 40 });
  document.body.appendChild(hc);
  const g2 = hc.getContext("2d");
  let hudScale = 1, mouseHint = false;
  const _pp = V();
  function toScreen(p, W2, H2) { _pp.copy(p).project(camera); return { x: (_pp.x + 1) / 2 * W2, y: (1 - _pp.y) / 2 * H2, front: _pp.z < 1 && _pp.z > -1 }; }
  // Forma de cada tipo de enemigo (también para quien no distingue bien rojo y naranja)
  const SHAPE = { escort: "tri", attacker: "tri", heli: "sq", bomber: "dia", boss: "dia2", drone: "dot", cruise: "x", hmissile: "x", dummy: "tri" };
  function shapeIcon(kind, x, y, r, col, fill = false) {
    const sh = SHAPE[kind] || "dot";
    g2.strokeStyle = col; g2.fillStyle = col; g2.beginPath();
    if (sh === "tri") { g2.moveTo(x, y - r); g2.lineTo(x + r * 0.9, y + r * 0.7); g2.lineTo(x - r * 0.9, y + r * 0.7); g2.closePath(); }
    else if (sh === "sq") g2.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
    else if (sh === "dia" || sh === "dia2") { const k = sh === "dia2" ? 1.4 : 1; g2.moveTo(x, y - r * k); g2.lineTo(x + r * k, y); g2.lineTo(x, y + r * k); g2.lineTo(x - r * k, y); g2.closePath(); }
    else if (sh === "x") { g2.moveTo(x - r, y - r); g2.lineTo(x + r, y + r); g2.moveTo(x + r, y - r); g2.lineTo(x - r, y + r); g2.stroke(); return; }
    else { g2.arc(x, y, r * 0.6, 0, 7); g2.fill(); return; }
    if (fill) g2.fill(); else g2.stroke();
  }
  function panel(x, y, w, h, r = 10) {
    g2.fillStyle = "rgba(10,13,18,.62)"; g2.strokeStyle = "rgba(255,255,255,.08)"; g2.lineWidth = 1;
    g2.beginPath(); g2.roundRect(x, y, w, h, r); g2.fill(); g2.stroke(); g2.lineWidth = 2;
  }
  // Iconos de las armas (dibujados): balas, cohete, misil
  function weaponIcon(kind, x, y, col) {
    g2.fillStyle = col; g2.strokeStyle = col; g2.lineWidth = 1.5;
    if (kind === "gun2" || kind === "cannon") { for (const dx of kind === "gun2" ? [0, 6] : [3]) { g2.beginPath(); g2.roundRect(x + dx, y - 6, 4, 11, 2); g2.fill(); } }
    else { g2.beginPath(); g2.moveTo(x, y + 6); g2.lineTo(x, y - 3); g2.lineTo(x + 3, y - 7); g2.lineTo(x + 6, y - 3); g2.lineTo(x + 6, y + 6); g2.closePath(); g2.fill();
      if (kind === "missiles") { g2.beginPath(); g2.moveTo(x - 2, y + 6); g2.lineTo(x + 8, y + 6); g2.stroke(); } }
    g2.lineWidth = 2;
  }
  function drawHud(dt) {
    const dpr = Math.min(devicePixelRatio, 2), hs = hudScale, W2 = innerWidth / hs, H2 = innerHeight / hs;
    if (hc.width !== innerWidth * dpr || hc.height !== innerHeight * dpr) { hc.width = innerWidth * dpr; hc.height = innerHeight * dpr; }
    g2.setTransform(dpr * hs, 0, 0, dpr * hs, 0, 0); g2.clearRect(0, 0, W2, H2);
    if (!game.on || !S.running || S.waitT) return;
    const f = S.flight; if (!f) return;
    const fwd = aimFwd(f).clone();
    g2.lineWidth = 2; g2.font = "600 12px system-ui, sans-serif"; g2.textAlign = "center";
    // Enemigos: corchetes con su forma encima; flechas en el borde si están fuera
    for (const e of enemies) {
      if (!e.alive) continue;
      const s = toScreen(e.pos, W2, H2), d = e.pos.distanceTo(f.pos);
      const on = s.front && s.x > 0 && s.x < W2 && s.y > 0 && s.y < H2;
      const locked = pl.locks.includes(e), sel = e === pl.lockTarget;
      const col = locked ? "#ffd23a" : sel ? "#ffffff" : KIND[e.kind].tower ? "#ff8c2a" : "#ff5040";   // naranja: van a por la torre
      if (on) {
        const k = Math.max(9, Math.min(e.kind === "boss" ? 60 : 26, (e.kind === "boss" ? 16000 : 5200) / d));
        g2.strokeStyle = col; g2.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g2.moveTo(s.x + sx * k, s.y + sy * k * 0.55); g2.lineTo(s.x + sx * k, s.y + sy * k); g2.lineTo(s.x + sx * k * 0.55, s.y + sy * k); }
        g2.stroke();
        shapeIcon(e.kind, s.x, s.y - k - 10, 5, col, true);
        if (locked || sel) { g2.save(); g2.translate(s.x, s.y); g2.rotate(performance.now() / 500); g2.strokeRect(-k - 5, -k - 5, 2 * k + 10, 2 * k + 10); g2.restore(); }
        g2.fillStyle = col; g2.fillText(d > 999 ? (d / 1000).toFixed(1) + " km" : Math.round(d) + " m", s.x, s.y + k + 14);
        if (e.hp < e.maxHp) { g2.fillStyle = "rgba(0,0,0,.5)"; g2.fillRect(s.x - 16, s.y + k + 18, 32, 4); g2.fillStyle = col; g2.fillRect(s.x - 16, s.y + k + 18, 32 * Math.max(0, e.hp) / e.maxHp, 4); }
      } else {
        let dx = s.x - W2 / 2, dy = s.y - H2 / 2; if (!s.front) { dx = -dx; dy = -dy; }
        const a = Math.atan2(dy, dx), R = Math.min(W2, H2) * 0.42, ex = W2 / 2 + Math.cos(a) * R, ey = H2 / 2 + Math.sin(a) * R;
        g2.save(); g2.translate(ex, ey); g2.rotate(a); g2.fillStyle = col; g2.beginPath(); g2.moveTo(12, 0); g2.lineTo(-6, -8); g2.lineTo(-6, 8); g2.closePath(); g2.fill(); g2.restore();
        shapeIcon(e.kind, ex - Math.cos(a) * 18, ey - Math.sin(a) * 18, 4, col, true);
      }
    }
    // Retícula: anillo partido con marcas; roja si la ayuda tiene blanco; rombo en el punto de impacto
    const aim = toScreen(_a.copy(f.pos).addScaledVector(fwd, 700), W2, H2);
    if (mouseAim) { const ma = toScreen(_b.copy(f.pos).addScaledVector(mouseAim, 1500), W2, H2); if (ma.front) { g2.strokeStyle = "rgba(160,215,255,.9)"; g2.lineWidth = 1.5; g2.beginPath(); g2.arc(ma.x, ma.y, 7, 0, 7); g2.stroke(); g2.beginPath(); g2.moveTo(ma.x - 12, ma.y); g2.lineTo(ma.x - 9, ma.y); g2.moveTo(ma.x + 9, ma.y); g2.lineTo(ma.x + 12, ma.y); g2.stroke(); g2.lineWidth = 2; } }
    const tgt = pl.alive ? assistTarget(f.pos, fwd, W.gun.speed) : null;
    const rc = tgt ? "#ff5040" : "rgba(230,255,235,.92)";
    g2.strokeStyle = rc; g2.lineWidth = 2;
    for (let q = 0; q < 4; q++) { const a0 = q * Math.PI / 2 + 0.25; g2.beginPath(); g2.arc(aim.x, aim.y, 19, a0, a0 + Math.PI / 2 - 0.5); g2.stroke(); }
    g2.beginPath(); for (const [x0, y0, x1, y1] of [[-30, 0, -23, 0], [23, 0, 30, 0], [0, 23, 0, 30]]) { g2.moveTo(aim.x + x0, aim.y + y0); g2.lineTo(aim.x + x1, aim.y + y1); } g2.stroke();
    g2.beginPath(); g2.moveTo(aim.x - 5, aim.y - 3); g2.lineTo(aim.x, aim.y + 2); g2.lineTo(aim.x + 5, aim.y - 3); g2.stroke();
    // Fijado de misiles: arcos alrededor de la retícula (uno por objetivo fijado) y el que se está llenando
    if (W.sec.kind === "missiles") {
      const n = W.sec.maxLock, R2 = 27;
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + i * Math.PI * 2 / n + 0.12, a1 = a0 + Math.PI * 2 / n - 0.24;
        const filled = i < pl.locks.length, filling = fire2Prev && i === pl.locks.length;
        g2.strokeStyle = filled ? "#ffd23a" : "rgba(255,255,255,.18)"; g2.lineWidth = 3;
        g2.beginPath(); g2.arc(aim.x, aim.y, R2, a0, a1); g2.stroke();
        if (filling) { g2.strokeStyle = "rgba(255,210,58,.7)"; g2.beginPath(); g2.arc(aim.x, aim.y, R2, a0, a0 + (a1 - a0) * Math.min(1, pl.lockT / W.sec.lockTime)); g2.stroke(); }
      }
      g2.lineWidth = 2;
      if (fire2Prev) { g2.strokeStyle = "rgba(255,210,58,.45)"; g2.setLineDash([6, 6]); g2.beginPath(); g2.arc(aim.x, aim.y, Math.tan(W.sec.cone) * H2 / (2 * Math.tan(camera.fov * Math.PI / 360)), 0, 7); g2.stroke(); g2.setLineDash([]); }
    }
    if (tgt) { const lp = toScreen(leadPoint(f.pos, f.vel, tgt, W.gun.speed, _c), W2, H2); if (lp.front) { g2.strokeStyle = "#ff5040"; g2.beginPath(); g2.moveTo(lp.x, lp.y - 9); g2.lineTo(lp.x + 9, lp.y); g2.lineTo(lp.x, lp.y + 9); g2.lineTo(lp.x - 9, lp.y); g2.closePath(); g2.stroke(); } }
    if (pl.hitT > 0) { pl.hitT -= dt; g2.strokeStyle = "#fff"; g2.lineWidth = 2.5; g2.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g2.moveTo(aim.x + sx * 9, aim.y + sy * 9); g2.lineTo(aim.x + sx * 16, aim.y + sy * 16); } g2.stroke(); g2.lineWidth = 2; }
    // Arriba: oleada, enemigos, bajas, puntos
    const alive = enemies.filter(e => e.alive).length + game.queue.reduce((s, k) => s + (k === "drones" ? 3 : 1), 0);
    g2.textAlign = "center"; g2.font = "700 15px system-ui, sans-serif";
    const blitz = game.mode === "blitz", clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    const topTxt = `${blitz ? `⏱ ${clock(Math.ceil(game.left))}   ·   ` : ""}${game.maxWave ? t("waveOf", { n: Math.max(1, game.wave), m: game.maxWave }) : t("waveN", { n: Math.max(1, game.wave) })}   ·   ${t("enemies", { n: game.phase === "fight" ? alive : 0 })}   ·   ${t("kills", { n: game.kills })}   ·   ${game.score.toLocaleString(api.LOCALE)} ${t("pts")}`;
    const tw = g2.measureText(topTxt).width + 34; panel(W2 / 2 - tw / 2, 52, tw, 30, 15);
    g2.fillStyle = blitz && game.left < 20 && game.wave > 0 && (performance.now() / 400 | 0) % 2 ? "#ffb020" : "#f2f4f6"; g2.fillText(topTxt, W2 / 2, 72);
    // Racha: multiplicador grande y una barra con el tiempo que queda para el siguiente derribo
    if (pl.streak > 1) {
      const k = Math.min(1, pl.streak / COMBO_MAX), hot = `hsl(${48 - 40 * k}, 100%, ${60 - 6 * k}%)`;
      g2.fillStyle = hot; g2.font = `800 ${18 + Math.round(8 * k)}px system-ui`; g2.fillText(t("streak", { n: pl.streak }), W2 / 2, 128);
      if (game.phase === "fight") {
        const frac = Math.max(0, Math.min(1, pl.comboT / comboWin(pl.streak))), bw = 120;
        g2.fillStyle = "rgba(0,0,0,.45)"; g2.fillRect(W2 / 2 - bw / 2, 134, bw, 4);
        g2.fillStyle = hot; g2.fillRect(W2 / 2 - bw / 2, 134, bw * frac, 4);
      }
    }
    if (game.phase === "rest" && game.wave > 0 && !game.over) {
      g2.fillStyle = game.offer ? "#ffd23a" : "#cfe8ff"; g2.font = "600 14px system-ui"; g2.fillText(game.offer ? t("perkWait") : t("rest", { s: Math.ceil(game.restT) }), W2 / 2, 148);
      if (canCall()) {   // llamar ya a la oleada, con los puntos que da ahora mismo
        const pad = navigator.getGamepads && [...navigator.getGamepads()].some(x => x), key = pad ? padName(B.pad.callWave) : keyName(B.kb.callWave[0], t);
        g2.fillStyle = "#ffd23a"; g2.font = "700 13px system-ui"; g2.fillText(t("callHint", { k: key, p: callBonus().toLocaleString(api.LOCALE) }), W2 / 2, 190);
      }
    }
    // Respiro: de qué va la siguiente oleada y por dónde llega (texto, flechas en el mundo y en el radar)
    if (game.phase === "rest" && game.next && !game.over && !game.training) {
      g2.textAlign = "center"; g2.font = "700 14px system-ui"; g2.fillStyle = "#ffb020"; g2.fillText(nextInfo(), W2 / 2, 168);
      for (const a of game.next.sectors) { const p = _e2.set(Math.cos(a) * ZONE, 0, Math.sin(a) * ZONE); p.y = api.groundAt(p.x, p.z) + 400; marker(p, "#ffb020", t("dir_" + dirOf(a)).toUpperCase(), W2, H2, "diamond"); }
    }
    // Puntos ganados (suben y se desvanecen)
    let fy = aim.y - 40;
    for (const it of game.feed) { it.t -= dt; g2.globalAlpha = Math.max(0, Math.min(1, it.t)); g2.fillStyle = it.col || "#ffd23a"; g2.font = "800 16px system-ui"; g2.fillText(it.txt, aim.x + 60, fy - (1.6 - it.t) * 30); fy -= 20; }
    g2.globalAlpha = 1; game.feed = game.feed.filter(it => it.t > 0);
    // Rótulo grande: entra con zoom, se queda y se desvanece; color según el tipo
    if (game.bannerT > 0) {
      game.bannerT -= dt;
      const el = game.bannerMax - game.bannerT, inK = Math.min(1, el / 0.25), out = Math.min(1, game.bannerT / 0.5);
      const col = { warn: "#ff6a50", good: "#7ee08a", info: "#ffffff", boss: "#ffb020" }[game.bannerKind] || "#ffffff";
      g2.save(); g2.translate(W2 / 2, H2 * 0.32); const sc = 1.35 - 0.35 * (1 - Math.pow(1 - inK, 3)); g2.scale(sc, sc);
      g2.globalAlpha = inK * out; g2.font = "800 40px system-ui"; g2.lineWidth = 6; g2.strokeStyle = "rgba(0,0,0,.55)"; g2.strokeText(game.banner, 0, 0);
      g2.fillStyle = col; g2.fillText(game.banner, 0, 0);
      const bw2 = Math.min(g2.measureText(game.banner).width, 520) * inK; g2.fillRect(-bw2 / 2, 14, bw2, 3);
      if (game.bannerSub) { g2.font = "700 17px system-ui"; g2.lineWidth = 4; g2.strokeText(game.bannerSub, 0, 42); g2.fillStyle = "#f2f4f6"; g2.fillText(game.bannerSub, 0, 42); }
      g2.restore(); g2.globalAlpha = 1; g2.lineWidth = 2;
    }
    drawTowersHud(W2, H2, f, dt);
    drawRadar(W2, H2, f);
    if (game.best > 0 && !game.training) { g2.textAlign = "center"; g2.font = "600 12px system-ui"; g2.fillStyle = "rgba(230,235,240,.75)"; g2.fillText(t("yourBest", { s: game.best.toLocaleString(api.LOCALE), w: game.bestWave }), W2 / 2, 124 + (pl.streak > 1 ? 22 : 0)); }
    // Enemigo en la cola
    const six = pl.alive && enemies.some(e => e.alive && e.state === "attack" && e.pos.distanceTo(f.pos) < 900 &&
      _b.copy(e.pos).sub(f.pos).dot(f.axes().fwd) < 0 && _c.copy(f.pos).sub(e.pos).normalize().angleTo(e.dir) < 0.3);
    if (six) snd("tail");
    if (six && (performance.now() / 300 | 0) % 2 === 0) { g2.textAlign = "center"; g2.font = "800 17px system-ui"; g2.fillStyle = "#ff5040"; g2.fillText(t("tail"), W2 / 2, 168); }
    // Misiles que te persiguen: su marca y un aviso con la tecla de las bengalas
    for (const m of emissiles) if (m.target === "player" && m.p.distanceTo(f.pos) < 3500) marker(m.p, "#ff3b30", t("missileLbl"), W2, H2, "diamond", f);
    if (pl.alive && missileOnMe()) {
      const pad = navigator.getGamepads && [...navigator.getGamepads()].some(x => x), key = pad ? padName(B.pad.flare) : keyName(B.kb.flare[0], t);
      const txt = t("missileWarn", { k: key }); g2.font = "800 18px system-ui"; const w5 = g2.measureText(txt).width + 34;
      if ((performance.now() / 250 | 0) % 2 === 0) { g2.fillStyle = "rgba(120,16,12,.78)"; g2.beginPath(); g2.roundRect(W2 / 2 - w5 / 2, H2 * 0.62, w5, 32, 10); g2.fill(); }
      g2.textAlign = "center"; g2.fillStyle = "#ffd2c8"; g2.fillText(txt, W2 / 2, H2 * 0.62 + 22);
    }
    // Abajo: escudo y casco · armas
    const bx = W2 / 2 - 252, by = H2 - 66, bw = 220;
    panel(bx - 10, by - 24, bw + 20, 82);
    g2.textAlign = "left"; g2.font = "600 12px system-ui";
    const bar = (y, label, v, max, col) => { g2.fillStyle = "#cfd6dd"; g2.fillText(label, bx, y - 5); g2.fillStyle = "rgba(255,255,255,.12)"; g2.beginPath(); g2.roundRect(bx, y, bw, 8, 4); g2.fill(); g2.fillStyle = col; g2.beginPath(); g2.roundRect(bx, y, Math.max(0.01, bw * Math.max(0, v) / max), 8, 4); g2.fill(); };
    bar(by, t("shield"), pl.shield, maxShield(), "#5ab8ff");
    bar(by + 30, t("hull"), pl.hull, maxHull(), pl.hull < 30 ? ((performance.now() / 250 | 0) % 2 ? "#ff5040" : "#a8322a") : "#7ee08a");
    { const n = flaresMax(); g2.textAlign = "right"; g2.font = "600 12px system-ui"; g2.fillStyle = "#cfd6dd";
      for (let i = 0; i < n; i++) { const x = bx + bw - 4 - (n - 1 - i) * 11; g2.fillStyle = i < pl.flares ? "#ffe9b0" : "rgba(255,255,255,.18)"; g2.beginPath(); g2.arc(x, by + 20, 3.5, 0, 7); g2.fill(); }
      if (pl.flares < n) { g2.fillStyle = "rgba(255,233,176,.5)"; g2.fillRect(bx + bw - (n - 1) * 11 - 8, by + 26, ((n - 1) * 11 + 8) * pl.flareT / (FLARE_RECHARGE * (1 - 0.25 * pk("flares"))), 2); }
      g2.fillStyle = "#cfd6dd"; g2.fillText(t("flaresLbl"), bx + bw - (n - 1) * 11 - 12, by + 24); g2.textAlign = "left"; }
    const wx = W2 / 2 + 22, wy = H2 - 66;
    panel(wx - 10, wy - 24, 252, 82);
    weaponIcon(W.gun.name, wx, wy - 9, "#cfd6dd");
    g2.fillStyle = "#cfd6dd"; g2.fillText(t(W.gun.name), wx + 18, wy - 5);
    g2.fillStyle = "rgba(255,255,255,.12)"; g2.beginPath(); g2.roundRect(wx, wy, 230, 8, 4); g2.fill();
    g2.fillStyle = pl.over ? "#ff5040" : pl.heat > 0.7 ? "#ffb020" : "#e8e0c8"; g2.beginPath(); g2.roundRect(wx, wy, Math.max(0.01, 230 * pl.heat), 8, 4); g2.fill();
    if (pl.over) { g2.fillStyle = "#ff5040"; g2.textAlign = "right"; g2.fillText(t("overheat"), wx + 230, wy - 5); g2.textAlign = "left"; }
    weaponIcon(W.sec.name, wx, wy + 21, "#cfd6dd");
    g2.fillStyle = "#cfd6dd"; g2.fillText(t(W.sec.name), wx + 18, wy + 25);
    { const AM = ammoMax(), pw = Math.min(26, Math.floor((230 - 2 * (AM - 1)) / AM));
      for (let i = 0; i < AM; i++) { g2.fillStyle = i < pl.ammo ? "#f2f4f6" : "rgba(255,255,255,.15)"; g2.beginPath(); g2.roundRect(wx + i * (pw + 2), wy + 32, pw, 9, 2); g2.fill(); }
      if (pl.ammo < AM) { g2.fillStyle = "rgba(255,255,255,.12)"; g2.fillRect(wx, wy + 46, 230, 3); g2.fillStyle = "#5ab8ff"; g2.fillRect(wx, wy + 46, 230 * Math.min(1, pl.reloadT / (W.sec.reload * (1 - 0.2 * pk("sec")))), 3); } }
    if (pl.locks.length) { g2.fillStyle = "#ffd23a"; g2.textAlign = "right"; g2.fillText(t("locks", { n: pl.locks.length }), wx + 230, wy + 25); g2.textAlign = "left"; }
    // Potenciadores activos: columna a la derecha de las armas, con el tiempo que queda
    { let py = wy - 24; const px = wx + 250; g2.font = "700 11px system-ui"; g2.textAlign = "left";
      for (const k of Object.keys(POWER)) { const v = pl.pw[k]; if (!(v > 0)) continue;
        const txt = t("pw_" + k), w4 = g2.measureText(txt).width + 22; panel(px, py, w4, 24, 12);
        g2.fillStyle = POWER[k].css; g2.fillText(txt, px + 11, py + 15); g2.fillRect(px + 11, py + 19, (w4 - 22) * Math.min(1, v / (POWER[k].dur * (pk("power") ? 1.5 : 1))), 2); py += 29; } }
    // Aviso fijo mientras no se apunta con el ratón (ni hay mando)
    if (mouseHint) {
      g2.font = "600 13px system-ui"; const txt = t("clickAim"), w3 = g2.measureText(txt).width + 30;
      panel(W2 / 2 - w3 / 2, H2 - 124, w3, 28, 14); g2.textAlign = "center"; g2.fillStyle = "rgba(160,215,255,.95)"; g2.fillText(txt, W2 / 2, H2 - 105);
    }
    // Daño recibido: viñeta roja
    if (pl.dmgT > 0) { pl.dmgT -= dt; const gr = g2.createRadialGradient(W2 / 2, H2 / 2, Math.min(W2, H2) * 0.3, W2 / 2, H2 / 2, Math.max(W2, H2) * 0.7); gr.addColorStop(0, "rgba(255,0,0,0)"); gr.addColorStop(1, `rgba(255,30,20,${pl.dmgT})`); g2.fillStyle = gr; g2.fillRect(0, 0, W2, H2); }
  }

  // ══ Repetición de los últimos 30 s ══
  // Se graban 20 fotos por segundo (nave, enemigos, compañero, proyectiles, vida de la torre) y las explosiones.
  // Al verla, lo vivo se esconde y se ponen «fantasmas» en su sitio; la cámara la lleva el addon (HOOK.camera)
  // con planos de cine: detrás de la nave, pasada, desde la torre y, si cayó, la torre viniéndose abajo.
  const q4 = o => [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w];
  function recFrame() {
    const f = S.flight, m = S.model, o = towers()[0];
    const fr = { t: game.time, p: null, fire: pl.firedT > 0, e: [], w: null, hp: o ? o.hp : 0, s: [] };
    if (m && f && pl.alive && !(S.crashT > 0)) fr.p = [m.position.x, m.position.y, m.position.z, ...q4(m)];
    for (const e of enemies) if (e.alive) fr.e.push([e.id, e.kind, e.model.position.x, e.model.position.y, e.model.position.z, ...q4(e.model)]);
    if (wing) fr.w = [wing.model.position.x, wing.model.position.y, wing.model.position.z, ...q4(wing.model)];
    for (const x of shots) fr.s.push([x.p.x, x.p.y, x.p.z]);
    for (const x of eshots) fr.s.push([x.p.x, x.p.y, x.p.z]);
    for (const x of emissiles) fr.s.push([x.p.x, x.p.y, x.p.z]);
    REC.frames.push(fr);
    while (REC.frames.length > 2 && fr.t - REC.frames[0].t > 31) REC.frames.shift();
    while (REC.ev.length && fr.t - REC.ev[0].t > 32) REC.ev.shift();
  }
  const RP = { on: false, t: 0, t0: 0, t1: 0, i: 0, lastI: -1, speed: 1, ghosts: new Map(), me: null, wg: null, evI: 0, onEnd: null,
    shot: -1, shotT: 0, anchor: V(), camP: V(), camL: V(), lvl: -1, hidden: [], tracers: [], fireAcc: 0, fell: false, padPrev: [] };
  const rpBar = document.createElement("div"); rpBar.id = "sg-rpbar"; rpBar.className = "sg-hide";
  { const c = document.createElement("style");
    c.textContent = `#sg-rpbar { position: fixed; left: 50%; bottom: 3.75vh; transform: translate(-50%, 50%); z-index: 46; display: flex; gap: 6px; font: 600 13px system-ui, sans-serif; }
    #sg-rpbar button { font: inherit; color: #e9e9ea; background: rgba(23,24,26,.9); border: 1px solid #3a3d44; border-radius: 9px; padding: 6px 14px; cursor: pointer; }
    #sg-rpbar button:hover { border-color: #8a8f98; } #sg-rpbar button.on { background: rgba(42,44,49,.95); border-color: #8a8f98; } #sg-rpbar.sg-hide { display: none; }`;
    document.head.appendChild(c); }
  document.body.appendChild(rpBar);
  rpBar.onclick = e => { const b = e.target && e.target.closest && e.target.closest("button"); if (!b) return; if (b.dataset.sp) setRpSpeed(+b.dataset.sp); else replayStop(); };
  function setRpSpeed(v) {
    RP.speed = v;
    rpBar.innerHTML = `<button data-sp="0.5" class="${v === 0.5 ? "on" : ""}">×½</button><button data-sp="1" class="${v === 1 ? "on" : ""}">×1</button><button data-sp="2" class="${v === 2 ? "on" : ""}">×2</button><button>${t("rpSkip")}</button>`;
  }
  function replayKey(code) {
    if (code === "Escape" || code === "Enter" || code === "Backspace") replayStop();
    else if (code === "Space") setRpSpeed(RP.speed === 1 ? 2 : RP.speed === 2 ? 0.5 : 1);
  }
  function replayStart(onEnd) {
    if (RP.on || REC.frames.length < 40) return false;
    REC.on = false;
    const F = REC.frames;
    Object.assign(RP, { on: true, onEnd, t0: F[0].t, t1: F[F.length - 1].t, i: 0, lastI: -1, shot: -1, shotT: 0, lvl: -1, fireAcc: 0, tracers: [] });
    RP.t = RP.t0; RP.evI = REC.ev.findIndex(ev => ev.t >= RP.t0); if (RP.evI < 0) RP.evI = REC.ev.length;
    RP.fell = F[F.length - 1].hp <= 0;
    RP.finalHp = towers().map(o => o.hp);
    S.timeScale = 1; slowUntil = 0; api.rig.shake = 0;
    // lo vivo, escondido mientras dura
    RP.hidden = [];
    const hide = o => { if (o && o.visible) { o.visible = false; RP.hidden.push(o); } };
    for (const e of enemies) hide(e.model);
    hide(S.model); if (wing) hide(wing.model);
    for (const x of shots) hide(x.mesh); for (const x of eshots) hide(x.mesh); for (const x of emissiles) hide(x.mesh);
    for (const k of kits) hide(k.mesh); for (const w of powers) hide(w.mesh); hide(ring.mesh);
    for (const p of Object.values(fx)) p.clear();
    flares.length = 0; bullets.length = 0; bMesh.count = 0;
    perkBox.classList.add("sg-hide");
    setRpSpeed(1); rpBar.classList.remove("sg-hide"); document.body.classList.add("sg-replay");
    return true;
  }
  function replayStop(silent) {
    if (!RP.on) return;
    RP.on = false; rpBar.classList.add("sg-hide"); document.body.classList.remove("sg-replay");
    for (const g of RP.ghosts.values()) scene.remove(g);
    RP.ghosts.clear();
    if (RP.me) scene.remove(RP.me); if (RP.wg) scene.remove(RP.wg); RP.me = RP.wg = null;
    for (const o of RP.hidden) o.visible = true;
    RP.hidden = []; RP.tracers = []; bMesh.count = 0;
    for (const p of Object.values(fx)) p.clear();
    // la torre, como quedó (si se estaba viniendo abajo, termina sola en ruina)
    towers().forEach((o, i) => { const hp = RP.finalHp ? RP.finalHp[i] : o.hp, L = Math.ceil(hp / 10); if (o.tw.level !== L) o.tw.setLevel(L, false); o.hp = hp; });
    g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, hc.width, hc.height);
    const cb = RP.onEnd; RP.onEnd = null; if (cb && !silent) cb();
  }
  const _rq1 = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _rF = V(), _rU = V(), _rR = V();
  function poseLerp(obj, a, b, k, off = 0) {
    obj.position.set(a[off] + (b[off] - a[off]) * k, a[off + 1] + (b[off + 1] - a[off + 1]) * k, a[off + 2] + (b[off + 2] - a[off + 2]) * k);
    _rq1.set(a[off + 3], a[off + 4], a[off + 5], a[off + 6]); _rq2.set(b[off + 3], b[off + 4], b[off + 5], b[off + 6]);
    obj.quaternion.slerpQuaternions(_rq1, _rq2, k);
  }
  function plainModel(P) { const m = api.buildModel(P); m.traverse(c => { if (c.name === "cockpit" || c.name === "gear") c.visible = false; }); scene.add(m); return m; }
  const visibleGhost = () => { for (const g of RP.ghosts.values()) if (g.visible) return g.position; return null; };
  function replayFrame(dt) {
    // mando: A = velocidad, B o Start = saltar
    { const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null, b = i => !!(gp && gp.buttons[i] && gp.buttons[i].pressed);
      const now = [b(0), b(1) || b(9)]; if (now[0] && !RP.padPrev[0]) replayKey("Space"); if (now[1] && !RP.padPrev[1]) { RP.padPrev = now; replayStop(); return; } RP.padPrev = now; }
    const sp = dt * RP.speed; RP.t += sp;
    if (RP.t >= RP.t1 + (RP.fell ? 4 : 2)) { replayStop(); return; }
    const F = REC.frames;
    while (RP.i < F.length - 2 && F[RP.i + 1].t <= RP.t) RP.i++;
    const a = F[RP.i], b = F[Math.min(F.length - 1, RP.i + 1)], k = b.t > a.t ? Math.max(0, Math.min(1, (RP.t - a.t) / (b.t - a.t))) : 0;
    // enemigos
    const bm = new Map(b.e.map(x => [x[0], x])), seen = new Set();
    for (const x of a.e) {
      let g = RP.ghosts.get(x[0]);
      if (!g) { g = models(x[1] === "dummy" ? "attacker" : x[1]); scene.add(g); RP.ghosts.set(x[0], g); }
      g.visible = true; poseLerp(g, x, bm.get(x[0]) || x, k, 2); seen.add(x[0]);
      if (x[1] === "heli") { const r = g.getObjectByName("rotor"); if (r) r.rotation.y += sp * 28; const r2 = g.getObjectByName("trotor"); if (r2) r2.rotation.x += sp * 40; }
    }
    for (const [id, g] of RP.ghosts) if (!seen.has(id)) g.visible = false;
    // tu nave y el compañero
    if (a.p) { if (!RP.me) RP.me = plainModel(S.P); RP.me.visible = true; poseLerp(RP.me, a.p, b.p || a.p, k); const bl = RP.me.getObjectByName("blades"); if (bl) bl.rotation.z += sp * 40; }
    else if (RP.me) RP.me.visible = false;
    if (a.w) { if (!RP.wg) RP.wg = plainModel(S.P); RP.wg.visible = true; poseLerp(RP.wg, a.w, b.w || a.w, k); } else if (RP.wg) RP.wg.visible = false;
    // trazadoras de tu arma 1
    if (a.fire && RP.me && RP.me.visible) {
      RP.fireAcc += sp; const step = 1 / W.gun.rate;
      _rF.set(0, 0, -1).applyQuaternion(RP.me.quaternion);
      while (RP.fireAcc > step) { RP.fireAcc -= step; RP.tracers.push({ p: RP.me.position.clone().addScaledVector(_rF, 6), v: _rF.clone().multiplyScalar(W.gun.speed + 150), life: 1.2 }); }
    } else RP.fireAcc = 0;
    let n = 0;
    for (let i = RP.tracers.length - 1; i >= 0; i--) { const r = RP.tracers[i]; r.life -= sp; r.p.addScaledVector(r.v, sp); if (r.life <= 0 || r.p.y < api.groundAt(r.p.x, r.p.z)) RP.tracers.splice(i, 1); }
    for (const r of RP.tracers) { if (n >= MAXB) break; _q.setFromUnitVectors(_z, _a.copy(r.v).normalize()); _m4.compose(r.p, _q, _s3.set(1, 1, W.gun.len)); bMesh.setMatrixAt(n, _m4); bMesh.setColorAt(n, C_PB); n++; }
    bMesh.count = n; bMesh.instanceMatrix.needsUpdate = true; if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true;
    // estelas de cohetes, misiles y bombas (al pasar a cada foto nueva)
    if (RP.i !== RP.lastI) { RP.lastI = RP.i; for (const x of a.s) { fx.smoke.spawn(x[0], x[1], x[2], 0, 0.5, 0, 1.6, 1.2, 4.5, [0.8, 0.8, 0.8, 0.45], [0.9, 0.9, 0.9, 0], 0.6, -0.2); fx.fire.spawn(x[0], x[1], x[2], 0, 0, 0, 0.08, 2, 0.6, [1, 0.8, 0.4, 1], [1, 0.4, 0.1, 0], 0, 0); } }
    // explosiones
    while (RP.evI < REC.ev.length && REC.ev[RP.evI].t <= RP.t) { const ev = REC.ev[RP.evI++]; _rU.set(ev.p[0], ev.p[1], ev.p[2]); boom(_rU, ev.s); snd("explosion", _rU.distanceTo(camera.position), Math.min(2, ev.s)); }
    // la torre: su vida en cada momento (si cae, se ve caer)
    { const o = towers()[0]; if (o) { const L = Math.ceil(a.hp / 10); if (L !== RP.lvl) { o.tw.setLevel(L, RP.lvl >= 0 && L < RP.lvl); if (L === 0 && RP.lvl > 0) snd("collapse"); RP.lvl = L; } } }
    const scale = api.pointScale(), light = 1 - 0.85 * (api.SKY.night || 0);
    fx.fire.update(sp, 0, 0, scale); fx.smoke.update(sp, 2, 1, scale, light); fx.sparks.update(sp, 0, 0, scale);
    const gl = []; for (const g of RP.ghosts.values()) if (g.visible) gl.push({ pos: g.position, alive: true, kind: "x" });
    lights.update(sp, api.SKY.night || 0, gl, () => true);
    drawReplayHud();
  }
  // Cámara de cine: un plano cada 4,5 s (detrás de la nave, pasada, desde la torre); al final, la torre si cae
  function replayCam(dt) {
    if (!RP.on) return false;
    const o = towers()[0], me = RP.me && RP.me.visible ? RP.me : null;
    const by = o ? o.tw.root.position.y : api.groundAt(0, 0);
    const tx = o ? o.x : 0, tz = o ? o.z : 0, H = o ? tH(o) : 300;
    const tail = RP.fell && RP.t > RP.t1 - 6;
    const kk = 1 - Math.exp(-dt * 4), kc = 1 - Math.exp(-dt * 9);
    if (tail) {
      if (RP.shot !== 9) { const ref = me ? me.position : camera.position, ax = ref.x - tx, az = ref.z - tz, l = Math.hypot(ax, az) || 1; RP.anchor.set(ax / l, 0, az / l); RP.shot = 9; RP.shotT = 0; RP.camP.copy(camera.position); }
      RP.shotT += dt;
      const d = H * 2.4 + 650 - RP.shotT * 25, want = _rR.set(tx + RP.anchor.x * d, by + H * 0.45 + 120, tz + RP.anchor.z * d);
      want.y = Math.max(want.y, api.groundAt(want.x, want.z) + 30);
      RP.camP.lerp(want, kk); RP.camL.lerp(_rU.set(tx, by + H * 0.4, tz), kk);
    } else {
      if ((RP.shotT -= dt) <= 0 || (!me && RP.shot !== 2)) {
        RP.shot = me ? (RP.shot + 1) % 3 : 2; RP.shotT = 4.5;
        if (me) { _rF.set(0, 0, -1).applyQuaternion(me.quaternion); _rR.set(1, 0, 0).applyQuaternion(me.quaternion); }
        if (RP.shot === 1 && me) {   // pasada: un punto por delante de la nave, a un lado
          // a qué velocidad va (de las fotos grabadas): la nave pasa junto a la cámara hacia la mitad del plano
          const F = REC.frames, f0 = F[RP.i], f1 = F[Math.min(F.length - 1, RP.i + 4)];
          const v = f0 && f1 && f0.p && f1.p && f1.t > f0.t ? Math.hypot(f1.p[0] - f0.p[0], f1.p[1] - f0.p[1], f1.p[2] - f0.p[2]) / (f1.t - f0.t) : 150;
          RP.anchor.copy(me.position).addScaledVector(_rF, Math.max(120, Math.min(700, v * 2))).addScaledVector(_rR, 28 + v * 0.06); RP.anchor.y += 8;
          RP.anchor.y = Math.max(RP.anchor.y, api.groundAt(RP.anchor.x, RP.anchor.z) + 15);
          RP.camP.copy(RP.anchor); RP.camL.copy(me.position);
        } else if (RP.shot === 2) {   // desde el pie de la torre, mirando la pelea
          const ref = me ? me.position : visibleGhost() || _rU.set(tx + 500, by + 300, tz);
          const ang = Math.atan2(ref.z - tz, ref.x - tx) + 0.7, r = (o ? tR(o) : 93) * 2.2 + 160;
          RP.anchor.set(tx + Math.cos(ang) * r, 0, tz + Math.sin(ang) * r); RP.anchor.y = api.groundAt(RP.anchor.x, RP.anchor.z) + 22;
          RP.camP.copy(RP.anchor); RP.camL.copy(ref);
        } else if (me) { RP.camP.copy(me.position).addScaledVector(_rF, -40); RP.camL.copy(me.position); }
      }
      if (RP.shot === 0 && me) {   // detrás de la nave
        _rF.set(0, 0, -1).applyQuaternion(me.quaternion); _rU.set(0, 1, 0).applyQuaternion(me.quaternion);
        const L = (S.P && S.P.len) || 10;
        RP.camP.lerp(_rR.copy(me.position).addScaledVector(_rF, -(L * 2.6 + 18)).addScaledVector(_rU, L * 0.6 + 4), kc);
        RP.camL.lerp(_rR.copy(me.position).addScaledVector(_rF, 60), kc);
      } else if (RP.shot === 1 && me) RP.camL.lerp(me.position, 1 - Math.exp(-dt * 10));
      else if (RP.shot === 2) { const tgt = me ? me.position : visibleGhost(); if (tgt) RP.camL.lerp(tgt, 1 - Math.exp(-dt * 6)); }
    }
    camera.position.copy(RP.camP); camera.up.set(0, 1, 0); camera.lookAt(RP.camL);
    return true;
  }
  function drawReplayHud() {
    const dpr = Math.min(devicePixelRatio, 2), W2 = innerWidth, H2 = innerHeight;
    if (hc.width !== innerWidth * dpr || hc.height !== innerHeight * dpr) { hc.width = innerWidth * dpr; hc.height = innerHeight * dpr; }
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, W2, H2);
    const bar = Math.round(H2 * 0.075);
    g2.fillStyle = "#000"; g2.fillRect(0, 0, W2, bar); g2.fillRect(0, H2 - bar, W2, bar);   // bandas de cine
    g2.textAlign = "left"; g2.font = "700 15px system-ui"; g2.fillStyle = (performance.now() / 600 | 0) % 2 ? "#ff5040" : "#a8322a";
    g2.beginPath(); g2.arc(28, bar / 2, 6, 0, 7); g2.fill();
    g2.fillStyle = "#f2f4f6"; g2.fillText(t("rpTitle"), 42, bar / 2 + 5);
    const k = Math.max(0, Math.min(1, (RP.t - RP.t0) / Math.max(1, RP.t1 - RP.t0)));
    g2.fillStyle = "rgba(255,255,255,.18)"; g2.fillRect(W2 - 236, bar / 2 - 2, 200, 4); g2.fillStyle = "#f2f4f6"; g2.fillRect(W2 - 236, bar / 2 - 2, 200 * k, 4);
    g2.textAlign = "right"; g2.font = "600 12px system-ui"; g2.fillStyle = "#cfd6dd"; g2.fillText(`-${Math.max(0, Math.ceil(RP.t1 - RP.t))} s`, W2 - 244, bar / 2 + 4);
    const pad = navigator.getGamepads && [...navigator.getGamepads()].some(g => g);
    g2.textAlign = "center"; g2.fillStyle = "rgba(220,226,232,.7)"; g2.fillText(pad ? t("rpKeysPad") : t("rpKeys"), W2 / 2, bar / 2 + 4);
  }

  function stats() {
    return { wave: game.wave, score: game.score, kills: game.kills, killsBy: { ...game.killsBy }, time: game.time, diff: game.diff,
      accuracy: game.shots ? Math.min(1, game.hits / game.shots) : 0, bestStreak: game.bestStreak, kits: game.kitsDelivered, towerLost: game.towerLost.slice(),
      shots: game.shots, lastStand: !!game.lastStand, perfectUpTo: game.perfectUpTo || 0, saves: game.saves || 0, aaKills: game.aaKills || 0, mode: game.mode, won: !!game.won, wing: !!game.wing, wingKills: game.wingKills || 0, perks: game.perkList.slice(), weather: game.wxMode, dodged: game.dodged || 0, flaresUsed: game.flaresUsed || 0, hpLog: game.hpLog.slice(), waveTimes: game.waveTimes.slice() };
  }
  // ── Cada fotograma ──
  function frame(dt, frozen) {
    if (slowUntil && performance.now() > slowUntil) { slowUntil = 0; S.timeScale = 1; }
    if (RP.on) { replayFrame(dt); return; }
    if (!game.on) { drawHud(0); return; }
    if (frozen) { drawHud(0); return; }
    const f = S.flight, playing = f && pl.alive && !(S.crashT > 0);
    if (pl.firedT > 0) pl.firedT -= dt;
    const pad = readPad();
    if (playing) {
      // la nave tocada echa humo (y fuego con poco casco)
      if (pl.hull < 40 && (pl.smokeAcc = (pl.smokeAcc || 0) + dt) > 0.05) {
        pl.smokeAcc = 0; const bk = _b.copy(f.pos).addScaledVector(f.axes().fwd, -S.P.len * 0.5);
        fx.smoke.spawn(bk.x, bk.y, bk.z, 0, 1, 0, 2.2, 2.5, 8, [0.14, 0.13, 0.12, 0.55], [0.3, 0.3, 0.3, 0], 0.6, -0.3);
        if (pl.hull < 20) fx.fire.spawn(bk.x, bk.y, bk.z, 0, 0, 0, 0.25, 3, 1.2, [1, 0.75, 0.3, 1], [1, 0.3, 0.05, 0], 0, 0);
      }
      const fire1 = kbAny("fire1", keys) || mouseL || pad.fire1, fire2 = kbAny("fire2", keys) || mouseR || pad.fire2;
      if (fire1) firePlayerGun(dt); else pl.gunCD = Math.max(0, pl.gunCD - dt);
      pl.heat = Math.max(0, pl.heat - (fire1 && !pl.over ? 0 : W.gun.cool) * dt);
      if (pl.over && pl.heat < 0.35) pl.over = false;
      secondary(dt, fire2);
      pl.sinceHit += dt;
      if (pl.sinceHit > SHIELD_WAIT - 0.8 * pk("shield")) pl.shield = Math.min(maxShield(), pl.shield + SHIELD_REGEN * (1 + 0.3 * pk("shield")) * dt);
    }
    game.time += dt;
    // Racha: el reloj solo corre en combate (en el respiro no hay a quién derribar)
    if (pl.streak > 0 && game.phase === "fight" && !game.over && !game.training && (pl.comboT -= dt) <= 0) {
      if (pl.streak > 1) game.feed.push({ txt: t("comboLost"), t: 1.6, col: "#ff9a6a" });
      pl.streak = 0;
    }
    // Blitz: 5 minutos desde la primera oleada
    if (game.mode === "blitz" && !game.over && game.wave > 0 && (game.left -= dt) <= 0) { game.left = 0; timeUp(); }
    // vida de la torre a lo largo de la partida (para la gráfica de los resultados), cada 2 s
    if (!game.over && (game.logT = (game.logT || 0) + dt) >= 2) { game.logT = 0; const o = towers()[0]; if (o) game.hpLog.push([Math.round(game.time), Math.round(o.hp)]); }
    if (sound) {
      const danger = enemies.some(e => e.alive && e.kind === "boss") || aliveTowers().some(o => o.hp < 30);
      sound.intensity(game.over ? 0 : game.phase === "fight" && !game.training ? (danger ? 2 : 1) : 0);
      if (pl.alive && pl.hull < 30 && !(S.crashT > 0)) snd("lowHull");
    }
    if (game.best != null && !game.recordShown && game.score > game.best && game.best > 0) { game.recordShown = true; banner(t("newRecord"), 2.5, "good"); snd("record"); }
    updateWaves(dt);
    for (const e of enemies) if (e.alive) updateEnemy(e, dt);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e.alive && e.expl && !e.expl.update(dt, api.groundAt)) { e.expl.dispose(); e.expl = null; }
      if (!e.alive && !e.expl) enemies.splice(i, 1);
    }
    updateBullets(dt);
    updateShots(dt);
    updateEnemyShots(dt);
    updateKits(dt);
    updatePowers(dt);
    updateTurrets(dt);
    updateFlares(dt);
    updateEMissiles(dt);
    lights.update(dt, api.SKY.night || 0, enemies, e => KIND[e.kind].tower);
    if (missileOnMe() && pl.alive && !(S.crashT > 0)) snd("missileWarn");
    if (!game.over) updateWing(dt);
    if (game.cruiseWarnT > 0) game.cruiseWarnT -= dt;
    // repetición: 20 fotos por segundo de lo que pasa (hasta que salen los resultados)
    if (REC.on && !game.reported && !game.training && (REC.acc += dt) >= 0.05) { REC.acc = 0; recFrame(); }
    if (game.over && !game.reported && (game.overT += dt) > 4) { game.reported = true; if (onGameOver) onGameOver(stats()); }
    const scale = api.pointScale(), light = 1 - 0.85 * api.SKY.night;
    fx.fire.update(dt, 0, 0, scale); fx.smoke.update(dt, 2, 1, scale, light); fx.sparks.update(dt, 0, 0, scale);
    drawHud(dt);
  }

  function clearAll() {
    for (const e of enemies) { scene.remove(e.model); if (e.expl) e.expl.dispose(); }
    enemies.length = 0;
    for (const s of shots) scene.remove(s.mesh);
    shots.length = 0; bullets.length = 0; bMesh.count = 0;
    for (const s of eshots) scene.remove(s.mesh);
    eshots.length = 0;
    for (const k of kits) scene.remove(k.mesh);
    kits.length = 0; if (ring.mesh) ring.mesh.visible = false; ring.for = null; pl.kit = false;
    for (const w of powers) scene.remove(w.mesh);
    powers.length = 0;
    for (const m of emissiles) scene.remove(m.mesh);
    emissiles.length = 0; flares.length = 0;
    perkBox.classList.add("sg-hide");
    for (const p of Object.values(fx)) p.clear();
  }

  return {
    start(planeId, diff = "normal", opts = {}) {
      W = WEAPONS[planeId] || WEAPONS["sg-attack"];
      { const P = api.AIRCRAFT.find(a => a.id === planeId); playerCruise = P ? P.vmax * 0.72 : 120; }
      clearAll();
      Object.assign(game, { on: true, wave: 0, lv: 1, phase: "rest", restT: 6, score: 0, kills: 0, banner: null, bannerT: 0, feed: [], queue: [], sectors: [], lastStand: false, recordShown: false, training: false, perfectUpTo: 0, perfectBroken: false, waveMinHp: 100, hpLog: [[0, 100]], waveTimes: [], logT: 0,
        D: DIFF[diff] || DIFF.normal, diff, time: 0, shots: 0, hits: 0, killsBy: {}, bestStreak: 0, towerLost: [], kitsDelivered: 0, over: false, overT: 0, reported: false, saves: 0, aaKills: 0,
        mode: opts.mode || "survival", maxWave: opts.mode === "short" ? 10 : 0, left: BLITZ_S, won: false, next: null, theme: null, lastTheme: null,
        perks: {}, perkList: [], offer: null, dodged: 0, flaresUsed: 0, wxMode: ["clear", "storm", "night"].includes(opts.weather) ? opts.weather : "auto", cold: !!opts.cold, wxPlan: null, weather: null });
      wrnd = opts.seed ? seeded(opts.seed) : Math.random;
      prnd = opts.seed ? seeded(opts.seed ^ 0x5bd1e995) : Math.random;   // ventajas: su propio azar (no cambia las oleadas de la diaria)
      replayStop(true); REC.frames = []; REC.ev = []; REC.acc = 0; REC.on = true;
      game.wing = !!opts.wing; game.wingKills = 0;
      if (opts.wing) makeWing(planeId); else removeWing();
      game.next = planWave(1); setWx(game.next.weather);
      towers().forEach((o, i) => { o.hp = 100; o.n = i + 1; o.attackedT = 0; o.warnT = 0; });
      buildTurrets();
      pl.streak = 0; pl.comboT = 0; resetPlayer();
      banner(t("getReady"), 3);
    },
    stop() { replayStop(true); REC.on = false; REC.frames = []; REC.ev = []; game.on = false; slowUntil = 0; removeTurrets(); removeWing(); S.timeScale = 1; api.rig.shake = 0; clearAll(); g2.clearRect(0, 0, hc.width, hc.height); keys.clear(); },
    resetPlayer,
    frame,
    respawnDelay: () => (game.D || DIFF.normal).respawn,
    stats,
    setAim(a) { aimPitch = a; },
    setMouseAim(v) { mouseAim = v; },
    setHudScale(k) { hudScale = k || 1; },
    setMouseHint(on) { mouseHint = !!on; },
    setAssist(level) { [ASSIST_CONE, ASSIST_K] = { low: [0.07, 0.55], mid: [0.12, 0.8], high: [0.2, 1] }[level] || [0.12, 0.8]; },
    setBest(score, wave) { game.best = score || 0; game.bestWave = wave || 0; game.recordShown = false; },
    /** Entrenamiento: sin oleadas; spawn de blancos y kits a mano */
    training(on) { game.training = !!on; },
    spawnDummy(at) { return spawn("dummy", at, { home: at }); },
    spawnTarget(kind, at, tgt) { return spawn(kind, at, { tgt }); },
    dropPower(k, at) { dropPower(k, at); },
    dropKit(at) { const mesh = kitMesh(); mesh.position.copy(at); scene.add(mesh); kits.push({ p: at.clone(), state: "fall", t: 0, mesh }); },
    damageTowerTo(o, hp) { if (hp <= 0 && o.hp > 0) damageTower(o, 1e9); else setTowerHp(o, hp, true); },
    /** Enemigo al que mira la cámara al objetivo: el fijado, o el más cercano al centro */
    focusTarget() {
      if (pl.lockTarget && pl.lockTarget.alive) return pl.lockTarget;
      cycleLock(); return pl.lockTarget && pl.lockTarget.alive ? pl.lockTarget : null;
    },
    /** Puerta «Flow» cruzada: +1 a la racha (y su tiempo, entero) y puntos según la oleada */
    flowGate() {
      if (game.over || !game.on) return 0;
      pl.streak = Math.min(pl.streak + 1, COMBO_MAX); pl.comboT = comboWin(pl.streak); game.bestStreak = Math.max(game.bestStreak, pl.streak);
      const p = 40 * (game.wave + 1) * Math.max(1, pl.streak); game.score += p; game.gates = (game.gates || 0) + 1;
      game.feed.push({ txt: t("flowGate", { p: p.toLocaleString(api.LOCALE) }), t: 1.8, col: "#7ff0ff" }); snd("powerup"); rum(0.25, 0.2, 140);
      return p;
    },
    /** Arena Neón: antiaéreos oscuros con neón, reflectores de colores y perfil luminoso en los enemigos (null = normal) */
    setNeon(pal) {
      tMat.color.setHex(pal ? 0x2a2633 : 0x5a6068); tDark.color.setHex(pal ? 0x141218 : 0x2a2e33);
      tMat.emissive.set(pal ? pal.accB : 0x000000); tMat.emissiveIntensity = pal ? 0.35 : 1;
      tLampOn.color.set(pal ? pal.accA : 0x6dff8a);
      lights.setTint(pal ? pal.accA : null, pal ? pal.accB : null);
      ENEMY_RIM.k.value = pal ? 0.9 : 0; if (pal) (ENEMY_RIM.col.value || (ENEMY_RIM.col.value = new THREE.Color())).set(pal.accB);
    },
    get state() { return { game, pl, enemies, kits, turrets, wing, kill: killEnemy, callWave, emissiles, choosePerk, offerPerks, fireAtPlayer, dropFlares, REC }; },   // para pruebas desde la consola
    /** Muestras de todo lo que aparece durante la partida (enemigos, kits, potenciadores, proyectiles, torretas,
     *  reflector), para que el motor compile sus shaders en la pantalla de carga y no a mitad de combate.
     *  No se liberan: así sus programas siguen en la tarjeta toda la sesión */
    warmObjects() {
      if (warmCache) return warmCache;
      const g = new THREE.Group(); g.name = "sg-warm";
      for (const k of Object.keys(KIND)) if (k !== "dummy") g.add(models(k));
      g.add(kitMesh()); for (const k of Object.keys(POWER)) g.add(powerMesh(k));
      g.add(new THREE.Mesh(rGeo, rMat), new THREE.Mesh(mGeo, rMat), new THREE.Mesh(bombGeo, bombMat), new THREE.Mesh(emGeo, emMat));
      g.add(turretMesh().g);
      const tl = createSearchlights(api); tl.build(null, [{ x: 0, y: 0, z: 0 }], TS); for (const L of tl.list) { scene.remove(L.base); g.add(L.base); }
      if (!ring.mesh) { ring.mesh = new THREE.Mesh(new THREE.TorusGeometry(26, 1.6, 10, 48), new THREE.MeshBasicMaterial({ color: 0x5dff7a, transparent: true, opacity: 0.85 })); ring.mesh.visible = false; scene.add(ring.mesh); }
      g.position.set(0, -5000, 0);   // lejos de todo (el motor la quita al acabar de compilar)
      return (warmCache = g);
    },
    /** Repetición de los últimos 30 s (al acabar la partida): false si no hay bastante grabado */
    replay(onEnd) { return replayStart(onEnd); },
    stopReplay() { replayStop(); },
    get replaying() { return RP.on; },
    get canReplay() { return REC.frames.length >= 40; },
    replayCamera: dt => replayCam(dt),
    /** Teclas que usa el juego en este momento además de las de los controles (las ventajas, 1-2-3) */
    ownsKey: code => RP.on || (!!game.offer && PERK_KEYS.includes(code)),
    get weather() { return game.weather; },
  };
}
