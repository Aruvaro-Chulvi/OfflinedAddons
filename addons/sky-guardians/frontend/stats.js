/* ═══════════════════════════════════════════════════════════════════════════
   🏆 Sky Guardians — partidas, ranking, logros y rangos
   Todo en el almacenamiento del addon (/api/addons/sky-guardians/storage, en los datos de Offlined).
   Cada partida guarda el perfil de Offlined que la jugó (id y nombre): el ranking puede verse de todos
   (ranking familiar) o solo del perfil activo.
   ═══════════════════════════════════════════════════════════════════════════ */

const ID = "sky-guardians";
const MAX_RUNS = 300;

// Rangos de piloto por la mejor oleada alcanzada (en cualquier dificultad)
export const RANKS = [
  { id: "cadet", wave: 0 }, { id: "pilot", wave: 5 }, { id: "lieutenant", wave: 10 },
  { id: "captain", wave: 15 }, { id: "ace", wave: 20 }, { id: "guardian", wave: 30 },
];
// Partida diaria: el día local (AAAA-MM-DD) y su semilla (las mismas oleadas para todos ese día)
export function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function daySeed(day = today()) { let h = 2166136261; for (const c of "sky-guardians:" + day) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; }
const modeOf = r => r.mode || "survival";
export function rankFor(bestWave) { let r = RANKS[0]; for (const k of RANKS) if (bestWave >= k.wave) r = k; return r; }
export function nextRank(bestWave) { return RANKS.find(k => k.wave > bestWave) || null; }

// 33 logros. test(run, tot, ctx): run = la partida que acaba de terminar, tot = acumulados del perfil (ya con ella)
export const ACHIEVEMENTS = [
  { id: "first_blood", icon: "🎯", test: (r, T) => T.kills >= 1 },
  { id: "wave5", icon: "5️⃣", test: r => r.wave >= 5 },
  { id: "wave10", icon: "🔟", test: r => r.wave >= 10 },
  { id: "wave15", icon: "🛡️", test: r => r.wave >= 15 },
  { id: "wave20", icon: "🏅", test: r => r.wave >= 20 },
  { id: "wave30", icon: "👑", test: r => r.wave >= 30 },
  { id: "boss1", icon: "💥", test: (r, T) => (T.killsBy.boss || 0) >= 1 },
  { id: "boss5", icon: "☄️", test: (r, T) => (T.killsBy.boss || 0) >= 5 },
  { id: "drones100", icon: "🐝", test: (r, T) => (T.killsBy.drone || 0) >= 100 },
  { id: "kills500", icon: "✈️", test: (r, T) => T.kills >= 500 },
  { id: "streak4", icon: "🔥", test: r => r.bestStreak >= 4 },
  { id: "kit1", icon: "🔧", test: (r, T) => T.kits >= 1 },
  { id: "kits10", icon: "🧰", test: r => r.kits >= 10 },
  { id: "perfect5", icon: "🏰", test: r => r.perfectUpTo >= 5 },
  { id: "perfect10", icon: "🏯", test: r => r.perfectUpTo >= 10 },
  { id: "survive30", icon: "⏱️", test: r => r.time >= 1800 },
  { id: "sharpshooter", icon: "🎖️", test: r => r.shots >= 200 && r.accuracy >= 0.5 },
  { id: "cruise10", icon: "🚀", test: (r, T) => (T.killsBy.cruise || 0) >= 10 },
  { id: "heli20", icon: "🚁", test: (r, T) => (T.killsBy.heli || 0) >= 20 },
  { id: "bomber20", icon: "💣", test: (r, T) => (T.killsBy.bomber || 0) >= 20 },
  { id: "hard10", icon: "⚔️", test: r => r.diff === "hard" && r.wave >= 10 },
  { id: "both_planes", icon: "🛩️", test: (r, T) => T.wave5Planes.length >= 2 },
  { id: "score100k", icon: "💯", test: r => r.score >= 100000 },
  { id: "games10", icon: "🎮", test: (r, T) => T.games >= 10 },
  { id: "last_stand", icon: "🗼", test: r => r.lastStand },
  { id: "trained", icon: "🎓", test: (r, T) => !!T.trained },
  { id: "short_win", icon: "🏁", test: r => r.mode === "short" && r.won },
  { id: "short_hard", icon: "🏆", test: r => r.mode === "short" && r.won && r.diff === "hard" },
  { id: "daily1", icon: "📅", test: (r, T) => (T.dailyDays || []).length >= 1 },
  { id: "daily7", icon: "🗓️", test: (r, T) => (T.dailyDays || []).length >= 7 },
  // v1.1
  { id: "flares10", icon: "🎆", test: (r, T) => (T.dodged || 0) >= 10 },
  { id: "monument10", icon: "🏛️", test: r => !!r.lm && r.wave >= 10 },
  { id: "night10", icon: "🦉", test: r => r.weather === "night" && r.wave >= 10 },
];

// Registro de rendimiento (perf.js) solo para depurar: panel.html?perf o
// localStorage «sg-perf» = "1". Antes se guardaba en cada partida (~240 KB, con
// el nombre de la tarjeta gráfica) en el almacén del addon.
const PERF_DEBUG = (() => {
  try { return new URLSearchParams(location.search).has("perf") || localStorage.getItem("sg-perf") === "1"; } catch { return false; }
})();

