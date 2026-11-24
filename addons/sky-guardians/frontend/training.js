/* ═══════════════════════════════════════════════════════════════════════════
   🎓 Sky Guardians — entrenamiento (unos 2 minutos, 6 pasos)
   1 girar · 2 acelerar y frenar · 3 arma 1 contra un blanco · 4 arma 2 contra dos · 5 cámara al objetivo ·
   6 recoger un kit y entregarlo en el anillo verde. Blancos de prácticas que no disparan; sin oleadas.
   ═══════════════════════════════════════════════════════════════════════════ */

export function createTraining(api, { t, combat, towers, onDone, onSkip }) {
  const { THREE, S } = api;
  const css = document.createElement("style");
  css.textContent = `#sgt { position: fixed; left: 50%; top: 96px; transform: translateX(-50%); z-index: 45; width: min(560px, calc(100vw - 32px));
    background: rgba(14,17,22,.86); border: 1px solid #2b2c31; border-radius: 12px; padding: 12px 16px; font: 15px/1.45 system-ui, sans-serif; color: #e9e9ea; }
    #sgt.hide { display: none; } #sgt .hd { display: flex; justify-content: space-between; align-items: center; color: #9aa3ad; font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; }
    #sgt .tx { font-size: 1.05rem; margin: 6px 0 8px; } #sgt .ok { color: #7ee08a; font-weight: 700; }
    #sgt .dots { display: flex; gap: 5px; } #sgt .dots i { flex: 1; height: 4px; border-radius: 2px; background: rgba(255,255,255,.12); } #sgt .dots i.on { background: #c9ced6; }
    #sgt button { font: inherit; font-size: .8rem; color: #cfd3d8; background: #222327; border: 1px solid #2b2c31; border-radius: 7px; padding: 3px 10px; cursor: pointer; }`;
  document.head.appendChild(css);
  const box = document.createElement("div"); box.id = "sgt"; box.className = "hide"; document.body.appendChild(box);
  const V = () => new THREE.Vector3();
  const pad = () => !!(navigator.getGamepads && [...navigator.getGamepads()].some(g => g));
  const heading = f => { const { fwd } = f.axes(); return Math.atan2(fwd.x, fwd.z); };
  const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const ahead = (d, side = 0, up = 0) => { const f = S.flight, { fwd, right } = f.axes(); return f.pos.clone().addScaledVector(V().set(fwd.x, 0, fwd.z).normalize(), d).addScaledVector(right, side).add(V().set(0, up, 0)); };
  let on = false, i = 0, s = {}, okT = 0;
  const cruise = () => S.P.vmax * 0.72;
  const STEPS = [
    { key: "tr1", init() { s.h = heading(S.flight); s.acc = 0; }, check() { const h = heading(S.flight); s.acc += Math.abs(wrap(h - s.h)); s.h = h; return s.acc > 2.6; } },
    { key: "tr2", init() { s.up = s.down = false; }, check() { const v = S.flight.speed; if (v > cruise() * 1.1) s.up = true; if (s.up && v < cruise() * 0.9) s.down = true; return s.up && s.down; } },
    { key: "tr3", init() { s.k = combat.state.game.kills; combat.spawnDummy(ahead(700)); }, check() { return combat.state.game.kills > s.k; } },
    { key: "tr4", init() { s.k = combat.state.game.kills; combat.spawnDummy(ahead(900, -60)); combat.spawnDummy(ahead(1000, 60, 20)); }, check() { return combat.state.game.kills >= s.k + 2; } },
    { key: "tr5", init() { s.held = 0; combat.spawnDummy(ahead(-1200, 0, 50)); }, check(dt) { if (api.rig.focus) s.held += dt; return s.held > 1; } },
    { key: "tr6", init() {
        s.d = combat.state.game.kitsDelivered;
        const f = S.flight, list = towers().slice().sort((a, b) => Math.hypot(a.x - f.pos.x, a.z - f.pos.z) - Math.hypot(b.x - f.pos.x, b.z - f.pos.z));
        if (list[0]) combat.damageTowerTo(list[0], 60);
        combat.dropKit(ahead(600, 0, 120));
      }, check() { return combat.state.game.kitsDelivered > s.d; } },
  ];
  function render(done = false) {
    const st = STEPS[i];
    box.innerHTML = `<div class="hd"><span>${t("training")} · ${i + 1}/${STEPS.length}</span><button id="sgt-skip">${t("skip")}</button></div>
      <div class="tx">${done ? `<span class="ok">✓ ${t("trOk")}</span>` : t(st.key + (pad() ? "p" : "k"))}</div>
      <div class="dots">${STEPS.map((_, k) => `<i class="${k < i || (k === i && done) ? "on" : ""}"></i>`).join("")}</div>`;
    document.getElementById("sgt-skip").onclick = () => { stop(); onSkip(); };
  }
  function start() { on = true; i = 0; s = {}; okT = 0; box.classList.remove("hide"); combat.training(true); STEPS[0].init(); render(); }
  function stop() { on = false; box.classList.add("hide"); combat.training(false); }
  function frame(dt) {
    if (!on || !S.flight || S.crashT > 0) return;
    if (okT > 0) { okT -= dt; if (okT <= 0) { i++; if (i >= STEPS.length) { stop(); onDone(); return; } s = {}; STEPS[i].init(); render(); } return; }
    if (STEPS[i].check(dt)) { okT = 1.4; render(true); }
  }
  return { start, stop, frame, get on() { return on; } };
}
