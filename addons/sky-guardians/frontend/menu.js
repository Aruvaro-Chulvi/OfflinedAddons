/* ═══════════════════════════════════════════════════════════════════════════
   🧭 Sky Guardians — menús: portada con escena 3D, preparar partida (hangar), ranking, logros, controles,
   ajustes, pausa y resultados. Botones grises y planos (Offlined): seleccionado = fondo suave + borde.
   ═══════════════════════════════════════════════════════════════════════════ */
import { createTower, TOWER_SCALE as TS } from "./tower.js";
import { LIVERIES } from "./planes.js";
import { WEAPONS } from "./combat.js";
import { logoSvg } from "./logo.js";
import { ACHIEVEMENTS, RANKS, rankFor, nextRank, daySeed, today } from "./stats.js";
import { bindings as B, ACTIONS, PAD_ACTIONS, KB_FIXED, setKey, setPad, resetBindings, keyName, padName } from "./controls.js";

const PLANE_INFO = {
  "sg-attack": { speed: 0.5, agility: 0.95, armor: 0.85, w1: "gun2", w2: "rockets" },
  "sg-fighter": { speed: 1, agility: 0.7, armor: 0.6, w1: "cannon", w2: "missiles" },
};
const LS_SET = "sg_settings";

export function createMenu(api, o) {
  const { THREE, S } = api, t = o.t, stats = o.stats;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const st = o.state;                        // sg_last: mapa, punto, nave, dificultad
  const settings = Object.assign({ invert: false, sens: 1, assist: "mid", cam: "chase", hud: "m" }, (() => { try { return JSON.parse(localStorage.getItem(LS_SET) || "{}"); } catch { return {}; } })());
  const saveSettings = () => { try { localStorage.setItem(LS_SET, JSON.stringify(settings)); } catch { } o.applySettings(settings); };

  // ── Estilos ──
  const css = document.createElement("style");
  css.textContent = `
  #sgm { position: fixed; inset: 0; z-index: 50; font: 15px/1.45 system-ui, "Segoe UI", sans-serif; color: #e9e9ea; background: #070b12; }
  #sgm.hide, .sgm-hide { display: none !important; }
  #sgm canvas.bg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  #sgm .side { position: absolute; left: 0; top: 0; bottom: 0; width: min(440px, 100vw); padding: 34px 32px; box-sizing: border-box; overflow-y: auto;
               background: linear-gradient(90deg, rgba(10,13,18,.94) 0%, rgba(10,13,18,.86) 75%, rgba(10,13,18,0) 100%); }
  #sgm .logo { font-size: 2.3rem; font-weight: 800; letter-spacing: .01em; line-height: 1.05; margin: 0; }
  #sgm .brand { display: flex; align-items: center; gap: 12px; } #sgm .brand .sg-logo { flex: none; filter: drop-shadow(0 2px 6px rgba(0,0,0,.5)); }
  #sgm .wsheet { background: #1c1d21; border: 1px solid #2b2c31; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
  #sgm .wsheet b { display: block; margin-bottom: 2px; } #sgm .wsheet p { margin: 0 0 6px; color: #9aa3ad; font-size: .85rem; }
  #sgm .wsheet table, #sgm .specs { width: 100%; font-size: .85rem; } #sgm .wsheet td:last-child, #sgm .specs td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  #sgm .livgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  #sgm .livgrid button { font: inherit; color: #e9e9ea; background: #1c1d21; border: 1px solid #2b2c31; border-radius: 10px; padding: 8px 6px; cursor: pointer; text-align: center; }
  #sgm .livgrid button.on { background: #2a2c31; border-color: #8a8f98; } #sgm .livgrid button.prev { border-style: dashed; border-color: #8a8f98; }
  #sgm .livgrid i { display: block; width: 34px; height: 34px; border-radius: 50%; margin: 0 auto 4px; } #sgm .livgrid small { display: block; color: #8f99a5; font-size: .72rem; }
  #sgm .tagline { font-size: .8rem; font-weight: 600; color: #8f99a5; letter-spacing: .18em; text-transform: uppercase; margin-top: 8px; }
  #sgm .pilot { display: flex; align-items: center; gap: 12px; margin: 22px 0 18px; padding: 12px 14px; background: rgba(34,35,39,.7); border: 1px solid #2b2c31; border-radius: 12px; }
  #sgm .badge { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; font-size: 1.3rem; background: #222327; border: 1px solid #3a3d44; flex: none; }
  #sgm .pilot b { display: block; } #sgm .pilot span { color: #9aa3ad; font-size: .85rem; }
  #sgm .bar { height: 4px; background: rgba(255,255,255,.1); border-radius: 2px; margin-top: 5px; } #sgm .bar i { display: block; height: 100%; background: #c9ced6; border-radius: 2px; }
  #sgm .nav button, #sgm .btn { display: block; width: 100%; text-align: left; font: inherit; font-size: 1.02rem; color: #e9e9ea; background: #1c1d21; border: 1px solid #2b2c31;
               border-radius: 10px; padding: 11px 16px; margin: 0 0 8px; cursor: pointer; }
  #sgm .nav button:hover, #sgm .btn:hover, #sgm .seg button:hover { border-color: #6b7280; }
  #sgm .nav button.main { font-weight: 700; font-size: 1.12rem; padding: 14px 16px; }
  #sgm h2 { margin: 0 0 14px; font-size: 1.35rem; } #sgm h3 { margin: 18px 0 8px; font-size: .78rem; color: #8f99a5; text-transform: uppercase; letter-spacing: .08em; }
  #sgm .back { background: none; border: 0; color: #9aa3ad; font: inherit; cursor: pointer; padding: 0; margin-bottom: 14px; }
  #sgm .back:hover { color: #e9e9ea; }
  #sgm select { width: 100%; font: inherit; color: #e9e9ea; background: #1c1d21; border: 1px solid #2b2c31; border-radius: 9px; padding: 8px 10px; }
  #sgm .seg { display: flex; gap: 6px; } #sgm .seg button { flex: 1; font: inherit; color: #e9e9ea; background: #1c1d21; border: 1px solid #2b2c31; border-radius: 9px; padding: 8px 6px; cursor: pointer; }
  #sgm .seg button.on, #sgm .card.on { background: #2a2c31; border-color: #8a8f98; }
  #sgm .seg button { min-width: 0; white-space: normal; text-overflow: clip; overflow-wrap: anywhere; hyphens: auto; line-height: 1.25; }   /* textos largos (alemán, ruso): parten la línea en vez de cortarse */
  #sgm .liv { display: flex; gap: 6px; flex-wrap: wrap; } #sgm .liv button { position: relative; width: 42px; height: 42px; border-radius: 10px; background: #1c1d21; border: 1px solid #2b2c31; cursor: pointer; padding: 0; display: grid; place-items: center; }
  #sgm .liv button.on { background: #2a2c31; border-color: #8a8f98; } #sgm .liv button:disabled { cursor: default; opacity: .45; }
  #sgm .liv i { width: 24px; height: 24px; border-radius: 50%; display: block; } #sgm .liv small { position: absolute; right: 1px; bottom: -1px; font-size: 11px; }
  #sgm .pt { color: #cfd3d8; font-size: .92rem; margin-top: 6px; }
  #sgm .card { background: #1c1d21; border: 1px solid #2b2c31; border-radius: 12px; padding: 10px 12px; cursor: pointer; margin-bottom: 8px; }
  #sgm .card b { display: block; margin-bottom: 4px; } #sgm .stat { display: grid; grid-template-columns: minmax(78px, max-content) 1fr; align-items: center; gap: 8px; font-size: .8rem; color: #9aa3ad; }
  #sgm .go { width: 100%; font: inherit; font-weight: 700; font-size: 1.1rem; color: #e9e9ea; background: #2a2c31; border: 1px solid #8a8f98; border-radius: 10px; padding: 13px; margin-top: 18px; cursor: pointer; }
  #sgm .go:disabled { opacity: .4; cursor: default; }
  #sgm table { width: 100%; border-collapse: collapse; font-size: .9rem; } #sgm td, #sgm th { padding: 5px 4px; text-align: left; } #sgm th { color: #8f99a5; font-weight: 600; font-size: .78rem; }
  #sgm tr.me td { color: #fff; font-weight: 600; } #sgm td.num { text-align: right; font-variant-numeric: tabular-nums; }
  #sgm .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; }
  #sgm .ach { display: grid; grid-template-columns: 1fr; gap: 6px; } #sgm .ach div { display: flex; gap: 10px; align-items: center; padding: 8px 10px; background: #1c1d21; border: 1px solid #2b2c31; border-radius: 10px; }
  #sgm .ach div.off { opacity: .45; } #sgm .ach i { font-style: normal; font-size: 1.3rem; width: 28px; text-align: center; } #sgm .ach small { display: block; color: #9aa3ad; }
  #sgm .keys td:first-child { color: #cfd3d8; white-space: nowrap; padding-right: 12px; } #sgm kbd { background: #222327; border: 1px solid #3a3d44; border-radius: 5px; padding: 0 6px; font: 600 .82rem system-ui; }
  #sgm .muted { color: #8f99a5; font-size: .85rem; }
  .kb { font: 600 .82rem system-ui; color: #e9e9ea; background: #222327; border: 1px solid #3a3d44; border-radius: 6px; padding: 3px 8px; cursor: pointer; min-width: 44px; }
  .kb:hover { border-color: #8a8f98; } .kb:disabled { opacity: .5; cursor: default; }
  table.ctl td { padding: 4px 4px; } #sgo table.ctl td:last-child { text-align: left; } #sgm .warn { color: #e0a85a; margin-top: 10px; }
  #sgm .ver { position: absolute; right: 16px; bottom: 12px; color: #5d6470; font-size: .75rem; }
  #sgm input[type=range] { width: 100%; }
  #sgo { position: fixed; inset: 0; z-index: 52; display: grid; place-items: center; background: rgba(6,9,13,.72); font: 15px/1.5 system-ui, sans-serif; color: #e9e9ea; }
  #sgo .box { background: #17181a; border: 1px solid #2b2c31; border-radius: 16px; padding: 24px 28px; width: min(470px, calc(100vw - 32px)); max-height: calc(100vh - 40px); overflow-y: auto; box-sizing: border-box; }
  #sgo h2 { margin: 0; font-size: 1.6rem; } #sgo .sub { color: #9aa3ad; margin: 2px 0 14px; }
  #sgo .big { font-size: 2.4rem; font-weight: 800; font-variant-numeric: tabular-nums; } #sgo .rec { display: inline-block; margin-left: 8px; padding: 2px 10px; border-radius: 20px; border: 1px solid #ffd23a; color: #ffd23a; font-size: .85rem; font-weight: 700; vertical-align: middle; }
  #sgo table { width: 100%; border-collapse: collapse; margin: 10px 0; } #sgo td { padding: 3px 0; vertical-align: top; } #sgo td:first-child { white-space: nowrap; padding-right: 16px; color: #cfd3d8; } #sgo td:last-child { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  #sgo .news div { padding: 6px 10px; background: #1c1d21; border: 1px solid #2b2c31; border-radius: 9px; margin-bottom: 6px; }
  #sgo .row { display: flex; gap: 8px; margin-top: 14px; } #sgo button { flex: 1; font: inherit; color: #e9e9ea; background: #222327; border: 1px solid #2b2c31; border-radius: 9px; padding: 10px; cursor: pointer; }
  #sgo button:hover { border-color: #6b7280; } #sgo button.pri { background: #2a2c31; border-color: #8a8f98; font-weight: 700; }`;
  document.head.appendChild(css);

  const root = document.createElement("div"); root.id = "sgm";
  root.innerHTML = `<canvas class="bg"></canvas><div class="side" id="sgm-side"></div><div class="ver">${esc(o.version)}</div>`;
  document.body.appendChild(root);
  const ov = document.createElement("div"); ov.id = "sgo"; ov.className = "sgm-hide"; document.body.appendChild(ov);
  const side = $("sgm-side");

  // ══ Escena 3D de la portada: la torre de noche y la nave elegida ══
  const scene3 = (() => {
    const canvas = root.querySelector("canvas.bg");
    let r = null; try { r = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return { start() { }, stop() { }, plane() { }, view() { } }; }
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x070b12); sc.fog = new THREE.Fog(0x070b12, 1500, 7000);
    const cam = new THREE.PerspectiveCamera(45, 1, 0.5, 8000);
    sc.add(new THREE.HemisphereLight(0x5b6f96, 0x101410, 0.55));
    const moon = new THREE.DirectionalLight(0xbfd0ff, 0.9); moon.position.set(-300, 400, 200); sc.add(moon);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x141a16, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; sc.add(ground);
    { const n = 1600, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.05, R = 3500; p.set([Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      sc.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false }))); }
    const tower = createTower(THREE, { seed: 7, scale: TS }); sc.add(tower.root);
    let plane = null, planeId = null, mode = "home", run = false, last = 0, ang = 0.6;
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
    let planeKey = null;
    function setPlane(id) {
      const P = api.AIRCRAFT.find(a => a.id === id); if (!P) return;
      const key = id + ":" + (P.livery || ""); if (key === planeKey) return; planeKey = key; planeId = id;
      if (plane) sc.remove(plane);
      plane = api.buildModel(P); plane.traverse(c => { if (c.name === "cockpit") c.visible = false; }); sc.add(plane);
    }
    function frame(now) {
      if (!run) return; requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * r.getPixelRatio())) {
        r.setSize(w, h, false); cam.aspect = w / Math.max(1, h);
        // el centro de la escena, a la derecha del panel del menú
        const shift = w > 700 ? Math.min(220, w * 0.2) : 0;
        if (shift) cam.setViewOffset(w, h, -shift, 0, w, h); else cam.clearViewOffset();
        cam.updateProjectionMatrix();
      }
      ang += dt * 0.06;
      const P = planeId && api.AIRCRAFT.find(a => a.id === planeId);
      if (mode === "hangar" && plane && P) {
        // la nave grande, girando sobre sí misma, con la torre detrás
        const L = Math.max(P.len, P.span);
        plane.position.set(420, 60, 420); plane.rotation.set(0, now / 4000, 0);
        const prop = plane.getObjectByName("blades"); if (prop) prop.parent.rotation.z += dt * 8;
        wantPos.set(420 + L * 1.25, 60 + L * 0.35, 420 + L * 1.25); wantLook.set(420 - L * 0.45, 60, 420 - L * 0.45);
      } else {
        // pasada lenta de la nave alrededor de la torre y cámara que gira
        if (plane) { const a = now / 9000, R = 520; plane.position.set(Math.cos(a) * R, 300 + Math.sin(a * 2) * 15, Math.sin(a) * R); plane.lookAt(Math.cos(a + 0.05) * R * 2 - plane.position.x, plane.position.y, Math.sin(a + 0.05) * R * 2 - plane.position.z); plane.rotateY(Math.PI); plane.rotateZ(0.35); }
        wantPos.set(Math.cos(ang) * 1000, 160, Math.sin(ang) * 1000); wantLook.set(0, 85 * TS, 0);
      }
      camPos.lerp(wantPos, 1 - Math.exp(-dt * 2.5)); camLook.lerp(wantLook, 1 - Math.exp(-dt * 2.5));
      cam.position.copy(camPos); cam.lookAt(camLook);
      const scale = r.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360));
      tower.update(dt, { night: true, light: 0.2, camPos: cam.position, scale });
      r.render(sc, cam);
    }
    camPos.set(1000, 160, 0); camLook.set(0, 85 * TS, 0);
    return {
      start() { if (!run) { run = true; last = performance.now(); requestAnimationFrame(frame); } },
      stop() { run = false; },
      plane: setPlane,
      view(m) { mode = m; },
    };
  })();

  // ══ Pantallas ══
  const PLANES = o.PLANES;
  function pilotCard() {
    const T = stats.totals(), rk = rankFor(T.bestWave), nx = nextRank(T.bestWave);
    const prog = nx ? Math.min(1, (T.bestWave - rk.wave) / (nx.wave - rk.wave)) : 1;
    const icons = { cadet: "🪖", pilot: "✈️", lieutenant: "🎖️", captain: "⭐", ace: "🏅", guardian: "🛡️" };
    return `<div class="pilot"><div class="badge">${icons[rk.id]}</div><div style="flex:1"><b>${esc(stats.user.name || t("pilotAnon"))} · ${t("rank_" + rk.id)}</b>
      <span>${t("bestWave", { n: T.bestWave })}${nx ? " · " + t("nextRank", { r: t("rank_" + nx.id), n: nx.wave }) : ""}</span><div class="bar"><i style="width:${prog * 100}%"></i></div></div></div>`;
  }
  const screens = {
    home() {
      scene3.view("home"); scene3.plane(PLANES[st.plane].id);
      side.innerHTML = `<div class="brand">${logoSvg(64)}<h1 class="logo">${esc(o.title)}</h1></div><div class="tagline">${t("tag")}</div>${pilotCard()}
        <div class="nav"><button class="main" data-go="play">${t("play")}</button><button data-go="hangar">${t("hangar")}</button><button data-go="training">${t("training")}</button>
        <button data-go="ranking">${t("ranking")}</button><button data-go="ach">${t("achievements")}</button>
        <button data-go="controls">${t("controls")}</button><button data-go="settings">${t("settings")}</button></div>`;
    },
    play() {
      const md = st.mode || "survival", daily = md === "daily", dp = daySeed() % PLANES.length;
      scene3.view("hangar"); scene3.plane(PLANES[daily ? dp : st.plane].id);
      const dTop = daily ? stats.top(null, false, "daily") : [], dMine = daily ? stats.best(null, "daily") : null;
      const rkI = Math.max(0, RANKS.findIndex(r => r.id === stats.rank().id));
      let liv = st.livery || "std"; if ((LIVERIES.find(L => L.id === liv) || LIVERIES[0]).rank > rkI) { liv = "std"; o.setLivery(liv); }
      side.innerHTML = `<button class="back" data-go="home">← ${t("back")}</button><h2>${t("prepare")}</h2>
        <h3>${t("mode")}</h3><div class="seg" id="sgm-mode">${["survival", "short", "daily"].map(m => `<button data-m="${m}" class="${md === m ? "on" : ""}">${t("m_" + m)}</button>`).join("")}</div>
        <div class="muted" style="margin-top:6px">${t("mh_" + md)}</div>
        ${daily ? `<div class="muted" style="margin-top:6px">${dTop.length ? t("dailyLeader", { n: esc(dTop[0].name || t("pilotAnon")), s: dTop[0].score.toLocaleString(api.LOCALE) }) : t("dailyNone")}${dMine ? " · " + t("dailyMine", { s: dMine.score.toLocaleString(api.LOCALE) }) : ""}</div>` : ""}
        <h3>${t("map")}</h3><select id="sgm-map"></select>
        <h3>${t("point")}</h3>${pointHtml()}
        <h3>${t("plane")}</h3>${daily ? `<div class="muted">${t("dailyPlane", { p: t(PLANES[dp].key) })}</div>` : `<div id="sgm-planes">${PLANES.map((p, i) => planeCard(p, i)).join("")}</div>`}
        <h3>${t("livery")}</h3><div class="liv" id="sgm-liv">${LIVERIES.map(L => { const lock = L.rank > rkI;
          return `<button data-l="${L.id}" class="${L.id === liv ? "on" : ""}" ${lock ? "disabled" : ""} title="${esc(lock ? t("livLock", { r: t("rank_" + RANKS[L.rank].id) }) : t("liv_" + L.id))}"><i style="background:linear-gradient(135deg, ${L.base} 0 58%, ${L.stripe} 58% 72%, ${L.belly} 72%)"></i>${lock ? "<small>🔒</small>" : ""}</button>`; }).join("")}</div>
        <div class="muted" style="margin-top:6px">${t("liv_" + liv)} · ${t("livHint")}</div>
        ${daily ? "" : `<h3>${t("wingH")}</h3><div class="seg" id="sgm-wing"><button data-w="0" class="${st.wing ? "" : "on"}">${t("wingOff")}</button><button data-w="1" class="${st.wing ? "on" : ""}">${t("wingOn")}</button></div>
        <div class="muted" style="margin-top:6px">${t("wingHint")}</div>`}
        ${daily ? "" : `<h3>${t("diff")}</h3><div class="seg" id="sgm-diff">${["easy", "normal", "hard"].map(d => `<button data-d="${d}" class="${st.diff === d ? "on" : ""}">${t("d_" + d)}</button>`).join("")}</div>
        <div class="muted" style="margin-top:6px">${t("dh_" + st.diff)}</div>`}
        <div class="warn sgm-hide" id="sgm-nomap">${t("noMap")}</div>
        <button class="go" id="sgm-go">${t("go")}</button>`;
      fillMaps();
      $("sgm-mode").onclick = e => { const b = e.target.closest("[data-m]"); if (b) { st.mode = b.dataset.m; o.save(); show("play"); } };
      $("sgm-liv").onclick = e => { const b = e.target.closest("[data-l]"); if (b && !b.disabled) { o.setLivery(b.dataset.l); show("play"); } };
      if ($("sgm-wing")) $("sgm-wing").onclick = e => { const b = e.target.closest("[data-w]"); if (b) { st.wing = b.dataset.w === "1"; o.save(); show("play"); } };
      if (!daily) {
        $("sgm-planes").onclick = e => { const c = e.target.closest("[data-i]"); if (c) { st.plane = +c.dataset.i; o.save(); show("play"); } };
        $("sgm-diff").onclick = e => { const b = e.target.closest("[data-d]"); if (b) { st.diff = b.dataset.d; o.save(); show("play"); } };
      }
      wirePoint();
      $("sgm-go").onclick = () => { if (!$("sgm-go").disabled) { hide(); o.onPlay(); } };
    },
    // Hangar: la nave girando, su ficha, las fichas de sus dos armas y las libreas (las bloqueadas, en vista previa)
    hangar() {
      const pi = screens._hp ?? st.plane, p = PLANES[pi], P = api.AIRCRAFT.find(a => a.id === p.id) || {}, Wp = WEAPONS[p.id], I = PLANE_INFO[p.id];
      const rkI = Math.max(0, RANKS.findIndex(r => r.id === stats.rank().id)), prev = screens._lp || null;
      o.previewLivery(prev);
      scene3.view("hangar"); scene3.plane(p.id);
      const n = (v, d = 0) => v.toLocaleString(api.LOCALE, { maximumFractionDigits: d, minimumFractionDigits: d });
      const row = (k, v) => `<tr><td>${t(k)}</td><td>${v}</td></tr>`;
      const G = Wp.gun, Sx = Wp.sec;
      const gunRows = row("w_rate", `${n(G.rate * G.muzzles.length)}/s`) + row("w_dmg", n(G.dmg, 1)) + row("w_burst", `${n(1 / G.heat / G.rate, 1)} s`) + row("w_range", `${n(G.speed * 1.8 / 1000, 1)} km`);
      const secRows = Sx.kind === "rockets"
        ? row("w_salvo", `×${Sx.salvo}`) + row("w_ammo", Sx.ammo) + row("w_dmg", `${Sx.dmg} · ${t("w_area", { m: Sx.splash })}`) + row("w_reload", `${n(Sx.reload, 1)} s`)
        : row("w_lock", `×${Sx.maxLock}`) + row("w_range", `${n(Sx.range / 1000, 1)} km`) + row("w_dmg", Sx.dmg) + row("w_reload", `${n(Sx.reload, 1)} s`);
      side.innerHTML = `<button class="back" data-go="home">← ${t("back")}</button><h2>${t("hangar")}</h2>
        <div class="seg" id="sgm-hp">${PLANES.map((x, i) => `<button data-i="${i}" class="${i === pi ? "on" : ""}">${t(x.key)}</button>`).join("")}</div>
        <h3>${t("hSpecs")}</h3><table class="specs">${row("sp_vmax", `${n(P.vmax * 3.6)} km/h`)}${row("sp_vmin", `${n(P.vstall * 3.6)} km/h`)}${row("sp_size", `${n(P.len, 1)} × ${n(P.span, 1)} m`)}
          ${row("sAgility", `${Math.round(I.agility * 100)} %`)}${row("sArmor", `${Math.round(I.armor * 100)} %`)}</table>
        <h3>${t("hWeapons")}</h3>
        <div class="wsheet"><b>${t(G.name)}</b><p>${t("wd_" + G.name)}</p><table>${gunRows}</table></div>
        <div class="wsheet"><b>${t(Sx.name)}</b><p>${t("wd_" + Sx.name)}</p><table>${secRows}</table></div>
        <h3>${t("livery")}</h3><div class="livgrid" id="sgm-hl">${LIVERIES.map(L => { const lock = L.rank > rkI, on = (prev || st.livery || "std") === L.id;
          return `<button data-l="${L.id}" class="${on ? (prev ? "prev" : "on") : ""}"><i style="background:linear-gradient(135deg, ${L.base} 0 58%, ${L.stripe} 58% 72%, ${L.belly} 72%)"></i>${t("liv_" + L.id)}
            <small>${lock ? "🔒 " + t("rank_" + RANKS[L.rank].id) : L.id === (st.livery || "std") ? t("livChosen") : t("livUse")}</small></button>`; }).join("")}</div>
        <div class="muted" style="margin-top:6px">${prev ? t("livPreview", { l: t("liv_" + prev), r: t("rank_" + RANKS[LIVERIES.find(L => L.id === prev).rank].id) }) : t("livHangarHint")}</div>`;
      $("sgm-hp").onclick = e => { const b = e.target.closest("[data-i]"); if (b) { screens._hp = +b.dataset.i; show("hangar"); } };
      $("sgm-hl").onclick = e => {
        const b = e.target.closest("[data-l]"); if (!b) return;
        const L = LIVERIES.find(x => x.id === b.dataset.l);
        if (L.rank > rkI) screens._lp = L.id; else { screens._lp = null; o.setLivery(L.id); }
        show("hangar");
      };
    },
    training() {
      scene3.view("home");
      side.innerHTML = `<button class="back" data-go="home">← ${t("back")}</button><h2>${t("training")}</h2>
        <p class="muted">${t("trainingDesc")}</p><h3>${t("map")}</h3><select id="sgm-map"></select>
        <h3>${t("point")}</h3>${pointHtml()}
        <div class="warn sgm-hide" id="sgm-nomap">${t("noMap")}</div><button class="go" id="sgm-go">${t("startTraining")}</button>`;
      fillMaps(); wirePoint();
      $("sgm-go").onclick = () => { if (!$("sgm-go").disabled) { hide(); o.onTraining(); } };
    },
    ranking() {
      scene3.view("home");
      const d = screens._rd || st.diff, mine = !!screens._rm, rmo = screens._rmo || st.mode || "survival";
      const rows = stats.top(d, mine, rmo), me = stats.user.id;
      const pn = id => t((PLANES.find(p => p.id === id) || {}).key || "");
      side.innerHTML = `<button class="back" data-go="home">← ${t("back")}</button><h2>${t("ranking")}</h2>
        <div class="seg" id="sgm-rmo">${["survival", "short", "daily"].map(x => `<button data-m="${x}" class="${x === rmo ? "on" : ""}">${t("m_" + x)}</button>`).join("")}</div>
        ${rmo === "daily" ? `<div class="muted" style="margin-top:6px">${t("dailyToday", { d: new Date().toLocaleDateString(api.LOCALE) })}</div><div id="sgm-rd"></div>`
          : `<div class="seg" id="sgm-rd" style="margin-top:6px">${["easy", "normal", "hard"].map(x => `<button data-d="${x}" class="${x === d ? "on" : ""}">${t("d_" + x)}</button>`).join("")}</div>`}
        <div class="seg" id="sgm-rm" style="margin-top:6px"><button data-m="0" class="${mine ? "" : "on"}">${t("rankAll")}</button><button data-m="1" class="${mine ? "on" : ""}">${t("rankMine")}</button></div>
        <table style="margin-top:12px"><tr><th>#</th><th>${t("pilotCol")}</th><th class="num">${t("waveCol")}</th><th class="num">${t("scoreCol")}</th></tr>
        ${rows.map((r, i) => `<tr class="${r.uid === me ? "me" : ""}" title="${esc(pn(r.plane))} · ${new Date(r.date).toLocaleDateString(api.LOCALE)}"><td>${i + 1}</td><td>${esc(r.name || t("pilotAnon"))}${r.wing ? ` <span title="${esc(t("wingOn"))}">🤝</span>` : ""}</td><td class="num">${r.wave}</td><td class="num">${r.score.toLocaleString(api.LOCALE)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">${t("noRuns")}</td></tr>`}</table>
        <h3>${t("history")}</h3><table>${stats.history(10).map(r => `<tr><td class="muted">${new Date(r.date).toLocaleDateString(api.LOCALE)}</td><td>${t("m_" + (r.mode || "survival"))} · ${t("d_" + r.diff)}${r.won ? " 🏁" : ""}</td><td class="num">${t("waveN", { n: r.wave })}</td><td class="num">${r.score.toLocaleString(api.LOCALE)}</td></tr>`).join("") || `<tr><td class="muted">${t("noRuns")}</td></tr>`}</table>`;
      $("sgm-rd").onclick = e => { const b = e.target.closest("[data-d]"); if (b) { screens._rd = b.dataset.d; show("ranking"); } };
      $("sgm-rmo").onclick = e => { const b = e.target.closest("[data-m]"); if (b) { screens._rmo = b.dataset.m; show("ranking"); } };
      $("sgm-rm").onclick = e => { const b = e.target.closest("[data-m]"); if (b) { screens._rm = b.dataset.m === "1"; show("ranking"); } };
    },
    ach() {
      scene3.view("home");
      const A = stats.achievements(), n = ACHIEVEMENTS.filter(a => A[a.id]).length;
      side.innerHTML = `<button class="back" data-go="home">← ${t("back")}</button><h2>${t("achievements")} <span class="muted">${n}/${ACHIEVEMENTS.length}</span></h2>
        <div class="ach">${ACHIEVEMENTS.map(a => `<div class="${A[a.id] ? "" : "off"}"><i>${A[a.id] ? a.icon : "🔒"}</i><span><b>${t("a_" + a.id)}</b><small>${t("ad_" + a.id)}${A[a.id] ? " · " + new Date(A[a.id]).toLocaleDateString(api.LOCALE) : ""}</small></span></div>`).join("")}</div>
        <h3>${t("ranks")}</h3><table>${RANKS.map(r => `<tr><td>${t("rank_" + r.id)}</td><td class="num muted">${t("fromWave", { n: r.wave })}</td></tr>`).join("")}</table>`;
    },
    controls() { scene3.view("home"); side.innerHTML = `<button class="back" data-go="${screens._back || "home"}">← ${t("back")}</button><div id="sgm-ctl"></div>`; controlsEditor($("sgm-ctl")); },
    settings() {
      scene3.view("home");
      side.innerHTML = `<button class="back" data-go="${screens._back || "home"}">← ${t("back")}</button><h2>${t("settings")}</h2>
        <h3>${t("setAssist")}</h3><div class="seg" id="sgm-as">${["low", "mid", "high"].map(x => `<button data-v="${x}" class="${settings.assist === x ? "on" : ""}">${t("lv_" + x)}</button>`).join("")}</div>
        <div class="muted" style="margin-top:6px">${t("setAssistH")}</div>
        <h3>${t("setInvert")}</h3><div class="seg" id="sgm-inv"><button data-v="0" class="${settings.invert ? "" : "on"}">${t("invNo")}</button><button data-v="1" class="${settings.invert ? "on" : ""}">${t("invYes")}</button></div>
        <h3>${t("setSens")}</h3><input type="range" id="sgm-sens" min="0.4" max="2" step="0.1" value="${settings.sens}"><div class="muted" id="sgm-sensv">×${settings.sens}</div>
        <h3>${t("volMusic")}</h3><input type="range" id="sgm-vm" min="0" max="1" step="0.05" value="${o.sound ? o.sound.volume.music : 0.5}">
        <h3>${t("volSfx")}</h3><input type="range" id="sgm-vs" min="0" max="1" step="0.05" value="${o.sound ? o.sound.volume.sfx : 0.8}">
        <h3>${t("setHud")}</h3><div class="seg" id="sgm-hud">${["s", "m", "l"].map(x => `<button data-v="${x}" class="${settings.hud === x ? "on" : ""}">${t("hud" + x.toUpperCase())}</button>`).join("")}</div>
        <h3>${t("setCam")}</h3><div class="seg" id="sgm-cam"><button data-v="chase" class="${settings.cam === "chase" ? "on" : ""}">${t("camNear")}</button><button data-v="far" class="${settings.cam === "far" ? "on" : ""}">${t("camFar")}</button></div>`;
      const seg = (id, key, conv = v => v) => { $(id).onclick = e => { const b = e.target.closest("[data-v]"); if (b) { settings[key] = conv(b.dataset.v); saveSettings(); show("settings"); } }; };
      seg("sgm-as", "assist"); seg("sgm-inv", "invert", v => v === "1"); seg("sgm-cam", "cam"); seg("sgm-hud", "hud");
      if (o.sound) { $("sgm-vm").oninput = e => o.sound.setVolume("music", +e.target.value); $("sgm-vs").oninput = e => { o.sound.setVolume("sfx", +e.target.value); o.sound.play("hit"); }; }
      $("sgm-sens").oninput = e => { settings.sens = +e.target.value; $("sgm-sensv").textContent = "×" + settings.sens; saveSettings(); };
    },
  };
  function planeCard(p, i) {
    const I = PLANE_INFO[p.id], bar = v => `<div class="bar"><i style="width:${v * 100}%"></i></div>`;
    return `<div class="card ${st.plane === i ? "on" : ""}" data-i="${i}"><b>${t(p.key)}</b>
      <div class="stat"><span>${t("sSpeed")}</span>${bar(I.speed)}</div><div class="stat"><span>${t("sAgility")}</span>${bar(I.agility)}</div>
      <div class="stat"><span>${t("sArmor")}</span>${bar(I.armor)}</div><div class="muted" style="margin-top:4px">${t(I.w1)} · ${t(I.w2)}</div></div>`;
  }
  function controlsHtml() {
    const K = (...k) => k.map(x => `<kbd>${x}</kbd>`).join(" ");
    const row = (k, a) => `<tr><td>${k}</td><td>${t(a)}</td></tr>`;
    return `<h2>${t("controls")}</h2><h3>🎮 ${t("ctlPad")}</h3><table class="keys">
      ${row(t("kLeftStick"), "cFly")}${row(t("kRightStick"), "cLook")}${row(K("RT"), "cW1")}${row(K("LT"), "cW2")}${row(K("RB") + " / " + K("LB"), "cSpeed")}
      ${row(K("Y"), "cTarget")}${row(K("↑"), "cCam")}${row(K("Start"), "cPause")}</table>
      <h3>⌨️ ${t("ctlKb")}</h3><table class="keys">
      ${row(t("kMouse"), "cMouseAim")}${row(t("kClickL") + " / " + t("kClickR"), "cW12")}${row(K("W") + " / " + K("S"), "cSpeed")}
      ${row(K("Tab") + " " + K("E"), "cTarget")}${row(K("↑") + K("↓") + K("←") + K("→"), "cFlyKeys")}${row(K("Space") + " / " + K("V"), "cW12")}${row(K("C"), "cCam")}${row(K("Esc"), "cPause")}</table>`;
  }

  // ── Punto: elegir en el mapa, al azar o uno reciente; aviso si está en plena ciudad ──
  function pointHtml() {
    const rec = (st.recent || []).slice(0, 5);
    return `<div class="seg"><button id="sgm-pick">${t("pick")}</button><button id="sgm-rand">${t("randomSpot")}</button></div>
      <div class="pt" id="sgm-pt"></div><div class="warn sgm-hide" id="sgm-urban" style="font-size:.85rem">${t("urbanWarn")}</div>
      ${rec.length ? `<div class="muted" style="margin-top:8px">${t("recent")}</div><div class="seg" id="sgm-rec" style="flex-wrap:wrap">${rec.map((p, i) => `<button data-r="${i}" style="flex:0 1 auto;font-size:.82rem">${esc(p.name)}</button>`).join("")}</div>` : ""}`;
  }
  function wirePoint() {
    $("sgm-pick").onclick = pick;
    $("sgm-rand").onclick = randomSpot;
    if ($("sgm-rec")) $("sgm-rec").onclick = e => { const b = e.target.closest("[data-r]"); if (b) { st.point = { ...st.recent[+b.dataset.r] }; o.save(); show(cur); } };
    urbanCheck();
  }
  const geo = (lat, lon, d, limit) => fetch(`/api/wiki-geo?types=city&lang=${api.LANG}&min_lon=${lon - d}&max_lon=${lon + d}&min_lat=${lat - d}&max_lat=${lat + d}&zoom=12&limit=${limit}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  async function urbanCheck() {
    const p = st.point, el = $("sgm-urban"); if (!p || !el) return;
    if (p.urban === undefined) { const f = await geo(p.lat, p.lon, 0.012, 5); p.urban = !!(f && f.features && f.features.length); o.save(); }
    if ($("sgm-urban")) $("sgm-urban").classList.toggle("sgm-hide", !p.urban);
  }
  async function randomSpot() {
    const list = await api.maps(), m = list.find(x => x.url === st.map) || list[0]; if (!m) return;
    const b = m.bounds || [-10, 35, 5, 44];
    const cLat = (b[1] + b[3]) / 2, cLon = (b[0] + b[2]) / 2, dd = Math.min(3, Math.max(b[2] - b[0], b[3] - b[1]) / 2);
    const f = await geo(cLat, cLon, dd, 200), towns = ((f && f.features) || []).filter(x => { const [lo, la] = x.geometry.coordinates; return lo > b[0] && lo < b[2] && la > b[1] && la < b[3]; });
    let lat, lon, name;
    if (towns.length) {   // a las afueras de un pueblo o ciudad al azar del mapa (1,5–3 km)
      const c = towns[(Math.random() * towns.length) | 0], [lo, la] = c.geometry.coordinates, a = Math.random() * Math.PI * 2, r = (1.5 + Math.random() * 1.5) / 111;
      lat = la + Math.sin(a) * r; lon = lo + Math.cos(a) * r / Math.cos(la * Math.PI / 180); name = c.properties.title;
    } else { lat = b[1] + Math.random() * (b[3] - b[1]); lon = b[0] + Math.random() * (b[2] - b[0]); name = `${lat.toFixed(3)}, ${lon.toFixed(3)}`; }
    st.point = { lat, lon, name }; st.map = m.url; o.save(); show(cur);
  }
  // ── Editor de controles: una fila por acción, con su tecla y su botón del mando ──
  function controlsEditor(box) {
    const row = a => `<tr><td>${t("act_" + a)}</td>
      <td><button class="kb" data-k="${a}" ${KB_FIXED[a] ? "disabled" : ""}>${B.kb[a].map(c => esc(keyName(c, t))).join(" · ")}</button></td>
      <td>${PAD_ACTIONS.includes(a) ? `<button class="kb" data-p="${a}">${padName(B.pad[a])}</button>` : `<span class="muted">${a === "up" || a === "down" ? t("stickL") : a === "left" || a === "right" ? t("stickL") : ""}</span>`}</td></tr>`;
    box.innerHTML = `<h2>${t("controls")}</h2><table class="keys ctl"><tr><th></th><th>⌨️ ${t("colKb")}</th><th>🎮 ${t("colPad")}</th></tr>${ACTIONS.map(row).join("")}</table>
      <p class="muted">🖱 ${t("mouseRow")}<br>🎮 ${t("stickRow")}</p><div id="sgm-ctlmsg" class="warn" style="min-height:1.3em"></div>
      <button class="btn" id="sgm-ctlreset">${t("resetCtl")}</button>`;
    const msg = box.querySelector("#sgm-ctlmsg");
    box.querySelector("#sgm-ctlreset").onclick = () => { resetBindings(); controlsEditor(box); };
    box.querySelectorAll("button[data-k]").forEach(b => b.onclick = () => {
      msg.textContent = t("pressKey");
      const h = e => { e.preventDefault(); e.stopPropagation(); removeEventListener("keydown", h, true); if (e.code !== "Escape") setKey(b.dataset.k, e.code); controlsEditor(box); };
      addEventListener("keydown", h, true);
    });
    box.querySelectorAll("button[data-p]").forEach(b => b.onclick = () => {
      msg.textContent = t("pressPad");
      const gp0 = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null;
      const held = new Set(gp0 ? gp0.buttons.map((x, i) => (x.pressed ? i : -1)).filter(i => i >= 0) : []);
      const t0 = performance.now();
      (function poll() {
        const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null;
        if (gp) { const i = gp.buttons.findIndex((x, k) => x.pressed && !held.has(k)); if (i >= 0) { setPad(b.dataset.p, i); controlsEditor(box); return; } gp.buttons.forEach((x, k) => { if (!x.pressed) held.delete(k); }); }
        if (performance.now() - t0 < 8000) requestAnimationFrame(poll); else controlsEditor(box);
      })();
    });
  }
  // ── Gráfica de la vida de la torre (resultados) ──
  function drawGraph(cv, r) {
    const g = cv.getContext("2d"), W = cv.width, H = cv.height, L = r.hpLog, tMax = Math.max(1, L[L.length - 1][0]);
    const X = s => 10 + (W - 20) * s / tMax, Y = h => H - 14 - (H - 28) * h / 100;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 2;
    for (const h of [0, 50, 100]) { g.beginPath(); g.moveTo(10, Y(h)); g.lineTo(W - 10, Y(h)); g.stroke(); }
    g.fillStyle = "rgba(200,210,220,.5)"; g.font = "600 18px system-ui";
    (r.waveTimes || []).forEach((s, i) => { const x = X(s); g.fillRect(x, 6, 2, H - 20); if (i % Math.ceil((r.waveTimes.length || 1) / 10) === 0) g.fillText(String(i + 1), x + 4, 22); });
    const gr = g.createLinearGradient(0, Y(100), 0, Y(0)); gr.addColorStop(0, "#7ee08a"); gr.addColorStop(0.6, "#ffb020"); gr.addColorStop(1, "#ff5040");
    g.strokeStyle = gr; g.lineWidth = 5; g.beginPath(); L.forEach(([s, h], i) => (i ? g.lineTo(X(s), Y(h)) : g.moveTo(X(s), Y(h)))); g.stroke();
  }

  // Mapas y punto
  function fillMaps() {
    const sel = $("sgm-map");
    api.maps().then(list => {
      sel.innerHTML = list.map(m => `<option value="${esc(m.url)}">${esc(m.name)}</option>`).join("");
      if (!list.length) $("sgm-nomap").classList.remove("sgm-hide");
      if (st.map && list.some(m => m.url === st.map)) sel.value = st.map; else if (list.length) { st.map = sel.value; o.save(); }
      syncGo(list);
      sel.onchange = () => { st.map = sel.value; o.save(); syncGo(list); };
    });
  }
  function syncGo(list) {
    const m = list.find(x => x.url === st.map), p = st.point, ok = !!(m && p && (!m.bounds || (p.lon >= m.bounds[0] && p.lon <= m.bounds[2] && p.lat >= m.bounds[1] && p.lat <= m.bounds[3])));
    if ($("sgm-go")) $("sgm-go").disabled = !ok;
    if ($("sgm-pt")) $("sgm-pt").textContent = ok ? p.name : t("noPoint");
  }
  async function pick() {
    root.classList.add("hide"); scene3.stop();
    const p = await api.pickPoint(st.map, o.overlay, { title: t("pickTitle"), ok: t("pickOk") });
    root.classList.remove("hide"); scene3.start();
    if (p) { st.point = { lat: p.lat, lon: p.lon, name: p.name }; o.save(); }
    show(cur);
  }

  // ══ Navegación ══
  let cur = "home";
  function show(name) {
    if (cur === "hangar" && name !== "hangar") { screens._lp = null; screens._hp = null; o.previewLivery(null); }
    cur = name; root.classList.remove("hide"); scene3.start(); screens[name]();
  }
  function hide() { root.classList.add("hide"); scene3.stop(); }
  side.addEventListener("click", e => {
    if (e.target.closest("button")) o.sound && o.sound.play("click");
    const b = e.target.closest("[data-go]"); if (!b) return;
    if (b.dataset.go === "play" && firstTime()) { offerTraining(); return; }
    show(b.dataset.go);
  });
  function firstTime() {
    const T = stats.totals(); let asked = false; try { asked = localStorage.getItem("sg_trainAsked") === "1"; } catch { }
    return !T.trained && !T.games && !asked;
  }
  function offerTraining() {
    try { localStorage.setItem("sg_trainAsked", "1"); } catch { }
    overlay(`<h2>🎓 ${t("firstTitle")}</h2><div class="sub">${t("firstBody")}</div><div class="row"><button class="pri" id="sgo-ft">${t("firstTrain")}</button><button id="sgo-fp">${t("firstPlay")}</button></div>`);
    $("sgo-ft").onclick = () => { closeOverlay(); show("training"); };
    $("sgo-fp").onclick = () => { closeOverlay(); show("play"); };
  }

  // ══ Pausa y resultados (encima del juego) ══
  function overlay(html) { ov.innerHTML = `<div class="box">${html}</div>`; ov.classList.remove("sgm-hide"); }
  function closeOverlay() { ov.classList.add("sgm-hide"); }
  function showPause(on) {
    if (!on) { closeOverlay(); return; }
    overlay(`<h2>${t("paused")}</h2><div class="sub">${esc(o.title)}</div>
      <div class="row" style="flex-direction:column"><button class="pri" id="sgo-res">${t("resume")}</button><button id="sgo-ctl">${t("controls")}</button>
      <button id="sgo-set">${t("settings")}</button><button id="sgo-quit">${t("quit")}</button></div>`);
    $("sgo-res").onclick = () => o.onResume();
    $("sgo-quit").onclick = () => {
      overlay(`<h2>${t("quitConfirm")}</h2><div class="sub">${t("quitConfirmSub")}</div><div class="row"><button id="sgo-qy">${t("quitYes")}</button><button class="pri" id="sgo-qn">${t("quitNo")}</button></div>`);
      $("sgo-qy").onclick = () => { closeOverlay(); o.onQuit(); }; $("sgo-qn").onclick = () => showPause(true);
    };
    $("sgo-ctl").onclick = () => { overlay(`<div id="sgo-ctl-ed"></div><div class="row"><button class="pri" id="sgo-b">${t("back")}</button></div>`); controlsEditor($("sgo-ctl-ed")); $("sgo-b").onclick = () => showPause(true); };
    $("sgo-set").onclick = () => { const inv = settings.invert; overlay(`<h2>${t("settings")}</h2>
      <p>${t("setAssist")}</p><div class="row" id="sgo-as">${["low", "mid", "high"].map(x => `<button data-v="${x}" class="${settings.assist === x ? "pri" : ""}">${t("lv_" + x)}</button>`).join("")}</div>
      <p>${t("setInvert")}</p><div class="row" id="sgo-inv"><button data-v="0" class="${inv ? "" : "pri"}">${t("invNo")}</button><button data-v="1" class="${inv ? "pri" : ""}">${t("invYes")}</button></div>
      <div class="row"><button id="sgo-b">${t("back")}</button></div>`);
      $("sgo-as").onclick = e => { const b = e.target.closest("[data-v]"); if (b) { settings.assist = b.dataset.v; saveSettings(); showPause(true); } };
      $("sgo-inv").onclick = e => { const b = e.target.closest("[data-v]"); if (b) { settings.invert = b.dataset.v === "1"; saveSettings(); showPause(true); } };
      $("sgo-b").onclick = () => showPause(true); };
  }
  function showResults(r, res, training) {
    const pn = t((PLANES.find(p => p.id === r.plane) || {}).key || "");
    const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    const kinds = Object.entries(r.killsBy).filter(([k]) => k !== "dummy").map(([k, n]) => `${t("k_" + k)}: ${n}`).join(" · ");
    const news = [
      res.rankUp ? `<div>🎖️ ${t("rankUp", { r: t("rank_" + res.rankUp.id) })}</div>` : "",
      res.place ? `<div>🏆 ${t("placeIn", { n: res.place, d: r.mode === "daily" ? t("rankDaily") : `${t("m_" + (r.mode || "survival"))} · ${t("d_" + r.diff)}` })}</div>` : "",
      ...res.newAch.map(id => { const a = ACHIEVEMENTS.find(x => x.id === id); return `<div>${a.icon} ${t("newAch")}: <b>${t("a_" + id)}</b></div>`; }),
    ].join("");
    overlay(`<h2>${r.won ? "🏁 " + t("victoryTitle") : t("overTitle")}</h2><div class="sub">${r.won ? t("victory") : t("gameOver")} · ${t("m_" + (r.mode || "survival"))} · ${t("d_" + r.diff)} · ${esc(pn)}</div>
      <div><span class="big">${r.score.toLocaleString(api.LOCALE)}</span>${res.record ? `<span class="rec">${t("newRecord")}</span>` : ""}</div>
      <div class="muted">${res.prevBest && !res.record ? t("yourBestWas", { s: res.prevBest.score.toLocaleString(api.LOCALE) }) : ""}</div>
      <table><tr><td>${t("overWave")}</td><td>${r.wave}</td></tr><tr><td>${t("overKills")}</td><td>${r.kills}</td></tr><tr><td>${t("overTime")}</td><td>${fmt(r.time)}</td></tr>
      <tr><td>${t("overAcc")}</td><td>${Math.round(r.accuracy * 100)} %</td></tr><tr><td>${t("overStreak")}</td><td>×${Math.max(1, r.bestStreak)}</td></tr><tr><td>${t("overKits")}</td><td>${r.kits}</td></tr><tr><td>${t("overSaves")}</td><td>${r.saves || 0}</td></tr><tr><td>${t("overAA")}</td><td>${r.aaKills || 0}</td></tr>${r.wing ? `<tr><td>${t("overWing")}</td><td>${r.wingKills || 0}</td></tr>` : ""}
      ${r.towerLost.length > 1 ? `<tr><td>${t("towersFell")}</td><td>${r.towerLost.map(x => `T${x.n} (${t("waveN", { n: x.wave })})`).join(", ")}</td></tr>` : ""}</table>
      <div class="muted" style="margin-bottom:10px">${kinds}</div>
      ${r.hpLog && r.hpLog.length > 2 ? `<div class="muted">${t("graphTitle")}</div><canvas id="sgo-graph" width="820" height="200" style="width:100%;height:100px;margin:4px 0 10px"></canvas>` : ""}
      ${res.prevBest && !res.record ? `<div class="muted" style="margin-bottom:8px">${t("bestCmp", { w: res.prevBest.wave, s: res.prevBest.score.toLocaleString(api.LOCALE), d: fmt(res.prevBest.time || 0) })}</div>` : ""}
      <div class="news">${news}</div>
      <div class="row"><button class="pri" id="sgo-again">${t("again")}</button><button id="sgo-rank">${t("ranking")}</button><button id="sgo-menu">${t("menu")}</button></div>`);
    if ($("sgo-graph")) drawGraph($("sgo-graph"), r);
    $("sgo-again").onclick = () => { closeOverlay(); o.onAgain(); };
    $("sgo-rank").onclick = () => { closeOverlay(); o.onQuit(); screens._rd = r.diff; screens._rmo = r.mode || "survival"; show("ranking"); };
    $("sgo-menu").onclick = () => { closeOverlay(); o.onQuit(); };
  }
  function showTrainingDone(newAch) {
    overlay(`<h2>🎓 ${t("trainDone")}</h2><div class="sub">${t("trainDoneSub")}</div>
      <div class="news">${newAch.map(id => { const a = ACHIEVEMENTS.find(x => x.id === id); return `<div>${a.icon} ${t("newAch")}: <b>${t("a_" + id)}</b></div>`; }).join("")}</div>
      <div class="row"><button class="pri" id="sgo-play">${t("play")}</button><button id="sgo-menu">${t("menu")}</button></div>`);
    $("sgo-play").onclick = () => { closeOverlay(); o.onQuit(); show("play"); };
    $("sgo-menu").onclick = () => { closeOverlay(); o.onQuit(); };
  }

  o.applySettings(settings);
  return { show, hide, showPause, showResults, showTrainingDone, closeOverlay, settings, get current() { return cur; } };
}
