/* Card movement for the Spanish card games (Escoba, Mus). MIT licence.
 *
 * A card "flies" as a copy drawn on a layer above the table, from where it was to where it ends up. The real card
 * at the destination stays hidden until the copy lands. Each flight can play its sound when it starts or lands,
 * so what you hear and what you see happen together. Respects «reduce motion» (cards then just appear).
 */
(function (root) {
  'use strict';
  let layer = null, token = 0, pending = [], speed = 1;
  const reduced = () => { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div');
    layer.className = 'cfx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:15;overflow:hidden';
    document.body.appendChild(layer);
    return layer;
  }
  /** Rectangle of an element, or a rect passed through. */
  function rect(x) {
    if (!x) return null;
    if (x instanceof Element) { const r = x.getBoundingClientRect(); return r.width || r.height ? { left: r.left, top: r.top, width: r.width, height: r.height } : null; }
    return x;
  }
  /** A card-sized rect centred on an element (for a deck in the middle of the table). */
  function centreOf(el, w, h) {
    const r = el && el.getBoundingClientRect();
    if (!r) return null;
    return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h };
  }
  function hide(els) { for (const el of els) if (el) el.style.visibility = 'hidden'; }
  function show(els) { for (const el of els) if (el) el.style.visibility = ''; }

  /** Resolve after ms, or straight away if everything was cancelled. */
  function wait(ms) {
    const tok = token;
    return new Promise((res) => {
      const id = setTimeout(() => { pending = pending.filter((p) => p.id !== id); res(tok === token); }, ms * (reduced() ? 0.3 : speed));
      pending.push({ id, res });
    });
  }

  /**
   * Fly a card.
   * o = {from: rect|el, to: rect|el, html, delay (ms), dur (ms), fade (bool), hideTarget (default true when `to` is an element),
   *      onStart(), onLand()}
   * Resolves true when it landed, false when cancelled.
   */
  function fly(o) {
    const tok = token;
    const lay = ensureLayer();
    const toEl = o.to instanceof Element ? o.to : null;
    const fr = rect(o.from), tr0 = rect(o.to);
    const hideT = toEl && o.hideTarget !== false;
    if (hideT) toEl.style.visibility = 'hidden';
    const k = reduced() ? 0.3 : speed;
    const delay = (o.delay || 0) * k, dur = reduced() ? 1 : (o.dur || 280) * speed;
    return new Promise((res) => {
      const rec = { res, el: null, anim: null, toEl: hideT ? toEl : null };
      const finish = (landed) => {
        pending = pending.filter((p) => p !== rec);
        if (rec.el) rec.el.remove();
        if (rec.toEl) rec.toEl.style.visibility = '';
        if (landed && o.onLand) try { o.onLand(); } catch (_) {}
        res(landed);
      };
      rec.finish = finish;
      rec.id = setTimeout(() => {
        if (tok !== token) return finish(false);
        // measure the destination at launch: earlier landings may have moved things
        const tr = toEl ? rect(toEl) || tr0 : tr0;
        if (o.onStart) try { o.onStart(); } catch (_) {}
        if (!fr || !tr) return finish(true);
        const el = document.createElement('div');
        el.className = 'cfx-card';
        el.style.cssText = `position:absolute;left:${fr.left}px;top:${fr.top}px;width:${fr.width}px;height:${fr.height}px;transform-origin:0 0;will-change:transform,opacity`;
        el.innerHTML = o.html || '';
        lay.appendChild(el);
        rec.el = el;
        const dx = tr.left - fr.left, dy = tr.top - fr.top, sx = tr.width / fr.width, sy = tr.height / fr.height;
        rec.anim = el.animate([
          { transform: 'translate(0,0) scale(1,1)', opacity: 1 },
          { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, opacity: o.fade ? 0 : 1 },
        ], { duration: dur, easing: 'cubic-bezier(.25,.75,.35,1)', fill: 'forwards' });
        rec.anim.onfinish = () => finish(tok === token);
      }, delay);
      pending.push(rec);
    });
  }

  /** Stop every flight and timer now (new game, closing the addon). Hidden cards are shown again. */
  function cancel() {
    token++;
    const list = pending; pending = [];
    for (const p of list) {
      clearTimeout(p.id);
      if (p.anim) try { p.anim.cancel(); } catch (_) {}
      if (p.finish) p.finish(false); else p.res(false);
    }
    if (layer) layer.innerHTML = '';
  }
  /** Animation speed: 1 normal, >1 slower, <1 faster. */
  function setSpeed(k) { speed = k > 0 ? k : 1; }
  const busy = () => pending.length > 0;

  root.CardFX = { fly, wait, cancel, rect, centreOf, hide, show, setSpeed, busy, reduced };
})(typeof self !== 'undefined' ? self : this);
