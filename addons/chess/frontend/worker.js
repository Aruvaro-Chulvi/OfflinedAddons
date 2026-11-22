/* Thinks for the computer off the main thread. To stop a search, the page terminates this worker.
 * In:  {type:'think', id, moves:[uci], level, timeMs?}  ·  {type:'draw', id, moves, engineColor}
 * Out: {type:'move', id, result:{uci, score, depth}}   ·  {type:'draw', id, accept}
 */
importScripts('engine/chess-engine.js');

self.onmessage = (e) => {
  const m = e.data || {};
  try {
    if (m.type === 'think') {
      const result = self.ChessEngine.think(m.moves || [], m.level, { timeMs: m.timeMs });
      self.postMessage({ type: 'move', id: m.id, result });
    } else if (m.type === 'draw') {
      self.postMessage({ type: 'draw', id: m.id, accept: self.ChessEngine.acceptsDraw(m.moves || [], m.engineColor) });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String((err && err.message) || err) });
  }
};
