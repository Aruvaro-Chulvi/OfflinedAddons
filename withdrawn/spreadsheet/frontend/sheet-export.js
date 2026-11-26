/* Offlined — exportar hojas del addon Hoja de cálculo (MIT).
 *
 * Desde la hoja de Univer (IWorkbookData, con sus «resources»):
 *   .xlsx  ExcelJS (MIT, vendor/exceljs.min.js)
 *   .ods   escritor propio de OpenDocument (zip con vendor/fflate.min.js)
 *   .csv   la hoja activa (en es/fr/pt/it/de/ru: «;» y coma decimal, como espera Excel allí)
 *   .html  todas las hojas como tablas con su formato
 *   PDF    se imprime esa página (diálogo de impresión → «Guardar como PDF»)
 * Se conservan valores, fórmulas, estilos, formatos de número, combinadas, anchos,
 * altos, ocultas, paneles inmovilizados, color de pestaña, notas, enlaces, listas
 * desplegables y autofiltro. Los números del HTML/PDF salen formateados con numfmt
 * (la librería que trae Univer).
 */
(function () {
  "use strict";

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
  const enc = s => new TextEncoder().encode(s);
  const xml = s => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const T_NUMBER = 2, T_BOOL = 3;

  // ── lectura común de la hoja ──
  function resources(snap) {
    const out = {};
    (snap.resources || []).forEach(r => { try { out[r.name] = r.data ? JSON.parse(r.data) : {}; } catch (_) { out[r.name] = {}; } });
    return out;
  }
  const styleOf = (snap, s) => (s && typeof s === "object") ? s : (s && snap.styles && snap.styles[s]) || {};
  function linkOf(cell) {
    const cr = cell && cell.p && cell.p.body && cell.p.body.customRanges;
    const l = cr && cr.find(x => x.rangeType === 0 && x.properties && x.properties.url);
    return l ? l.properties.url : null;
  }
  function textOf(cell) {
    if (!cell) return "";
    if (cell.v != null) return cell.v;
    const ds = cell.p && cell.p.body && cell.p.body.dataStream;
    return ds ? ds.replace(/\r?\n$/, "").replace(/\r/g, "\n") : "";
  }
  function used(sheet) {
    let maxR = -1, maxC = -1;
    for (const r of Object.keys(sheet.cellData || {})) for (const c of Object.keys(sheet.cellData[r] || {})) { maxR = Math.max(maxR, +r); maxC = Math.max(maxC, +c); }
    (sheet.mergeData || []).forEach(m => { maxR = Math.max(maxR, m.endRow); maxC = Math.max(maxC, m.endColumn); });
    return { maxR, maxC };
  }
  const colName = n => { let s = ""; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const isDatePattern = p => p && /(^|[^"\\])(y|d|m{3,}|h|s)/i.test(p.replace(/"[^"]*"/g, "")) && !/0|#/.test(p.replace(/"[^"]*"/g, ""));
  function serialToDate(v) { return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000)); }

  // ════════════════════════════ XLSX ════════════════════════════
  const BORDER = { 1: "thin", 2: "hair", 3: "dotted", 4: "dashed", 5: "dashDot", 6: "dashDotDot", 7: "double", 8: "medium", 9: "mediumDashed", 10: "mediumDashDot", 11: "mediumDashDotDot", 12: "slantDashDot", 13: "thick" };
  const H = { 1: "left", 2: "center", 3: "right", 4: "justify", 5: "justify", 6: "distributed" };
  const V = { 1: "top", 2: "middle", 3: "bottom" };
  const argb = rgb => { const m = /^#?([0-9a-f]{6})$/i.exec(String(rgb || "").trim()); return m ? "FF" + m[1].toUpperCase() : null; };

  async function toXlsx(snap, title) {
    await load("vendor/exceljs.min.js", "ExcelJS");
    const wb = new window.ExcelJS.Workbook();
    wb.creator = "Offlined"; wb.created = new Date(); wb.title = title || "";
    const R = resources(snap);
    const notes = R.SHEET_NOTE_PLUGIN || {}, dv = R.SHEET_DATA_VALIDATION_PLUGIN || {}, filters = R.SHEET_FILTER_PLUGIN || {};
    for (const id of snap.sheetOrder || Object.keys(snap.sheets || {})) {
      const sh = snap.sheets[id];
      if (!sh) continue;
      const fr = sh.freeze || {};
      const view = {};
      if (fr.xSplit > 0 || fr.ySplit > 0) Object.assign(view, { state: "frozen", xSplit: fr.xSplit || 0, ySplit: fr.ySplit || 0 });
      if (sh.showGridlines === 0) view.showGridLines = false;
      if (sh.rightToLeft) view.rightToLeft = true;
      const ws = wb.addWorksheet(String(sh.name || "Hoja").replace(/[\\/?*[\]:]/g, "_").slice(0, 31), {
        properties: argb(sh.tabColor) ? { tabColor: { argb: argb(sh.tabColor) } } : {}, views: [view],
      });
      if (sh.hidden) ws.state = "hidden";
      if (sh.defaultRowHeight) ws.properties.defaultRowHeight = Math.round(sh.defaultRowHeight * 0.75 * 10) / 10;
      for (const [c, d] of Object.entries(sh.columnData || {})) {
        const col = ws.getColumn(+c + 1);
        if (d.w) col.width = Math.max(1, Math.round(((d.w - 5) / 7) * 100) / 100);
        if (d.hd) col.hidden = true;
      }
      for (const [r, d] of Object.entries(sh.rowData || {})) {
        const row = ws.getRow(+r + 1);
        if (d.h) row.height = Math.round(d.h * 0.75 * 10) / 10;
        if (d.hd) row.hidden = true;
      }
      for (const [r, row] of Object.entries(sh.cellData || {})) {
        for (const [c, cell] of Object.entries(row || {})) {
          if (!cell) continue;
          const x = ws.getCell(+r + 1, +c + 1);
          const st = styleOf(snap, cell.s);
          let v = textOf(cell);
          if (cell.t === T_BOOL) v = !!v && v !== "0" && v !== "FALSE";
          else if (cell.t === T_NUMBER && v !== "" && !isNaN(+v)) v = +v;
          const pat = st.n && st.n.pattern;
          if (typeof v === "number" && isDatePattern(pat)) v = serialToDate(v);
          const url = linkOf(cell);
          if (cell.f) x.value = { formula: String(cell.f).replace(/^=/, ""), result: v === "" ? undefined : v };
          else if (url) x.value = { text: String(v), hyperlink: url };
          else if (v !== "" && v != null) x.value = v;
          const font = {};
          if (st.ff) font.name = st.ff;
          if (st.fs) font.size = st.fs;
          if (st.bl) font.bold = true;
          if (st.it) font.italic = true;
          if (st.ul && st.ul.s) font.underline = true;
          if (st.st && st.st.s) font.strike = true;
          if (st.cl && argb(st.cl.rgb)) font.color = { argb: argb(st.cl.rgb) };
          if (url && !font.color) Object.assign(font, { color: { argb: "FF0563C1" }, underline: true });
          if (Object.keys(font).length) x.font = font;
          if (st.bg && argb(st.bg.rgb)) x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(st.bg.rgb) } };
          if (st.bd) {
            const b = {};
            for (const [k, n] of [["t", "top"], ["b", "bottom"], ["l", "left"], ["r", "right"]]) {
              const e = st.bd[k];
              if (e && BORDER[e.s]) b[n] = { style: BORDER[e.s], color: { argb: argb(e.cl && e.cl.rgb) || "FF000000" } };
            }
            if (Object.keys(b).length) x.border = b;
          }
          const al = {};
          if (H[st.ht]) al.horizontal = H[st.ht];
          if (V[st.vt]) al.vertical = V[st.vt];
          if (st.tb === 3) al.wrapText = true;
          if (st.tr && st.tr.v) al.textRotation = "vertical";
          else if (st.tr && st.tr.a) al.textRotation = st.tr.a < 0 ? 90 - st.tr.a : st.tr.a;
          if (Object.keys(al).length) x.alignment = al;
          if (pat) x.numFmt = pat;
        }
      }
      (sh.mergeData || []).forEach(m => { try { ws.mergeCells(m.startRow + 1, m.startColumn + 1, m.endRow + 1, m.endColumn + 1); } catch (_) {} });
      // notas
      for (const [r, row] of Object.entries(notes[id] || {})) for (const [c, n] of Object.entries(row || {})) if (n && n.note) ws.getCell(+r + 1, +c + 1).note = n.note;
      // listas desplegables y demás validaciones
      (dv[id] || []).forEach(rule => {
        const t = rule.type === "listMultiple" ? "list" : rule.type;
        if (!["list", "whole", "decimal", "date", "time", "textLength", "custom"].includes(t)) return;
        const f1 = String(rule.formula1 || "");
        const formulae = t === "list" ? [f1.startsWith("=") ? f1.slice(1) : `"${f1}"`] : [f1.replace(/^=/, ""), rule.formula2].filter(x => x != null && x !== "");
        const v = { type: t, allowBlank: rule.allowBlank !== false, formulae };
        if (rule.operator && t !== "list" && t !== "custom") v.operator = rule.operator;
        if (rule.showErrorMessage && rule.error) Object.assign(v, { showErrorMessage: true, error: rule.error });
        let n = 0;
        (rule.ranges || []).forEach(rg => {
          for (let r = rg.startRow; r <= rg.endRow && n < 20000; r++) for (let c = rg.startColumn; c <= rg.endColumn && n < 20000; c++, n++) ws.getCell(r + 1, c + 1).dataValidation = v;
        });
      });
      const f = filters[id] && filters[id].ref;
      if (f) ws.autoFilter = { from: { row: f.startRow + 1, column: f.startColumn + 1 }, to: { row: f.endRow + 1, column: f.endColumn + 1 } };
    }
    if (!wb.worksheets.length) wb.addWorksheet("Hoja1");
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  // ════════════════════════════ ODS ════════════════════════════
  // Fórmula tipo Excel → OpenFormula: =SUM(A1:B2,Hoja2!C3) → of:=SUM([.A1:.B2];[$Hoja2.C3])
  function toOpenFormula(f) {
    const src = String(f).replace(/^=/, "");
    const ref = /((?:'(?:[^']|'')+'|[A-Za-z_\u00c0-\uffff][\w.\u00c0-\uffff]*)!)?(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?/y;
    let out = "", i = 0, q = false;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '"') { q = !q; out += ch; i++; continue; }
      if (q) { out += ch; i++; continue; }
      const prev = src[i - 1] || "";
      if (!/[\w.\u00c0-\uffff]/.test(prev) || ch === "'") {
        ref.lastIndex = i;
        const m = ref.exec(src);
        if (m && !/^[\w(]/.test(src[ref.lastIndex] || "")) {
          const sheet = m[1] ? m[1].slice(0, -1) : "";
          const sh = sheet ? "$" + (sheet.startsWith("'") ? sheet : (/[^\w]/.test(sheet) ? `'${sheet}'` : sheet)) : "";
          out += "[" + sh + "." + m[2] + (m[3] ? ":." + m[3] : "") + "]";
          i = ref.lastIndex; continue;
        }
      }
      out += ch === "," ? ";" : ch;
      i++;
    }
    return "of:=" + out;
  }
  // formato de número tipo Excel → estilo de datos de OpenDocument (casos comunes)
  function odsNumberStyle(name, pat) {
    const p = pat.replace(/\[[^\]]*\]/g, "");
    const lits = [];
    const body = p.replace(/"([^"]*)"/g, (m, t) => { lits.push(t); return "\u0001"; });
    if (isDatePattern(pat)) {
      let x = "", i = 0;
      const lit = t => { x += `<number:text>${xml(t)}</number:text>`; };
      const toks = body.match(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|\u0001|./gi) || [];
      let afterH = false;
      toks.forEach(t => {
        const l = t.toLowerCase();
        if (l === "yyyy" || l === "yy") x += `<number:year${l === "yyyy" ? ' number:style="long"' : ""}/>`;
        else if (l === "mmmm" || l === "mmm") x += `<number:month number:textual="true"${l === "mmmm" ? ' number:style="long"' : ""}/>`;
        else if (l === "mm" || l === "m") x += afterH ? `<number:minutes${l === "mm" ? ' number:style="long"' : ""}/>` : `<number:month${l === "mm" ? ' number:style="long"' : ""}/>`;
        else if (l === "dddd" || l === "ddd") x += `<number:day-of-week${l === "dddd" ? ' number:style="long"' : ""}/>`;
        else if (l === "dd" || l === "d") x += `<number:day${l === "dd" ? ' number:style="long"' : ""}/>`;
        else if (l === "hh" || l === "h") { x += `<number:hours${l === "hh" ? ' number:style="long"' : ""}/>`; afterH = true; return; }
        else if (l === "ss" || l === "s") x += `<number:seconds${l === "ss" ? ' number:style="long"' : ""}/>`;
        else if (l === "am/pm") x += "<number:am-pm/>";
        else if (t === "\u0001") lit(lits[i++]);
        else if (t !== "\\") lit(t);
        if (!/^(h|hh|:)$/.test(l)) afterH = false;
      });
      return `<number:date-style style:name="${name}">${x}</number:date-style>`;
    }
    const m = body.match(/([#0,]*0)(?:\.(0+))?/);
    if (!m) return null;
    const grouping = /,/.test(m[1]), dec = m[2] ? m[2].length : 0;
    const pre = body.slice(0, m.index).replace(/\u0001/g, () => lits.shift() || ""), post = body.slice(m.index + m[0].length).replace(/\u0001/g, () => lits.shift() || "");
    const pct = /%/.test(post);
    const num = `<number:number number:decimal-places="${dec}" number:min-decimal-places="${dec}" number:min-integer-digits="1"${grouping ? ' number:grouping="true"' : ""}/>`;
    const t = s => s.replace(/[\\_*]/g, "") ? `<number:text>${xml(s.replace(/[\\_*]/g, ""))}</number:text>` : "";
    return `<number:${pct ? "percentage" : "number"}-style style:name="${name}">${t(pre)}${num}${t(post)}</number:${pct ? "percentage" : "number"}-style>`;
  }
  async function toOds(snap, title, lang) {
    await load("vendor/fflate.min.js", "fflate");
    const R = resources(snap);
    const notes = R.SHEET_NOTE_PLUGIN || {};
    const auto = [], dataStyles = new Map(), cellStyleMap = new Map(), colStyles = new Map(), rowStyles = new Map();
    const dataStyle = pat => {
      if (!pat || pat === "General" || pat === "@") return null;
      if (!dataStyles.has(pat)) { const n = "N" + (dataStyles.size + 1); const x = odsNumberStyle(n, pat); dataStyles.set(pat, x ? { n, x } : null); }
      const d = dataStyles.get(pat); return d ? d.n : null;
    };
    const B = { 1: "0.06pt solid", 2: "0.03pt solid", 3: "0.06pt dotted", 4: "0.06pt dashed", 5: "0.06pt dashed", 6: "0.06pt dashed", 7: "1.1pt double", 8: "1pt solid", 9: "1pt dashed", 10: "1pt dashed", 11: "1pt dashed", 12: "1pt dashed", 13: "1.5pt solid" };
    const cellStyle = st => {
      const key = JSON.stringify(st);
      if (cellStyleMap.has(key)) return cellStyleMap.get(key);
      const name = "ce" + (cellStyleMap.size + 1);
      const tp = [], cp = [], pp = [];
      if (st.bl) tp.push('fo:font-weight="bold" style:font-weight-asian="bold" style:font-weight-complex="bold"');
      if (st.it) tp.push('fo:font-style="italic"');
      if (st.ul && st.ul.s) tp.push('style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"');
      if (st.st && st.st.s) tp.push('style:text-line-through-style="solid"');
      if (st.cl && argb(st.cl.rgb)) tp.push(`fo:color="#${argb(st.cl.rgb).slice(2)}"`);
      if (st.fs) tp.push(`fo:font-size="${st.fs}pt"`);
      if (st.ff) tp.push(`style:font-name="${xml(st.ff)}" fo:font-family="${xml(st.ff)}"`);
      if (st.bg && argb(st.bg.rgb)) cp.push(`fo:background-color="#${argb(st.bg.rgb).slice(2)}"`);
      if (st.bd) for (const [k, n] of [["t", "top"], ["b", "bottom"], ["l", "left"], ["r", "right"]]) { const e = st.bd[k]; if (e && B[e.s]) cp.push(`fo:border-${n}="${B[e.s]} #${(argb(e.cl && e.cl.rgb) || "FF000000").slice(2)}"`); }
      if (st.tb === 3) cp.push('fo:wrap-option="wrap"');
      if (V[st.vt]) cp.push(`style:vertical-align="${V[st.vt]}"`);
      if (H[st.ht]) { pp.push(`fo:text-align="${{ left: "start", center: "center", right: "end", justify: "justify", distributed: "justify" }[H[st.ht]]}"`); cp.push('style:text-align-source="fix"'); }
      const ds = st.n && dataStyle(st.n.pattern);
      auto.push(`<style:style style:name="${name}" style:family="table-cell" style:parent-style-name="Default"${ds ? ` style:data-style-name="${ds}"` : ""}>` +
        (cp.length ? `<style:table-cell-properties ${cp.join(" ")}/>` : "") + (pp.length ? `<style:paragraph-properties ${pp.join(" ")}/>` : "") +
        (tp.length ? `<style:text-properties ${tp.join(" ")}/>` : "") + "</style:style>");
      cellStyleMap.set(key, name);
      return name;
    };
    const colStyle = w => { const k = Math.round(w); if (!colStyles.has(k)) { const n = "co" + (colStyles.size + 1); colStyles.set(k, n); auto.push(`<style:style style:name="${n}" style:family="table-column"><style:table-column-properties fo:break-before="auto" style:column-width="${(k * 2.54 / 96).toFixed(3)}cm"/></style:style>`); } return colStyles.get(k); };
    const rowStyle = h => { const k = Math.round(h); if (!rowStyles.has(k)) { const n = "ro" + (rowStyles.size + 1); rowStyles.set(k, n); auto.push(`<style:style style:name="${n}" style:family="table-row"><style:table-row-properties style:row-height="${(k * 2.54 / 96).toFixed(3)}cm" style:use-optimal-row-height="false" fo:break-before="auto"/></style:style>`); } return rowStyles.get(k); };
    auto.push('<style:style style:name="ta1" style:family="table" style:master-page-name="Default"><style:table-properties table:display="true" style:writing-mode="lr-tb"/></style:style>');
    auto.push('<style:style style:name="ta2" style:family="table" style:master-page-name="Default"><style:table-properties table:display="false" style:writing-mode="lr-tb"/></style:style>');
    auto.push('<style:style style:name="ta3" style:family="table" style:master-page-name="Default"><style:table-properties table:display="true" style:writing-mode="rl-tb"/></style:style>');
    const textP = (txt, url) => String(txt).split("\n").map(l => {
      const body = xml(l).replace(/\t/g, "<text:tab/>").replace(/ {2,}/g, m => " " + `<text:s text:c="${m.length - 1}"/>`);
      return `<text:p>${url ? `<text:a xlink:type="simple" xlink:href="${xml(url)}">${body}</text:a>` : body}</text:p>`;
    }).join("");
    let tables = "";
    for (const id of snap.sheetOrder || Object.keys(snap.sheets || {})) {
      const sh = snap.sheets[id];
      if (!sh) continue;
      const { maxR, maxC } = used(sh);
      const cols = Math.max(maxC + 1, 1);
      const merged = new Map(), covered = new Set();
      (sh.mergeData || []).forEach(m => { merged.set(m.startRow + ":" + m.startColumn, m); for (let r = m.startRow; r <= m.endRow; r++) for (let c = m.startColumn; c <= m.endColumn; c++) if (r !== m.startRow || c !== m.startColumn) covered.add(r + ":" + c); });
      let t = `<table:table table:name="${xml(sh.name || "Hoja")}" table:style-name="${sh.hidden ? "ta2" : sh.rightToLeft ? "ta3" : "ta1"}">`;
      for (let c = 0; c < cols; c++) {
        const d = (sh.columnData || {})[c] || {};
        t += `<table:table-column table:style-name="${colStyle(d.w || sh.defaultColumnWidth || 88)}"${d.hd ? ' table:visibility="collapse"' : ""} table:default-cell-style-name="Default"/>`;
      }
      for (let r = 0; r <= maxR; r++) {
        const rd = (sh.rowData || {})[r] || {};
        const row = (sh.cellData || {})[r] || {};
        t += `<table:table-row${rd.h ? ` table:style-name="${rowStyle(rd.h)}"` : ""}${rd.hd ? ' table:visibility="collapse"' : ""}>`;
        let empty = 0;
        const flush = () => { if (empty) { t += empty > 1 ? `<table:table-cell table:number-columns-repeated="${empty}"/>` : "<table:table-cell/>"; empty = 0; } };
        for (let c = 0; c < cols; c++) {
          if (covered.has(r + ":" + c)) { flush(); t += "<table:covered-table-cell/>"; continue; }
          const cell = row[c];
          const m = merged.get(r + ":" + c);
          const note = notes[id] && notes[id][r] && notes[id][r][c] && notes[id][r][c].note;
          if (!cell && !m && !note) { empty++; continue; }
          flush();
          const st = cell ? styleOf(snap, cell.s) : {};
          const attrs = [];
          if (Object.keys(st).length) attrs.push(`table:style-name="${cellStyle(st)}"`);
          if (m) attrs.push(`table:number-columns-spanned="${m.endColumn - m.startColumn + 1}" table:number-rows-spanned="${m.endRow - m.startRow + 1}"`);
          let v = cell ? textOf(cell) : "";
          let inner = "";
          if (cell && cell.f) attrs.push(`table:formula="${xml(toOpenFormula(cell.f))}"`);
          if (cell && cell.t === T_NUMBER && v !== "" && !isNaN(+v)) {
            const pat = st.n && st.n.pattern;
            if (isDatePattern(pat)) {
              const d = serialToDate(+v).toISOString().replace(/\.\d+Z$/, "");
              attrs.push(`office:value-type="date" office:date-value="${d.endsWith("T00:00:00") ? d.slice(0, 10) : d}"`);
            } else attrs.push(`office:value-type="${pat && /%/.test(pat) ? "percentage" : "float"}" office:value="${+v}"`);
            inner = `<text:p>${xml(v)}</text:p>`;
          } else if (cell && cell.t === T_BOOL) {
            const b = !!v && v !== "0" && v !== "FALSE";
            attrs.push(`office:value-type="boolean" office:boolean-value="${b}"`);
            inner = `<text:p>${b ? "TRUE" : "FALSE"}</text:p>`;
          } else if (v !== "" && v != null) {
            attrs.push('office:value-type="string"');
            inner = textP(v, linkOf(cell));
          }
          if (note) inner = `<office:annotation><text:p>${xml(note)}</text:p></office:annotation>` + inner;
          t += `<table:table-cell ${attrs.join(" ")}>${inner}</table:table-cell>`;
        }
        t += "</table:table-row>";
      }
      if (maxR < 0) t += "<table:table-row><table:table-cell/></table:table-row>";
      tables += t + "</table:table>";
    }
    const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2" office:version="1.3"';
    const nums = [...dataStyles.values()].filter(Boolean).map(d => d.x).join("");
    const content = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content ${NS}><office:automatic-styles>${nums}${auto.join("")}</office:automatic-styles><office:body><office:spreadsheet>${tables}</office:spreadsheet></office:body></office:document-content>`;
    const styles = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-styles ${NS}><office:styles><style:default-style style:family="table-cell"><style:text-properties fo:font-size="11pt" fo:language="${xml((lang || "en").slice(0, 2))}"/></style:default-style><style:style style:name="Default" style:family="table-cell"/></office:styles>` +
      `<office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:margin-top="1.5cm" fo:margin-bottom="1.5cm" fo:margin-left="1.5cm" fo:margin-right="1.5cm"/></style:page-layout></office:automatic-styles>` +
      `<office:master-styles><style:master-page style:name="Default" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>`;
    const meta = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-meta ${NS}><office:meta><dc:title>${xml(title || "")}</dc:title><meta:generator>Offlined</meta:generator></office:meta></office:document-meta>`;
    const manifest = '<?xml version="1.0" encoding="UTF-8"?>\n<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>';
    const files = { mimetype: [enc("application/vnd.oasis.opendocument.spreadsheet"), { level: 0 }] };
    files["META-INF/manifest.xml"] = enc(manifest);
    files["content.xml"] = enc(content); files["styles.xml"] = enc(styles); files["meta.xml"] = enc(meta);
    return new Blob([window.fflate.zipSync(files, { level: 6 })], { type: "application/vnd.oasis.opendocument.spreadsheet" });
  }

  // ════════════════════════════ CSV ════════════════════════════
  function toCsv(snap, sheetId, lang) {
    const sh = snap.sheets[sheetId] || snap.sheets[(snap.sheetOrder || [])[0]];
    if (!sh) return "";
    const euro = /^(es|fr|pt|it|de|ru)/.test(lang || "");
    const sep = euro ? ";" : ",";
    const { maxR, maxC } = used(sh);
    const lines = [];
    for (let r = 0; r <= maxR; r++) {
      const row = (sh.cellData || {})[r] || {};
      const cells = [];
      for (let c = 0; c <= maxC; c++) {
        const cell = row[c];
        let v = cell ? textOf(cell) : "";
        if (cell && cell.t === T_NUMBER && v !== "" && !isNaN(+v)) {
          const pat = (styleOf(snap, cell.s).n || {}).pattern;
          if (isDatePattern(pat)) { const d = serialToDate(+v).toISOString(); v = (+v % 1) ? d.slice(0, 16).replace("T", " ") : d.slice(0, 10); }
          else { v = String(+v); if (euro) v = v.replace(".", ","); }
        } else if (cell && cell.t === T_BOOL) v = (!!v && v !== "0") ? "TRUE" : "FALSE";
        else {
          v = String(v);
          if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;            // que Excel no lo ejecute como fórmula
        }
        cells.push(/["\n\r]/.test(v) || v.includes(sep) ? `"${v.replace(/"/g, '""')}"` : v);
      }
      lines.push(cells.join(sep));
    }
    return "\ufeff" + lines.join("\r\n") + "\r\n";
  }

  // ════════════════════════════ HTML / PDF ════════════════════════════
  function fmt(v, pat) {
    try {
      const nf = window.UniverCore && window.UniverCore.numfmt;
      if (nf && pat && typeof v === "number") return nf.format(pat, v);
    } catch (_) {}
    return typeof v === "number" ? String(Math.round(v * 1e10) / 1e10) : String(v);
  }
  function toHtml(snap, title, lang) {
    const R = resources(snap);
    const notes = R.SHEET_NOTE_PLUGIN || {};
    let body = "";
    const ids = (snap.sheetOrder || Object.keys(snap.sheets || {})).filter(id => snap.sheets[id] && !snap.sheets[id].hidden);
    for (const id of ids) {
      const sh = snap.sheets[id];
      const { maxR, maxC } = used(sh);
      if (ids.length > 1) body += `<h2>${xml(sh.name)}</h2>\n`;
      if (maxR < 0) { body += "<p class=\"empty\">—</p>\n"; continue; }
      const merged = new Map(), covered = new Set();
      (sh.mergeData || []).forEach(m => { merged.set(m.startRow + ":" + m.startColumn, m); for (let r = m.startRow; r <= m.endRow; r++) for (let c = m.startColumn; c <= m.endColumn; c++) if (r !== m.startRow || c !== m.startColumn) covered.add(r + ":" + c); });
      let t = "<table><colgroup>";
      for (let c = 0; c <= maxC; c++) { const d = (sh.columnData || {})[c] || {}; if (!d.hd) t += `<col style="width:${d.w || sh.defaultColumnWidth || 88}px">`; }
      t += "</colgroup>\n";
      for (let r = 0; r <= maxR; r++) {
        const rd = (sh.rowData || {})[r] || {};
        if (rd.hd) continue;
        t += `<tr${rd.h ? ` style="height:${rd.h}px"` : ""}>`;
        for (let c = 0; c <= maxC; c++) {
          if (covered.has(r + ":" + c) || ((sh.columnData || {})[c] || {}).hd) continue;
          const cell = ((sh.cellData || {})[r] || {})[c];
          const m = merged.get(r + ":" + c);
          const st = cell ? styleOf(snap, cell.s) : {};
          const css = [];
          if (st.bl) css.push("font-weight:bold");
          if (st.it) css.push("font-style:italic");
          const deco = [st.ul && st.ul.s && "underline", st.st && st.st.s && "line-through"].filter(Boolean);
          if (deco.length) css.push("text-decoration:" + deco.join(" "));
          if (st.cl && st.cl.rgb) css.push("color:" + st.cl.rgb);
          if (st.bg && st.bg.rgb) css.push("background:" + st.bg.rgb);
          if (st.fs) css.push(`font-size:${st.fs}pt`);
          if (st.ff) css.push(`font-family:'${String(st.ff).replace(/'/g, "")}',sans-serif`);
          if (st.bd) for (const [k, n] of [["t", "top"], ["b", "bottom"], ["l", "left"], ["r", "right"]]) { const e = st.bd[k]; if (e && e.s) css.push(`border-${n}:${e.s === 7 ? "3px double" : e.s >= 8 ? "2px solid" : "1px " + (e.s === 3 ? "dotted" : e.s === 4 ? "dashed" : "solid")} ${(e.cl && e.cl.rgb) || "#000"}`); }
          let v = cell ? textOf(cell) : "";
          const isNum = cell && cell.t === T_NUMBER && v !== "" && !isNaN(+v);
          if (H[st.ht]) css.push("text-align:" + ({ distributed: "justify" }[H[st.ht]] || H[st.ht]));
          else if (isNum) css.push("text-align:right");
          if (V[st.vt]) css.push("vertical-align:" + V[st.vt]);
          if (st.tb === 3) css.push("white-space:pre-wrap"); else css.push("white-space:pre");
          if (isNum) v = fmt(+v, st.n && st.n.pattern);
          else if (cell && cell.t === T_BOOL) v = (!!v && v !== "0") ? "TRUE" : "FALSE";
          const url = linkOf(cell);
          const note = notes[id] && notes[id][r] && notes[id][r][c] && notes[id][r][c].note;
          const inner = url && /^(https?:|mailto:)/i.test(url) ? `<a href="${xml(url)}">${xml(v)}</a>` : xml(v);
          t += `<td${m ? ` colspan="${m.endColumn - m.startColumn + 1}" rowspan="${m.endRow - m.startRow + 1}"` : ""}${css.length ? ` style="${xml(css.join(";"))}"` : ""}${note ? ` title="${xml(note)}" class="note"` : ""}>${inner}</td>`;
        }
        t += "</tr>\n";
      }
      body += t + "</table>\n";
    }
    const CSS = "body{font-family:Calibri,Carlito,'Segoe UI',Arial,sans-serif;font-size:11pt;margin:24px;color:#111}h1{font-size:16pt;margin:0 0 12px}h2{font-size:13pt;margin:22px 0 8px}" +
      "table{border-collapse:collapse;table-layout:fixed}td{border:1px solid #d9d9d9;padding:2px 5px;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom}" +
      "td.note{box-shadow:inset -6px 6px 0 -3px #f59e0b}a{color:#0563c1}.empty{color:#888}";
    return `<!DOCTYPE html>\n<html lang="${xml(lang || "en")}"${/^ar/.test(lang || "") ? ' dir="rtl"' : ""}>\n<head>\n<meta charset="UTF-8">\n<meta name="generator" content="Offlined">\n<title>${xml(title || "")}</title>\n<style>${CSS}</style>\n</head>\n<body>\n<h1>${xml(title || "")}</h1>\n${body}</body>\n</html>\n`;
  }
  function printPdf(snap, title, lang) {
    return new Promise(resolve => {
      const f = document.createElement("iframe");
      f.setAttribute("aria-hidden", "true");
      f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      f.srcdoc = toHtml(snap, title, lang).replace("</style>", "@page{size:auto;margin:1.2cm}@media print{body{margin:0}tr,td{break-inside:avoid}h2{break-after:avoid}}</style>");
      f.onload = () => {
        const w = f.contentWindow;
        const done = () => { setTimeout(() => f.remove(), 500); resolve(true); };
        w.addEventListener("afterprint", done, { once: true });
        setTimeout(done, 120000);
        w.focus(); w.print();
      };
      document.body.append(f);
    });
  }

  window.OflSheetExport = { toXlsx, toOds, toCsv, toHtml, printPdf, toOpenFormula };
})();