// Reglas de puntuación: desde la 1.3 (arena, puertas Flow, vuelo rasante, reto diario en la arena) las partidas
// no se comparan con las de antes. Las anteriores (sin «rules») siguen en el historial y cuentan para logros y rango
export const RULES = 2;
const sameRules = r => (r.rules || 1) === RULES;

export function createStats() {
  let data = { v: 1, runs: [], totals: {}, ach: {} };
  let user = { id: "local", name: "" };
  // Solo se guarda si el almacén se leyó bien: si la lectura falló (backend
  // ocupado, error), guardar los valores por defecto borraría para siempre el
  // ranking y los logros de toda la familia.
  let loaded = false;
  const ready = (async () => {
    try { const s = await fetch("/api/users/session").then(r => r.json()); const u = (s.users || []).find(x => x.id === (s.active || s.last_user)); if (u) user = { id: u.id, name: u.name, color: u.color }; } catch { }
    try {
      const res = await fetch(`/api/addons/${ID}/storage`);
      if (res.ok) {
        const r = await res.json();
        if (r && r.data && r.data.v) data = Object.assign(data, r.data);
        loaded = true;
      }
    } catch { }
  })();
  const save = () => {
    if (!loaded) return Promise.resolve();
    if (!PERF_DEBUG) delete data.perf;   // limpia el registro que guardaban las versiones anteriores
    return fetch(`/api/addons/${ID}/storage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) }).catch(() => { });
  };
  const tot = uid => (data.totals[uid] ||= { games: 0, kills: 0, killsBy: {}, kits: 0, time: 0, bestWave: 0, bestScore: 0, wave5Planes: [], trained: false });
  const achOf = uid => (data.ach[uid] ||= {});

  return {
    ready,
    get user() { return user; },
    /** Mejor partida del perfil activo en esa dificultad (o en todas) */
    best(diff, mode = "survival") {
      const l = data.runs.filter(r => sameRules(r) && r.uid === user.id && modeOf(r) === mode && (mode === "daily" ? r.day === today() : !diff || r.diff === diff));
      return l.reduce((b, r) => (!b || r.score > b.score ? r : b), null);
    },
    totals() { return tot(user.id); },
    achievements() { return achOf(user.id); },
    rank() { return rankFor(tot(user.id).bestWave); },
    /** Ranking: las mejores 10 de una dificultad; mine = solo del perfil activo */
    top(diff, mine = false, mode = "survival") {
      let l = data.runs.filter(r => sameRules(r) && modeOf(r) === mode && (mode === "daily" ? r.day === today() : r.diff === diff) && (!mine || r.uid === user.id));
      l.sort((a, b) => b.score - a.score || b.wave - a.wave);
      if (mode === "daily" && !mine) { const seen = new Set(); l = l.filter(r => !seen.has(r.uid) && seen.add(r.uid)); }   // diaria: la mejor de cada uno
      return l.slice(0, 10);
    },
    /** ¿Hay partidas con las reglas de antes de la 1.3? (para avisar en el ranking) */
    hasOldRuns() { return data.runs.some(r => !sameRules(r)); },
    history(n = 20) { return data.runs.filter(r => r.uid === user.id).slice(-n).reverse(); },
    /** Guarda la partida; devuelve { run, record, place, newAch: [ids], rankUp } */
    addRun(stats, extra) {
      const { hpLog, waveTimes, ...keep } = stats;   // la gráfica de la torre no se guarda (solo para los resultados)
      const run = { uid: user.id, name: user.name, date: new Date().toISOString(), ...extra, ...keep, rules: RULES };
      run.mode = modeOf(run);
      const prevBest = this.best(run.diff, run.mode);
      const T = tot(user.id), rank0 = rankFor(T.bestWave);
      T.games++; T.kills += run.kills; T.kits += run.kits; T.time += run.time;
      T.dodged = (T.dodged || 0) + (run.dodged || 0);
      for (const [k, n] of Object.entries(run.killsBy)) T.killsBy[k] = (T.killsBy[k] || 0) + n;
      T.bestWave = Math.max(T.bestWave, run.wave); T.bestScore = Math.max(T.bestScore, run.score);
      if (run.wave >= 5 && !T.wave5Planes.includes(run.plane)) T.wave5Planes.push(run.plane);
      if (run.mode === "daily" && run.day && !(T.dailyDays ||= []).includes(run.day)) T.dailyDays.push(run.day);
      if (run.mode === "short" && run.won) T.shortWins = (T.shortWins || 0) + 1;
      data.runs.push(run); if (data.runs.length > MAX_RUNS) data.runs.splice(0, data.runs.length - MAX_RUNS);
      const newAch = this.checkAch(run);
      const place = this.top(run.diff, false, run.mode).indexOf(run) + 1;
      save();
      const rank1 = rankFor(T.bestWave);
      return { run, record: !prevBest || run.score > prevBest.score, prevBest, place, newAch, rankUp: rank1.id !== rank0.id ? rank1 : null };
    },
    checkAch(run) {
      const A = achOf(user.id), T = tot(user.id), out = [];
      for (const a of ACHIEVEMENTS) if (!A[a.id] && a.test(run || {}, T)) { A[a.id] = new Date().toISOString(); out.push(a.id); }
      return out;
    },
    /** Registro de rendimiento de la última partida (perf.js): data.perf, para encontrar tirones */
    savePerf(r) { if (!PERF_DEBUG) return; data.perf = r; save(); },
    /** Entrenamiento terminado */
    trained() { const T = tot(user.id); T.trained = true; const n = this.checkAch({ killsBy: {} }); save(); return n; },
  };
}
