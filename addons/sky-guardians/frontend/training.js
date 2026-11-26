/* ═══════════════════════════════════════════════════════════════════════════
   🎓 Arcade Flow Sky Defender — entrenamiento (unos 3 minutos, 10 pasos)
   1 girar · 2 acelerar y frenar · 3 arma 1 contra un blanco · 4 arma 2 contra dos · 5 racha: tres blancos
   seguidos · 6 cámara al objetivo · 7 bengalas · 8 recoger un kit y entregarlo en el anillo verde ·
   9 ventajas (se explican; en el entrenamiento no hay oleadas) · 10 llamar ya a la oleada (pulsar su botón).
   Blancos de prácticas que no disparan; sin oleadas. Los textos llevan la tecla o el botón asignado ({k}).
   ═══════════════════════════════════════════════════════════════════════════ */
import { bindings as B, kbHas, keyName, padName, firstPad } from "./controls.js";

export function createTraining(api, { t, combat, towers, onDone, onSkip }) {
  const { THREE, S } = api;
  // Abajo, en el centro: arriba están la barra de la torre (y≈88), la racha (y≈128) y el aviso del kit (y≈188),
  // y abajo del todo las barras de la nave y el aviso «Clic para apuntar» (hasta ~175 px con el HUD grande)
  const css = document.createElement("style");
  css.textContent = `#sgt { position: fixed; left: 50%; bottom: 205px; transform: translateX(-50%); z-index: 45; width: min(560px, calc(100vw - 32px));
    background: rgba(14,17,22,.86); border: 1px solid #2b2c31; border-radius: 12px; padding: 12px 16px; font: 15px/1.45 system-ui, sans-serif; color: #e9e9ea; box-sizing: border-box; }
    #sgt.hide { display: none; } #sgt .hd { display: flex; justify-content: space-between; align-items: center; color: #9aa3ad; font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; }
    #sgt .tx { font-size: 1.05rem; margin: 6px 0 8px; } #sgt .ok { color: #7ee08a; font-weight: 700; }
    #sgt kbd { background: #222327; border: 1px solid #3a3d44; border-radius: 5px; padding: 0 6px; font: 600 .85rem system-ui; }
    #sgt .dots { display: flex; gap: 5px; } #sgt .dots i { flex: 1; height: 4px; border-radius: 2px; background: rgba(255,255,255,.12); } #sgt .dots i.on { background: #c9ced6; }
    #sgt button { font: inherit; font-size: .8rem; color: #cfd3d8; background: #222327; border: 1px solid #2b2c31; border-radius: 7px; padding: 3px 10px; cursor: pointer; }`;
  document.head.appendChild(css);
  const box = document.createElement("div"); box.id = "sgt"; box.className = "hide"; document.body.appendChild(box);
  const V = () => new THREE.Vector3();
  const pad = () => !!firstPad();
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // La tecla o el botón de una acción, como se ve en Controles
  const bind = a => `<kbd>${esc(pad() ? padName(B.pad[a]) : keyName(B.kb[a][0], t))}</kbd>`;
  const heading = f => { const { fwd } = f.axes(); return Math.atan2(fwd.x, fwd.z); };
  const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const ahead = (d, side = 0, up = 0) => { const f = S.flight, { fwd, right } = f.axes(); return f.pos.clone().addScaledVector(V().set(fwd.x, 0, fwd.z).normalize(), d).addScaledVector(right, side).add(V().set(0, up, 0)); };
  let on = false, i = 0, s = {}, okT = 0;
  const cruise = () => S.P.vmax * 0.72;
  // «Llamar a la oleada»: en el entrenamiento no hay oleadas, así que basta con pulsar su tecla o su botón
  let callPressed = false, callPrev = false;
  addEventListener("keydown", e => { if (on && !e.repeat && kbHas("callWave", e.code)) callPressed = true; });
  const G = () => combat.state.game, PL = () => combat.state.pl;
  // info: paso que solo se lee (pasa solo al cabo de unos segundos, sin el «¡Bien!»)
  const STEPS = [
    { key: "tr1", init() { s.h = heading(S.flight); s.acc = 0; }, check() { const h = heading(S.flight); s.acc += Math.abs(wrap(h - s.h)); s.h = h; return s.acc > 2.6; } },
    { key: "tr2", init() { s.up = s.down = false; }, check() { const v = S.flight.speed; if (v > cruise() * 1.1) s.up = true; if (s.up && v < cruise() * 0.9) s.down = true; return s.up && s.down; } },
    { key: "tr3", init() { s.k = G().kills; combat.spawnDummy(ahead(700)); }, check() { return G().kills > s.k; } },
    { key: "tr4", init() { s.k = G().kills; combat.spawnDummy(ahead(900, -60)); combat.spawnDummy(ahead(1000, 60, 20)); }, check() { return G().kills >= s.k + 2; } },
    // Racha: tres blancos juntos; se empieza desde ×1 para ver subir el multiplicador
    { key: "trSt", text: () => t("trSt", { k: bind("fire1") }), init() {
        s.k = G().kills; const pl = PL(); if (pl) { pl.streak = 0; pl.comboT = 0; }
        combat.spawnDummy(ahead(800, -70)); combat.spawnDummy(ahead(900, 0, 25)); combat.spawnDummy(ahead(1000, 70));
      }, check() { const pl = PL(); return G().kills >= s.k + 3 && (!pl || pl.streak >= 3 || G().bestStreak >= 3); } },
    { key: "tr5", init() { s.held = 0; combat.spawnDummy(ahead(-1200, 0, 50)); }, check(dt) { if (api.rig.focus) s.held += dt; return s.held > 1; } },
    { key: "trFl", text: () => t("trFl", { k: bind("flare") }), init() { s.f = G().flaresUsed || 0; }, check() { return (G().flaresUsed || 0) > s.f; } },
    { key: "tr6", init() {
        s.d = G().kitsDelivered;
        const f = S.flight, list = towers().slice().sort((a, b) => Math.hypot(a.x - f.pos.x, a.z - f.pos.z) - Math.hypot(b.x - f.pos.x, b.z - f.pos.z));
        if (list[0]) combat.damageTowerTo(list[0], 60);
        combat.dropKit(ahead(600, 0, 120));
      }, check() { return G().kitsDelivered > s.d; } },
    { key: "trPk", info: true, text: () => t(pad() ? "trPkp" : "trPkk"), init() { s.t = 0; }, check(dt) { return (s.t += dt) > 9; } },
    { key: "trCw", text: () => t("trCw", { k: bind("callWave") }), init() { callPressed = false; }, check() {
        const gp = firstPad(), b = !!(gp && gp.buttons[B.pad.callWave] && gp.buttons[B.pad.callWave].pressed);
        if (b && !callPrev) callPressed = true; callPrev = b;
        return callPressed;
      } },
  ];
  // Los pasos de antes (tr1…tr6) tienen un texto para teclado (k) y otro para mando (p)
  const stepText = st => (st.text ? st.text() : t(st.key + (pad() ? "p" : "k")));
  function render(done = false) {
    const st = STEPS[i];
    box.innerHTML = `<div class="hd"><span>${t("training")} · ${i + 1}/${STEPS.length}</span><button id="sgt-skip">${t("skip")}</button></div>
      <div class="tx">${done ? `<span class="ok">✓ ${t("trOk")}</span>` : stepText(st)}</div>
      <div class="dots">${STEPS.map((_, k) => `<i class="${k < i || (k === i && done) ? "on" : ""}"></i>`).join("")}</div>`;
    document.getElementById("sgt-skip").onclick = () => { stop(); onSkip(); };
  }
  function start() { on = true; i = 0; s = {}; okT = 0; box.classList.remove("hide"); combat.training(true); STEPS[0].init(); render(); }
  function stop() { on = false; box.classList.add("hide"); combat.training(false); }
  let padWas = null;
  function frame(dt) {
    if (!on || !S.flight || S.crashT > 0) return;
    // Si se conecta o se desconecta el mando a mitad, el texto cambia de teclas a botones
    const p = pad(); if (p !== padWas) { padWas = p; if (okT <= 0) render(); }
    if (okT > 0) { okT -= dt; if (okT <= 0) next(); return; }
    if (STEPS[i].check(dt)) { if (STEPS[i].info) next(); else { okT = 1.4; render(true); } }
  }
  function next() { i++; if (i >= STEPS.length) { stop(); onDone(); return; } s = {}; STEPS[i].init(); render(); }
  return { start, stop, frame, get on() { return on; } };
}
