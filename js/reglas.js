/* ==========================================================================
   REGLAS DE EVALUACIÓN · Formación Profesional (DGCyE) · CFP N.º 401
   Única fuente de verdad para notas, asistencia y aprobación. La usan:
   Mi progreso, Ficha del alumno, Seguimiento, Calificaciones, desbloqueo de
   módulos y Actas de examen.

   • Asistencia: "presente" y "tarde" cuentan como asistencia.
     "ausente" y "justificado" cuentan como ausencia.
   • Nota de un módulo = promedio entre el promedio de sus actividades y el
     % de asistencia, redondeado sin decimales.
     – Si el trayecto no computa asistencia (virtual) o no hay asistencia
       cargada, la nota es solo el promedio de actividades (nunca se promedia con 0).
     – Si no hay actividades calificadas pero sí asistencia, la nota es la asistencia.
   • Solo cuentan las actividades con nota: no cuentan el material, las encuestas
     ni las bitácoras marcadas "sin nota".
   • Una actividad no entregada cuenta con la nota mínima (10, como el 1 en las
     escuelas) cuando vence su plazo (o, si no tiene
     fecha límite, cuando cierra el módulo). Un recuperatorio es otra actividad más
     y se promedia con las demás.
   • Un módulo se aprueba con 70 o más, o si está acreditado por equivalencia.
   • El trayecto se aprueba cuando TODOS sus módulos están aprobados o acreditados.
   • Correlatividad: un módulo solo se califica si el anterior está aprobado o
     acreditado (o si el docente dio una habilitación excepcional). Si no, queda
     "bloqueado": no lleva nota aunque tenga asistencia o entregas cargadas.
   ========================================================================== */
