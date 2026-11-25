/* ═══════════════════════════════════════════════════════════════════════════
   🔊 Arcade Flow Sky Defender — sonido y música (efectos sintetizados con Web Audio)
   · Efectos: armas, cohetes, misiles, fijado, impactos, explosiones (con distancia), daño recibido, alarma de
     torre, derrumbe, oleadas, kits, jefe, enemigo en la cola…
   · Música: calma generada (la mía) en el menú y en el respiro; en la oleada, «Drum and bass» de bertsz
     (OpenGameArt, CC0, music/combat_dnb.ogg, 1:36 en bucle exacto) con fundido cruzado. Si la pista no carga,
     el combate usa la música generada de antes (con más capas en peligro). Progresión menor i–VI–III–VII a 112 ppm.
   · Tu música (1.3.0): con Offlined 4 se puede cambiar toda la música del juego por una canción de Música (en
     bucle) o una lista de reproducción (en bucle). Lo hace el módulo de Offlined /games-common/user-music.js;
     con un Offlined que no lo tenga, el juego suena como siempre.
   · Vibración del mando (Gamepad vibrationActuator), si el mando la tiene.
   ═══════════════════════════════════════════════════════════════════════════ */

// Módulo de Offlined para la música del jugador (null si este Offlined no lo trae)
const UM = import("/games-common/user-music.js?v=1.1.0").catch(() => null);

