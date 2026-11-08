/* ==========================================================================
   DASHBOARD DE INTELIGENCIA DE DATOS (embudo + panel institucional) — Dirección/Regencia.
   Solo lee datos que la plataforma ya tiene: trayectos, inscripciones, preinscripciones,
   asistencias, datos_estudiante, licencias, cooperadora y EPS. No escribe nada.
   Las áreas sin permiso (p. ej. la Regencia no ve Cooperadora) se ocultan solas.
   ========================================================================== */
const InteligenciaModulo = {
  area: 'todo', d: null, cargando: false,

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  pct(a, b) { return b > 0 ? Math.round(1000 * a / b) / 10 : null; },
  fp(p) { return p == null ? '–' : String(p).replace('.', ',') + ' %'; },
  money(n) { const v = Math.round(Number(n || 0)); return `<span style="white-space:nowrap">${v < 0 ? '-' : ''}$ ${Math.abs(v).toLocaleString('es-AR')}</span>`; },
  ciclo() { const s = document.getElementById('filtro-ciclo-dashboard'); return s ? s.value : String(new Date().getFullYear()); },

  async pagina(tabla, cols, filtro) {
    const out = [];
    for (let i = 0; i < 60; i++) {
      let q = supabase.from(tabla).select(cols).range(i * 1000, i * 1000 + 999);
      if (filtro) q = filtro(q);
      const r = await q;
      if (r.error) return { error: r.error, data: out };
      out.push(...(r.data || []));
      if ((r.data || []).length < 1000) break;
    }
    return { data: out };
  },

  async cargar() {
    const cont = document.getElementById('intel-contenido');
    if (!cont) return;
    if (this.d && Date.now() - this.t < 60000) { this.render(); return; }
    if (this.cargando) return;
    this.cargando = true;
    cont.innerHTML = '<p class="seg-cargando">Analizando datos…</p>';
    try {
      const op = p => p.then(r => (r && !r.error ? r.data || [] : null), () => null);
      const [tray, insc, pre, asis, dat, lic, mov, epsE, epsA, doc] = await Promise.all([
        op(supabase.from('trayectos').select('id,nombre,ciclo_lectivo,docente_user,horario_dias')),
        op(supabase.from('inscripciones').select('estudiante_user,trayecto_id,estado,num_egresado,fecha_inscripcion,fecha_baja,motivo_baja,baja_tipo')),
        op(supabase.from('preinscripciones').select('ciclo,estado,trayecto_id')),
        this.pagina('asistencias', 'trayecto_id,estudiante_user,fecha,estado').then(r => r.error ? null : r.data),
        op(supabase.from('datos_estudiante').select('dni,localidad,fecha_nacimiento')),
        op(supabase.from('licencias_docentes').select('tipo,desde,hasta,docente_id')),
        op(supabase.from('cooperadora_movimientos').select('fecha,tipo,monto')),
        op(supabase.from('eps_estudiantes').select('id,estado')),
        op(supabase.from('eps_asistencia').select('mes,dias_clase,presentes')),
        op(supabase.from('profiles').select('id').eq('rol', 'docente'))
      ]);
      this.d = { tray: tray || [], insc: insc || [], pre, asis: asis || [], dat: dat || [], lic, mov, epsE, epsA, doc };
      this.t = Date.now();
      this.render();
    } catch (e) {
      console.error('Inteligencia:', e);
      cont.innerHTML = `<div class="prog-vacio">No se pudo armar el análisis.<br><small>${this.esc(e.message || '')}</small></div>`;
    } finally { this.cargando = false; }
  },

  /* ---------- cálculo por ciclo ---------- */
  calc(ciclo) {
    const d = this.d, todos = ciclo === 'TODOS';
    const tr = d.tray.filter(t => todos || String(t.ciclo_lectivo || '2026') === String(ciclo));
    const ids = new Set(tr.map(t => String(t.id)));
    const ins = d.insc.filter(i => ids.has(String(i.trayecto_id)));
    const baja = i => String(i.estado || '').toUpperCase() === 'BAJA';
    const apr = i => !!(i.num_egresado && String(i.num_egresado).trim());
    const as = d.asis.filter(a => ids.has(String(a.trayecto_id)));
    const pres = a => { const e = String(a.estado || '').toLowerCase(); return e === 'presente' || e === 'tarde'; };
    const pre = d.pre ? d.pre.filter(p => todos || String(p.ciclo) === String(ciclo)) : null;
    const porT = tr.map(t => {
      const i = ins.filter(x => String(x.trayecto_id) === String(t.id)), a = as.filter(x => String(x.trayecto_id) === String(t.id));
      const b = i.filter(baja).length, ap = i.filter(apr).length;
      return { id: t.id, nombre: t.nombre || 'Sin nombre', insc: i.length, bajas: b, bajaPct: this.pct(b, i.length), aprob: ap, aprobPct: this.pct(ap, i.length),
        asis: this.pct(a.filter(pres).length, a.length), sinDocente: !String(t.docente_user || '').trim() };
    }).filter(x => x.insc > 0 || true).sort((x, y) => (y.bajaPct ?? -1) - (x.bajaPct ?? -1));
    return { tr, ins, pre, porT, n: ins.length, bajas: ins.filter(baja).length, aprob: ins.filter(apr).length, asis: this.pct(as.filter(pres).length, as.length), nAsis: as.length,
      perm: ins.filter(i => !baja(i)).length };
  },

  prevCiclo(c) { return /^\d{4}$/.test(c) ? String(Number(c) - 1) : null; },

  delta(act, ant, pts) {
    if (act == null || ant == null) return '<small style="color:var(--text-muted)">sin ciclo anterior para comparar</small>';
    const dif = Math.round((act - ant) * 10) / 10;
    if (dif === 0) return '<small style="color:var(--text-muted)">= igual que el ciclo anterior</small>';
    return `<small style="color:${dif > 0 ? '#146B47' : '#B42318'}">${dif > 0 ? '▲' : '▼'} ${Math.abs(dif).toString().replace('.', ',')}${pts ? ' pts' : ''} vs ciclo anterior</small>`;
  },

  /* ---------- resumen en palabras ---------- */
  resumen(c, p) {
    const f = [], d = this.d;
    if (c.n) {
      f.push(`En ${this.ciclo() === 'TODOS' ? 'todos los ciclos' : 'el ciclo ' + this.ciclo()} hay <b>${c.n} inscripci${c.n === 1 ? 'ón' : 'ones'}</b> en ${c.tr.length} trayecto${c.tr.length === 1 ? '' : 's'}; <b>${c.perm}</b> ${c.perm === 1 ? 'sigue' : 'siguen'} cursando y <b>${c.aprob}</b> ${c.aprob === 1 ? 'ya tiene' : 'ya tienen'} certificación.`);
      const ret = this.pct(c.perm, c.n);
      if (p && p.n) { const rp = this.pct(p.perm, p.n); f.push(`La retención es del <b>${this.fp(ret)}</b>${rp != null ? ` (ciclo anterior: ${this.fp(rp)})` : ''}.`); }
      else f.push(`La retención es del <b>${this.fp(ret)}</b>.`);
      const peor = c.porT.filter(x => x.insc >= 5).sort((a, b) => (b.bajaPct ?? 0) - (a.bajaPct ?? 0))[0];
      if (peor && peor.bajaPct > 0) f.push(`El trayecto con más pérdida es <b>${this.esc(peor.nombre)}</b>: ${peor.bajas} bajas sobre ${peor.insc} inscriptos (${this.fp(peor.bajaPct)}).`);
      if (c.asis != null) f.push(`La asistencia media es del <b>${this.fp(c.asis)}</b>${p && p.asis != null ? ` (ciclo anterior: ${this.fp(p.asis)})` : ''}.`);
      const sd = c.porT.filter(x => x.sinDocente).length;
      if (sd) f.push(`Hay <b>${sd}</b> trayecto${sd > 1 ? 's' : ''} sin docente asignado.`);
    } else f.push('No hay inscripciones en este ciclo para analizar.');
    if (d.pre) { const pend = d.pre.filter(x => x.estado === 'pendiente').length; if (pend) f.push(`Hay <b>${pend}</b> preinscripciones pendientes de resolver.`); }
    return f;
  },

  /* ---------- vistas ---------- */
  fila(et, v) { return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;padding:3px 0;border-bottom:1px solid #EEF3F6;font-size:.88rem"><span>${et}</span><b style="white-space:nowrap">${v}</b></div>`; },
  bloque(titulo, cuerpo, ayuda) { return `<div class="card-panel intel-bloque"><div class="card-panel-header"><h4 style="margin:0">${titulo}</h4></div><div class="intel-cuerpo">${cuerpo}</div>${ayuda ? `<small class="intel-nota">${ayuda}</small>` : ''}</div>`; },
  barra(rot, n, max, col) { return `<div style="margin:5px 0"><div style="display:flex;justify-content:space-between;font-size:.82rem"><span>${this.esc(rot)}</span><b>${n}</b></div><div style="background:#E5EEF3;border-radius:4px;height:8px"><div style="width:${max ? Math.round(100 * n / max) : 0}%;background:${col || '#3FA7E0'};height:8px;border-radius:4px"></div></div></div>`; },

  indicadores(c, p) {
    const ret = this.pct(c.perm, c.n), rp = p ? this.pct(p.perm, p.n) : null, eg = this.pct(c.aprob, c.n), ep = p ? this.pct(p.aprob, p.n) : null;
    const t = (tit, val, dl) => `<div class="stat-card intel-stat"><h4>${tit}</h4><p class="stat-value">${val}</p>${dl}</div>`;
    return `<div class="intel-grid" style="margin-bottom:12px">
      ${t('Matrícula', c.n, this.delta(c.n, p && p.n ? p.n : null, false))}
      ${t('Retención', this.fp(ret), this.delta(ret, rp, true))}
      ${t('Asistencia media', this.fp(c.asis), this.delta(c.asis, p ? p.asis : null, true))}
      ${t('Certificación', this.fp(eg), this.delta(eg, ep, true))}</div>`;
  },

  embudo(c) {
    const pre = c.pre, pasos = [];
    if (pre && pre.length) { pasos.push(['Preinscriptos', pre.length]); pasos.push(['Preinscripciones confirmadas', pre.filter(x => x.estado === 'confirmada').length]); }
    pasos.push(['Inscriptos', c.n], ['Siguen cursando (sin baja)', c.perm], ['Con certificación', c.aprob]);
    const max = Math.max(1, ...pasos.map(x => x[1]));
    const filas = pasos.map(([n, v], i) => {
      const ant = i ? pasos[i - 1][1] : null, pc = ant && v <= ant ? this.pct(v, ant) : null;
      return `<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:.85rem"><span>${n}</span><span><b>${v}</b>${pc != null ? ` <small style="color:var(--text-muted)">· ${this.fp(pc)} del paso anterior${100 - pc > 0 ? ` (se pierde ${this.fp(Math.round((100 - pc) * 10) / 10)})` : ''}</small>` : ''}</span></div>
        <div style="background:#E5EEF3;border-radius:6px;height:16px"><div style="width:${Math.round(100 * v / max)}%;background:linear-gradient(90deg,#3FA7E0,#1D5FA8);height:16px;border-radius:6px"></div></div></div>`;
    }).join('');
    return this.bloque('Embudo: de la preinscripción al certificado', filas, 'No todas las personas pasan por preinscripción, por eso algunos pasos pueden superar al anterior (en ese caso no se calcula el porcentaje).');
  },

  tablaTrayectos(c) {
    const col = v => v == null ? '#94a3b8' : v >= 30 ? '#B42318' : v >= 15 ? '#B7791F' : '#146B47';
    const filas = c.porT.map(x => `<tr><td><span style="color:${col(x.bajaPct)}">●</span> ${this.esc(x.nombre)}</td><td>${x.insc}</td><td>${x.bajas} (${this.fp(x.bajaPct)})</td><td>${this.fp(x.asis)}</td><td>${x.aprob} (${this.fp(x.aprobPct)})</td></tr>`).join('');
    return this.bloque('Comparación entre trayectos', `<div style="overflow-x:auto"><table class="tabla-simple intel-t" style="width:100%"><thead><tr><th>Trayecto</th><th>Inscriptos</th><th>Bajas</th><th>Asistencia</th><th>Certificados</th></tr></thead><tbody>${filas || '<tr><td colspan="5">Sin trayectos.</td></tr>'}</tbody></table></div>`,
      'Ordenado por mayor pérdida. Punto: rojo = 30 % o más de bajas, ámbar = 15 % o más, verde = menos de 15 %.');
  },

  bajasMotivo(c) {
    const b = c.ins.filter(i => String(i.estado || '').toUpperCase() === 'BAJA');
    if (!b.length) return this.bloque('Por qué se van', '<p style="font-size:.85rem">No hay bajas registradas.</p>');
    const m = {}; b.forEach(i => { const k = (String(i.motivo_baja || '').trim() || 'Sin motivo cargado').slice(0, 60); m[k] = (m[k] || 0) + 1; });
    const top = Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 6), max = top[0][1];
    const auto = b.filter(i => i.baja_tipo === 'automatica').length;
    return this.bloque('Por qué se van', top.map(([k, n]) => this.barra(k, n, max, '#E07A5F')).join('') + `<small style="color:var(--text-muted)">${auto} baja${auto === 1 ? '' : 's'} automática${auto === 1 ? '' : 's'} por inasistencia y ${b.length - auto} manual${b.length - auto === 1 ? '' : 'es'}.</small>`);
  },

  quienes(c) {
    const dat = {}; this.d.dat.forEach(x => { dat[String(x.dni)] = x; });
    const hoy = new Date();
    const edad = x => { if (!x || !x.fecha_nacimiento) return null; const n = new Date(x.fecha_nacimiento); return Math.floor((hoy - n) / 31557600000); };
    const franja = e => e == null ? null : e < 18 ? 'Menos de 18' : e < 30 ? '18 a 29' : e < 45 ? '30 a 44' : '45 o más';
    const grupos = {}, loc = {};
    const sumar = (o, k, i) => { if (!k) return; o[k] = o[k] || { n: 0, baja: 0 }; o[k].n++; if (String(i.estado || '').toUpperCase() === 'BAJA') o[k].baja++; };
    c.ins.forEach(i => { const x = dat[String(i.estudiante_user)]; sumar(grupos, franja(edad(x)), i); sumar(loc, x && x.localidad ? String(x.localidad).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ') : null, i); });
    const orden = ['Menos de 18', '18 a 29', '30 a 44', '45 o más'];
    const fila = (k, v) => `<tr><td>${this.esc(k)}</td><td>${v.n}</td><td>${v.baja} (${this.fp(this.pct(v.baja, v.n))})</td></tr>`;
    const tl = Object.entries(loc).sort((a, b) => b[1].n - a[1].n).slice(0, 6);
    const sinDatos = !Object.keys(grupos).length && !tl.length;
    const cuerpo = sinDatos ? '<p style="font-size:.85rem">Todavía no hay datos de edad ni de localidad cargados para cruzar.</p>' :
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px"><div><b style="font-size:.85rem">Por edad</b><table class="tabla-simple intel-t" style="width:100%"><thead><tr><th>Franja</th><th>Inscr.</th><th>Bajas</th></tr></thead><tbody>${orden.filter(k => grupos[k]).map(k => fila(k, grupos[k])).join('')}</tbody></table></div>
      <div><b style="font-size:.85rem">Por localidad (las 6 más numerosas)</b><table class="tabla-simple intel-t" style="width:100%"><thead><tr><th>Localidad</th><th>Inscr.</th><th>Bajas</th></tr></thead><tbody>${tl.map(([k, v]) => fila(k, v)).join('')}</tbody></table></div></div>`;
    return this.bloque('Quiénes son y a quiénes se pierde', cuerpo, 'Cruza los datos personales de la ficha con las bajas. Si una persona no tiene la ficha completa, no entra en el cruce.');
  },

  institucional(ciclo) {
    const d = this.d, anio = /^\d{4}$/.test(ciclo) ? Number(ciclo) : new Date().getFullYear(), tarj = [];
    const dias = (a, b) => { let n = 0; const x = new Date(a + 'T00:00:00Z'), y = new Date(b + 'T00:00:00Z'); for (; x <= y; x.setUTCDate(x.getUTCDate() + 1)) { const w = x.getUTCDay(); if (w && w < 6) n++; } return n; };
    if (d.lic) {
      const l = d.lic.filter(x => String(x.desde).startsWith(String(anio)));
      const por = {}; l.forEach(x => { por[x.tipo] = (por[x.tipo] || 0) + dias(String(x.desde).slice(0, 10), String(x.hasta).slice(0, 10)); });
      const nom = { administrativa: 'administrativas', medica: 'médicas', paro: 'de paro' };
      tarj.push(this.bloque('Docentes: licencias ' + anio, `<p style="font-size:1.5rem;line-height:1.2;margin:0 0 6px"><b>${l.length}</b> <small>licencias y paros</small></p><p style="font-size:.85rem">${Object.entries(por).map(([k, v]) => `${v} días hábiles ${nom[k] || k}`).join(' · ') || 'Sin licencias cargadas.'}</p>`, 'Los días son lunes a viernes, sin descontar feriados. El detalle exacto está en Licencias docentes.'));
    }
    if (d.mov) {
      const ini = `${anio}-05-01`, fin = `${anio + 1}-04-30`;
      const m = d.mov.filter(x => String(x.fecha).slice(0, 10) >= ini && String(x.fecha).slice(0, 10) <= fin);
      const ent = m.filter(x => x.tipo === 'entrada').reduce((s, x) => s + Number(x.monto), 0), sal = m.filter(x => x.tipo === 'salida').reduce((s, x) => s + Number(x.monto), 0);
      tarj.push(this.bloque(`Cooperadora: ejercicio ${anio}/${anio + 1}`, this.fila('Ingresos', this.money(ent)) + this.fila('Egresos', this.money(sal)) + this.fila('Resultado', `<span style="color:${ent - sal >= 0 ? '#146B47' : '#B42318'}">${this.money(ent - sal)}</span>`), 'No incluye el saldo del ejercicio anterior; el saldo total está en Cooperadora → Balance.'));
    }
    if (d.epsE) {
      const act = d.epsE.filter(e => e.estado === 'activo').length;
      const a = (d.epsA || []).filter(x => String(x.mes).startsWith(String(anio) + '-')), dd = a.reduce((s, x) => s + x.dias_clase, 0);
      tarj.push(this.bloque('EPS (estudiantes desvinculados)', `<p style="font-size:1.5rem;line-height:1.2;margin:0 0 6px"><b>${act}</b> <small>estudiantes activos</small></p><p style="font-size:.85rem">Asistencia media ${anio}: <b>${this.fp(this.pct(a.reduce((s, x) => s + x.presentes, 0), dd))}</b></p>`, 'Se cuenta aparte de la matrícula de FP. Detalle en la sección EPS.'));
    }
    const sd = this.d.tray.filter(t => (ciclo === 'TODOS' || String(t.ciclo_lectivo || '2026') === String(ciclo)) && !String(t.docente_user || '').trim()).length;
    const sh = this.d.tray.filter(t => (ciclo === 'TODOS' || String(t.ciclo_lectivo || '2026') === String(ciclo)) && !(t.horario_dias && Object.keys(t.horario_dias).length)).length;
    tarj.push(this.bloque('Personal y organización', this.fila('Docentes con cuenta', d.doc ? d.doc.length : '–') + this.fila('Trayectos sin docente', sd) + this.fila('Trayectos sin días de cursada', sh), 'Sin días de cursada no se pueden calcular los días de clase afectados por licencias.'));
    return `<div class="intel-grid">${tarj.join('')}</div>`;
  },

  render() {
    const cont = document.getElementById('intel-contenido');
    if (!cont || !this.d) return;
    const ciclo = this.ciclo(), c = this.calc(ciclo), pv = this.prevCiclo(ciclo), p = pv ? this.calc(pv) : null, A = this.area;
    const areas = [['todo', 'Todo'], ['fp', 'Formación Profesional'], ['eps', 'EPS'], ['doc', 'Docentes'], ['coop', 'Cooperadora']];
    const fpv = A === 'todo' || A === 'fp', inst = A !== 'fp';
    this.ult = { c, p, ciclo };
    cont.innerHTML = `<div class="card-panel" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">🧠 Análisis inteligente — ${ciclo === 'TODOS' ? 'todos los ciclos' : 'ciclo ' + ciclo}</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn-secondary" style="padding:.3rem .7rem;font-size:.8rem" onclick="InteligenciaModulo.exportar()">⬇️ Excel</button><button class="btn-secondary" style="padding:.3rem .7rem;font-size:.8rem" onclick="InteligenciaModulo.imprimir()">🖨️ Informe / PDF</button></div></div>
      <ul style="margin:10px 0 0;padding-left:18px;font-size:.9rem;line-height:1.5">${this.resumen(c, p).map(x => `<li>${x}</li>`).join('')}</ul></div>
      <div class="plan-tabs">${areas.map(([id, et]) => `<button type="button" class="plan-tab ${A === id ? 'activo' : ''}" onclick="InteligenciaModulo.area='${id}';InteligenciaModulo.render()">${et}</button>`).join('')}</div>
      ${fpv ? this.indicadores(c, p) + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px">${this.embudo(c)}${this.bajasMotivo(c)}</div><div style="margin-top:12px">${this.tablaTrayectos(c)}</div><div style="margin-top:12px">${this.quienes(c)}</div>` : ''}
      ${inst ? `<div style="margin-top:12px">${this.institucional(ciclo)}</div>` : ''}
      ${c.nAsis >= 50000 ? '<small>Asistencia calculada sobre los primeros 60.000 registros.</small>' : ''}`;
    let st = document.getElementById('intel-estilo'); if (!st) { st = document.createElement('style'); st.id = 'intel-estilo'; document.head.appendChild(st); }
    st.textContent = `.intel-bloque{margin:0;display:flex;flex-direction:column;height:100%;box-sizing:border-box}.intel-cuerpo{flex:0 0 auto}.intel-cuerpo p{margin:0 0 6px}.intel-nota{color:var(--text-muted);display:block;margin-top:auto;padding-top:8px;font-size:.78rem;line-height:1.35}
      .intel-t{table-layout:auto;border-collapse:collapse}.intel-t th,.intel-t td{text-align:center;padding:6px 8px;vertical-align:middle;white-space:nowrap}.intel-t th:first-child,.intel-t td:first-child{text-align:left;white-space:normal;width:40%}
      .intel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;align-items:stretch}.intel-stat{display:flex;flex-direction:column;gap:4px;min-height:96px}.intel-stat h4,.intel-stat .stat-value{margin:0}
      @media print{.sidebar,header,.plan-tabs,button{display:none!important}}`;
  },

  /* ---------- exportar ---------- */
  async exportar() {
    if (typeof ExcelJS === 'undefined') return Swal.fire('Excel no disponible', 'No se cargó la librería de Excel.', 'error');
    const { c, p, ciclo } = this.ult, wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Indicadores');
    ws.columns = [{ width: 36 }, { width: 18 }, { width: 18 }];
    ws.addRow(['Análisis de datos — ' + (ciclo === 'TODOS' ? 'todos los ciclos' : 'ciclo ' + ciclo)]).font = { bold: true };
    ws.addRow(['Indicador', 'Actual', 'Ciclo anterior']).font = { bold: true };
    ws.addRow(['Matrícula', c.n, p ? p.n : '']); ws.addRow(['Siguen cursando', c.perm, p ? p.perm : '']); ws.addRow(['Retención (%)', this.pct(c.perm, c.n) ?? '', p ? this.pct(p.perm, p.n) ?? '' : '']);
    ws.addRow(['Asistencia media (%)', c.asis ?? '', p ? p.asis ?? '' : '']); ws.addRow(['Con certificación', c.aprob, p ? p.aprob : '']); ws.addRow([]);
    this.resumen(c, p).forEach(t => ws.addRow([t.replace(/<[^>]+>/g, '')]));
    const w2 = wb.addWorksheet('Trayectos'); w2.columns = [{ width: 40 }, ...Array(6).fill({ width: 16 })];
    w2.addRow(['Trayecto', 'Inscriptos', 'Bajas', 'Bajas (%)', 'Asistencia (%)', 'Certificados', 'Certificados (%)']).font = { bold: true };
    c.porT.forEach(x => w2.addRow([x.nombre, x.insc, x.bajas, x.bajaPct ?? '', x.asis ?? '', x.aprob, x.aprobPct ?? '']));
    const buf = await wb.xlsx.writeBuffer(), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf])); a.download = `analisis_${ciclo}.xlsx`; a.click();
  },
  imprimir() {
    const cont = document.getElementById('intel-contenido'); if (!cont) return;
    const w = window.open('', '_blank'); if (!w) return Swal.fire('Ventana bloqueada', 'Permití ventanas emergentes para generar el informe.', 'info');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Informe de análisis</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#102a43}.card-panel,.stat-card{border:1px solid #cfe0ea;border-radius:8px;padding:10px;margin:8px 0}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border-bottom:1px solid #e1ebf1;padding:4px;text-align:left}.plan-tabs,button{display:none}h3,h4{margin:4px 0}.stat-value{font-size:22px;font-weight:700;margin:0}</style></head><body><h2>CFP — Informe de análisis de datos</h2><p>${new Date().toLocaleDateString('es-AR')}</p>${cont.innerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  }
};
window.InteligenciaModulo = InteligenciaModulo;