const ReglasFP = {
  MINIMO: 70,
  NOTA_NO_ENTREGADA: 10,   // nota mínima, como el 1 en las escuelas

  esPresente(estado) {
    const e = String(estado || '').toLowerCase();
    return e === 'presente' || e === 'tarde';
  },

  // % de asistencia (0-100) o null si no hay registros
  porcentajeAsistencia(registros) {
    const r = registros || [];
    if (!r.length) return null;
    return (r.filter(a => this.esPresente(a.estado)).length / r.length) * 100;
  },

  promedioActividades(entregas) {
    const vals = (entregas || []).map(e => parseFloat(e.nota)).filter(v => !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  },

  // Combina actividades y asistencia según la regla de FP
  combinar(promAct, pctAsis, computaAsistencia = true) {
    const asis = computaAsistencia === false ? null : pctAsis;
    if (promAct !== null && asis !== null) return Math.round((promAct + asis) / 2);
    if (promAct !== null) return Math.round(promAct);
    if (asis !== null) return Math.round(asis);
    return null;
  },

  computaAsistencia(trayecto) {
    if (!trayecto) return true;
    return trayecto.computa_asistencia !== false;
  },

  /* Evalúa a un estudiante en un trayecto.
     datos = { key, modulos, clases, entregas, asistencias, acreditados, computaAsistencia, excepcion }
     – entregas/asistencias/acreditados pueden venir con datos de otros alumnos: se filtran por key. */
  evaluar(datos) {
    const key = String(datos.key);
    const computa = datos.computaAsistencia !== false;
    // Las encuestas, el material y las bitácoras sin nota no cuentan para el promedio
    const clases = (datos.clases || []).filter(c => c.calificable !== false && c.tipo !== 'encuesta' && c.tipo !== 'material');
    const entregas = (datos.entregas || []).filter(e => String(e.estudiante_user) === key);
    const asis = (datos.asistencias || []).filter(a => String(a.estudiante_user) === key);
    const acred = (datos.acreditados || []).filter(a => String(a.estudiante_user) === key);
    const modulos = (datos.modulos && datos.modulos.length) ? datos.modulos : [{ id: null, nombre: 'Trayecto completo' }];

    const hoy = datos.hoy || this.hoyISO();
    const res = modulos.map(m => {
      const clasesM = clases.filter(c => m.id === null || Number(c.modulo_id) === Number(m.id));
      const idsC = clasesM.map(c => Number(c.id));
      const ent = entregas.filter(e => idsC.includes(Number(e.clase_id)));
      const as = m.id === null ? asis : asis.filter(a => a.modulo_id === null || a.modulo_id === undefined || Number(a.modulo_id) === Number(m.id));
      const eq = m.id !== null ? acred.find(a => Number(a.modulo_id) === Number(m.id)) : null;
      // Actividades vencidas sin entregar: cuentan con la nota mínima (10)
      const faltantes = clasesM.filter(c => this.venceSinEntrega(c, m, key, hoy) && !ent.some(e => Number(e.clase_id) === Number(c.id)));
      const promAct = this.promedioActividades(ent.concat(faltantes.map(c => ({ clase_id: c.id, nota: String(this.NOTA_NO_ENTREGADA) }))));
      const pctAsis = this.porcentajeAsistencia(as);
      const nota = eq ? null : this.combinar(promAct, pctAsis, computa);
      return {
        id: m.id,
        nombre: m.nombre,
        nota,
        equivalencia: !!eq,
        motivoEquivalencia: eq ? (eq.motivo || '') : '',
        aprobado: !!eq || (nota !== null && nota >= this.MINIMO),
        promAct: promAct === null ? null : Math.round(promAct),
        pctAsis: (computa && pctAsis !== null) ? Math.round(pctAsis) : null,
        entregas: ent.length,
        sinEntregar: faltantes.length,
        pendientes: ent.filter(e => isNaN(parseFloat(e.nota))).length,
        sinDatos: !eq && nota === null
      };
    });

    // Correlatividad: si un módulo no está aprobado, los siguientes quedan bloqueados
    this.aplicarCorrelatividad(res, !!datos.excepcion);

    const notas = res.filter(r => r.nota !== null).map(r => r.nota);
    const promedio = notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
    const todosAprobados = res.length > 0 && res.every(r => r.aprobado);
    const habilitados = res.filter(r => !r.bloqueado);
    const sinNingunDato = habilitados.every(r => r.sinDatos);
    const pctTotal = computa ? this.porcentajeAsistencia(asis) : null;

    let resultado = 'EN CURSO';
    if (todosAprobados) resultado = 'APROBADO';
    else if (sinNingunDato) resultado = 'AUSENTE';
    else if (habilitados.every(r => !r.sinDatos)) resultado = 'DESAPROBADO';

    return {
      modulos: res,
      promedio,
      aprobado: todosAprobados,
      resultado,                       // APROBADO | DESAPROBADO | AUSENTE | EN CURSO
      asistencia: pctTotal === null ? null : Math.round(pctTotal),
      computaAsistencia: computa
    };
  },

  /* ¿Esta actividad ya cuenta con la nota mínima (10) si el alumno no la entregó?
     – Con fecha límite: desde que vence.
     – Sin fecha límite: cuando cierra el módulo (su fecha de fin).
     Solo para actividades que el alumno entrega en la plataforma (no la práctica en
     taller, que la califica el docente) y que son para él (los recuperatorios
     personales no cuentan para el resto del grupo). */
  TIPOS_CON_ENTREGA: ['tp', 'cuestionario', 'escrita', 'diagnostico', 'presupuesto', 'bitacora'],
  venceSinEntrega(c, modulo, key, hoy) {
    if (!this.TIPOS_CON_ENTREGA.includes(c.tipo)) return false;
    if (c.estudiante_user && String(c.estudiante_user) !== String(key)) return false;
    if (c.fecha_limite) {
      const fin = new Date(c.fecha_limite).getTime();
      return !isNaN(fin) && fin < Date.now();
    }
    const finMod = modulo && modulo.fecha_fin ? String(modulo.fecha_fin).slice(0, 10) : '';
    return !!finMod && finMod < (hoy || this.hoyISO());
  },

  // Marca como bloqueados los módulos cuyo anterior no está aprobado (salvo equivalencia o excepción).
  // Guarda la nota que tendría en "notaSinCorrelativa" por si se corrige el módulo anterior.
  aplicarCorrelatividad(mods, excepcion = false) {
    let anteriorOk = true;
    mods.forEach((r, i) => {
      r.bloqueado = false;
      if (i > 0 && !anteriorOk && !excepcion && !r.equivalencia) {
        r.bloqueado = true;
        r.notaSinCorrelativa = r.nota;
        r.nota = null;
        r.aprobado = false;
        r.sinDatos = false;
      }
      anteriorOk = r.aprobado;
    });
    return mods;
  },

  // ¿El módulo en la posición idx está habilitado? (el anterior aprobado/acreditado, o excepción del docente)
  moduloHabilitado(evaluacion, idx, tieneExcepcion = false) {
    if (tieneExcepcion || idx <= 0) return true;
    const ant = evaluacion.modulos[idx - 1];
    return !!(ant && ant.aprobado);
  },

  /* Lee clases con la columna "calificable" (sql/11). Si la base todavía no la tiene,
     las lee sin ella para que nada deje de funcionar.
     Uso: ReglasFP.selectClases('id, modulo_id', q => q.eq('trayecto_id', 8)) */
  async selectClases(columnas, filtro) {
    const armar = (cols) => filtro(supabase.from('clases').select(cols));
    let r = await armar(columnas + ', calificable, tipo, fecha_limite, estudiante_user');
    if (r.error && /calificable|tipo|fecha_limite|column/i.test(r.error.message || '')) r = await armar(columnas);
    return r;
  },

  /* ---------- Bajas ----------
     • Manual: la inscripción tiene estado BAJA (la cargan docente o preceptor en trayectos
       sin módulos, o la dirección en cualquiera).
     • Automática (trayectos con módulos): un módulo ya cerró (pasó su fecha de fin) y el
       alumno quedó con nota menor a 70. Si el docente dio habilitación excepcional, no hay baja.
       Si el módulo cerró pero todavía no tiene nota, queda "en riesgo" (no es baja). */
  hoyISO() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  estadoCursada(ev, modulos, inscripcion, opciones = {}) {
    const ins = inscripcion || {};
    if (String(ins.estado || '').toUpperCase() === 'BAJA') {
      // Baja guardada (manual, o automática ya registrada)
      return { baja: true, guardada: true, tipo: ins.baja_tipo === 'automatica' ? 'automatica' : 'manual', motivo: ins.motivo_baja || 'Baja', fecha: ins.fecha_baja || null };
    }
    if (ins.reincorporado) return { baja: false };     // se reincorporó: no se vuelve a dar de baja solo
    if (opciones.excepcion) return { baja: false };
    const hoy = opciones.hoy || this.hoyISO();
    const lista = modulos || [];
    for (let i = 0; i < ev.modulos.length; i++) {
      const m = ev.modulos[i], mod = lista[i];
      if (!mod || m.equivalencia || m.bloqueado) continue;
      const fin = mod.fecha_fin ? String(mod.fecha_fin).slice(0, 10) : '';
      if (fin && fin < hoy && m.nota !== null && m.nota < this.MINIMO) {
        return {
          baja: true, tipo: 'automatica', fecha: fin,
          motivo: `No alcanzó ${this.MINIMO} en el Módulo ${i + 1} (${m.nota}) al cierre del ${fin.split('-').reverse().join('/')}`
        };
      }
    }
    return { baja: false };
  },

  /* Situación de todos los inscriptos de un trayecto: { dni: { ev, cursada, inscripcion } }.
     Lo usan Asistencia (no muestra a los dados de baja) y otras pantallas. */
  async cargarSituacion(trayectoId) {
    const tid = Number(trayectoId);
    const [rT, rI, rM, rC, rA, rX, rE] = await Promise.all([
      supabase.from('trayectos').select('*').eq('id', tid).maybeSingle(),
      supabase.from('inscripciones').select('*').eq('trayecto_id', tid),
      supabase.from('modulos').select('*').eq('trayecto_id', tid).order('id', { ascending: true }),
      this.selectClases('id, modulo_id', q => q.eq('trayecto_id', tid)),
      supabase.from('asistencias').select('estudiante_user, modulo_id, estado').eq('trayecto_id', tid),
      supabase.from('modulos_acreditados').select('*').eq('trayecto_id', tid),
      supabase.from('excepciones_estudiantes').select('estudiante_user, habilitado').eq('trayecto_id', tid)
    ]);
    const clases = rC.data || [];
    let entregas = [];
    if (clases.length) {
      const { data } = await supabase.from('entregas_actividades').select('clase_id, estudiante_user, nota').in('clase_id', clases.map(c => c.id));
      entregas = data || [];
    }
    const modulos = rM.data || [];
    const conExc = new Set(((rE && rE.data) || []).filter(x => x.habilitado).map(x => String(x.estudiante_user)));
    const out = {};
    (rI.data || []).forEach(ins => {
      const key = String(ins.estudiante_user);
      const excepcion = conExc.has(key);
      const ev = this.evaluar({
        key, modulos, clases, entregas, asistencias: rA.data || [],
        acreditados: (!rX.error && rX.data) || [], computaAsistencia: this.computaAsistencia(rT.data), excepcion
      });
      out[key] = { ev, inscripcion: ins, excepcion, cursada: this.estadoCursada(ev, modulos, ins, { excepcion }) };
    });
    return { trayecto: rT.data, modulos, alumnos: out };
  },

  /* ---------- Consultas completas (Supabase entrega de a 1000 filas) ----------
     armar(): devuelve la consulta sin .range(); conviene que traiga .order() para que las páginas no se pisen. */
  async todas(armar, maxPag = 60) {
    const out = [];
    for (let i = 0; i < maxPag; i++) {
      const r = await armar().range(i * 1000, i * 1000 + 999);
      if (r.error) return { error: r.error, data: out };
      out.push(...(r.data || []));
      if ((r.data || []).length < 1000) return { data: out, completo: true };
    }
    return { data: out, completo: false };
  },
  /* Igual que todas(), pero con un filtro .in() largo partido en lotes (la URL tiene límite). */
  async enLotes(valores, armar, tam = 150) {
    const out = [];
    let completo = true;
    for (let i = 0; i < valores.length; i += tam) {
      const r = await this.todas(() => armar(valores.slice(i, i + tam)));
      if (r.error) return { error: r.error, data: out };
      out.push(...r.data);
      if (r.completo === false) completo = false;
    }
    return { data: out, completo };
  },

  /* ---------- Riesgo de abandono (lo usan Seguimiento y el Dashboard: un solo criterio) ----------
     info = { dias: [[fecha 'AAAA-MM-DD', presente bool], ...] (un registro por día),
              promedio, sinEntregas, bajaPendiente, cierres: [{ modulo, fecha, nota }] }
     Medio: 2 faltas seguidas · asistencia < 75 % (con 4 clases o más) · asistencia en baja en las últimas 4 clases
            · promedio de actividades < 70 · ninguna entrega.
     Alto:  3 faltas seguidas · asistencia < 60 % · baja automática sin registrar
            · un módulo cierra en 14 días o menos y la nota actual es menor a 70. */
  RIESGO_ASIS: 75,
  RIESGO_ASIS_ALTO: 60,
  riesgo(info) {
    const dias = (info.dias || []).slice().sort((a, b) => (a[0] < b[0] ? -1 : 1));
    let seguidas = 0;
    for (let j = dias.length - 1; j >= 0 && !dias[j][1]; j--) seguidas++;
    const n = dias.length, pres = dias.filter(x => x[1]).length;
    const pct = n ? Math.round(100 * pres / n) : null;
    const ult4 = dias.slice(-4), pct4 = ult4.length ? Math.round(100 * ult4.filter(x => x[1]).length / ult4.length) : null;
    const bajando = n >= 8 && pct4 !== null && pct !== null && pct4 <= pct - 25;
    const ultimaPres = [...dias].reverse().find(x => x[1]);
    const motivos = [];
    let alto = false;
    const fecha = f => String(f || '').slice(0, 10).split('-').reverse().slice(0, 2).join('/');
    if (info.bajaPendiente) { motivos.push('Baja automática sin registrar'); alto = true; }
    (info.cierres || []).forEach(c => { motivos.push(`${c.modulo} cierra el ${fecha(c.fecha)} con nota ${c.nota}`); alto = true; });
    if (seguidas >= 2) { motivos.push(`${seguidas} faltas seguidas`); if (seguidas >= 3) alto = true; }
    if (n >= 4 && pct !== null && pct < this.RIESGO_ASIS) { motivos.push(`Asistencia ${pct} %`); if (pct < this.RIESGO_ASIS_ALTO) alto = true; }
    if (bajando && seguidas < 2) motivos.push(`Viene faltando (${pct4} % en las últimas 4)`);
    if (info.promedio !== null && info.promedio !== undefined && info.promedio < this.MINIMO) motivos.push(`Promedio ${info.promedio}`);
    if (info.sinEntregas) motivos.push('Sin entregas');
    return { nivel: motivos.length ? (alto ? 'alto' : 'medio') : null, motivos, seguidas, pct, n, ultima: ultimaPres ? ultimaPres[0] : null };
  },
  /* Módulos que cierran dentro de N días con la nota actual por debajo del mínimo (aviso antes de la baja automática) */
  cierresProximos(ev, modulos, dentroDias = 14, hoy) {
    const h = hoy || this.hoyISO(), lim = new Date(Date.parse(h + 'T12:00:00Z') + dentroDias * 864e5).toISOString().slice(0, 10);
    const out = [];
    (ev && ev.modulos || []).forEach((m, i) => {
      const mod = (modulos || [])[i];
      if (!mod || m.equivalencia || m.bloqueado || m.nota === null || m.nota >= this.MINIMO) return;
      const fin = mod.fecha_fin ? String(mod.fecha_fin).slice(0, 10) : '';
      if (fin && fin >= h && fin <= lim) out.push({ modulo: (modulos.length > 1 ? `Módulo ${i + 1}` : 'El trayecto'), fecha: fin, nota: m.nota });
    });
    return out;
  },
  /* Teléfono de la ficha → número para wa.me (Argentina). null si no parece un celular válido. */
  telWhatsapp(tel) {
    let d = String(tel || '').replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('54')) { d = d.slice(2); if (d.startsWith('9')) d = d.slice(1); }
    if (d.startsWith('0')) d = d.slice(1);
    if (d.length === 12) d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');   // 02325 15 123456 → 2325123456
    return d.length === 10 ? '549' + d : null;
  },

  /* Número en letras (0-100), en mayúsculas, como se escribe en las actas */
  enLetras(n) {
    const v = Math.round(Number(n));
    if (isNaN(v) || v < 0 || v > 100) return '';
    const U = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
      'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
      'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
    const D = { 3: 'TREINTA', 4: 'CUARENTA', 5: 'CINCUENTA', 6: 'SESENTA', 7: 'SETENTA', 8: 'OCHENTA', 9: 'NOVENTA' };
    if (v === 100) return 'CIEN';
    if (v < 30) return U[v];
    const d = Math.floor(v / 10), u = v % 10;
    return u === 0 ? D[d] : `${D[d]} Y ${U[u]}`;
  }
};
window.ReglasFP = ReglasFP;
