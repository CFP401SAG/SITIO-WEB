/* Libro de temas del docente: fecha + tema + actividad por cada clase dictada.
   - Lo carga el docente del trayecto (o el administrador).
   - Al abrirlo, Director y Regente quedan "visados" automáticamente (sin botón): queda
     registrado que lo vieron, con fecha y nombre. Pueden dejar observaciones puntuales
     (sobre un tema) o generales (sobre el libro), que el docente ve pero no edita.
   - Tiene una versión imprimible (ventana aparte, con lo justo para imprimir). */
const LibroTemasModulo = {
  trayectoId: null,
  rol: '',
  nombreTrayecto: '',
  temas: [],
  visados: [],
  comentarios: [],
  sinClase: [],
  MOTIVOS: { paro: 'Paro', jornada_institucional: 'Jornada institucional', licencia: 'Licencia', otro: 'Otro motivo' },

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  hoyISO() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); },
  fmt(f) { return f ? String(f).split('-').reverse().join('/') : ''; },

  async cargar(trayectoId, nombreTrayecto) {
    this.trayectoId = Number(trayectoId);
    this.nombreTrayecto = nombreTrayecto || this.nombreTrayecto || '';
    const cont = document.getElementById('contenedor-libro-temas');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#94a3b8; text-align:center;">Cargando libro de temas…</p>';

    const perfil = (window.Auth && Auth.usuarioActual) || {};
    this.rol = String(perfil.rol || '').toLowerCase().trim();
    this.esAdminTotal = Auth.esAdmin(this.rol);
    this.esRegente = this.rol === 'regente';
    this.puedeCargar = this.esAdminTotal || this.rol === 'docente';
    this.puedeVisar = this.esAdminTotal || this.esRegente;

    try {
      const [rTemas, rVis, rCom, rMod, rSC] = await Promise.all([
        supabase.from('libro_temas').select('*').eq('trayecto_id', this.trayectoId).order('fecha', { ascending: true }),
        supabase.from('libro_temas_visados').select('*').eq('trayecto_id', this.trayectoId).order('created_at', { ascending: false }).limit(12),
        supabase.from('libro_temas_comentarios').select('*').eq('trayecto_id', this.trayectoId).order('created_at', { ascending: true }),
        supabase.from('modulos').select('id, nombre').eq('trayecto_id', this.trayectoId).order('id'),
        supabase.from('dias_sin_clase').select('*').eq('trayecto_id', this.trayectoId)
      ]);
      if (rTemas.error) throw rTemas.error;
      this.temas = rTemas.data || [];
      this.visados = (!rVis.error && rVis.data) || [];
      this.comentarios = (!rCom.error && rCom.data) || [];
      this.modulos = (!rMod.error && rMod.data) || [];
      this.sinClase = (!rSC.error && rSC.data) || [];   // los mismos «Ese día no hubo clase» que se cargan al tomar asistencia

      // El Director/la Regente quedan visados con solo abrir esta pantalla (una vez por día)
      if (this.puedeVisar) supabase.rpc('visar_libro_temas', { p_trayecto: this.trayectoId }).then(() => {});

      this.render();
    } catch (err) {
      cont.innerHTML = `<div class="prog-vacio">No se pudo cargar el libro de temas: ${this.esc(err.message || '')}${/libro_temas/.test(err.message || '') ? ' (falta ejecutar sql/32_libro_de_temas.sql en Supabase)' : ''}</div>`;
    }
  },

  fechaISO(f) { return String(f || '').slice(0, 10); },
  // ¿Ese día (y módulo) figura como «sin clase»? Un sin clase sin módulo vale para todos los módulos.
  sinClaseDe(fecha, modId) {
    const mid = modId ? Number(modId) : null;
    return this.sinClase.find(d => this.fechaISO(d.fecha) === fecha && (d.modulo_id === null || d.modulo_id === undefined || mid === null || Number(d.modulo_id) === mid)) || null;
  },
  textoSinClase(d) { return `${this.MOTIVOS[d.motivo] || d.motivo}${d.detalle ? ' · ' + d.detalle : ''}`; },

  comentariosDe(temaId) { return this.comentarios.filter(c => Number(c.tema_id) === Number(temaId)); },
  comentariosGenerales() { return this.comentarios.filter(c => c.tema_id === null); },

  render() {
    const cont = document.getElementById('contenedor-libro-temas');
    if (!cont) return;
    const ult3 = this.visados.slice(0, 3);
    const visadoHoy = this.visados.some(v => v.created_at && v.created_at.slice(0, 10) === this.hoyISO());
    const genComentarios = this.comentariosGenerales();

    cont.innerHTML = `
      <div class="lt-barra">
        <div class="lt-visado" title="${ult3.map(v => this.esc(v.visado_por_nombre) + ' · ' + this.fmt(v.created_at.slice(0, 10))).join(' | ') || 'Todavía sin visar'}">
          ${ult3.length ? `👁️ Visado por última vez: <b>${this.esc(ult3[0].visado_por_nombre)}</b> (${this.fmt(ult3[0].created_at.slice(0, 10))})${this.puedeVisar && visadoHoy ? ' · quedaste visado hoy' : ''}` : '👁️ Todavía sin visar por Dirección/Regencia'}
        </div>
        <div class="lt-acciones">
          <button type="button" class="btn btn-outline" style="padding:0.3rem 0.7rem; font-size:0.78rem;" onclick="LibroTemasModulo.verVisados()">Ver visados</button>
          <button type="button" class="btn btn-outline" style="padding:0.3rem 0.7rem; font-size:0.78rem;" onclick="LibroTemasModulo.imprimir()">🖨️ Imprimir</button>
          ${this.puedeVisar ? `<button type="button" class="btn btn-outline" style="padding:0.3rem 0.7rem; font-size:0.78rem;" onclick="LibroTemasModulo.comentarGeneral()">💬 Observación general${genComentarios.length ? ' (' + genComentarios.length + ')' : ''}</button>` : (genComentarios.length ? `<button type="button" class="btn btn-outline" style="padding:0.3rem 0.7rem; font-size:0.78rem;" onclick="LibroTemasModulo.verComentarios(null)">💬 Observaciones generales (${genComentarios.length})</button>` : '')}
        </div>
      </div>
      ${this.puedeCargar ? `
        <details id="lt-form-wrap" class="act-form-wrap" style="margin-top:0.6rem;">
          <summary>➕ Cargar clase dictada</summary>
          <form id="lt-form" onsubmit="LibroTemasModulo.guardar(event)" style="display:grid; gap:0.6rem; padding:0.8rem 0.2rem 0.2rem;">
            <input type="hidden" id="lt-id" value="">
            <div class="act-grid3">
              <label>Fecha *<input type="date" id="lt-fecha" class="act-in" required value="${this.hoyISO()}" max="${this.hoyISO()}"></label>
              ${this.modulos.length ? `<label>Módulo<select id="lt-modulo" class="act-in"><option value="">—</option>${this.modulos.map(m => `<option value="${Number(m.id)}">${this.esc(m.nombre)}</option>`).join('')}</select></label>` : '<div></div>'}
              <div></div>
            </div>
            <label>Tema dictado *<input type="text" id="lt-tema" class="act-in" maxlength="300" required placeholder="Ej.: Producción de tortas negras"></label>
            <label>Actividad realizada<textarea id="lt-actividad" class="act-in" rows="2" maxlength="2000" placeholder="Qué hicieron en la clase (opcional)"></textarea></label>
            <div class="act-form-pie">
              <button type="button" id="lt-btn-cancelar" class="act-btn-sec" style="display:none;" onclick="LibroTemasModulo.cancelarEdicion()">Cancelar edición</button>
              <button type="button" class="act-btn-sec" title="Es el mismo registro que «Ese día no hubo clase» de Tomar asistencia: se carga una sola vez" onclick="LibroTemasModulo.marcarSinClase()">🚫 Ese día no hubo clase</button>
              <button type="submit" class="act-btn">💾 Guardar</button>
            </div>
          </form>
        </details>` : ''}
      <div id="lt-lista" style="margin-top:0.8rem;"></div>
    `;
    this.renderLista();
  },

  renderLista() {
    const cont = document.getElementById('lt-lista');
    if (!cont) return;
    if (!this.temas.length && !this.sinClase.length) { cont.innerHTML = '<div class="prog-vacio">Todavía no hay clases cargadas.</div>'; return; }
    const porModulo = new Map(this.modulos.map(m => [Number(m.id), m.nombre]));
    const filas = [...this.temas.map(t => ({ k: 't', f: this.fechaISO(t.fecha), t })), ...this.sinClase.map(d => ({ k: 's', f: this.fechaISO(d.fecha), d }))]
      .sort((x, y) => x.f < y.f ? -1 : x.f > y.f ? 1 : (x.k === 's' ? 1 : 0) - (y.k === 's' ? 1 : 0));
    const cols = 4 + (this.modulos.length ? 1 : 0);
    cont.innerHTML = `<table class="lt-tabla"><thead><tr><th>Fecha</th>${this.modulos.length ? '<th>Módulo</th>' : ''}<th>Tema</th><th>Actividad</th><th></th></tr></thead><tbody>
      ${filas.map(r => {
        if (r.k === 's') {
          const d = r.d;
          return `<tr class="lt-sinclase" style="background:#FDF2F0">
            <td data-label="Fecha">${this.fmt(r.f)}</td>
            ${this.modulos.length ? `<td data-label="Módulo">${d.modulo_id ? this.esc(porModulo.get(Number(d.modulo_id)) || '—') : 'Todos'}</td>` : ''}
            <td data-label="Tema" colspan="2" style="color:#B42318"><b>🚫 Sin clase</b> — ${this.esc(this.textoSinClase(d))} <small style="color:#64748b">(el mismo registro de Tomar asistencia)</small></td>
            <td class="lt-col-acciones">${this.puedeCargar ? `<button type="button" class="lt-mini" title="Quitar la marca: sí hubo clase" onclick="LibroTemasModulo.quitarSinClase(${d.modulo_id === null || d.modulo_id === undefined ? 'null' : Number(d.modulo_id)}, '${r.f}')">↩️</button>` : ''}</td></tr>`;
        }
        const t = r.t, coms = this.comentariosDe(t.id);
        return `<tr>
          <td data-label="Fecha">${this.fmt(t.fecha)}</td>
          ${this.modulos.length ? `<td data-label="Módulo">${this.esc(porModulo.get(Number(t.modulo_id)) || '—')}</td>` : ''}
          <td data-label="Tema">${this.esc(t.tema)}</td>
          <td data-label="Actividad">${this.esc(t.actividad || '—')}</td>
          <td class="lt-col-acciones">
            ${coms.length ? `<button type="button" class="lt-com-btn" title="Ver observaciones" onclick="LibroTemasModulo.verComentarios(${Number(t.id)})">💬 ${coms.length}</button>` : (this.puedeVisar ? `<button type="button" class="lt-com-btn lt-com-btn-vacio" title="Agregar observación" onclick="LibroTemasModulo.comentarTema(${Number(t.id)})">💬</button>` : '')}
            ${this.puedeCargar ? `<button type="button" class="lt-mini" title="Editar" onclick="LibroTemasModulo.editar(${Number(t.id)})">✏️</button>
            <button type="button" class="lt-mini" title="Borrar" onclick="LibroTemasModulo.borrar(${Number(t.id)})">🗑️</button>` : ''}
          </td>
        </tr>`;
      }).join('')}
    </tbody></table>`;
  },

  /* ---------- «Ese día no hubo clase» (mismo registro que Tomar asistencia) ---------- */
  async marcarSinClase() {
    const fecha = document.getElementById('lt-fecha').value;
    const modSel = document.getElementById('lt-modulo'), modulo = modSel && modSel.value ? Number(modSel.value) : null;
    if (!fecha) { alert('Elegí la fecha.'); return; }
    const hay = this.temas.find(t => this.fechaISO(t.fecha) === fecha && (modulo === null || !t.modulo_id || Number(t.modulo_id) === modulo));
    if (hay) { await Swal.fire('Ese día ya tiene una clase cargada', `«${hay.tema}» figura como dictada el ${this.fmt(fecha)}. Si no hubo clase, borrala primero.`, 'info'); return; }
    const ya = this.sinClaseDe(fecha, modulo);
    if (ya) { await Swal.fire('Ya está registrado', `El ${this.fmt(fecha)} ya figura sin clase (${this.textoSinClase(ya)}).`, 'info'); return; }
    const r = await Swal.fire({
      title: 'Ese día no hubo clase', showCancelButton: true, confirmButtonText: 'Registrar', cancelButtonText: 'Cancelar', focusConfirm: false,
      html: `<p style="margin:0 0 .75rem;text-align:left;font-size:.9rem">${this.fmt(fecha)}. Queda registrado también en Tomar asistencia: no computa asistencia ni inasistencia y no hace falta cargarlo de nuevo. <b>Si ya había asistencia cargada ese día, se borra.</b></p>
        <select id="lt-sc-motivo" class="swal2-select" style="display:flex;width:100%;margin:0 0 .5rem">${Object.entries(this.MOTIVOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <input id="lt-sc-detalle" class="swal2-input" style="margin:0;width:100%" maxlength="300" placeholder="Detalle (opcional)">`,
      preConfirm: () => ({ motivo: document.getElementById('lt-sc-motivo').value, detalle: document.getElementById('lt-sc-detalle').value })
    });
    if (!r.isConfirmed) return;
    const { error } = await supabase.rpc('marcar_dia_sin_clase', { p_trayecto: this.trayectoId, p_modulo: modulo, p_fecha: fecha, p_motivo: r.value.motivo, p_detalle: r.value.detalle });
    if (error) { alert(/marcar_dia_sin_clase|PGRST202|dias_sin_clase/i.test(error.message || '') ? 'Falta ejecutar sql/39_dias_sin_clase.sql en Supabase.' : 'No se pudo registrar: ' + error.message); return; }
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Día sin clase registrado', showConfirmButton: false, timer: 1800 });
    await this.cargar(this.trayectoId, this.nombreTrayecto);
  },
  async quitarSinClase(modulo, fecha) {
    if (!confirm('¿Quitar la marca «sin clase»? Pasa a figurar como día con clase (después cargá el tema o tomá asistencia).')) return;
    const { error } = await supabase.rpc('quitar_dia_sin_clase', { p_trayecto: this.trayectoId, p_modulo: modulo, p_fecha: fecha });
    if (error) { alert('No se pudo modificar: ' + error.message); return; }
    await this.cargar(this.trayectoId, this.nombreTrayecto);
  },

  async guardar(e) {
    e.preventDefault();
    const id = document.getElementById('lt-id').value;
    const fecha = document.getElementById('lt-fecha').value;
    const tema = document.getElementById('lt-tema').value.trim();
    const actividad = document.getElementById('lt-actividad').value.trim();
    const modSel = document.getElementById('lt-modulo');
    if (!fecha || !tema) { alert('Completá la fecha y el tema.'); return; }
    const modId = modSel && modSel.value ? Number(modSel.value) : null;
    const sc = this.sinClaseDe(fecha, modId);
    if (sc) { await Swal.fire('Ese día figura sin clase', `El ${this.fmt(fecha)} está registrado como «sin clase» (${this.textoSinClase(sc)}). Si sí hubo clase, tocá ↩️ en esa fila para quitar la marca y después cargala.`, 'warning'); return; }
    const norm = x => String(x || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const otras = this.temas.filter(t => String(t.id) !== String(id) && this.fechaISO(t.fecha) === fecha && Number(t.modulo_id || 0) === Number(modId || 0));
    if (otras.some(t => norm(t.tema) === norm(tema))) { await Swal.fire('Esa clase ya está cargada', `Ya hay una clase «${tema}» el ${this.fmt(fecha)}${modId ? ' en ese módulo' : ''}. Si querés cambiarla, usá ✏️ en la lista.`, 'warning'); return; }
    if (otras.length) {
      const r = await Swal.fire({ icon: 'question', title: 'Ya hay una clase ese día', html: `El ${this.fmt(fecha)}${modId ? ' en ese módulo' : ''} ya figura: «${this.esc(otras[0].tema)}». ¿Es una clase distinta (por ejemplo, otro tema el mismo día)?`, showCancelButton: true, confirmButtonText: 'Sí, cargarla igual', cancelButtonText: 'Cancelar' });
      if (!r.isConfirmed) return;
    }
    const perfil = (window.Auth && Auth.usuarioActual) || {};
    const registro = {
      trayecto_id: this.trayectoId, fecha, tema, actividad: actividad || null,
      modulo_id: modSel && modSel.value ? Number(modSel.value) : null
    };
    try {
      let error;
      if (id) {
        registro.editado_at = new Date().toISOString();
        ({ error } = await supabase.from('libro_temas').update(registro).eq('id', Number(id)));
      } else {
        registro.creado_por_nombre = `${perfil.apellido || ''}, ${perfil.nombre || ''}`.trim();
        ({ error } = await supabase.from('libro_temas').insert([registro]));
      }
      if (error) throw error;
      if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: id ? 'Clase actualizada' : 'Clase cargada', showConfirmButton: false, timer: 1800 });
      this.cancelarEdicion();
      await this.cargar(this.trayectoId, this.nombreTrayecto);
    } catch (err) {
      alert('No se pudo guardar: ' + (err.message || ''));
    }
  },

  editar(id) {
    const t = this.temas.find(x => Number(x.id) === Number(id));
    if (!t) return;
    const wrap = document.getElementById('lt-form-wrap');
    if (wrap) wrap.open = true;
    document.getElementById('lt-id').value = t.id;
    document.getElementById('lt-fecha').value = t.fecha;
    document.getElementById('lt-tema').value = t.tema;
    document.getElementById('lt-actividad').value = t.actividad || '';
    const modSel = document.getElementById('lt-modulo');
    if (modSel) modSel.value = t.modulo_id || '';
    const btnCancel = document.getElementById('lt-btn-cancelar');
    if (btnCancel) btnCancel.style.display = 'inline-block';
    document.getElementById('lt-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  cancelarEdicion() {
    document.getElementById('lt-id').value = '';
    const form = document.getElementById('lt-form');
    if (form) form.reset();
    const fechaEl = document.getElementById('lt-fecha');
    if (fechaEl) fechaEl.value = this.hoyISO();
    const btnCancel = document.getElementById('lt-btn-cancelar');
    if (btnCancel) btnCancel.style.display = 'none';
  },

  async borrar(id) {
    if (!confirm('¿Borrar esta clase del libro de temas?')) return;
    const { error } = await supabase.from('libro_temas').delete().eq('id', Number(id));
    if (error) { alert('No se pudo borrar: ' + error.message); return; }
    await this.cargar(this.trayectoId, this.nombreTrayecto);
  },

  /* ---------- Visados ---------- */
  async verVisados() {
    if (typeof Swal === 'undefined') return;
    const html = this.visados.length
      ? `<div style="text-align:left; font-size:0.85rem;">${this.visados.map(v => `<p style="margin:0.3rem 0;">👁️ <b>${this.esc(v.visado_por_nombre)}</b> (${v.visado_por_rol === 'admin' ? 'Director' : (v.visado_por_rol === 'secretaria' || v.visado_por_rol === 'secretario') ? 'Secretaría' : 'Regente'}) · ${this.fmt(v.created_at.slice(0, 10))}</p>`).join('')}</div>`
      : '<p>Todavía nadie de Dirección o Regencia lo abrió.</p>';
    Swal.fire({ title: 'Visados del libro de temas', html, confirmButtonText: 'Cerrar' });
  },

  /* ---------- Comentarios (Director/Regente) ---------- */
  async comentarGeneral() { return this._comentar(null); },
  async comentarTema(temaId) { return this._comentar(temaId); },
  async _comentar(temaId) {
    if (typeof Swal === 'undefined') return;
    const r = await Swal.fire({
      title: temaId ? 'Observación sobre este tema' : 'Observación general del libro',
      input: 'textarea', inputPlaceholder: 'Escribí tu observación…', inputAttributes: { maxlength: 1500 },
      showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar',
      inputValidator: v => (!v || !v.trim()) ? 'Escribí algo.' : null
    });
    if (!r.isConfirmed) return;
    const perfil = (window.Auth && Auth.usuarioActual) || {};
    try {
      const { error } = await supabase.from('libro_temas_comentarios').insert([{
        trayecto_id: this.trayectoId, tema_id: temaId,
        autor_id: perfil.id, autor_nombre: `${perfil.apellido || ''}, ${perfil.nombre || ''}`.trim(), autor_rol: this.rol,
        texto: r.value.trim()
      }]);
      if (error) throw error;
      await this.cargar(this.trayectoId, this.nombreTrayecto);
    } catch (err) {
      alert('No se pudo guardar la observación: ' + (err.message || ''));
    }
  },

  async verComentarios(temaId) {
    if (typeof Swal === 'undefined') return;
    const lista = temaId === null ? this.comentariosGenerales() : this.comentariosDe(temaId);
    const html = `<div style="text-align:left; font-size:0.85rem;">${lista.map(c => `<div style="margin:0.5rem 0; padding:0.5rem; background:rgba(255,255,255,0.05); border-radius:6px;">
      <div style="font-size:0.75rem; color:#94a3b8;">${this.esc(c.autor_nombre)} (${c.autor_rol === 'admin' ? 'Director' : (c.autor_rol === 'secretaria' || c.autor_rol === 'secretario') ? 'Secretaría' : 'Regente'}) · ${this.fmt(c.created_at.slice(0, 10))}${this.puedeVisar && c.autor_id === ((window.Auth && Auth.usuarioActual) || {}).id ? ` <button type="button" class="lt-mini" onclick="LibroTemasModulo.borrarComentario(${Number(c.id)})">🗑️</button>` : ''}</div>
      <div>${this.esc(c.texto)}</div></div>`).join('')}</div>`;
    Swal.fire({
      title: temaId ? 'Observaciones sobre este tema' : 'Observaciones generales',
      html, confirmButtonText: 'Cerrar',
      footer: this.puedeVisar ? `<button type="button" class="btn btn-outline" onclick="Swal.close(); LibroTemasModulo._comentar(${temaId === null ? 'null' : temaId})">+ Agregar otra</button>` : ''
    });
  },

  async borrarComentario(id) {
    if (!confirm('¿Borrar esta observación?')) return;
    const { error } = await supabase.from('libro_temas_comentarios').delete().eq('id', Number(id));
    if (error) { alert('No se pudo borrar: ' + error.message); return; }
    Swal.close();
    await this.cargar(this.trayectoId, this.nombreTrayecto);
  },

  /* ---------- Imprimir ---------- */
  imprimir() {
    const porModulo = new Map(this.modulos.map(m => [Number(m.id), m.nombre]));
    const w = window.open('', '_blank');
    if (!w) { alert('El navegador bloqueó la ventana de impresión. Habilitá los pop-ups para este sitio.'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Libro de temas — ${this.esc(this.nombreTrayecto)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif; padding:24px; color:#111;}
        h1{font-size:18px; margin:0 0 4px;} h2{font-size:13px; font-weight:normal; color:#444; margin:0 0 16px;}
        table{width:100%; border-collapse:collapse; font-size:12px;} th,td{border:1px solid #999; padding:6px 8px; text-align:left; vertical-align:top;}
        th{background:#eee;} .vis{margin-top:18px; font-size:11px; color:#333;}
        @media print { @page { size: landscape; margin: 14mm; } }
      </style></head><body>
      <h1>Libro de temas</h1>
      <h2>${this.esc(this.nombreTrayecto)} — impreso el ${this.fmt(this.hoyISO())}</h2>
      <table><thead><tr><th>Fecha</th>${this.modulos.length ? '<th>Módulo</th>' : ''}<th>Tema</th><th>Actividad</th></tr></thead><tbody>
      ${[...this.temas.map(t => ({ f: this.fechaISO(t.fecha), t })), ...this.sinClase.map(d => ({ f: this.fechaISO(d.fecha), d }))].sort((x, y) => x.f < y.f ? -1 : x.f > y.f ? 1 : 0).map(r => r.d
        ? `<tr><td>${this.fmt(r.f)}</td>${this.modulos.length ? `<td>${r.d.modulo_id ? this.esc(porModulo.get(Number(r.d.modulo_id)) || '—') : 'Todos'}</td>` : ''}<td colspan="2"><i>Sin clase — ${this.esc(this.textoSinClase(r.d))}</i></td></tr>`
        : `<tr><td>${this.fmt(r.t.fecha)}</td>${this.modulos.length ? `<td>${this.esc(porModulo.get(Number(r.t.modulo_id)) || '—')}</td>` : ''}<td>${this.esc(r.t.tema)}</td><td>${this.esc(r.t.actividad || '')}</td></tr>`).join('')}
      </tbody></table>
      <div class="vis"><b>Visados de Dirección/Regencia:</b> ${this.visados.length ? this.visados.map(v => `${this.esc(v.visado_por_nombre)} (${this.fmt(v.created_at.slice(0, 10))})`).join(' · ') : 'sin registrar'}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }
};
window.LibroTemasModulo = LibroTemasModulo;