export function createAudio() {
  let ctx = null, master, sfx, mus, syn, trk, comp, noiseBuf, orig, usr;
  let choice = null, uplayer = null, um = null;      // tu música: la elección, lo que suena y el módulo
  const vol = { sfx: 0.8, music: 0.5 };
  try { const v = JSON.parse(localStorage.getItem("sg_vol") || "{}"); Object.assign(vol, v); } catch { }
  let hidden = false, muted = false, gm = false;   // muted: botón 🔊 / tecla M de Wiki Flight (HOOK.mute) · gm: silencio general de Offlined
  const gain = () => (muted || gm ? 0 : 0.9);
  addEventListener("message", e => { if (e.origin === location.origin && e.data && e.data.type === "ofl:mute") { gm = !!e.data.on; if (master) master.gain.setTargetAtTime(gain(), ctx.currentTime, 0.05); } });

  function init() {
    if (ctx) { if (ctx.state === "suspended" && !hidden) ctx.resume().catch(() => { }); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = gain(); master.connect(comp);
    sfx = ctx.createGain(); sfx.gain.value = vol.sfx; sfx.connect(master);
    mus = ctx.createGain(); mus.gain.value = vol.music * 0.55; mus.connect(master);
    orig = ctx.createGain(); orig.gain.value = 1; orig.connect(mus);       // la música del juego (se calla con la tuya)
    usr = ctx.createGain(); usr.gain.value = 1; usr.connect(mus);          // tu música
    syn = ctx.createGain(); syn.gain.value = 1; syn.connect(orig);         // música generada
    trk = ctx.createGain(); trk.gain.value = 0; trk.connect(orig);         // pista de combate
    loadTrack();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  // Con Offlined en otra sección o la pestaña oculta, en silencio
  const hold = () => { if (!ctx) return; if (hidden || document.hidden) ctx.suspend().catch(() => { }); else ctx.resume().catch(() => { }); };
  addEventListener("visibilitychange", hold);
  addEventListener("message", ev => { if (ev.origin === location.origin && ev.data && ev.data.type === "ofl:visible") { hidden = !ev.data.on; hold(); } });

  // ── Piezas ──
  const now = () => ctx.currentTime;
  function env(g, t, a, peak, dec, sus = 0.0001) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec); }
  function noise(t, dur, { type = "bandpass", f = 1000, q = 1, f2 = null, peak = 0.5, a = 0.003, out = sfx, pan = 0 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    let node = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    s.connect(fl).connect(g); node.connect(out);
    s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
  }
  function tone(t, dur, { type = "sine", f = 440, f2 = null, peak = 0.3, a = 0.005, out = sfx, sus = 0.0001, filter = null } = {}) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); env(g, t, a, peak, dur, sus);
    let n = o; if (filter) { const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = filter; o.connect(fl); n = fl; }
    n.connect(g).connect(out); o.start(t); o.stop(t + a + dur + 0.05);
  }
  const ok = () => init() && ctx.state !== "closed";
  const dist = d => Math.max(0.05, Math.min(1, 300 / Math.max(300, d)));   // atenuación por distancia (m)

  // ── Efectos ──
  const lastAt = {};
  const throttle = (k, s) => { const t = performance.now(); if (lastAt[k] && t - lastAt[k] < s * 1000) return false; lastAt[k] = t; return true; };
  const FX = {
    gun() { const t = now(); noise(t, 0.05, { f: 1500, q: 0.8, peak: 0.22 }); noise(t, 0.04, { type: "lowpass", f: 400, peak: 0.25 }); },
    cannon() { const t = now(); noise(t, 0.04, { f: 900, q: 0.7, peak: 0.2 }); tone(t, 0.05, { type: "square", f: 140, f2: 70, peak: 0.08, filter: 800 }); },
    rocket() { const t = now(); noise(t, 0.5, { f: 700, f2: 2500, q: 0.6, peak: 0.25, a: 0.01 }); noise(t, 0.12, { type: "lowpass", f: 200, peak: 0.3 }); },
    missile() { const t = now(); noise(t, 0.9, { f: 500, f2: 1800, q: 0.5, peak: 0.3, a: 0.03 }); tone(t, 0.6, { type: "sawtooth", f: 220, f2: 660, peak: 0.05, filter: 1200 }); },
    lock() { const t = now(); tone(t, 0.07, { type: "square", f: 1320, peak: 0.07, filter: 3000 }); },
    locking() { if (throttle("locking", 0.18)) { const t = now(); tone(t, 0.04, { type: "square", f: 880, peak: 0.04, filter: 2500 }); } },
    hit() { if (throttle("hit", 0.05)) { const t = now(); tone(t, 0.03, { type: "triangle", f: 2600, peak: 0.08 }); } },
    explosion(d = 0, size = 1) {
      const t = now(), k = dist(d) * Math.min(1.5, size);
      noise(t, 1.1 * size, { type: "lowpass", f: 900, f2: 120, peak: 0.55 * k, a: 0.005 });
      tone(t, 0.8 * size, { f: 90, f2: 32, peak: 0.6 * k, a: 0.004 });
      noise(t + 0.02, 0.25, { f: 2500, q: 0.5, peak: 0.12 * k });
    },
    playerHit() { if (throttle("phit", 0.08)) { const t = now(); noise(t, 0.12, { f: 3000, q: 3, peak: 0.25 }); tone(t, 0.1, { type: "square", f: 300, f2: 180, peak: 0.08, filter: 1500 }); } },
    shieldDown() { const t = now(); tone(t, 0.35, { type: "sawtooth", f: 900, f2: 200, peak: 0.08, filter: 2000 }); },
    lowHull() { if (throttle("lowhull", 1.2)) { const t = now(); tone(t, 0.12, { type: "square", f: 660, peak: 0.07, filter: 2000 }); tone(t + 0.2, 0.12, { type: "square", f: 660, peak: 0.07, filter: 2000 }); } },
    tail() { if (throttle("tail", 0.9)) { const t = now(); tone(t, 0.09, { type: "square", f: 1046, peak: 0.05, filter: 3000 }); tone(t + 0.12, 0.09, { type: "square", f: 784, peak: 0.05, filter: 3000 }); } },
    towerAlarm() { const t = now(); for (let i = 0; i < 3; i++) { tone(t + i * 0.5, 0.24, { type: "sawtooth", f: 700, peak: 0.07, filter: 1800, a: 0.02 }); tone(t + i * 0.5 + 0.25, 0.24, { type: "sawtooth", f: 940, peak: 0.07, filter: 1800, a: 0.02 }); } },
    collapse() { const t = now(); noise(t, 3.2, { type: "lowpass", f: 600, f2: 80, peak: 0.6, a: 0.05 }); tone(t, 2.5, { type: "sawtooth", f: 120, f2: 40, peak: 0.12, filter: 400 }); tone(t + 0.3, 1.8, { type: "triangle", f: 420, f2: 180, peak: 0.05 }); },
    waveStart() { const t = now(); for (const [f, d] of [[220, 0], [277, 0], [330, 0], [440, 0.35]]) tone(t + d, 0.9, { type: "sawtooth", f, peak: 0.05, a: 0.06, filter: 1400 }); },
    waveDone() { const t = now(); [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.11, 0.35, { type: "triangle", f, peak: 0.08 })); },
    kit() { const t = now(); [784, 988, 1318].forEach((f, i) => tone(t + i * 0.08, 0.25, { type: "triangle", f, peak: 0.08 })); },
    repair() { const t = now(); [523, 784, 1046, 1568].forEach((f, i) => tone(t + i * 0.09, 0.4, { type: "sine", f, peak: 0.1 })); },
    boss() { const t = now(); for (const f of [55, 82.5, 110]) tone(t, 2.2, { type: "sawtooth", f, peak: 0.08, a: 0.3, filter: 700 }); },
    record() { const t = now(); [659, 784, 988, 1318].forEach((f, i) => tone(t + i * 0.1, 0.5, { type: "triangle", f, peak: 0.09 })); },
    saved() { if (throttle("saved", 0.3)) { const t = now(); [880, 1175].forEach((f, i) => tone(t + i * 0.07, 0.18, { type: "triangle", f, peak: 0.07 })); } },
    powerup() { const t = now(); [523, 659, 784, 1046, 1318].forEach((f, i) => tone(t + i * 0.05, 0.22, { type: "square", f, peak: 0.05, filter: 3000 })); },
    aa(d = 0) { const k = Math.max(0, 1 - d / 2500); if (k > 0.02 && throttle("aa", 0.09)) { const t = now(); noise(t, 0.05, { f: 1100, q: 0.8, peak: 0.13 * k }); noise(t, 0.04, { type: "lowpass", f: 300, peak: 0.12 * k }); } },
    click() { const t = now(); tone(t, 0.03, { type: "triangle", f: 1800, peak: 0.04 }); },
    // v1.1: bengalas y misiles contra ti
    flare() { const t = now(); for (let i = 0; i < 3; i++) { noise(t + i * 0.07, 0.18, { f: 2400, f2: 900, q: 0.8, peak: 0.12 }); tone(t + i * 0.07, 0.08, { type: "square", f: 520, peak: 0.03, filter: 1800 }); } },
    empty() { if (throttle("empty", 0.3)) { const t = now(); tone(t, 0.06, { type: "square", f: 180, peak: 0.05, filter: 900 }); } },
    missileLaunch(d = 0) { const t = now(), k = dist(d); noise(t, 0.8, { f: 600, f2: 1600, q: 0.6, peak: 0.25 * k, a: 0.02 }); },
    missileWarn() { if (throttle("mwarn", 0.32)) { const t = now(); tone(t, 0.12, { type: "square", f: 1480, peak: 0.06, filter: 3500 }); } },
  };
  function play(name, ...args) { if (!ok() || !FX[name]) return; try { FX[name](...args); } catch { } }

  // ── Música adaptativa ──
  // 16 pasos por compás; acordes de 1 compás: Am, F, C, G
  const BPM = 112, STEP = 60 / BPM / 4;
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // MIDI
  const BASS = [45, 41, 36, 43];
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const M = { on: false, step: 0, next: 0, level: 0, want: 0, timer: null, bar: 0 };   // level 0 calma · 1 combate · 2 peligro
  function voice(t, f, dur, type, peak, cutoff, a = 0.005) { tone(t, dur, { type, f, peak, a, out: syn, filter: cutoff }); }
  function schedule() {
    if (!ctx || ctx.state !== "running") return;
    while (M.next < ctx.currentTime + 0.12) {
      const t = M.next, s = M.step % 16, bar = Math.floor(M.step / 16) % 4, ch = CHORDS[bar], L = M.level;
      if (trackOn && syn.gain.value < 0.001) { M.step++; M.next += STEP; if (M.step % 16 === 0) M.level = M.want; continue; }   // sonando la pista: no generar voces mudas
      // pad (siempre): el acorde al principio de cada compás
      if (s === 0) for (const n of ch) { voice(t, hz(n), STEP * 15, "sawtooth", 0.018, 900, 0.4); voice(t, hz(n) * 1.004, STEP * 15, "sawtooth", 0.014, 900, 0.4); }
      // arpegio: en calma, corcheas suaves; en combate, semicorcheas
      if (L === 0 ? s % 2 === 0 : true) { const n = ch[(s >> (L === 0 ? 1 : 0)) % 3] + 12 * (s % 8 < 4 ? 1 : 2); voice(t, hz(n), STEP * 0.9, "triangle", L === 0 ? 0.03 : 0.035, 3000); }
      if (L >= 1) {
        // bajo pulsado en corcheas, bombo en negras, caja en 2 y 4, hi-hat
        if (s % 2 === 0) voice(t, hz(BASS[bar] - 12 + (s % 8 === 6 ? 7 : 0)), STEP * 1.6, "sawtooth", 0.07, 420);
        if (s % 4 === 0) tone(t, 0.18, { f: 120, f2: 40, peak: 0.28, out: syn });
        if (s === 4 || s === 12) noise(t, 0.12, { f: 1800, q: 0.7, peak: 0.12, out: syn });
        if (s % 2 === 1) noise(t, 0.03, { type: "highpass", f: 7000, peak: 0.04, out: syn });
      }
      if (L >= 2) {
        // peligro: hi-hats en semicorcheas, bombo doble y un lead que sube
        noise(t, 0.02, { type: "highpass", f: 9000, peak: 0.03, out: syn });
        if (s === 14) tone(t, 0.15, { f: 110, f2: 40, peak: 0.2, out: syn });
        if (s % 4 === 0) voice(t, hz(ch[(s / 4) % 3] + 24), STEP * 3.5, "square", 0.022, 2200, 0.02);
      }
      // los cambios de intensidad, solo al empezar un compás
      M.step++; M.next += STEP;
      if (M.step % 16 === 0) M.level = M.want;
    }
  }
  // ── Pista de combate (archivo): bucle exacto con AudioBufferSourceNode.loop; entra y sale con fundido ──
  const TRACK_URL = new URL("./music/combat_dnb.ogg", import.meta.url).href, TRACK_K = 0.9, FADE = 1.2;
  let trackBuf = null, trackSrc = null, trackOn = false;
  function loadTrack() {
    fetch(TRACK_URL).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(a => ctx.decodeAudioData(a))
      .then(buf => { trackBuf = buf; syncTrack(); }).catch(() => { trackBuf = null; });
  }
  function syncTrack() {
    if (!ctx || !trackBuf) return;
    const want = M.on && M.want >= 1, t = ctx.currentTime;
    if (want === trackOn) return;
    trackOn = want;
    trk.gain.cancelScheduledValues(t); syn.gain.cancelScheduledValues(t);
    trk.gain.setValueAtTime(trk.gain.value, t); syn.gain.setValueAtTime(syn.gain.value, t);
    if (want) {
      if (trackSrc) { try { trackSrc.stop(); } catch { } }
      trackSrc = ctx.createBufferSource(); trackSrc.buffer = trackBuf; trackSrc.loop = true; trackSrc.connect(trk); trackSrc.start(t + 0.02);
      trk.gain.linearRampToValueAtTime(TRACK_K, t + 0.35); syn.gain.linearRampToValueAtTime(0, t + FADE);
    } else {
      trk.gain.linearRampToValueAtTime(0, t + FADE); syn.gain.linearRampToValueAtTime(1, t + FADE);
      const s = trackSrc; trackSrc = null; if (s) { try { s.stop(t + FADE + 0.05); } catch { } }
    }
  }
  function music(on) {
    if (on && !M.on) { if (!ok()) return; M.on = true; M.next = ctx.currentTime + 0.1; M.step = 0; M.timer = setInterval(schedule, 30); }
    else if (!on && M.on) { M.on = false; clearInterval(M.timer); }
    syncTrack(); syncUser();
  }
  // ── Tu música: suena mientras haya música (menú, respiro y oleadas) y la del juego calla ──
  UM.then(m => { um = m; if (m) return m.getGameMusic("sky-guardians").then(c => { choice = c; syncUser(); }); }).catch(() => { });
  function syncUser() {
    if (!ctx || !um) return;
    const want = !!(M.on && choice), t = ctx.currentTime;
    if (want && !uplayer) {
      const ch = choice;
      uplayer = um.playUserMusic(ctx, usr, ch, { fadeIn: 1.2, onFail: () => { if (choice === ch) { choice = null; uplayer = null; syncUser(); } } });
    } else if (!want && uplayer) { uplayer.stop(1); uplayer = null; }
    orig.gain.cancelScheduledValues(t); orig.gain.setValueAtTime(orig.gain.value, t);
    orig.gain.linearRampToValueAtTime(uplayer ? 0 : 1, t + 1);
  }
  function setChoice(c) { choice = c; if (uplayer) { uplayer.stop(0.6); uplayer = null; } syncUser(); }

  // ── Vibración del mando ──
  function rumble(strong, weak, ms) {
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null;
    const a = gp && gp.vibrationActuator;
    if (a && a.playEffect) a.playEffect("dual-rumble", { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => { });
  }

  return {
    init, play, music, rumble,
    get state() { return { ctx: ctx ? ctx.state : "none", music: M.on, level: M.level, want: M.want, track: !!trackBuf, trackOn, user: !!uplayer }; },   // pruebas
    // Tu música (para Ajustes): null si este Offlined no trae el módulo
    userMusic: () => um && um.canPickMusic() ? {
      mod: um, game: "sky-guardians", get: () => choice,
      pick: async () => { const r = await um.pickGameMusic("sky-guardians"); if (r) setChoice(r.choice); },
      original: () => setChoice(null),
    } : null,
    intensity(level) { M.want = level; syncTrack(); },
    setVolume(kind, v) { vol[kind] = v; try { localStorage.setItem("sg_vol", JSON.stringify(vol)); } catch { } if (ctx) { sfx.gain.value = vol.sfx; mus.gain.value = vol.music * 0.55; } },
    get volume() { return { ...vol }; },
    setMuted(m) { muted = !!m; if (master) master.gain.setTargetAtTime(gain(), ctx.currentTime, 0.05); },
  };
}
