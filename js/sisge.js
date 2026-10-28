/* ==========================================================================
   EXPORTACIÓN PARA SISGE (Formación Profesional)
   Archivo: js/sisge.js

   Arma el Excel "Lista de estudiantes" (87 columnas, mismo orden y nombres que la
   planilla modelo de SISGE) con todos los inscriptos de un ciclo lectivo.
   - Solo Dirección y Secretaría (Auth.esAdmin).
   - Los datos salen de la ficha de inscripción (preinscripción) y, si la persona no
     tiene ficha, de lo que ya hay cargado en datos_estudiante / datos_inclusion / perfil.
   - SISGE no deja nada vacío: lo que falta se completa con un valor por defecto, y
     al terminar se ofrece una lista de "datos a completar" para que Secretaría lo revise.
   - El CUIL va sin guiones; si falta, se calcula con el DNI y el sexo.
   ========================================================================== */

const SISGE_COLUMNAS = ["N°", "Nombres", "Apellidos", "Sobrenombre", "Documento", "CUIL", "Sexo", "Identidad", "Fecha de nacimiento", "Lugar de nacimiento", "Nacionalidad", "Discapacidad", "Zona", "Cant personas hogar", "Cant adultos hogar", "Cant niños hogar", "Cant hijos", "Lengua extranjera", "Lengua_indigena", "Pueblos originarios", "Telefono", "Email", "Celular", "Calle", "Altura", "Torre", "Piso", "Departamento", "Entre calles", "Localidad", "Distrito", "Provincia", "Codigo postal", "Jubilacion", "Pension", "Pension no contributiva", "Programa Social", "Otras pensiones del estado", "PRO.GRE.SAR", "AUH", "SUBE", "SUMAR", "Potenciar joven", "A pie/Bicicleta", "Colectivo", "Tren", "Taxi/Remis", "Vehiculo particular", "Otro", "Facebook", "Instagram", "Tik Tok", "Twitter", "WhatsApp", "Snapchat", "You Tube", "Rest. Jud", "Asma/Bronc.", "Celiaquía", "Problemas cardíacos", "Diabétes", "Presion arterial", "Convulciones", "Alteraciones sanguinias", "Falta de organo", "Oncohematologica", "Inmunodeficiencias", "Fracturas", "Traumatismo", "Quemaduras", "Problemas de piel", "Alergias", "¿Internado?", "¿Operado?", "¿Medicacion?", "¿Busca trabajo?", "¿Esta trabajando?", "Trabajó", "Ocupacion", "Lugar de trabajo", "Desde", "Hasta", "Tipo de contratacion", "Nivel", "Completo", "Gestion", "Cursando"];

