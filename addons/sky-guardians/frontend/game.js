/* ═══════════════════════════════════════════════════════════════════════════
   🛡️ Sky Guardians — módulo del juego
   Wiki Flight lo carga con ?plugin= y llama a init(api). Aquí se junta todo:
   menús (menu.js), torres (tower.js), naves (planes.js), mandos arcade (arcade.js), combate y oleadas
   (combat.js), partidas/ranking/logros (stats.js), entrenamiento (training.js) y textos (texts.js).
   ═══════════════════════════════════════════════════════════════════════════ */
import { createTower, BASE_HALF, TOWER_SCALE, TOWER_H } from "./tower.js";
import { createMonument } from "./monument.js";
import { sgPlanes, SG_ATTACK, SG_FIGHTER, applyLivery } from "./planes.js";
import { logoSvg } from "./logo.js";
import { createCombat } from "./combat.js";
import { createArcade } from "./arcade.js";
import { createStats, today, daySeed } from "./stats.js";
import { createMenu } from "./menu.js";
import { createTraining } from "./training.js";
import { NAME, TX } from "./texts.js";
import { createAudio } from "./audio.js";
import { bindings as KB, ACTIONS, firstPad } from "./controls.js";
import { createPerf } from "./perf.js";
import { createArena, ARENA_LL, PALETTES, PALETTE_IDS } from "./arena.js";

const VERSION = "1.4.0";   // con stats.RULES = 3 (racha, oleadas finales, jefe y bonus de torre nuevos)
const PLANES = [{ key: "p_attack", id: SG_ATTACK }, { key: "p_fighter", id: SG_FIGHTER }];
const SITE_MAX = 1200;                // la torre puede apartarse del punto elegido hasta esto para encontrar sitio
const PLAZA = BASE_HALF * TOWER_SCALE; // media anchura de la explanada a escala (93 m)
const ZONE_WARN = 4500, ZONE_MAX = 6000;
const LS = "sg_last";
// Gráficos: resolución interna como mucho esta parte de la de la pantalla (0 = sin límite). En una gráfica integrada
// a 1080p, 0,67 ≈ 40 % menos de tiempo de dibujo que la resolución completa
const GFX_CAP = { perf: 0.67, bal: 0.85, quality: 0 };
// Terreno: calidad del motor, distancia de dibujo (la zona de juego mide 6 km de radio) y detalle. Medido en un APU
// en Madrid: con 28 km y calidad media se montaban 400+ teselas, ~6 M de triángulos y 900 MB, y caía a 1 fps.
const GFX_TERRAIN = { perf: { q: "low", far: 12000, lod: 0.85, cache: 130 }, bal: { q: "mid", far: 16000, lod: 0.9, cache: 170 }, quality: { q: null, far: 24000, lod: 1, cache: 0 } };

