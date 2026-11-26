/* ═══════════════════════════════════════════════════════════════════════════
   🧭 Arcade Flow Sky Defender — menús: portada con escena 3D, preparar partida (hangar), ranking, logros, controles,
   ajustes, pausa y resultados. Botones grises y planos (Offlined): seleccionado = fondo suave + borde.
   Todo se maneja también con mando y teclado (ver «Navegación con mando y teclado», al final).
   ═══════════════════════════════════════════════════════════════════════════ */
import { createMenuScene } from "./menuscene.js";
import { LIVERIES } from "./planes.js";
import { WEAPONS, PERKS } from "./combat.js";
import { logoSvg } from "./logo.js";
import { ACHIEVEMENTS, RANKS, rankFor, nextRank, daySeed, today } from "./stats.js";
import { bindings as B, ACTIONS, PAD_ACTIONS, KB_FIXED, setKey, setPad, resetBindings, keyName, padName, firstPad } from "./controls.js";

const PLANE_INFO = {
  "sg-attack": { speed: 0.5, agility: 0.95, armor: 0.85, w1: "gun2", w2: "rockets" },
  "sg-fighter": { speed: 1, agility: 0.7, armor: 0.6, w1: "cannon", w2: "missiles" },
};
const LS_SET = "sg_settings";
const PERK_ICON = {}; for (const k in PERKS) PERK_ICON[k] = PERKS[k].icon;

