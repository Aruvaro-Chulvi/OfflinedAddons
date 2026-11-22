/* Offlined — importar hojas de cálculo al addon Hoja de cálculo (MIT).
 *
 * Convierte a una hoja de Univer (IWorkbookData):
 *   .xlsx/.xlsm  → ExcelJS (MIT, vendor/exceljs.min.js)
 *   .ods         → lector propio del XML de OpenDocument (zip con vendor/fflate.min.js, MIT)
 *   .csv / .tsv  → lector propio (separador y codificación automáticos)
 * Se conservan valores, fórmulas, fechas, estilos (fuente, negrita, colores, bordes,
 * alineación, ajuste), formatos de número, celdas combinadas, anchos y altos,
 * filas/columnas ocultas, paneles inmovilizados, color de pestaña, notas, enlaces y
 * listas desplegables. No se importan gráficos, imágenes, formato condicional ni macros.
 * Las librerías se cargan solo al importar.
 */
(function () {
  "use strict";

  const ACCEPT = ".xlsx,.xlsm,.ods,.csv,.tsv,.txt";
  const extOf = name => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
  function kindOf(file) {
    const e = extOf(file.name);
    if (e === "xlsx" || e === "xlsm") return "xlsx";
    if (e === "ods") return "ods";
    if (e === "csv" || e === "tsv" || e === "txt") return "csv";
    if (e === "xls" || e === "xlsb" || e === "numbers" || e === "wks") return "legacy";
    return null;
  }

  const loaded = {};
  function load(src, global) {
    if (global && window[global]) return Promise.resolve();
    if (!loaded[src]) loaded[src] = new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = () => fail(new Error("load " + src));
      document.head.append(s);
    });
    return loaded[src];
  }
  function decodeText(buf) {
    const u8 = new Uint8Array(buf);
    if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder("utf-16le").decode(u8);
    if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder("utf-16be").decode(u8);
    try { return new TextDecoder("utf-8", { fatal: true }).decode(u8).replace(/^﻿/, ""); }
    catch (_) { return new TextDecoder("windows-1252").decode(u8); }
  }

  // ── Construcción de la hoja de Univer ──
  const T_STRING = 1, T_NUMBER = 2, T_BOOL = 3, T_FORCE_STRING = 4;
  function Builder(title) {
    const styles = {}, styleIds = new Map(), sheets = {}, order = [];
    const notes = {}, dv = {}, filters = {};
    let nSheet = 0, nStyle = 0, nId = 0;
    const uid = p => p + Date.now().toString(36) + (++nId).toString(36);
    return {
      sheet(name) {
        const id = "sheet" + (++nSheet);
        const sh = {
          id, name: String(name || "Hoja" + nSheet).slice(0, 100), tabColor: "", hidden: 0,
          freeze: { xSplit: 0, ySplit: 0, startRow: -1, startColumn: -1 },
          rowCount: 1000, columnCount: 26, zoomRatio: 1, scrollTop: 0, scrollLeft: 0,
          defaultColumnWidth: 88, defaultRowHeight: 24, mergeData: [], cellData: {}, rowData: {}, columnData: {},
          rowHeader: { width: 46, hidden: 0 }, columnHeader: { height: 20, hidden: 0 }, showGridlines: 1, rightToLeft: 0,
          _maxR: -1, _maxC: -1,
        };
        sheets[id] = sh; order.push(id);
        return sh;
      },
      style(st) {
        if (!st || !Object.keys(st).length) return null;
        const key = JSON.stringify(st);
        if (!styleIds.has(key)) { const id = "st" + (++nStyle); styleIds.set(key, id); styles[id] = st; }
        return styleIds.get(key);
      },
      cell(sh, r, c, cell) {
        if (!cell) return;
        (sh.cellData[r] = sh.cellData[r] || {})[c] = cell;
        if (r > sh._maxR) sh._maxR = r;
        if (c > sh._maxC) sh._maxC = c;
      },
      link(text, url) {
        const id = uid("lnk");
        return { id: uid("doc"), documentStyle: {}, body: { dataStream: text + "\r\n", paragraphs: [{ startIndex: text.length }],
          customRanges: [{ startIndex: 0, endIndex: Math.max(0, text.length - 1), rangeType: 0, rangeId: id, properties: { url } }] } };
      },
      note(sh, r, c, text) {
        if (!text) return;
        const s = (notes[sh.id] = notes[sh.id] || {});
        (s[r] = s[r] || {})[c] = { id: uid("note"), row: r, col: c, width: 216, height: 92, note: String(text), show: false };
      },
      validation(sh, rule) { (dv[sh.id] = dv[sh.id] || []).push(Object.assign({ uid: uid("dv") }, rule)); },
      filter(sh, ref) { filters[sh.id] = { ref }; },
      finish() {
        for (const id of order) {
          const sh = sheets[id];
          sh.rowCount = Math.max(1000, sh._maxR + 50);
          sh.columnCount = Math.max(26, sh._maxC + 6);
          delete sh._maxR; delete sh._maxC;
        }
        if (!order.length) this.sheet("Hoja1");
        const resources = [];
        if (Object.keys(notes).length) resources.push({ name: "SHEET_NOTE_PLUGIN", data: JSON.stringify(notes) });
        if (Object.keys(dv).length) resources.push({ name: "SHEET_DATA_VALIDATION_PLUGIN", data: JSON.stringify(dv) });
        if (Object.keys(filters).length) resources.push({ name: "SHEET_FILTER_PLUGIN", data: JSON.stringify(filters) });
        return { id: uid("wb"), name: title || "", appVersion: "0.21.1", locale: "enUS", styles, sheetOrder: order, sheets, resources };
      },
    };
  }

  // ── Utilidades ──
  const colIndex = letters => { let n = 0; for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  function decodeRange(a1) {
    const m = String(a1).replace(/\$/g, "").match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
    if (!m) return null;
    const r = { startRow: +m[2] - 1, startColumn: colIndex(m[1]) };
    r.endRow = m[4] ? +m[4] - 1 : r.startRow; r.endColumn = m[3] ? colIndex(m[3]) : r.startColumn;
    if (r.endRow < r.startRow) [r.startRow, r.endRow] = [r.endRow, r.startRow];
    if (r.endColumn < r.startColumn) [r.startColumn, r.endColumn] = [r.endColumn, r.startColumn];
    return r;
  }
  const dateSerial = d => (d.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
  // colores del tema de Office (2013+): bg1, tx1, bg2, tx2, accent1…6, hlink, folHlink
  const THEME = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "0563C1", "954F72"];
  function excelColor(c) {
    if (!c) return null;
    let hex = null;
    if (c.argb && /^[0-9a-f]{8}$/i.test(c.argb)) hex = c.argb.slice(2);
    else if (c.argb && /^[0-9a-f]{6}$/i.test(c.argb)) hex = c.argb;
    else if (c.theme != null && THEME[c.theme]) hex = THEME[c.theme];
    if (!hex) return null;
    if (c.tint) {
      const t = +c.tint;
      hex = [0, 2, 4].map(i => { let v = parseInt(hex.slice(i, i + 2), 16); v = t > 0 ? v + (255 - v) * t : v * (1 + t); return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"); }).join("");
    }
    return "#" + hex.toUpperCase();
  }
  const BORDER = { thin: 1, hair: 2, dotted: 3, dashed: 4, dashDot: 5, dashDotDot: 6, double: 7, medium: 8, mediumDashed: 9, mediumDashDot: 10, mediumDashDotDot: 11, slantDashDot: 12, thick: 13 };
  const H_ALIGN = { left: 1, center: 2, right: 3, justify: 4, distributed: 6, centerContinuous: 2, fill: 1 };
  const V_ALIGN = { top: 1, middle: 2, bottom: 3, justify: 2, distributed: 2 };

  // ════════════════════════════ XLSX ════════════════════════════
  async function xlsxToSnapshot(buf, title) {
    await load("vendor/exceljs.min.js", "ExcelJS");
    const wb = new window.ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const B = Builder(title);
    const warn = new Set();
    wb.eachSheet(ws => {
      if (ws.type && ws.type !== "worksheet") return;
      const sh = B.sheet(ws.name);
      if (ws.state === "hidden" || ws.state === "veryHidden") sh.hidden = 1;
      const tab = ws.properties && ws.properties.tabColor && excelColor(ws.properties.tabColor);
      if (tab) sh.tabColor = tab;
      const view = (ws.views && ws.views[0]) || {};
      if (view.state === "frozen" && (view.xSplit || view.ySplit)) {
        sh.freeze = { xSplit: view.xSplit || 0, ySplit: view.ySplit || 0, startRow: view.ySplit || -1, startColumn: view.xSplit || -1 };
        if (!view.ySplit) sh.freeze.startRow = -1;
        if (!view.xSplit) sh.freeze.startColumn = -1;
      }
      if (view.showGridLines === false) sh.showGridlines = 0;
      if (view.rightToLeft) sh.rightToLeft = 1;
      const defH = ws.properties && ws.properties.defaultRowHeight;
      if (defH) sh.defaultRowHeight = Math.round(defH * 96 / 72);
      // columnas
      (ws.columns || []).forEach((col, i) => {
        if (!col) return;
        const d = {};
        if (col.width) d.w = Math.round(col.width * 7 + 5);
        if (col.hidden) d.hd = 1;
        if (Object.keys(d).length) sh.columnData[i] = d;
      });
      // celdas
      ws.eachRow({ includeEmpty: true }, (row, rn) => {
        const r = rn - 1;
        const rd = {};
        if (row.height) rd.h = Math.round(row.height * 96 / 72);
        if (row.hidden) rd.hd = 1;
        if (Object.keys(rd).length) sh.rowData[r] = rd;
        row.eachCell({ includeEmpty: true }, (cell, cn) => {
          const c = cn - 1;
          if (cell.isMerged && cell.master !== cell) return;           // la combinada ya la lleva la principal
          const out = {};
          const st = {};
          const f = cell.font || {};
          if (f.name) st.ff = f.name;
          if (f.size) st.fs = f.size;
          if (f.bold) st.bl = 1;
          if (f.italic) st.it = 1;
          if (f.underline) st.ul = { s: 1 };
          if (f.strike) st.st = { s: 1 };
          const fc = excelColor(f.color); if (fc && fc !== "#000000") st.cl = { rgb: fc };
          const fill = cell.fill;
          if (fill && fill.type === "pattern" && fill.pattern && fill.pattern !== "none") {
            const bg = excelColor(fill.fgColor) || excelColor(fill.bgColor);
            if (bg) st.bg = { rgb: bg };
          } else if (fill && fill.type === "gradient" && fill.stops && fill.stops[0]) {
            const bg = excelColor(fill.stops[0].color); if (bg) st.bg = { rgb: bg };
          }
          const b = cell.border;
          if (b) {
            const bd = {};
            for (const [k, s] of [["top", "t"], ["bottom", "b"], ["left", "l"], ["right", "r"]]) {
              const e = b[k];
              if (e && e.style && BORDER[e.style]) bd[s] = { s: BORDER[e.style], cl: { rgb: excelColor(e.color) || "#000000" } };
            }
            if (Object.keys(bd).length) st.bd = bd;
          }
          const al = cell.alignment;
          if (al) {
            if (H_ALIGN[al.horizontal]) st.ht = H_ALIGN[al.horizontal];
            if (V_ALIGN[al.vertical]) st.vt = V_ALIGN[al.vertical];
            if (al.wrapText) st.tb = 3;
            if (typeof al.textRotation === "number" && al.textRotation) st.tr = { a: al.textRotation > 90 ? 90 - al.textRotation : al.textRotation, v: 0 };
            else if (al.textRotation === "vertical") st.tr = { a: 0, v: 1 };
          }
          let v = cell.value;
          const fmt = cell.numFmt && cell.numFmt !== "General" ? cell.numFmt : null;
          if (fmt) st.n = { pattern: fmt };
          if (v && typeof v === "object" && !(v instanceof Date)) {
            if (v.formula != null || v.sharedFormula != null) {
              const fx = cell.formula || v.formula;
              if (fx) out.f = "=" + String(fx).replace(/^=/, "");
              v = v.result;
              if (v && typeof v === "object" && v.error) v = v.error;
            } else if (v.richText) v = v.richText.map(x => x.text).join("");
            else if (v.hyperlink != null) {
              const text = String(v.text && v.text.richText ? v.text.richText.map(x => x.text).join("") : (v.text != null ? v.text : v.hyperlink));
              if (/^(https?:|mailto:|ftp:)/i.test(v.hyperlink)) out.p = B.link(text, v.hyperlink);
              v = text;
            } else if (v.error) v = v.error;
            else v = null;
          }
          if (v instanceof Date) {
            v = dateSerial(v);
            if (!fmt) st.n = { pattern: v % 1 ? "yyyy-mm-dd hh:mm" : "yyyy-mm-dd" };
          }
          if (typeof v === "number") { if (isFinite(v)) { out.v = v; out.t = T_NUMBER; } }
          else if (typeof v === "boolean") { out.v = v ? 1 : 0; out.t = T_BOOL; }
          else if (typeof v === "string") { out.v = v; out.t = /^[=+]/.test(v) && !out.f ? T_FORCE_STRING : T_STRING; }
          const sid = B.style(st);
          if (sid) out.s = sid;
          const note = cell.note;
          if (note) B.note(sh, r, c, typeof note === "string" ? note : ((note.texts || []).map(x => x.text).join("")));
          if (Object.keys(out).length) B.cell(sh, r, c, out);
        });
      });
      // combinadas
      const merges = (ws.model && ws.model.merges) || [];
      merges.forEach(m => { const rg = decodeRange(m); if (rg) sh.mergeData.push(rg); });
      // validación de datos (listas desplegables, números, fechas, longitud)
      const dvModel = (ws.dataValidations && ws.dataValidations.model) || {};
      const groups = new Map();
      for (const [addr, rule] of Object.entries(dvModel)) {
        if (!rule || !rule.type) continue;
        const key = JSON.stringify(rule);
        const ranges = String(addr).replace(/^range:/, "").split(/\s+/).map(decodeRange).filter(Boolean);
        if (!groups.has(key)) groups.set(key, { rule, ranges: [] });
        groups.get(key).ranges.push(...ranges);
      }
      groups.forEach(({ rule, ranges }) => {
        const map = { list: "list", whole: "whole", decimal: "decimal", date: "date", time: "time", textLength: "textLength", custom: "custom" };
        const type = map[rule.type];
        if (!type || !ranges.length) return;
        const fx = (rule.formulae || []).map(x => String(x));
        const out = { type, ranges, allowBlank: rule.allowBlank !== false };
        if (type === "list") {
          const f1 = fx[0] || "";
          out.formula1 = /^".*"$/.test(f1) ? f1.slice(1, -1) : ("=" + f1.replace(/^=/, ""));
        } else {
          if (fx[0] != null) out.formula1 = fx[0];
          if (fx[1] != null) out.formula2 = fx[1];
          if (rule.operator) out.operator = rule.operator;
          if (type === "custom" && out.formula1) out.formula1 = "=" + out.formula1.replace(/^=/, "");
        }
        if (rule.showErrorMessage && rule.error) { out.error = rule.error; out.showErrorMessage = true; }
        if (rule.showInputMessage && rule.prompt) { out.prompt = rule.prompt; out.showInputMessage = true; }
        B.validation(sh, out);
      });
      // autofiltro
      const af = ws.autoFilter;
      const afRef = typeof af === "string" ? decodeRange(af) : (af && af.from && af.to ? { startRow: af.from.row - 1, startColumn: af.from.column - 1, endRow: af.to.row - 1, endColumn: af.to.column - 1 } : null);
      if (afRef) B.filter(sh, afRef);
      if (ws.getImages && ws.getImages().length) warn.add("images");
      if (ws.conditionalFormattings && ws.conditionalFormattings.length) warn.add("cf");
    });
    if (wb.model && wb.model.media && wb.model.media.some(m => m.type === "image")) warn.add("images");
    return { snapshot: B.finish(), warnings: [...warn] };
  }

  // ════════════════════════════ ODS ════════════════════════════
  async function odsToSnapshot(buf, title) {
    await load("vendor/fflate.min.js", "fflate");
    const files = window.fflate.unzipSync(new Uint8Array(buf));
    const txt = n => files[n] ? new TextDecoder("utf-8").decode(files[n]) : "";
    const parse = s => s ? new DOMParser().parseFromString(s, "application/xml") : null;
    const content = parse(txt("content.xml"));
    if (!content || content.getElementsByTagName("parsererror").length) throw new Error("content.xml");
    const stylesDoc = parse(txt("styles.xml"));
    const B = Builder(title);
    const warn = new Set();

    // estilos de celda, columna y fila; formatos de número
    const cellStyles = {}, colW = {}, rowH = {}, numFmt = {};
    const cm = v => { if (!v) return null; const m = String(v).match(/^([\d.]+)(cm|mm|in|pt|px)$/); if (!m) return null; const k = { cm: 96 / 2.54, mm: 96 / 25.4, in: 96, pt: 96 / 72, px: 1 }[m[2]]; return Math.round(+m[1] * k); };
    const borderOf = v => {
      if (!v || v === "none") return null;
      const m = String(v).match(/([\d.]+(?:pt|cm|mm|px))\s+(\w+)\s+(#[0-9a-f]{6})/i);
      if (!m) return null;
      const w = cm(m[1]) || 1;
      const s = m[2] === "double" ? 7 : m[2] === "dotted" ? 3 : m[2] === "dashed" ? 4 : w >= 3 ? 13 : w >= 2 ? 8 : 1;
      return { s, cl: { rgb: m[3].toUpperCase() } };
    };
    const collectNum = doc => {
      if (!doc) return;
      for (const el of doc.getElementsByTagName("*")) {
        if (!/^number:(number|percentage|currency|date|time|boolean|text)-style$/.test(el.nodeName)) continue;
        const name = el.getAttribute("style:name");
        let pat = "";
        const kind = el.nodeName.slice(7, -6);
        for (const ch of el.children) {
          const n = ch.nodeName, long = ch.getAttribute("number:style") === "long";
          if (n === "number:number") {
            const d = +(ch.getAttribute("number:decimal-places") || 0);
            pat += (ch.getAttribute("number:grouping") === "true" ? "#,##0" : "0") + (d ? "." + "0".repeat(d) : "");
          } else if (n === "number:text") pat += ch.textContent.replace(/"/g, "") ? `"${ch.textContent}"`.replace(/^"([%\s.,\-/:]*)"$/, "$1") : "";
          else if (n === "number:currency-symbol") pat += `"${ch.textContent}"`;
          else if (n === "number:day") pat += long ? "dd" : "d";
          else if (n === "number:month") pat += ch.getAttribute("number:textual") === "true" ? (long ? "mmmm" : "mmm") : (long ? "mm" : "m");
          else if (n === "number:year") pat += long ? "yyyy" : "yy";
          else if (n === "number:day-of-week") pat += long ? "dddd" : "ddd";
          else if (n === "number:hours") pat += long ? "hh" : "h";
          else if (n === "number:minutes") pat += "mm";
          else if (n === "number:seconds") pat += "ss";
          else if (n === "number:am-pm") pat += " AM/PM";
          else if (n === "number:fraction") pat += "# ?/?";
          else if (n === "number:scientific-number") pat += "0.00E+00";
        }
        if (kind === "percentage" && !pat.includes("%")) pat += "%";
        if (kind === "boolean") pat = "";
        if (kind === "text") pat = "@";
        if (pat) numFmt[name] = pat;
      }
    };
    collectNum(stylesDoc); collectNum(content);
    const collect = doc => {
      if (!doc) return;
      for (const st of doc.getElementsByTagName("style:style")) {
        const name = st.getAttribute("style:name"), fam = st.getAttribute("style:family");
        const g = (tag, a) => { const e = st.getElementsByTagName(tag)[0]; return e ? e.getAttribute(a) : null; };
        if (fam === "table-column") { const w = cm(g("style:table-column-properties", "style:column-width")); if (w) colW[name] = w; continue; }
        if (fam === "table-row") { const h = cm(g("style:table-row-properties", "style:row-height")); if (h) rowH[name] = h; continue; }
        if (fam !== "table-cell") continue;
        const s = {};
        const fw = g("style:text-properties", "fo:font-weight"); if (fw && /bold|[6-9]00/.test(fw)) s.bl = 1;
        if (g("style:text-properties", "fo:font-style") === "italic") s.it = 1;
        const ul = g("style:text-properties", "style:text-underline-style"); if (ul && ul !== "none") s.ul = { s: 1 };
        const lt = g("style:text-properties", "style:text-line-through-style"); if (lt && lt !== "none") s.st = { s: 1 };
        const col = g("style:text-properties", "fo:color"); if (col && /^#[0-9a-f]{6}$/i.test(col) && col.toLowerCase() !== "#000000") s.cl = { rgb: col.toUpperCase() };
        const fsz = g("style:text-properties", "fo:font-size"); if (fsz && /pt$/.test(fsz)) s.fs = parseFloat(fsz);
        const fn = g("style:text-properties", "style:font-name"); if (fn) s.ff = fn;
        const bg = g("style:table-cell-properties", "fo:background-color"); if (bg && /^#[0-9a-f]{6}$/i.test(bg)) s.bg = { rgb: bg.toUpperCase() };
        const all = borderOf(g("style:table-cell-properties", "fo:border"));
        const bd = {};
        for (const [k, s2] of [["top", "t"], ["bottom", "b"], ["left", "l"], ["right", "r"]]) { const e = borderOf(g("style:table-cell-properties", "fo:border-" + k)) || all; if (e) bd[s2] = e; }
        if (Object.keys(bd).length) s.bd = bd;
        if (g("style:table-cell-properties", "fo:wrap-option") === "wrap") s.tb = 3;
        const va = g("style:table-cell-properties", "style:vertical-align"); if (va) s.vt = { top: 1, middle: 2, bottom: 3 }[va];
        const ta = g("style:paragraph-properties", "fo:text-align"); if (ta) s.ht = { start: 1, left: 1, center: 2, end: 3, right: 3, justify: 4 }[ta];
        const ds = st.getAttribute("style:data-style-name"); if (ds && numFmt[ds]) s.n = { pattern: numFmt[ds] };
        Object.keys(s).forEach(k => s[k] == null && delete s[k]);
        cellStyles[name] = { s, parent: st.getAttribute("style:parent-style-name") };
      }
    };
    collect(stylesDoc); collect(content);
    const styleObj = name => {
      const s = {}, chain = [];
      let n = name, guard = 0;
      while (n && cellStyles[n] && guard++ < 10) { chain.unshift(cellStyles[n].s); n = cellStyles[n].parent; }
      chain.forEach(x => Object.assign(s, x));
      return s;
    };

    // OpenFormula → fórmula tipo Excel: of:=SUM([.A1:.B2];[Hoja2.C3]) → =SUM(A1:B2,Hoja2!C3)
    function formula(f) {
      let s = String(f).replace(/^(of|oooc|msoxl):/, "");
      if (!s.startsWith("=")) s = "=" + s;
      let out = "", q = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '"') { q = !q; out += ch; continue; }
        if (q) { out += ch; continue; }
        if (ch === "[") {
          const j = s.indexOf("]", i);
          const ref = s.slice(i + 1, j);
          out += ref.split(":").map((part, k) => {
            const m = part.match(/^\$?('(?:[^']|'')*'|[^.]*)\.(.*)$/);
            if (!m) return part;
            const sheet = m[1], cell = m[2];
            return sheet && !(k > 0 && sheet === "") ? `${sheet.replace(/^\$/, "")}!${cell}` : cell;
          }).join(":");
          i = j; continue;
        }
        out += ch === ";" ? "," : ch;
      }
      return out;
    }
    function cellText(cell) {
      const ps = [...cell.children].filter(e => e.nodeName === "text:p");
      let link = null;
      const txt = ps.map(p => {
        let t = "";
        const walk = n => {
          for (const ch of n.childNodes) {
            if (ch.nodeType === 3) t += ch.nodeValue;
            else if (ch.nodeName === "text:s") t += " ".repeat(+ch.getAttribute("text:c") || 1);
            else if (ch.nodeName === "text:tab") t += "\t";
            else if (ch.nodeName === "text:line-break") t += "\n";
            else if (ch.nodeName === "text:a") { link = link || ch.getAttribute("xlink:href"); walk(ch); }
            else if (ch.nodeName !== "office:annotation") walk(ch);
          }
        };
        walk(p);
        return t;
      }).join("\n");
      return { text: txt, link };
    }

    const body = content.getElementsByTagName("office:spreadsheet")[0];
    if (!body) throw new Error("office:spreadsheet");
    for (const table of [...body.children].filter(e => e.nodeName === "table:table")) {
      const sh = B.sheet(table.getAttribute("table:name"));
      if (table.getAttribute("table:display") === "false") sh.hidden = 1;
      let r = 0, c = 0;
      const covered = new Set();
      const rows = [], cols = [];
      const walk = el => { for (const ch of el.children) { if (ch.nodeName === "table:table-row") rows.push(ch); else if (ch.nodeName === "table:table-column") cols.push(ch); else if (/^table:table-(header-)?(rows|row-group|columns|column-group)$|^table:table-header-(rows|columns)$/.test(ch.nodeName)) walk(ch); } };
      walk(table);
      c = 0;
      for (const col of cols) {
        const rep = Math.min(+col.getAttribute("table:number-columns-repeated") || 1, 1024);
        const w = colW[col.getAttribute("table:style-name")];
        const hidden = col.getAttribute("table:visibility") === "collapse";
        for (let k = 0; k < rep && c < 16384; k++, c++) if ((w && Math.abs(w - 88) > 2) || hidden) sh.columnData[c] = Object.assign(w ? { w } : {}, hidden ? { hd: 1 } : {});
      }
      // filas: las repeticiones vacías del final (hasta 1 048 576) no se recorren
      const lastUseful = (() => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].querySelector && [...rows[i].children].some(x => x.children.length || x.hasAttribute("office:value-type") || x.hasAttribute("table:formula"))) return i; return -1; })();
      r = 0;
      rows.forEach((row, ri) => {
        if (ri > lastUseful) return;
        const rep = Math.min(+row.getAttribute("table:number-rows-repeated") || 1, 5000);
        const h = rowH[row.getAttribute("table:style-name")];
        const hiddenRow = row.getAttribute("table:visibility") === "collapse";
        for (let k = 0; k < rep; k++, r++) {
          if ((h && Math.abs(h - 24) > 3) || hiddenRow) sh.rowData[r] = Object.assign(h ? { h } : {}, hiddenRow ? { hd: 1 } : {});
          c = 0;
          const cells = [...row.children].filter(e => e.nodeName === "table:table-cell" || e.nodeName === "table:covered-table-cell");
          const lastCell = (() => { for (let i = cells.length - 1; i >= 0; i--) if (cells[i].children.length || cells[i].hasAttribute("office:value-type") || cells[i].hasAttribute("table:formula")) return i; return -1; })();
          cells.forEach((cell, ci) => {
            const crep = Math.min(+cell.getAttribute("table:number-columns-repeated") || 1, ci > lastCell ? 0 : 1024);
            for (let q = 0; q < crep; q++, c++) {
              if (cell.nodeName === "table:covered-table-cell" || covered.has(r + ":" + c)) continue;
              const out = {};
              const vt = cell.getAttribute("office:value-type");
              const f = cell.getAttribute("table:formula");
              if (f) out.f = formula(f);
              const { text, link } = cellText(cell);
              if (vt === "float" || vt === "percentage" || vt === "currency") { out.v = +cell.getAttribute("office:value"); out.t = T_NUMBER; }
              else if (vt === "date") {
                const d = cell.getAttribute("office:date-value") || "";
                const m = d.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/);
                if (m) { out.v = dateSerial(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)))); out.t = T_NUMBER; }
              } else if (vt === "time") {
                const m = (cell.getAttribute("office:time-value") || "").match(/PT(\d+)H(\d+)M([\d.]+)S/);
                if (m) { out.v = (+m[1] * 3600 + +m[2] * 60 + +m[3]) / 86400; out.t = T_NUMBER; }
              } else if (vt === "boolean") { out.v = cell.getAttribute("office:boolean-value") === "true" ? 1 : 0; out.t = T_BOOL; }
              else if (text) { out.v = text; out.t = /^[=+]/.test(text) && !f ? T_FORCE_STRING : T_STRING; }
              if (link && text && /^(https?:|mailto:|ftp:)/i.test(link)) out.p = B.link(text, link);
              const so = styleObj(cell.getAttribute("table:style-name"));
              if (vt === "date" && !so.n) so.n = { pattern: out.v % 1 ? "yyyy-mm-dd hh:mm" : "yyyy-mm-dd" };
              if (vt === "time" && !so.n) so.n = { pattern: "hh:mm:ss" };
              const sid = B.style(so);
              if (sid) out.s = sid;
              const ann = [...cell.children].find(e => e.nodeName === "office:annotation");
              if (ann) B.note(sh, r, c, [...ann.getElementsByTagName("text:p")].map(p => p.textContent).join("\n"));
              const cs = +cell.getAttribute("table:number-columns-spanned") || 1, rs = +cell.getAttribute("table:number-rows-spanned") || 1;
              if (cs > 1 || rs > 1) {
                sh.mergeData.push({ startRow: r, endRow: r + rs - 1, startColumn: c, endColumn: c + cs - 1 });
                for (let a = 0; a < rs; a++) for (let bq = 0; bq < cs; bq++) if (a || bq) covered.add((r + a) + ":" + (c + bq));
              }
              if (Object.keys(out).length) B.cell(sh, r, c, out);
            }
          });
        }
      });
      if (table.getElementsByTagName("draw:frame").length) warn.add("images");
    }
    if (content.getElementsByTagName("calcext:conditional-formats").length) warn.add("cf");
    return { snapshot: B.finish(), warnings: [...warn] };
  }

  // ════════════════════════════ CSV ════════════════════════════
  function csvToSnapshot(buf, title, ext) {
    const text = decodeText(buf).replace(/\r\n?/g, "\n");
    const sample = text.split("\n").slice(0, 20).join("\n");
    const count = d => { let n = 0, q = false; for (const ch of sample) { if (ch === '"') q = !q; else if (!q && ch === d) n++; } return n; };
    const delim = ext === "tsv" ? "\t" : [",", ";", "\t", "|"].sort((a, b) => count(b) - count(a))[0];
    const commaDecimal = delim === ";" || delim === "\t" && /\d,\d/.test(sample) && !/\d\.\d/.test(sample);
    const rows = [];
    let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
      if (ch === '"' && f === "") q = true;
      else if (ch === delim) { row.push(f); f = ""; }
      else if (ch === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
      else f += ch;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    const B = Builder(title);
    const sh = B.sheet(title || "Hoja1");
    const numRe = commaDecimal ? /^[-+]?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/ : /^[-+]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/;
    rows.forEach((cols, r) => cols.forEach((raw, c) => {
      const v = raw.trim();
      if (!raw) return;
      if (numRe.test(v) && !/^[-+]?0\d/.test(v) && v.replace(/\D/g, "").length <= 15) {
        const n = commaDecimal ? +v.replace(/\./g, "").replace(",", ".") : +v.replace(/,/g, "");
        if (isFinite(n)) { B.cell(sh, r, c, { v: n, t: T_NUMBER }); return; }
      }
      B.cell(sh, r, c, { v: raw, t: /^[=+@-]/.test(raw) ? T_FORCE_STRING : T_STRING });   // texto que empieza por = no se ejecuta
    }));
    return { snapshot: B.finish(), warnings: [] };
  }

  async function toSnapshot(file) {
    const kind = kindOf(file);
    const buf = await file.arrayBuffer();
    const title = file.name.replace(/\.[^.]+$/, "");
    if (kind === "xlsx") return Object.assign({ title }, await xlsxToSnapshot(buf, title));
    if (kind === "ods") return Object.assign({ title }, await odsToSnapshot(buf, title));
    if (kind === "csv") return Object.assign({ title }, csvToSnapshot(buf, title, extOf(file.name)));
    throw new Error("unsupported");
  }

  window.OflSheetImport = { ACCEPT, kindOf, toSnapshot };
})();