export default function init(api) {
  const { THREE, S, HOOK, LANG } = api;
  const M_KEYS = new Set(["streakLost", "aaOff", "bossP3", "bossRam", "back2", "tower", "shot", "towerHit", "towerDown", "gameOver", "kitCarry", "repaired", "victorySub", "victoryTitle", "th_strike", "graphTitle"]);
  let monName = null;   // en partida defendiendo un monumento: su nombre (y las frases de la torre cambian)
  const t = (k, p) => {
    if (monName && k === "towerLbl") return monName;
    if (monName && M_KEYS.has(k)) k += "_m";
    let s = (TX[LANG] || TX.en)[k] ?? TX.en[k] ?? k; if (p) s = s.replace(/\{(\w+)\}/g, (_, x) => (p[x] != null ? String(p[x]) : "")); return s;
  };
  const st = (() => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } })();
  st.plane = st.plane === 1 ? 1 : 0;
  if (!["easy", "normal", "hard"].includes(st.diff)) st.diff = "normal";
  // Quien empieza, en «Corta» (10 oleadas, 6–11 min): la partida rápida que mejor enseña el juego
  if (!["survival", "short", "daily", "blitz"].includes(st.mode)) st.mode = "short";
  if (!["auto", "clear", "storm", "night"].includes(st.weather)) st.weather = "auto";
  if (st.target !== "monument") st.target = "tower";
  // Escenario: «arena» (Arena Neón, propia, sin mapa) o «city» (tu ciudad, con un mapa descargado). El reto diario y
  // el entrenamiento, siempre en la arena (iguales para todos y sin descargas)
  if (st.place !== "city") st.place = "arena";
  // La Arena Neón necesita el motor v3 (escenario sin mapa, gameBudget, HOOK.sky). Con uno anterior: «Tu ciudad»
  const ARENA_OK = (api.version || 1) >= 3 && typeof api.gameBudget === "function";
  // Paleta de la arena: «auto» = al azar en cada partida (el reto diario, la del día)
  if (st.palette !== "auto" && !PALETTES[st.palette]) st.palette = "auto";
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch { } };
  if (LANG === "ar") document.documentElement.dir = "rtl";
  document.documentElement.lang = LANG;   // para partir bien las palabras largas (guiones)
  const title = NAME[LANG] || NAME.en;
  document.title = title;
  // Las naves de los Guardianes, en la lista del motor (una vez)
  for (const P of sgPlanes(api.AIRCRAFT)) if (!api.AIRCRAFT.some(a => a.id === P.id)) api.AIRCRAFT.push(P);
  applyLivery(api.AIRCRAFT, st.livery);   // librea elegida (se desbloquean por rango; menu.js comprueba el rango)

  // ── Capas propias en vuelo: aviso de derribo y de zona; lo que sobra del HUD de Wiki Flight, oculto ──
  const css = document.createElement("style");
  css.textContent = `
  #sg-down { position: fixed; inset: 0; z-index: 49; display: grid; place-items: center; pointer-events: none; font: 15px system-ui, sans-serif; color: #e9e9ea; }
  #sg-down .box { background: rgba(23,24,26,.92); border: 1px solid #2b2c31; border-radius: 14px; padding: 20px 26px; text-align: center; min-width: 260px; }
  #sg-down h2 { margin: 0 0 8px; }
  #sg-zone { position: fixed; left: 50%; top: 22%; transform: translateX(-50%); z-index: 48; pointer-events: none; font: 600 20px system-ui, sans-serif;
             color: #ffd2c8; background: rgba(120,22,16,.72); border: 1px solid rgba(255,120,100,.55); border-radius: 10px; padding: 10px 18px; }
  #sg-zone.blink { animation: sgblink 0.8s steps(2) infinite; }
  .sg-hide { display: none !important; }
  body.fs-plugin #loading { display: none !important; }
  #sg-load { position: fixed; inset: 0; z-index: 47; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 40%, rgba(20,28,40,.92), rgba(6,9,13,.97));
             font: 15px/1.5 system-ui, sans-serif; color: #e9e9ea; }
  #sg-load .box { width: min(560px, calc(100vw - 40px)); text-align: center; }
  #sg-load h2 { margin: 0 0 4px; font-size: 1.9rem; } #sg-load .where { color: #9aa3ad; margin-bottom: 26px; }
  #sg-load .tip { min-height: 4.5em; padding: 14px 18px; background: rgba(28,29,33,.8); border: 1px solid #2b2c31; border-radius: 12px; text-align: left; }
  #sg-load .tip b { display: block; color: #ffb020; font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 4px; }
  #sg-load .bar { height: 6px; background: rgba(255,255,255,.1); border-radius: 3px; margin: 22px 0 6px; overflow: hidden; } #sg-load .bar i { display: block; height: 100%; width: 0; background: #c9ced6; transition: width .3s; }
  #sg-load .step { color: #8f99a5; font-size: .85rem; }
  #sg-load button { margin-top: 14px; font: inherit; color: #e9e9ea; background: #222327; border: 1px solid #3a3d44; border-radius: 9px; padding: 8px 18px; cursor: pointer; }
  body.fs-plugin #panel6, body.fs-plugin #minimap, body.fs-plugin #mm-zoom, body.fs-plugin #h-left, body.fs-plugin #h-info { display: none !important; }
  body.sg-replay #hud, body.sg-replay #hudc, body.sg-replay #cams, body.sg-replay #sg-zone, body.sg-replay #sg-down { display: none !important; }   /* repetición: solo la imagen */
  @keyframes sgblink { 50% { opacity: .35; } }`;
  document.head.appendChild(css);
  const down = document.createElement("div"); down.id = "sg-down"; down.className = "sg-hide";
  down.innerHTML = `<div class="box"><h2>${t("down")}</h2><div id="sg-down-why">${t("back2")}</div></div>`;
  document.body.appendChild(down);
  // Pantalla de carga con consejos (lee el avance de la de Wiki Flight)
  const load = document.createElement("div"); load.id = "sg-load"; load.className = "sg-hide";
  load.innerHTML = `<div class="box">${logoSvg(70)}<h2>${title}</h2><div class="where" id="sg-load-where"></div><div class="tip"><b>${t("tipLbl")}</b><span id="sg-load-tip"></span></div>
    <div class="bar"><i id="sg-load-bar"></i></div><div class="step" id="sg-load-step"></div><button id="sg-load-go" class="sg-hide">${t("goNow")}</button></div>`;
  document.body.appendChild(load);
  const NTIPS = 21;
  let tipI = Math.floor(Math.random() * NTIPS), tipT = 0;
  document.getElementById("sg-load-go").onclick = () => { const b = document.getElementById("loading-go"); if (b) b.click(); };
  setInterval(() => {
    const on = !!(S.running && S.waitT);
    load.classList.toggle("sg-hide", !on); if (!on) return;
    const pct = document.getElementById("loading-pct"), step = document.getElementById("loading-step"), go = document.getElementById("loading-go");
    document.getElementById("sg-load-bar").style.width = (pct && pct.textContent) || "0%";
    document.getElementById("sg-load-step").textContent = `${step ? step.textContent : ""} · ${(pct && pct.textContent) || ""}`;
    document.getElementById("sg-load-go").classList.toggle("sg-hide", !go || go.classList.contains("hidden"));
    document.getElementById("sg-load-where").textContent = inArena() ? t("arenaName") : st.point ? st.point.name : "";
    if ((tipT += 0.25) >= 6 || !document.getElementById("sg-load-tip").textContent) { tipT = 0; tipI = (tipI + 1) % NTIPS; document.getElementById("sg-load-tip").textContent = t("tip" + (tipI + 1)); }
  }, 250);
  const zone = document.createElement("div"); zone.id = "sg-zone"; zone.className = "sg-hide";
  document.body.appendChild(zone);
  const $ = id => document.getElementById(id);

  // Dibujo sobre el mapa al elegir el punto: el pentágono de torres y el borde de la zona de combate
  function battleOverlay(lat, lon) {
    const k = 111320, ll = (x, z) => [lon + x / (k * Math.cos(lat * Math.PI / 180)), lat - z / k];
    const ring = [];   // la torre en el punto y el borde de la zona de combate alrededor
    for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2; ring.push(ll(Math.cos(a) * ZONE_MAX, Math.sin(a) * ZONE_MAX)); }
    return { type: "FeatureCollection", features: [
      { type: "Feature", properties: { stroke: "#ffb020", width: 2, fill: "#ffb020", fillOpacity: 0.04 }, geometry: { type: "Polygon", coordinates: [ring] } },
      { type: "Feature", properties: { fill: "#e0403a" }, geometry: { type: "Point", coordinates: ll(0, 0) } }] };
  }

  // ── Sitio de cada torre: suelo despejado (sin edificios ni agua, poca pendiente) cerca de su vértice ──
  const H = PLAZA + 10;
  const FOOT = []; for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) FOOT.push([i * H / 3, j * H / 3]);
  function siteScore(x, z) {   // null = no vale; si no, cuanto menos mejor
    let lo = Infinity, hi = -Infinity, unknown = 0;
    for (const [dx, dz] of FOOT) {
      const X = x + dx, Z = z + dz;
      if (api.roofAt(X, Z) !== null) return null;
      if (api.isWater(X, Z) === true) return null;
      if (api.readyZ(X, Z) < 13) unknown++;
      const g = api.groundAt(X, Z); lo = Math.min(lo, g); hi = Math.max(hi, g);
    }
    if (hi - lo > 45) return null;
    return (hi - lo) * 2 + unknown * 6;
  }
  function findSite(vx, vz) {
    let best = null, bs = Infinity;
    for (let r = 0; r <= SITE_MAX; r += 60) {
      const n = r === 0 ? 1 : Math.max(8, Math.round(r / 45));
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + r * 0.01, x = vx + Math.cos(a) * r, z = vz + Math.sin(a) * r;
        const s = siteScore(x, z); if (s === null) continue;
        const sc = s + r * 0.012;
        if (sc < bs) { bs = sc; best = [x, z]; }
      }
      if (best && bs < r * 0.012 + 4) break;   // ya hay uno bueno: no hace falta buscar más lejos
    }
    return best || [vx, vz];
  }

  // ── Las 5 torres ──
  let towers = null;
  function baseY(x, z) {   // la losa se apoya en lo más bajo de su planta (en ladera, se hunde en lo alto)
    let m = Infinity;
    const h = PLAZA;
    for (const [dx, dz] of [[0, 0], [h, h], [-h, h], [h, -h], [-h, -h], [h, 0], [-h, 0], [0, h], [0, -h]]) m = Math.min(m, api.groundAt(x + dx, z + dz));
    return m;
  }
  function placeTower(o) {
    const [x, z] = findSite(o.vx, o.vz);
    o.x = x; o.z = z; o.tw.root.position.set(x, baseY(x, z), z);
  }
  function buildTowers() {
    clearTowers();
    towers = [];
    monName = null;
    // Defender un monumento 3D: el que pone Wiki Flight en su sitio (si ya no está, la torre de siempre)
    if (mode === "game" && !inArena() && st.mode !== "daily" && st.target === "monument" && st.lm) {
      const L = api.S.lm && api.S.lm.list.find(x => x.id === st.lm.id);
      if (L) {
        const tw = createMonument(api, L);
        towers.push({ tw, kind: "monument", H: tw.H, R: tw.R, x: L.X, z: L.Z, vx: L.X, vz: L.Z, fixed: true });
        monName = st.lm.name || L.m.name; window.__sgTowers = towers; return;
      }
      api.flash(t("lmMissing"), 5000);
    }
    for (let i = 0; i < 1; i++) {   // una sola torre, en el punto elegido (o lo más cerca con sitio)
      const vx = 0, vz = 0;
      const tw = createTower(THREE, { seed: 1000, scale: TOWER_SCALE, style: inArena() ? "neon" : null });   // en la arena, con piel de neón
      tw.root.rotation.y = Math.random() * Math.PI * 2;
      api.scene.add(tw.root);
      const o = { tw, vx, vz, x: vx, z: vz, H: TOWER_H * TOWER_SCALE, R: PLAZA };
      placeTower(o);
      towers.push(o);
    }
    window.__sgTowers = towers;   // pruebas desde la consola
  }
  function clearTowers() { if (towers) for (const o of towers) o.tw.dispose(); towers = null; }

  // ── Piezas ──
  const sound = createAudio();
  window.__sgSound = sound;   // pruebas desde la consola
  // El navegador solo deja sonar tras un gesto: el primer clic o tecla enciende el audio y la música
  const unlock = () => { if (sound.init()) sound.music(true); };
  addEventListener("pointerdown", unlock, true); addEventListener("keydown", unlock, true);
  const stats = createStats();
  let mode = "game";   // "game" o "training"
  const combat = createCombat(api, { t, towers: () => towers || [], sound, onWeather: w => { if (api.setWeather) api.setWeather(w); }, onGameOver: r => {
    savePerf();
    const res = stats.addRun(r, { plane: S.P.id, point: inArena() ? t("arenaName") : st.point && st.point.name, day: r.mode === "daily" ? playDay : undefined, lm: monName || undefined });
    api.pause(true); pausedByUs = true;
    menu.showResults({ ...r, plane: S.P.id }, res);
  } });
  window.__sgCombat = combat;
  // Registro de rendimiento de cada partida (se guarda al acabar o al abandonar; ver perf.js)
  const perf = createPerf(api, () => { const s = combat.state; let en = 0; for (const e of s.enemies) if (e.alive) en++; return { kills: s.game.kills, wave: s.game.wave, phase: s.game.phase, enemies: en }; });
  window.__sgPerf = perf;
  const savePerf = () => { if (!perf.on) return; perf.stop(); stats.savePerf(perf.report({ mode: st.mode, diff: st.diff, weather: st.weather, target: st.target, gfx: settingsCache.gfx, plane: S.P && S.P.id })); };
  // Contador de fps (Ajustes): esquina de arriba a la izquierda
  const fpsEl = document.createElement("div"); fpsEl.id = "sg-fps";
  Object.assign(fpsEl.style, { position: "fixed", left: "10px", top: "8px", zIndex: 45, font: "600 12px system-ui, sans-serif", color: "#cfd6dd", background: "rgba(10,13,18,.6)", padding: "3px 8px", borderRadius: "7px", pointerEvents: "none", display: "none" });
  document.body.appendChild(fpsEl);
  setInterval(() => { const on = !!settingsCache.fps && perf.on; fpsEl.style.display = on ? "" : "none"; const l = perf.lastSec; if (on && l) fpsEl.textContent = `${l.fps} fps · ${t("fpsWorst")} ${l.worst} ms`; }, 1000);
  const arcade = createArcade(api, combat);
  HOOK.input = arcade.input;
  const training = createTraining(api, { t, combat, towers: () => towers || [],
    onDone: () => { const n = stats.trained(); api.pause(true); pausedByUs = true; menu.showTrainingDone(n); },
    onSkip: () => quit() });
  let pausedByUs = false, settingsCache = {};
  const TURBO_S = 3; let turboT = 0;
  // Cielo de la arena (motor v2+): sus colores y el sol de franjas
  HOOK.sky = (SKY, dir) => (arena && arena.root.parent && S.arena ? arena.skyTint(SKY, dir) : null);
  const menu = createMenu(api, {
    t, stats, state: st, save, PLANES, title, version: VERSION, overlay: battleOverlay, sound, arenaOK: ARENA_OK,
    applySettings: s => { if (api.setResolutionCap) api.setResolutionCap(GFX_CAP[s.gfx] || 0); if (api.gameBudget) api.gameBudget(GFX_TERRAIN[s.gfx] || GFX_TERRAIN.bal); S.invert = !!s.invert; arcade.setSens(s.sens); combat.setAssist(s.assist); combat.setHudScale({ s: 0.85, m: 1, l: 1.2 }[s.hud] || 1);
      if (combat.setCalm) combat.setCalm(!!s.calm);   // «Reducir efectos»: menos sacudidas, sin cámara lenta, destellos suaves
      settingsCache = s; },
    setLivery: id => { st.livery = id; save(); applyLivery(api.AIRCRAFT, id); },
    previewLivery: id => applyLivery(api.AIRCRAFT, id || st.livery),
    onPlay: () => launch("game"), onTraining: () => launch("training"),
    // repetición de los últimos 30 s: al acabar vuelve a los resultados
    onReplay: () => { if (!combat.replay(() => { menu.reopenResults(); })) menu.reopenResults(); },
    canReplay: () => combat.canReplay && (api.version || 1) >= 2,   // la cámara de la repetición necesita HOOK.camera (motor v2)
    onResume: () => { api.pause(false); recapture(); }, onQuit: () => quit(), onAgain: () => restart(),
  });
  // Start del mando (arcade.js): no quita la pausa con los resultados o el fin del entrenamiento delante
  arcade.startBlocked = () => menu.overlayKind === "results" || menu.overlayKind === "trainDone";
  stats.ready.then(() => menu.show("home"));

  // Partida diaria: Normal, el avión del día y las mismas oleadas para toda la familia
  const dailyPlane = () => daySeed() % PLANES.length;
  let playDay = today();
  let arena = null;
  const inArena = () => ARENA_OK && (mode === "training" || st.mode === "daily" || st.place !== "city");
  function launch(m) {
    mode = m;
    if (st.point && !inArena()) { st.recent = [st.point, ...(st.recent || []).filter(p => Math.abs(p.lat - st.point.lat) > 1e-4 || Math.abs(p.lon - st.point.lon) > 1e-4)].slice(0, 5); save(); }
    const P = PLANES[m === "game" && st.mode === "daily" ? dailyPlane() : st.plane];
    const wx = m === "game" && st.mode !== "daily" ? st.weather : "auto";
    const wxS = wx === "storm" ? "storm" : "clear";
    if (inArena()) {
      // Ciudad según la semilla: el reto diario, la del día (igual para todos); el entrenamiento, siempre la misma;
      // el resto, una nueva en cada partida. Ningún edificio pasa de la mitad de la torre
      const daily = m === "game" && st.mode === "daily", ds = daySeed();
      const seed = daily ? ds : m === "training" ? 7 : 1 + ((Math.random() * 2e9) | 0);
      const pal = daily ? PALETTE_IDS[ds % PALETTE_IDS.length] : st.palette !== "auto" ? st.palette : PALETTE_IDS[(Math.random() * PALETTE_IDS.length) | 0];
      const shadows = settingsCache.gfx !== "perf";   // en «Rendimiento», sin sombras de los edificios
      const key = `${seed}|${pal}|${shadows}`;
      if (!arena || arena.key !== key) { if (arena) arena.dispose(); arena = createArena(THREE, { seed, palette: pal, shadows, maxH: TOWER_H * TOWER_SCALE / 2 }); arena.key = key; }
      if (!arena.root.parent) api.scene.add(arena.root);
      arena.showGates(m === "game");
      combat.setNeon(arena.palette);
      api.start({ arena: { groundAt: arena.groundAt, buildingAt: arena.buildingAt }, lat: ARENA_LL.lat, lon: ARENA_LL.lon, name: t("arenaName"), plane: P.id, assist: true, weather: wxS });
    } else {
      if (arena) arena.root.removeFromParent();
      combat.setNeon(null);
      api.start({ map: st.map, lat: st.point.lat, lon: st.point.lon, name: st.point.name, plane: P.id, assist: true, weather: wxS });
    }
  }
  function recapture() {   // volver a capturar el ratón al seguir (si no se juega con mando)
    const c = api.renderer.domElement;
    if (!firstPad()) c.requestPointerLock && Promise.resolve(c.requestPointerLock()).catch(() => { });
  }

  // ── Enganches con el motor ──
  let tm = 0, siteT = 0, groundMsgT = 0;
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  // Ciclo de día: la partida empieza con el sol a unos 10° (unos 45 min antes de ponerse, en ese sitio y fecha);
  // en cada respiro entre oleadas el reloj corre (≈ 12 min), así que se acaba de noche
  function duskStart() {
    const o = api.origin(); if (!o || o.lat == null) return;
    const d = new Date(); d.setHours(12, 0, 0, 0);
    let pick = null;
    for (let m = 0; m < 12 * 60; m += 5) {
      const ms = d.getTime() + m * 60000, alt = api.sunPosition(ms, o.lat, o.lon).alt * 180 / Math.PI;
      if (alt < 10) { pick = new Date(ms); break; }
    }
    if (!pick) pick = new Date(d.getTime() + 8 * 3600000);   // sol de medianoche: las 20:00
    if (api.sunPosition(d.getTime(), o.lat, o.lon).alt < 0) pick = d;   // noche polar: a mediodía
    api.clock.setTime(pick.getHours(), pick.getMinutes());
  }
  // Noche cerrada: la hora en que el sol está 18° por debajo del horizonte (o las 23:30), y el reloj no corre
  function nightStart() {
    const o = api.origin(); if (!o || o.lat == null) { api.clock.setTime(23, 30); return; }
    const d = new Date(); d.setHours(12, 0, 0, 0);
    for (let m = 0; m < 14 * 60; m += 5) { const ms = d.getTime() + m * 60000; if (api.sunPosition(ms, o.lat, o.lon).alt * 180 / Math.PI < -16) { const p = new Date(ms + 45 * 60000); api.clock.setTime(p.getHours(), p.getMinutes()); return; } }
    api.clock.setTime(0, 30);   // en verano polar no hay noche cerrada: la madrugada
  }
  let wxMode = "auto";
  function begin() {
    tm = 0; siteT = 0;
    // Calidad automática de Wiki Flight: en combate solo baja (si sube en el respiro y baja con la oleada, cada cambio da un tirón)
    S.aqNoUp = true;
    if (api.keepLandmarks) api.keepLandmarks(true);   // monumentos 3D de la zona: cargados una vez y ya no se descargan
    wxMode = mode === "training" ? "clear" : st.mode === "daily" ? "auto" : st.weather;
    if (wxMode === "night") nightStart(); else duskStart();
    buildTowers();
    api.setCam(settingsCache.cam || "chase");
    const gm = mode === "training" ? "survival" : st.mode, diff = mode === "training" ? "easy" : gm === "daily" ? "normal" : st.diff;
    playDay = today();
    const o0 = api.origin(), month = new Date().getMonth(), lat = o0 && o0.lat != null ? o0.lat : 40;
    const cold = Math.abs(lat) > 58 || (Math.abs(lat) > 38 && (lat > 0 ? month <= 1 || month === 11 : month >= 5 && month <= 7));   // nieve en vez de lluvia
    combat.start(S.P.id, diff, { mode: gm, seed: gm === "daily" ? daySeed(playDay) : 0, wing: mode !== "training" && gm !== "daily" && !!st.wing, weather: wxMode, cold });
    const b = stats.best(diff, gm);
    combat.setBest(mode === "training" ? 0 : b ? b.score : 0, b ? b.wave : 0);
    arcade.start();
    if (mode === "game") perf.start(); else perf.stop();
    if (mode === "training") training.start();
    else api.flash(firstPad() ? t("keysPad") : t("keys"), 8000);
  }
  // Shaders de todo lo del juego (enemigos, efectos, la torre…) compilados en la pantalla de carga (motor v2)
  let warmTower = null;
  HOOK.warmup = () => {
    const g = combat.warmObjects();
    const style = inArena() ? "neon" : null;
    if (!warmTower || warmTower.style !== style) { if (warmTower) warmTower.tw.dispose(); warmTower = { style, tw: createTower(THREE, { seed: 1000, scale: TOWER_SCALE, style }) }; }
    g.add(warmTower.tw.root);
    return g;
  };
  // De noche, sin nombres ni líneas de constelaciones: en un combate no se miran y en gráficas modestas cuestan mucho
  if (api.skyLabels) api.skyLabels(false);
  // Modo juego del motor: sin nubes, niebla, halos ni Vía Láctea (adornan pero en combate no se miran)
  if (api.lite) api.lite(true);
  HOOK.ready = begin;
  HOOK.camera = dt => combat.replayCamera(dt);   // la repetición lleva su cámara
  HOOK.mute = m => sound.setMuted(m);   // botón 🔊 de arriba a la derecha y tecla M de Wiki Flight
  // Partida en curso: Offlined pregunta antes de cambiar de sección (si no, se cerraría y se perdería)
  let busyNow = false;
  setInterval(() => {
    const g = combat.state.game, busy = mode === "game" && !!g.on && !g.over;
    if (busy === busyNow) return; busyNow = busy;
    try { if (parent !== window) parent.postMessage({ type: "oflAddonBusy", busy, title: t("quitConfirm"), msg: t("quitConfirmSub"), stay: t("quitNo"), leave: t("quitYes") }, location.origin); } catch { }
  }, 500);
  sound.setMuted(!api.audio.on);
  HOOK.ownsKey = code => combat.ownsKey(code) || (code !== "Escape" && code !== "KeyC" && !!combat.state.game.on && ACTIONS.some(a => KB.kb[a].includes(code)));
  const autoPause = why => {
    if (!S.running || S.paused || S.waitT || !combat.state.game.on || combat.state.game.over) return;
    api.pause(true); if (why) api.flash(why, 4000);
  };
  addEventListener("blur", () => autoPause());
  document.addEventListener("visibilitychange", () => { if (document.hidden) autoPause(); });
  addEventListener("gamepaddisconnected", () => autoPause(t("padLost")));
  HOOK.frame = (dt, frozen) => {
    perf.tick(frozen || S.paused || combat.replaying);
    const inA = !!(arena && arena.root.parent && S.arena);
    if (inA) arena.update(api.SKY.night, frozen ? 0 : dt, api.camera);
    if (!towers || !S.running) { combat.frame(dt, true); return; }
    tm += dt;
    combat.frame(dt, frozen);
    if (!frozen) { arcade.post(dt); training.frame(dt); }
    // Puertas «Flow» de la arena: al cruzar una, turbo unos segundos y la racha sube
    if (inA && !frozen && !S.paused && S.flight && !(S.crashT > 0)) arena.updateGates(dt, S.flight.pos, () => { combat.flowGate(); turboT = TURBO_S; });
    if (turboT > 0 && !frozen && S.flight) {
      turboT -= dt;
      const f = S.flight, v = f.vel.length(), tgt = S.P.vmax * 1.25;
      if (v > 1 && v < tgt) f.vel.multiplyScalar(Math.min(tgt / v, 1 + 1.4 * dt));
    }
    // «Clic para apuntar»: mientras no hay ratón capturado ni mando (firstPad: una lectura por fotograma, compartida)
    combat.setMouseHint(!S.paused && !(S.crashT > 0) && !arcade.mouseOn && !firstPad());
    { const G = combat.state.game; api.clock.speed = wxMode !== "night" && G.phase === "rest" && G.wave > 0 && !G.over && !G.training ? 40 : 1; }
    if (frozen && !combat.replaying) dt = 0;   // en la repetición la torre sí se mueve (se ve caer)
    // Al empezar llegan teselas con más detalle: durante 30 s se revisa que ninguna torre haya quedado sobre un
    // edificio o en el agua (si pasa, se busca otro sitio)
    if (tm < 30 && (siteT += dt) > 2) {
      siteT = 0;
      for (const o of towers) if (!o.fixed && siteScore(o.x, o.z) === null) placeTower(o);
    }
    const ctx = { night: api.SKY.night > 0.5, light: 1 - 0.85 * api.SKY.night, camPos: api.camera.position, scale: api.pointScale() };
    const resettle = ((tm * 2) | 0) !== (((tm - dt) * 2) | 0);   // cada medio segundo: el suelo puede afinarse
    for (const o of towers) {
      if (resettle && !o.fixed) o.tw.root.position.y = baseY(o.x, o.z);
      o.tw.update(dt, ctx);
    }
    const f = S.flight;
    if (!f || frozen || S.crashT > 0) { zone.classList.add("sg-hide"); return; }
    // Choque contra una torre
    for (const o of towers) if (o.tw.hit(f.pos)) { $("sg-down-why").textContent = t("tower"); api.crash("building"); return; }
    // Zona de combate: aviso y, más allá, la nave vuelve sola hacia el centro
    const d = Math.hypot(f.pos.x, f.pos.z);
    if (d > ZONE_WARN) {
      const back = d > ZONE_MAX;
      zone.textContent = back ? t("zoneBack") : t("zoneWarn"); zone.classList.remove("sg-hide"); zone.classList.toggle("blink", !back);
      if (back) {
        const { fwd } = f.axes();
        const want = Math.atan2(-f.pos.x, -f.pos.z), cur = Math.atan2(fwd.x, fwd.z);   // ángulo φ de (x, z) = atan2(x, z): girar +θ sobre Y lo suma
        let da = want - cur; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const step = Math.sign(da) * Math.min(Math.abs(da), 0.9 * dt);
        _q.setFromAxisAngle(UP, step); f.q.premultiply(_q).normalize(); f.vel.applyQuaternion(_q);
      }
    } else zone.classList.add("sg-hide");
    if (groundMsgT > 0) groundMsgT -= dt;
  };
  // Vuelo arcade: el suelo no derriba salvo de frente; los edificios, sí
  HOOK.crashFilter = (cause, f) => {
    if (cause === "building") { $("sg-down-why").textContent = t("back2"); return "crash"; }
    const { fwd } = f.axes();
    if (fwd.y < -0.65) { $("sg-down-why").textContent = t("back2"); return "crash"; }   // en picado contra el suelo
    const hdg = Math.atan2(fwd.x, -fwd.z), g = api.groundAt(f.pos.x, f.pos.z);
    const sp = Math.max(f.speed, f.P.vstall * 1.5);
    f.reset(_v.set(f.pos.x, g + f.P.gear + 6, f.pos.z), hdg, sp);
    f.vel.y = 9;
    _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.18); f.q.multiply(_q);   // morro un poco arriba
    if (groundMsgT <= 0) { api.flash(t("ground"), 1800); groundMsgT = 3; }
    return true;
  };
  HOOK.pause = paused => {
    if (pausedByUs) { pausedByUs = false; return; }   // pausa puesta por los resultados: su propia ventana
    if (paused && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    menu.showPause(paused);
  };
  // Rueda dentada y botón de controles de la barra de arriba (motor): abren los del juego, ya en pausa.
  // Antes abrían los ajustes de Wiki Flight, que quedaban por debajo de la pausa y repetían los del juego.
  HOOK.openSettings = () => menu.pauseSettings();
  HOOK.openControls = () => menu.pauseControls();
  HOOK.crash = cause => {
    if (cause === "shot") $("sg-down-why").textContent = t("shot");
    zone.classList.add("sg-hide"); down.classList.remove("sg-hide");
    S.crashT = combat.respawnDelay();   // según la dificultad
  };
  HOOK.respawnAt = () => {
    down.classList.add("sg-hide"); $("sg-down-why").textContent = t("back2");
    combat.resetPlayer(); setTimeout(() => arcade.respawn(), 0);
    return respawnPose();
  };
  // Reaparecer a 1,6 km de la torre, por encima de ella, mirándola
  function respawnPose() {
    const o = towers && towers[0], tx = o ? o.x : 0, tz = o ? o.z : 0, a = Math.random() * Math.PI * 2;
    const x = tx + Math.cos(a) * 1600, z = tz + Math.sin(a) * 1600;
    const y = Math.max(api.groundAt(x, z), o ? o.tw.root.position.y : 0) + 600;
    return { pos: new THREE.Vector3(x, y, z), hdg: Math.atan2(tx - x, -(tz - z)) };
  }
  function quit() {
    savePerf();   // también la partida abandonada: el registro sirve igual
    monName = null;
    down.classList.add("sg-hide"); zone.classList.add("sg-hide");
    training.stop(); combat.stop(); arcade.stop(); menu.closeOverlay();
    clearTowers();
    S.aqNoUp = false;
    if (api.keepLandmarks) api.keepLandmarks(false);
    if (arena) { arena.showGates(false); arena.root.removeFromParent(); }   // se queda hecha para la próxima partida
    turboT = 0;
    api.end();
    menu.show("home");
  }
  // Otra partida en el mismo sitio, sin volver a cargar el mapa: torres nuevas y la nave en el centro
  function restart() {
    combat.stop();
    const f = S.flight;
    if (f) { const r = respawnPose(); f.reset(r.pos, r.hdg, S.P.vmax * 0.6); S.crashT = 0; if (S.model) S.model.visible = true; }
    down.classList.add("sg-hide");
    begin();
    if (S.paused) { pausedByUs = true; api.pause(false); }
    recapture();
  }
}
