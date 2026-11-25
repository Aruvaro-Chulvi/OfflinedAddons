/* ═══════════════════════════════════════════════════════════════════════════
   📈 Sky Guardians — registro de rendimiento (para encontrar los tirones en el equipo de quien juega)
   Cada fotograma se mide el tiempo desde el anterior. Cada segundo se guarda un resumen (fps, peor fotograma,
   fotogramas lentos y cómo está la partida) y, en cada tirón (> 50 ms), una foto de lo que pasaba: qué partes del
   motor se llevaron el tiempo (S.pf), teselas montándose o pendientes, monumentos cargando, recolector de memoria,
   enemigos, tiempo, noche, resolución, nivel de la calidad automática… Barato: unas cuantas restas por fotograma.
   Se guarda en el almacén del addon al acabar la partida (data.perf: solo la última).
   ═══════════════════════════════════════════════════════════════════════════ */

const HITCH = 50, MAX_SEC = 1800, MAX_HITCH = 400;

export function createPerf(api, getGame) {
  const { S } = api;
  let on = false, last = 0, pf0 = {}, t0 = 0, secs = [], hitches = [], cur = null, prev = null;
  const heap = () => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0);
  const lmLoaded = () => { const l = S.lm && S.lm.list; if (!l) return 0; let n = 0; for (const L of l) { if (L.full) n++; if (L.lod) n++; } return n; };
  const AQ = () => (window.__fsDbg && window.__fsDbg.AQ) || {};
  function snap() {   // lo que se compara entre un fotograma y el siguiente
    const G = getGame();
    return { tiles: S.tiles ? S.tiles.size : 0, built: S.built ? S.built.length : 0, pend: S.pending ? S.pending.size : 0, infl: S.inflight || 0,
      lm: lmLoaded(), heap: heap(), kills: G.kills || 0, en: 0, wave: G.wave || 0, prog: api.renderer.info.programs ? api.renderer.info.programs.length : 0,
      tex: api.renderer.info.memory.textures, geo: api.renderer.info.memory.geometries };
  }
  function newSec(t) { return { t: Math.round(t), n: 0, sum: 0, worst: 0, slow: 0 }; }
  return {
    start() {
      on = true; last = 0; secs = []; hitches = []; t0 = performance.now(); cur = newSec(0); prev = snap(); pf0 = Object.assign({}, S.pf || {});
    },
    stop() { on = false; },
    get on() { return on; },
    get lastSec() { return secs[secs.length - 1] || null; },
    /** Llamar al principio de HOOK.frame, en cada fotograma (también en pausa: así no cuenta como tirón) */
    tick(paused) {
      const now = performance.now();
      if (!on) { last = now; return; }
      const dt = last ? now - last : 0; last = now;
      const pf1 = S.pf || {};
      if (paused || S.waitT || document.hidden) { pf0 = Object.assign({}, pf1); prev = snap(); return; }
      const t = (now - t0) / 1000;
      if (t - cur.t >= 1) { secs.push(cur); if (secs.length > MAX_SEC) secs.shift(); const G = getGame(), A = AQ();
        Object.assign(cur, { fps: cur.n ? Math.round(1000 * cur.n / cur.sum) : 0, worst: Math.round(cur.worst), wave: G.wave, ph: G.phase === "rest" ? "r" : "f",
          en: G.enemies, wx: api.weather ? api.weather() : "", nt: +(api.SKY.night || 0).toFixed(1), pr: +api.renderer.getPixelRatio().toFixed(2), aq: A.lvl, tiles: S.tiles ? S.tiles.size : 0, heap: Math.round(heap()) });
        delete cur.sum; cur = newSec(t); }
      if (dt > 0 && dt < 5000) { cur.n++; cur.sum += dt; cur.worst = Math.max(cur.worst, dt); if (dt > HITCH) cur.slow++; }
      if (dt > HITCH && dt < 5000 && hitches.length < MAX_HITCH) {
        const s = snap(), G = getGame(), A = AQ();
        const top = Object.keys(pf1).map(k => [k, pf1[k] - (pf0[k] || 0)]).filter(x => x[1] > 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}:${Math.round(v)}`);
        hitches.push({ t: +t.toFixed(1), ms: Math.round(dt), top,
          d: { tiles: s.tiles - prev.tiles, built: s.built - prev.built, lm: s.lm - prev.lm, heapMB: +(s.heap - prev.heap).toFixed(1), kills: s.kills - prev.kills, prog: s.prog - prev.prog, tex: s.tex - prev.tex, geo: s.geo - prev.geo },
          pend: s.pend, infl: s.infl, wave: G.wave, ph: G.phase, en: G.enemies, wx: api.weather ? api.weather() : "", nt: +(api.SKY.night || 0).toFixed(2),
          pr: +api.renderer.getPixelRatio().toFixed(2), aq: A.lvl, cam: S.flight ? Math.round(S.flight.pos.y - api.groundAt(S.flight.pos.x, S.flight.pos.z)) : null });
      }
      pf0 = Object.assign({}, pf1); prev = snap();
    },
    report(extra = {}) {
      const all = secs.concat(cur && cur.n ? [cur] : []);
      const fps = all.map(s => s.fps || 0).filter(Boolean).sort((a, b) => a - b);
      let gpu = ""; try { const gl = api.renderer.getContext(), e = gl.getExtension("WEBGL_debug_renderer_info"); gpu = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : ""; } catch { }
      return { date: new Date().toISOString(), gpu, screen: [innerWidth, innerHeight, devicePixelRatio], canvas: [api.renderer.domElement.width, api.renderer.domElement.height],
        q: S.sel && S.sel.q, durationS: all.length, fpsMed: fps[fps.length >> 1] || 0, fpsP5: fps[Math.floor(fps.length * 0.05)] || 0,
        hitchCount: hitches.length, ...extra, secs: all, hitches };
    },
  };
}
