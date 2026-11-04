/* ==========================================================================
   LICENCIAS DOCENTES (administrativas, médicas y paros) — CFP 401
   Solo Dirección y Secretaría (Auth.esAdmin). Calcula días hábiles (lunes a viernes menos
   feriados cargados), los del ciclo lectivo, días trabajados y faltas por tipo de cada docente.
   Tablas: licencias_docentes, feriados, licencias_ciclo (sql/54_licencias_docentes.sql).
   ========================================================================== */
const TIPOS_LICENCIA = {
  administrativa: { nombre: 'Licencia administrativa', corto: 'Administrativa', ico: '🗂️' },
  medica: { nombre: 'Licencia médica', corto: 'Médica', ico: '🩺' },
  paro: { nombre: 'Paro', corto: 'Paro', ico: '✊' }
};
const AMBITOS_FERIADO = { nacional: 'Nacional', provincial: 'Provincial', municipal: 'Municipal', asueto: 'Asueto / no laborable' };

const LicenciasModulo = {
  puede: false,
  tab: 'resumen',
  docentes: [], licencias: [], feriados: [], ciclos: [],
  ciclo: new Date().getFullYear(),
  desde: null, hasta: null,     // período analizado en el resumen (vacío = ciclo completo)
  filtroDocente: '', filtroTipo: '', detalleDocente: null,
  modo: 'ciclo', totalOficial: null,   // modo del período del resumen: ciclo | cad | cadint | libre

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  fmt(s) { return s ? String(s).slice(0, 10).split('-').reverse().join('/') : ''; },
  hoyISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
  nom(d) { return d ? `${d.apellido || ''}, ${d.nombre || ''}`.replace(/^, |, $/g, '') : '(docente eliminado)'; },

  /* ---------- cálculo de días ---------- */
  // Devuelve la lista de fechas hábiles (YYYY-MM-DD) entre dos fechas inclusive.
  diasHabiles(desde, hasta) {
    const out = [];
    if (!desde || !hasta || hasta < desde) return out;
    const fer = this.setFeriados();
    const d = new Date(desde + 'T00:00:00Z'), fin = new Date(hasta + 'T00:00:00Z');
    for (; d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      const iso = d.toISOString().slice(0, 10);
      if (!fer.has(iso)) out.push(iso);
    }
    return out;
  },
  setFeriados() { return new Set(this.feriados.map(f => String(f.fecha).slice(0, 10))); },
  cicloFechas(anio) {
    const c = this.ciclos.find(x => Number(x.ciclo) === Number(anio));
    return c ? { inicio: String(c.inicio).slice(0, 10), fin: String(c.fin).slice(0, 10), definido: true }
             : { inicio: `${anio}-03-01`, fin: `${anio}-12-31`, definido: false };
  },
  // Calificación Anual Docente: período y total oficial (Pautas CAD 2026: 15/11/2025 al 16/11/2026 = 248 días)
  cadConfig(anio) {
    const c = this.ciclos.find(x => Number(x.ciclo) === Number(anio)) || {};
    const iso = v => (v ? String(v).slice(0, 10) : null);
    const pre = Number(anio) === 2026;
    return {
      desde: iso(c.cad_desde) || `${anio - 1}-11-15`,
      hasta: iso(c.cad_hasta) || `${anio}-11-16`,
      total: ('cad_total' in c) ? (c.cad_total == null ? null : Number(c.cad_total)) : (pre ? 248 : null),   // vacío guardado = calcular con el calendario
      intDesde: iso(c.cad_interino_desde) || `${anio}-03-01`
    };
  },
  // Fechas hábiles de una licencia recortadas al período [d, h]
  diasLicencia(lic, d, h) {
    const a = d && d > lic.desde ? d : lic.desde, b = h && h < lic.hasta ? h : lic.hasta;
    return this.diasHabiles(String(a).slice(0, 10), String(b).slice(0, 10));
  },

  /* ---------- carga ---------- */
  async cargar() {
    const cont = document.getElementById('licencias-contenido');
    if (!cont) return;
    const perfil = (window.Auth && Auth.usuarioActual) || await Auth.obtenerPerfilSesion();
    this.puede = Auth.esAdmin(String(perfil?.rol || ''));
    if (!this.puede) { cont.innerHTML = '<div class="prog-vacio">No tenés acceso a este panel.</div>'; return; }
    cont.innerHTML = '<p class="seg-cargando">Cargando licencias…</p>';
    try {
      // Igual que Trayectos: se leen directo de profiles (la administración tiene lectura)
      let rDoc = await supabase.from('profiles').select('id,dni,apellido,nombre,estado').eq('rol', 'docente').order('apellido', { ascending: true });
      if (rDoc.error || !(rDoc.data || []).length) { const r2 = await supabase.rpc('licencias_listar_docentes'); if (!r2.error && (r2.data || []).length) rDoc = r2; }
      const [rLic, rFer, rCic] = await Promise.all([
        supabase.from('licencias_docentes').select('*').order('desde', { ascending: false }),
        supabase.from('feriados').select('*').order('fecha'),
        supabase.from('licencias_ciclo').select('*')
      ]);
      if (rLic.error) throw rLic.error;
      if (!(rDoc.data || []).length) { const r3 = await supabase.from('profiles').select('*').in('rol', ['docente', 'Docente', 'DOCENTE']); if (!r3.error && (r3.data || []).length) rDoc = r3; }
      this.errDocentes = (rDoc.error && rDoc.error.message) || '';
      this.docentes = rDoc.data || [];
      this.licencias = rLic.data || [];
      this.feriados = (rFer.error ? [] : rFer.data) || [];
      this.ciclos = (rCic.error ? [] : rCic.data) || [];
      this.render();
    } catch (err) {
      console.error('Licencias:', err);
      const falta = /licencias_|feriados/i.test(err.message || '');
      cont.innerHTML = `<div class="prog-vacio">No se pudieron cargar las licencias.${falta ? ' Falta ejecutar <strong>sql/54_licencias_docentes.sql</strong> en Supabase.' : ''}<br><small>${this.esc(err.message || '')}</small></div>`;
    }
  },

  irA(t) { this.tab = t; this.render(); },

  render() {
    const cont = document.getElementById('licencias-contenido');
    if (!cont) return;
    const tabs = [['resumen', '📊 Resumen por docente'], ['licencias', '📝 Licencias y paros'], ['feriados', '📅 Feriados'], ['ciclo', '🏫 Ciclo lectivo']];
    cont.innerHTML = `
      <div class="plan-tabs">${tabs.map(([id, et]) => `<button type="button" class="plan-tab ${this.tab === id ? 'activo' : ''}" onclick="LicenciasModulo.irA('${id}')">${et}</button>`).join('')}</div>
      <div id="lic-panel"></div>`;
    const p = document.getElementById('lic-panel');
    p.innerHTML = this.tab === 'resumen' ? this.vistaResumen() : this.tab === 'licencias' ? this.vistaLicencias()
      : this.tab === 'feriados' ? this.vistaFeriados() : this.vistaCiclo();
  },

  aniosDisponibles() {
    const s = new Set([new Date().getFullYear(), Number(this.ciclo)]);
    this.ciclos.forEach(c => s.add(Number(c.ciclo)));
    this.licencias.forEach(l => s.add(Number(String(l.desde).slice(0, 4))));
    return [...s].sort((a, b) => b - a);
  },
  selAnio() {
    return `<label>Ciclo lectivo <select class="form-control" onchange="LicenciasModulo.ciclo=Number(this.value); if (LicenciasModulo.modo==='libre') LicenciasModulo.modo='ciclo'; LicenciasModulo.desde=null; LicenciasModulo.hasta=null; LicenciasModulo.render();">${this.aniosDisponibles().map(a => `<option ${a === Number(this.ciclo) ? 'selected' : ''}>${a}</option>`).join('')}</select></label>`;
  },

  /* ============================== RESUMEN ============================== */
  calcularDocente(doc, d, h) {
    const por = { administrativa: new Set(), medica: new Set(), paro: new Set() };
    const todas = new Set();
    this.licencias.filter(l => l.docente_id === doc.id).forEach(l => {
      this.diasLicencia(l, d, h).forEach(f => { por[l.tipo]?.add(f); todas.add(f); });
    });
    return { por, total: todas.size };
  },

  vistaResumen() {
    const cf = this.cicloFechas(this.ciclo);
    const cad = this.cadConfig(this.ciclo);
    if (this.modo === 'cad') { this.desde = cad.desde; this.hasta = cad.hasta; this.totalOficial = cad.total; }
    else if (this.modo === 'cadint') { this.desde = cad.intDesde; this.hasta = cad.hasta; this.totalOficial = null; }
    else this.totalOficial = null;
    const d = this.desde || cf.inicio, h = this.hasta || cf.fin;
    const habCiclo = this.diasHabiles(cf.inicio, cf.fin).length;
    const habCalc = this.diasHabiles(d, h).length;
    const habPer = this.totalOficial != null ? this.totalOficial : habCalc;
    const hoy = this.hoyISO();
    const transc = hoy < cf.inicio ? 0 : this.diasHabiles(cf.inicio, hoy < cf.fin ? hoy : cf.fin).length;
    const filas = this.docentes.map(doc => ({ doc, ...this.calcularDocente(doc, d, h) }));
    // docentes con licencias pero fuera de la lista (p. ej. dados de baja)
    const ids = new Set(this.docentes.map(x => x.id));
    this.licencias.filter(l => !ids.has(l.docente_id)).forEach(l => { if (!filas.find(f => f.doc.id === l.docente_id)) { const doc = { id: l.docente_id, apellido: '(docente dado de baja)', nombre: '' }; filas.push({ doc, ...this.calcularDocente(doc, d, h) }); } });
    filas.sort((a, b) => b.total - a.total || this.nom(a.doc).localeCompare(this.nom(b.doc)));
    const totalInput = `<input type="number" min="0" class="form-control" style="width:6.5rem; font-size:1.4rem; font-weight:800; padding:.1rem .4rem;" value="${this.totalOficial ?? ''}" placeholder="–" onchange="LicenciasModulo.guardarTotalCad(this.value)" onkeydown="if (event.key === 'Enter') this.blur()" title="Escribí el total oficial de días de asistencia">`;
    const tarj = (t, v, sub) => `<div style="flex:1 1 11rem; background:#fff; border:1px solid var(--cfp-line-2,#e2e8f0); border-radius:12px; padding:.7rem .9rem;"><div style="font-size:.75rem; color:#64748b; font-weight:700;">${t}</div><div style="font-size:1.5rem; font-weight:800; color:#0f172a;">${v}</div><div style="font-size:.72rem; color:#64748b;">${sub || ''}</div></div>`;
    return `
      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end; margin:.5rem 0;">
        ${this.selAnio()}
        <label>Período <select class="form-control" onchange="LicenciasModulo.modo=this.value; if (this.value==='ciclo'||this.value==='libre') { LicenciasModulo.desde=null; LicenciasModulo.hasta=null; } LicenciasModulo.render();">
          <option value="ciclo" ${this.modo === 'ciclo' ? 'selected' : ''}>Ciclo lectivo</option>
          <option value="cad" ${this.modo === 'cad' ? 'selected' : ''}>Calificación anual (docentes con continuidad)</option>
          <option value="cadint" ${this.modo === 'cadint' ? 'selected' : ''}>Calificación anual (titulares interinos)</option>
          <option value="libre" ${this.modo === 'libre' ? 'selected' : ''}>Otro período…</option></select></label>
        <label>desde <input type="date" class="form-control" value="${d}" ${this.modo === 'cad' || this.modo === 'cadint' ? 'disabled' : ''} onchange="LicenciasModulo.modo='libre'; LicenciasModulo.desde=this.value; LicenciasModulo.render();"></label>
        <label>hasta <input type="date" class="form-control" value="${h}" ${this.modo === 'cad' || this.modo === 'cadint' ? 'disabled' : ''} onchange="LicenciasModulo.modo='libre'; LicenciasModulo.hasta=this.value; LicenciasModulo.render();"></label>
        <button class="act-btn-sec" onclick="LicenciasModulo.modo='libre'; LicenciasModulo.hasta=LicenciasModulo.hoyISO() < '${cf.fin}' ? LicenciasModulo.hoyISO() : '${cf.fin}'; LicenciasModulo.desde=null; LicenciasModulo.render();">Hasta hoy</button>
        <button class="act-btn-sec" onclick="LicenciasModulo.modo='ciclo'; LicenciasModulo.desde=null; LicenciasModulo.hasta=null; LicenciasModulo.render();">Ciclo completo</button>
        <button class="act-btn-sec" onclick="LicenciasModulo.exportar()">⬇️ Excel</button>
      </div>
      ${this.docentes.length ? '' : `<p class="plan-meta" style="color:#b91c1c;">⚠️ No se pudo leer la lista de docentes${this.errDocentes ? ': ' + this.esc(this.errDocentes) : ' (la consulta no devolvió ninguno)'}.</p>`}
      ${cf.definido ? '' : `<p class="plan-meta" style="color:#b45309;">⚠️ El ciclo lectivo ${this.ciclo} todavía no tiene fechas cargadas: se usa del 01/03 al 31/12 de forma provisoria. Cargalas en «Ciclo lectivo».</p>`}
      <div style="display:flex; gap:.7rem; flex-wrap:wrap; margin:.5rem 0 1rem;">
        ${tarj('Días hábiles del ciclo ' + this.ciclo, habCiclo, `${this.fmt(cf.inicio)} al ${this.fmt(cf.fin)}`)}
        ${tarj('Transcurridos hasta hoy', transc, 'días hábiles')}
        ${tarj(this.modo === 'cad' ? 'Días de asistencia (total oficial, editable)' : this.totalOficial != null ? 'Días de asistencia (total oficial)' : 'Período analizado', this.modo === 'cad' ? totalInput : habPer, `${this.fmt(d)} al ${this.fmt(h)}` + (this.totalOficial != null ? ` · el calendario cargado daría ${habCalc}` : ''))}
      </div>
      ${this.modo === 'cad' && this.totalOficial != null ? '<p class="plan-meta">Total oficial según las Pautas de Orientación para la Calificación Anual Docente (editable en «Ciclo lectivo»). Los días trabajados = total oficial menos las faltas cargadas.</p>' : ''}
      ${this.modo === 'cadint' ? '<p class="plan-meta">Titulares interinos: la normativa no fija un total, se calcula con el calendario cargado.</p>' : ''}
      <p class="plan-meta">Días hábiles = lunes a viernes sin feriados ni asuetos cargados. «Días trabajados» = días hábiles del período menos las faltas (licencias y paros) que caen en él.</p>
      <div class="sec-tabla-wrap"><table class="sec-tabla">
        <thead><tr><th>Docente</th><th>Días hábiles del período</th><th>Días trabajados</th><th>Faltas totales</th><th>🗂️ Administrativas</th><th>🩺 Médicas</th><th>✊ Paros</th><th>% asistencia</th><th></th></tr></thead>
        <tbody>${filas.map(f => `<tr>
          <td>${this.esc(this.nom(f.doc))}</td><td>${habPer}</td><td><b>${Math.max(habPer - f.total, 0)}</b></td><td><b>${f.total}</b></td>
          <td>${f.por.administrativa.size}</td><td>${f.por.medica.size}</td><td>${f.por.paro.size}</td>
          <td>${habPer ? Math.round((Math.max(habPer - f.total, 0) / habPer) * 100) + '%' : '–'}</td>
          <td><button class="act-btn-sec" onclick="LicenciasModulo.verDetalle('${f.doc.id}')">Ver detalle</button></td></tr>`).join('') || '<tr><td colspan="9">No hay docentes cargados.</td></tr>'}</tbody>
      </table></div>`;
  },

  verDetalle(docId) {
    const cf = this.cicloFechas(this.ciclo), d = this.desde || cf.inicio, h = this.hasta || cf.fin;
    const doc = this.docentes.find(x => x.id === docId);
    const ls = this.licencias.filter(l => l.docente_id === docId && l.hasta >= d && l.desde <= h).sort((a, b) => (a.desde < b.desde ? -1 : 1));
    Swal.fire({
      title: this.esc(this.nom(doc)), width: 720,
      html: `<p class="plan-meta" style="text-align:left;">Período: ${this.fmt(d)} al ${this.fmt(h)}</p>
        <table class="sec-tabla" style="width:100%; text-align:left;"><thead><tr><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Días hábiles</th><th>Detalle</th></tr></thead><tbody>
        ${ls.map(l => `<tr><td>${TIPOS_LICENCIA[l.tipo]?.ico || ''} ${this.esc(TIPOS_LICENCIA[l.tipo]?.corto || l.tipo)}</td><td>${this.fmt(l.desde)}</td><td>${this.fmt(l.hasta)}</td><td>${this.diasLicencia(l, d, h).length}</td><td>${this.esc([l.articulo, l.detalle].filter(Boolean).join(' — '))}</td></tr>`).join('') || '<tr><td colspan="5">Sin licencias ni paros en el período.</td></tr>'}
        </tbody></table>`,
      confirmButtonText: 'Cerrar'
    });
  },

  async exportar() {
    if (!window.ExcelJS) { Swal.fire('No disponible', 'No se pudo cargar el generador de Excel.', 'info'); return; }
    const cf = this.cicloFechas(this.ciclo), d = this.desde || cf.inicio, h = this.hasta || cf.fin;
    const habPer = this.totalOficial != null ? this.totalOficial : this.diasHabiles(d, h).length;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Resumen');
    ws.addRow([`Licencias docentes — ciclo ${this.ciclo} — período ${this.fmt(d)} al ${this.fmt(h)} (${habPer} días hábiles)`]).font = { bold: true };
    ws.addRow(['Docente', 'DNI', 'Días hábiles', 'Días trabajados', 'Faltas totales', 'Administrativas', 'Médicas', 'Paros']).font = { bold: true };
    this.docentes.forEach(doc => { const f = this.calcularDocente(doc, d, h); ws.addRow([this.nom(doc), doc.dni || '', habPer, Math.max(habPer - f.total, 0), f.total, f.por.administrativa.size, f.por.medica.size, f.por.paro.size]); });
    ws.columns.forEach((c, i) => { c.width = i === 0 ? 34 : 16; });
    const ws2 = wb.addWorksheet('Detalle');
    ws2.addRow(['Docente', 'Tipo', 'Desde', 'Hasta', 'Días hábiles', 'Artículo / causal', 'Detalle']).font = { bold: true };
    this.licencias.filter(l => l.hasta >= d && l.desde <= h).forEach(l => ws2.addRow([this.nom(this.docentes.find(x => x.id === l.docente_id)), TIPOS_LICENCIA[l.tipo]?.corto || l.tipo, this.fmt(l.desde), this.fmt(l.hasta), this.diasLicencia(l, d, h).length, l.articulo || '', l.detalle || '']));
    ws2.columns.forEach((c, i) => { c.width = i === 0 ? 34 : 18; });
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `Licencias_docentes_${this.ciclo}.xlsx`; a.click(); URL.revokeObjectURL(a.href);
  },

  // Guarda el total oficial de días de asistencia del período de calificación (vacío = calcular con el calendario)
  async guardarTotalCad(valor) {
    const cf = this.cicloFechas(this.ciclo);
    const total = String(valor).trim() === '' ? null : Math.max(0, Math.round(Number(valor)));
    const ciclo = this.ciclos.find(x => Number(x.ciclo) === Number(this.ciclo));
    if (ciclo) ciclo.cad_total = total; else this.ciclos.push({ ciclo: Number(this.ciclo), inicio: cf.inicio, fin: cf.fin, cad_total: total });
    const { error } = await supabase.from('licencias_ciclo').upsert({ ciclo: Number(this.ciclo), inicio: cf.inicio, fin: cf.fin, cad_total: total }, { onConflict: 'ciclo' });
    if (error) Swal.fire('No se pudo guardar el total', (/cad_/.test(error.message || '') ? 'Falta ejecutar sql/55_licencias_calificacion_anual.sql en Supabase. ' : '') + (error.message || ''), 'error');
    else Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Total guardado', showConfirmButton: false, timer: 1400 });
    this.render();
  },

  /* ============================== LICENCIAS ============================== */
  vistaLicencias() {
    const anio = Number(this.ciclo);
    const ls = this.licencias.filter(l => String(l.desde).slice(0, 4) == anio || String(l.hasta).slice(0, 4) == anio)
      .filter(l => !this.filtroDocente || l.docente_id === this.filtroDocente)
      .filter(l => !this.filtroTipo || l.tipo === this.filtroTipo);
    return `
      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end; margin:.5rem 0;">
        ${this.selAnio()}
        <label>Docente <select class="form-control" onchange="LicenciasModulo.filtroDocente=this.value; LicenciasModulo.render();"><option value="">Todos</option>${this.docentes.map(x => `<option value="${x.id}" ${x.id === this.filtroDocente ? 'selected' : ''}>${this.esc(this.nom(x))}</option>`).join('')}</select></label>
        <label>Tipo <select class="form-control" onchange="LicenciasModulo.filtroTipo=this.value; LicenciasModulo.render();"><option value="">Todos</option>${Object.entries(TIPOS_LICENCIA).map(([k, v]) => `<option value="${k}" ${k === this.filtroTipo ? 'selected' : ''}>${v.corto}</option>`).join('')}</select></label>
        <button class="act-btn" onclick="LicenciasModulo.formLicencia()">➕ Cargar licencia / paro</button>
      </div>
      <div class="sec-tabla-wrap"><table class="sec-tabla">
        <thead><tr><th>Docente</th><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Días hábiles</th><th>Artículo / causal</th><th>Detalle</th><th></th></tr></thead>
        <tbody>${ls.map(l => `<tr>
          <td>${this.esc(this.nom(this.docentes.find(x => x.id === l.docente_id)))}</td>
          <td>${TIPOS_LICENCIA[l.tipo]?.ico || ''} ${this.esc(TIPOS_LICENCIA[l.tipo]?.corto || l.tipo)}</td>
          <td>${this.fmt(l.desde)}</td><td>${this.fmt(l.hasta)}</td>
          <td><b>${this.diasHabiles(String(l.desde).slice(0, 10), String(l.hasta).slice(0, 10)).length}</b></td>
          <td>${this.esc(l.articulo || '')}</td><td>${this.esc(l.detalle || '')}</td>
          <td style="white-space:nowrap;"><button class="act-btn-sec" title="Editar" onclick="LicenciasModulo.formLicencia(${l.id})">✏️</button> <button class="act-btn-sec" title="Eliminar" style="color:#b91c1c !important;" onclick="LicenciasModulo.borrarLicencia(${l.id})">🗑️</button></td></tr>`).join('') || '<tr><td colspan="8">No hay licencias ni paros cargados para este ciclo.</td></tr>'}</tbody>
      </table></div>`;
  },

  async formLicencia(id) {
    const l = id ? this.licencias.find(x => x.id === id) : null;
    const self = this;
    const { value } = await Swal.fire({
      title: l ? 'Editar licencia / paro' : 'Cargar licencia / paro', width: 560,
      html: `<div style="text-align:left; display:grid; gap:.4rem;">
        <label>Docente<select id="lc-doc" class="swal2-input"><option value="">(elegir)</option>${this.docentes.map(x => `<option value="${x.id}" ${l?.docente_id === x.id ? 'selected' : ''}>${this.esc(this.nom(x))} — DNI ${this.esc(x.dni || '')}</option>`).join('')}</select></label>
        <label>Tipo<select id="lc-tipo" class="swal2-input">${Object.entries(TIPOS_LICENCIA).map(([k, v]) => `<option value="${k}" ${l?.tipo === k ? 'selected' : ''}>${v.nombre}</option>`).join('')}</select></label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:.5rem;">
          <label>Desde<input id="lc-desde" type="date" class="swal2-input" value="${l ? String(l.desde).slice(0, 10) : ''}"></label>
          <label>Hasta (inclusive)<input id="lc-hasta" type="date" class="swal2-input" value="${l ? String(l.hasta).slice(0, 10) : ''}"></label>
        </div>
        <div id="lc-calc" style="background:#f1f5f9; border-radius:8px; padding:.5rem .7rem; font-size:.85rem; color:#334155;">Elegí las fechas para ver los días hábiles.</div>
        <label>Artículo / causal (opcional)<input id="lc-art" class="swal2-input" placeholder="Ej.: Art. 114 inc. c, enfermedad, estudio" value="${this.esc(l?.articulo || '')}"></label>
        <label>Detalle (opcional)<textarea id="lc-det" class="swal2-textarea" maxlength="500" placeholder="N.º de certificado, expediente, observaciones…">${this.esc(l?.detalle || '')}</textarea></label>
      </div>`,
      didOpen: () => {
        const calc = () => {
          const d = document.getElementById('lc-desde').value, h = document.getElementById('lc-hasta').value, doc = document.getElementById('lc-doc').value;
          const box = document.getElementById('lc-calc');
          if (!d || !h) { box.textContent = 'Elegí las fechas para ver los días hábiles.'; return; }
          if (h < d) { box.innerHTML = '<span style="color:#b91c1c;">La fecha «hasta» es anterior a «desde».</span>'; return; }
          const dias = self.diasHabiles(d, h);
          const corridos = Math.round((new Date(h) - new Date(d)) / 86400000) + 1;
          const sol = doc ? self.licencias.filter(x => x.docente_id === doc && x.id !== id && x.desde <= h && x.hasta >= d) : [];
          box.innerHTML = `<b>${dias.length}</b> días hábiles (${corridos} corridos; se excluyen fines de semana y feriados cargados).${sol.length ? `<br><span style="color:#b45309;">⚠️ Se superpone con otra licencia de este docente (${sol.map(x => self.fmt(x.desde) + ' al ' + self.fmt(x.hasta)).join('; ')}). Los días repetidos se cuentan una sola vez.</span>` : ''}`;
        };
        ['lc-desde', 'lc-hasta', 'lc-doc'].forEach(i => document.getElementById(i).addEventListener('change', calc)); calc();
      },
      focusConfirm: false, showCancelButton: true, confirmButtonText: 'Guardar',
      preConfirm: () => {
        const g = i => document.getElementById(i).value.trim();
        if (!g('lc-doc')) { Swal.showValidationMessage('Elegí el docente.'); return false; }
        if (!g('lc-desde') || !g('lc-hasta')) { Swal.showValidationMessage('Completá las fechas desde y hasta.'); return false; }
        if (g('lc-hasta') < g('lc-desde')) { Swal.showValidationMessage('La fecha «hasta» no puede ser anterior a «desde».'); return false; }
        return { docente_id: g('lc-doc'), tipo: g('lc-tipo'), desde: g('lc-desde'), hasta: g('lc-hasta'), articulo: g('lc-art') || null, detalle: g('lc-det') || null };
      }
    });
    if (!value) return;
    try {
      const perfil = (window.Auth && Auth.usuarioActual) || {};
      const q = l ? supabase.from('licencias_docentes').update(value).eq('id', l.id)
        : supabase.from('licencias_docentes').insert([{ ...value, creado_por_nombre: `${perfil.apellido || ''}, ${perfil.nombre || ''}`.trim() }]);
      const { error } = await q;
      if (error) throw error;
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Guardado', showConfirmButton: false, timer: 1600 });
      await this.cargar();
    } catch (err) { Swal.fire('No se pudo guardar', err.message || '', 'error'); }
  },

  async borrarLicencia(id) {
    const l = this.licencias.find(x => x.id === id);
    const r = await Swal.fire({ title: '¿Eliminar esta licencia?', text: l ? `${this.nom(this.docentes.find(x => x.id === l.docente_id))}: ${this.fmt(l.desde)} al ${this.fmt(l.hasta)}` : '', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#b91c1c' });
    if (!r.isConfirmed) return;
    const { error } = await supabase.from('licencias_docentes').delete().eq('id', id);
    if (error) { Swal.fire('No se pudo eliminar', error.message || '', 'error'); return; }
    await this.cargar();
  },

  /* ============================== FERIADOS ============================== */
  vistaFeriados() {
    const fs = this.feriados.filter(f => String(f.fecha).slice(0, 4) == this.ciclo);
    const dia = f => ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][new Date(String(f.fecha).slice(0, 10) + 'T00:00:00Z').getUTCDay()];
    return `
      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end; margin:.5rem 0;">
        ${this.selAnio()}
        <button class="act-btn" onclick="LicenciasModulo.formFeriado()">➕ Agregar feriado o asueto</button>
      </div>
      <p class="plan-meta">Cargá acá los feriados nacionales, provinciales y municipales, y los asuetos o recesos (por ejemplo el receso invernal, con «hasta»). Esos días no cuentan como hábiles. Los que caen sábado o domingo no cambian nada.</p>
      <div class="sec-tabla-wrap"><table class="sec-tabla">
        <thead><tr><th>Fecha</th><th>Día</th><th>Nombre</th><th>Ámbito</th><th></th></tr></thead>
        <tbody>${fs.map(f => `<tr><td>${this.fmt(f.fecha)}</td><td>${dia(f)}</td><td>${this.esc(f.nombre)}</td><td>${this.esc(AMBITOS_FERIADO[f.ambito] || f.ambito)}</td>
          <td><button class="act-btn-sec" title="Eliminar" style="color:#b91c1c !important;" onclick="LicenciasModulo.borrarFeriado(${f.id})">🗑️</button></td></tr>`).join('') || '<tr><td colspan="5">No hay feriados cargados para este año.</td></tr>'}</tbody>
      </table></div>`;
  },

  async formFeriado() {
    const { value } = await Swal.fire({
      title: 'Agregar feriado o asueto', width: 520,
      html: `<div style="text-align:left; display:grid; gap:.4rem;">
        <label>Ámbito<select id="fe-amb" class="swal2-input">${Object.entries(AMBITOS_FERIADO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label>Nombre<input id="fe-nom" class="swal2-input" placeholder="Ej.: Día de la Tradición, receso invernal"></label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:.5rem;">
          <label>Fecha<input id="fe-desde" type="date" class="swal2-input"></label>
          <label>Hasta (si son varios días)<input id="fe-hasta" type="date" class="swal2-input"></label>
        </div></div>`,
      focusConfirm: false, showCancelButton: true, confirmButtonText: 'Guardar',
      preConfirm: () => {
        const g = i => document.getElementById(i).value.trim();
        if (!g('fe-nom') || !g('fe-desde')) { Swal.showValidationMessage('Completá nombre y fecha.'); return false; }
        const hasta = g('fe-hasta') || g('fe-desde');
        if (hasta < g('fe-desde')) { Swal.showValidationMessage('«Hasta» no puede ser anterior a la fecha.'); return false; }
        const filas = [], d = new Date(g('fe-desde') + 'T00:00:00Z'), fin = new Date(hasta + 'T00:00:00Z');
        if ((fin - d) / 86400000 > 60) { Swal.showValidationMessage('El rango no puede superar 60 días.'); return false; }
        for (; d <= fin; d.setUTCDate(d.getUTCDate() + 1)) filas.push({ fecha: d.toISOString().slice(0, 10), nombre: g('fe-nom'), ambito: g('fe-amb') });
        return filas;
      }
    });
    if (!value) return;
    const { error } = await supabase.from('feriados').upsert(value, { onConflict: 'fecha,ambito' });
    if (error) { Swal.fire('No se pudo guardar', error.message || '', 'error'); return; }
    await this.cargar();
  },

  async borrarFeriado(id) {
    const { error } = await supabase.from('feriados').delete().eq('id', id);
    if (error) { Swal.fire('No se pudo eliminar', error.message || '', 'error'); return; }
    await this.cargar();
  },

  /* ============================== CICLO LECTIVO ============================== */
  vistaCiclo() {
    const cf = this.cicloFechas(this.ciclo), cad = this.cadConfig(this.ciclo);
    return `
      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end; margin:.5rem 0;">
        ${this.selAnio()}
        <label>Inicio <input id="ci-ini" type="date" class="form-control" value="${cf.inicio}"></label>
        <label>Fin <input id="ci-fin" type="date" class="form-control" value="${cf.fin}"></label>
      </div>
      <h4 style="margin:1rem 0 .3rem;">Calificación anual docente</h4>
      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end; margin:.5rem 0;">
        <label>Período desde <input id="ci-cdesde" type="date" class="form-control" value="${cad.desde}"></label>
        <label>hasta <input id="ci-chasta" type="date" class="form-control" value="${cad.hasta}"></label>
        <label>Total oficial de días de asistencia <input id="ci-ctotal" type="number" min="0" class="form-control" style="width:8rem;" value="${cad.total ?? ''}" placeholder="(calcular)"></label>
        <label>Titulares interinos desde <input id="ci-cint" type="date" class="form-control" value="${cad.intDesde}"></label>
      </div>
      <p class="plan-meta">Según las Pautas de Orientación CAD 2026: continuidad del 15/11/2025 al 16/11/2026 con 248 días de asistencia; interinos desde el 01/03/2026. Si dejás el total vacío, se calcula con el calendario.</p>
      <button class="act-btn" onclick="LicenciasModulo.guardarCiclo()">Guardar ciclo ${this.ciclo}</button>
      ${cf.definido ? '' : '<p class="plan-meta" style="color:#b45309;">⚠️ Este ciclo todavía no está guardado; se muestran fechas provisorias (01/03 al 31/12).</p>'}
      <p class="plan-meta">Días hábiles del ciclo con las fechas de arriba y los feriados cargados: <b>${this.diasHabiles(cf.inicio, cf.fin).length}</b>.</p>`;
  },

  async guardarCiclo() {
    const inicio = document.getElementById('ci-ini').value, fin = document.getElementById('ci-fin').value;
    if (!inicio || !fin || fin < inicio) { Swal.fire('Revisá las fechas', 'Completá inicio y fin (el fin no puede ser anterior al inicio).', 'warning'); return; }
    const v = i => document.getElementById(i).value;
    const fila = { ciclo: Number(this.ciclo), inicio, fin, cad_desde: v('ci-cdesde') || null, cad_hasta: v('ci-chasta') || null, cad_total: v('ci-ctotal') === '' ? null : Number(v('ci-ctotal')), cad_interino_desde: v('ci-cint') || null };
    let { error } = await supabase.from('licencias_ciclo').upsert(fila, { onConflict: 'ciclo' });
    if (error && /cad_/.test(error.message || '')) { const r = await supabase.from('licencias_ciclo').upsert({ ciclo: fila.ciclo, inicio, fin }, { onConflict: 'ciclo' }); error = r.error; if (!error) Swal.fire('Guardado parcialmente', 'Falta ejecutar sql/55_licencias_calificacion_anual.sql para guardar el período de calificación.', 'info'); }
    if (error) { Swal.fire('No se pudo guardar', error.message || '', 'error'); return; }
    this.desde = null; this.hasta = null;
    await this.cargar();
  }
};
window.LicenciasModulo = LicenciasModulo;
