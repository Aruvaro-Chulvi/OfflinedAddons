/* Runs the sudoku generator off the main thread, in time slices so it can share the CPU and be stopped.
 * Messages in:  {type:'generate', id, level, seed, slice?, rest?}  ·  {type:'cancel'}
 * Messages out: {type:'progress', id, info}  ·  {type:'done', id, result}  ·  {type:'error', id, message}
 */
importScripts('engine/sudoku-engine.js');

let job = null;

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === 'cancel') { job = null; return; }
  if (m.type === 'generate') {
    job = { id: m.id, it: self.SudokuEngine.generate(m.level, m.seed >>> 0), slice: m.slice || 60, rest: m.rest || 0 };
    setTimeout(run, 0);
  }
};

function run() {
  const j = job;
  if (!j) return;
  const t0 = Date.now();
  let r = null;
  try {
    while (Date.now() - t0 < j.slice) {
      r = j.it.next();
      if (r.done) {
        if (job === j) { job = null; self.postMessage({ type: 'done', id: j.id, result: r.value }); }
        return;
      }
    }
  } catch (err) {
    if (job === j) job = null;
    self.postMessage({ type: 'error', id: j.id, message: String(err && err.message || err) });
    return;
  }
  if (job !== j) return;
  self.postMessage({ type: 'progress', id: j.id, info: r && r.value });
  setTimeout(run, j.rest);
}