export function createMenu(api, o) {
  const { THREE, S } = api, t = o.t, stats = o.stats;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const st = o.state;                        // sg_last: mapa, punto, nave, dificultad
  // Gráficos por defecto: en una gráfica integrada (Intel, AMD «Graphics»/«Custom GPU», Apple…) se empieza en Rendimiento
  const integrated = (() => { try { const gl = api.renderer.getContext(), e = gl.getExtension("WEBGL_debug_renderer_info"); const n = e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : "";
    return /Intel|UHD|Iris|Custom GPU|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d+ Graphics|Apple|Mali|Adreno|PowerVR|llvmpipe|SwiftShader/i.test(n) && !/RTX|GTX|RX \d{3,4}|Arc A/i.test(n); } catch { return false; } })();
  const settings = Object.assign({ invert: false, sens: 1, assist: "mid", cam: "chase", hud: "m", calm: false, gfx: integrated ? "perf" : "bal" }, (() => { try { return JSON.parse(localStorage.getItem(LS_SET) || "{}"); } catch { return {}; } })());
  const saveSettings = () => { try { localStorage.setItem(LS_SET, JSON.stringify(settings)); } catch { } o.applySettings(settings); };

  // ── Estilos ──
  const css = document.createElement("style");
  css.textContent = `
  #sgm { position: fixed; inset: 0; z-index: 50; font: 15px/1.45 system-ui, "Segoe UI", sans-serif; color: #e9e9ea; background: #070b12; }
  #sgm.hide, .sgm-hide { display: none !important; }
  #sgm canvas.bg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  #sgm .side { position: absolute; z-index: 2; left: 0; top: 0; bottom: 0; width: min(440px, 100vw); padding: 34px 32px; box-sizing: border-box; overflow-y: auto;
               background: linear-gradient(90deg, rgba(9,8,16,.92) 0%, rgba(9,8,16,.80) 72%, rgba(9,8,16,0) 100%); animation: sgmIn .5s ease-out both; }
  #sgm .vig { position: absolute; inset: 0; z-index: 1; pointer-events: none;
               background: repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0 1px, rgba(0,0,0,0) 1px 3px),   /* líneas de barrido CRT, muy suaves */
                           radial-gradient(ellipse 85% 75% at 62% 45%, rgba(0,0,0,0) 55%, rgba(4,3,10,.55) 100%),
                           linear-gradient(0deg, rgba(4,3,10,.45), rgba(4,3,10,0) 22%); }
  #sgm canvas.bg { animation: sgmFade 1.2s ease-out both; }
  @keyframes sgmFade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sgmIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
  /* Título de portada estilo arcade de los 80: «ARCADE FLOW» cromado (cielo → línea de horizonte → oro y
     magenta) con contorno y sombra dura escalonada, y «SKY DEFENDER» en neón rosa entre dos franjas. */
  #sgm .wordmark { display: block; margin: 2px 0 0; text-transform: uppercase; }
  #sgm .wordmark .w-main { display: block; font: 900 italic 3.45rem/.86 "Arial Black", "Segoe UI Black", Impact, system-ui, sans-serif;
               letter-spacing: -.035em; transform: skewX(-7deg); transform-origin: left bottom; padding: 0 .1em 0 .02em;
               background: linear-gradient(180deg, #f2fbff 0%, #bfe6ff 22%, #ffffff 40%, #6aa8ff 49%, #1a2160 50.5%, #3b2f8f 54%, #ffd77a 60%, #ff9c3d 76%, #ff4f8b 100%);
               -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-stroke: 1.4px rgba(255,255,255,.55);
               filter: drop-shadow(2px 2px 0 #7a1d6e) drop-shadow(2px 2px 0 #3a0d45) drop-shadow(0 0 18px rgba(255,79,163,.35)); }
  #sgm .wordmark .w-main + .w-main { margin-top: -.02em; }
  #sgm .wordmark .w-sub { display: flex; align-items: center; gap: 10px; margin: 12px 0 0 4px; font: 800 italic 1.12rem/1 system-ui, "Segoe UI", sans-serif;
               letter-spacing: .32em; color: #ffd9f2; text-shadow: 0 0 4px #ff5fd2, 0 0 12px #ff2fb4, 0 0 26px rgba(255,47,180,.55); white-space: nowrap; }
  #sgm .wordmark .w-sub::before, #sgm .wordmark .w-sub::after { content: ""; flex: 1 1 auto; min-width: 18px; height: 7px;
               background: repeating-linear-gradient(180deg, #ff5fd2 0 1.5px, transparent 1.5px 3.5px); box-shadow: 0 0 8px rgba(255,47,180,.45); opacity: .85; }
  #sgm .wordmark .w-sub::before { max-width: 26px; }
  #sgm .brand2 { display: flex; align-items: flex-end; gap: 12px; } #sgm .brand2 .sg-logo { flex: none; margin-bottom: 30px; filter: drop-shadow(0 0 10px rgba(255,138,92,.45)); }
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
  #sgm .nav button.quick small { display: block; margin-top: 3px; font-size: .78rem; font-weight: 500; color: #9aa3ad; }
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
  #sgm .ver { position: absolute; z-index: 2; right: 16px; bottom: 12px; color: #5d6470; font-size: .75rem; }
  #sgm input[type=range] { width: 100%; }
  #sgo { position: fixed; inset: 0; z-index: 52; display: grid; place-items: center; background: rgba(6,9,13,.72); font: 15px/1.5 system-ui, sans-serif; color: #e9e9ea; }
  #sgo .box { background: #17181a; border: 1px solid #2b2c31; border-radius: 16px; padding: 24px 28px; width: min(470px, calc(100vw - 32px)); max-height: calc(100vh - 40px); overflow-y: auto; box-sizing: border-box; }
  #sgo h2 { margin: 0; font-size: 1.6rem; } #sgo .sub { color: #9aa3ad; margin: 2px 0 14px; }
  #sgo .big { font-size: 2.4rem; font-weight: 800; font-variant-numeric: tabular-nums; } #sgo .rec { display: inline-block; margin-left: 8px; padding: 2px 10px; border-radius: 20px; border: 1px solid #ffd23a; color: #ffd23a; font-size: .85rem; font-weight: 700; vertical-align: middle; }
  #sgo table { width: 100%; border-collapse: collapse; margin: 10px 0; } #sgo td { padding: 3px 0; vertical-align: top; } #sgo td:first-child { white-space: nowrap; padding-right: 16px; color: #cfd3d8; } #sgo td:last-child { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  #sgo .news div { padding: 6px 10px; background: #1c1d21; border: 1px solid #2b2c31; border-radius: 9px; margin-bottom: 6px; }
  #sgo .sgset h3 { margin: 16px 0 8px; font-size: .78rem; color: #8f99a5; text-transform: uppercase; letter-spacing: .08em; }
  #sgo .sgset .seg { display: flex; gap: 6px; } #sgo .sgset .seg button { flex: 1; min-width: 0; white-space: normal; overflow-wrap: anywhere; line-height: 1.25; padding: 8px 6px; background: #1c1d21; }
  #sgo .sgset .seg button.on { background: #2a2c31; border-color: #8a8f98; } #sgo .sgset .muted { color: #8f99a5; font-size: .85rem; } #sgo .sgset input[type=range] { width: 100%; }
  #sgo .sgo-set { max-height: calc(100vh - 220px); overflow-y: auto; padding: 0 6px 4px 4px; }
  #sgo .row { display: flex; gap: 8px; margin-top: 14px; } #sgo button { flex: 1; font: inherit; color: #e9e9ea; background: #222327; border: 1px solid #2b2c31; border-radius: 9px; padding: 10px; cursor: pointer; }
  #sgo button:hover { border-color: #6b7280; } #sgo button.pri { background: #2a2c31; border-color: #8a8f98; font-weight: 700; }
  /* Foco al navegar con mando o teclado (body.sg-kn): borde claro y contorno, sin sombra ni azul; con el ratón, nada */
  #sgm :focus, #sgo :focus { outline: none; }
  body.sg-kn #sgm .side :focus, body.sg-kn #sgo :focus { outline: 2px solid #d5d9df; outline-offset: 2px; }
  body.sg-kn #sgm .nav button:focus, body.sg-kn #sgm .btn:focus, body.sg-kn #sgm .seg button:focus, body.sg-kn #sgm .card:focus, body.sg-kn #sgm .livgrid button:focus,
  body.sg-kn #sgm .liv button:focus, body.sg-kn #sgm .go:focus, body.sg-kn #sgm select:focus, body.sg-kn #sgo button:focus, body.sg-kn .kb:focus { background-color: #2a2c31; border-color: #c9ced6; }
  body.sg-kn #sgm .back:focus { color: #e9e9ea; outline-offset: 4px; border-radius: 4px; }`;
  document.head.appendChild(css);

  const root = document.createElement("div"); root.id = "sgm";
  root.innerHTML = `<canvas class="bg"></canvas><div class="vig"></div><div class="side" id="sgm-side"></div><div class="ver">${esc(o.version)}</div>`;
  document.body.appendChild(root);
  const ov = document.createElement("div"); ov.id = "sgo"; ov.className = "sgm-hide"; document.body.appendChild(ov);
  const side = $("sgm-side");

  // ══ Escena 3D de la portada (menuscene.js): atardecer, torre, reflectores y la nave dejando su estela ══
  const scene3 = createMenuScene(api, root.querySelector("canvas.bg"), { lite: settings.gfx === "perf" });

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
      side.innerHTML = `<div class="brand2">${logoSvg(76)}<h1 class="wordmark" aria-label="${esc(o.title)}"><span class="w-main">Arcade</span><span class="w-main">Flow</span><span class="w-sub">Sky Defender</span></h1></div><div class="tagline">${t("tag")}</div>${pilotCard()}
        <div class="nav">${canQuick() ? `<button class="main quick" data-go="quick">${t("quickPlay")}<small>${esc(placeName())} · ${esc(t("m_" + (st.mode || "short")))} · ${st.mode === "daily" ? "" : esc(t("d_" + st.diff)) + " · "}${esc(t((PLANES[st.plane] || PLANES[0]).key))}</small></button>` : ""}<button class="${canQuick() ? "" : "main"}" data-go="play">${canQuick() ? t("prepare") : t("play")}</button><button data-go="hangar">${t("hangar")}</button><button data-go="training">${t("training")}</button>
        <button data-go="ranking">${t("ranking")}</button><button data-go="ach">${t("achievements")}</button>
        <button data-go="controls">${t("controls")}</button><button data-go="settings">${t("settings")}</button></div>`;
    },
    play() {
      const md = st.mode || "survival", daily = md === "daily", dp = daySeed() % PLANES.length, city = !arenaOK || (!daily && st.place === "city");
      scene3.view("hangar"); scene3.plane(PLANES[daily ? dp : st.plane].id);
      const dTop = daily ? stats.top(null, false, "daily") : [], dMine = daily ? stats.best(null, "daily") : null;
      const rkI = Math.max(0, RANKS.findIndex(r => r.id === stats.rank().id));
      let liv = st.livery || "std"; if ((LIVERIES.find(L => L.id === liv) || LIVERIES[0]).rank > rkI) { liv = "std"; o.setLivery(liv); }
      side.innerHTML = `<button class="back" data-go="home">← ${t("back")}</button><h2>${t("prepare")}</h2>
        <h3>${t("mode")}</h3><div class="seg" id="sgm-mode" style="flex-wrap:wrap">${["short", "blitz", "survival", "daily"].map(m => `<button style="flex:1 1 40%" data-m="${m}" class="${md === m ? "on" : ""}">${t("m_" + m)}</button>`).join("")}</div>
        <div class="muted" style="margin-top:6px">${t("mh_" + md)}</div>
        ${daily ? `<div class="muted" style="margin-top:6px">${dTop.length ? t("dailyLeader", { n: esc(dTop[0].name || t("pilotAnon")), s: dTop[0].score.toLocaleString(api.LOCALE) }) : t("dailyNone")}${dMine ? " · " + t("dailyMine", { s: dMine.score.toLocaleString(api.LOCALE) }) : ""}</div>` : ""}
        ${!arenaOK ? `<h3>${t("placeH")}</h3><div class="warn" style="font-size:.85rem">${t("arenaOld")}</div>` : daily ? `<h3>${t("placeH")}</h3><div class="muted">${t("dailyArena")}</div>` : `<h3>${t("placeH")}</h3><div class="seg" id="sgm-place">${["arena", "city"].map(x => `<button data-p="${x}" class="${st.place === x ? "on" : ""}">${t("pl_" + x)}</button>`).join("")}</div>
        <div class="muted" style="margin-top:6px">${t("plh_" + st.place)}</div>`}
        ${!daily && !city ? `<h3>${t("palH")}</h3><div class="seg" id="sgm-pal" style="flex-wrap:wrap">${["auto", "sunset", "midnight", "vapor"].map(x => `<button style="flex:1 1 40%" data-v="${x}" class="${(st.palette || "auto") === x ? "on" : ""}">${t("pal_" + x)}</button>`).join("")}</div>` : ""}
        ${city ? `<h3>${t("map")}</h3><select id="sgm-map"></select>` : ""}
        ${!city || daily ? "" : `<h3>${t("defH")}</h3><div class="seg" id="sgm-def">${["tower", "monument"].map(x => `<button data-t="${x}" class="${(st.target || "tower") === x ? "on" : ""}">${t("def_" + x)}</button>`).join("")}</div>
        <div class="muted" style="margin-top:6px">${t("defh_" + (st.target || "tower"))}</div>`}
        ${!city ? "" : st.target === "monument" && !daily ? `<h3>${t("lmPick")}</h3><select id="sgm-lm"><option>${t("lmLoading")}</option></select><div class="warn sgm-hide" id="sgm-lmnone" style="font-size:.85rem">${t("lmNone")}</div><div class="pt" id="sgm-pt"></div>` : `<h3>${t("point")}</h3>${pointHtml()}`}
        ${daily ? "" : `<h3>${t("wxH")}</h3><div class="seg" id="sgm-wx" style="flex-wrap:wrap">${["auto", "clear", "storm", "night"].map(x => `<button style="flex:1 1 40%" data-x="${x}" class="${(st.weather || "auto") === x ? "on" : ""}">${t("wxm_" + x)}</button>`).join("")}</div>
        <div class="muted" style="margin-top:6px">${t("wxh_" + (st.weather || "auto"))}</div>`}
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
      if (city) fillMaps();
      if ($("sgm-pal")) $("sgm-pal").onclick = e => { const b = e.target.closest("[data-v]"); if (b) { st.palette = b.dataset.v; o.save(); show("play"); } };
      if ($("sgm-place")) $("sgm-place").onclick = e => { const b = e.target.closest("[data-p]"); if (b) { st.place = b.dataset.p; o.save(); show("play"); } };
      if ($("sgm-def")) $("sgm-def").onclick = e => { const b = e.target.closest("[data-t]"); if (b) { st.target = b.dataset.t; if (st.target === "tower" && st.lm) { st.point = st.towerPoint || st.point; } o.save(); show("play"); } };
      if ($("sgm-wx")) $("sgm-wx").onclick = e => { const b = e.target.closest("[data-x]"); if (b) { st.weather = b.dataset.x; o.save(); show("play"); } };
      $("sgm-mode").onclick = e => { const b = e.target.closest("[data-m]"); if (b) { st.mode = b.dataset.m; o.save(); show("play"); } };
      $("sgm-liv").onclick = e => { const b = e.target.closest("[data-l]"); if (b && !b.disabled) { o.setLivery(b.dataset.l); show("play"); } };
      if ($("sgm-wing")) $("sgm-wing").onclick = e => { const b = e.target.closest("[data-w]"); if (b) { st.wing = b.dataset.w === "1"; o.save(); show("play"); } };
      if (!daily) {
        $("sgm-planes").onclick = e => { const c = e.target.closest("[data-i]"); if (c) { st.plane = +c.dataset.i; o.save(); show("play"); } };
        $("sgm-diff").onclick = e => { const b = e.target.closest("[data-d]"); if (b) { st.diff = b.dataset.d; o.save(); show("play"); } };
      }
      if (city) { if (st.target === "monument" && !daily) fillMonuments(); else wirePoint(); }
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
        <p class="muted">${t("trainingDesc")}</p>${arenaOK ? `<h3>${t("placeH")}</h3><div class="muted">${t("trainArena")}</div>`
          : `<h3>${t("map")}</h3><select id="sgm-map"></select><h3>${t("point")}</h3>${pointHtml()}<div class="warn sgm-hide" id="sgm-nomap">${t("noMap")}</div>`}
        <button class="go" id="sgm-go">${t("startTraining")}</button>`;
      if (!arenaOK) { fillMaps(); wirePoint(); }
      $("sgm-go").onclick = () => { if (!$("sgm-go").disabled) { hide(); o.onTraining(); } };
    },
    ranking() {
      scene3.view("home");
      const d = screens._rd || st.diff, mine = !!screens._rm, rmo = screens._rmo || st.mode || "survival";
      const rows = stats.top(d, mine, rmo), me = stats.user.id;
      const pn = id => t((PLANES.find(p => p.id === id) || {}).key || "");
      side.innerHTML = `<button class="back" data-go="home">← ${t("back")}</button><h2>${t("ranking")}</h2>
        <div class="seg" id="sgm-rmo" style="flex-wrap:wrap">${["short", "blitz", "survival", "daily"].map(x => `<button style="flex:1 1 40%" data-m="${x}" class="${x === rmo ? "on" : ""}">${t("m_" + x)}</button>`).join("")}</div>
        ${rmo === "daily" ? `<div class="muted" style="margin-top:6px">${t("dailyToday", { d: new Date().toLocaleDateString(api.LOCALE) })}</div><div id="sgm-rd"></div>`
          : `<div class="seg" id="sgm-rd" style="margin-top:6px">${["easy", "normal", "hard"].map(x => `<button data-d="${x}" class="${x === d ? "on" : ""}">${t("d_" + x)}</button>`).join("")}</div>`}
        <div class="seg" id="sgm-rm" style="margin-top:6px"><button data-m="0" class="${mine ? "" : "on"}">${t("rankAll")}</button><button data-m="1" class="${mine ? "on" : ""}">${t("rankMine")}</button></div>
        <table style="margin-top:12px"><tr><th>#</th><th>${t("pilotCol")}</th><th class="num">${t("waveCol")}</th><th class="num">${t("scoreCol")}</th></tr>
        ${rows.map((r, i) => `<tr class="${r.uid === me ? "me" : ""}" title="${esc(pn(r.plane))} · ${new Date(r.date).toLocaleDateString(api.LOCALE)}"><td>${i + 1}</td><td>${esc(r.name || t("pilotAnon"))}${r.wing ? ` <span title="${esc(t("wingOn"))}">🤝</span>` : ""}${r.lm ? ` <span title="${esc(r.lm)}">🏛️</span>` : ""}</td><td class="num">${r.wave}</td><td class="num">${r.score.toLocaleString(api.LOCALE)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">${t("noRuns")}</td></tr>`}</table>
        ${stats.hasOldRuns() ? `<div class="muted" style="margin-top:6px;font-size:.8rem">${t("rankRules")}</div>` : ""}
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
      side.innerHTML = `<button class="back" data-go="${screens._back || "home"}">← ${t("back")}</button><h2>${t("settings")}</h2><div id="sgm-setbox"></div>`;
      settingsPanel($("sgm-setbox"));
    },
  };
  // ══ Ajustes: el mismo panel en el menú y en la pausa (se redibuja en su sitio al cambiar algo) ══
  function settingsPanel(box) {
    box.innerHTML = `<div class="sgset">        <h3>${t("setAssist")}</h3><div class="seg" id="sgm-as">${["low", "mid", "high"].map(x => `<button data-v="${x}" class="${settings.assist === x ? "on" : ""}">${t("lv_" + x)}</button>`).join("")}</div>
        <div class="muted" style="margin-top:6px">${t("setAssistH")}</div>
        <h3>${t("setInvert")}</h3><div class="seg" id="sgm-inv"><button data-v="0" class="${settings.invert ? "" : "on"}">${t("invNo")}</button><button data-v="1" class="${settings.invert ? "on" : ""}">${t("invYes")}</button></div>
        <h3>${t("setSens")}</h3><input type="range" id="sgm-sens" min="0.4" max="2" step="0.1" value="${settings.sens}"><div class="muted" id="sgm-sensv">×${settings.sens}</div>
        <h3>${t("volMusic")}</h3><input type="range" id="sgm-vm" min="0" max="1" step="0.05" value="${o.sound ? o.sound.volume.music : 0.85}">
        <div id="sgm-um" hidden><h3 id="sgm-um-lbl"></h3><div class="seg" id="sgm-um-seg"></div><div class="muted" id="sgm-um-cur" style="margin-top:6px" hidden></div></div>
        <h3>${t("volSfx")}</h3><input type="range" id="sgm-vs" min="0" max="1" step="0.05" value="${o.sound ? o.sound.volume.sfx : 0.15}">
        <h3>${t("setGfx")}</h3><div class="seg" id="sgm-gfx">${["perf", "bal", "quality"].map(x => `<button data-v="${x}" class="${settings.gfx === x ? "on" : ""}">${t("gfx_" + x)}</button>`).join("")}</div>
        <div class="muted" style="margin-top:6px">${t("gfxh_" + settings.gfx)}</div>
        <h3>${t("setFps")}</h3><div class="seg" id="sgm-fps"><button data-v="0" class="${settings.fps ? "" : "on"}">${t("fpsHide")}</button><button data-v="1" class="${settings.fps ? "on" : ""}">${t("fpsShow")}</button></div>
        <h3>${t("setHud")}</h3><div class="seg" id="sgm-hud">${["s", "m", "l"].map(x => `<button data-v="${x}" class="${settings.hud === x ? "on" : ""}">${t("hud" + x.toUpperCase())}</button>`).join("")}</div>
        <h3>${t("setCalm")}</h3><div class="seg" id="sgm-calm"><button data-v="0" class="${settings.calm ? "" : "on"}">${t("calmNo")}</button><button data-v="1" class="${settings.calm ? "on" : ""}">${t("calmYes")}</button></div>
        <div class="muted" style="margin-top:6px">${t("calmH")}</div>
        <h3>${t("setCam")}</h3><div class="seg" id="sgm-cam"><button data-v="chase" class="${settings.cam === "chase" ? "on" : ""}">${t("camNear")}</button><button data-v="far" class="${settings.cam === "far" ? "on" : ""}">${t("camFar")}</button></div></div>`;
    const q = id => box.querySelector("#" + id);
    const seg = (id, key, conv = v => v) => { q(id).onclick = e => { const b = e.target.closest("[data-v]"); if (b) { settings[key] = conv(b.dataset.v); saveSettings(); settingsPanel(box); } }; };
    seg("sgm-as", "assist"); seg("sgm-inv", "invert", v => v === "1"); seg("sgm-cam", "cam"); seg("sgm-hud", "hud"); seg("sgm-gfx", "gfx"); seg("sgm-fps", "fps", v => v === "1"); seg("sgm-calm", "calm", v => v === "1");
    if (o.sound) { q("sgm-vm").oninput = e => o.sound.setVolume("music", +e.target.value); q("sgm-vs").oninput = e => { o.sound.setVolume("sfx", +e.target.value); o.sound.play("hit"); }; }
    q("sgm-sens").oninput = e => { settings.sens = +e.target.value; q("sgm-sensv").textContent = "×" + settings.sens; saveSettings(); };
    // Tu música (Offlined 4): «Original · Mi música…»
    const um = o.sound && o.sound.userMusic && o.sound.userMusic();
    if (um) { q("sgm-um").hidden = false; q("sgm-um-lbl").textContent = um.mod.gmText("label"); um.mod.bindMusicChooser(q("sgm-um-seg"), q("sgm-um-cur"), um); }
  }
  function planeCard(p, i) {
    const I = PLANE_INFO[p.id], bar = v => `<div class="bar"><i style="width:${v * 100}%"></i></div>`;
    return `<div class="card ${st.plane === i ? "on" : ""}" data-i="${i}" tabindex="0" role="button"><b>${t(p.key)}</b>
      <div class="stat"><span>${t("sSpeed")}</span>${bar(I.speed)}</div><div class="stat"><span>${t("sAgility")}</span>${bar(I.agility)}</div>
      <div class="stat"><span>${t("sArmor")}</span>${bar(I.armor)}</div><div class="muted" style="margin-top:4px">${t(I.w1)} · ${t(I.w2)}</div></div>`;
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
      <td>${PAD_ACTIONS.includes(a) ? `<button class="kb" data-p="${a}">${padName(B.pad[a])}</button>` : `<span class="muted">${["up", "down", "left", "right"].includes(a) ? t("stickL") : ""}</span>`}</td></tr>`;
    box.innerHTML = `<h2>${t("controls")}</h2><table class="keys ctl"><tr><th></th><th>⌨️ ${t("colKb")}</th><th>🎮 ${t("colPad")}</th></tr>${ACTIONS.map(row).join("")}</table>
      <p class="muted">🖱 ${t("mouseRow")}<br>🎮 ${t("stickRow")}</p><div id="sgm-ctlmsg" class="warn" style="min-height:1.3em"></div>
      <button class="btn" id="sgm-ctlreset">${t("resetCtl")}</button>`;
    const msg = box.querySelector("#sgm-ctlmsg");
    box.querySelector("#sgm-ctlreset").onclick = () => { resetBindings(); controlsEditor(box); };
    box.querySelectorAll("button[data-k]").forEach(b => b.onclick = () => {
      msg.textContent = t("pressKey"); capturing = true;   // la navegación de los menús no toca esa tecla
      const h = e => { e.preventDefault(); e.stopPropagation(); removeEventListener("keydown", h, true); capturing = false; if (e.code !== "Escape") setKey(b.dataset.k, e.code); controlsEditor(box); };
      addEventListener("keydown", h, true);
    });
    box.querySelectorAll("button[data-p]").forEach(b => b.onclick = () => {
      msg.textContent = t("pressPad"); capturing = true;
      const gp0 = firstPad();
      const held = new Set(gp0 ? gp0.buttons.map((x, i) => (x.pressed ? i : -1)).filter(i => i >= 0) : []);
      const t0 = performance.now();
      (function poll() {
        const gp = firstPad();
        if (gp) { const i = gp.buttons.findIndex((x, k) => x.pressed && !held.has(k)); if (i >= 0) { capturing = false; setPad(b.dataset.p, i); controlsEditor(box); return; } gp.buttons.forEach((x, k) => { if (!x.pressed) held.delete(k); }); }
        if (performance.now() - t0 < 8000) requestAnimationFrame(poll); else { capturing = false; controlsEditor(box); }
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

  // ── Monumentos 3D (Offlined Landmarks 3D) dentro del mapa elegido: el punto de la batalla es el monumento ──
  let lmCache = null;
  async function fillMonuments() {
    const sel = $("sgm-lm"); if (!sel) return;
    if (!lmCache) { try { const r = await fetch("/api/landmarks3d/status").then(r => (r.ok ? r.json() : null)); lmCache = (r && r.models) || {}; } catch { lmCache = {}; } }
    const maps = await api.maps(), m = maps.find(x => x.url === st.map) || maps[0], b = m && m.bounds;
    const name = (id, x) => (x.titles && (x.titles[api.LANG] || x.titles.en)) || x.name || id;
    const list = Object.entries(lmCache).filter(([, x]) => x.position && Array.isArray(x.footprint) && (!b || (x.position.lon >= b[0] && x.position.lon <= b[2] && x.position.lat >= b[1] && x.position.lat <= b[3])))
      .map(([id, x]) => ({ id, name: name(id, x), lat: x.position.lat, lon: x.position.lon })).sort((a, c) => a.name.localeCompare(c.name, api.LOCALE));
    if (!$("sgm-lm")) return;
    $("sgm-lmnone").classList.toggle("sgm-hide", list.length > 0);
    sel.innerHTML = list.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("") || `<option value="">—</option>`;
    sel.disabled = !list.length;
    const pickLm = id => {
      const x = list.find(y => y.id === id); if (!x) { st.lm = null; return; }
      if (!st.lm && st.point) st.towerPoint = st.point;   // para volver a la torre con el punto de antes
      st.lm = { id: x.id, name: x.name }; st.point = { lat: x.lat, lon: x.lon, name: x.name, urban: false }; o.save();
    };
    if (list.length) { pickLm(st.lm && list.some(x => x.id === st.lm.id) ? st.lm.id : list[0].id); sel.value = st.lm.id; }
    else st.lm = null;
    sel.onchange = () => { pickLm(sel.value); syncGo(maps); };
    syncGo(maps);
  }
  // Mapas y punto
  function fillMaps() {
    const sel = $("sgm-map");
    api.maps().then(list => {
      sel.innerHTML = list.map(m => `<option value="${esc(m.url)}">${esc(m.name)}</option>`).join("");
      if (!list.length) $("sgm-nomap").classList.remove("sgm-hide");
      if (st.map && list.some(m => m.url === st.map)) sel.value = st.map; else if (list.length) { st.map = sel.value; o.save(); }
      syncGo(list);
      sel.onchange = () => { st.map = sel.value; o.save(); syncGo(list); if (cur === "play" && st.target === "monument" && st.mode !== "daily") fillMonuments(); };
    });
  }
  function syncGo(list) {
    const m = list.find(x => x.url === st.map), p = st.point, ok = !!(m && p && (!m.bounds || (p.lon >= m.bounds[0] && p.lon <= m.bounds[2] && p.lat >= m.bounds[1] && p.lat <= m.bounds[3])))
      && !(cur === "play" && st.target === "monument" && st.mode !== "daily" && !st.lm);
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
    const fresh = name !== cur || root.classList.contains("hide");   // otra pantalla (no la misma redibujada)
    cur = name; root.classList.remove("hide"); scene3.start(); screens[name]();
    navScreen(fresh);
  }
  function hide() { root.classList.add("hide"); scene3.stop(); }
  side.addEventListener("click", e => {
    if (e.target.closest("button")) o.sound && o.sound.play("click");
    const b = e.target.closest("[data-go]"); if (!b) return;
    if ((b.dataset.go === "play" || b.dataset.go === "quick") && firstTime()) { offerTraining(); return; }
    if (b.dataset.go === "quick") { quickPlay(); return; }
    show(b.dataset.go);
  });
  // Partida rápida: con lo último que elegiste, sin pasar por «Preparar la partida». Hace las mismas
  // comprobaciones que «Despegar» (mapa descargado, punto dentro, monumento si toca); si falta algo, te lleva allí.
  async function quickPlay() {
    if (inArenaNow()) { hide(); o.onPlay(); return; }   // la arena no necesita mapa
    let list = []; try { list = await api.maps(); } catch { }
    const m = list.find(x => x.url === st.map), p = st.point;
    const ok = !!(m && p && (!m.bounds || (p.lon >= m.bounds[0] && p.lon <= m.bounds[2] && p.lat >= m.bounds[1] && p.lat <= m.bounds[3])))
      && !(st.target === "monument" && st.mode !== "daily" && !st.lm);
    if (!ok) { show("play"); return; }
    hide(); o.onPlay();
  }
  const arenaOK = o.arenaOK !== false;   // motor v3: si no, todo en «Tu ciudad»
  const inArenaNow = () => arenaOK && (st.place !== "city" || st.mode === "daily");
  const canQuick = () => inArenaNow() || !!st.point;
  const placeName = () => (inArenaNow() || !st.point ? t("arenaName") : st.point.name);
  function firstTime() {
    const T = stats.totals(); let asked = false; try { asked = localStorage.getItem("sg_trainAsked") === "1"; } catch { }
    return !T.trained && !T.games && !asked;
  }
  function offerTraining() {
    try { localStorage.setItem("sg_trainAsked", "1"); } catch { }
    overlay(`<h2>🎓 ${t("firstTitle")}</h2><div class="sub">${t("firstBody")}</div><div class="row"><button class="pri" id="sgo-ft">${t("firstTrain")}</button><button id="sgo-fp">${t("firstPlay")}</button></div>`,
      { kind: "first", focus: "#sgo-ft", back: () => closeOverlay() });
    $("sgo-ft").onclick = () => { closeOverlay(); show("training"); };
    $("sgo-fp").onclick = () => { closeOverlay(); show("play"); };
  }

  // ══ Pausa y resultados (encima del juego) ══
  // kind: qué ventana es (pausa, resultados…) · focus: el botón que recibe el foco al abrirse · back: lo que hacen B / Esc
  function overlay(html, { kind = null, focus = null, back = null } = {}) {
    ov.innerHTML = `<div class="box">${html}</div>`; ov.classList.remove("sgm-hide");
    ovKind = kind; ovFocus = focus; ovBack = back;
    navOpened(kind === "results" || kind === "trainDone" ? 600 : 0);   // tras la partida, un momento sin aceptar (Espacio es disparar)
  }
  function closeOverlay() { ov.classList.add("sgm-hide"); ovKind = ovFocus = ovBack = null; lastKey = null; }
  function showPause(on) {
    if (!on) { closeOverlay(); return; }
    overlay(`<h2>${t("paused")}</h2><div class="sub">${esc(o.title)}</div>
      <div class="row" style="flex-direction:column"><button class="pri" id="sgo-res">${t("resume")}</button><button id="sgo-ctl">${t("controls")}</button>
      <button id="sgo-set">${t("settings")}</button><button id="sgo-quit">${t("quit")}</button></div>`, { kind: "pause", focus: "#sgo-res", back: () => o.onResume() });
    $("sgo-res").onclick = () => o.onResume();
    $("sgo-quit").onclick = () => {
      overlay(`<h2>${t("quitConfirm")}</h2><div class="sub">${t("quitConfirmSub")}</div><div class="row"><button id="sgo-qy">${t("quitYes")}</button><button class="pri" id="sgo-qn">${t("quitNo")}</button></div>`,
        { kind: "quit", focus: "#sgo-qn", back: () => showPause(true) });
      $("sgo-qy").onclick = () => { closeOverlay(); o.onQuit(); }; $("sgo-qn").onclick = () => showPause(true);
    };
    $("sgo-ctl").onclick = pauseControls;
    $("sgo-set").onclick = pauseSettings;
  }
  // Controles y Ajustes de la pausa. También los abren la rueda dentada y el botón de controles de la barra
  // de arriba del motor (HOOK.openSettings / HOOK.openControls): un solo sitio para los ajustes.
  function pauseControls() {
    overlay(`<div id="sgo-ctl-ed"></div><div class="row"><button class="pri" id="sgo-b">${t("back")}</button></div>`, { kind: "pauseSub", back: () => showPause(true) });
    controlsEditor($("sgo-ctl-ed")); $("sgo-b").onclick = () => showPause(true);
  }
  function pauseSettings() {
    overlay(`<h2>${t("settings")}</h2><div id="sgo-setbox" class="sgo-set"></div><div class="row"><button class="pri" id="sgo-b">${t("back")}</button></div>`, { kind: "pauseSub", back: () => showPause(true) });
    settingsPanel($("sgo-setbox")); $("sgo-b").onclick = () => showPause(true);
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
      <tr><td>${t("overAcc")}</td><td>${Math.round(r.accuracy * 100)} %</td></tr><tr><td>${t("overStreak")}</td><td>×${Math.max(1, r.bestStreak)}</td></tr><tr><td>${t("overKits")}</td><td>${r.kits}</td></tr><tr><td>${t("overSaves")}</td><td>${r.saves || 0}</td></tr><tr><td>${t("overAA")}</td><td>${r.aaKills || 0}</td></tr>${r.wing ? `<tr><td>${t("overWing")}</td><td>${r.wingKills || 0}</td></tr>` : ""}${r.dodged ? `<tr><td>${t("overDodged")}</td><td>${r.dodged}</td></tr>` : ""}${r.perks && r.perks.length ? `<tr><td>${t("overPerks")}</td><td>${r.perks.map(k => `<span title="${esc(t("perk_" + k))}">${PERK_ICON[k] || ""}</span>`).join(" ")}</td></tr>` : ""}
      ${r.towerLost.length > 1 ? `<tr><td>${t("towersFell")}</td><td>${r.towerLost.map(x => `T${x.n} (${t("waveN", { n: x.wave })})`).join(", ")}</td></tr>` : ""}</table>
      <div class="muted" style="margin-bottom:10px">${kinds}</div>
      ${r.hpLog && r.hpLog.length > 2 ? `<div class="muted">${t("graphTitle")}</div><canvas id="sgo-graph" width="820" height="200" style="width:100%;height:100px;margin:4px 0 10px"></canvas>` : ""}
      ${res.prevBest && !res.record ? `<div class="muted" style="margin-bottom:8px">${t("bestCmp", { w: res.prevBest.wave, s: res.prevBest.score.toLocaleString(api.LOCALE), d: fmt(res.prevBest.time || 0) })}</div>` : ""}
      <div class="news">${news}</div>
      ${o.canReplay && o.canReplay() ? `<div class="row" style="margin-top:10px"><button id="sgo-replay">${t("rpBtn")}</button></div>` : ""}
      <div class="row"><button class="pri" id="sgo-again">${t("again")}</button><button id="sgo-rank">${t("ranking")}</button><button id="sgo-menu">${t("menu")}</button></div>`,
      { kind: "results", focus: "#sgo-again" });   // sin «atrás»: B (bengalas) o Esc al morir no te sacan de los resultados
    lastResults = [r, res, training];
    if ($("sgo-replay")) $("sgo-replay").onclick = () => { closeOverlay(); o.onReplay(); };
    if ($("sgo-graph")) drawGraph($("sgo-graph"), r);
    $("sgo-again").onclick = () => { closeOverlay(); o.onAgain(); };
    $("sgo-rank").onclick = () => { closeOverlay(); o.onQuit(); screens._rd = r.diff; screens._rmo = r.mode || "survival"; show("ranking"); };
    $("sgo-menu").onclick = () => { closeOverlay(); o.onQuit(); };
  }
  let lastResults = null;
  function reopenResults() { if (lastResults) showResults(...lastResults); }
  function showTrainingDone(newAch) {
    overlay(`<h2>🎓 ${t("trainDone")}</h2><div class="sub">${t("trainDoneSub")}</div>
      <div class="news">${newAch.map(id => { const a = ACHIEVEMENTS.find(x => x.id === id); return `<div>${a.icon} ${t("newAch")}: <b>${t("a_" + id)}</b></div>`; }).join("")}</div>
      <div class="row"><button class="pri" id="sgo-play">${t("play")}</button><button id="sgo-menu">${t("menu")}</button></div>`, { kind: "trainDone", focus: "#sgo-play" });
    $("sgo-play").onclick = () => { closeOverlay(); o.onQuit(); show("play"); };
    $("sgo-menu").onclick = () => { closeOverlay(); o.onQuit(); };
  }

  // ══ Navegación con mando y teclado por los menús y las ventanas ══
  // Solo con un menú o una ventana delante: en vuelo no toca ni el mando ni el teclado.
  // · Cruceta / stick izquierdo / flechas: el foco va al botón más cercano en esa dirección (Tab: en orden).
  // · A / Intro / Espacio: pulsar. B / Esc: atrás (en la pausa, seguir; Esc la quita el motor). Start: lo lleva arcade.js.
  // · En un selector (.seg con una opción elegida) ← → cambian la opción; en un deslizador, el valor; en una lista, la opción.
  // · El mando se lee con requestAnimationFrame solo mientras hay algo abierto, una vez por fotograma (firstPad).
  //   A y B actúan al soltarlos: así, al volver al vuelo, ya no están pulsados (B también es bengalas).
  // · El foco se ve solo al navegar así (body.sg-kn); un clic con el ratón lo esconde.
  const FOCUSABLE = "button, select, input[type=range], [tabindex='0']";
  const NO_AUTO = "#sgm-um-seg";            // «Música del juego»: elegir abre cosas, así que ← → solo mueven el foco
  const PAD = { A: 0, B: 1, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  const rtl = document.documentElement.dir === "rtl";
  let ovKind = null, ovFocus = null, ovBack = null, capturing = false, navMode = false, lastKey = null;
  let navRaf = 0, navCtxWas = null, needFreeze = true, quietUntil = 0;
  let padHeld = new Set(), armed = new Set(), dirHeld = null, dirT = 0;
  const navCtx = () => (!ov.classList.contains("sgm-hide") ? ov : !root.classList.contains("hide") ? side : null);
  const visible = el => !el.disabled && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const focusables = c => [...c.querySelectorAll(FOCUSABLE)].filter(visible);
  const setNavMode = v => { if (navMode !== v) { navMode = v; document.body.classList.toggle("sg-kn", v); } };
  addEventListener("pointerdown", () => setNavMode(false), true);
  addEventListener("gamepadconnected", () => { if (navCtx()) { setNavMode(true); navWake(); } });
  // Lo que tiene el foco se recuerda por su id o su data-…: al redibujarse la pantalla (cada opción la redibuja) vuelve al mismo
  function keyOf(el, c) {
    if (el.id) return "#" + CSS.escape(el.id);
    const anc = el.parentElement && el.parentElement.closest("[id]"), pre = anc && anc !== c && c.contains(anc) ? "#" + CSS.escape(anc.id) + " " : "";
    for (const a of el.attributes) if (a.name.startsWith("data-")) return `${pre}[${a.name}="${CSS.escape(a.value)}"]`;
    return null;
  }
  document.addEventListener("focusin", e => { const c = navCtx(); if (c && c.contains(e.target)) lastKey = keyOf(e.target, c); });
  function focusEl(el) {
    if (!el) return;
    // Al entrar en un selector, el foco va a la opción elegida (así ← → cambian desde ella)
    const seg = el.closest(".seg"), on = seg && !seg.matches(NO_AUTO) && seg.querySelector("button.on"), a = document.activeElement;
    if (on && on !== el && visible(on) && !(a && seg.contains(a))) el = on;
    el.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function initialFocus(c) {
    const pref = c === ov ? ovFocus : cur === "home" ? ".main" : null, p = pref && c.querySelector(pref);
    if (p && visible(p)) return p;
    const list = focusables(c);
    return list.find(e => !e.classList.contains("back")) || list[0] || null;
  }
  const focused = c => { const a = document.activeElement; return a && a !== document.body && c.contains(a) && visible(a) ? a : null; };
  function ensureFocus(c) {
    const a = focused(c); if (a) return a;
    let el = null;
    if (lastKey) try { el = c.querySelector(lastKey); } catch { el = null; }
    if (!el || !visible(el)) el = initialFocus(c);
    focusEl(el);
    return el;
  }
  // El más cercano en una dirección: distancia en esa dirección + 3 × separación de lado (0 si se solapan)
  function nearest(from, dir, list) {
    const r0 = from.getBoundingClientRect(), cx0 = (r0.left + r0.right) / 2, cy0 = (r0.top + r0.bottom) / 2, vert = dir === "up" || dir === "down";
    let best = null, bs = Infinity;
    for (const el of list) {
      if (el === from) continue;
      const r = el.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      let main, cross, tie;
      if (vert) {
        if ((dir === "down" ? cy - cy0 : cy0 - cy) <= 2) continue;
        main = Math.max(0, dir === "down" ? r.top - r0.bottom : r0.top - r.bottom);
        cross = Math.max(0, Math.max(r.left, r0.left) - Math.min(r.right, r0.right));
        tie = Math.abs(rtl ? r.right - r0.right : r.left - r0.left) * 0.05;   // en una fila, el primero en el sentido de lectura
      } else {
        if ((dir === "right" ? cx - cx0 : cx0 - cx) <= 2) continue;
        cross = Math.max(0, Math.max(r.top, r0.top) - Math.min(r.bottom, r0.bottom));
        if (cross > 0) continue;   // ← → solo dentro de la misma fila
        main = Math.max(0, dir === "right" ? r.left - r0.right : r0.left - r.right);
        tie = Math.abs(cy - cy0) * 0.05;
      }
      const sc = main + cross * 3 + tie;
      if (sc < bs) { bs = sc; best = el; }
    }
    return best;
  }
  function stepSelect(s, d, wrap) {
    const n = s.options.length; if (!n || s.disabled) return;
    const i = wrap ? (s.selectedIndex + d + n) % n : Math.max(0, Math.min(n - 1, s.selectedIndex + d));
    if (i === s.selectedIndex) return;
    s.selectedIndex = i; s.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function afterChange() { const c = navCtx(); if (c) ensureFocus(c); }
  function navDir(dir) {
    const c = navCtx(); if (!c) return;
    const a = focused(c);
    if (!navMode) { setNavMode(true); if (a) return; }   // la primera pulsación solo enseña dónde está el foco
    if (!a) { ensureFocus(c); return; }
    if (dir === "left" || dir === "right") {
      if (a.type === "range") {   // en árabe el deslizador va al revés: → baja
        if ((dir === "right") !== rtl) a.stepUp(); else a.stepDown();
        a.dispatchEvent(new Event("input", { bubbles: true })); a.dispatchEvent(new Event("change", { bubbles: true })); return;
      }
      if (a.tagName === "SELECT") { stepSelect(a, dir === "right" ? 1 : -1, false); afterChange(); return; }
      const seg = a.closest(".seg");
      if (seg && seg.querySelector(".on") && !seg.matches(NO_AUTO)) {   // selector: ← → eligen la opción de al lado
        const bs = [...seg.querySelectorAll("button")].filter(visible), i = bs.indexOf(a), nb = bs[i + ((dir === "right") !== rtl ? 1 : -1)];
        if (nb) { lastKey = keyOf(nb, c); nb.click(); if (nb.isConnected) focusEl(nb); else afterChange(); }   // casi siempre se redibuja
        return;
      }
    }
    const nb = nearest(a, dir, focusables(c));
    if (nb) focusEl(nb);
  }
  function navTab(d) {
    const c = navCtx(); if (!c) return;
    setNavMode(true);
    const list = focusables(c); if (!list.length) return;
    const a = focused(c), i = a ? list.indexOf(a) : -1;
    focusEl(list[i < 0 ? 0 : (i + d + list.length) % list.length]);
  }
  function navActivate() {
    const c = navCtx(); if (!c || performance.now() < quietUntil) return;
    setNavMode(true);
    const a = focused(c);
    if (!a) { ensureFocus(c); return; }
    if (a.tagName === "SELECT") { stepSelect(a, 1, true); afterChange(); return; }
    if (a.type === "range") return;
    a.click(); afterChange();
  }
  function navBack() {
    const c = navCtx(); if (!c) return;
    if (c === ov) { if (ovBack) ovBack(); }
    else { const b = side.querySelector(".back"); if (b && visible(b)) b.click(); }
    afterChange();
  }
  // Teclado (en captura: antes que el motor). No actúa mientras se reasigna una tecla.
  const DIRS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  addEventListener("keydown", e => {
    if (capturing || e.ctrlKey || e.altKey || e.metaKey) return;
    const c = navCtx(); if (!c) return;
    const k = e.code, eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (DIRS[k]) { eat(); navDir(DIRS[k]); return; }
    if (k === "Tab") { eat(); navTab(e.shiftKey ? -1 : 1); return; }
    if (k === "Enter" || k === "NumpadEnter" || k === "Space") { eat(); if (!e.repeat) navActivate(); return; }
    if (k === "Escape") {
      if (c === ov && ovKind === "pause") return;   // Esc en la pausa: el motor la quita, como siempre
      if (c === ov || side.querySelector(".back")) { eat(); if (!e.repeat) navBack(); }   // con los resultados, Esc no hace nada (ni quita la pausa por debajo)
      return;
    }
    if (k === "KeyR" && c === ov && ovKind === "results") { eat(); if (!e.repeat && performance.now() >= quietUntil && $("sgo-again")) $("sgo-again").click(); }
  }, true);
  // Espacio pulsa el botón al soltarlo: ya se pulsó al bajarlo (arriba), así que se anula
  addEventListener("keyup", e => { if (!capturing && e.code === "Space" && navCtx()) e.preventDefault(); }, true);
  // Mando
  function freeze(gp) {   // lo que ya estaba pulsado al abrirse algo no cuenta hasta soltarlo
    padHeld = new Set(); armed = new Set();
    if (gp) gp.buttons.forEach((b, i) => { if (b.pressed) padHeld.add(i); });
    dirHeld = gp ? padDir(gp) : null; dirT = Infinity;
  }
  function padDir(gp) {
    const p = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (p(PAD.UP)) return "up"; if (p(PAD.DOWN)) return "down"; if (p(PAD.LEFT)) return "left"; if (p(PAD.RIGHT)) return "right";
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.max(Math.abs(ax), Math.abs(ay)) < 0.5) return null;   // zona muerta
    return Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? "right" : "left") : (ay > 0 ? "down" : "up");
  }
  function navWake() { if (!navRaf) navRaf = requestAnimationFrame(navLoop); }
  function navLoop(now) {
    navRaf = 0;
    const c = navCtx(); if (!c) { navCtxWas = null; needFreeze = true; return; }   // nada abierto: se deja de mirar el mando
    navRaf = requestAnimationFrame(navLoop);
    const gp = firstPad();
    if (c !== navCtxWas) { navCtxWas = c; needFreeze = true; }
    if (navMode) ensureFocus(c);
    if (!gp) return;
    if (needFreeze || capturing) { needFreeze = false; freeze(gp); return; }
    for (const i of [PAD.A, PAD.B]) {
      const p = !!(gp.buttons[i] && gp.buttons[i].pressed);
      if (p && !padHeld.has(i)) { padHeld.add(i); armed.add(i); }
      else if (!p && padHeld.has(i)) { padHeld.delete(i); if (armed.delete(i)) { if (i === PAD.A) navActivate(); else navBack(); } }
    }
    const dir = padDir(gp);
    if (!dir) { dirHeld = null; return; }
    if (dir !== dirHeld) { dirHeld = dir; dirT = now + 380; navDir(dir); }
    else if (now >= dirT) { dirT = now + 180; navDir(dir); }   // mantenido: repite
  }
  // Al abrir una ventana: foco en su botón principal (en los resultados, «Otra vez»)
  function navOpened(quietMs) {
    lastKey = null; needFreeze = true; quietUntil = performance.now() + quietMs;
    if (firstPad()) setNavMode(true);
    focusEl(initialFocus(ov));
    // Controles y Ajustes de la pausa se rellenan justo después de abrir la ventana: entonces, a lo primero de dentro
    if (!ovFocus) queueMicrotask(() => { if (navCtx() === ov) focusEl(initialFocus(ov)); });
    navWake();
  }
  // Al cambiar de pantalla del menú: foco en lo primero útil (si se redibuja la misma, se queda donde estaba)
  function navScreen(fresh) {
    if (navCtx() !== side) { navWake(); return; }
    if (fresh) { lastKey = null; needFreeze = true; if (firstPad()) setNavMode(true); focusEl(initialFocus(side)); }
    else if (navMode) ensureFocus(side);
    navWake();
  }

  o.applySettings(settings);
  return { show, hide, showPause, pauseSettings, pauseControls, showResults, reopenResults, showTrainingDone, closeOverlay, settings,
    get current() { return cur; }, get overlayKind() { return navCtx() === ov ? ovKind : null; } };
}