const SisgeModulo = {
  ultimoControl: null,   // lista de datos completados por defecto (para descargar)

  esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  puede() {
    return !!(window.Auth && Auth.usuarioActual && Auth.esAdmin(Auth.usuarioActual.rol));
  },

  /* CUIL = prefijo (27 mujer, 20 varón, 23 si el dígito da 10 o sexo X) + DNI de 8 cifras + dígito verificador */
  calcularCuil(dni, sexo) {
    const d = String(dni || '').replace(/\D/g, '').padStart(8, '0');
    if (d.length !== 8) return '';
    const dv = pref => {
      const n = pref + d, pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
      const suma = n.split('').reduce((a, c, i) => a + Number(c) * pesos[i], 0);
      return 11 - (suma % 11);
    };
    let pref = sexo === 'M' ? '20' : sexo === 'X' ? '23' : '27';
    let v = dv(pref);
    if (v === 11) v = 0;
    else if (v === 10) { pref = '23'; v = sexo === 'M' ? 9 : 4; }
    return pref + d + v;
  },

  /* ---------- Armado de una fila a partir de los datos de la ficha ---------- */
  fila(n, p) {
    const d = p.d, faltan = [];
    const marca = (col, valor, defecto) => {
      const vacio = valor === undefined || valor === null || String(valor).trim() === '';
      if (vacio) { faltan.push(col); return defecto; }
      return valor;
    };
    const sn = v => (v === 'si' ? 'Si' : 'No');
    // Pregunta Sí/No sin responder → "No" (y queda anotado para revisar)
    const snDef = (col, v) => { if (v === undefined || v === null || v === '') { faltan.push(col); return 'No'; } return sn(v); };
    const arr = v => Array.isArray(v) ? v : (v ? [v] : []);
    const ya = (lista, k) => arr(lista).includes(k) ? 'Si' : 'No';

    const sexo = d.sexo_dni || '';
    const dni = String(p.dni).replace(/\D/g, '');
    const nombres = marca('Nombres', d.nombre || p.nombre, '');
    const identidadTxt = String(d.identidad_genero || '').toLowerCase();
    let identidad;
    if (/mujer|femen/.test(identidadTxt)) identidad = 'mujer';
    else if (/hombre|varon|varón|mascul/.test(identidadTxt)) identidad = 'hombre';
    else if (/prefiero|no dec/.test(identidadTxt)) identidad = 'Prefiero no decirlo';
    else if (identidadTxt) identidad = 'otro';
    else { faltan.push('Identidad'); identidad = sexo === 'F' ? 'mujer' : sexo === 'M' ? 'hombre' : 'otro'; }

    const cuilCargado = String(d.cuil || '').replace(/\D/g, '');
    let cuil = cuilCargado;
    if (cuil.length !== 11) { cuil = this.calcularCuil(dni, sexo); faltan.push('CUIL (calculado con el DNI)'); }

    const lugarTipo = d.lugar_nac_tipo ? ({ ba: 'Buenos Aires', otra_provincia: 'otra provincia', otro_pais: 'otro pais' })[d.lugar_nac_tipo]
      : marca('Lugar de nacimiento', '', 'Buenos Aires');

    const nacionalidad = marca('Nacionalidad', d.nacionalidad, 'Argentina');
    const zona = ({ rural: 'Zona Rural', urbana: 'Zona Urbana', encierro: 'Contexto de encierro' })[d.zona] || (faltan.push('Zona'), 'Zona Urbana');
    const tel = marca('Telefono', String(d.telefono || '').replace(/\D/g, ''), 'Sin dato');
    const distrito = marca('Distrito', d.distrito, 'San Andrés de Giles');
    const localidad = marca('Localidad', d.localidad, 'San Andrés de Giles');
    const cp = marca('Codigo postal', d.cp, /giles/i.test(localidad) ? '6720' : 'S/D');
    const personas = marca('Cant personas hogar', d.personas_hogar, 1);
    const adultos = marca('Cant adultos hogar', d.adultos, 1);
    const ninos = marca('Cant niños hogar', d.ninos, 0);
    let hijos = d.cant_hijos;
    if (hijos === undefined || hijos === '') hijos = d.hijos_a_cargo === 'si' ? 1 : 0;
    if (d.hijos_a_cargo === undefined) faltan.push('Cant hijos');

    const lengua = d.otra_lengua === 'si' ? d.lengua_tipo : '';
    const prest = arr(d.prestaciones), prog = arr(d.programas), trans = arr(d.transporte), redes = arr(d.redes), cond = arr(d.condiciones);

    const trabaja = d.trabaja === 'si';
    const contr = ({ dependencia: 'Relación de dependencia', cuenta_propia: 'Trabajador por cuenta propia', pasantia: 'Pasantía laboral', autonomo: 'Autonomo', comerciante: 'Trabajador por cuenta propia', no_registrado: 'Trabajo no registrado', monotributista: 'Monotributista' })[d.contratacion];
    const nivel = ({ primario: 'Primario', egb: 'Primario', polimodal: 'Secundario', secundario: 'Secundario', terciario: 'Terciario', universitario: 'Universitario' })[d.nivel_max] || (faltan.push('Nivel'), 'Secundario');
    const iso = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };

    const f = [
      n,
      nombres,
      marca('Apellidos', d.apellido || p.apellido, ''),
      marca('Sobrenombre', d.sobrenombre, String(nombres).split(' ')[0] || ''),
      Number(dni),
      cuil ? Number(cuil) : '',
      sexo === 'F' ? 'femenino' : sexo === 'M' ? 'masculino' : sexo === 'X' ? 'X' : (faltan.push('Sexo'), 'X'),
      identidad,
      iso(d.fecha_nac) || (faltan.push('Fecha de nacimiento'), ''),
      lugarTipo,
      nacionalidad,
      d.discapacidad === 'si' ? 'Sí' : (d.discapacidad === undefined ? (faltan.push('Discapacidad'), 'No') : 'No'),
      zona,
      Number(personas), Number(adultos), Number(ninos), Number(hijos),
      lengua === 'extranjera' ? 'SI' : 'No',
      lengua === 'indigena' ? 'SI' : 'No',
      snDef('Pueblos originarios', d.pueblos_originarios) === 'Si' ? 'SI' : 'No',
      tel,
      marca('Email', d.email || p.email, `${dni}@cfp401.ar`),
      tel,
      marca('Calle', d.calle, 'Sin dato'),
      marca('Altura', d.altura, 'S/N'),
      marca('Torre', d.torre, '--'),
      marca('Piso', d.piso, '--'),
      distrito,                                                  // "Departamento" = partido/distrito
      marca('Entre calles', d.entre_calles, 'Sin dato'),
      localidad,
      distrito,
      marca('Provincia', d.provincia, 'Buenos Aires'),
      cp,
      ya(prest, 'jubilacion'), ya(prest, 'pension'), ya(prest, 'pension_nc'), ya(prest, 'programa_social'), ya(prest, 'otra_estado'),
      ya(prog, 'progresar'), ya(prog, 'auh'), ya(prog, 'sube'), ya(prog, 'sumar'), ya(prog, 'potenciar'),
      ya(trans, 'a_pie'), ya(trans, 'colectivo'), ya(trans, 'tren'), ya(trans, 'taxi'), ya(trans, 'particular'),
      d.transporte_otro ? d.transporte_otro : 'No',
      ya(redes, 'facebook'), ya(redes, 'instagram'), ya(redes, 'tiktok'), ya(redes, 'twitter'),
      (redes.includes('whatsapp') || d.whatsapp === 'si') ? 'Si' : 'No',
      ya(redes, 'snapchat'), ya(redes, 'youtube'),
      snDef('Rest. Jud', d.restriccion_judicial),
      ya(cond, 'asma'), ya(cond, 'celiaquia'), ya(cond, 'cardiacas'), ya(cond, 'diabetes'), ya(cond, 'presion'),
      ya(cond, 'convulsiones'), ya(cond, 'sangre'), ya(cond, 'organo'), ya(cond, 'onco'), ya(cond, 'inmuno'),
      ya(cond, 'fracturas'), ya(cond, 'craneo'), ya(cond, 'quemaduras'), ya(cond, 'piel'),
      (d.alergia === 'si' || cond.includes('alergias_graves')) ? 'Si' : 'No',
      ya(cond, 'internado'), ya(cond, 'operado'), ya(cond, 'medicacion'),
      snDef('¿Busca trabajo?', d.busca_trabajo),
      snDef('¿Esta trabajando?', d.trabaja),
      d.trabajo_alguna_vez ? sn(d.trabajo_alguna_vez) : (trabaja ? 'Si' : (faltan.push('Trabajó'), 'No')),
      trabaja ? marca('Ocupacion', d.ocupacion, 'Sin dato') : 'No trabaja',
      trabaja ? marca('Lugar de trabajo', d.lugar_trabajo, 'Sin dato') : 'No trabaja',
      trabaja ? (iso(d.trabajo_desde) || (faltan.push('Desde'), 'Sin dato')) : 'No trabaja',
      trabaja ? (d.trabajo_actual === 'si' ? 'Actualidad' : (iso(d.trabajo_hasta) || (faltan.push('Hasta'), 'Sin dato'))) : 'No trabaja',
      trabaja ? (contr || (faltan.push('Tipo de contratacion'), 'Trabajo no registrado')) : 'No trabaja',
      nivel,
      d.estado_estudios === 'completo' ? 'Si' : (d.estado_estudios ? 'No' : (faltan.push('Completo'), 'No')),
      d.gestion === 'privada' ? 'Privada' : (d.gestion ? 'Pública' : (faltan.push('Gestion'), 'Pública')),
      snDef('Cursando', d.cursa_actualmente)
    ];
    return { fila: f, faltan: [...new Set(faltan)] };
  },

  /* ---------- Interfaz ---------- */
  async abrir() {
    if (!this.puede()) { Swal.fire('Sin acceso', 'La exportación para SISGE es solo para Dirección y Secretaría.', 'info'); return; }
    const anio = new Date().getFullYear();
    const r = await Swal.fire({
      title: 'Exportar para SISGE',
      html: `<div style="text-align:left; font-size:.9rem;">
        <p style="margin:0 0 .8rem; color:#64748b;">Genera el Excel de estudiantes (mismas columnas que la planilla de SISGE) con los inscriptos del ciclo. Lo que falte en la ficha se completa con un valor por defecto, y después te muestro la lista de datos para revisar.</p>
        <label style="display:block; font-weight:600; margin-bottom:.2rem;">Ciclo lectivo</label>
        <select id="sg-ciclo" class="swal2-input" style="margin:0 0 .7rem; width:100%;">${[anio + 1, anio, anio - 1, anio - 2].map(c => `<option value="${c}" ${c === anio ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <label style="display:flex; gap:.5rem; align-items:center;"><input type="checkbox" id="sg-bajas"> Incluir también a quienes tienen baja</label>
      </div>`,
      showCancelButton: true, confirmButtonText: 'Generar Excel', cancelButtonText: 'Cancelar', focusConfirm: false,
      preConfirm: () => ({ ciclo: Number(document.getElementById('sg-ciclo').value), bajas: document.getElementById('sg-bajas').checked })
    });
    if (!r.isConfirmed) return;
    await this.exportar(r.value.ciclo, r.value.bajas);
  },

  async exportar(ciclo, conBajas) {
    if (!this.puede()) return;
    try {
      Swal.fire({ title: 'Armando la lista…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const { data: trays, error: e1 } = await supabase.from('trayectos').select('id, nombre').eq('ciclo_lectivo', ciclo);
      if (e1) throw e1;
      const ids = (trays || []).map(t => t.id);
      if (!ids.length) { Swal.fire('Sin trayectos', `No hay trayectos en el ciclo ${ciclo}.`, 'info'); return; }

      const { data: insc, error: e2 } = await supabase.from('inscripciones').select('estudiante_user, estado, fecha_baja').in('trayecto_id', ids);
      if (e2) throw e2;
      const dnis = [...new Set((insc || []).filter(i => conBajas || (String(i.estado).toUpperCase() !== 'BAJA' && !i.fecha_baja)).map(i => String(i.estudiante_user)))];
      if (!dnis.length) { Swal.fire('Sin inscriptos', `No hay inscriptos para exportar en el ciclo ${ciclo}.`, 'info'); return; }

      const lotes = [];
      for (let i = 0; i < dnis.length; i += 200) lotes.push(dnis.slice(i, i + 200));
      const traer = async (tabla, col, extra) => {
        const out = [];
        for (const l of lotes) { let q = supabase.from(tabla).select('*').in(col, l); if (extra) q = extra(q); const { data, error } = await q; if (error) throw error; out.push(...(data || [])); }
        return out;
      };
      const [perfiles, ests, incls, pres] = await Promise.all([
        traer('profiles', 'dni'),
        traer('datos_estudiante', 'dni'),
        traer('datos_inclusion', 'dni'),
        traer('preinscripciones', 'dni', q => q.neq('estado', 'rechazada').order('created_at', { ascending: false }))
      ]);
      const porDni = (lista) => { const m = {}; lista.forEach(x => { if (!m[x.dni]) m[x.dni] = x; }); return m; };
      const mP = porDni(perfiles), mE = porDni(ests), mI = porDni(incls), mPre = porDni(pres);

      const personas = dnis.map(dni => {
        const pf = mP[dni] || {}, de = mE[dni] || {}, di = mI[dni] || {}, pre = mPre[dni];
        // Base: lo que hay en datos_estudiante / inclusión / perfil; encima, la ficha completa
        const base = {
          nombre: pf.nombre, apellido: pf.apellido, email: pf.email && !/@cfp401\.ar$/i.test(pf.email) ? pf.email : '',
          fecha_nac: de.fecha_nacimiento, lugar_nac: de.lugar_nacimiento, calle: de.domicilio, localidad: de.localidad,
          cp: de.codigo_postal, telefono: de.telefono,
          nacionalidad: di.pais_origen || undefined,
          discapacidad: di.discapacidad === true ? 'si' : di.discapacidad === false ? 'no' : undefined
        };
        Object.keys(base).forEach(k => { if (base[k] === undefined || base[k] === null || base[k] === '') delete base[k]; });
        return { dni, nombre: pf.nombre, apellido: pf.apellido, email: pf.email, d: { ...base, ...((pre && pre.datos) || {}) } };
      }).sort((a, b) => String(a.apellido || a.d.apellido || '').localeCompare(String(b.apellido || b.d.apellido || ''), 'es'));

      const control = [];
      const filas = personas.map((p, i) => {
        const r = this.fila(i + 1, p);
        if (r.faltan.length) control.push({ dni: p.dni, nombre: `${p.d.apellido || p.apellido || ''}, ${p.d.nombre || p.nombre || ''}`, faltan: r.faltan });
        return r.fila;
      });
      this.ultimoControl = { ciclo, control };

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Resumen Planificación');
      ws.addRow(SISGE_COLUMNAS);
      filas.forEach(f => ws.addRow(f));
      const cab = ws.getRow(1);
      cab.font = { bold: true };
      cab.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5BBFEA' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
      ws.columns.forEach(c => { c.width = 16; });
      ws.getColumn(9).numFmt = 'dd/mm/yyyy'; ws.getColumn(81).numFmt = 'dd/mm/yyyy'; ws.getColumn(82).numFmt = 'dd/mm/yyyy';
      ws.getColumn(5).numFmt = '0'; ws.getColumn(6).numFmt = '0';
      ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 3 }];

      const buf = await wb.xlsx.writeBuffer();
      this.descargar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Lista_de_estudiantes_SISGE_${ciclo}.xlsx`);

      Swal.fire({
        icon: control.length ? 'info' : 'success',
        title: `Lista de ${filas.length} estudiante${filas.length === 1 ? '' : 's'} generada`,
        html: control.length
          ? `<div style="text-align:left; font-size:.9rem;">En <b>${control.length}</b> persona${control.length === 1 ? '' : 's'} faltaban datos y se completaron con valores por defecto (CUIL calculado con el DNI, "No" en las preguntas sin responder, etc.).<br><br>Descargá la lista de datos a revisar para completarlos en la ficha o directamente en el Excel antes de subirlo a SISGE.</div>`
          : 'Todos los datos estaban completos.',
        showCancelButton: control.length > 0, confirmButtonText: control.length ? 'Descargar lista a revisar' : 'Listo', cancelButtonText: 'Cerrar'
      }).then(res => { if (res.isConfirmed && control.length) this.descargarControl(); });
    } catch (err) {
      console.error(err);
      Swal.fire('No se pudo generar', err.message || '', 'error');
    }
  },

  async descargarControl() {
    if (!this.puede() || !this.ultimoControl) return;
    const { ciclo, control } = this.ultimoControl;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Datos a completar');
    ws.addRow(['DNI', 'Apellido y nombre', 'Campos completados por defecto']);
    control.forEach(c => ws.addRow([c.dni, c.nombre, c.faltan.join(', ')]));
    ws.getRow(1).font = { bold: true };
    ws.getColumn(1).width = 14; ws.getColumn(2).width = 36; ws.getColumn(3).width = 110;
    const buf = await wb.xlsx.writeBuffer();
    this.descargar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `SISGE_datos_a_completar_${ciclo}.xlsx`);
  },

  descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
};
window.SisgeModulo = SisgeModulo;
