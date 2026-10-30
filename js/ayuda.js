/* ==========================================================================
   AYUDA POR ROL (pestaña "Ayuda" del menú)
   Archivo: js/ayuda.js

   Guías cortas para estudiantes, docentes y Secretaría. La Dirección (administrador)
   no tiene esta pestaña.

   ⚠️ MANTENIMIENTO: cuando se cambie, agregue o quite una funcionalidad que vea un
   rol, hay que actualizar acá la guía de ese rol y la fecha AYUDA_ACTUALIZADA.
   (Regla anotada también en CLAUDE.md.)
   ========================================================================== */

const AYUDA_ACTUALIZADA = '29/10/2026';

const AyudaModulo = {
  contacto: null,    // texto editable desde Preinscripciones → "Contacto del CFP"
  rol: '',

  esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  /* ------------------------ BOTÓN «?» Y RECORRIDO GUIADO ------------------------
     Se alimentan de PANTALLAS (texto corto por pantalla) y BOTON_TEMA (id del botón del
     menú → pantalla). El recorrido solo señala los botones que ve esa persona.
     La Dirección (admin) no usa ayuda: no ve el «?» ni el recorrido.               */
  NOMBRE_CORTO: 'CFP N.º 401',
  NOMBRE_PDF: 'CFP N.º 401 - San Andrés de Giles',
  tabActual: 'trayectos',
  ROLES: { estudiante: 'Estudiante', docente: 'Docente', secretaria: 'Secretaría' },

  PANTALLAS: {
    progreso: {
      t: 'Mi progreso', corto: 'Tus notas, asistencia y módulos aprobados.',
      que: 'Muestra cómo venís en cada trayecto: módulos, notas y asistencia.',
      pasos: ['Cada módulo muestra su estado: cursando, aprobado o bloqueado.', 'Se aprueba con 70 puntos o más.', 'La nota combina el promedio de tus actividades y tu asistencia.', 'Un módulo se habilita al aprobar el anterior.'],
      ojo: ['Si una actividad no se entrega a tiempo, cuenta con la nota mínima.']
    },
    trayectos: {
      t: 'Trayectos formativos', corto: 'Tus cursos: clases, actividades y asistencia.',
      que: 'Lista de cursos. Cada uno se abre para ver sus clases y actividades.',
      pasos: ['Entrá al trayecto con el botón «Ver Clases y Actividades».', 'Ahí están las clases, el material y las actividades por módulo.', 'Entregá cada actividad dentro del plazo de la consigna.'],
      ojo: ['Si un módulo aparece bloqueado, hay que aprobar primero el anterior.'],
      porRol: {
        docente: {
          corto: 'Tus cursos: clases, asistencia, notas y planificación.',
          que: 'Tus trayectos asignados (o suplencias).',
          pasos: ['Abrí un trayecto con «Ver Clases y Actividades».', 'Cargás clases, material y actividades, tomás asistencia, calificás y completás el libro de temas y la planificación.', 'Podés dar de baja a estudiantes de tus cursos; reincorporar lo hacen Dirección o Secretaría.'],
          ojo: []
        },
        secretaria: {
          corto: 'Todos los cursos del CFP, con edición.',
          que: 'Todos los trayectos del CFP, con edición de sus datos.',
          pasos: ['«✏️ Editar» cambia horarios, docente, sede y fechas; ahí también se agregan suplentes.', '«Ver Clases y Actividades» muestra clases, asistencia, notas, libro de temas y planificación.', 'Desde el trayecto se registran bajas y reincorporaciones y se baja la ficha de curso.'],
          ojo: []
        }
      }
    },
    seguimiento: {
      t: 'Seguimiento', corto: 'Entregas por corregir y estudiantes en riesgo.',
      que: 'Panel para corregir entregas y detectar a tiempo a quien se está alejando.',
      pasos: ['«Entregas por corregir» lista lo pendiente: abrís la entrega, ponés nota (0 a 100) y una devolución.', '«Alumnos en riesgo» muestra a quienes tienen asistencia o promedio menor a 70, o ninguna entrega.', 'Desde acá se registran las bajas automáticas.'],
      ojo: ['Las reincorporaciones las hace Dirección o Secretaría.']
    },
    secretaria: {
      t: 'Cifras por trayecto', corto: 'Totales por trayecto, matrícula, POF/POFA y SISGE.',
      que: 'Resumen de inscriptos, bajas y egresados por trayecto, para planillas y relevamientos.',
      pasos: ['Elegí el ciclo lectivo y revisá los totales.', '«📑 Planilla de matrícula (POF/POFA)» y «🏫 Matrícula escolar» arman los documentos oficiales.', '«📤 Exportar para SISGE» descarga el Excel de estudiantes del ciclo.', '«📊 Descargar Excel» y «📋 Copiar tabla» sacan los totales.']
    },
    preinscripciones: {
      t: 'Preinscripciones', corto: 'Solicitudes de inscripción online.',
      que: 'Bandeja de las preinscripciones que llegan por el formulario público.',
      pasos: ['Cada preinscripción trae la ficha completa; «Ver / editar» permite corregirla.', '«Confirmar» crea la cuenta (si no tenía) y la inscribe en el trayecto; también se puede rechazar.', 'Arriba se abre o cierra la inscripción del ciclo y se copia el link o descarga el QR.'],
      ojo: ['Cada ficha se guarda sola como PDF en el Drive del CFP.'],
      porRol: { docente: { que: 'Podés consultar las preinscripciones de tus trayectos (solo lectura).', pasos: ['Revisá quiénes se anotaron en tus cursos.', 'Confirmar o rechazar lo hacen Secretaría o Dirección.'], ojo: [] } }
    },
    cuentas: {
      t: 'Cuentas y claves', corto: 'Restablecer claves y aprobar registros.',
      que: 'Ayuda a estudiantes y docentes que no pueden ingresar.',
      pasos: ['Buscá a la persona por nombre o DNI.', '«Restablecer clave» vuelve a la clave inicial y cierra sus sesiones; avisale que la cambie.', '«Aprobar» habilita a quienes se registraron solos y quedaron pendientes.']
    },
    observaciones: {
      t: 'Observaciones', corto: 'Registro institucional de observaciones.',
      que: 'Registro compartido del personal sobre situaciones de estudiantes y del equipo.',
      pasos: ['«Nueva observación» registra una situación; podés sumar seguimientos a una abierta.', 'Se puede adjuntar un acta o correo.', 'La persona observada la lee y queda registrada la lectura.'],
      ojo: ['Es información interna: no la ven los estudiantes.']
    },
    cooperadora: {
      t: 'Cooperadora', corto: 'Socios, caja, balance, PIA y nómina de autoridades.',
      que: 'Gestión de la Cooperadora Escolar (solo Dirección y Secretaría).',
      pasos: ['Socios, Ingresos y Egresos (con medio de pago y mes de la cuota), Balance, Ejercicio / PIA.', '«Nómina de autoridades» arma la nómina oficial con la comisión del ejercicio y la imprime en PDF.', 'Constancias: pago de cuota social de cada socio.'],
      ojo: ['No se cargan movimientos con fecha fuera de un ejercicio creado.']
    },
    planilla: {
      t: 'Planilla de matrícula', corto: 'Planilla mensual POF/POFA.',
      que: 'Planilla de información básica de matrícula.',
      pasos: ['Elegí el ciclo lectivo: se arma con los datos de los trayectos.', 'Revisá y descargá el Excel.']
    },
    constancias: {
      t: 'Constancias', corto: 'Constancias de alumno regular y de examen.',
      que: 'Emisión de constancias en PDF.',
      pasos: ['Buscá al estudiante y elegí el tipo de constancia.', 'Se genera el PDF listo para imprimir y firmar.']
    },
    actas: {
      t: 'Actas y Certificados', corto: 'Fichas de curso, actas de examen y certificados.',
      que: 'Documentos de cierre de cada trayecto, en dos pestañas de la misma pantalla.',
      pasos: ['«Fichas / Actas de Examen»: notas por módulo, ajustes, equivalencias y Excel con el formato del CFP.', '«Emitir certificados»: arma los PDF en la plantilla oficial según el catálogo de FP.']
    },
    'nuevo-trayecto': {
      t: 'Cargar trayecto', corto: 'Dar de alta un trayecto formativo.',
      que: 'Alta de un trayecto nuevo.',
      pasos: ['Completá nombre, ciclo lectivo, resolución, docente, módulos, horario, sede y fechas.', 'Aparece en la preinscripción cuando su ciclo coincide con el ciclo abierto.']
    },
    novedades: {
      t: 'Novedades y calendario', corto: 'Avisos y fechas importantes.',
      que: 'Avisos que ven los usuarios y calendario.',
      pasos: ['«Publicar» crea un aviso; se puede editar, ocultar o borrar.'],
      porRol: {
        docente: { que: 'Avisos internos para tus trayectos.', pasos: ['Elegí el trayecto, escribí título y texto y, si querés, fecha de evento o vencimiento.', 'Quienes cursan lo ven arriba de su panel.'] },
        secretaria: { que: 'Avisos generales o de un trayecto.', pasos: ['Podés elegir si también se muestran en la web pública y ocultarlos después de una fecha.'] }
      }
    },
    usuarios: {
      t: 'Usuarios y roles', corto: 'Altas, roles e inhabilitaciones.',
      que: 'Gestión de las cuentas de la plataforma.',
      pasos: ['«+ Crear Nuevo Usuario» da de alta personal o estudiantes.', 'El desplegable cambia el rol; inhabilitar conserva el historial.'],
      ojo: ['El rol Administrador solo lo asigna y modifica la Dirección.']
    },
    backups: { t: 'Control y respaldo', corto: 'Base de datos, auditoría y estadísticas.', que: 'Un solo botón con tres pestañas: Base de datos (espacio usado y respaldos), Auditoría (quién cambió qué y cuándo) y Estadísticas (certificados, bajas y estudiantes en varios trayectos).', pasos: ['Cambiá de pestaña arriba.', 'Base de datos: revisá el espacio usado respecto del límite del plan.', 'Auditoría: filtrá por persona, rol o fechas.', 'Estadísticas: agrupá por especialidad o por sector.'] },
    dashboard: { t: 'Dashboard', corto: 'Panorama general del CFP.', que: 'Resumen de trayectos, matrícula y aprobados.', pasos: ['Mirá los indicadores principales.'] }
  },

  // Botón del menú → pantalla
  BOTON_TEMA: {
    'btn-dashboard': 'dashboard', 'btn-progreso': 'progreso', 'btn-seguimiento': 'seguimiento',
    'btn-secretaria': 'secretaria', 'btn-preinscripciones': 'preinscripciones', 'btn-cuentas': 'cuentas',
    'btn-observaciones': 'observaciones', 'btn-cooperadora': 'cooperadora', 'btn-planilla': 'planilla',
    'btn-constancias': 'constancias', 'btn-trayectos': 'trayectos', 'btn-actas': 'actas',
    'btn-nuevo-trayecto': 'nuevo-trayecto', 'btn-novedades': 'novedades',
    'btn-usuarios': 'usuarios', 'btn-backups': 'backups'
  },

  rolActual() {
    const p = (window.Auth && Auth.usuarioActual) || {};
    let r = String(p.rol || '').toLowerCase().trim();
    if (r === 'secretario') r = 'secretaria';
    return r;
  },
  // Estudiantes, docentes y Secretaría tienen ayuda; la Dirección no.
  tieneAyuda() { return !!this.ROLES[this.rolActual()]; },

  pantalla(id, rol) {
    const t = this.PANTALLAS[id];
    if (!t) return null;
    const o = (t.porRol && t.porRol[rol]) || {};
    return { id, t: t.t, corto: o.corto || t.corto, que: o.que || t.que, pasos: o.pasos || t.pasos || [], ojo: o.ojo !== undefined ? o.ojo : (t.ojo || []) };
  },

  htmlPantalla(t) {
    return `<p class="ayuda-que">${this.esc(t.que)}</p>
      ${t.pasos.length ? `<ol>${t.pasos.map(p => `<li>${this.esc(p)}</li>`).join('')}</ol>` : ''}
      ${t.ojo && t.ojo.length ? `<div class="ayuda-ojo"><strong>Tené en cuenta</strong><ul>${t.ojo.map(o => `<li>${this.esc(o)}</li>`).join('')}</ul></div>` : ''}`;
  },

  /* «?» del encabezado: explica la pantalla actual */
  deEstaPantalla() {
    const rol = this.rolActual();
    let t = this.pantalla(this.tabActual, rol);
    if (!t && this.tabActual === 'ayuda') t = { t: 'Ayuda', que: 'Acá está la guía completa de tu rol, con el recorrido guiado y la opción de imprimirla.', pasos: [], ojo: [] };
    if (!t) t = { t: 'Ayuda', que: 'Para esta pantalla no hay una explicación particular. En «Ayuda» (menú) tenés la guía completa de tu rol.', pasos: [], ojo: [] };
    Swal.fire({
      title: t.t, html: `<div class="ayuda-popup">${this.htmlPantalla(t)}</div>`, width: 620, showCancelButton: true,
      confirmButtonText: 'Entendido', cancelButtonText: 'Ver guía completa', reverseButtons: true, focusConfirm: true
    }).then(r => { if (r.dismiss === Swal.DismissReason.cancel && window.UI) UI.showTab('ayuda'); });
  },

  actualizarBotonPantalla() {
    const b = document.getElementById('btn-ayuda-pantalla');
    if (b) b.style.display = this.tieneAyuda() ? '' : 'none';
  },

  /* Recorrido guiado */
  claveRecorrido() {
    const p = (window.Auth && Auth.usuarioActual) || {};
    return 'cfp401_recorrido_v1_' + String(p.id || p.dni || 'u');
  },
  yaVioRecorrido() { try { return localStorage.getItem(this.claveRecorrido()) === '1'; } catch (e) { return !!this._visto; } },
  marcarVisto() { this._visto = true; try { localStorage.setItem(this.claveRecorrido(), '1'); } catch (e) { /* sin almacenamiento */ } },

  iniciarSiPrimeraVez() {
    this.actualizarBotonPantalla();
    if (this._corriendo || !this.tieneAyuda() || this.yaVioRecorrido()) return;
    const app = document.getElementById('app-screen');
    if (!app || app.style.display === 'none') return;
    this.iniciarRecorrido();
  },

  esCelular() { const b = document.getElementById('btn-menu-movil'); return !!(b && getComputedStyle(b).display !== 'none'); },
  visible(el) { return !!(el && getComputedStyle(el).display !== 'none' && el.getClientRects().length); },

  armarPasos() {
    const rol = this.rolActual();
    const pasos = [{
      titulo: '¡Bienvenido/a a la plataforma del ' + this.NOMBRE_CORTO + '!',
      texto: `Te mostramos rápido lo que podés hacer como <strong>${this.esc(this.ROLES[rol] || '')}</strong>. Podés salir cuando quieras y volver a verlo desde «Ayuda».`
    }];
    document.querySelectorAll('.sidebar-nav .nav-item-btn').forEach(b => {
      if (!this.visible(b)) return;
      if (b.id === 'btn-ayuda') { pasos.push({ el: b, lateral: true, titulo: 'Ayuda', texto: 'Acá está la guía completa de tu rol, este recorrido y la opción de imprimirla.' }); return; }
      const t = this.pantalla(this.BOTON_TEMA[b.id], rol);
      if (t) pasos.push({ el: b, lateral: true, titulo: t.t, texto: t.corto || t.que });
    });
    const clave = [...document.querySelectorAll('.sidebar button')].find(b => /Cambiar mi contraseña/.test(b.textContent));
    if (this.visible(clave)) pasos.push({ el: clave, lateral: true, titulo: 'Tu contraseña', texto: 'Cambiala por una propia la primera vez que entres.' });
    const inst = document.querySelector('.sidebar .app-boton-instalar');
    if (this.visible(inst)) pasos.push({ el: inst, lateral: true, titulo: 'Instalar la app', texto: 'Dejá la plataforma como un ícono en tu celular o computadora.' });
    const q = document.getElementById('btn-ayuda-pantalla');
    if (this.visible(q)) pasos.push({ el: q, lateral: false, titulo: 'El botón «?»', texto: 'En cualquier pantalla, tocá este botón y te explica para qué sirve y cómo se usa.' });
    pasos.push({ titulo: '¡Listo!', texto: 'Cualquier duda, entrá en «Ayuda». ¡Que te sea de mucha utilidad!' });
    return pasos;
  },

  iniciarRecorrido() {
    this.cerrarRecorrido(false);
    this._pasos = this.armarPasos(); this._i = 0; this._corriendo = true; this._celular = this.esCelular();
    const v = document.createElement('div');
    v.id = 'ayuda-tour';
    v.innerHTML = '<div class="ayuda-tour-foco"></div><div class="ayuda-tour-card" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(v);
    this._teclas = e => { if (e.key === 'Escape') this.cerrarRecorrido(true); else if (e.key === 'ArrowRight') this.siguiente(); else if (e.key === 'ArrowLeft') this.anterior(); };
    this._resize = () => this.mostrarPaso();
    document.addEventListener('keydown', this._teclas);
    window.addEventListener('resize', this._resize);
    this.mostrarPaso();
  },
  siguiente() { if (this._i >= this._pasos.length - 1) return this.cerrarRecorrido(true); this._i++; this.mostrarPaso(); },
  anterior() { if (this._i > 0) { this._i--; this.mostrarPaso(); } },
  cerrarRecorrido(marcar) {
    const v = document.getElementById('ayuda-tour');
    if (v) v.remove();
    if (this._teclas) document.removeEventListener('keydown', this._teclas);
    if (this._resize) window.removeEventListener('resize', this._resize);
    if (this._celular && window.UI && UI.toggleMenu) UI.toggleMenu(false);
    this._corriendo = false;
    if (marcar) this.marcarVisto();
  },
  mostrarPaso() {
    const v = document.getElementById('ayuda-tour');
    if (!v) return;
    const p = this._pasos[this._i], total = this._pasos.length;
    const foco = v.querySelector('.ayuda-tour-foco'), card = v.querySelector('.ayuda-tour-card');
    if (this._celular && window.UI && UI.toggleMenu) UI.toggleMenu(!!(p.el && p.lateral));
    card.innerHTML = `
      <button type="button" class="ayuda-tour-x" aria-label="Cerrar recorrido">×</button>
      <h4>${p.titulo}</h4><p>${p.texto}</p>
      <div class="ayuda-tour-pie"><span>${this._i + 1} / ${total}</span><span>
        ${this._i > 0 ? '<button type="button" class="ayuda-tour-ant">Anterior</button>' : ''}
        <button type="button" class="ayuda-tour-sig">${this._i === total - 1 ? 'Finalizar' : 'Siguiente'}</button></span></div>`;
    card.querySelector('.ayuda-tour-x').onclick = () => this.cerrarRecorrido(true);
    card.querySelector('.ayuda-tour-sig').onclick = () => this.siguiente();
    const ant = card.querySelector('.ayuda-tour-ant');
    if (ant) ant.onclick = () => this.anterior();
    const colocar = () => {
      const m = 12, cw = Math.min(340, window.innerWidth - 2 * m);
      card.style.width = cw + 'px';
      if (!p.el) {
        foco.style.cssText = 'left:50%;top:50%;width:0;height:0;';
        card.style.left = Math.max(m, (window.innerWidth - cw) / 2) + 'px';
        card.style.top = Math.max(m, window.innerHeight / 2 - card.offsetHeight / 2) + 'px';
        return;
      }
      const r = p.el.getBoundingClientRect(), pad = 5;
      foco.style.left = (r.left - pad) + 'px'; foco.style.top = (r.top - pad) + 'px';
      foco.style.width = (r.width + 2 * pad) + 'px'; foco.style.height = (r.height + 2 * pad) + 'px';
      const ch = card.offsetHeight;
      let left = r.right + 16, top = r.top + r.height / 2 - ch / 2;
      if (left + cw > window.innerWidth - m) { left = Math.min(Math.max(m, r.left), window.innerWidth - cw - m); top = r.bottom + 14; }
      if (top + ch > window.innerHeight - m) top = window.innerHeight - ch - m;
      card.style.left = left + 'px'; card.style.top = Math.max(m, top) + 'px';
    };
    if (p.el && p.el.scrollIntoView) p.el.scrollIntoView({ block: 'center', inline: 'nearest' });
    colocar(); setTimeout(colocar, 260); setTimeout(colocar, 650);
  },

  /* ------------------------------ CONTENIDO ------------------------------ */
  claveCambiar: `<ol><li>Tocá <b>Cambiar mi contraseña</b>, abajo a la izquierda del menú (en el celular, abrí el menú con ☰).</li><li>Escribí la contraseña nueva (mínimo 8 caracteres) y guardá.</li><li>La próxima vez ingresás con la nueva.</li></ol><div class="ay-tip">No compartas tu contraseña con nadie. Si la olvidás, pedí en el CFP que te la restablezcan.</div>`,
  instalarApp: `<p>Podés usar la plataforma como una app, con su ícono en el celular o en la computadora.</p><ol><li>Tocá <b>📲 Instalar la app</b>, abajo en el menú.</li><li>Confirmá la instalación. Si no aparece el botón, en el celular abrí el menú del navegador y elegí <b>"Agregar a la pantalla de inicio"</b>.</li></ol><p>Es la misma plataforma: los datos siempre se leen de internet, así que necesitás conexión para ver y guardar información.</p>`,

  temas(rol) {
    if (rol === 'estudiante') return [
      { ico: '🚀', t: 'Primeros pasos: cambiar mi contraseña', r: 'Hacelo la primera vez que ingresás.', h: `<p>El CFP te da tu <b>usuario</b> (tu DNI) y una <b>clave inicial</b>. Para ingresar: en la página del CFP tocá <b>Ingresar / Registrarse</b>, elegí el rol <b>Estudiante</b> y completá usuario y contraseña.</p>${this.claveCambiar}` },
      { ico: '📚', t: 'Mis cursos, clases y contenidos', r: 'Dónde está el material de cada curso.', h: `<ol><li>Entrá a <b>Mis Trayectos Formativos</b> (menú de la izquierda).</li><li>Elegí tu curso. Vas a ver los módulos y las clases con sus contenidos (teoría, links y actividades).</li><li>Las clases con una fecha límite muestran el aviso de vencimiento.</li></ol><div class="ay-tip">Algunas clases pueden ser "solo para vos": es material pensado para tu caso.</div>` },
      { ico: '📝', t: 'Hacer y entregar actividades', r: 'Cómo enviar tu trabajo y ver la nota.', h: `<ol><li>Abrí la clase y la actividad.</li><li>Leé la consigna y completala (según la actividad: respondés en la plataforma o seguís el link/consigna).</li><li>Tocá <b>Enviar</b>.</li><li>Cuando el docente la corrija, vas a ver tu <b>nota</b> y la <b>devolución</b> en la misma actividad.</li></ol><div class="ay-tip">Si una actividad no te deja enviar, avisale a tu docente: puede estar fuera de fecha o no habilitada para vos.</div>` },
      { ico: '📈', t: 'Mi progreso: notas, asistencia y módulos', r: 'Cómo se calcula y qué significa cada cosa.', h: `<p>Entrá a <b>Mi progreso</b>. Ahí ves cada módulo con su estado (cursando, aprobado o bloqueado), tu <b>asistencia</b> y el <b>promedio</b> de tus actividades.</p><ul><li>La nota del módulo combina el promedio de actividades y el porcentaje de asistencia.</li><li>Se aprueba con <b>70 o más</b>.</li><li>Un módulo se habilita al aprobar el anterior (o por una habilitación excepcional del CFP).</li><li>Si terminás el trayecto, ves tu <b>N.º de egresado/a</b>.</li></ul><p>Desde ahí, el botón <b>Ir a mis clases y actividades</b> te lleva al curso.</p>` },
      { ico: '🔔', t: 'Avisos y notificaciones', r: 'Cómo enterarte de las novedades.', h: `<ul><li>Los <b>avisos vigentes</b> del CFP y de tus cursos aparecen arriba de <b>Mis trayectos</b> y de <b>Mi progreso</b>.</li><li>La <b>campanita 🔔</b> te avisa de novedades, como una actividad corregida.</li></ul>` },
      { ico: '📲', t: 'Instalar la plataforma como app', r: 'Tenerla en tu celular como cualquier app.', h: this.instalarApp },
      { ico: '🛠️', t: 'Problemas frecuentes', r: 'Qué hacer si algo no funciona.', h: `<table class="ay-tabla"><tr><td>No puedo ingresar</td><td>Revisá que el usuario sea tu DNI, sin puntos, y el rol sea Estudiante. Si no te acordás de la clave, pedí en el CFP que te la restablezcan.</td></tr><tr><td>No me aparece mi curso</td><td>Puede que tu inscripción todavía no esté confirmada. Consultá en el CFP.</td></tr><tr><td>No puedo enviar una actividad</td><td>Probá recargar la página. Si sigue, avisale al docente.</td></tr><tr><td>Un dato mío está mal</td><td>Avisá en el CFP para que lo corrijan.</td></tr></table>` }
    ];

    if (rol === 'docente') return [
      { ico: '🚀', t: 'Primeros pasos: ingresar y cambiar la contraseña', r: 'Qué ve cada docente y cómo cuidar la cuenta.', h: `<p>Ingresás con el rol <b>Docente</b>. Ves solo tus trayectos (y los que cubrís como suplente). El menú tiene: <b>Seguimiento, Observaciones, Preinscripciones, Planilla de matrícula, Trayectos, Novedades</b> y esta <b>Ayuda</b>.</p>${this.claveCambiar}` },
      { ico: '📚', t: 'Mis trayectos, módulos y clases', r: 'Dónde se carga todo lo de tu curso.', h: `<ol><li>Entrá a <b>Mis Trayectos Formativos</b> y abrí el curso.</li><li>Dentro encontrás las clases, la asistencia, el libro de temas y la planificación.</li><li>Si el trayecto tiene módulos, elegí el módulo al cargar clases, asistencia o actividades; si no, usá "General del trayecto".</li></ol>` },
      { ico: '✅', t: 'Tomar asistencia', r: 'Cargar, corregir y bajar la planilla.', h: `<ol><li>En el trayecto, abrí <b>Asistencia</b> y elegí la <b>fecha de la clase</b> (y el módulo, si corresponde).</li><li>Si ese día hubo clase, tocá <b>"Sí hubo clase: tomar asistencia"</b>. Si no hubo, marcá <b>"Sin clase"</b>.</li><li>Marcá a cada estudiante: <b>P</b> presente, <b>T</b> tarde (cuenta como presente), <b>A</b> ausente o <b>J</b> justificado (cuenta como ausente). También hay <b>Todos presentes / Todos ausentes</b>.</li><li>Tocá <b>Guardar asistencia</b>.</li></ol><p>Para corregir, elegí otra vez la fecha: aparece lo ya cargado. La <b>Planilla del mes (Excel)</b> la bajás desde el mismo panel.</p><div class="ay-tip">Si el trayecto no computa asistencia (por ejemplo, virtual), podés registrarla pero no cuenta para las notas.</div>` },
      { ico: '🧩', t: 'Publicar clases y actividades', r: 'Contenidos, consignas, fechas y destinatarios.', h: `<ol><li>En el trayecto, creá una <b>clase</b> con título, descripción, material (links) y, si hace falta, una <b>fecha límite</b>.</li><li>Elegí el <b>módulo</b> y a quién va dirigida: <b>todo el grupo</b> o un solo estudiante.</li><li>Marcá si <b>es una evaluación</b> o si es solo registro (sin nota que cuente para el promedio).</li><li>Guardá. Si dejás la fecha de publicación vacía, se publica ahora.</li></ol>` },
      { ico: '🖊️', t: 'Corregir entregas y poner notas', r: 'Nota de 0 a 100 y devolución.', h: `<ol><li>Entrá a <b>Seguimiento → Entregas por corregir</b>: ahí están todas las entregas sin nota de tus trayectos.</li><li>Abrí la entrega, poné la <b>calificación (0 a 100)</b> y, si querés, una <b>devolución</b> para el estudiante.</li><li>Guardá: el estudiante la ve en su plataforma.</li></ol>` },
      { ico: '⚠️', t: 'Seguimiento: estudiantes en riesgo', r: 'Detectar a tiempo a quien se está alejando.', h: `<p>En <b>Seguimiento → Alumnos en riesgo</b> figuran quienes tienen <b>asistencia menor a 70 %</b>, <b>promedio menor a 70</b> o <b>ninguna entrega</b>. Sirve para contactarlos antes de que abandonen.</p>` },
      { ico: '📖', t: 'Libro de temas y planificación', r: 'Registrar lo dictado y planificar.', h: `<ul><li><b>Libro de temas:</b> por cada clase dictada cargás fecha, tema y actividad (<b>➕ Cargar clase dictada</b>). Se puede <b>🖨️ imprimir</b>. La Dirección lo visa y puede dejar observaciones, que vos ves pero no editás.</li><li><b>Planificación:</b> fundamentación, objetivos y demás campos, por trayecto (y por módulo si lo tiene). Guardala con <b>💾 Guardar planificación</b>.</li></ul>` },
      { ico: '🚪', t: 'Bajas de estudiantes', r: 'Dar de baja y registrar bajas automáticas.', h: `<ul><li><b>Dar de baja:</b> en la lista de estudiantes del trayecto, elegí al estudiante, la <b>fecha</b> y el <b>motivo</b> (abandono, razones laborales o de salud, cambio de trayecto o turno, entre otros).</li><li><b>Registrar bajas automáticas:</b> desde <b>Seguimiento</b>, para tus trayectos.</li></ul><p>Solo podés dar de baja a estudiantes de <b>tus</b> cursos. Las reincorporaciones las hace Dirección o Secretaría.</p>` },
      { ico: '📣', t: 'Novedades de tus trayectos', r: 'Avisos internos para tus estudiantes.', h: `<p>En <b>Novedades</b> podés publicar un aviso para uno de tus trayectos: elegí el trayecto, escribí título y texto, y si querés una fecha de evento o de vencimiento. Quienes cursan lo ven arriba de su panel.</p>` },
      { ico: '📋', t: 'Preinscripciones, observaciones y planilla', r: 'Consultas que podés hacer.', h: `<ul><li><b>Preinscripciones:</b> ves las de tus trayectos, solo para consultar (quien confirma es Secretaría o Dirección).</li><li><b>Observaciones:</b> las observaciones institucionales que te dejaron o que registrás, según tus permisos. Si te dejan una, la leés y queda registrada la lectura.</li><li><b>Planilla de matrícula:</b> descarga en Excel con los datos de los trayectos.</li><li><b>Ficha del alumno:</b> tocá el nombre de un estudiante (en la asistencia o en Seguimiento) y se abre su ficha con datos, trayectos y entregas.</li></ul>` },
      { ico: '📲', t: 'Instalar la plataforma como app', r: 'Usarla desde el celular.', h: this.instalarApp },
      { ico: '🛠️', t: 'Problemas frecuentes', r: 'Qué hacer si algo no funciona.', h: `<table class="ay-tabla"><tr><td>No veo un trayecto mío</td><td>Avisá en el CFP para que revisen la asignación del docente o la suplencia.</td></tr><tr><td>Un estudiante no figura en la lista</td><td>Puede no estar inscripto todavía o tener baja. Consultá en Secretaría.</td></tr><tr><td>Me equivoqué en la asistencia</td><td>Elegí de nuevo esa fecha: se muestra lo cargado y lo podés corregir.</td></tr><tr><td>Olvidé mi contraseña</td><td>Pedí en el CFP que te la restablezcan.</td></tr></table>` }
    ];

    if (rol === 'secretaria') return [
      { ico: '🚀', t: 'Primeros pasos y qué hay en el menú', r: 'Un recorrido por lo que ves.', h: `<p>Tenés los mismos permisos que la Dirección, salvo asignar o modificar cuentas de <b>Administrador</b>, que solo hace la Dirección. En el menú: <b>Dashboard, Seguimiento, Cifras por trayecto, Preinscripciones, Cuentas y claves, Observaciones, Cooperadora, Planilla de matrícula, Constancias, Trayectos Formativos, Fichas / Actas de Examen, Cargar Trayecto, Emitir Certificados, Novedades, Usuarios y Roles</b> y <b>Control y respaldo</b>.</p>${this.claveCambiar}` },
      { ico: '📝', t: 'Preinscripciones: abrir, revisar y confirmar', r: 'El circuito completo de la inscripción online.', h: `<ol><li><b>Abrir:</b> en <b>Preinscripciones</b>, arriba, indicá el <b>ciclo lectivo</b>, ponela en <b>Abierta</b> y, si querés, un mensaje para quienes se inscriben. Guardá. Solo aparecen los trayectos del ciclo elegido.</li><li><b>Difundir:</b> copiá el <b>link</b> o descargá el <b>QR</b> para el cartel y las redes.</li><li><b>Revisar:</b> las preinscripciones se agrupan por trayecto. Abrí una con <b>Ver / editar</b> para corregir datos.</li><li><b>Confirmar:</b> crea la cuenta del estudiante (usuario = DNI, con clave inicial) y lo inscribe en el trayecto. Si ya tenía cuenta, solo lo inscribe.</li><li><b>Rechazar</b> si corresponde. Cada persona puede tener hasta 5 preinscripciones por ciclo.</li></ol><div class="ay-tip">Cada ficha se guarda sola como PDF en el Drive del CFP. Tenés además la <b>Ficha en blanco (PDF)</b> para quienes se inscriben en papel.</div>` },
      { ico: '📊', t: 'Cifras, matrícula escolar, POF/POFA y SISGE', r: 'Los números del ciclo y las exportaciones.', h: `<p>En <b>Cifras por trayecto</b> elegís el <b>ciclo</b> y ves inscriptos, bajas y egresados por trayecto. Arriba a la derecha:</p><ul><li><b>📑 Planilla de matrícula (POF/POFA)</b>: Excel con el formato oficial.</li><li><b>🏫 Matrícula escolar</b>: cifras por nacionalidad, discapacidad (con CUD y apoyo), etc.</li><li><b>📤 Exportar para SISGE</b>: Excel de estudiantes del ciclo con las columnas de SISGE. Lo que falte se completa con valores por defecto y se ofrece una lista de datos para revisar.</li><li><b>📋 Copiar tabla</b> y <b>📊 Descargar Excel</b>.</li></ul>` },
      { ico: '🔑', t: 'Cuentas y claves', r: 'Restablecer claves y aprobar pendientes.', h: `<p>En <b>Cuentas y claves</b> buscás a una persona por nombre o DNI y podés <b>restablecer su clave</b> (vuelve a la clave inicial) o <b>aprobar</b> a quienes se registraron y quedaron pendientes.</p>` },
      { ico: '👥', t: 'Usuarios y roles', r: 'Alta, roles e inhabilitaciones.', h: `<ul><li><b>+ Crear Nuevo Usuario:</b> completá apellido, nombre, DNI y rol. Si es estudiante, podés inscribirlo en trayectos.</li><li>Cambiá el <b>rol</b> con el desplegable (Estudiante, Docente, Secretaría).</li><li>Con ✏️ corregís apellido, nombre y correo. En el personal (docentes, Secretaría, Dirección) <b>el correo cambia también el de acceso</b>: desde ese momento ingresan con ese correo. Los estudiantes siguen ingresando con el DNI.</li><li><b>Inhabilitar / Reactivar</b> conserva el historial; ✏️ corrige datos; 🔑 restablece clave; 🗑️ elimina definitivamente (usalo solo en casos puntuales).</li></ul><div class="ay-tip">El rol <b>Administrador</b> solo lo asigna y modifica la Dirección.</div>` },
      { ico: '💰', t: 'Cooperadora', r: 'Socios, ingresos y egresos, balance, PIA y nómina.', h: `<p>La sección es solo para Dirección y Secretaría. Pestañas:</p><ul><li><b>Socios:</b> padrón de la cooperadora (independiente de los estudiantes).</li><li><b>Ingresos y Egresos:</b> elegí fecha, rubro, monto y el <b>medio</b>: <i>Caja chica</i> es efectivo; <i>Banco cuenta corriente</i>, transferencias y depósitos. Para una cuota, elegí el socio y el <b>mes que cubre</b>.</li><li><b>Balance:</b> mensual y anual.</li><li><b>Ejercicio / PIA:</b> datos del ejercicio y <b>📄 Generar PIA en PDF</b>.</li><li><b>Nómina de autoridades:</b> cargá la Comisión Directiva, la Revisora y el Representante ante la Federación e <b>imprimí la nómina oficial en PDF</b>.</li><li><b>Constancias:</b> constancia de pago de cuota social de cada socio.</li></ul>` },
      { ico: '🧾', t: 'Constancias, actas y certificados', r: 'Los documentos de los estudiantes.', h: `<ul><li><b>Constancias:</b> de alumno regular y de examen, en PDF.</li><li><b>Actas y Certificados</b> (un solo botón del menú, con dos pestañas): <b>Fichas / Actas de Examen</b> (notas por módulo, ajustes, equivalencias, datos del acta y Excel con el formato del CFP) y <b>Emitir certificados</b> (arma los PDF en la plantilla oficial, según el catálogo de FP).</li><li><b>Fichas de curso:</b> se descargan desde cada trayecto.</li></ul>` },
      { ico: '👀', t: 'Seguimiento, bajas y observaciones', r: 'Acompañar a los estudiantes y al equipo.', h: `<ul><li><b>Seguimiento:</b> entregas por corregir y estudiantes en riesgo (asistencia o promedio menor a 70, o sin entregas). Desde ahí se registran <b>bajas automáticas</b> y se <b>reincorpora</b>.</li><li><b>Observaciones:</b> registro administrativo y pedagógico entre niveles de conducción, docentes y estudiantes. La persona observada lo lee y queda registrada la lectura.</li></ul>` },
      { ico: '📣', t: 'Novedades y calendario', r: 'Avisos generales y por trayecto.', h: `<p>En <b>Novedades</b> publicás avisos generales o de un trayecto (aviso, inscripciones, inicio de cursada, feriado, mesa de examen, acto). Podés elegir si también se muestran en la <b>web pública</b> y ocultarlos después de una fecha.</p>` },
      { ico: '🏫', t: 'Trayectos: cargar y editar', r: 'Dar de alta cursos del ciclo.', h: `<ol><li><b>Cargar Trayecto:</b> nombre, ciclo lectivo, N.º de curso, resolución, docente, módulos, horario, sede y fechas.</li><li>Al editarlo podés agregar <b>suplentes</b>.</li><li>El trayecto aparece en el desplegable de la preinscripción cuando su <b>ciclo lectivo</b> coincide con el ciclo abierto.</li></ol>` },
      { ico: '🗄️', t: 'Control y respaldo: base de datos, auditoría y estadísticas', r: 'Un solo botón del menú, con tres pestañas.', h: `<ul><li><b>Base de datos:</b> espacio utilizado y copias de respaldo.</li><li><b>Auditoría:</b> quién cambió qué y cuándo, con filtros por persona, rol y fechas. Además, cada domingo se guarda una copia de la auditoría en el Drive.</li><li><b>Estadísticas:</b> certificados, bajas y estudiantes en más de un trayecto, por especialidad o sector.</li></ul>` },
      { ico: '📲', t: 'Instalar la plataforma como app', r: 'Usarla desde el celular o la compu.', h: this.instalarApp },
      { ico: '🛠️', t: 'Problemas frecuentes', r: 'Dudas habituales.', h: `<table class="ay-tabla"><tr><td>Una persona no ve su curso</td><td>Revisá que su preinscripción esté <b>confirmada</b> y que no tenga baja en el trayecto.</td></tr><tr><td>"Este DNI ya tiene 5 preinscripciones"</td><td>Es el tope por ciclo. Se puede cargar la inscripción manualmente desde Usuarios y Roles.</td></tr><tr><td>El Excel de SISGE sale con datos por defecto</td><td>Descargá la lista "datos a completar" y completá la ficha del estudiante.</td></tr><tr><td>No puedo cambiar un rol a Administrador</td><td>Es a propósito: solo lo hace la Dirección.</td></tr></table>` }
    ];
    return [];
  },

  /* ------------------------------ PANTALLA ------------------------------ */
  async cargar() {
    const cont = document.getElementById('ayuda-contenido');
    if (!cont) return;
    const perfil = (window.Auth && Auth.usuarioActual) || await Auth.obtenerPerfilSesion();
    const rol = String(perfil?.rol || '').toLowerCase().trim();
    this.rol = (rol === 'secretario') ? 'secretaria' : rol;
    const temas = this.temas(this.rol);
    if (!temas.length) { cont.innerHTML = '<div class="prog-vacio">No hay una guía de ayuda para tu rol.</div>'; return; }
    cont.innerHTML = this.html(temas);
    this.cargarContacto();
  },

  html(temas) {
    const rotulo = { estudiante: 'estudiantes', docente: 'docentes', secretaria: 'Secretaría' }[this.rol] || '';
    return `<div class="ay-wrap">
      <h2 class="ay-h">¿En qué te podemos ayudar?</h2>
      <p class="ay-sub">Guías cortas para ${this.esc(rotulo)}. Tocá un tema para verlo.</p>
      <div class="ay-barra">
        <input type="search" id="ay-buscar" class="form-control" placeholder="Buscar en la ayuda…" oninput="AyudaModulo.filtrar(this.value)">
        <button type="button" class="btn btn-gold" onclick="AyudaModulo.iniciarRecorrido()">▶ Ver recorrido guiado</button>
        <button type="button" class="btn btn-outline" onclick="AyudaModulo.imprimir()">📄 Imprimir / guardar PDF</button>
      </div>
      <div class="ay-grid">${temas.slice(0, 3).map((t, i) => `<button type="button" class="ay-card" onclick="AyudaModulo.abrir(${i})"><span class="ay-ic">${t.ico}</span><b>${this.esc(t.t.split(':')[0])}</b><small>${this.esc(t.r)}</small></button>`).join('')}</div>
      <div id="ay-lista">${temas.map((t, i) => `<details class="ay-acc" id="ay-t${i}" ${i === 0 ? 'open' : ''}><summary><span>${t.ico} ${this.esc(t.t)}</span></summary><div class="ay-cuerpo">${t.h}</div></details>`).join('')}
        <details class="ay-acc" id="ay-contacto"><summary><span>📞 Contacto del CFP</span></summary><div class="ay-cuerpo" id="ay-contacto-txt">Cargando…</div></details>
      </div>
      <p class="ay-pie">Guía actualizada el ${AYUDA_ACTUALIZADA}.</p>
    </div>`;
  },

  abrir(i) {
    const d = document.getElementById('ay-t' + i);
    if (!d) return;
    document.querySelectorAll('#ay-lista details').forEach(x => { x.open = false; });
    d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  filtrar(q) {
    const t = String(q || '').trim().toLowerCase();
    document.querySelectorAll('#ay-lista details').forEach(d => {
      const coincide = !t || d.textContent.toLowerCase().includes(t);
      d.style.display = coincide ? '' : 'none';
      if (t && coincide) d.open = true;
    });
  },

  async cargarContacto() {
    const el = document.getElementById('ay-contacto-txt');
    if (!el) return;
    try {
      const { data, error } = await supabase.rpc('ayuda_contacto');
      if (error) throw error;
      this.contacto = String(data || '').trim();
    } catch (e) { this.contacto = ''; }
    el.innerHTML = this.contacto
      ? this.contacto.split(/\n/).map(l => `<div>${this.esc(l)}</div>`).join('')
      : 'Consultá en el CFP, en el horario de atención.';
  },

  imprimir() {
    const temas = this.temas(this.rol);
    const win = window.open('', '_blank');
    if (!win) { Swal.fire('Ventana bloqueada', 'Permití las ventanas emergentes para imprimir.', 'info'); return; }
    const rotulo = { estudiante: 'Estudiantes', docente: 'Docentes', secretaria: 'Secretaría' }[this.rol] || '';
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ayuda ${this.esc(rotulo)} · ${this.esc(this.NOMBRE_CORTO)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;margin:16mm 14mm;color:#111;font-size:11pt;line-height:1.45}
        h1{font-size:17pt;margin:0 0 2px}.sub{color:#555;margin:0 0 12px;font-size:10pt}
        h2{font-size:12.5pt;margin:16px 0 4px;color:#0b3a46;border-bottom:1px solid #bbb;padding-bottom:2px;break-after:avoid}
        ul,ol{margin:4px 0 6px;padding-left:20px}li{margin-bottom:3px}
        table{border-collapse:collapse;width:100%}td{border:1px solid #999;padding:4px 7px;vertical-align:top;font-size:10pt}td:first-child{width:32%;font-weight:bold;background:#f2f2f2}
        .ay-tip{background:#fff4e0;border-left:4px solid #e8711a;padding:5px 9px;margin:6px 0;font-size:10pt}
        section{break-inside:avoid-page}
        .pie{margin-top:18px;font-size:9pt;color:#666}
      </style></head><body>
      <h1>Ayuda para ${this.esc(rotulo)} · ${this.esc(this.NOMBRE_CORTO)}</h1><p class="sub">${this.esc(this.NOMBRE_PDF)} · Guía actualizada el ${AYUDA_ACTUALIZADA}</p>
      ${temas.map(t => `<section><h2>${t.ico} ${this.esc(t.t)}</h2>${t.h}</section>`).join('')}
      <section><h2>📞 Contacto del CFP</h2>${this.contacto ? this.contacto.split(/\n/).map(l => `<div>${this.esc(l)}</div>`).join('') : 'Consultá en el CFP, en el horario de atención.'}</section>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    win.document.close();
  }
};
window.AyudaModulo = AyudaModulo;
