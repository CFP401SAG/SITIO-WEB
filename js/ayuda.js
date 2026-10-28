/* ==========================================================================
   AYUDA POR ROL (pestaña "Ayuda" del menú)
   Archivo: js/ayuda.js

   Guías cortas para estudiantes, docentes y Secretaría. La Dirección (administrador)
   no tiene esta pestaña.

   ⚠️ MANTENIMIENTO: cuando se cambie, agregue o quite una funcionalidad que vea un
   rol, hay que actualizar acá la guía de ese rol y la fecha AYUDA_ACTUALIZADA.
   (Regla anotada también en CLAUDE.md.)
   ========================================================================== */

const AYUDA_ACTUALIZADA = '28/10/2026';

const AyudaModulo = {
  contacto: null,    // texto editable desde Preinscripciones → "Contacto del CFP"
  rol: '',

  esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

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
      { ico: '🚀', t: 'Primeros pasos y qué hay en el menú', r: 'Un recorrido por lo que ves.', h: `<p>Tenés los mismos permisos que la Dirección, salvo asignar o modificar cuentas de <b>Administrador</b>, que solo hace la Dirección. En el menú: <b>Dashboard, Seguimiento, Cifras por trayecto, Preinscripciones, Cuentas y claves, Observaciones, Cooperadora, Planilla de matrícula, Constancias, Trayectos Formativos, Fichas / Actas de Examen, Cargar Trayecto, Emitir Certificados, Novedades, Usuarios y Roles, Base de Datos, Estadísticas</b> y <b>Auditoría</b>.</p>${this.claveCambiar}` },
      { ico: '📝', t: 'Preinscripciones: abrir, revisar y confirmar', r: 'El circuito completo de la inscripción online.', h: `<ol><li><b>Abrir:</b> en <b>Preinscripciones</b>, arriba, indicá el <b>ciclo lectivo</b>, ponela en <b>Abierta</b> y, si querés, un mensaje para quienes se inscriben. Guardá. Solo aparecen los trayectos del ciclo elegido.</li><li><b>Difundir:</b> copiá el <b>link</b> o descargá el <b>QR</b> para el cartel y las redes.</li><li><b>Revisar:</b> las preinscripciones se agrupan por trayecto. Abrí una con <b>Ver / editar</b> para corregir datos.</li><li><b>Confirmar:</b> crea la cuenta del estudiante (usuario = DNI, con clave inicial) y lo inscribe en el trayecto. Si ya tenía cuenta, solo lo inscribe.</li><li><b>Rechazar</b> si corresponde. Cada persona puede tener hasta 5 preinscripciones por ciclo.</li></ol><div class="ay-tip">Cada ficha se guarda sola como PDF en el Drive del CFP. Tenés además la <b>Ficha en blanco (PDF)</b> para quienes se inscriben en papel.</div>` },
      { ico: '📊', t: 'Cifras, matrícula escolar, POF/POFA y SISGE', r: 'Los números del ciclo y las exportaciones.', h: `<p>En <b>Cifras por trayecto</b> elegís el <b>ciclo</b> y ves inscriptos, bajas y egresados por trayecto. Arriba a la derecha:</p><ul><li><b>📑 Planilla de matrícula (POF/POFA)</b>: Excel con el formato oficial.</li><li><b>🏫 Matrícula escolar</b>: cifras por nacionalidad, discapacidad (con CUD y apoyo), etc.</li><li><b>📤 Exportar para SISGE</b>: Excel de estudiantes del ciclo con las columnas de SISGE. Lo que falte se completa con valores por defecto y se ofrece una lista de datos para revisar.</li><li><b>📋 Copiar tabla</b> y <b>📊 Descargar Excel</b>.</li></ul>` },
      { ico: '🔑', t: 'Cuentas y claves', r: 'Restablecer claves y aprobar pendientes.', h: `<p>En <b>Cuentas y claves</b> buscás a una persona por nombre o DNI y podés <b>restablecer su clave</b> (vuelve a la clave inicial) o <b>aprobar</b> a quienes se registraron y quedaron pendientes.</p>` },
      { ico: '👥', t: 'Usuarios y roles', r: 'Alta, roles e inhabilitaciones.', h: `<ul><li><b>+ Crear Nuevo Usuario:</b> completá apellido, nombre, DNI y rol. Si es estudiante, podés inscribirlo en trayectos.</li><li>Cambiá el <b>rol</b> con el desplegable (Estudiante, Docente, Secretaría).</li><li><b>Inhabilitar / Reactivar</b> conserva el historial; ✏️ corrige datos; 🔑 restablece clave; 🗑️ elimina definitivamente (usalo solo en casos puntuales).</li></ul><div class="ay-tip">El rol <b>Administrador</b> solo lo asigna y modifica la Dirección.</div>` },
      { ico: '💰', t: 'Cooperadora', r: 'Socios, ingresos y egresos, balance, PIA y nómina.', h: `<p>La sección es solo para Dirección y Secretaría. Pestañas:</p><ul><li><b>Socios:</b> padrón de la cooperadora (independiente de los estudiantes).</li><li><b>Ingresos y Egresos:</b> elegí fecha, rubro, monto y el <b>medio</b>: <i>Caja chica</i> es efectivo; <i>Banco cuenta corriente</i>, transferencias y depósitos. Para una cuota, elegí el socio y el <b>mes que cubre</b>.</li><li><b>Balance:</b> mensual y anual.</li><li><b>Ejercicio / PIA:</b> datos del ejercicio y <b>📄 Generar PIA en PDF</b>.</li><li><b>Nómina de autoridades:</b> cargá la Comisión Directiva, la Revisora y el Representante ante la Federación e <b>imprimí la nómina oficial en PDF</b>.</li><li><b>Constancias:</b> constancia de pago de cuota social de cada socio.</li></ul>` },
      { ico: '🧾', t: 'Constancias, actas y certificados', r: 'Los documentos de los estudiantes.', h: `<ul><li><b>Constancias:</b> de alumno regular y de examen, en PDF.</li><li><b>Actas y Certificados</b> (un solo botón del menú, con dos pestañas): <b>Fichas / Actas de Examen</b> (notas por módulo, ajustes, equivalencias, datos del acta y Excel con el formato del CFP) y <b>Emitir certificados</b> (arma los PDF en la plantilla oficial, según el catálogo de FP).</li><li><b>Fichas de curso:</b> se descargan desde cada trayecto.</li></ul>` },
      { ico: '👀', t: 'Seguimiento, bajas y observaciones', r: 'Acompañar a los estudiantes y al equipo.', h: `<ul><li><b>Seguimiento:</b> entregas por corregir y estudiantes en riesgo (asistencia o promedio menor a 70, o sin entregas). Desde ahí se registran <b>bajas automáticas</b> y se <b>reincorpora</b>.</li><li><b>Observaciones:</b> registro administrativo y pedagógico entre niveles de conducción, docentes y estudiantes. La persona observada lo lee y queda registrada la lectura.</li></ul>` },
      { ico: '📣', t: 'Novedades y calendario', r: 'Avisos generales y por trayecto.', h: `<p>En <b>Novedades</b> publicás avisos generales o de un trayecto (aviso, inscripciones, inicio de cursada, feriado, mesa de examen, acto). Podés elegir si también se muestran en la <b>web pública</b> y ocultarlos después de una fecha.</p>` },
      { ico: '🏫', t: 'Trayectos: cargar y editar', r: 'Dar de alta cursos del ciclo.', h: `<ol><li><b>Cargar Trayecto:</b> nombre, ciclo lectivo, N.º de curso, resolución, docente, módulos, horario, sede y fechas.</li><li>Al editarlo podés agregar <b>suplentes</b>.</li><li>El trayecto aparece en el desplegable de la preinscripción cuando su <b>ciclo lectivo</b> coincide con el ciclo abierto.</li></ol>` },
      { ico: '🗄️', t: 'Base de datos, estadísticas y auditoría', r: 'Control y respaldo.', h: `<ul><li><b>Base de Datos:</b> espacio utilizado y copias de respaldo.</li><li><b>Estadísticas:</b> certificados, bajas y estudiantes en más de un trayecto, por especialidad o sector.</li><li><b>Auditoría:</b> quién cambió qué y cuándo, con filtros por persona, rol y fechas. Además, cada domingo se guarda una copia de la auditoría en el Drive.</li></ul>` },
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
        <button type="button" class="btn btn-gold" onclick="AyudaModulo.imprimir()">📄 Imprimir / guardar PDF</button>
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
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ayuda ${this.esc(rotulo)} · CFP N.º 401</title>
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
      <h1>Ayuda para ${this.esc(rotulo)} · CFP N.º 401</h1><p class="sub">San Andrés de Giles · Guía actualizada el ${AYUDA_ACTUALIZADA}</p>
      ${temas.map(t => `<section><h2>${t.ico} ${this.esc(t.t)}</h2>${t.h}</section>`).join('')}
      <section><h2>📞 Contacto del CFP</h2>${this.contacto ? this.contacto.split(/\n/).map(l => `<div>${this.esc(l)}</div>`).join('') : 'Consultá en el CFP, en el horario de atención.'}</section>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    win.document.close();
  }
};
window.AyudaModulo = AyudaModulo;
