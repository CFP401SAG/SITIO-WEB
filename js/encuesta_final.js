/* ==========================================================================
   ENCUESTA / AUTOEVALUACIÓN DE CIERRE DEL TRAYECTO (CFP 401)
   · Estudiantes: aparece sola 15 días antes del cierre del trayecto (trayectos.fecha_cierre).
   · Dirección, Secretaría y docentes: pantalla «Encuestas» con resultados agrupados
     (nunca individuales). sql/61_encuesta_final.sql
   Las preguntas son casi todas cerradas (escala 1 a 5 y opciones) para poder sistematizarlas;
   el comentario libre es opcional y se agrupa por temas automáticamente.
   ========================================================================== */
const EncuestaFinal = {
  DIAS_ANTES: 15, DIAS_DESPUES: 30, VERSION: 1, MIN_DOCENTE: 3,
  ESCALA: ['Muy en desacuerdo', 'En desacuerdo', 'Ni de acuerdo ni en desacuerdo', 'De acuerdo', 'Muy de acuerdo'],

  DIMENSIONES: [
    { id: 'contenidos', nombre: 'Contenidos', items: [['c1', 'Los contenidos fueron claros y fáciles de seguir.'], ['c2', 'Lo que aprendí me sirve para trabajar o seguir estudiando.']] },
    { id: 'docente', nombre: 'Docente', items: [['d1', 'El/la docente explicó con claridad.'], ['d2', 'El/la docente respondió mis dudas y me acompañó.']] },
    { id: 'practica', nombre: 'Práctica y materiales', items: [['p1', 'Pude practicar lo suficiente.'], ['p2', 'Hubo materiales y herramientas suficientes.']] },
    { id: 'organizacion', nombre: 'Organización e instalaciones', items: [['o1', 'Los horarios y la organización del curso fueron adecuados.'], ['o2', 'Las instalaciones (aula, taller, baños) fueron adecuadas.']] },
    { id: 'auto', nombre: 'Mi autoevaluación', items: [['a1', 'Asistí con regularidad.'], ['a2', 'Participé y cumplí con las actividades.'], ['a3', 'Siento que aprendí lo que me propuse.']] },
    { id: 'global', nombre: 'Valoración general', items: [['g1', 'En general, estoy satisfecho/a con el curso.'], ['g2', 'Recomendaría este curso a otra persona.']] }
  ],
  OPC_MEJOR: [['contenidos', 'Los contenidos'], ['docente', 'El/la docente'], ['practica', 'La práctica en taller'], ['companeros', 'Mis compañeros / el grupo'], ['horarios', 'Los horarios'], ['materiales', 'Los materiales'], ['ninguno', 'Ninguna de las anteriores']],
  OPC_MEJORAR: [['mas_practica', 'Más práctica'], ['materiales', 'Más materiales y herramientas'], ['horarios', 'Los horarios'], ['instalaciones', 'Las instalaciones'], ['claridad', 'Explicaciones más claras'], ['duracion', 'La duración del curso'], ['informacion', 'La información y la comunicación'], ['nada', 'Nada en particular']],
  OPC_SEGUIR: [['si', 'Sí'], ['no', 'No'], ['nose', 'No sé todavía']],

  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  hoy() { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); },
  dias(a, b) { return Math.round((a - b) / 86400000); },
  prom(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; },
  f1(n) { return n == null ? '–' : (Math.round(n * 10) / 10).toString().replace('.', ','); },
  pct(a, b) { return b > 0 ? Math.round(1000 * a / b) / 10 : null; },
  fp(p) { return p == null ? '–' : String(p).replace('.', ',') + ' %'; },

  /* ======================= ESTUDIANTE ======================= */
  pendientes: [],
  async avisar() {
    const box = document.getElementById('encuesta-aviso');
    if (!box) return;
    box.style.display = 'none'; box.innerHTML = '';
    try {
      const perfil = (window.Auth && Auth.usuarioActual) || await Auth.obtenerPerfilSesion();
      const dni = String(perfil?.dni || perfil?.usuario || '').trim();
      if (!dni) return;
      const [rI, rE] = await Promise.all([
        supabase.from('inscripciones').select('trayecto_id,estado').eq('estudiante_user', dni),
        supabase.from('encuestas_finales').select('trayecto_id')
      ]);
      if (rI.error || rE.error) return;                       // sin el SQL 61 simplemente no se muestra
      const ids = (rI.data || []).filter(i => String(i.estado || '').toUpperCase() !== 'BAJA').map(i => i.trayecto_id);
      if (!ids.length) return;
      const hechas = new Set((rE.data || []).map(e => String(e.trayecto_id)));
      const rT = await supabase.from('trayectos').select('id,nombre,fecha_cierre').in('id', ids);
      const hoy = this.hoy();
      this.pendientes = (rT.data || []).filter(t => {
        if (!t.fecha_cierre || hechas.has(String(t.id))) return false;
        const falta = this.dias(new Date(String(t.fecha_cierre).slice(0, 10) + 'T00:00:00Z'), hoy);
        return falta <= this.DIAS_ANTES && falta >= -this.DIAS_DESPUES;
      });
      if (!this.pendientes.length) return;
      box.style.display = 'block';
      box.innerHTML = this.pendientes.map(t => `<div class="ef-aviso"><div><strong>💬 Encuesta de cierre: ${this.esc(t.nombre)}</strong><br><span>Está terminando el curso. Contanos cómo te fue (3 minutos). Es para mejorar y no afecta tus notas.</span></div><button type="button" class="ef-btn" onclick="EncuestaFinal.abrir(${Number(t.id)})">Responder</button></div>`).join('');
      this.estilo();
    } catch (e) { console.warn('Encuesta final:', e); }
  },

  estilo() {
    if (document.getElementById('ef-estilo')) return;
    const s = document.createElement('style'); s.id = 'ef-estilo';
    s.textContent = `.ef-aviso{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#FFF4D1;border:1px solid #F6B81A;border-radius:12px;padding:12px 16px;margin-bottom:12px;color:#5a4300}
      .ef-btn{background:#0E4A52;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer}
      .ef-q{text-align:left;margin:0 0 14px}.ef-q p{margin:0 0 6px;font-size:.92rem;font-weight:600}
      .ef-esc{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.ef-esc label{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:.68rem;border:1px solid #cfe0ea;border-radius:8px;padding:6px 2px;cursor:pointer;text-align:center;line-height:1.15}
      .ef-esc input{margin:0}.ef-esc label:has(input:checked){background:#E6F3FC;border-color:#3FA7E0;font-weight:700}
      .ef-dim{text-align:left;font-weight:800;margin:16px 0 8px;color:#0E4A52;border-bottom:2px solid #E5EEF3;padding-bottom:4px}
      .ef-op{display:flex;flex-wrap:wrap;gap:6px}.ef-op label{border:1px solid #cfe0ea;border-radius:999px;padding:5px 12px;font-size:.82rem;cursor:pointer}.ef-op label:has(input:checked){background:#E6F3FC;border-color:#3FA7E0;font-weight:700}.ef-op input{display:none}`;
    document.head.appendChild(s);
  },

  formHtml() {
    const esc = (k, t) => `<div class="ef-q" data-k="${k}"><p>${this.esc(t)}</p><div class="ef-esc">${this.ESCALA.map((l, i) => `<label><input type="radio" name="ef-${k}" value="${i + 1}"><b>${i + 1}</b><span>${l}</span></label>`).join('')}</div></div>`;
    const multi = (k, t, ops, max) => `<div class="ef-q" data-multi="${k}" data-max="${max}"><p>${t}</p><div class="ef-op">${ops.map(([v, l]) => `<label><input type="checkbox" value="${v}">${l}</label>`).join('')}</div></div>`;
    return `<div style="max-height:62vh;overflow:auto;padding:0 6px">
      <p style="text-align:left;font-size:.88rem;color:#475569">Tus respuestas son <b>confidenciales</b>: los docentes y la Dirección solo ven resultados agrupados, nunca quién respondió qué.</p>
      ${this.DIMENSIONES.map(d => `<div class="ef-dim">${d.nombre}</div>${d.items.map(([k, t]) => esc(k, t)).join('')}`).join('')}
      <div class="ef-dim">Para cerrar</div>
      ${multi('mejor', '¿Qué fue lo mejor del curso? (hasta 2)', this.OPC_MEJOR, 2)}
      ${multi('mejorar', '¿Qué mejorarías primero? (hasta 2)', this.OPC_MEJORAR, 2)}
      <div class="ef-q" data-uno="seguir"><p>¿Te gustaría seguir estudiando en el CFP con otro curso?</p><div class="ef-op">${this.OPC_SEGUIR.map(([v, l]) => `<label><input type="radio" name="ef-seguir" value="${v}">${l}</label>`).join('')}</div></div>
      <div class="ef-q"><p>¿Querés agregar algo más? (opcional)</p><textarea id="ef-coment" maxlength="1000" rows="3" style="width:100%;box-sizing:border-box;border:1px solid #cfe0ea;border-radius:8px;padding:8px" placeholder="Escribí lo que quieras contarnos"></textarea></div></div>`;
  },

  async abrir(tid) {
    const t = this.pendientes.find(x => Number(x.id) === Number(tid)); if (!t) return;
    this.estilo();
    const self = this;
    const { value } = await Swal.fire({
      title: 'Encuesta de cierre', html: `<div style="text-align:left;font-weight:700;margin-bottom:6px">${this.esc(t.nombre)}</div>${this.formHtml()}`, width: 760,
      showCancelButton: true, confirmButtonText: 'Enviar', cancelButtonText: 'Ahora no', focusConfirm: false,
      didOpen: () => {
        document.querySelectorAll('.ef-q[data-multi] input').forEach(c => c.addEventListener('change', () => {
          const q = c.closest('.ef-q'), max = Number(q.dataset.max);
          if (q.querySelectorAll('input:checked').length > max) c.checked = false;
        }));
      },
      preConfirm: () => {
        const r = { v: self.VERSION };
        for (const d of self.DIMENSIONES) for (const [k] of d.items) {
          const x = document.querySelector(`input[name="ef-${k}"]:checked`);
          if (!x) { Swal.showValidationMessage('Falta responder todas las afirmaciones (del 1 al 5).'); return false; }
          r[k] = Number(x.value);
        }
        r.mejor = [...document.querySelectorAll('.ef-q[data-multi="mejor"] input:checked')].map(x => x.value);
        r.mejorar = [...document.querySelectorAll('.ef-q[data-multi="mejorar"] input:checked')].map(x => x.value);
        const s = document.querySelector('input[name="ef-seguir"]:checked'); if (s) r.seguir = s.value;
        return { r, c: (document.getElementById('ef-coment').value || '').trim().slice(0, 1000) || null };
      }
    });
    if (!value) return;
    const perfil = (window.Auth && Auth.usuarioActual) || {};
    const { error } = await supabase.from('encuestas_finales').insert({ trayecto_id: t.id, estudiante_user: String(perfil.dni || perfil.usuario || '').trim(), respuestas: value.r, comentario: value.c, version: this.VERSION });
    if (error && !/duplicate|unique/i.test(error.message || '')) return Swal.fire('No se pudo enviar', /row-level|violates/i.test(error.message || '') ? 'No estás inscripto activo en este curso.' : error.message, 'error');
    await Swal.fire({ icon: 'success', title: '¡Gracias!', text: 'Tu encuesta quedó registrada.', timer: 1800, showConfirmButton: false });
    this.avisar();
  },

  /* ======================= DIRECCIÓN / SECRETARÍA / DOCENTES ======================= */
  datos: [], sel: '', ciclo: '',
  async cargar() {
    const cont = document.getElementById('encuestas-contenido'); if (!cont) return;
    cont.innerHTML = '<p class="seg-cargando">Cargando encuestas…</p>';
    const { data, error } = await supabase.rpc('encuesta_final_resumen', { p_trayecto: null });
    if (error) { cont.innerHTML = `<div class="prog-vacio">No se pudieron cargar las encuestas.${/encuesta_final|encuestas_finales/i.test(error.message || '') ? ' Falta ejecutar <strong>sql/61_encuesta_final.sql</strong> en Supabase.' : ''}<br><small>${this.esc(error.message || '')}</small></div>`; return; }
    this.datos = data || [];
    if (!this.sel) this.sel = (this.datos.find(x => x.n > 0) || this.datos[0] || {}).trayecto_id || '';
    this.esAdmin = !!(window.Auth && Auth.esDireccion && Auth.esDireccion((Auth.usuarioActual || {}).rol));
    this.render();
  },

  /* ---- agregación ---- */
  itemsPlano() { return this.DIMENSIONES.flatMap(d => d.items.map(([k, t]) => ({ k, t, dim: d.id }))); },
  agregar(resp) {
    const items = this.itemsPlano().map(it => {
      const v = resp.map(r => r[it.k]).filter(x => typeof x === 'number');
      return { ...it, n: v.length, media: this.prom(v), fav: this.pct(v.filter(x => x >= 4).length, v.length), desf: this.pct(v.filter(x => x <= 2).length, v.length), dist: [1, 2, 3, 4, 5].map(i => v.filter(x => x === i).length) };
    });
    const dims = this.DIMENSIONES.map(d => { const its = items.filter(i => i.dim === d.id && i.media != null); return { id: d.id, nombre: d.nombre, media: this.prom(its.map(i => i.media)), fav: this.prom(its.map(i => i.fav).filter(x => x != null)) }; });
    const cuenta = (k, ops) => ops.map(([v, l]) => ({ v, l, n: resp.filter(r => (r[k] || []).includes ? (Array.isArray(r[k]) ? r[k].includes(v) : r[k] === v) : false).length })).sort((a, b) => b.n - a.n);
    return { items, dims, mejor: cuenta('mejor', this.OPC_MEJOR), mejorar: cuenta('mejorar', this.OPC_MEJORAR), seguir: cuenta('seguir', this.OPC_SEGUIR), global: this.prom(items.filter(i => i.media != null).map(i => i.media)) };
  },

  TEMAS: [['docente', 'Docente', /docente|profe|instructor|maestr|explic/i], ['practica', 'Práctica / taller', /pr[aá]ctic|taller|herramient|m[aá]quin|equipo/i], ['materiales', 'Materiales', /material|insumo|falta de|no hab[ií]a/i],
    ['horarios', 'Horarios y duración', /horari|turno|duraci[oó]n|largo|corto|temprano|d[ií]as/i], ['instalaciones', 'Instalaciones', /aula|ba[ñn]o|instalaci|edificio|fr[ií]o|calor|limpie|estufa|sill|luz/i],
    ['contenidos', 'Contenidos', /contenido|tema|teor[ií]a|program|aprend/i], ['grupo', 'Compañeros / clima', /compa[ñn]er|grupo|clima|ambiente/i], ['gestion', 'Información y gestión', /secretar|tr[aá]mite|inscrip|certificad|informaci[oó]n|comunic/i]],
  POS: /excelente|muy buen|me gust|gracias|genial|content|buen[oa]s?\b|recomiend|todo bien|perfecto/i,
  NEG: /falt|\bmal\b|malo|no hab|problema|p[eé]sim|dif[ií]cil|queja|deber[ií]a|mejorar|poco|nunca|sin /i,
  ALERTA: /acoso|discrimin|maltrat|violen|abus|amenaz|peligro|accident|lesion|insegur|robo|bullying|agred/i,
  comentarios(resp) {
    const lista = resp.map(r => (r._comentario || '').trim()).filter(Boolean).map(t => ({ t, temas: this.TEMAS.filter(x => x[2].test(t)).map(x => x[0]), pos: this.POS.test(t), neg: this.NEG.test(t), alerta: this.ALERTA.test(t) }));
    const porTema = this.TEMAS.map(([id, nom]) => { const l = lista.filter(c => c.temas.includes(id)); return { id, nom, n: l.length, pos: l.filter(c => c.pos && !c.neg).length, neg: l.filter(c => c.neg).length }; }).filter(x => x.n).sort((a, b) => b.n - a.n);
    return { lista, porTema, sinTema: lista.filter(c => !c.temas.length).length, alertas: lista.filter(c => c.alerta) };
  },

  tema: '',
  semaforo(m) { return m == null ? '#94a3b8' : m >= 4 ? '#146B47' : m >= 3 ? '#B7791F' : '#B42318'; },
  barra(rot, val, max, col, extra) { return `<div style="margin:5px 0"><div style="display:flex;justify-content:space-between;font-size:.84rem;gap:8px"><span>${this.esc(rot)}</span><b style="white-space:nowrap">${val}${extra || ''}</b></div><div style="background:#E5EEF3;border-radius:4px;height:8px"><div style="width:${max ? Math.round(100 * val / max) : 0}%;background:${col || '#3FA7E0'};height:8px;border-radius:4px"></div></div></div>`; },

  render() {
    const cont = document.getElementById('encuestas-contenido'); if (!cont) return;
    this.estilo();
    const ciclos = [...new Set(this.datos.map(d => String(d.ciclo || '')).filter(Boolean))].sort().reverse();
    const vis = this.datos.filter(d => !this.ciclo || String(d.ciclo) === this.ciclo);
    const t = this.datos.find(d => String(d.trayecto_id) === String(this.sel));
    const opts = vis.map(d => `<option value="${d.trayecto_id}" ${String(d.trayecto_id) === String(this.sel) ? 'selected' : ''}>${this.esc(d.nombre)} — ${d.n} respuesta${d.n === 1 ? '' : 's'}</option>`).join('');
    let cuerpo = '';
    if (!t) cuerpo = '<div class="prog-vacio">No hay trayectos para mostrar.</div>';
    else if (t.oculto) cuerpo = `<div class="card-panel"><p style="margin:0">Hay <b>${t.n}</b> respuesta${t.n === 1 ? '' : 's'} de ${t.matriculados} estudiantes. Para cuidar el anonimato, los resultados se muestran a partir de ${this.MIN_DOCENTE} respuestas.</p></div>`;
    else if (!t.n) cuerpo = `<div class="card-panel"><p style="margin:0">Todavía no hay respuestas. La encuesta se les muestra a los estudiantes ${this.DIAS_ANTES} días antes del cierre${t.fecha_cierre ? ' (' + String(t.fecha_cierre).slice(0, 10).split('-').reverse().join('/') + ')' : ' — este trayecto no tiene fecha de cierre cargada'}.</p></div>`;
    else cuerpo = this.vistaTrayecto(t);
    const comp = this.esAdmin && vis.some(d => d.n >= 1) ? this.comparacion(vis) : '';
    cont.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:12px">
        <label style="font-size:.8rem;display:flex;flex-direction:column;gap:3px">Trayecto<select class="form-control" style="min-width:280px" onchange="EncuestaFinal.sel=this.value;EncuestaFinal.tema='';EncuestaFinal.render()">${opts || '<option>—</option>'}</select></label>
        ${ciclos.length > 1 ? `<label style="font-size:.8rem;display:flex;flex-direction:column;gap:3px">Ciclo<select class="form-control" onchange="EncuestaFinal.ciclo=this.value;EncuestaFinal.sel='';const v=EncuestaFinal.datos.filter(d=>!EncuestaFinal.ciclo||String(d.ciclo)===EncuestaFinal.ciclo);EncuestaFinal.sel=(v.find(x=>x.n>0)||v[0]||{}).trayecto_id||'';EncuestaFinal.render()"><option value="">Todos</option>${ciclos.map(c => `<option ${this.ciclo === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>` : ''}
        ${t && !t.oculto && t.n ? '<button class="btn-secondary" style="padding:.4rem .8rem" onclick="EncuestaFinal.exportar()">⬇️ Excel</button><button class="btn-secondary" style="padding:.4rem .8rem" onclick="VistaPDF.ver(() => EncuestaFinal.exportar(), \'Encuesta final\')" title="Se abre en otra pestaña, sin descargar">👁️ Ver PDF</button>' : ''}</div>${cuerpo}${comp}`;
  },

  vistaTrayecto(t) {
    const resp = t.respuestas, A = this.agregar(resp), C = this.comentarios(resp), part = this.pct(t.n, t.matriculados);
    const dimsOrd = A.dims.filter(d => d.media != null).sort((a, b) => b.media - a.media);
    const itemsOrd = A.items.filter(i => i.media != null).sort((a, b) => a.media - b.media);
    const f = [];
    f.push(`Respondieron <b>${t.n}</b> de <b>${t.matriculados}</b> estudiantes (${this.fp(part)}).`);
    f.push(`Valoración general del curso: <b>${this.f1(A.global)} de 5</b>.`);
    if (dimsOrd.length > 1) f.push(`Lo mejor valorado: <b>${dimsOrd[0].nombre}</b> (${this.f1(dimsOrd[0].media)}). Lo más bajo: <b>${dimsOrd[dimsOrd.length - 1].nombre}</b> (${this.f1(dimsOrd[dimsOrd.length - 1].media)}).`);
    if (itemsOrd[0] && itemsOrd[0].media < 3.5) f.push(`Punto a revisar: «${this.esc(itemsOrd[0].t)}» (${this.f1(itemsOrd[0].media)}).`);
    const mj = A.mejorar.filter(x => x.v !== 'nada' && x.n)[0]; if (mj) f.push(`Lo que más piden mejorar: <b>${mj.l.toLowerCase()}</b> (${mj.n} de ${t.n}).`);
    const sg = A.seguir.find(x => x.v === 'si'); if (sg && sg.n) f.push(`<b>${sg.n}</b> quieren seguir estudiando en el CFP (${this.fp(this.pct(sg.n, t.n))}).`);
    if (C.alertas.length) f.push(`<b style="color:#B42318">⚠️ ${C.alertas.length === 1 ? '1 comentario menciona una situación que conviene leer primero' : C.alertas.length + ' comentarios mencionan situaciones que conviene leer primero'}.</b>`);
    const dimFila = d => `<tr><td>${d.nombre}</td><td style="color:${this.semaforo(d.media)};font-weight:700">${this.f1(d.media)}</td><td>${this.fp(d.fav == null ? null : Math.round(d.fav * 10) / 10)}</td></tr>`;
    const itemFila = i => `<tr><td style="text-align:left;white-space:normal">${this.esc(i.t)}</td><td style="color:${this.semaforo(i.media)};font-weight:700">${this.f1(i.media)}</td><td>${this.fp(i.fav)}</td><td>${this.fp(i.desf)}</td></tr>`;
    const maxM = Math.max(1, ...A.mejor.map(x => x.n), ...A.mejorar.map(x => x.n));
    const temas = C.porTema.length ? C.porTema.map(x => `<button type="button" class="plan-tab ${this.tema === x.id ? 'activo' : ''}" onclick="EncuestaFinal.tema=EncuestaFinal.tema==='${x.id}'?'':'${x.id}';EncuestaFinal.render()">${x.nom} · ${x.n} <small>(${x.pos}➕ ${x.neg}➖)</small></button>`).join(' ') : '';
    const mostrar = this.tema ? C.lista.filter(c => c.temas.includes(this.tema)) : C.lista.filter(c => !c.alerta);
    return `<div class="card-panel" style="margin-bottom:12px"><h4 style="margin:0 0 6px">Resumen</h4><ul style="margin:0;padding-left:18px;font-size:.9rem;line-height:1.55">${f.map(x => `<li>${x}</li>`).join('')}</ul><small style="color:var(--text-muted)">Resumen armado automáticamente con las respuestas cerradas. Escala: 1 muy en desacuerdo a 5 muy de acuerdo; «a favor» = respuestas 4 y 5.</small></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-bottom:12px">
        <div class="card-panel"><h4 style="margin:0 0 6px">Por dimensión</h4><table class="tabla-simple ef-t" style="width:100%"><thead><tr><th>Dimensión</th><th>Media</th><th>A favor</th></tr></thead><tbody>${A.dims.map(dimFila).join('')}</tbody></table></div>
        <div class="card-panel"><h4 style="margin:0 0 6px">Lo mejor del curso</h4>${A.mejor.map(x => this.barra(x.l, x.n, maxM, '#146B47')).join('')}<h4 style="margin:12px 0 6px">Qué mejorarían primero</h4>${A.mejorar.map(x => this.barra(x.l, x.n, maxM, '#E07A5F')).join('')}</div></div>
      <div class="card-panel" style="margin-bottom:12px"><h4 style="margin:0 0 6px">Cada afirmación (de la más baja a la más alta)</h4><div style="overflow-x:auto"><table class="tabla-simple ef-t" style="width:100%"><thead><tr><th>Afirmación</th><th>Media</th><th>A favor</th><th>En contra</th></tr></thead><tbody>${itemsOrd.map(itemFila).join('')}</tbody></table></div></div>
      <div class="card-panel"><h4 style="margin:0 0 6px">Comentarios (${C.lista.length}) — agrupados por tema</h4>
        ${C.alertas.length ? `<div style="background:#FDE7E5;border:1px solid #F1A9A0;border-radius:8px;padding:8px 12px;margin-bottom:10px"><b>⚠️ Para leer primero</b>${C.alertas.map(c => `<p style="margin:6px 0 0;font-size:.88rem">«${this.esc(c.t)}»</p>`).join('')}</div>` : ''}
        ${C.lista.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${temas}${C.sinTema ? `<span style="font-size:.8rem;color:var(--text-muted);align-self:center">${C.sinTema} sin tema detectado</span>` : ''}</div>
        <p style="font-size:.8rem;color:var(--text-muted);margin:0 0 6px">${this.tema ? 'Mostrando solo el tema elegido (tocá de nuevo el tema para ver todos).' : 'Elegí un tema para leer solo esos comentarios.'}</p>
        <div style="max-height:260px;overflow:auto">${mostrar.map(c => `<p style="margin:0 0 8px;padding:6px 10px;border-left:3px solid ${c.neg ? '#E07A5F' : c.pos ? '#146B47' : '#cfe0ea'};background:#F8FBFD;font-size:.88rem">${this.esc(c.t)}</p>`).join('') || '<small>Sin comentarios.</small>'}</div>` : '<small>Nadie dejó comentarios.</small>'}</div>
      <style>.ef-t th,.ef-t td{text-align:center;padding:5px 8px}.ef-t th:first-child,.ef-t td:first-child{text-align:left}</style>`;
  },

  comparacion(vis) {
    const filas = vis.filter(d => !d.oculto && d.n > 0).map(d => ({ d, A: this.agregar(d.respuestas) }));
    if (filas.length < 2) return '';
    return `<div class="card-panel" style="margin-top:12px"><h4 style="margin:0 0 6px">Comparación entre trayectos (media de 1 a 5)</h4><div style="overflow-x:auto"><table class="tabla-simple ef-t" style="width:100%"><thead><tr><th>Trayecto</th><th>Resp.</th>${this.DIMENSIONES.map(x => `<th>${x.nombre}</th>`).join('')}</tr></thead><tbody>${filas.map(({ d, A }) => `<tr><td>${this.esc(d.nombre)}</td><td>${d.n}/${d.matriculados}</td>${A.dims.map(x => `<td style="color:${this.semaforo(x.media)};font-weight:700">${this.f1(x.media)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  },

  async exportar() {
    if (typeof ExcelJS === 'undefined') return Swal.fire('Excel no disponible', 'No se cargó la librería de Excel.', 'error');
    const t = this.datos.find(d => String(d.trayecto_id) === String(this.sel)); if (!t || !t.respuestas.length) return;
    const A = this.agregar(t.respuestas), C = this.comentarios(t.respuestas), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Resultados');
    ws.columns = [{ width: 60 }, { width: 12 }, { width: 12 }, { width: 12 }, ...Array(5).fill({ width: 8 })];
    ws.addRow([`Encuesta de cierre — ${t.nombre}`]).font = { bold: true }; ws.addRow([`Respondieron ${t.n} de ${t.matriculados}`]); ws.addRow([]);
    ws.addRow(['Afirmación', 'Media', 'A favor %', 'En contra %', '1', '2', '3', '4', '5']).font = { bold: true };
    A.items.forEach(i => ws.addRow([i.t, i.media == null ? '' : Math.round(i.media * 100) / 100, i.fav ?? '', i.desf ?? '', ...i.dist]));
    ws.addRow([]); ws.addRow(['Lo mejor del curso', 'Cantidad']).font = { bold: true }; A.mejor.forEach(x => ws.addRow([x.l, x.n]));
    ws.addRow([]); ws.addRow(['Qué mejorarían primero', 'Cantidad']).font = { bold: true }; A.mejorar.forEach(x => ws.addRow([x.l, x.n]));
    const w2 = wb.addWorksheet('Comentarios'); w2.columns = [{ width: 90 }, { width: 40 }, { width: 14 }];
    w2.addRow(['Comentario (anónimo)', 'Temas', 'Alerta']).font = { bold: true };
    C.lista.forEach(c => w2.addRow([c.t, c.temas.map(id => (this.TEMAS.find(x => x[0] === id) || [])[1]).join(', '), c.alerta ? 'Sí' : '']));
    const buf = await wb.xlsx.writeBuffer(), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf])); a.download = `encuesta_${String(t.nombre).replace(/[^\w]+/g, '_')}.xlsx`; a.click();
  }
};
window.EncuestaFinal = EncuestaFinal;
