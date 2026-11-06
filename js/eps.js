/* ==========================================================================
   EPS — estudiantes desvinculados (CFP 401). Etapa 1: estudiantes y personal.
   Acceso: Dirección, Secretaría y coordinadora EPS (eps_personal.user_id).
   Tablas separadas eps_* (sql/57_eps_base.sql). No toca Formación Profesional.
   ========================================================================== */
const FUNCIONES_EPS = { coordinador: 'Coordinador/a', docente_general: 'Docente de formación general', docente_especifica: 'Docente de formación específica' };

const EpsModulo = {
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
    const tabs = [['estudiantes', '🎓 Estudiantes'], ['personal', '👥 Personal EPS']];
    cont.innerHTML = `
      <div class="plan-tabs">${tabs.map(([id, et]) => `<button type="button" class="plan-tab ${this.tab === id ? 'activo' : ''}" onclick="EpsModulo.irA('${id}')">${et}</button>`).join('')}</div>
      ${this.tab === 'estudiantes' ? this.vistaEstudiantes() : this.vistaPersonal()}`;
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
      </div>
      <div style="overflow-x:auto"><table class="tabla-simple" style="width:100%">
        <thead><tr><th>Apellido y nombre</th><th>DNI</th><th>Trayecto</th><th>Escuela de origen</th><th>Dejó en</th><th>Estado</th><th></th></tr></thead>
        <tbody>${lista.map(e => `<tr>
          <td>${this.esc(e.apellido)}, ${this.esc(e.nombre)}</td><td>${this.esc(e.dni)}</td><td>${this.esc(e.trayecto || '')}</td>
          <td>${this.esc(e.escuela_origen || '')}</td><td>${e.anio_desvinculo || ''}</td><td>${this.esc(e.estado)}</td>
          <td style="white-space:nowrap"><button class="btn-secundario" onclick="EpsModulo.formEstudiante(${e.id})">✏️</button> <button class="btn-secundario" onclick="EpsModulo.borrarEstudiante(${e.id})">🗑️</button></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center">Sin resultados.</td></tr>'}</tbody>
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
      <p style="font-size:.85rem">Coordinadora y docentes de EPS se cargan como registros (no necesitan cuenta). Si la coordinadora tiene cuenta en la plataforma, vinculala para que acceda a esta sección.</p>
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
        ${campo('area', 'Materia / trayecto')}${campo('telefono', 'Teléfono')}${campo('email', 'Correo (si tiene cuenta, se vincula por este correo)', 'email')}
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
