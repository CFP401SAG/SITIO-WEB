/* Ver en PDF (sin descargar) — convierte en el navegador las planillas que hoy se bajan en Excel.

   Cómo funciona (a propósito, sin tocar el armado de cada Excel):
   - Cada botón «👁️ Ver PDF» llama  VistaPDF.ver(() => Modulo.metodoQueDescargaElExcel(), 'Título').
   - Mientras corre ese método, VistaPDF intercepta dos cosas: ExcelJS «writeBuffer» (en vez de generar el .xlsx arma un PDF
     con el MISMO libro de cálculo) y el clic del enlace de descarga (para que no baje nada).
   - El PDF se abre en una pestaña nueva. Si hay que corregir algo, se usa el botón de Excel de siempre.
   Así el PDF y el Excel nunca pueden diferir en datos. Fuera de «ver», el comportamiento de ExcelJS no cambia.

   Dibuja: textos (con ajuste de línea), anchos de columna, celdas combinadas, colores de relleno y de letra, negrita,
   bordes, alineación y filas de encabezado fijas repetidas en cada página. No dibuja imágenes ni logos de la planilla.
   Elige solo el tamaño de hoja: A4 vertical, A4 apaisada o A3 apaisada, según el ancho de la planilla. */

const VistaPDF = {
  BASE: 9,            // tamaño de letra base (pt) para una letra de 11 en Excel
  MARGEN: 30,
  PT_POR_ANCHO: 5.6,  // puntos por unidad de ancho de columna de Excel
  _activo: false,
  _listo: false,
  _ventana: null,
  _abierto: false,
  _titulo: '',

  /* ---------- Entrada pública ---------- */
  async ver(fn, titulo) {
    if (typeof PDFLib === 'undefined' || typeof ExcelJS === 'undefined') {
      alert('No se cargaron las librerías para armar el PDF. Recargá la página.');
      return;
    }
    if (this._activo) return;
    this._instalar();
    // La pestaña se abre ya, dentro del clic, para que el navegador no la bloquee.
    let w = null;
    try {
      w = window.open('', '_blank');
      if (w) w.document.write('<title>Armando PDF…</title><p style="font:16px sans-serif;padding:2rem">Armando el PDF…</p>');
    } catch (_) { w = null; }
    this._activo = true; this._abierto = false; this._ventana = w; this._titulo = titulo || '';
    try {
      await fn();
    } catch (err) {
      console.error('Ver PDF:', err);
      alert('No se pudo armar el PDF.\n\n' + (err && err.message ? err.message : err));
    } finally {
      this._activo = false;
      if (!this._abierto && w && !w.closed) w.close();
      this._ventana = null;
    }
  },

  /* ---------- Intercepta writeBuffer y la descarga solo mientras dura «ver» ---------- */
  _instalar() {
    if (this._listo) return;
    const self = this;
    const proto = Object.getPrototypeOf(new ExcelJS.Workbook().xlsx);
    const original = proto.writeBuffer;
    proto.writeBuffer = async function (...args) {
      if (!self._activo) return original.apply(this, args);
      const bytes = await self.libroAPDF(this.workbook, self._titulo);
      self._mostrar(bytes);
      return new Uint8Array(0);
    };
    const clic = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (self._activo && this.hasAttribute('download')) return;
      return clic.apply(this, arguments);
    };
    this._listo = true;
  },

  _mostrar(bytes) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    this._abierto = true;
    const w = this._ventana;
    if (w && !w.closed) { w.location.href = url; return; }
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'success', title: 'PDF listo', confirmButtonText: 'Abrir PDF', showCancelButton: true, cancelButtonText: 'Cerrar' })
        .then(r => { if (r.isConfirmed) window.open(url, '_blank'); });
    } else window.open(url, '_blank');
  },

  /* ---------- Libro de ExcelJS → PDF ---------- */
  async libroAPDF(wb, titulo) {
    const doc = await PDFLib.PDFDocument.create();
    const reg = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const neg = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const f = { r: reg, b: neg, set: new Set(reg.getCharacterSet()) };
    let hojas = 0;
    for (const ws of wb.worksheets) {
      if (ws.state && ws.state !== 'visible') continue;
      if (this._hoja(doc, f, ws, titulo)) hojas++;
    }
    if (!hojas) throw new Error('El documento no tiene datos para mostrar.');
    const paginas = doc.getPages(), hoy = new Date().toLocaleDateString('es-AR');
    paginas.forEach((p, i) => {
      const { width } = p.getSize(), gris = PDFLib.rgb(0.4, 0.4, 0.4);
      p.drawText(this._limpiar(`Generado desde la plataforma el ${hoy}`, f.set), { x: this.MARGEN, y: 14, size: 7, font: f.r, color: gris });
      const t = `Pág. ${i + 1} de ${paginas.length}`;
      p.drawText(t, { x: width - this.MARGEN - f.r.widthOfTextAtSize(t, 7), y: 14, size: 7, font: f.r, color: gris });
    });
    doc.setTitle(this._limpiar(titulo || 'Documento', f.set));
    doc.setCreator('Plataforma CFP N.º 401');
    return await doc.save();
  },

  _hoja(doc, f, ws, titulo) {
    const M = this.MARGEN, nc0 = ws.columnCount, nr0 = ws.rowCount;
    if (!nc0 || !nr0) return false;

    // Celdas combinadas
    const merges = {}, cubiertas = new Set();
    let lista = [];
    try { lista = (ws.model && ws.model.merges) || []; } catch (_) { lista = []; }
    const dec = s => {
      const m = /^([A-Z]+)(\d+)$/.exec(s); if (!m) return null;
      let c = 0; for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
      return { c, r: Number(m[2]) };
    };
    for (const m of lista) {
      const [a, b] = String(m).split(':'), p1 = dec(a), p2 = dec(b || a);
      if (!p1 || !p2) continue;
      merges[`${p1.r},${p1.c}`] = { r2: p2.r, c2: p2.c };
      for (let r = p1.r; r <= p2.r; r++) for (let c = p1.c; c <= p2.c; c++) if (r !== p1.r || c !== p1.c) cubiertas.add(`${r},${c}`);
    }

    // Recorte: se ignoran filas y columnas finales sin texto (las plantillas traen formato de sobra)
    let maxC = 0, maxR = 0;
    for (let r = 1; r <= nr0; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= nc0; c++) {
        const cell = row.findCell(c);
        if (!cell || cubiertas.has(`${r},${c}`) || this._valor(cell).txt === '') continue;
        const mg = merges[`${r},${c}`];
        maxC = Math.max(maxC, mg ? mg.c2 : c); maxR = Math.max(maxR, r);
      }
    }
    if (!maxC) return false;
    const nc = Math.min(maxC, nc0), nr = maxR;

    // Columnas (ancho 0 = oculta)
    const anchos = [];
    for (let c = 1; c <= nc; c++) { const col = ws.getColumn(c); anchos.push(col.hidden ? 0 : (col.width || 8.43)); }
    const natural = anchos.reduce((s, a) => s + a * this.PT_POR_ANCHO, 0) || 1;
    let pw, ph;
    if (natural <= 535) { pw = 595.28; ph = 841.89; }
    else if (natural * 0.6 <= 841.89 - 2 * M) { pw = 841.89; ph = 595.28; }
    else { pw = 1190.55; ph = 841.89; }
    const esc = Math.min(1, (pw - 2 * M) / natural);
    const colW = anchos.map(a => a * this.PT_POR_ANCHO * esc);
    const colX = []; let acc = M; colW.forEach(w => { colX.push(acc); acc += w; });
    const fs0 = Math.max(4.5, this.BASE * esc), pad = 2;

    // Filas: texto, alto necesario
    const filas = [];
    const idx = {};
    for (let r = 1; r <= nr; r++) {
      const row = ws.getRow(r);
      if (row.hidden) continue;
      const celdas = [];
      let h = Math.max(row.height ? Math.min(row.height * esc, 45) : 0, fs0 * 1.18 + pad);
      for (let c = 1; c <= nc; c++) {
        if (!colW[c - 1]) continue;
        const key = `${r},${c}`;
        const cell = row.findCell(c);
        const mg = merges[key];
        if (cubiertas.has(key)) continue;
        let ancho = colW[c - 1];
        if (mg) for (let k = c + 1; k <= mg.c2; k++) ancho += colW[k - 1] || 0;
        const rowspan = mg ? mg.r2 - r + 1 : 1, colspan = mg ? mg.c2 - c + 1 : 1;
        const info = { c, ancho, rowspan, colspan, cell, fs: fs0, lineas: [], num: false };
        if (cell) {
          const val = this._valor(cell);
          info.num = val.num;
          const tam = (cell.font && cell.font.size) || 11;
          info.fs = Math.min(16, Math.max(4.5, fs0 * (tam / 11)));
          info.neg = !!(cell.font && cell.font.bold);
          const txt = this._limpiar(val.txt, f.set);
          if (txt !== '') info.lineas = this._envolver(txt, Math.max(4, ancho - 2 * pad), info.neg ? f.b : f.r, info.fs);
          if (rowspan === 1) h = Math.max(h, info.lineas.length * info.fs * 1.18 + 2 * pad);
        }
        celdas.push(info);
      }
      const fila = { r, h, celdas };
      idx[r] = filas.length;
      filas.push(fila);
    }
    if (!filas.some(fl => fl.celdas.some(c => c.lineas.length))) return false;

    // Filas de encabezado que se repiten en cada página
    const vista = ws.views && ws.views[0];
    let nh = vista && vista.state === 'frozen' && vista.ySplit ? Math.min(vista.ySplit, 4) : 0;
    if (!nh) {
      const r1 = filas[0], c1 = r1 && r1.celdas.find(c => c.lineas.length);
      if (r1 && r1.celdas.filter(c => c.lineas.length).length > 1 && c1 && c1.neg) nh = 1;
    }
    const cabecera = filas.filter(fl => fl.r <= nh);

    // Dibujo con cambio de página
    const rgb = PDFLib.rgb;
    const color = argb => {
      if (!argb || typeof argb !== 'string') return null;
      const h = argb.length === 8 ? argb.slice(2) : argb;
      if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
      return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
    };
    let page = null, y = 0;
    const nueva = () => {
      page = doc.addPage([pw, ph]);
      y = ph - M;
      page.drawText(this._limpiar(`${titulo ? titulo + ' · ' : ''}${ws.name}`, f.set), { x: M, y: y - 9, size: 9, font: f.b, color: rgb(0.2, 0.2, 0.2) });
      y -= 18;
    };
    const dibujar = fila => {
      const base = y;
      for (const ce of fila.celdas) {
        const x = colX[ce.c - 1];
        let alto = fila.h;
        for (let k = 1; k < ce.rowspan; k++) { const s = filas[idx[fila.r] + k]; if (s) alto += s.h; }
        alto = Math.min(alto, base - M - 12);
        const cell = ce.cell;
        const rel = cell && cell.fill && cell.fill.type === 'pattern' && cell.fill.pattern !== 'none' ? color(cell.fill.fgColor && cell.fill.fgColor.argb) : null;
        page.drawRectangle({ x, y: base - alto, width: ce.ancho, height: alto, color: rel || undefined, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.25 });
        if (cell && cell.border) {
          const b = cell.border, lin = (x1, y1, x2, y2) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: rgb(0, 0, 0) });
          if (b.top && b.top.style) lin(x, base, x + ce.ancho, base);
          if (b.bottom && b.bottom.style) lin(x, base - alto, x + ce.ancho, base - alto);
          if (b.left && b.left.style) lin(x, base, x, base - alto);
          if (b.right && b.right.style) lin(x + ce.ancho, base, x + ce.ancho, base - alto);
        }
        if (!ce.lineas.length) continue;
        const font = ce.neg ? f.b : f.r, lh = ce.fs * 1.18;
        const al = cell.alignment || {};
        const horiz = al.horizontal === 'center' || al.horizontal === 'centerContinuous' ? 'c' : al.horizontal === 'right' ? 'r' : al.horizontal === 'left' ? 'l' : (ce.num ? 'r' : 'l');
        const bloque = ce.lineas.length * lh;
        let top = base - pad;
        if (al.vertical === 'middle' || al.vertical === 'center') top = base - Math.max(pad, (alto - bloque) / 2);
        else if (al.vertical === 'bottom') top = base - Math.max(pad, alto - bloque - pad);
        const colTxt = color(cell.font && cell.font.color && cell.font.color.argb) || rgb(0, 0, 0);
        ce.lineas.forEach((ln, i) => {
          const w = font.widthOfTextAtSize(ln, ce.fs);
          const tx = horiz === 'c' ? x + (ce.ancho - w) / 2 : horiz === 'r' ? x + ce.ancho - pad - w : x + pad;
          const ty = top - (i + 1) * lh + ce.fs * 0.28;
          if (ty < M - 6) return;
          page.drawText(ln, { x: tx, y: ty, size: ce.fs, font, color: colTxt });
        });
      }
      y -= fila.h;
    };
    for (const fila of filas) {
      if (!page) nueva();
      else if (y - fila.h < M + 12) {
        nueva();
        if (fila.r > nh) cabecera.forEach(dibujar);
      }
      dibujar(fila);
    }
    return true;
  },

  /* ---------- Valores y textos ---------- */
  _valor(cell) {
    let v = cell.value;
    if (v === null || v === undefined) return { txt: '', num: false };
    if (typeof v === 'object' && !(v instanceof Date)) {
      if ('result' in v) v = v.result;
      else if (v.richText) v = v.richText.map(r => r.text).join('');
      else if (v.text !== undefined) v = v.text;
      else if (v.formula || v.sharedFormula) v = '';
      else if (v.error) v = v.error;
      else v = '';
      if (v !== null && typeof v === 'object' && !(v instanceof Date)) v = v.richText ? v.richText.map(r => r.text).join('') : (v.error || '');
    }
    if (v === null || v === undefined) return { txt: '', num: false };
    if (v instanceof Date) {
      const p = n => String(n).padStart(2, '0');
      return { txt: `${p(v.getUTCDate())}/${p(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`, num: false };
    }
    if (typeof v === 'boolean') return { txt: v ? 'Sí' : 'No', num: false };
    if (typeof v === 'number') {
      const fmt = String(cell.numFmt || '');
      const dec = (/0\.(0+)/.exec(fmt) || [])[1];
      let txt;
      if (fmt.includes('%')) txt = (v * 100).toFixed(dec ? dec.length : 0) + '%';
      else if (dec) txt = v.toFixed(dec.length);
      else txt = Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
      return { txt: txt.replace('.', ','), num: true };
    }
    return { txt: String(v), num: false };
  },

  _MAPA: { '✓': 'v', '✔': 'v', '✗': 'x', '✘': 'x', '→': '->', '←': '<-', '≥': '>=', '≤': '<=', ' ': ' ', '\t': ' ' },

  // Deja solo caracteres que la letra del PDF sabe dibujar (si no, pdf-lib falla)
  _limpiar(s, set) {
    let o = '';
    for (const ch of String(s)) {
      const cp = ch.codePointAt(0);
      if (cp === 10 || cp === 13) o += '\n';
      else if (this._MAPA[ch] !== undefined) o += this._MAPA[ch];
      else if (set.has(cp)) o += ch;
    }
    return o;
  },

  _envolver(txt, ancho, font, fs) {
    const lineas = [];
    for (const parrafo of String(txt).replace(/\r/g, '').split('\n')) {
      let actual = '';
      for (const pal of parrafo.split(' ')) {
        const prueba = actual ? actual + ' ' + pal : pal;
        if (font.widthOfTextAtSize(prueba, fs) <= ancho) { actual = prueba; continue; }
        if (actual) { lineas.push(actual); actual = ''; }
        let resto = pal;
        while (resto.length > 1 && font.widthOfTextAtSize(resto, fs) > ancho) {
          let n = resto.length;
          while (n > 1 && font.widthOfTextAtSize(resto.slice(0, n), fs) > ancho) n--;
          lineas.push(resto.slice(0, n)); resto = resto.slice(n);
        }
        actual = resto;
      }
      lineas.push(actual);
    }
    while (lineas.length > 1 && lineas[lineas.length - 1] === '') lineas.pop();
    return lineas;
  }
};

window.VistaPDF = VistaPDF;
