// =============================================================================
// Función de Supabase: subir-preinscripcion-drive
//
// Recibe { id } (lo manda la base cuando entra una preinscripción, y la plataforma cuando se
// corrige o confirma), arma el PDF de la ficha y lo guarda en Google Drive:
//   <carpeta raíz> / <ciclo> / <nombre del trayecto> / Ficha_inscripcion_<N.º>_<APELLIDO>.pdf
// Si el archivo ya existe y se pide "forzar", lo reemplaza con la versión actual.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   APPS_SCRIPT_URL, APPS_SCRIPT_SECRET   (puente de Apps Script, ver LEEME.md)
//   SITE_URL          (opcional) dirección de la página, para tomar los logos
//
// Desplegar con «Verify JWT» DESACTIVADO (la llama la base de datos). Solo puede leer
// preinscripciones que ya existen y solo guarda ese PDF; nunca devuelve datos personales.
// Archivo generado: no editar a mano, ver tools/armar-funcion-drive.js
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as PDFLib from 'https://esm.sh/pdf-lib@1.17.1';

const FICHA_JS: string = __FICHA_JS__;

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const env = (k: string) => Deno.env.get(k) || '';

// Envía el PDF al «puente» de Apps Script (corre con la cuenta dueña del Drive, sin Google Cloud)
async function enviarAlPuente(d: Record<string, unknown>): Promise<{ archivo_id: string }> {
  const r = await fetch(env('APPS_SCRIPT_URL'), {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
    body: JSON.stringify({ ...d, secreto: env('APPS_SCRIPT_SECRET') }),
  });
  const t = await r.text();
  let j: any = {}; try { j = JSON.parse(t); } catch (_) { throw new Error('El puente de Drive no respondió bien (revisá la implementación del script)'); }
  if (!r.ok || j.error) throw new Error('Drive: ' + (j.error || r.status));
  return j;
}

function aBase64(b: Uint8Array): string {
  let s = ''; const paso = 0x8000;
  for (let i = 0; i < b.length; i += paso) s += String.fromCharCode(...b.subarray(i, i + paso));
  return btoa(s);
}

// Solo pueden dispararla: (1) la base, con el secreto interno en la cabecera «x-interno» (sql/66), o
// (2) una persona con sesión de Dirección o Secretaría (botón «reintentar» de la plataforma).
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// deno-lint-ignore no-explicit-any
async function autorizado(req: Request, admin: any): Promise<boolean> {
  const interno = req.headers.get('x-interno') || '';
  if (interno) {
    const { data } = await admin.from('secretos_internos').select('valor').eq('nombre', 'interno').maybeSingle();
    if (data && data.valor && igual(interno, String(data.valor))) return true;
  }
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (token) {
    const { data: u } = await admin.auth.getUser(token);
    if (u && u.user) {
      const { data: p } = await admin.from('profiles').select('rol, estado').eq('id', u.user.id).maybeSingle();
      if (p && String(p.estado || '').toUpperCase() === 'ACTIVO' && ['admin', 'administrador', 'secretaria'].includes(String(p.rol || '').toLowerCase())) return true;
    }
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  let id = 0; let forzar = false;
  try { const b = await req.json(); id = Number(b.id || b.record?.id); forzar = !!b.forzar; } catch (_) { /* vacío */ }
  if (!id) return json({ error: 'Falta el id' }, 400);

  let claveAdmin = '';
  try { const c = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); claveAdmin = c['default'] || (Object.values(c)[0] as string) || ''; } catch (_) { /* nada */ }
  if (!claveAdmin) claveAdmin = env('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(env('SUPABASE_URL'), claveAdmin, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!(await autorizado(req, admin))) return json({ error: 'No autorizado' }, 401);

  const { data: p, error } = await admin.from('preinscripciones')
    .select('*, trayecto:trayectos(nombre, horario, sede, lugar_dictado)').eq('id', id).maybeSingle();
  if (error || !p) return json({ error: 'Preinscripción no encontrada' }, 404);
  if (p.drive_archivo_id && !forzar) return json({ ok: true, ya_subida: true });

  try {
    if (!env('APPS_SCRIPT_URL') || !env('APPS_SCRIPT_SECRET')) throw new Error('Faltan los secretos APPS_SCRIPT_URL y APPS_SCRIPT_SECRET');

    // PDF: el mismo generador que usa la plataforma
    const sitio = (env('SITE_URL') || 'https://cfp401sag.github.io/SITIO-WEB').replace(/\/$/, '');
    const fetchSitio = (ruta: string) => fetch(/^https?:/.test(ruta) ? ruta : `${sitio}/${ruta.replace(/^\//, '')}`);
    const fabrica = new Function('PDFLib', 'window', 'fetch', FICHA_JS + '\nreturn FichaInscripcion;');
    const Ficha = fabrica(PDFLib, {}, fetchSitio);
    const t = p.trayecto || {};
    const pdf: Uint8Array = await Ficha.generarPDF({
      datos: p.datos || {}, numero: p.numero, ciclo: p.ciclo,
      trayecto: { nombre: t.nombre, horario: t.horario, sede: t.sede, lugar: t.lugar_dictado },
    });

    const nombre = `Ficha_inscripcion_${p.numero}_${String(p.apellido || '').replace(/[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]+/g, '_')}.pdf`;
    const archivo = await enviarAlPuente({
      ciclo: String(p.ciclo), trayecto: t.nombre || 'Sin trayecto', nombre,
      archivo_id: p.drive_archivo_id || null, pdf: aBase64(pdf),
    });
    await admin.from('preinscripciones').update({ drive_archivo_id: archivo.archivo_id, drive_subido_en: new Date().toISOString(), drive_error: null }).eq('id', id);
    return json({ ok: true });
  } catch (err) {
    const msg = String((err as Error)?.message || err).slice(0, 300);
    await admin.from('preinscripciones').update({ drive_error: msg }).eq('id', id);
    return json({ error: msg }, 500);
  }
});
