/* ==========================================================================
   EPS — estudiantes desvinculados (CFP 401). Etapa 1: estudiantes y personal.
   Acceso: Dirección, Secretaría y coordinadora EPS (eps_personal.user_id).
   Tablas separadas eps_* (sql/57_eps_base.sql). No toca Formación Profesional.
   ========================================================================== */
const FUNCIONES_EPS = { coordinador: 'Coordinador/a', docente_general: 'Docente de formación general', docente_especifica: 'Docente de formación específica' };

const EpsModulo = {
  asistencia: [], ptfs: [], faltaAsis: false, mesAsis: new Date().toISOString().slice(0, 7), anioCifras: new Date().getFullYear(),
  modulos: [], faltaPtf: false, ptfId: null, ptf: null,
  tab: 'estudiantes', estudiantes: [], personal: [], trayectosCat: [], filtro: '', verBajas: false,

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  fmt(s) { return s ? String(s).slice(0, 10).split('-').reverse().join('/') : ''; },

  // ¿Una persona sin rol de administración es coordinadora EPS? (para mostrar el botón)
  async chequearCoordinador() {
    try { const { data, error } = await supabase.rpc('eps_puede'); return !error && data === true; } catch (e) { return false; }
  },

  async cargar() {
    const cont = document.getElementById('eps-contenido');
    if (!cont) return;
    cont.innerHTML = '<p class="seg-cargando">Cargando EPS…</p>';
    try {
      const [rE, rP, rT] = await Promise.all([
        supabase.from('eps_estudiantes').select('*').order('apellido'),
        supabase.from('eps_personal').select('*').order('apellido'),
        supabase.from('trayectos').select('nombre')
      ]);
      if (rE.error) throw rE.error;
      if (rP.error) throw rP.error;
      this.estudiantes = rE.data || [];
      this.personal = rP.data || [];
      const rM = await supabase.from('eps_modulos').select('*').order('nivel').order('orden').order('nombre');
      this.modulos = rM.error ? [] : (rM.data || []);
      this.faltaPtf = !!rM.error;
      const rA = await supabase.from('eps_asistencia').select('*');
      this.asistencia = rA.error ? [] : (rA.data || []);
      this.faltaAsis = !!rA.error;
      const rPt = await supabase.from('eps_ptf').select('estudiante_id,notas');
      this.ptfs = rPt.error ? [] : (rPt.data || []);
      this.trayectosCat = [...new Set(((rT.error ? [] : rT.data) || []).map(t => (t.nombre || '').trim()).filter(Boolean))].sort();
      this.render();
    } catch (err) {
      console.error('EPS:', err);
      const falta = /eps_/i.test(err.message || '');
      cont.innerHTML = `<div class="prog-vacio">No se pudo cargar EPS.${falta ? ' Falta ejecutar <strong>sql/57_eps_base.sql</strong> en Supabase.' : ''}<br><small>${this.esc(err.message || '')}</small></div>`;
    }
  },

  irA(t) { this.tab = t; this.render(); },

  render() {
    const cont = document.getElementById('eps-contenido');
    const tabs = [['estudiantes', '🎓 Estudiantes'], ['personal', '👥 Personal EPS'], ['modulos', '📚 Módulos por trayecto'], ['asistencia', '🗓️ Asistencia'], ['cifras', '📊 Cifras EPS']];
    cont.innerHTML = `
      <div class="plan-tabs">${tabs.map(([id, et]) => `<button type="button" class="plan-tab ${this.tab === id ? 'activo' : ''}" onclick="EpsModulo.irA('${id}')">${et}</button>`).join('')}</div>
      ${this.tab === 'estudiantes' ? this.vistaEstudiantes() : this.tab === 'personal' ? this.vistaPersonal() : this.tab === 'modulos' ? this.vistaModulos() : this.tab === 'asistencia' ? this.vistaAsistencia() : this.vistaCifras()}`;
  },

  /* ---------- estudiantes ---------- */
  vistaEstudiantes() {
    const q = this.filtro.toLowerCase();
    const act = this.estudiantes.filter(e => e.estado === 'activo').length;
    const lista = this.estudiantes.filter(e => (this.verBajas || e.estado === 'activo') &&
      (!q || `${e.apellido} ${e.nombre} ${e.dni} ${e.trayecto || ''} ${e.escuela_origen || ''}`.toLowerCase().includes(q)));
    const porTray = {};
    this.estudiantes.filter(e => e.estado === 'activo').forEach(e => { const k = e.trayecto || '(sin trayecto)'; porTray[k] = (porTray[k] || 0) + 1; });
    return `
      <div class="seg-card" style="margin-bottom:12px">
        <strong>Matrícula EPS: ${act} estudiante${act === 1 ? '' : 's'} activo${act === 1 ? '' : 's'}</strong>
        <div style="font-size:.85rem;margin-top:4px">${Object.entries(porTray).map(([k, n]) => `${this.esc(k)}: <strong>${n}</strong>`).join(' · ') || 'Sin estudiantes cargados.'}</div>
        <small>Se cuenta aparte de la matrícula de Formación Profesional.</small>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
        <input type="search" class="form-control" style="max-width:260px" placeholder="Buscar nombre, DNI, trayecto…" value="${this.esc(this.filtro)}" oninput="EpsModulo.filtro=this.value;EpsModulo.render();this.focus()">
        <label style="font-size:.85rem"><input type="checkbox" ${this.verBajas ? 'checked' : ''} onchange="EpsModulo.verBajas=this.checked;EpsModulo.render()"> Ver bajas y egresados</label>
        <button class="btn-primary" onclick="EpsModulo.formEstudiante()">+ Nuevo estudiante</button>
        <button class="btn-secundario" onclick="EpsModulo.exportar()">⬇️ Excel</button>
        <button class="btn-secundario" onclick="VistaPDF.ver(() => EpsModulo.exportar(), 'Estudiantes EPS')" title="Se abre en otra pestaña, sin descargar">👁️ Ver PDF</button>
      </div>
      <div style="overflow-x:auto"><table class="tabla-simple" style="width:100%">
        <thead><tr><th>Apellido y nombre</th><th>DNI</th><th>Trayecto</th><th>Escuela de origen</th><th>Dejó en</th><th>Estado</th><th></th></tr></thead>
        <tbody>${lista.map(e => `<tr>
          <td>${this.esc(e.apellido)}, ${this.esc(e.nombre)}</td><td>${this.esc(e.dni)}</td><td>${this.esc(e.trayecto || '')}</td>
          <td>${this.esc(e.escuela_origen || '')}</td><td>${e.anio_desvinculo || ''}</td><td>${this.esc(e.estado)}</td>
          <td style="white-space:nowrap"><button class="btn-secundario" onclick="EpsModulo.abrirPtf(${e.id})">📋 PTF</button> <button class="btn-secundario" onclick="EpsModulo.formEstudiante(${e.id})">✏️</button> <button class="btn-secundario" onclick="EpsModulo.borrarEstudiante(${e.id})">🗑️</button></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center">Sin resultados.</td></tr>'}</tbody>
      </table></div>`;
  },

  async formEstudiante(id) {
    const e = this.estudiantes.find(x => x.id === id) || {};
    const v = k => this.esc(e[k] ?? '');
    const opt = this.trayectosCat.map(t => `<option value="${this.esc(t)}" ${e.trayecto === t ? 'selected' : ''}>${this.esc(t)}</option>`).join('');
    const extra = e.trayecto && !this.trayectosCat.includes(e.trayecto) ? `<option selected>${this.esc(e.trayecto)}</option>` : '';
    const campo = (k, et, tipo = 'text') => `<label style="text-align:left;font-size:.8rem">${et}<input id="eps-${k}" type="${tipo}" class="swal2-input" style="margin:2px 0 8px;width:100%" value="${v(k)}"></label>`;
    const { value } = await Swal.fire({
      title: id ? 'Editar estudiante EPS' : 'Nuevo estudiante EPS', width: 640, showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar',
      html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px">
        ${campo('apellido', 'Apellido')}${campo('nombre', 'Nombre')}${campo('dni', 'DNI')}${campo('fecha_nac', 'Fecha de nacimiento', 'date')}
        ${campo('domicilio', 'Domicilio')}${campo('telefono', 'Teléfono')}${campo('email', 'Correo', 'email')}${campo('tutor', 'Madre/padre/tutor')}
        ${campo('escuela_origen', 'Escuela de origen')}${campo('anio_desvinculo', 'Año en que dejó', 'number')}
        <label style="text-align:left;font-size:.8rem">Trayecto<select id="eps-trayecto" class="swal2-select" style="margin:2px 0 8px;width:100%"><option value="">—</option>${opt}${extra}</select></label>
        ${campo('cohorte', 'Cohorte (año)', 'number')}${campo('fecha_ingreso', 'Fecha de ingreso', 'date')}
        <label style="text-align:left;font-size:.8rem">Estado<select id="eps-estado" class="swal2-select" style="margin:2px 0 8px;width:100%">${['activo', 'baja', 'egresado'].map(s => `<option ${e.estado === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        </div><label style="text-align:left;font-size:.8rem">Observaciones<textarea id="eps-observaciones" class="swal2-textarea" style="margin:2px 0;width:100%">${v('observaciones')}</textarea></label>`,
      preConfirm: () => {
        const g = k => (document.getElementById('eps-' + k)?.value || '').trim();
        const o = { apellido: g('apellido'), nombre: g('nombre'), dni: g('dni').replace(/\D/g, ''), fecha_nac: g('fecha_nac') || null, domicilio: g('domicilio') || null, telefono: g('telefono') || null,
          email: g('email') || null, tutor: g('tutor') || null, escuela_origen: g('escuela_origen') || null, anio_desvinculo: g('anio_desvinculo') ? Number(g('anio_desvinculo')) : null,
          trayecto: g('trayecto') || null, cohorte: g('cohorte') ? Number(g('cohorte')) : null, fecha_ingreso: g('fecha_ingreso') || null, estado: g('estado') || 'activo', observaciones: g('observaciones') || null };
        if (!o.apellido || !o.nombre || !o.dni) { Swal.showValidationMessage('Apellido, nombre y DNI son obligatorios.'); return false; }
        return o;
      }
    });
    if (!value) return;
    const r = id ? await supabase.from('eps_estudiantes').update(value).eq('id', id) : await supabase.from('eps_estudiantes').insert(value);
    if (r.error) return Swal.fire('No se pudo guardar', /duplicate|unique/i.test(r.error.message) ? 'Ya hay un estudiante EPS con ese DNI.' : r.error.message, 'error');
    this.cargar();
  },

  async borrarEstudiante(id) {
    const ok = await Swal.fire({ title: '¿Eliminar estudiante?', text: 'Se borra de EPS (si dejó de cursar, mejor marcarlo como baja).', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar' });
    if (!ok.isConfirmed) return;
    const r = await supabase.from('eps_estudiantes').delete().eq('id', id);
    if (r.error) return Swal.fire('Error', r.error.message, 'error');
    this.cargar();
  },

  /* ---------- personal ---------- */
  vistaPersonal() {
    return `
      <p style="font-size:.85rem">Coordinadora y docentes de EPS se cargan como registros (no necesitan cuenta). Para que la coordinadora entre a EPS, creale la cuenta en Usuarios con el rol «Coordinador/a EPS»: solo ve esta sección. Cargarla acá es solo el registro.</p>
      <div style="margin-bottom:10px"><button class="btn-primary" onclick="EpsModulo.formPersonal()">+ Nueva persona</button></div>
      <div style="overflow-x:auto"><table class="tabla-simple" style="width:100%">
        <thead><tr><th>Apellido y nombre</th><th>Función</th><th>Materia / trayecto</th><th>DNI</th><th>Contacto</th><th></th></tr></thead>
        <tbody>${this.personal.map(p => `<tr ${p.activo ? '' : 'style="opacity:.5"'}>
          <td>${this.esc(p.apellido)}, ${this.esc(p.nombre)}${p.user_id ? ' 🔗' : ''}</td><td>${FUNCIONES_EPS[p.funcion]}</td><td>${this.esc(p.area || '')}</td><td>${this.esc(p.dni || '')}</td>
          <td>${this.esc([p.telefono, p.email].filter(Boolean).join(' · '))}</td>
          <td style="white-space:nowrap"><button class="btn-secundario" onclick="EpsModulo.formPersonal(${p.id})">✏️</button> <button class="btn-secundario" onclick="EpsModulo.borrarPersonal(${p.id})">🗑️</button></td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center">Sin personal cargado.</td></tr>'}</tbody>
      </table></div>`;
  },

  async formPersonal(id) {
    const p = this.personal.find(x => x.id === id) || {};
    const v = k => this.esc(p[k] ?? '');
    const campo = (k, et, tipo = 'text') => `<label style="text-align:left;font-size:.8rem">${et}<input id="epp-${k}" type="${tipo}" class="swal2-input" style="margin:2px 0 8px;width:100%" value="${v(k)}"></label>`;
    const { value } = await Swal.fire({
      title: id ? 'Editar persona' : 'Nueva persona EPS', width: 560, showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar',
      html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px">${campo('apellido', 'Apellido')}${campo('nombre', 'Nombre')}${campo('dni', 'DNI')}
        <label style="text-align:left;font-size:.8rem">Función<select id="epp-funcion" class="swal2-select" style="margin:2px 0 8px;width:100%">${Object.entries(FUNCIONES_EPS).map(([k, n]) => `<option value="${k}" ${p.funcion === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        ${campo('area', 'Materia / trayecto')}${campo('telefono', 'Teléfono')}${campo('email', 'Correo', 'email')}
        <label style="text-align:left;font-size:.8rem">Estado<select id="epp-activo" class="swal2-select" style="margin:2px 0 8px;width:100%"><option value="1" ${p.activo === false ? '' : 'selected'}>Activo</option><option value="0" ${p.activo === false ? 'selected' : ''}>Inactivo</option></select></label></div>`,
      preConfirm: () => {
        const g = k => (document.getElementById('epp-' + k)?.value || '').trim();
        const o = { apellido: g('apellido'), nombre: g('nombre'), dni: g('dni').replace(/\D/g, '') || null, funcion: g('funcion'), area: g('area') || null, telefono: g('telefono') || null, email: g('email') || null, activo: g('activo') !== '0' };
        if (!o.apellido || !o.nombre) { Swal.showValidationMessage('Apellido y nombre son obligatorios.'); return false; }
        return o;
      }
    });
    if (!value) return;
    // Vinculación de la cuenta de la coordinadora por DNI (profiles.dni), solo si la carga la Dirección/Secretaría
    if (value.funcion === 'coordinador' && value.dni) {
      const rp = await supabase.from('profiles').select('id').eq('dni', value.dni).limit(1);
      value.user_id = (rp.data && rp.data[0] && rp.data[0].id) || null;
    } else value.user_id = null;
    const r = id ? await supabase.from('eps_personal').update(value).eq('id', id) : await supabase.from('eps_personal').insert(value);
    if (r.error) return Swal.fire('No se pudo guardar', r.error.message, 'error');
    this.cargar();
  },

  async borrarPersonal(id) {
    const ok = await Swal.fire({ title: '¿Eliminar a esta persona?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar' });
    if (!ok.isConfirmed) return;
    const r = await supabase.from('eps_personal').delete().eq('id', id);
    if (r.error) return Swal.fire('Error', r.error.message, 'error');
    this.cargar();
  },


  /* ---------- módulos de FP por trayecto y nivel (se definen una vez) ---------- */
  vistaModulos() {
    if (this.faltaPtf) return '<div class="prog-vacio">Falta ejecutar <strong>sql/58_eps_ptf.sql</strong> en Supabase.</div>';
    const trs = [...new Set([...this.trayectosCat, ...this.modulos.map(m => m.trayecto)])].sort();
    return `<p style="font-size:.85rem">Definí los módulos de Formación Profesional de cada nivel. Después aparecen en el PTF de cada estudiante de ese trayecto.</p>
      <div style="margin-bottom:10px"><button class="btn-primary" onclick="EpsModulo.formModulo()">+ Agregar módulo</button></div>
      ${trs.map(t => { const ms = this.modulos.filter(m => m.trayecto === t); if (!ms.length) return ''; return `<div class="seg-card" style="margin-bottom:10px"><strong>${this.esc(t)}</strong>${[1, 2, 3, 4].map(n => { const l = ms.filter(m => m.nivel === n); return l.length ? `<div style="margin-top:6px;font-size:.85rem"><b>Nivel ${this.ROM[n]}:</b> ${l.map(m => `${this.esc(m.nombre)} <a href="#" onclick="EpsModulo.borrarModulo(${m.id});return false" title="Quitar">✖</a>`).join(' · ')}</div>` : ''; }).join('')}</div>`; }).join('') || '<p>Sin módulos cargados.</p>'}`;
  },
  async formModulo() {
    const opt = this.trayectosCat.map(t => `<option>${this.esc(t)}</option>`).join('');
    const { value } = await Swal.fire({
      title: 'Agregar módulos', width: 560, showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar',
      html: `<label style="text-align:left;font-size:.8rem;display:block">Trayecto<select id="epm-t" class="swal2-select" style="width:100%;margin:2px 0 8px">${opt}</select></label>
        <label style="text-align:left;font-size:.8rem;display:block">Nivel<select id="epm-n" class="swal2-select" style="width:100%;margin:2px 0 8px">${[1, 2, 3, 4].map(n => `<option value="${n}">Nivel ${this.ROM[n]}</option>`).join('')}</select></label>
        <label style="text-align:left;font-size:.8rem;display:block">Módulos (uno por línea)<textarea id="epm-m" class="swal2-textarea" style="width:100%;margin:2px 0"></textarea></label>`,
      preConfirm: () => {
        const t = document.getElementById('epm-t').value, n = Number(document.getElementById('epm-n').value);
        const nombres = document.getElementById('epm-m').value.split('\n').map(x => x.trim()).filter(Boolean);
        if (!t || !nombres.length) { Swal.showValidationMessage('Elegí trayecto y escribí al menos un módulo.'); return false; }
        const base = this.modulos.filter(m => m.trayecto === t && m.nivel === n).length;
        return nombres.map((nombre, i) => ({ trayecto: t, nivel: n, nombre, orden: base + i }));
      }
    });
    if (!value) return;
    const r = await supabase.from('eps_modulos').upsert(value, { onConflict: 'trayecto,nivel,nombre', ignoreDuplicates: true });
    if (r.error) return Swal.fire('No se pudo guardar', r.error.message, 'error');
    this.cargar();
  },
  async borrarModulo(id) {
    const r = await supabase.from('eps_modulos').delete().eq('id', id);
    if (r.error) return Swal.fire('Error', r.error.message, 'error');
    this.cargar();
  },

  /* ---------- PTF ---------- */
  ROM: { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' },
  COL_FP: ['1er Inf', 'Cuat', '2do Inf', 'Cuat', 'Fin'],
  COL_GEN: ['1° V', '1° C', '2° V', '2° C', 'Final'],
  GEN: ['Prácticas del Lenguaje', 'Matemática', 'Ciencias Sociales', 'Ciencias Naturales', 'Inglés'],
  materiasGen(n) { return n >= 3 ? this.GEN : this.GEN.slice(0, 4); },
  TEXTOS: [
    ['DIAGNÓSTICO INICIAL Y SITUACIÓN DE PARTIDA', [['antecedentes', 'Antecedentes de escolarización, trayectorias, interrupciones'], ['saberes', 'Reconocimiento de saberes previos (formales y no formales)'], ['condiciones', 'Condiciones sociales y laborales'], ['partida', 'Definición del punto de partida']]],
    ['ORGANIZACIÓN DEL RECORRIDO FORMATIVO', [['trayecto_pers', 'Trayecto personalizado del estudiante (qué y cómo va a cursar)'], ['cuatrimestral', 'Distribución cuatrimestral'], ['articulacion', 'Articulación con el contexto socio-comunitario']]],
    ['ESTRATEGIAS', [['estrategias', 'Estrategias de enseñanza personalizadas'], ['acompanamiento', 'Acciones de acompañamiento y tutoría'], ['revision', 'Instancias de revisión y actualización']]],
    ['EVALUACIÓN DE REVISIÓN Y ACTUALIZACIÓN', [['referenciales', 'Referenciales de evaluación'], ['rubricas', 'Rúbricas o registros de reconocimiento de saberes'], ['informes', 'Informes cuatrimestrales con apreciaciones cualitativas']]]
  ],

  async abrirPtf(id) {
    const e = this.estudiantes.find(x => x.id === id); if (!e) return;
    if (this.faltaPtf) return Swal.fire('Falta el SQL 58', 'Ejecutá sql/58_eps_ptf.sql en Supabase para usar el PTF.', 'info');
    const r = await supabase.from('eps_ptf').select('*').eq('estudiante_id', id).maybeSingle();
    if (r.error) return Swal.fire('Error', r.error.message, 'error');
    this.ptfId = id;
    this.ptf = r.data || { estudiante_id: id, oferta: e.trayecto || '', turno: '', anio: new Date().getFullYear(), textos: {}, notas: {}, pendientes: {}, observaciones: '' };
    this.renderPtf();
  },
  cerrarPtf() { this.ptfId = null; this.ptf = null; this.render(); },

  estadoNivel(n) { return this.estadoNivelDe(this.estudiantes.find(x => x.id === this.ptfId), this.ptf, n); },
  estadoNivelDe(e, p, n) {
    const mods = this.modulos.filter(m => m.trayecto === e.trayecto && m.nivel === n);
    const nn = ((p && p.notas) || {})[n] || {};
    const finales = [...mods.map(m => (nn.fp || {})[m.nombre]?.[4]), ...this.materiasGen(n).map(g => (nn.gen || {})[g]?.[4])];
    if (!mods.length || finales.some(v => !String(v ?? '').trim())) return 'En curso';
    return finales.some(v => /^TEP$/i.test(String(v).trim())) ? 'Con pendientes' : 'Acreditado';
  },

  renderPtf() {
    const cont = document.getElementById('eps-contenido');
    const e = this.estudiantes.find(x => x.id === this.ptfId), p = this.ptf;
    const ta = ([k, et]) => `<label style="display:block;font-size:.8rem;margin:6px 0 2px"><b>${et}</b></label><textarea class="form-control" data-t="${k}" rows="3" style="width:100%">${this.esc(p.textos[k] || '')}</textarea>`;
    const celda = (n, bloque, mat, i) => `<td><input data-n="${n}" data-b="${bloque}" data-m="${this.esc(mat)}" data-i="${i}" value="${this.esc(((p.notas[n] || {})[bloque] || {})[mat]?.[i] ?? '')}" style="width:54px;text-align:center"></td>`;
    const niveles = [1, 2, 3, 4].map(n => {
      const mods = this.modulos.filter(m => m.trayecto === e.trayecto && m.nivel === n);
      const est = this.estadoNivel(n);
      return `<div class="seg-card" style="margin:10px 0;overflow-x:auto"><strong>Nivel ${this.ROM[n]}</strong> <span style="font-size:.8rem">— ${est}</span>
        <table class="tabla-simple" style="width:100%;margin-top:6px"><thead><tr><th>Formación Profesional</th>${this.COL_FP.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${mods.map(m => `<tr><td>${this.esc(m.nombre)}</td>${[0, 1, 2, 3, 4].map(i => celda(n, 'fp', m.nombre, i)).join('')}</tr>`).join('') || '<tr><td colspan="6"><small>Sin módulos definidos para este trayecto y nivel (pestaña «Módulos por trayecto»).</small></td></tr>'}</tbody></table>
        <table class="tabla-simple" style="width:100%;margin-top:8px"><thead><tr><th>Formación General</th>${this.COL_GEN.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${this.materiasGen(n).map(g => `<tr><td>${g}</td>${[0, 1, 2, 3, 4].map(i => celda(n, 'gen', g, i)).join('')}</tr>`).join('')}</tbody></table></div>`;
    }).join('');
    const pend = this.GEN.map(g => `<label style="display:block;font-size:.8rem;margin:6px 0 2px"><b>${g}</b></label><textarea class="form-control" data-p="${g}" rows="2" style="width:100%">${this.esc(p.pendientes[g] || '')}</textarea>`).join('');
    cont.innerHTML = `
      <button class="btn-secundario" onclick="EpsModulo.cerrarPtf()">← Volver a estudiantes</button>
      <h3 style="margin:10px 0 2px">Plan de Trabajo Formativo — ${this.esc(e.apellido)}, ${this.esc(e.nombre)}</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0">
        <label style="font-size:.8rem">Oferta<input id="ptf-oferta" class="form-control" value="${this.esc(p.oferta || '')}" style="min-width:260px"></label>
        <label style="font-size:.8rem">Turno<input id="ptf-turno" class="form-control" value="${this.esc(p.turno || '')}" style="width:130px"></label>
        <label style="font-size:.8rem">Año<input id="ptf-anio" type="number" class="form-control" value="${p.anio || ''}" style="width:90px"></label>
      </div>
      <div id="ptf-form">
      ${this.TEXTOS.map(([t, cs]) => `<h4 style="margin:14px 0 2px">${t}</h4>${cs.map(ta).join('')}`).join('')}
      <h4 style="margin:14px 0 2px">NIVELES</h4><small>Notas numéricas, TEA o TEP. «Acreditado» = todas las notas finales cargadas y ninguna TEP.</small>${niveles}
      <h4 style="margin:14px 0 2px">CONTENIDOS PENDIENTES DE ACREDITACIÓN</h4>
      <label style="font-size:.8rem">Nivel<input id="ptf-pend-nivel" class="form-control" value="${this.esc(p.pendientes.nivel || '')}" style="width:100px"></label>${pend}
      <label style="display:block;font-size:.8rem;margin:10px 0 2px"><b>OBSERVACIONES</b></label><textarea id="ptf-obs" class="form-control" rows="3" style="width:100%">${this.esc(p.observaciones || '')}</textarea>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn-primary" onclick="EpsModulo.guardarPtf()">💾 Guardar PTF</button><button class="btn-secundario" onclick="EpsModulo.exportarPtf()">⬇️ Excel del PTF</button><button class="btn-secundario" onclick="VistaPDF.ver(() => EpsModulo.exportarPtf(), 'PTF')" title="Se abre en otra pestaña, sin descargar">👁️ Ver PDF del PTF</button></div>`;
  },

  leerPtf() {
    const f = document.getElementById('ptf-form'), p = this.ptf;
    p.oferta = document.getElementById('ptf-oferta').value.trim(); p.turno = document.getElementById('ptf-turno').value.trim();
    p.anio = Number(document.getElementById('ptf-anio').value) || null;
    f.querySelectorAll('[data-t]').forEach(x => { p.textos[x.dataset.t] = x.value; });
    const notas = {};
    f.querySelectorAll('input[data-n]').forEach(x => {
      const v = x.value.trim(); if (!v) return;
      const { n, b, m, i } = x.dataset;
      notas[n] = notas[n] || {}; notas[n][b] = notas[n][b] || {}; notas[n][b][m] = notas[n][b][m] || ['', '', '', '', ''];
      notas[n][b][m][Number(i)] = v;
    });
    p.notas = notas;
    const pend = { nivel: document.getElementById('ptf-pend-nivel').value.trim() };
    f.querySelectorAll('[data-p]').forEach(x => { if (x.value.trim()) pend[x.dataset.p] = x.value; });
    p.pendientes = pend; p.observaciones = document.getElementById('ptf-obs').value;
  },

  async guardarPtf() {
    this.leerPtf();
    const p = this.ptf;
    const r = await supabase.from('eps_ptf').upsert({ estudiante_id: p.estudiante_id, oferta: p.oferta, turno: p.turno, anio: p.anio, textos: p.textos, notas: p.notas, pendientes: p.pendientes, observaciones: p.observaciones, updated_at: new Date().toISOString() });
    if (r.error) return Swal.fire('No se pudo guardar', r.error.message, 'error');
    this.renderPtf();
    Swal.fire({ icon: 'success', title: 'PTF guardado', timer: 1200, showConfirmButton: false });
  },

  async exportarPtf() {
    if (typeof ExcelJS === 'undefined') return Swal.fire('Excel no disponible', 'No se cargó la librería de Excel.', 'error');
    this.leerPtf();
    const e = this.estudiantes.find(x => x.id === this.ptfId), p = this.ptf;
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('PTF');
    ws.columns = [{ width: 46 }, { width: 44 }, ...Array(10).fill({ width: 10 })];
    const B = r => { r.font = { bold: true }; };
    const fila = (...v) => ws.addRow(v);
    B(fila('PLAN DE TRABAJO FORMATIVO'));
    fila('Oferta: ' + (p.oferta || '')); fila('Región 10', '', '', 'EEST N1', '', '', '', 'CFP', '', '', p.turno || '');
    fila(`${e.apellido}, ${e.nombre}`); fila('Año ' + (p.anio || '')); fila();
    this.TEXTOS.forEach(([t, cs]) => { B(fila(t)); cs.forEach(([k, et]) => { const r = fila(et, p.textos[k] || ''); r.getCell(2).alignment = { wrapText: true, vertical: 'top' }; r.getCell(1).alignment = { wrapText: true, vertical: 'top' }; }); });
    [1, 2, 3, 4].forEach(n => {
      const mods = this.modulos.filter(m => m.trayecto === e.trayecto && m.nivel === n), nn = p.notas[n] || {};
      B(fila('Nivel ' + this.ROM[n], 'Formación Profesional', ...this.COL_FP, 'Formación General', ...this.COL_GEN));
      const gen = this.materiasGen(n), filas = Math.max(mods.length, gen.length);
      for (let i = 0; i < filas; i++) {
        const m = mods[i], g = gen[i];
        fila('', m ? m.nombre : '', ...(m ? (nn.fp?.[m.nombre] || ['', '', '', '', '']) : ['', '', '', '', '']), g || '', ...(g ? (nn.gen?.[g] || ['', '', '', '', '']) : ['', '', '', '', '']));
      }
      fila('', 'Estado: ' + this.estadoNivel(n));
    });
    fila(); fila('FIRMA COORDINADORA', '', 'FIRMA CONDUCCIÓN CFP', '', '', '', '', 'FIRMA CONDUCCIÓN EEST');
    fila(); fila('OBSERVACIONES: ' + (p.observaciones || ''));
    if (Object.keys(p.pendientes).some(k => k !== 'nivel' && p.pendientes[k])) {
      B(fila('CONTENIDOS PENDIENTES DE ACREDITACIÓN' + (p.pendientes.nivel ? ' - NIVEL ' + p.pendientes.nivel : '')));
      this.GEN.forEach(g => { if (p.pendientes[g]) fila(g, p.pendientes[g]); });
    }
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf])); a.download = `PTF_${e.apellido}_${e.nombre}.xlsx`; a.click();
  },


  /* ---------- asistencia mensual (carga manual) ---------- */
  nomMes(m) { const [y, mm] = m.split('-'); return ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][Number(mm) - 1] + ' ' + y; },
  vistaAsistencia() {
    if (this.faltaAsis) return '<div class="prog-vacio">Falta ejecutar <strong>sql/59_eps_asistencia.sql</strong> en Supabase.</div>';
    const act = this.estudiantes.filter(e => e.estado === 'activo');
    const reg = id => this.asistencia.find(a => a.estudiante_id === id && a.mes === this.mesAsis) || {};
    return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:10px">
        <label style="font-size:.8rem">Mes<input type="month" class="form-control" value="${this.mesAsis}" onchange="EpsModulo.mesAsis=this.value||EpsModulo.mesAsis;EpsModulo.render()"></label>
        <label style="font-size:.8rem">Días de clase del mes (para todos)<input id="eps-dias-todos" type="number" min="0" class="form-control" style="width:90px"></label>
        <button class="btn-secundario" onclick="EpsModulo.aplicarDias()">Aplicar a todos</button>
        <button class="btn-primary" onclick="EpsModulo.guardarAsistencia()">💾 Guardar ${this.nomMes(this.mesAsis)}</button></div>
      <div style="overflow-x:auto"><table class="tabla-simple" style="width:100%"><thead><tr><th>Estudiante</th><th>Trayecto</th><th>Días de clase</th><th>Presentes</th><th>%</th></tr></thead>
      <tbody>${act.map(e => { const r = reg(e.id); return `<tr data-e="${e.id}"><td>${this.esc(e.apellido)}, ${this.esc(e.nombre)}</td><td>${this.esc(e.trayecto || '')}</td>
        <td><input type="number" min="0" data-k="d" value="${r.dias_clase ?? ''}" style="width:70px"></td><td><input type="number" min="0" data-k="p" value="${r.presentes ?? ''}" style="width:70px"></td>
        <td>${r.dias_clase ? Math.round(r.presentes * 100 / r.dias_clase) + '%' : ''}</td></tr>`; }).join('') || '<tr><td colspan="5" style="text-align:center">No hay estudiantes activos.</td></tr>'}</tbody></table></div>`;
  },
  aplicarDias() {
    const v = document.getElementById('eps-dias-todos').value; if (v === '') return;
    document.querySelectorAll('input[data-k="d"]').forEach(i => { i.value = v; });
  },
  async guardarAsistencia() {
    const filas = [], borrar = [];
    for (const tr of document.querySelectorAll('tr[data-e]')) {
      const id = Number(tr.dataset.e), d = tr.querySelector('[data-k="d"]').value, p = tr.querySelector('[data-k="p"]').value;
      if (d === '' && p === '') { if (this.asistencia.some(a => a.estudiante_id === id && a.mes === this.mesAsis)) borrar.push(id); continue; }
      if (d === '' || p === '' || Number(p) > Number(d)) { const e = this.estudiantes.find(x => x.id === id); return Swal.fire('Revisá los datos', `${e.apellido}, ${e.nombre}: completá ambos campos y los presentes no pueden superar los días de clase.`, 'warning'); }
      filas.push({ estudiante_id: id, mes: this.mesAsis, dias_clase: Number(d), presentes: Number(p) });
    }
    if (filas.length) { const r = await supabase.from('eps_asistencia').upsert(filas, { onConflict: 'estudiante_id,mes' }); if (r.error) return Swal.fire('No se pudo guardar', r.error.message, 'error'); }
    if (borrar.length) await supabase.from('eps_asistencia').delete().eq('mes', this.mesAsis).in('estudiante_id', borrar);
    const m = this.mesAsis; await this.cargar(); this.mesAsis = m; this.render();
    Swal.fire({ icon: 'success', title: 'Asistencia guardada', timer: 1200, showConfirmButton: false });
  },

  /* ---------- cifras ---------- */
  cifras() {
    const a = this.anioCifras, act = this.estudiantes.filter(e => e.estado === 'activo');
    const cnt = est => this.estudiantes.filter(e => e.estado === est).length;
    const asisDe = ids => { const r = this.asistencia.filter(x => x.mes.startsWith(a + '-') && (!ids || ids.has(x.estudiante_id))); const d = r.reduce((s, x) => s + x.dias_clase, 0); return d ? Math.round(r.reduce((s, x) => s + x.presentes, 0) * 1000 / d) / 10 : null; };
    const trs = [...new Set(act.map(e => e.trayecto || '(sin trayecto)'))].sort();
    const porTray = trs.map(t => { const es = act.filter(e => (e.trayecto || '(sin trayecto)') === t); return { t, n: es.length, asis: asisDe(new Set(es.map(e => e.id))),
      niv: [1, 2, 3, 4].map(n => es.filter(e => this.estadoNivelDe(e, this.ptfs.find(p => p.estudiante_id === e.id), n) === 'Acreditado').length) }; });
    return { activos: act.length, bajas: cnt('baja'), egresados: cnt('egresado'), asis: asisDe(null), porTray, nivTot: [0, 1, 2, 3].map(i => porTray.reduce((s, x) => s + x.niv[i], 0)) };
  },
  vistaCifras() {
    const c = this.cifras(), f = v => v == null ? '—' : v + '%';
    return `<div style="display:flex;gap:8px;align-items:end;margin-bottom:10px;flex-wrap:wrap"><label style="font-size:.8rem">Año<input type="number" class="form-control" style="width:100px" value="${this.anioCifras}" onchange="EpsModulo.anioCifras=Number(this.value)||EpsModulo.anioCifras;EpsModulo.render()"></label>
        <button class="btn-secundario" onclick="EpsModulo.exportarCifras()">⬇️ Excel</button>
        <button class="btn-secundario" onclick="VistaPDF.ver(() => EpsModulo.exportarCifras(), 'Cifras EPS')" title="Se abre en otra pestaña, sin descargar">👁️ Ver PDF</button></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px">
        <div class="seg-card"><small>Matrícula activa</small><div style="font-size:1.6rem"><b>${c.activos}</b></div></div>
        <div class="seg-card"><small>Bajas / egresados</small><div style="font-size:1.6rem"><b>${c.bajas} / ${c.egresados}</b></div></div>
        <div class="seg-card"><small>Asistencia media ${this.anioCifras}</small><div style="font-size:1.6rem"><b>${f(c.asis)}</b></div></div></div>
      <div style="overflow-x:auto"><table class="tabla-simple" style="width:100%"><thead><tr><th>Trayecto</th><th>Matrícula</th><th>Asistencia media</th><th>Nivel I acreditado</th><th>Nivel II</th><th>Nivel III</th><th>Nivel IV</th></tr></thead>
      <tbody>${c.porTray.map(x => `<tr><td>${this.esc(x.t)}</td><td>${x.n}</td><td>${f(x.asis)}</td>${x.niv.map(n => `<td>${n}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="7" style="text-align:center">Sin datos.</td></tr>'}
      <tr style="font-weight:bold"><td>Total</td><td>${c.activos}</td><td>${f(c.asis)}</td>${c.nivTot.map(n => `<td>${n}</td>`).join('')}</tr></tbody></table></div>
      <small>Acreditados: estudiantes activos con todas las notas finales del nivel cargadas en el PTF y ninguna TEP. La asistencia media es el total de presentes sobre el total de días de clase cargados en el año.</small>`;
  },
  async exportarCifras() {
    if (typeof ExcelJS === 'undefined') return Swal.fire('Excel no disponible', 'No se cargó la librería de Excel.', 'error');
    const c = this.cifras(), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Cifras EPS');
    ws.columns = [{ width: 36 }, ...Array(6).fill({ width: 16 })];
    ws.addRow(['Cifras EPS ' + this.anioCifras]).font = { bold: true };
    ws.addRow(['Matrícula activa', c.activos]); ws.addRow(['Bajas', c.bajas]); ws.addRow(['Egresados', c.egresados]); ws.addRow(['Asistencia media (%)', c.asis ?? '']); ws.addRow([]);
    ws.addRow(['Trayecto', 'Matrícula', 'Asistencia media (%)', 'Nivel I acreditado', 'Nivel II', 'Nivel III', 'Nivel IV']).font = { bold: true };
    c.porTray.forEach(x => ws.addRow([x.t, x.n, x.asis ?? '', ...x.niv]));
    ws.addRow(['Total', c.activos, c.asis ?? '', ...c.nivTot]).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer(), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf])); a.download = `cifras_EPS_${this.anioCifras}.xlsx`; a.click();
  },

  /* ---------- Excel ---------- */
  async exportar() {
    if (typeof ExcelJS === 'undefined') return Swal.fire('Excel no disponible', 'No se cargó la librería de Excel.', 'error');
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Estudiantes EPS');
    ws.columns = [['Apellido', 'apellido'], ['Nombre', 'nombre'], ['DNI', 'dni'], ['Nacimiento', 'fecha_nac'], ['Domicilio', 'domicilio'], ['Teléfono', 'telefono'], ['Correo', 'email'], ['Tutor', 'tutor'],
      ['Escuela de origen', 'escuela_origen'], ['Año en que dejó', 'anio_desvinculo'], ['Trayecto', 'trayecto'], ['Cohorte', 'cohorte'], ['Ingreso', 'fecha_ingreso'], ['Estado', 'estado'], ['Observaciones', 'observaciones']]
      .map(([header, key]) => ({ header, key, width: 18 }));
    this.estudiantes.forEach(e => ws.addRow(e));
    ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf])); a.download = 'estudiantes_EPS.xlsx'; a.click();
  }
};
window.EpsModulo = EpsModulo;
