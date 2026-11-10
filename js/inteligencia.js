/* ==========================================================================
   DASHBOARD DE INTELIGENCIA DE DATOS — Dirección y Secretaría.
   Solo lee datos que la plataforma ya tiene: trayectos, inscripciones, preinscripciones,
   asistencias, días sin clase, datos_estudiante, perfiles, licencias, cooperadora y EPS.
   No escribe nada. Las áreas sin permiso o sin tabla se ocultan solas.
   Áreas: Todo · Formación Profesional · Alertas · EPS · Docentes · Cooperadora · Calidad de datos.
   El análisis por docente y por sector lo ve solo la Dirección (rol admin).
   ========================================================================== */
const InteligenciaModulo = {
  area: 'todo', d: null, cargando: false, t: 0, pend: {}, pendCargando: {}, verTodasAlertas: false,
  LIMITE_ASIS: 60000,
  RES: { contactado: 'contactado', no_responde: 'no responde', vuelve: 'dice que vuelve', abandona: 'dice que abandona', otro: 'contactado' },

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  pct(a, b) { return b > 0 ? Math.round(1000 * a / b) / 10 : null; },
  fp(p) { return p == null ? '–' : String(p).replace('.', ',') + ' %'; },
  money(n) { const v = Math.round(Number(n || 0)); return `<span style="white-space:nowrap">${v < 0 ? '-' : ''}$ ${Math.abs(v).toLocaleString('es-AR')}</span>`; },
  ciclo() { const s = document.getElementById('filtro-ciclo-dashboard'); return s ? s.value : String(new Date().getFullYear()); },
  hoy() { return window.ReglasFP && ReglasFP.hoyISO ? ReglasFP.hoyISO() : new Date().toISOString().slice(0, 10); },
  anioActual() { return Number(this.hoy().slice(0, 4)); },
  f10(x) { return x ? String(x).slice(0, 10) : ''; },
  fecha(x) { return x ? this.f10(x).split('-').reverse().join('/') : '–'; },
  cicloDe(t) { return String(t.ciclo_lectivo || this.anioActual()); },
  esBaja(i) { return String(i.estado || '').toUpperCase() === 'BAJA'; },
  esApr(i) { return !!(i.num_egresado && String(i.num_egresado).trim()); },
  esPres(a) { const e = String(a.estado || '').toLowerCase(); return e === 'presente' || e === 'tarde'; },
  soloDireccion() {
    const r = String((window.usuarioActual || (window.Auth && Auth.usuarioActual) || {}).rol || '').toLowerCase().trim();
    return r === 'admin' || r === 'administrador';
  },
  nombre(dni) {
    const p = this.d && this.d.perIdx[String(dni)];
    if (!p) return dni ? 'DNI ' + dni : 'Sin asignar';
    return [p.apellido, p.nombre].filter(Boolean).join(', ') || 'DNI ' + dni;
  },

  /* Lee una tabla completa de a 1000 filas (Supabase no entrega más por consulta). */
  async pagina(tabla, cols, filtro, maxPag = 60) {
    const out = [];
    for (let i = 0; i < maxPag; i++) {
      let q = supabase.from(tabla).select(cols).range(i * 1000, i * 1000 + 999);
      if (filtro) q = filtro(q);
      const r = await q;
      if (r.error) return { error: r.error, data: out };
      out.push(...(r.data || []));
      if ((r.data || []).length < 1000) return { data: out, completo: true };
    }
    return { data: out, completo: false };
  },

  async cargar() {
    const cont = document.getElementById('intel-contenido');
    if (!cont) return;
    if (this.d && Date.now() - this.t < 60000) { this.render(); return; }
    if (this.cargando) return;
    this.cargando = true;
    cont.innerHTML = '<p class="seg-cargando">Analizando datos…</p>';
    try {
      const op = (tabla, cols, filtro) => this.pagina(tabla, cols, filtro).then(r => (r.error && !r.data.length ? null : r.data), () => null);
      const [tray, insc, pre, asisR, dat, per, sinClase, lic, mov, epsE, epsA, cont] = await Promise.all([
        op('trayectos', 'id,nombre,sector,ciclo_lectivo,docente_user,horario_dias,computa_asistencia,fecha_inicio,fecha_cierre'),
        op('inscripciones', 'id,estudiante_user,trayecto_id,estado,num_egresado,fecha_inscripcion,fecha_baja,motivo_baja,baja_tipo', q => q.order('id')),
        op('preinscripciones', 'ciclo,estado,trayecto_id,created_at'),
        this.pagina('asistencias', 'id,trayecto_id,estudiante_user,fecha,estado', q => q.order('id'), this.LIMITE_ASIS / 1000).catch(() => ({ data: [], completo: true })),
        op('datos_estudiante', 'dni,localidad,fecha_nacimiento,telefono'),
        op('profiles', 'dni,nombre,apellido,rol'),
        op('dias_sin_clase', 'trayecto_id,fecha'),
        op('licencias_docentes', 'tipo,desde,hasta,docente_id'),
        op('cooperadora_movimientos', 'fecha,tipo,monto'),
        op('eps_estudiantes', 'id,estado'),
        op('eps_asistencia', 'mes,dias_clase,presentes'),
        op('seguimiento_contactos', 'trayecto_id,estudiante_user,fecha,tipo,resultado')
      ]);
      const perIdx = {}; (per || []).forEach(p => { perIdx[String(p.dni)] = p; });
      const datIdx = {}; (dat || []).forEach(x => { datIdx[String(x.dni)] = x; });
      this.d = {
        tray: tray || [], insc: insc || [], pre, asis: asisR.data || [], asisCompleta: asisR.completo !== false,
        dat: dat || [], datIdx, per: per || [], perIdx, sinClase: sinClase || [], lic, mov, epsE, epsA, cont,
        doc: per ? per.filter(p => String(p.rol || '').toLowerCase() === 'docente') : null
      };
      this.t = Date.now();
      this.completarCiclos();
      this.render();
    } catch (e) {
      console.error('Inteligencia:', e);
      cont.innerHTML = `<div class="prog-vacio">No se pudo armar el análisis.<br><small>${this.esc(e.message || '')}</small></div>`;
    } finally { this.cargando = false; }
  },

  /* El selector traía solo 2026 y 2027: se agregan los ciclos que tienen trayectos (sin tocar el elegido). */
  completarCiclos() {
    const s = document.getElementById('filtro-ciclo-dashboard');
    if (!s) return;
    const hay = new Set([...s.options].map(o => o.value));
    const anios = [...new Set(this.d.tray.map(t => this.cicloDe(t)).concat(String(this.anioActual())))].filter(a => /^\d{4}$/.test(a) && !hay.has(a)).sort();
    anios.forEach(a => {
      const o = document.createElement('option'); o.value = a; o.textContent = 'Ciclo Lectivo ' + a;
      const sig = [...s.options].find(x => x.value === 'TODOS' || (/^\d{4}$/.test(x.value) && x.value > a));
      s.insertBefore(o, sig || null);
    });
  },

  /* ---------- cálculo por ciclo (corte = fecha límite opcional para comparar "a la misma fecha") ---------- */
  calc(ciclo, corte) {
    const d = this.d, todos = ciclo === 'TODOS';
    const tr = d.tray.filter(t => todos || this.cicloDe(t) === String(ciclo));
    const tIdx = {}; tr.forEach(t => { tIdx[String(t.id)] = t; });
    const hasta = x => !corte || !x || this.f10(x) <= corte;
    const ins = d.insc.filter(i => tIdx[String(i.trayecto_id)] && hasta(i.fecha_inscripcion));
    const baja = i => this.esBaja(i) && (!corte || !i.fecha_baja || this.f10(i.fecha_baja) <= corte);
    const as = d.asis.filter(a => { const t = tIdx[String(a.trayecto_id)]; return t && t.computa_asistencia !== false && hasta(a.fecha); });
    const pre = d.pre ? d.pre.filter(p => (todos || String(p.ciclo) === String(ciclo)) && hasta(p.created_at)) : null;
    const insPorT = {}, asPorT = {};
    ins.forEach(i => { (insPorT[i.trayecto_id] = insPorT[i.trayecto_id] || []).push(i); });
    as.forEach(a => { (asPorT[a.trayecto_id] = asPorT[a.trayecto_id] || []).push(a); });
    const porT = tr.map(t => {
      const i = insPorT[t.id] || [], a = asPorT[t.id] || [];
      const b = i.filter(baja).length, ap = i.filter(x => this.esApr(x)).length;
      return { id: t.id, nombre: t.nombre || 'Sin nombre', sector: t.sector, docente: t.docente_user, insc: i.length, bajas: b, bajaPct: this.pct(b, i.length),
        aprob: ap, aprobPct: this.pct(ap, i.length), presentes: a.filter(x => this.esPres(x)).length, registros: a.length,
        asis: t.computa_asistencia === false ? null : this.pct(a.filter(x => this.esPres(x)).length, a.length), virtual: t.computa_asistencia === false,
        sinDocente: !String(t.docente_user || '').trim() };
    }).sort((x, y) => (y.bajaPct ?? -1) - (x.bajaPct ?? -1) || y.insc - x.insc);
    const nb = ins.filter(baja).length;
    return { tr, ins, pre, porT, corte, n: ins.length, bajas: nb, perm: ins.length - nb, aprob: ins.filter(x => this.esApr(x)).length,
      asis: this.pct(as.filter(x => this.esPres(x)).length, as.length), nAsis: as.length, as, baja };
  },

  prevCiclo(c) { return /^\d{4}$/.test(c) ? String(Number(c) - 1) : null; },
  /* Si el ciclo elegido es el del año en curso, el anterior se compara cortado en la misma fecha del año pasado. */
  comparacion(ciclo) {
    const pv = this.prevCiclo(ciclo);
    if (!pv || !this.d.tray.some(t => this.cicloDe(t) === pv)) return null;
    const enCurso = Number(ciclo) === this.anioActual();
    const corte = enCurso ? pv + this.hoy().slice(4) : null;
    return { ciclo: pv, corte, enCurso, c: this.calc(pv, corte) };
  },

  delta(act, ant, pts, cmp) {
    if (act == null || ant == null) return '<small style="color:var(--text-muted)">sin ciclo anterior para comparar</small>';
    const dif = Math.round((act - ant) * 10) / 10, cuando = cmp && cmp.enCurso ? `al ${this.fecha(cmp.corte).slice(0, 5)} de ${cmp.ciclo}` : 'ciclo anterior';
    if (dif === 0) return `<small style="color:var(--text-muted)">= igual que ${cuando}</small>`;
    return `<small style="color:${dif > 0 ? '#146B47' : '#B42318'}">${dif > 0 ? '▲' : '▼'} ${Math.abs(dif).toString().replace('.', ',')}${pts ? ' pts' : ''} vs ${cuando}</small>`;
  },

  /* ---------- bajas automáticas que todavía no se registraron (usa las mismas reglas que Seguimiento) ---------- */
  async cargarPendientes(ciclo) {
    if (ciclo === 'TODOS' || !window.ReglasFP || !ReglasFP.cargarSituacion) return;
    const p = this.pend[ciclo];
    if ((p && Date.now() - p.t < 300000) || this.pendCargando[ciclo]) return;
    this.pendCargando[ciclo] = true;
    try {
      const tr = this.d.tray.filter(t => this.cicloDe(t) === String(ciclo) && this.d.insc.some(i => String(i.trayecto_id) === String(t.id) && !this.esBaja(i)));
      const lista = [], cierres = {}, cola = tr.slice();
      const trabajar = async () => {
        while (cola.length) {
          const t = cola.shift();
          try {
            const s = await ReglasFP.cargarSituacion(t.id);
            Object.entries((s && s.alumnos) || {}).forEach(([dni, x]) => {
              if (x.cursada && x.cursada.baja && !x.cursada.guardada) lista.push({ dni, tid: t.id, trayecto: t.nombre, motivo: x.cursada.motivo });
              else if (!(x.cursada && x.cursada.baja) && ReglasFP.cierresProximos) {
                const cp = ReglasFP.cierresProximos(x.ev, s.modulos, 14);
                if (cp.length) cierres[t.id + '|' + dni] = cp;
              }
            });
          } catch (e) { console.warn('Bajas pendientes', t.id, e); }
        }
      };
      await Promise.all([trabajar(), trabajar(), trabajar()]);
      this.pend[ciclo] = { t: Date.now(), lista, cierres };
    } finally { this.pendCargando[ciclo] = false; }
    if (this.ciclo() === ciclo) this.render();
  },
  pendientes(ciclo) { const p = this.pend[ciclo]; return p ? p.lista : null; },

  /* ---------- alertas tempranas ---------- */
  alertas(ciclo) {
    if (ciclo === 'TODOS' || Number(ciclo) < this.anioActual()) return { lista: [], cerrado: true };
    const c = this.calc(ciclo), hoy = this.hoy();
    const tIdx = {}; c.tr.forEach(t => { tIdx[String(t.id)] = t; });
    const reg = {};
    c.as.forEach(a => {
      const k = a.trayecto_id + '|' + a.estudiante_user, f = this.f10(a.fecha);
      reg[k] = reg[k] || {};
      reg[k][f] = reg[k][f] || this.esPres(a);   // si hay varios módulos el mismo día, alcanza con un presente
    });
    const pend = {}; (this.pendientes(ciclo) || []).forEach(p => { pend[p.tid + '|' + p.dni] = p; });
    const cierres = (this.pend[ciclo] && this.pend[ciclo].cierres) || {};
    const ultCont = {}; (this.d.cont || []).forEach(x => { const k = x.trayecto_id + '|' + x.estudiante_user; if (!ultCont[k] || String(x.fecha) > String(ultCont[k].fecha)) ultCont[k] = x; });
    const lista = [];
    c.ins.filter(i => !this.esBaja(i)).forEach(i => {
      const t = tIdx[String(i.trayecto_id)];
      if (!t || (t.fecha_cierre && this.f10(t.fecha_cierre) < hoy)) return;
      const k = i.trayecto_id + '|' + i.estudiante_user, pb = pend[k];
      // Mismo criterio que Seguimiento (ReglasFP.riesgo). Acá no se miran las entregas: solo asistencia, cierres y bajas.
      const rr = ReglasFP.riesgo({ dias: Object.entries(reg[k] || {}), bajaPendiente: !!pb, cierres: pb ? [] : (cierres[k] || []) });
      if (!rr.nivel) return;
      const dat = this.d.datIdx[String(i.estudiante_user)] || {};
      lista.push({ dni: i.estudiante_user, nombre: this.nombre(i.estudiante_user), trayecto: t.nombre, tid: t.id, docente: this.nombre(t.docente_user),
        asis: rr.pct, seguidas: rr.seguidas, ultima: rr.ultima, tel: dat.telefono || '', motivos: rr.motivos, nivel: rr.nivel, detalleBaja: pb ? pb.motivo : '', contacto: ultCont[k] || null });
    });
    lista.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'alto' ? -1 : 1) || b.seguidas - a.seguidas || (a.asis ?? 101) - (b.asis ?? 101));
    return { lista, cerrado: false };
  },

  /* ---------- evolución mes a mes ---------- */
  evolucion(ciclo) {
    if (!/^\d{4}$/.test(ciclo)) return null;
    const hoy = this.hoy(), serie = (anio, limite) => {
      const tr = new Set(this.d.tray.filter(t => this.cicloDe(t) === String(anio)).map(t => String(t.id)));
      const virt = new Set(this.d.tray.filter(t => t.computa_asistencia === false).map(t => String(t.id)));
      const ins = this.d.insc.filter(i => tr.has(String(i.trayecto_id)));
      const as = this.d.asis.filter(a => tr.has(String(a.trayecto_id)) && !virt.has(String(a.trayecto_id)));
      const out = [];
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, '0'), fin = `${anio}-${mm}-31`, ini = `${anio}-${mm}-01`;
        if (limite && `${this.anioActual()}-${mm}-01` > hoy) { out.push({ m, act: null, asis: null }); continue; }
        const act = ins.filter(i => (!i.fecha_inscripcion || this.f10(i.fecha_inscripcion) <= fin) && !(this.esBaja(i) && i.fecha_baja && this.f10(i.fecha_baja) <= fin)).length;
        const a = as.filter(x => this.f10(x.fecha) >= ini && this.f10(x.fecha) <= fin);
        out.push({ m, act, asis: this.pct(a.filter(x => this.esPres(x)).length, a.length), nAs: a.length });
      }
      return out;
    };
    const act = serie(Number(ciclo), Number(ciclo) === this.anioActual()), pv = this.prevCiclo(ciclo);
    const tienePrev = this.d.tray.some(t => this.cicloDe(t) === pv);
    const prev = tienePrev ? serie(Number(pv), false) : null;
    // Se muestran los meses con datos en alguno de los dos ciclos (de marzo a diciembre como mínimo).
    let desde = 3, hastaM = 12;
    [act, prev].forEach(s => s && s.forEach(x => { if ((x.nAs || 0) > 0 && x.m < desde) desde = x.m; }));
    const recorte = s => s && s.filter(x => x.m >= desde && x.m <= hastaM);
    const sinFecha = this.d.insc.filter(i => this.esBaja(i) && !i.fecha_baja && this.d.tray.some(t => String(t.id) === String(i.trayecto_id) && this.cicloDe(t) === String(ciclo))).length;
    return { act: recorte(act), prev: recorte(prev), ciclo, pv, sinFecha };
  },

  grafico(titulo, ev, campo, fmt, unidad) {
    const MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const W = 340, H = 170, L = 36, R = 44, T = 12, B = 24, pw = W - L - R, ph = H - T - B;
    const series = [{ s: ev.act, et: ev.ciclo, col: '#1D5FA8', dash: '' }].concat(ev.prev ? [{ s: ev.prev, et: ev.pv, col: '#C26A1B', dash: '5 4' }] : []);
    const vals = series.flatMap(x => x.s.map(p => p[campo])).filter(v => v != null);
    if (!vals.length) return `<div><b style="font-size:.85rem">${titulo}</b><p style="font-size:.85rem;color:var(--text-muted)">Todavía no hay datos.</p></div>`;
    let max = unidad === '%' ? 100 : Math.max(1, ...vals), min = 0;
    if (unidad !== '%') { const paso = Math.pow(10, Math.floor(Math.log10(max))); max = Math.ceil(max / paso) * paso; }
    const n = ev.act.length, x = i => L + (n > 1 ? i * pw / (n - 1) : pw / 2), y = v => T + ph - (v - min) / (max - min) * ph;
    const grid = [0, 0.5, 1].map(f => { const v = min + f * (max - min), yy = y(v); return `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#E5EEF3" stroke-width="1"/><text x="${L - 6}" y="${yy + 3}" font-size="9" text-anchor="end" fill="#64748b">${fmt(v)}</text>`; }).join('');
    const ejeX = ev.act.map((p, i) => (n <= 6 || i % 2 === 0 || i === n - 1) ? `<text x="${x(i)}" y="${H - 6}" font-size="9" text-anchor="middle" fill="#64748b">${MES[p.m]}</text>` : '').join('');
    const finY = [];
    const lineas = series.map(({ s, et, col, dash }) => {
      const pts = s.map((p, i) => p[campo] == null ? null : [x(i), y(p[campo]), p]).filter(Boolean);
      if (!pts.length) return '';
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const marcas = pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${col}" stroke="#fff" stroke-width="2"><title>${MES[p[2].m]} ${et}: ${fmt(p[2][campo])}</title></circle><circle cx="${p[0]}" cy="${p[1]}" r="11" fill="transparent"><title>${MES[p[2].m]} ${et}: ${fmt(p[2][campo])}</title></circle>`).join('');
      const u = pts[pts.length - 1];
      let ly = u[1] + 3; finY.forEach(o => { if (Math.abs(o - ly) < 11) ly = o + (ly >= o ? 11 : -11); }); finY.push(ly);
      u[1] = ly - 3;
      return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="${dash}" stroke-linejoin="round"/>${marcas}<text x="${u[0] + 7}" y="${u[1] + 3}" font-size="9" fill="#334155">${et}</text>`;
    }).join('');
    const leyenda = series.map(({ et, col, dash }) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px"><svg width="18" height="6"><line x1="0" x2="18" y1="3" y2="3" stroke="${col}" stroke-width="2" stroke-dasharray="${dash}"/></svg>${et}</span>`).join('');
    return `<div><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:.8rem"><b style="font-size:.85rem">${titulo}</b><span>${leyenda}</span></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${this.esc(titulo)}" style="width:100%;height:auto;display:block">${grid}${ejeX}${lineas}</svg></div>`;
  },

  bloqueEvolucion(ciclo) {
    const ev = this.evolucion(ciclo);
    if (!ev) return this.bloque('Evolución mes a mes', '<p style="font-size:.85rem">Elegí un ciclo para ver la evolución mensual.</p>');
    const cuerpo = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px">
      ${this.grafico('Matrícula activa a fin de mes', ev, 'act', v => Math.round(v), '')}
      ${this.grafico('Asistencia del mes', ev, 'asis', v => Math.round(v) + ' %', '%')}</div>
      <details style="margin-top:6px;font-size:.8rem"><summary style="cursor:pointer">Ver como tabla</summary>${this.tablaEvol(ev)}</details>`;
    return this.bloque('Evolución mes a mes', cuerpo, `Línea llena: ciclo ${ev.ciclo}${ev.prev ? `; punteada: ciclo ${ev.pv}` : ''}. Pasá el mouse por los puntos para ver el valor.${ev.sinFecha ? ` ${ev.sinFecha} baja${ev.sinFecha > 1 ? 's' : ''} sin fecha no se pueden ubicar en el tiempo y figuran como activas.` : ''}`);
  },
  tablaEvol(ev) {
    const MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `<table class="tabla-simple intel-t" style="width:100%"><thead><tr><th>Mes</th><th>Activos ${ev.ciclo}</th><th>Asist. ${ev.ciclo}</th>${ev.prev ? `<th>Activos ${ev.pv}</th><th>Asist. ${ev.pv}</th>` : ''}</tr></thead><tbody>${ev.act.map((p, i) => `<tr><td>${MES[p.m]}</td><td>${p.act ?? '–'}</td><td>${this.fp(p.asis)}</td>${ev.prev ? `<td>${ev.prev[i].act ?? '–'}</td><td>${this.fp(ev.prev[i].asis)}</td>` : ''}</tr>`).join('')}</tbody></table>`;
  },

  /* ---------- calidad de datos ---------- */
  calidad(ciclo) {
    const c = this.calc(ciclo), hoy = this.hoy(), hace14 = new Date(Date.parse(hoy + 'T12:00:00Z') - 14 * 864e5).toISOString().slice(0, 10);
    const hace7 = new Date(Date.parse(hoy + 'T12:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
    const dnis = [...new Set(c.ins.map(i => String(i.estudiante_user)))];
    const conNac = dnis.filter(x => (this.d.datIdx[x] || {}).fecha_nacimiento).length, conLoc = dnis.filter(x => String((this.d.datIdx[x] || {}).localidad || '').trim()).length;
    const bajas = c.ins.filter(i => this.esBaja(i)), conMot = bajas.filter(i => String(i.motivo_baja || '').trim()).length;
    const actividad = {};
    this.d.asis.forEach(a => { const f = this.f10(a.fecha); if (f > (actividad[a.trayecto_id] || '')) actividad[a.trayecto_id] = f; });
    this.d.sinClase.forEach(a => { const f = this.f10(a.fecha); if (f > (actividad[a.trayecto_id] || '')) actividad[a.trayecto_id] = f; });
    const enCurso = c.tr.filter(t => t.computa_asistencia !== false && (!t.fecha_inicio || this.f10(t.fecha_inicio) <= hace14) && (t.fecha_cierre ? this.f10(t.fecha_cierre) >= hoy : this.cicloDe(t) === String(this.anioActual()))
      && c.ins.some(i => String(i.trayecto_id) === String(t.id) && !this.esBaja(i)));
    const atrasados = enCurso.filter(t => (actividad[t.id] || '') < hace14).map(t => ({ nombre: t.nombre, ultima: actividad[t.id] || null }));
    const preViejas = c.pre ? c.pre.filter(p => p.estado === 'pendiente' && this.f10(p.created_at) && this.f10(p.created_at) < hace7).length : null;
    const sinDias = c.tr.filter(t => !(t.horario_dias && Object.keys(t.horario_dias).length)).length;
    const items = [
      { et: 'Fichas con fecha de nacimiento', v: this.pct(conNac, dnis.length), det: `${conNac} de ${dnis.length}` },
      { et: 'Fichas con localidad', v: this.pct(conLoc, dnis.length), det: `${conLoc} de ${dnis.length}` },
      { et: 'Bajas con motivo cargado', v: this.pct(conMot, bajas.length), det: `${conMot} de ${bajas.length}` },
      { et: 'Trayectos en curso con asistencia al día (últimos 14 días)', v: this.pct(enCurso.length - atrasados.length, enCurso.length), det: `${enCurso.length - atrasados.length} de ${enCurso.length}` }
    ];
    const validos = items.filter(x => x.v != null), indice = validos.length ? Math.round(validos.reduce((s, x) => s + x.v, 0) / validos.length) : null;
    return { items, indice, atrasados, preViejas, sinDias, sinDocente: c.porT.filter(x => x.sinDocente).length, asisCompleta: this.d.asisCompleta };
  },
  estado(v) {
    if (v == null) return '<span style="color:#64748b">— sin datos</span>';
    return v >= 90 ? '<span style="color:#146B47">✔ Bien</span>' : v >= 70 ? '<span style="color:#B7791F">▲ Mejorable</span>' : '<span style="color:#B42318">✖ Incompleto</span>';
  },
  bloqueCalidad(ciclo, corto) {
    const q = this.calidad(ciclo);
    const filas = q.items.map(x => `<tr><td>${x.et}</td><td>${x.det}</td><td>${this.fp(x.v)}</td><td>${this.estado(x.v)}</td></tr>`).join('');
    const extra = [
      q.atrasados.length ? `<li><b>${q.atrasados.length}</b> trayecto${q.atrasados.length > 1 ? 's' : ''} en curso sin asistencia ni día sin clase cargado en las últimas 2 semanas: ${q.atrasados.map(t => `${this.esc(t.nombre)} <small>(última: ${this.fecha(t.ultima)})</small>`).join(', ')}.</li>` : '',
      q.preViejas ? `<li><b>${q.preViejas}</b> preinscripci${q.preViejas > 1 ? 'ones pendientes' : 'ón pendiente'} hace más de 7 días.</li>` : '',
      q.sinDocente ? `<li><b>${q.sinDocente}</b> trayecto${q.sinDocente > 1 ? 's' : ''} sin docente asignado.</li>` : '',
      q.sinDias ? `<li><b>${q.sinDias}</b> trayecto${q.sinDias > 1 ? 's' : ''} sin días de cursada cargados.</li>` : '',
      !q.asisCompleta ? `<li>La asistencia supera los ${this.LIMITE_ASIS.toLocaleString('es-AR')} registros: el análisis usa solo los primeros.</li>` : ''
    ].join('');
    const cuerpo = `<p style="font-size:1.4rem;margin:0 0 6px"><b>${q.indice == null ? '–' : q.indice + ' %'}</b> <small style="font-size:.85rem">completitud · ${this.estado(q.indice)}</small></p>
      ${corto ? '' : `<div style="overflow-x:auto"><table class="tabla-simple intel-t" style="width:100%"><thead><tr><th>Dato</th><th>Cargados</th><th>%</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table></div>`}
      ${extra ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:.85rem;line-height:1.45">${extra}</ul>` : '<p style="font-size:.85rem;margin-top:6px">No hay faltantes para resolver.</p>'}`;
    return this.bloque('Calidad de los datos', cuerpo, 'Mide cuánto se puede confiar en el resto del análisis. Lo que falta cargar aparece en los demás cuadros como «–» o queda fuera de los cruces.');
  },

  /* ---------- resumen en palabras ---------- */
  resumen(c, cmp, ciclo) {
    const f = [], p = cmp ? cmp.c : null;
    const cuando = cmp && cmp.enCurso ? `a esta altura de ${cmp.ciclo}` : 'ciclo anterior';
    if (c.n) {
      f.push(`En ${ciclo === 'TODOS' ? 'todos los ciclos' : 'el ciclo ' + ciclo} hay <b>${c.n} inscripci${c.n === 1 ? 'ón' : 'ones'}</b> en ${c.tr.length} trayecto${c.tr.length === 1 ? '' : 's'}; <b>${c.perm}</b> ${c.perm === 1 ? 'sigue' : 'siguen'} cursando y <b>${c.aprob}</b> ${c.aprob === 1 ? 'ya tiene' : 'ya tienen'} certificación.`);
      const ret = this.pct(c.perm, c.n), rp = p && p.n ? this.pct(p.perm, p.n) : null;
      f.push(`La retención es del <b>${this.fp(ret)}</b>${rp != null ? ` (${cuando}: ${this.fp(rp)})` : ''}.`);
      const pend = this.pendientes(ciclo);
      if (pend && pend.length) f.push(`⚠️ Hay <b>${pend.length}</b> baja${pend.length > 1 ? 's' : ''} automática${pend.length > 1 ? 's' : ''} sin registrar en Seguimiento: la retención real sería del <b>${this.fp(this.pct(c.perm - pend.length, c.n))}</b>.`);
      else if (!pend && ciclo !== 'TODOS' && this.pendCargando[ciclo]) f.push('<span style="color:var(--text-muted)">Revisando bajas automáticas sin registrar…</span>');
      const peor = c.porT.filter(x => x.insc >= 5).sort((a, b) => (b.bajaPct ?? 0) - (a.bajaPct ?? 0))[0];
      if (peor && peor.bajaPct > 0) f.push(`El trayecto con más pérdida es <b>${this.esc(peor.nombre)}</b>: ${peor.bajas} bajas sobre ${peor.insc} inscriptos (${this.fp(peor.bajaPct)}).`);
      if (c.asis != null) f.push(`La asistencia media es del <b>${this.fp(c.asis)}</b>${p && p.asis != null ? ` (${cuando}: ${this.fp(p.asis)})` : ''}.`);
      const al = this.alertas(ciclo);
      if (!al.cerrado && al.lista.length) { const alto = al.lista.filter(x => x.nivel === 'alto').length; f.push(`Hay <b>${al.lista.length}</b> estudiante${al.lista.length > 1 ? 's' : ''} en riesgo de abandono${alto ? ` (${alto} con riesgo alto)` : ''}: ver la pestaña <b>Alertas</b>.`); }
      const sd = c.porT.filter(x => x.sinDocente).length;
      if (sd) f.push(`Hay <b>${sd}</b> trayecto${sd > 1 ? 's' : ''} sin docente asignado.`);
    } else f.push('No hay inscripciones en este ciclo para analizar.');
    if (c.pre) { const pend = c.pre.filter(x => x.estado === 'pendiente').length; if (pend) f.push(`Hay <b>${pend}</b> preinscripci${pend > 1 ? 'ones pendientes' : 'ón pendiente'} de resolver.`); }
    return f;
  },

  /* ---------- piezas de vista ---------- */
  fila(et, v) { return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;padding:3px 0;border-bottom:1px solid #EEF3F6;font-size:.88rem"><span>${et}</span><b style="white-space:nowrap">${v}</b></div>`; },
  bloque(titulo, cuerpo, ayuda) { return `<div class="card-panel intel-bloque"><div class="card-panel-header"><h4 style="margin:0">${titulo}</h4></div><div class="intel-cuerpo">${cuerpo}</div>${ayuda ? `<small class="intel-nota">${ayuda}</small>` : ''}</div>`; },
  barra(rot, n, max, col) { return `<div style="margin:5px 0"><div style="display:flex;justify-content:space-between;font-size:.82rem"><span>${this.esc(rot)}</span><b>${n}</b></div><div style="background:#E5EEF3;border-radius:4px;height:8px"><div style="width:${max ? Math.round(100 * n / max) : 0}%;background:${col || '#3FA7E0'};height:8px;border-radius:4px"></div></div></div>`; },
  semaforo(v) { return v == null ? '<span style="color:#94a3b8">●</span>' : v >= 30 ? '<span style="color:#B42318" title="30 % o más de bajas">●</span>' : v >= 15 ? '<span style="color:#B7791F" title="15 % o más de bajas">●</span>' : '<span style="color:#146B47" title="menos de 15 % de bajas">●</span>'; },

  indicadores(c, cmp) {
    const p = cmp ? cmp.c : null;
    const ret = this.pct(c.perm, c.n), rp = p ? this.pct(p.perm, p.n) : null, eg = this.pct(c.aprob, c.n), ep = p && !cmp.enCurso ? this.pct(p.aprob, p.n) : null;
    const t = (tit, val, dl) => `<div class="stat-card intel-stat"><h4>${tit}</h4><p class="stat-value">${val}</p>${dl}</div>`;
    const dCert = cmp && cmp.enCurso ? '<small style="color:var(--text-muted)">se compara al cierre del ciclo</small>' : this.delta(eg, ep, true, cmp);
    return `<div class="intel-grid" style="margin-bottom:12px">
      ${t('Matrícula', c.n, this.delta(c.n, p && p.n ? p.n : null, false, cmp))}
      ${t('Retención', this.fp(ret), this.delta(ret, rp, true, cmp))}
      ${t('Asistencia media', this.fp(c.asis), this.delta(c.asis, p ? p.asis : null, true, cmp))}
      ${t('Certificación', this.fp(eg), dCert)}</div>`;
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

  tablaTrayectos(c, ciclo) {
    const pend = {}; (this.pendientes(ciclo) || []).forEach(p => { pend[p.tid] = (pend[p.tid] || 0) + 1; });
    const filas = c.porT.map(x => `<tr><td>${this.semaforo(x.bajaPct)} ${this.esc(x.nombre)}${pend[x.id] ? ` <small style="color:#B42318">(+${pend[x.id]} sin registrar)</small>` : ''}</td><td>${x.insc}</td><td>${x.bajas} (${this.fp(x.bajaPct)})</td><td>${x.virtual ? '<small>virtual</small>' : this.fp(x.asis)}</td><td>${x.aprob} (${this.fp(x.aprobPct)})</td></tr>`).join('');
    return this.bloque('Comparación entre trayectos', `<div style="overflow-x:auto"><table class="tabla-simple intel-t" style="width:100%"><thead><tr><th>Trayecto</th><th>Inscriptos</th><th>Bajas</th><th>Asistencia</th><th>Certificados</th></tr></thead><tbody>${filas || '<tr><td colspan="5">Sin trayectos.</td></tr>'}</tbody></table></div>`,
      'Ordenado por mayor pérdida. Punto: rojo = 30 % o más de bajas, ámbar = 15 % o más, verde = menos de 15 %. «Sin registrar»: bajas automáticas que todavía no se guardaron en Seguimiento. Los trayectos virtuales no computan asistencia.');
  },

  /* E: agrupado por sector y por docente (solo Dirección) */
  agrupado(c, clave, et) {
    const g = {};
    c.porT.forEach(x => {
      const k = clave === 'sector' ? (String(x.sector || '').trim() || 'Sin sector') : this.nombre(x.docente);
      const o = g[k] = g[k] || { tr: 0, insc: 0, bajas: 0, aprob: 0, pres: 0, reg: 0 };
      o.tr++; o.insc += x.insc; o.bajas += x.bajas; o.aprob += x.aprob; o.pres += x.presentes; o.reg += x.registros;
    });
    const filas = Object.entries(g).sort((a, b) => b[1].insc - a[1].insc).map(([k, o]) => {
      const bp = this.pct(o.bajas, o.insc);
      return `<tr><td>${this.semaforo(bp)} ${this.esc(k)}</td><td>${o.tr}</td><td>${o.insc}</td><td>${this.fp(bp)}</td><td>${this.fp(this.pct(o.pres, o.reg))}</td><td>${this.fp(this.pct(o.aprob, o.insc))}</td></tr>`;
    }).join('');
    return `<div style="overflow-x:auto"><table class="tabla-simple intel-t" style="width:100%"><thead><tr><th>${et}</th><th>Tray.</th><th>Inscr.</th><th>Bajas</th><th>Asist.</th><th>Certif.</th></tr></thead><tbody>${filas || '<tr><td colspan="6">Sin datos.</td></tr>'}</tbody></table></div>`;
  },
  bloqueSector(c) { return this.bloque('Por sector o especialidad', this.agrupado(c, 'sector', 'Sector'), 'Suma todos los trayectos de cada sector del catálogo. Sirve para ver qué especialidades retienen y certifican más.'); },
  bloqueDocente(c) { return this.bloque('Por docente (solo Dirección)', this.agrupado(c, 'docente', 'Docente'), 'Información sensible: la ve solo la Dirección. Usá estos números como punto de partida para conversar, no como evaluación: dependen también del grupo, el horario y el tipo de trayecto.'); },

  bajasMotivo(c) {
    const b = c.ins.filter(i => this.esBaja(i));
    if (!b.length) return this.bloque('Por qué se van', '<p style="font-size:.85rem">No hay bajas registradas.</p>');
    const m = {}; b.forEach(i => { let k = String(i.motivo_baja || '').trim() || 'Sin motivo cargado'; if (i.baja_tipo === 'automatica' && /^No alcanzó/i.test(k)) k = 'No alcanzó la nota mínima en un módulo'; k = k.slice(0, 60); m[k] = (m[k] || 0) + 1; });
    const top = Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 6), max = top[0][1];
    const auto = b.filter(i => i.baja_tipo === 'automatica').length;
    return this.bloque('Por qué se van', top.map(([k, n]) => this.barra(k, n, max, '#E07A5F')).join('') + `<small style="color:var(--text-muted)">${auto} baja${auto === 1 ? '' : 's'} automática${auto === 1 ? '' : 's'} y ${b.length - auto} manual${b.length - auto === 1 ? '' : 'es'}.</small>`);
  },

  quienes(c) {
    const hoy = new Date();
    const edad = x => { if (!x || !x.fecha_nacimiento) return null; const n = new Date(x.fecha_nacimiento); return Math.floor((hoy - n) / 31557600000); };
    const franja = e => e == null ? null : e < 18 ? 'Menos de 18' : e < 30 ? '18 a 29' : e < 45 ? '30 a 44' : '45 o más';
    const grupos = {}, loc = {};
    const sumar = (o, k, i) => { if (!k) return; o[k] = o[k] || { n: 0, baja: 0 }; o[k].n++; if (this.esBaja(i)) o[k].baja++; };
    c.ins.forEach(i => { const x = this.d.datIdx[String(i.estudiante_user)]; sumar(grupos, franja(edad(x)), i); sumar(loc, x && x.localidad ? String(x.localidad).trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ') : null, i); });
    const orden = ['Menos de 18', '18 a 29', '30 a 44', '45 o más'];
    const fila = (k, v) => `<tr><td>${this.esc(k)}</td><td>${v.n}</td><td>${v.baja} (${this.fp(this.pct(v.baja, v.n))})</td></tr>`;
    const tl = Object.entries(loc).sort((a, b) => b[1].n - a[1].n).slice(0, 6);
    const sinDatos = !Object.keys(grupos).length && !tl.length;
    const cuerpo = sinDatos ? '<p style="font-size:.85rem">Todavía no hay datos de edad ni de localidad cargados para cruzar.</p>' :
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px"><div><b style="font-size:.85rem">Por edad</b><table class="tabla-simple intel-t" style="width:100%"><thead><tr><th>Franja</th><th>Inscr.</th><th>Bajas</th></tr></thead><tbody>${orden.filter(k => grupos[k]).map(k => fila(k, grupos[k])).join('')}</tbody></table></div>
      <div><b style="font-size:.85rem">Por localidad (las 6 más numerosas)</b><table class="tabla-simple intel-t" style="width:100%"><thead><tr><th>Localidad</th><th>Inscr.</th><th>Bajas</th></tr></thead><tbody>${tl.map(([k, v]) => fila(k, v)).join('')}</tbody></table></div></div>`;
    return this.bloque('Quiénes son y a quiénes se pierde', cuerpo, 'Cruza los datos personales de la ficha con las bajas. Si una persona no tiene la ficha completa, no entra en el cruce.');
  },

  bloqueAlertas(ciclo, max) {
    const al = this.alertas(ciclo);
    if (al.cerrado) return this.bloque('Alertas tempranas', '<p style="font-size:.85rem">Las alertas son para el ciclo en curso. Elegí el ciclo de este año.</p>');
    if (!al.lista.length) return this.bloque('Alertas tempranas', `<p style="font-size:.85rem">✔ No hay estudiantes con faltas seguidas ni asistencia baja${this.pendientes(ciclo) ? '' : ' (todavía se están revisando las bajas automáticas)'}.</p>`);
    const ver = this.verTodasAlertas || !max ? al.lista : al.lista.slice(0, max);
    const filas = ver.map(x => `<tr><td>${x.nivel === 'alto' ? '<span style="color:#B42318" title="Riesgo alto">▲ Alto</span>' : '<span style="color:#B7791F" title="Riesgo medio">● Medio</span>'}</td>
      <td>${this.esc(x.nombre)}<br><small style="color:var(--text-muted)">${/^DNI /.test(x.nombre) ? '' : 'DNI ' + this.esc(x.dni)}${x.tel ? (/^DNI /.test(x.nombre) ? '' : ' · ') + 'Tel. ' + this.esc(x.tel) : ''}</small></td>
      <td>${this.esc(x.trayecto)}<br><small style="color:var(--text-muted)">${this.esc(x.docente)}</small></td>
      <td title="${this.esc(x.detalleBaja)}">${this.esc(x.motivos.join(' · '))}</td><td>${this.fecha(x.ultima)}</td>${this.d.cont ? `<td>${x.contacto ? this.fecha(x.contacto.fecha) + '<br><small>' + this.esc(this.RES[x.contacto.resultado] || '') + '</small>' : '<small style="color:#94a3b8">sin contacto</small>'}</td>` : ''}</tr>`).join('');
    const mas = max && al.lista.length > max ? `<button type="button" class="btn-secondary" style="margin-top:8px;padding:.3rem .7rem;font-size:.8rem" onclick="InteligenciaModulo.verTodasAlertas=!InteligenciaModulo.verTodasAlertas;InteligenciaModulo.render()">${this.verTodasAlertas ? 'Ver menos' : `Ver las ${al.lista.length}`}</button>` : '';
    return this.bloque(`Alertas tempranas · ${al.lista.length} estudiante${al.lista.length > 1 ? 's' : ''} en riesgo`,
      `<div style="overflow-x:auto"><table class="tabla-simple intel-t intel-alertas" style="width:100%"><thead><tr><th>Riesgo</th><th>Estudiante</th><th>Trayecto / docente</th><th>Motivo</th><th>Último presente</th>${this.d.cont ? '<th>Último contacto</th>' : ''}</tr></thead><tbody>${filas}</tbody></table></div>${mas}`,
      'Mismo criterio que Seguimiento. Medio: 2 faltas seguidas, menos de 75 % de asistencia (con 4 clases o más) o asistencia en baja. Alto: 3 faltas seguidas, menos de 60 %, un módulo que cierra en 14 días con nota menor a 70, o una baja automática sin registrar. Los justificados cuentan como falta. Para contactar y anotar el seguimiento, entrá a Seguimiento. El listado completo sale en el Excel.');
  },

  /* ---------- áreas institucionales ---------- */
  diasHab(a, b) { let n = 0; const x = new Date(a + 'T00:00:00Z'), y = new Date(b + 'T00:00:00Z'); for (; x <= y; x.setUTCDate(x.getUTCDate() + 1)) { const w = x.getUTCDay(); if (w && w < 6) n++; } return n; },
  anioDe(ciclo) { return /^\d{4}$/.test(ciclo) ? Number(ciclo) : this.anioActual(); },

  bloqueLicencias(ciclo, detalle) {
    const d = this.d, anio = this.anioDe(ciclo);
    const l = d.lic.filter(x => String(x.desde).startsWith(String(anio)));
    const nom = { administrativa: 'administrativas', medica: 'médicas', paro: 'de paro' };
    const por = {}; l.forEach(x => { por[x.tipo] = (por[x.tipo] || 0) + this.diasHab(this.f10(x.desde), this.f10(x.hasta || x.desde)); });
    let extra = '';
    if (detalle && l.length) {
      const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'], pm = Array(12).fill(0);
      l.forEach(x => { pm[Number(this.f10(x.desde).slice(5, 7)) - 1]++; });
      const mx = Math.max(1, ...pm);
      extra = `<div style="margin-top:8px"><b style="font-size:.85rem">Licencias iniciadas por mes</b>${pm.map((n, i) => n ? this.barra(MES[i], n, mx, '#1D5FA8') : '').join('')}</div>`;
    }
    return this.bloque('Docentes: licencias ' + anio, `<p style="font-size:1.5rem;line-height:1.2;margin:0 0 6px"><b>${l.length}</b> <small>${l.length === 1 ? 'licencia o paro' : 'licencias y paros'}</small></p><p style="font-size:.85rem">${Object.entries(por).map(([k, v]) => `${v} días hábiles ${nom[k] || k}`).join(' · ') || 'Sin licencias cargadas.'}</p>${extra}`, 'Los días son lunes a viernes, sin descontar feriados. El detalle exacto está en Licencias docentes.');
  },

  bloqueCoop(ciclo, detalle) {
    const anio = this.anioDe(ciclo), ini = `${anio}-05-01`, fin = `${anio + 1}-04-30`;
    const m = this.d.mov.filter(x => this.f10(x.fecha) >= ini && this.f10(x.fecha) <= fin);
    const suma = (arr, t) => arr.filter(x => x.tipo === t).reduce((s, x) => s + Number(x.monto || 0), 0);
    const ent = suma(m, 'entrada'), sal = suma(m, 'salida');
    let extra = '';
    if (detalle) {
      const MES = ['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr'];
      const filas = MES.map((et, i) => {
        const mes = i < 8 ? `${anio}-${String(i + 5).padStart(2, '0')}` : `${anio + 1}-${String(i - 7).padStart(2, '0')}`;
        const mm = m.filter(x => this.f10(x.fecha).slice(0, 7) === mes);
        if (!mm.length) return '';
        const e = suma(mm, 'entrada'), s = suma(mm, 'salida');
        return `<tr><td>${et} ${mes.slice(0, 4)}</td><td>${this.money(e)}</td><td>${this.money(s)}</td><td style="color:${e - s >= 0 ? '#146B47' : '#B42318'}">${this.money(e - s)}</td></tr>`;
      }).join('');
      extra = filas ? `<div style="overflow-x:auto;margin-top:8px"><table class="tabla-simple intel-t" style="width:100%"><thead><tr><th>Mes</th><th>Ingresos</th><th>Egresos</th><th>Resultado</th></tr></thead><tbody>${filas}</tbody></table></div>` : '';
    }
    return this.bloque(`Cooperadora: ejercicio ${anio}/${anio + 1}`, this.fila('Ingresos', this.money(ent)) + this.fila('Egresos', this.money(sal)) + this.fila('Resultado', `<span style="color:${ent - sal >= 0 ? '#146B47' : '#B42318'}">${this.money(ent - sal)}</span>`) + extra, 'Ejercicio del 1/5 al 30/4. No incluye el saldo del ejercicio anterior; el saldo total está en Cooperadora → Balance.');
  },

  bloqueEps(ciclo, detalle) {
    const anio = this.anioDe(ciclo), d = this.d;
    const cnt = e => d.epsE.filter(x => x.estado === e).length;
    const a = (d.epsA || []).filter(x => String(x.mes).startsWith(String(anio) + '-')), dd = a.reduce((s, x) => s + Number(x.dias_clase || 0), 0);
    let extra = '';
    if (detalle) {
      const pm = {}; a.forEach(x => { const k = String(x.mes).slice(0, 7); pm[k] = pm[k] || { d: 0, p: 0 }; pm[k].d += Number(x.dias_clase || 0); pm[k].p += Number(x.presentes || 0); });
      const filas = Object.keys(pm).sort().map(k => `<tr><td>${k.split('-').reverse().join('/')}</td><td>${pm[k].d}</td><td>${pm[k].p}</td><td>${this.fp(this.pct(pm[k].p, pm[k].d))}</td></tr>`).join('');
      extra = this.fila('Activos', cnt('activo')) + this.fila('Egresados', cnt('egresado')) + this.fila('Bajas', cnt('baja')) +
        (filas ? `<div style="overflow-x:auto;margin-top:8px"><table class="tabla-simple intel-t" style="width:100%"><thead><tr><th>Mes</th><th>Días de clase</th><th>Presentes</th><th>Asistencia</th></tr></thead><tbody>${filas}</tbody></table></div>` : '<p style="font-size:.85rem;margin-top:6px">Sin asistencia de EPS cargada en ' + anio + '.</p>');
    }
    return this.bloque('EPS (estudiantes desvinculados)', `<p style="font-size:1.5rem;line-height:1.2;margin:0 0 6px"><b>${cnt('activo')}</b> <small>estudiante${cnt('activo') === 1 ? '' : 's'} activo${cnt('activo') === 1 ? '' : 's'}</small></p><p style="font-size:.85rem">Asistencia media ${anio}: <b>${this.fp(this.pct(a.reduce((s, x) => s + Number(x.presentes || 0), 0), dd))}</b></p>${extra}`, 'Se cuenta aparte de la matrícula de FP. Detalle en la sección EPS.');
  },

  bloquePersonal(ciclo, c) {
    const sd = c.porT.filter(x => x.sinDocente).length;
    const sh = c.tr.filter(t => !(t.horario_dias && Object.keys(t.horario_dias).length)).length;
    return this.bloque('Personal y organización', this.fila('Docentes con cuenta', this.d.doc ? this.d.doc.length : '–') + this.fila('Trayectos sin docente', sd) + this.fila('Trayectos sin días de cursada', sh), 'Sin días de cursada no se pueden calcular los días de clase afectados por licencias.');
  },

  /* ---------- armado de la pantalla ---------- */
  areas() {
    const d = this.d, a = [['todo', 'Todo'], ['fp', 'Formación Profesional'], ['alertas', '⚠️ Alertas']];
    if (d.epsE) a.push(['eps', 'EPS']);
    a.push(['doc', 'Docentes']);
    if (d.mov) a.push(['coop', 'Cooperadora']);
    a.push(['calidad', 'Calidad de datos']);
    return a;
  },

  render() {
    const cont = document.getElementById('intel-contenido');
    if (!cont || !this.d) return;
    const ciclo = this.ciclo(), c = this.calc(ciclo), cmp = /^\d{4}$/.test(ciclo) ? this.comparacion(ciclo) : null;
    const areas = this.areas();
    if (!areas.some(x => x[0] === this.area)) this.area = 'todo';
    const A = this.area, dir = this.soloDireccion(), d = this.d;
    this.ult = { c, cmp, ciclo };
    if (ciclo !== 'TODOS' && !this.pend[ciclo] && !this.pendCargando[ciclo]) setTimeout(() => this.cargarPendientes(ciclo), 0);
    const grid2 = (...b) => `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;margin-top:12px">${b.join('')}</div>`;
    const uno = b => `<div style="margin-top:12px">${b}</div>`;
    const inst = (det) => {
      const t = [];
      if (d.lic) t.push(this.bloqueLicencias(ciclo, det));
      if (d.mov) t.push(this.bloqueCoop(ciclo, det));
      if (d.epsE) t.push(this.bloqueEps(ciclo, det));
      t.push(this.bloquePersonal(ciclo, c));
      return `<div class="intel-grid" style="margin-top:12px">${t.join('')}</div>`;
    };
    let cuerpo = '';
    if (A === 'todo') cuerpo = this.indicadores(c, cmp) + uno(this.bloqueAlertas(ciclo, 8)) + grid2(this.embudo(c), this.bajasMotivo(c)) + uno(this.bloqueEvolucion(ciclo)) + uno(this.tablaTrayectos(c, ciclo)) + uno(this.quienes(c)) + inst(false) + uno(this.bloqueCalidad(ciclo, true));
    else if (A === 'fp') cuerpo = this.indicadores(c, cmp) + uno(this.bloqueEvolucion(ciclo)) + grid2(this.embudo(c), this.bajasMotivo(c)) + uno(this.tablaTrayectos(c, ciclo)) + (dir ? grid2(this.bloqueSector(c), this.bloqueDocente(c)) : uno(this.bloqueSector(c))) + uno(this.quienes(c));
    else if (A === 'alertas') cuerpo = uno(this.bloqueAlertas(ciclo, 0));
    else if (A === 'eps') cuerpo = uno(this.bloqueEps(ciclo, true));
    else if (A === 'doc') cuerpo = `<div class="intel-grid" style="margin-top:12px">${d.lic ? this.bloqueLicencias(ciclo, true) : ''}${this.bloquePersonal(ciclo, c)}</div>` + (dir ? uno(this.bloqueDocente(c)) : '');
    else if (A === 'coop') cuerpo = uno(this.bloqueCoop(ciclo, true));
    else if (A === 'calidad') cuerpo = uno(this.bloqueCalidad(ciclo, false));
    cont.innerHTML = `<div class="card-panel" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">🧠 Análisis inteligente — ${ciclo === 'TODOS' ? 'todos los ciclos' : 'ciclo ' + ciclo}</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn-secondary" style="padding:.3rem .7rem;font-size:.8rem" onclick="InteligenciaModulo.exportar()">⬇️ Excel</button><button class="btn-secondary" style="padding:.3rem .7rem;font-size:.8rem" onclick="InteligenciaModulo.imprimir()">🖨️ Informe / PDF</button></div></div>
      <ul style="margin:10px 0 0;padding-left:18px;font-size:.9rem;line-height:1.5">${this.resumen(c, cmp, ciclo).map(x => `<li>${x}</li>`).join('')}</ul></div>
      <div class="plan-tabs">${areas.map(([id, et]) => `<button type="button" class="plan-tab ${A === id ? 'activo' : ''}" onclick="InteligenciaModulo.area='${id}';InteligenciaModulo.render()">${et}</button>`).join('')}</div>
      ${cuerpo}
      ${!d.asisCompleta ? `<small>Asistencia calculada sobre los primeros ${this.LIMITE_ASIS.toLocaleString('es-AR')} registros.</small>` : ''}`;
    let st = document.getElementById('intel-estilo'); if (!st) { st = document.createElement('style'); st.id = 'intel-estilo'; document.head.appendChild(st); }
    st.textContent = this.css();
  },
  css() {
    return `.intel-bloque{margin:0;display:flex;flex-direction:column;box-sizing:border-box}.intel-cuerpo{flex:0 0 auto}.intel-cuerpo p{margin:0 0 6px}.intel-nota{color:var(--text-muted);display:block;margin-top:auto;padding-top:8px;font-size:.78rem;line-height:1.35}
      .intel-t{table-layout:auto;border-collapse:collapse}.intel-t th,.intel-t td{text-align:center;padding:6px 8px;vertical-align:middle;white-space:nowrap}.intel-t th:first-child,.intel-t td:first-child{text-align:left;white-space:normal;width:40%}
      .intel-alertas td{white-space:normal;text-align:left}.intel-alertas th{text-align:left}.intel-alertas td:first-child{width:auto;white-space:nowrap}
      .intel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;align-items:stretch}.intel-stat{display:flex;flex-direction:column;gap:4px;min-height:96px}.intel-stat h4,.intel-stat .stat-value{margin:0}
      @media print{.sidebar,header,.plan-tabs,button{display:none!important}}`;
  },

  /* ---------- exportar ---------- */
  async exportar() {
    if (typeof ExcelJS === 'undefined') return Swal.fire('Excel no disponible', 'No se cargó la librería de Excel.', 'error');
    const { c, cmp, ciclo } = this.ult, p = cmp ? cmp.c : null, wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Indicadores');
    const neg = r => { r.font = { bold: true }; return r; };
    ws.columns = [{ width: 44 }, { width: 18 }, { width: 22 }];
    neg(ws.addRow(['Análisis de datos — ' + (ciclo === 'TODOS' ? 'todos los ciclos' : 'ciclo ' + ciclo)]));
    neg(ws.addRow(['Indicador', 'Actual', cmp ? (cmp.enCurso ? `Ciclo ${cmp.ciclo} al ${this.fecha(cmp.corte)}` : 'Ciclo ' + cmp.ciclo) : 'Ciclo anterior']));
    ws.addRow(['Matrícula', c.n, p ? p.n : '']); ws.addRow(['Siguen cursando', c.perm, p ? p.perm : '']); ws.addRow(['Retención (%)', this.pct(c.perm, c.n) ?? '', p ? this.pct(p.perm, p.n) ?? '' : '']);
    const pend = this.pendientes(ciclo); if (pend) ws.addRow(['Bajas automáticas sin registrar', pend.length, '']);
    ws.addRow(['Asistencia media (%)', c.asis ?? '', p ? p.asis ?? '' : '']); ws.addRow(['Con certificación', c.aprob, p && !cmp.enCurso ? p.aprob : '']); ws.addRow([]);
    this.resumen(c, cmp, ciclo).forEach(t => ws.addRow([t.replace(/<[^>]+>/g, '')]));
    const w2 = wb.addWorksheet('Trayectos'); w2.columns = [{ width: 40 }, { width: 22 }, ...Array(6).fill({ width: 16 })];
    neg(w2.addRow(['Trayecto', 'Sector', 'Inscriptos', 'Bajas', 'Bajas (%)', 'Asistencia (%)', 'Certificados', 'Certificados (%)']));
    c.porT.forEach(x => w2.addRow([x.nombre, x.sector || '', x.insc, x.bajas, x.bajaPct ?? '', x.virtual ? 'virtual' : x.asis ?? '', x.aprob, x.aprobPct ?? '']));
    const al = this.alertas(ciclo);
    if (!al.cerrado) {
      const w3 = wb.addWorksheet('Alertas'); w3.columns = [{ width: 10 }, { width: 32 }, { width: 14 }, { width: 18 }, { width: 36 }, { width: 28 }, { width: 40 }, { width: 14 }, { width: 28 }];
      neg(w3.addRow(['Riesgo', 'Estudiante', 'DNI', 'Teléfono', 'Trayecto', 'Docente', 'Motivo', 'Último presente', 'Último contacto']));
      al.lista.forEach(x => w3.addRow([x.nivel, x.nombre, x.dni, x.tel, x.trayecto, x.docente, x.motivos.join(' · ') + (x.detalleBaja ? ' — ' + x.detalleBaja : ''), this.fecha(x.ultima), x.contacto ? `${this.fecha(x.contacto.fecha)} · ${this.RES[x.contacto.resultado] || ''}` : '']));
    }
    const ev = this.evolucion(ciclo);
    if (ev) {
      const MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const w4 = wb.addWorksheet('Evolución'); w4.columns = Array(5).fill({ width: 18 });
      neg(w4.addRow(['Mes', `Activos ${ev.ciclo}`, `Asistencia ${ev.ciclo} (%)`].concat(ev.prev ? [`Activos ${ev.pv}`, `Asistencia ${ev.pv} (%)`] : [])));
      ev.act.forEach((x, i) => w4.addRow([MES[x.m], x.act ?? '', x.asis ?? ''].concat(ev.prev ? [ev.prev[i].act ?? '', ev.prev[i].asis ?? ''] : [])));
    }
    const q = this.calidad(ciclo), w5 = wb.addWorksheet('Calidad de datos'); w5.columns = [{ width: 56 }, { width: 14 }, { width: 12 }];
    neg(w5.addRow(['Dato', 'Cargados', '%'])); q.items.forEach(x => w5.addRow([x.et, x.det, x.v ?? '']));
    w5.addRow(['Índice de completitud', '', q.indice ?? '']);
    q.atrasados.forEach(t => w5.addRow(['Sin asistencia en 14 días: ' + t.nombre, this.fecha(t.ultima), '']));
    if (this.soloDireccion()) {
      ['sector', 'docente'].forEach(k => {
        const g = {}; c.porT.forEach(x => { const kk = k === 'sector' ? (String(x.sector || '').trim() || 'Sin sector') : this.nombre(x.docente); const o = g[kk] = g[kk] || { tr: 0, insc: 0, bajas: 0, aprob: 0, pres: 0, reg: 0 }; o.tr++; o.insc += x.insc; o.bajas += x.bajas; o.aprob += x.aprob; o.pres += x.presentes; o.reg += x.registros; });
        const w = wb.addWorksheet(k === 'sector' ? 'Por sector' : 'Por docente'); w.columns = [{ width: 40 }, ...Array(5).fill({ width: 15 })];
        neg(w.addRow([k === 'sector' ? 'Sector' : 'Docente', 'Trayectos', 'Inscriptos', 'Bajas (%)', 'Asistencia (%)', 'Certificados (%)']));
        Object.entries(g).forEach(([kk, o]) => w.addRow([kk, o.tr, o.insc, this.pct(o.bajas, o.insc) ?? '', this.pct(o.pres, o.reg) ?? '', this.pct(o.aprob, o.insc) ?? '']));
      });
    }
    const buf = await wb.xlsx.writeBuffer(), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = `analisis_${ciclo}.xlsx`; a.click();
  },
  imprimir() {
    const cont = document.getElementById('intel-contenido'); if (!cont) return;
    const w = window.open('', '_blank'); if (!w) return Swal.fire('Ventana bloqueada', 'Permití ventanas emergentes para generar el informe.', 'info');
    const html = cont.innerHTML.replace(/<details(\s[^>]*)?>/g, '<details open$1>');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Informe de análisis</title><style>:root{--text-muted:#64748b}body{font-family:Arial,sans-serif;margin:24px;color:#102a43}.card-panel,.stat-card{border:1px solid #cfe0ea;border-radius:8px;padding:10px;margin:8px 0;break-inside:avoid}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border-bottom:1px solid #e1ebf1;padding:4px}.plan-tabs,button,summary{display:none}h3,h4{margin:4px 0}.stat-value{font-size:22px;font-weight:700;margin:0}${this.css()}</style></head><body><h2>CFP N.º 401 San Andrés de Giles — Informe de análisis de datos</h2><p>${new Date().toLocaleDateString('es-AR')}</p>${html}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  }
};
window.InteligenciaModulo = InteligenciaModulo;
