/* Panel "Seguimiento" (docentes y administración)
   1. Entregas por corregir: todas las entregas sin nota de los trayectos del docente (o de todos, si es admin).
   2. Alumnos en riesgo: criterio único ReglasFP.riesgo (el mismo del Dashboard), con aviso de módulos por cerrar,
      WhatsApp con mensaje armado y registro de seguimiento (sql/61).
   3. Bajas (manuales y automáticas) y vista de la Dirección por trayecto y docente. */
const SeguimientoModulo = {
  MINIMO: 70,
  datos: null,

  esc(t) {
    return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  urlSegura(u) {
    try { const x = new URL(String(u || '').trim()); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : '#'; }
    catch { return '#'; }
  },
  nombreDe(alumnos, key) {
    const a = alumnos.find(x => String(x.usuario) === String(key));
    if (!a) return `DNI ${key}`;
    const ap = (a.apellido || '').toUpperCase().trim();
    const no = (a.nombre || '').trim();
    return ap && no ? `${ap}, ${no}` : (ap || no || `DNI ${key}`);
  },
  sinNota(e) { return e.nota === null || e.nota === undefined || String(e.nota).trim() === ''; },

  async cargar() {
    const cont = document.getElementById('seguimiento-contenido');
    if (!cont) return;
    cont.innerHTML = '<p class="seg-cargando">Cargando seguimiento…</p>';
    try {
      const perfil = await Auth.obtenerPerfilSesion();
      const esAdmin = Auth.esPersonal ? Auth.esPersonal(perfil.rol) : Auth.esAdmin(perfil.rol);   // admin o preceptor: todos
      this.perfil = perfil;
      this.esPreceptor = Auth.esPreceptor ? Auth.esPreceptor(perfil.rol) : false;
      this.puedeRegistrar = !!esAdmin;     // reincorporar: administración, regencia y preceptoría
      // Registrar bajas automáticas: además de la administración, el docente (solo ve y registra las de sus trayectos)
      this.puedeRegistrarBajas = !!esAdmin || String(perfil.rol || '').toLowerCase().trim() === 'docente';
      this.esDirector = ['admin', 'administrador'].includes(String(perfil.rol || '').toLowerCase().trim());
      const anio = String(new Date().getFullYear());

      let q = supabase.from('trayectos').select('*');
      if (!esAdmin) {
        const sup = window.Trayectos ? Object.keys(await Trayectos.misSuplencias(perfil.dni)).map(Number) : [];
        const dniD = String(perfil.dni || '').replace(/[^0-9A-Za-z_-]/g, '');
        q = sup.length ? q.or(`docente_user.eq.${dniD},id.in.(${sup.join(',')})`) : q.eq('docente_user', dniD);
      }
      const { data: tr } = await q;
      const trayectos = (tr || []).filter(t => String(t.ciclo_lectivo || anio) === anio);

      if (!trayectos.length) {
        cont.innerHTML = `<div class="prog-vacio">${esAdmin ? 'No hay trayectos en el ciclo ' + anio + '.' : 'No tenés trayectos asignados en el ciclo ' + anio + '.'}</div>`;
        return;
      }
      const ids = trayectos.map(t => Number(t.id));
      const R = ReglasFP;
      // Todas las consultas se leen completas (de a 1000 filas y en lotes)
      const clasesDe = async (cols) => R.enLotes(ids, p => supabase.from('clases').select(cols).in('trayecto_id', p).order('id'));
      let rC = await clasesDe('id, titulo, trayecto_id, modulo_id, calificable, tipo, fecha_limite, estudiante_user');
      if (rC.error && /calificable|tipo|fecha_limite|column/i.test(rC.error.message || '')) rC = await clasesDe('id, titulo, trayecto_id, modulo_id');
      const [rI, rA, rM, rX, rE, rK] = await Promise.all([
        R.enLotes(ids, p => supabase.from('inscripciones').select('*').in('trayecto_id', p).order('id')),
        R.enLotes(ids, p => supabase.from('asistencias').select('id, trayecto_id, estudiante_user, estado, modulo_id, fecha').in('trayecto_id', p).order('id')),
        R.enLotes(ids, p => supabase.from('modulos').select('*').in('trayecto_id', p).order('id', { ascending: true })),
        R.enLotes(ids, p => supabase.from('modulos_acreditados').select('*').in('trayecto_id', p)),
        R.enLotes(ids, p => supabase.from('excepciones_estudiantes').select('trayecto_id, estudiante_user, habilitado').in('trayecto_id', p)),
        R.enLotes(ids, p => supabase.from('seguimiento_contactos').select('*').in('trayecto_id', p).order('fecha', { ascending: false }))
      ]);
      const modulos = (rM.data || []).sort((a, b) => Number(a.id) - Number(b.id));
      const acreditados = (!rX.error && rX.data) || [];
      const excepciones = (!rE.error && rE.data) || [];
      const clases = rC.data || [];
      const insc = rI.data || [];
      const asis = rA.data || [];
      this.contactosOK = !rK.error;
      const contactos = rK.error ? [] : rK.data;
      let entregas = [];
      const cids = clases.map(c => c.id);
      if (cids.length) {
        const r = await R.enLotes(cids, p => supabase.from('entregas_actividades').select('*').in('clase_id', p).order('id', { ascending: true }));
        entregas = r.data || [];
      }
      const dnis = [...new Set([...insc.map(i => String(i.estudiante_user)), ...entregas.map(e => String(e.estudiante_user))])];
      let alumnos = [], fichas = [];
      if (dnis.length) {
        const [rU, rF] = await Promise.all([
          R.enLotes(dnis, p => supabase.from('usuarios').select('usuario, nombre, apellido').in('usuario', p)),
          R.enLotes(dnis, p => supabase.from('datos_estudiante').select('dni, telefono').in('dni', p))
        ]);
        alumnos = rU.data || [];
        fichas = rF.error ? [] : (rF.data || []);
      }
      const tel = {}; fichas.forEach(f => { if (f.telefono) tel[String(f.dni)] = f.telefono; });
      const docentes = {};
      const dDnis = [...new Set(trayectos.map(t => String(t.docente_user || '')).filter(Boolean))];
      if (dDnis.length) {
        const { data } = await supabase.from('profiles').select('dni, nombre, apellido').in('dni', dDnis);
        (data || []).forEach(p => { docentes[String(p.dni)] = [p.apellido, p.nombre].filter(Boolean).join(', '); });
      }
      this.datos = { trayectos, clases, insc, asis, entregas, alumnos, modulos, acreditados, excepciones, contactos, tel, docentes };
      this.render();
    } catch (e) {
      console.error('Seguimiento:', e);
      cont.innerHTML = '<div class="prog-vacio">No se pudo cargar el seguimiento. Probá recargar la página.</div>';
    }
  },

  hoy() { return ReglasFP.hoyISO(); },
  diasDesde(f) { if (!f) return null; return Math.floor((Date.parse(this.hoy() + 'T12:00:00Z') - Date.parse(String(f).slice(0, 10) + 'T12:00:00Z')) / 864e5); },
  fecha(f) { return f ? String(f).slice(0, 10).split('-').reverse().join('/') : '–'; },
  ultimoContacto(tid, key) { return (this.datos.contactos || []).find(c => Number(c.trayecto_id) === Number(tid) && String(c.estudiante_user) === String(key)); },
  RESULTADOS: { contactado: 'Contactado', no_responde: 'No responde', vuelve: 'Dice que vuelve', abandona: 'Dice que abandona', otro: 'Otro' },
  TIPOS: { llamada: 'Llamada', whatsapp: 'WhatsApp', mensaje: 'Mensaje', entrevista: 'Entrevista', otro: 'Otro' },

  render() {
    const { trayectos, clases, insc, asis, entregas, alumnos, modulos = [], acreditados = [], excepciones = [], tel = {}, docentes = {} } = this.datos;
    const cont = document.getElementById('seguimiento-contenido');
    const R = ReglasFP, hoy = this.hoy();

    // ---- Evaluación de cada inscripto (una sola vez) y bajas (manuales y automáticas): no cuentan como "en riesgo"
    const bajas = [];
    const claveBaja = new Set();
    const evs = {};
    trayectos.forEach(t => {
      const tid = Number(t.id);
      const modsT = modulos.filter(m => Number(m.trayecto_id) === tid);
      const clT = clases.filter(c => Number(c.trayecto_id) === tid), asT = asis.filter(a => Number(a.trayecto_id) === tid), acT = acreditados.filter(a => Number(a.trayecto_id) === tid);
      insc.filter(i => Number(i.trayecto_id) === tid).forEach(i => {
        const key = String(i.estudiante_user);
        const excepcion = excepciones.some(x => Number(x.trayecto_id) === tid && String(x.estudiante_user) === key && x.habilitado);
        const ev = R.evaluar({ key, modulos: modsT, clases: clT, entregas, asistencias: asT, acreditados: acT, computaAsistencia: R.computaAsistencia(t), excepcion });
        const c = R.estadoCursada(ev, modsT, i, { excepcion });
        evs[tid + '|' + key] = { ev, modsT };
        if (c.baja) { bajas.push({ t, key, nombre: this.nombreDe(alumnos, key), ...c }); claveBaja.add(tid + '|' + key); }
      });
    });
    const califIds = new Set(clases.filter(c => c.calificable !== false && c.tipo !== 'encuesta').map(c => Number(c.id)));
    const pendientes = entregas.filter(e => this.sinNota(e) && califIds.has(Number(e.clase_id)));
    pendientes.forEach(e => { e._dias = this.diasDesde(e.created_at); });
    const viejas = pendientes.filter(e => e._dias !== null && e._dias > 7).length;
    const antig = d => d === null ? '' : d > 7 ? `<span class="seg-chip seg-vieja" title="Esperando corrección">hace ${d} días</span>` : `<span class="seg-chip seg-nueva">${d === 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días'}</span>`;

    // ---- 1. Entregas por corregir (de la más vieja a la más nueva)
    let htmlPend = '';
    const porTPend = {};
    trayectos.forEach(t => {
      const cT = clases.filter(c => Number(c.trayecto_id) === Number(t.id));
      const idsC = new Set(cT.map(c => Number(c.id)));
      const pT = pendientes.filter(e => idsC.has(Number(e.clase_id))).sort((a, b) => (b._dias ?? -1) - (a._dias ?? -1));
      porTPend[t.id] = pT;
      if (!pT.length) return;
      const vT = pT.filter(e => e._dias > 7).length;
      htmlPend += `<details class="seg-grupo"><summary><span class="seg-g-nom">${this.esc(t.nombre)}</span>${vT ? `<span class="seg-chip seg-vieja">${vT} con más de 7 días</span>` : ''}<span class="seg-cuenta">${pT.length}</span></summary>`;
      pT.forEach(e => {
        const c = cT.find(x => Number(x.id) === Number(e.clase_id));
        const url = this.urlSegura(e.url_entrega);
        htmlPend += `
          <div class="seg-item" id="seg-ent-${Number(e.id)}">
            <div class="seg-item-info">
              <strong><button type="button" class="seg-nombre" onclick="FichaAlumno.abrir('${this.esc(String(e.estudiante_user).replace(/\D/g, ''))}')">${this.esc(this.nombreDe(alumnos, e.estudiante_user))}</button></strong>
              <span>${this.esc(c ? c.titulo : 'Actividad')} ${antig(e._dias)}</span>
            </div>
            ${url !== '#' ? `<a class="seg-ver" href="${this.esc(url)}" target="_blank" rel="noopener noreferrer">Ver trabajo</a>`
              : (c && c.tipo && c.tipo !== 'tp' && window.Actividades ? `<button type="button" class="seg-ver" onclick="Actividades.verEntrega(${Number(c.id)}, '${this.esc(String(e.estudiante_user).replace(/[^0-9A-Za-z_-]/g, ''))}')">Ver respuestas</button>` : '<span class="seg-sinlink">Sin enlace</span>')}
            <input class="form-control seg-nota" id="seg-nota-${Number(e.id)}" inputmode="numeric" placeholder="Nota" aria-label="Nota de 0 a 100">
            <input class="form-control seg-coment" id="seg-coment-${Number(e.id)}" placeholder="Devolución (opcional)" aria-label="Devolución">
            <button type="button" class="btn btn-primary seg-guardar" onclick="SeguimientoModulo.calificar(${Number(e.id)}, ${Number(t.id)})">Guardar</button>
          </div>`;
      });
      htmlPend += '</details>';
    });
    if (!htmlPend) htmlPend = '<div class="seg-ok">No hay entregas pendientes de corrección. ¡Todo al día!</div>';

    // ---- 2. Estudiantes en riesgo (mismo criterio que el Dashboard: ReglasFP.riesgo)
    const riesgo = [];
    trayectos.forEach(t => {
      const tid = Number(t.id);
      if (t.fecha_cierre && String(t.fecha_cierre).slice(0, 10) < hoy) return;      // trayecto terminado
      const computa = R.computaAsistencia(t);
      const idsC = new Set(clases.filter(c => Number(c.trayecto_id) === tid && c.calificable !== false && c.tipo !== 'encuesta' && c.tipo !== 'material').map(c => Number(c.id)));
      insc.filter(i => Number(i.trayecto_id) === tid).forEach(i => {
        const key = String(i.estudiante_user), k = tid + '|' + key;
        const autoPend = bajas.find(b => Number(b.t.id) === tid && String(b.key) === key && b.tipo === 'automatica' && !b.guardada);
        if (claveBaja.has(k) && !autoPend) return;
        const porDia = {};
        if (computa) asis.forEach(x => { if (Number(x.trayecto_id) === tid && String(x.estudiante_user) === key && x.fecha) { const f = String(x.fecha).slice(0, 10); porDia[f] = porDia[f] || R.esPresente(x.estado); } });
        const ent = entregas.filter(e => idsC.has(Number(e.clase_id)) && String(e.estudiante_user) === key);
        const notas = ent.map(e => parseFloat(e.nota)).filter(v => !isNaN(v));
        const prom = notas.length ? Math.round(notas.reduce((x, y) => x + y, 0) / notas.length) : null;
        const e = evs[k];
        const rr = R.riesgo({ dias: Object.entries(porDia), promedio: prom, sinEntregas: idsC.size >= 2 && ent.length === 0,
          bajaPendiente: !!autoPend, cierres: autoPend || !e ? [] : R.cierresProximos(e.ev, e.modsT, 14, hoy) });
        if (!rr.nivel) return;
        riesgo.push({ t, key, nombre: this.nombreDe(alumnos, key), tel: tel[key] || '', contacto: this.ultimoContacto(tid, key), cierre: rr.motivos.some(m => / cierra el /.test(m)), ...rr });
      });
    });
    const orden = { alto: 0, medio: 1 };
    riesgo.sort((a, b) => orden[a.nivel] - orden[b.nivel] || b.seguidas - a.seguidas || (a.pct ?? 101) - (b.pct ?? 101) || a.nombre.localeCompare(b.nombre));
    this.riesgo = riesgo;
    const altos = riesgo.filter(r => r.nivel === 'alto').length, porCerrar = riesgo.filter(r => r.cierre).length;
    const etContacto = c => c ? `<span class="seg-contacto">📝 ${this.fecha(c.fecha)} · ${this.esc(this.RESULTADOS[c.resultado] || c.resultado)}${c.creado_nombre ? ' · ' + this.esc(c.creado_nombre) : ''}</span>` : '';
    const porTR = new Map();
    riesgo.forEach(r => { if (!porTR.has(r.t.id)) porTR.set(r.t.id, { t: r.t, lista: [] }); porTR.get(r.t.id).lista.push(r); });
    let htmlRiesgo = [...porTR.values()].sort((a, b) => b.lista.filter(x => x.nivel === 'alto').length - a.lista.filter(x => x.nivel === 'alto').length || b.lista.length - a.lista.length).map(g => {
      const al = g.lista.filter(x => x.nivel === 'alto').length;
      return `<details class="seg-grupo"><summary><span class="seg-g-nom">${this.esc(g.t.nombre)}</span>${al ? `<span class="seg-chip seg-alto">${al} alto</span>` : ''}<span class="seg-cuenta riesgo">${g.lista.length}</span></summary>
        ${g.lista.map(f => {
          const dni = this.esc(String(f.key).replace(/[^0-9A-Za-z_-]/g, ''));
          return `<div class="seg-item riesgo seg-${f.nivel}">
            <div class="seg-item-info"><strong>${f.nivel === 'alto' ? '<span class="seg-nivel alto" title="Riesgo alto">▲ Alto</span>' : '<span class="seg-nivel medio" title="Riesgo medio">● Medio</span>'} ${this.esc(f.nombre)}</strong>
              <span>DNI ${this.esc(f.key)} · último presente: ${this.fecha(f.ultima)}${f.tel ? ' · Tel. ' + this.esc(f.tel) : ''}</span>${etContacto(f.contacto)}</div>
            <div class="seg-acciones">
              <button type="button" class="seg-ver" onclick="FichaAlumno.abrir('${this.esc(String(f.key).replace(/\D/g, ''))}')">Ver ficha</button>
              ${R.telWhatsapp(f.tel) ? `<button type="button" class="seg-ver seg-wa" onclick="SeguimientoModulo.whatsapp(${Number(f.t.id)}, '${dni}')">WhatsApp</button>` : ''}
              ${this.contactosOK ? `<button type="button" class="seg-ver" onclick="SeguimientoModulo.contacto(${Number(f.t.id)}, '${dni}')">📝 Seguimiento</button>` : ''}
            </div>
            <div class="seg-chips">${f.motivos.map(m => `<span class="seg-chip">${this.esc(m)}</span>`).join('')}</div>
          </div>`;
        }).join('')}</details>`;
    }).join('');
    if (!htmlRiesgo) htmlRiesgo = '<div class="seg-ok">Ningún alumno en riesgo por ahora.</div>';

    let htmlBajas = '<div class="seg-ok">No hay bajas registradas.</div>';
    if (bajas.length) {
      const porT = new Map();
      bajas.sort((x, y) => String(x.t.nombre).localeCompare(String(y.t.nombre)) || String(x.key).localeCompare(String(y.key)))
        .forEach(b => { const k = Number(b.t.id); if (!porT.has(k)) porT.set(k, { t: b.t, lista: [] }); porT.get(k).lista.push(b); });
      htmlBajas = [...porT.values()].map(g => `<details class="seg-grupo"><summary><span class="seg-g-nom">${this.esc(g.t.nombre)}</span><span class="seg-cuenta riesgo">${g.lista.length}</span></summary>
        ${g.lista.map(b => `<div class="seg-item riesgo">
          <div class="seg-item-info"><strong>${this.esc(this.nombreDe(alumnos, b.key))}</strong><span>DNI ${this.esc(b.key)}</span></div>
          <button type="button" class="seg-ver" onclick="FichaAlumno.abrir('${this.esc(String(b.key).replace(/\D/g, ''))}')">Ver ficha</button>
          ${this.puedeRegistrar && b.guardada ? `<button type="button" class="seg-ver" onclick="SeguimientoModulo.reincorporarDesdeLista(${Number(b.t.id)}, '${this.esc(String(b.key).replace(/[^0-9A-Za-z_-]/g, ''))}')">Reincorporar</button>` : ''}
          <div class="seg-chips"><span class="seg-chip">${b.tipo === 'automatica' ? 'Baja automática' : 'Baja'}${b.tipo === 'automatica' && !b.guardada ? ' sin registrar' : ''}</span><span class="seg-motivo">${this.esc(b.motivo)}</span></div>
        </div>`).join('')}</details>`).join('');
    }
    // Bajas automáticas todavía sin guardar (la planilla de matrícula solo cuenta las guardadas)
    this._bajasVistas = bajas;
    this.bajasAuto = bajas.filter(b => b.tipo === 'automatica' && !b.guardada);
    this._pendientes = pendientes;
    const btnRegistrar = (this.puedeRegistrarBajas && this.bajasAuto.length)
      ? `<div class="seg-registrar"><span><b>${this.bajasAuto.length}</b> baja(s) automática(s) sin registrar: la planilla de matrícula todavía las cuenta como matriculados.</span>
         <button type="button" class="btn btn-gold" onclick="SeguimientoModulo.registrarBajasAuto()">Registrar bajas automáticas</button></div>` : '';

    // ---- Resumen en palabras
    const hace7 = new Date(Date.parse(hoy + 'T12:00:00Z') - 7 * 864e5).toISOString();
    const contSemana = (this.datos.contactos || []).filter(c => String(c.fecha) >= hace7).length;
    const frases = [];
    if (!this.esPreceptor) frases.push(pendientes.length ? `Hay <b>${pendientes.length}</b> entrega${pendientes.length > 1 ? 's' : ''} por corregir${viejas ? `; <b>${viejas}</b> espera${viejas > 1 ? 'n' : ''} hace más de 7 días` : ''}.` : 'No hay entregas pendientes de corrección.');
    frases.push(riesgo.length ? `<b>${riesgo.length}</b> estudiante${riesgo.length > 1 ? 's' : ''} en riesgo${altos ? `, <b>${altos}</b> con riesgo alto` : ''}.` : 'Ningún estudiante en riesgo por ahora.');
    if (porCerrar) frases.push(`⏳ <b>${porCerrar}</b> estudiante${porCerrar > 1 ? 's tienen' : ' tiene'} un módulo que cierra en los próximos 14 días con nota menor a ${this.MINIMO}: todavía hay tiempo para un recuperatorio.`);
    if (this.bajasAuto.length) frases.push(`⚠️ <b>${this.bajasAuto.length}</b> baja${this.bajasAuto.length > 1 ? 's' : ''} automática${this.bajasAuto.length > 1 ? 's' : ''} sin registrar.`);
    if (this.contactosOK) frases.push(`${contSemana} contacto${contSemana === 1 ? '' : 's'} registrado${contSemana === 1 ? '' : 's'} en los últimos 7 días.`);

    // ---- Vista de la Dirección: por trayecto y docente
    let htmlDir = '';
    if (this.esDirector) {
      const hace30 = new Date(Date.parse(hoy + 'T12:00:00Z') - 30 * 864e5).toISOString();
      const filas = trayectos.map(t => {
        const pT = porTPend[t.id] || [], rT = riesgo.filter(r => Number(r.t.id) === Number(t.id));
        return { t, doc: docentes[String(t.docente_user || '')] || (t.docente_user ? 'DNI ' + t.docente_user : 'Sin docente'), pend: pT.length, viejas: pT.filter(e => e._dias > 7).length,
          riesgo: rT.length, alto: rT.filter(r => r.nivel === 'alto').length, sinReg: this.bajasAuto.filter(b => Number(b.t.id) === Number(t.id)).length,
          cont: (this.datos.contactos || []).filter(c => Number(c.trayecto_id) === Number(t.id) && String(c.fecha) >= hace30).length };
      }).sort((a, b) => b.alto - a.alto || b.viejas - a.viejas || b.riesgo - a.riesgo);
      const marca = (v, malo) => v ? `<b style="color:${malo ? '#B42318' : 'inherit'}">${v}</b>` : '<span style="color:#94a3b8">0</span>';
      htmlDir = `<section class="card-panel seg-panel"><div class="card-panel-header"><h3 style="margin:0">Vista de la Dirección: por trayecto y docente</h3></div>
        <p class="seg-ayuda">Para saber dónde hace falta acompañar. La ve solo la Dirección. Ordenado por estudiantes con riesgo alto.</p>
        <div style="overflow-x:auto"><table class="tabla-simple seg-tabla"><thead><tr><th>Trayecto</th><th>Docente</th><th>Por corregir</th><th>+7 días</th><th>En riesgo</th><th>Alto</th><th>Bajas sin registrar</th><th>Contactos (30 días)</th></tr></thead><tbody>
        ${filas.map(f => `<tr><td>${this.esc(f.t.nombre)}</td><td>${this.esc(f.doc)}</td><td>${marca(f.pend)}</td><td>${marca(f.viejas, true)}</td><td>${marca(f.riesgo)}</td><td>${marca(f.alto, true)}</td><td>${marca(f.sinReg, true)}</td><td>${this.contactosOK ? marca(f.cont) : '–'}</td></tr>`).join('')}</tbody></table></div></section>`;
    }

    // Con un solo trayecto con novedades, se muestra desplegado
    const abrirUnico = (h) => (h.match(/<details/g) || []).length === 1 ? h.replace('<details', '<details open') : h;
    htmlPend = abrirUnico(htmlPend); htmlRiesgo = abrirUnico(htmlRiesgo); htmlBajas = abrirUnico(htmlBajas);
    const barraPlegar = '<div class="seg-plegar"><button type="button" onclick="SeguimientoModulo.plegar(this, true)">Abrir todos</button><button type="button" onclick="SeguimientoModulo.plegar(this, false)">Cerrar todos</button></div>';

    cont.innerHTML = `
      <div class="card-panel seg-panel seg-resumen-txt">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">Resumen</h3>
          <button type="button" class="btn-secondary" style="padding:.3rem .7rem;font-size:.8rem" onclick="SeguimientoModulo.exportar()">⬇️ Excel</button></div>
        <ul>${frases.map(f => `<li>${f}</li>`).join('')}</ul>
        ${this.contactosOK ? '' : '<p class="seg-ayuda" style="margin:0">El registro de seguimiento (📝) se activa al ejecutar <code>sql/61_seguimiento_contactos.sql</code> en Supabase.</p>'}
      </div>
      <div class="seg-resumen">
        ${this.esPreceptor ? '' : `<div class="stat-card"><div class="stat-info"><h4>Entregas por corregir</h4><p class="stat-value">${pendientes.length}</p>${viejas ? `<small style="color:#B42318">${viejas} con más de 7 días</small>` : ''}</div></div>`}
        <div class="stat-card"><div class="stat-info"><h4>Alumnos en riesgo</h4><p class="stat-value">${riesgo.length}</p>${altos ? `<small style="color:#B42318">${altos} con riesgo alto</small>` : ''}</div></div>
        <div class="stat-card"><div class="stat-info"><h4>Módulo por cerrar</h4><p class="stat-value">${porCerrar}</p><small style="color:var(--text-muted)">con nota menor a ${this.MINIMO}</small></div></div>
        <div class="stat-card"><div class="stat-info"><h4>Bajas</h4><p class="stat-value">${bajas.length}</p>${this.bajasAuto.length ? `<small style="color:#B42318">${this.bajasAuto.length} sin registrar</small>` : ''}</div></div>
      </div>
      ${htmlDir}
      <section class="card-panel seg-panel">
        <div class="card-panel-header"><h3 style="margin:0">Alumnos en riesgo</h3></div>
        <p class="seg-ayuda"><b>Riesgo medio:</b> 2 faltas seguidas, asistencia menor a ${R.RIESGO_ASIS} % (con 4 clases o más), asistencia en baja en las últimas clases, promedio menor a ${this.MINIMO} o ninguna entrega con 2 o más actividades publicadas.
          <b>Riesgo alto:</b> 3 faltas seguidas, asistencia menor a ${R.RIESGO_ASIS_ALTO} %, un módulo que cierra en 14 días o menos con nota menor a ${this.MINIMO}, o una baja automática sin registrar. Es el mismo criterio que usa el Dashboard.</p>
        ${barraPlegar}
        ${htmlRiesgo}
      </section>
      ${this.esPreceptor ? '' : `<section class="card-panel seg-panel">
        <div class="card-panel-header"><h3 style="margin:0">Entregas por corregir</h3></div>
        <p class="seg-ayuda">Ordenadas de la más vieja a la más nueva. En rojo, las que esperan hace más de 7 días.</p>
        ${barraPlegar}
        ${htmlPend}
      </section>`}
      <section class="card-panel seg-panel">
        <div class="card-panel-header"><h3 style="margin:0">Bajas</h3></div>
        <p class="seg-ayuda">Baja manual: cargada en la pestaña Estudiantes del trayecto. Baja automática: cerró un módulo (pasó su fecha de fin) y la nota quedó debajo de ${this.MINIMO}; no corre si el docente dio habilitación excepcional.</p>
        ${btnRegistrar}
        ${barraPlegar}
        ${htmlBajas}
      </section>`;
    this.estilos();
    this.actualizarContador(this.esPreceptor ? 0 : pendientes.length);
  },

  estilos() {
    if (document.getElementById('seg-estilo-extra')) return;
    const st = document.createElement('style'); st.id = 'seg-estilo-extra';
    st.textContent = `.seg-resumen-txt ul{margin:8px 0 6px;padding-left:18px;font-size:.9rem;line-height:1.5}
      .seg-chip.seg-vieja{background:#FDE7E5;color:#B42318}.seg-chip.seg-nueva{background:#EEF3F6;color:#475569}.seg-chip.seg-alto{background:#FDE7E5;color:#B42318;margin-left:auto}
      .seg-nivel{font-size:.78rem;font-weight:700;margin-right:4px}.seg-nivel.alto{color:#B42318}.seg-nivel.medio{color:#B7791F}
      .seg-item.seg-alto{border-left:4px solid #B42318}.seg-item.seg-medio{border-left:4px solid #E3A008}
      .seg-acciones{display:flex;gap:6px;flex-wrap:wrap}.seg-wa{background:#E7F7EE!important;color:#146B47!important;border-color:#9AD9B5!important}
      .seg-contacto{display:block;font-size:.78rem;color:#1D5FA8;margin-top:2px}
      .seg-tabla{width:100%;border-collapse:collapse;font-size:.85rem}.seg-tabla th,.seg-tabla td{padding:6px 8px;text-align:center;border-bottom:1px solid #EEF3F6}.seg-tabla th:first-child,.seg-tabla td:first-child,.seg-tabla th:nth-child(2),.seg-tabla td:nth-child(2){text-align:left}`;
    document.head.appendChild(st);
  },

  /* ---------- WhatsApp con mensaje armado ---------- */
  whatsapp(tid, dni) {
    const r = (this.riesgo || []).find(x => Number(x.t.id) === Number(tid) && String(x.key) === String(dni));
    if (!r) return;
    const num = ReglasFP.telWhatsapp(r.tel);
    if (!num) return Swal.fire('Sin celular', 'El teléfono de la ficha no parece un celular válido.', 'info');
    const nombre = String(r.nombre || '').split(',').pop().trim().split(' ')[0] || '';
    const cierre = r.motivos.find(m => / cierra el /.test(m));
    let msg = `Hola${nombre && !/^DNI/.test(nombre) ? ' ' + nombre : ''}, te escribimos del CFP N.º 401 San Andrés de Giles por el trayecto «${r.t.nombre}». `;
    if (cierre) msg += `${cierre.replace(/ con nota \d+$/, '')} y todavía estás a tiempo de aprobarlo: consultá con tu instructor/a cómo ponerte al día. `;
    else if (r.seguidas >= 2) msg += 'Notamos que faltaste a las últimas clases. ¿Está todo bien? ';
    else msg += 'Queríamos saber cómo venís con la cursada. ';
    msg += '¡Te esperamos!';
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    if (!this.contactosOK) return;
    setTimeout(async () => {
      const q = await Swal.fire({ title: '¿Pudiste enviar el mensaje?', text: 'Si lo enviaste, queda anotado en el seguimiento del estudiante.', icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, anotarlo', cancelButtonText: 'No' });
      if (q.isConfirmed) await this.guardarContacto(tid, dni, { tipo: 'whatsapp', resultado: 'otro', nota: 'Mensaje enviado por WhatsApp desde Seguimiento.' });
    }, 600);
  },

  /* ---------- Registro de seguimiento (llamadas, mensajes, entrevistas) ---------- */
  async guardarContacto(tid, dni, v) {
    const p = this.perfil || {};
    const { error } = await supabase.from('seguimiento_contactos').insert([{ trayecto_id: Number(tid), estudiante_user: String(dni), tipo: v.tipo, resultado: v.resultado,
      nota: v.nota ? String(v.nota).slice(0, 300) : null, creado_nombre: [p.apellido, p.nombre].filter(Boolean).join(', ').slice(0, 120) || null }]);
    if (error) { Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: error.message || '' }); return false; }
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Seguimiento anotado', showConfirmButton: false, timer: 1800 });
    const { data } = await supabase.from('seguimiento_contactos').select('*').eq('trayecto_id', Number(tid)).eq('estudiante_user', String(dni)).order('fecha', { ascending: false });
    this.datos.contactos = (this.datos.contactos || []).filter(c => !(Number(c.trayecto_id) === Number(tid) && String(c.estudiante_user) === String(dni))).concat(data || [])
      .sort((a, b) => (String(a.fecha) < String(b.fecha) ? 1 : -1));
    this.render();
    return true;
  },

  async contacto(tid, dni) {
    const r = (this.riesgo || []).find(x => Number(x.t.id) === Number(tid) && String(x.key) === String(dni));
    const hist = (this.datos.contactos || []).filter(c => Number(c.trayecto_id) === Number(tid) && String(c.estudiante_user) === String(dni));
    const yo = this.perfil ? this.perfil.id : null, admin = Auth.esAdmin(this.perfil && this.perfil.rol);
    const op = o => Object.entries(o).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    const res = await Swal.fire({
      title: 'Seguimiento', width: 640, showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cerrar', focusConfirm: false,
      html: `<p style="text-align:left;font-size:.9rem;margin:0 0 8px"><b>${this.esc(r ? r.nombre : 'DNI ' + dni)}</b> · ${this.esc(r ? r.t.nombre : '')}${r && r.tel ? ' · Tel. ' + this.esc(r.tel) : ''}</p>
        <div style="text-align:left;max-height:180px;overflow:auto;font-size:.82rem;border:1px solid #e5e7eb;border-radius:6px;padding:6px;margin-bottom:10px">${hist.length ? hist.map(c => `<div style="padding:4px 0;border-bottom:1px solid #f1f5f9"><b>${this.fecha(c.fecha)}</b> · ${this.esc(this.TIPOS[c.tipo] || c.tipo)} · ${this.esc(this.RESULTADOS[c.resultado] || c.resultado)}${c.creado_nombre ? ' · <small>' + this.esc(c.creado_nombre) + '</small>' : ''}${c.nota ? `<br><span>${this.esc(c.nota)}</span>` : ''}${(admin || c.creado_por === yo) ? ` <a href="#" style="color:#B42318;font-size:.75rem" onclick="event.preventDefault();SeguimientoModulo.borrarContacto(${Number(c.id)}, ${Number(tid)}, '${this.esc(String(dni).replace(/[^0-9A-Za-z_-]/g, ''))}')">borrar</a>` : ''}</div>`).join('') : '<i>Todavía no hay contactos registrados.</i>'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left;font-size:.85rem">
          <label>Cómo<select id="sc-tipo" class="swal2-select" style="width:100%;margin:4px 0 0">${op(this.TIPOS)}</select></label>
          <label>Resultado<select id="sc-res" class="swal2-select" style="width:100%;margin:4px 0 0">${op(this.RESULTADOS)}</select></label></div>
        <textarea id="sc-nota" class="swal2-textarea" maxlength="300" placeholder="Nota (opcional). Ej.: tuvo un problema de horario en el trabajo, vuelve el lunes." style="width:100%;margin:8px 0 0;box-sizing:border-box"></textarea>`,
      preConfirm: () => ({ tipo: document.getElementById('sc-tipo').value, resultado: document.getElementById('sc-res').value, nota: document.getElementById('sc-nota').value.trim() })
    });
    if (res.isConfirmed) await this.guardarContacto(tid, dni, res.value);
  },

  async borrarContacto(id, tid, dni) {
    const { error } = await supabase.from('seguimiento_contactos').delete().eq('id', Number(id));
    if (error) return Swal.fire({ icon: 'error', title: 'No se pudo borrar', text: error.message || '' });
    this.datos.contactos = (this.datos.contactos || []).filter(c => Number(c.id) !== Number(id));
    Swal.close();
    this.render();
    this.contacto(tid, dni);
  },

  /* ---------- Excel ---------- */
  async exportar() {
    if (typeof ExcelJS === 'undefined') return Swal.fire('Excel no disponible', 'No se cargó la librería de Excel.', 'error');
    const wb = new ExcelJS.Workbook(), neg = r => { r.font = { bold: true }; return r; };
    const w1 = wb.addWorksheet('En riesgo');
    w1.columns = [{ width: 9 }, { width: 32 }, { width: 13 }, { width: 18 }, { width: 34 }, { width: 50 }, { width: 14 }, { width: 40 }];
    neg(w1.addRow(['Riesgo', 'Estudiante', 'DNI', 'Teléfono', 'Trayecto', 'Motivos', 'Último presente', 'Último contacto']));
    (this.riesgo || []).forEach(r => w1.addRow([r.nivel, r.nombre, r.key, r.tel, r.t.nombre, r.motivos.join(' · '), this.fecha(r.ultima),
      r.contacto ? `${this.fecha(r.contacto.fecha)} · ${this.TIPOS[r.contacto.tipo] || ''} · ${this.RESULTADOS[r.contacto.resultado] || ''}${r.contacto.nota ? ' · ' + r.contacto.nota : ''}` : '']));
    if (!this.esPreceptor) {
      const w2 = wb.addWorksheet('Entregas por corregir'); w2.columns = [{ width: 34 }, { width: 32 }, { width: 40 }, { width: 14 }, { width: 12 }];
      neg(w2.addRow(['Trayecto', 'Estudiante', 'Actividad', 'Entregada', 'Días']));
      (this._pendientes || []).slice().sort((a, b) => (b._dias ?? -1) - (a._dias ?? -1)).forEach(e => {
        const c = this.datos.clases.find(x => Number(x.id) === Number(e.clase_id)), t = c && this.datos.trayectos.find(x => Number(x.id) === Number(c.trayecto_id));
        w2.addRow([t ? t.nombre : '', this.nombreDe(this.datos.alumnos, e.estudiante_user), c ? c.titulo : '', this.fecha(e.created_at), e._dias ?? '']);
      });
    }
    const w3 = wb.addWorksheet('Bajas'); w3.columns = [{ width: 34 }, { width: 32 }, { width: 13 }, { width: 14 }, { width: 14 }, { width: 50 }];
    neg(w3.addRow(['Trayecto', 'Estudiante', 'DNI', 'Tipo', 'Registrada', 'Motivo']));
    (this._bajasVistas || []).forEach(b => w3.addRow([b.t.nombre, b.nombre, b.key, b.tipo === 'automatica' ? 'Automática' : 'Manual', b.guardada ? 'Sí' : 'No', b.motivo]));
    const buf = await wb.xlsx.writeBuffer(), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `seguimiento_${this.hoy()}.xlsx`; a.click();
  },

  plegar(btn, abrir) {
    const sec = btn.closest('.seg-panel');
    if (sec) sec.querySelectorAll('details.seg-grupo').forEach(d => { d.open = abrir; });
  },

  /* Pasa las bajas automáticas a bajas guardadas, con la fecha en que cerró el módulo no aprobado */
  async registrarBajasAuto() {
    const lista = this.bajasAuto || [];
    if (!lista.length || typeof Swal === 'undefined') return;
    const fecha = (f) => String(f || '').split('-').reverse().join('/');
    const r = await Swal.fire({
      title: 'Registrar bajas automáticas', width: 720, showCancelButton: true, confirmButtonText: 'Registrar las marcadas', cancelButtonText: 'Cancelar',
      html: `<p style="font-size:.85rem;text-align:left">Desmarcá a quienes no deban darse de baja. Cada baja queda con la fecha en que cerró el módulo no aprobado, y se puede deshacer con «Reincorporar».</p>
        <div style="max-height:300px;overflow:auto;text-align:left;font-size:.85rem">${lista.map((b, i) => `<label style="display:flex;gap:.5rem;padding:.35rem 0;border-bottom:1px solid #e5e7eb"><input type="checkbox" class="bj-chk" data-i="${i}" checked>
          <span><b>${this.esc(b.nombre)}</b> · ${this.esc(b.t.nombre)}<br><small>Baja desde ${this.esc(fecha(b.fecha))} · ${this.esc(b.motivo)}</small></span></label>`).join('')}</div>`,
      preConfirm: () => [...document.querySelectorAll('.bj-chk')].filter(c => c.checked).map(c => lista[Number(c.dataset.i)])
    });
    if (!r.isConfirmed || !r.value.length) return;
    const perfil = window.Auth && Auth.usuarioActual;
    Swal.fire({ title: 'Registrando…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    let ok = 0; const fallas = [];
    for (const b of r.value) {
      const { error } = await supabase.from('inscripciones').update({
        estado: 'BAJA', fecha_baja: b.fecha, motivo_baja: String(b.motivo).slice(0, 200), baja_tipo: 'automatica', baja_por: perfil ? perfil.id : null
      }).eq('trayecto_id', Number(b.t.id)).eq('estudiante_user', String(b.key));
      if (error) fallas.push(error.message); else ok++;
    }
    Swal.close();
    if (fallas.length) {
      const falta = /baja_tipo|reincorporado/.test(fallas[0]) ? ' Falta ejecutar sql/19_bajas_guardadas.sql en Supabase.' : '';
      Swal.fire({ icon: 'warning', title: `Se registraron ${ok} de ${r.value.length}`, text: fallas[0] + falta });
    } else {
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `${ok} baja(s) registrada(s)`, showConfirmButton: false, timer: 2500 });
    }
    this.cargar();
  },

  /* Reincorporar a un estudiante con fundamentación escrita (administración, regencia y preceptoría) */
  async reincorporar(trayectoId, dni, nombre) {
    if (typeof Swal === 'undefined') return false;
    const r = await Swal.fire({
      title: 'Reincorporar estudiante', icon: 'question', width: 560, showCancelButton: true,
      confirmButtonText: 'Reincorporar', cancelButtonText: 'Cancelar', focusConfirm: false,
      html: `<p style="font-size:.88rem;text-align:left"><b>${this.esc(nombre || ('DNI ' + dni))}</b> vuelve a figurar como activo en este trayecto y no se le vuelve a aplicar la baja automática. Escribí la fundamentación: queda registrada con tu nombre y la fecha.</p>`,
      input: 'textarea', inputPlaceholder: 'Ej.: Presentó certificado médico por el período; rindió el recuperatorio el 12/10 con nota 80.',
      inputAttributes: { maxlength: 1000 },
      inputValidator: (v) => (!v || v.trim().length < 10) ? 'Escribí la fundamentación (al menos 10 caracteres).' : null
    });
    if (!r.isConfirmed) return false;
    const { error } = await supabase.from('inscripciones').update({
      estado: 'ACTIVA', motivo_baja: null, fecha_baja: null, baja_tipo: null, reincorporado: true, motivo_reincorporacion: r.value.trim()
    }).eq('trayecto_id', Number(trayectoId)).eq('estudiante_user', String(dni));
    if (error) {
      const falta = /motivo_reincorporacion/.test(error.message || '') ? ' Falta ejecutar sql/29_reincorporacion_fundamentada.sql en Supabase.' : '';
      Swal.fire({ icon: 'error', title: 'No se pudo reincorporar', text: (error.message || '') + falta });
      return false;
    }
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Estudiante reincorporado', showConfirmButton: false, timer: 2000 });
    return true;
  },

  async reincorporarDesdeLista(trayectoId, dni) {
    const b = (this._bajasVistas || []).find(x => Number(x.t.id) === Number(trayectoId) && String(x.key) === String(dni));
    if (await this.reincorporar(trayectoId, dni, b ? b.nombre : '')) this.cargar();
  },

  actualizarContador(n) {
    const b = document.getElementById('btn-seguimiento');
    if (!b) return;
    let badge = b.querySelector('.seg-badge');
    if (!badge) { badge = document.createElement('span'); badge.className = 'seg-badge'; b.appendChild(badge); }
    badge.textContent = n > 0 ? String(n) : '';
    badge.style.display = n > 0 ? 'inline-flex' : 'none';
  },

  async calificar(entregaId, trayectoId) {
    const notaTxt = (document.getElementById(`seg-nota-${entregaId}`)?.value || '').trim();
    const coment = (document.getElementById(`seg-coment-${entregaId}`)?.value || '').trim();
    const nota = Number(notaTxt.replace(',', '.'));
    if (notaTxt === '' || isNaN(nota) || nota < 0 || nota > 100) {
      alert('⚠️ Ingresá una nota entre 0 y 100.');
      return;
    }
    try {
      const e = this.datos.entregas.find(x => Number(x.id) === Number(entregaId));
      const { error } = await supabase.from('entregas_actividades')
        .update({ nota: String(nota), comentario_docente: coment || null })
        .eq('id', entregaId);
      if (error) throw error;

      const c = this.datos.clases.find(x => Number(x.id) === Number(e?.clase_id));
      const estado = nota >= this.MINIMO ? `calificado con ${nota} (acreditado) ✅` : `calificado con ${nota} (no acreditado) ⚠️`;
      await supabase.from('notificaciones').insert([{
        estudiante_user: String(e.estudiante_user),
        trayecto_id: Number(trayectoId),
        clase_id: Number(e.clase_id),
        titulo: `Novedad en ${c ? c.titulo : 'una actividad'}`,
        mensaje: `Tu trabajo fue ${estado}.${coment ? ` Observación: "${coment}"` : ''}`
      }]);

      e.nota = String(nota);
      e.comentario_docente = coment || null;
      if (typeof Swal !== 'undefined') {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Nota guardada y alumno notificado', showConfirmButton: false, timer: 2200 });
      }
      this.render();
    } catch (err) {
      console.error('Calificar:', err);
      alert('No se pudo guardar la nota: ' + (err.message || 'error de conexión'));
    }
  },

  // Al entrar a la plataforma, muestra en el menú cuántas entregas esperan corrección
  async contarPendientes() {
    try {
      const perfil = await Auth.obtenerPerfilSesion();
      if (!perfil) return;
      const rol = String(perfil.rol || '').toLowerCase();
      if (rol !== 'docente' && !Auth.esDireccion(perfil.rol)) return;
      let q = supabase.from('trayectos').select('id, ciclo_lectivo');
      if (rol === 'docente') {
        const sup = window.Trayectos ? Object.keys(await Trayectos.misSuplencias(perfil.dni)).map(Number) : [];
        const dniD = String(perfil.dni || '').replace(/[^0-9A-Za-z_-]/g, '');
        q = sup.length ? q.or(`docente_user.eq.${dniD},id.in.(${sup.join(',')})`) : q.eq('docente_user', dniD);
      }
      const { data: tr } = await q;
      const anio = String(new Date().getFullYear());
      const ids = (tr || []).filter(t => String(t.ciclo_lectivo || anio) === anio).map(t => Number(t.id));
      if (!ids.length) return this.actualizarContador(0);
      const { data: cl } = await ReglasFP.enLotes(ids, p => supabase.from('clases').select('*').in('trayecto_id', p).order('id'));
      const cids = (cl || []).filter(c => c.calificable !== false && c.tipo !== 'encuesta').map(c => c.id);
      if (!cids.length) return this.actualizarContador(0);
      const { data: en } = await ReglasFP.enLotes(cids, p => supabase.from('entregas_actividades').select('id, nota').in('clase_id', p).order('id'));
      this.actualizarContador((en || []).filter(e => this.sinNota(e)).length);
    } catch (e) { /* el contador es opcional */ }
  }
};
window.SeguimientoModulo = SeguimientoModulo;
