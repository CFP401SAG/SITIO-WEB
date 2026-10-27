// =============================================================================
// Función de Supabase: subir-preinscripcion-drive
//
// Recibe { id } (lo manda la base cuando entra una preinscripción, y la plataforma cuando se
// corrige o confirma), arma el PDF de la ficha y lo guarda en Google Drive:
//   <carpeta raíz> / <ciclo> / <nombre del trayecto> / Ficha_inscripcion_<N.º>_<APELLIDO>.pdf
// Si el archivo ya existe y se pide "forzar", lo reemplaza con la versión actual.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN  (cuenta dueña del Drive)
//   DRIVE_FOLDER_ID   id de la carpeta «Preinscripciones» (raíz de todo lo que se sube)
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

async function tokenGoogle(): Promise<string> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: env('GOOGLE_REFRESH_TOKEN'), grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error('Google no dio acceso: ' + (d.error_description || d.error || r.status));
  return d.access_token;
}

async function drive(token: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  const t = await r.text();
  let d: any = {}; try { d = t ? JSON.parse(t) : {}; } catch (_) { d = { raw: t }; }
  if (!r.ok) throw new Error('Drive: ' + (d.error?.message || r.status));
  return d;
}

async function carpeta(token: string, padre: string, nombre: string): Promise<string> {
  const limpio = nombre.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Sin nombre';
  const q = `name = '${limpio.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and '${padre}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const f = await drive(token, 'https://www.googleapis.com/drive/v3/files?fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true&q=' + encodeURIComponent(q));
  if (f.files?.length) return f.files[0].id;
  const c = await drive(token, 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: limpio, mimeType: 'application/vnd.google-apps.folder', parents: [padre] }),
  });
  return c.id;
}

function multipart(meta: unknown, pdf: Uint8Array) {
  const lim = 'ficha' + crypto.randomUUID().replace(/-/g, '');
  const enc = new TextEncoder();
  const ini = enc.encode(`--${lim}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${lim}\r\nContent-Type: application/pdf\r\n\r\n`);
  const fin = enc.encode(`\r\n--${lim}--`);
  const cuerpo = new Uint8Array(ini.length + pdf.length + fin.length);
  cuerpo.set(ini, 0); cuerpo.set(pdf, ini.length); cuerpo.set(fin, ini.length + pdf.length);
  return { cuerpo, tipo: `multipart/related; boundary=${lim}` };
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

  const { data: p, error } = await admin.from('preinscripciones')
    .select('*, trayecto:trayectos(nombre, horario, sede, lugar_dictado)').eq('id', id).maybeSingle();
  if (error || !p) return json({ error: 'Preinscripción no encontrada' }, 404);
  if (p.drive_archivo_id && !forzar) return json({ ok: true, ya_subida: true });

  try {
    if (!env('DRIVE_FOLDER_ID') || !env('GOOGLE_REFRESH_TOKEN')) throw new Error('Faltan los secretos de Google Drive');

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

    const token = await tokenGoogle();
    const dirCiclo = await carpeta(token, env('DRIVE_FOLDER_ID'), String(p.ciclo));
    const dirTray = await carpeta(token, dirCiclo, t.nombre || 'Sin trayecto');
    const nombre = `Ficha_inscripcion_${p.numero}_${String(p.apellido || '').replace(/[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]+/g, '_')}.pdf`;

    let archivo: any;
    if (p.drive_archivo_id) {
      const m = multipart({ name: nombre }, pdf);
      archivo = await drive(token, `https://www.googleapis.com/upload/drive/v3/files/${p.drive_archivo_id}?uploadType=multipart&supportsAllDrives=true`, { method: 'PATCH', headers: { 'Content-Type': m.tipo }, body: m.cuerpo });
    } else {
      const m = multipart({ name: nombre, parents: [dirTray] }, pdf);
      archivo = await drive(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', { method: 'POST', headers: { 'Content-Type': m.tipo }, body: m.cuerpo });
    }
    await admin.from('preinscripciones').update({ drive_archivo_id: archivo.id, drive_subido_en: new Date().toISOString(), drive_error: null }).eq('id', id);
    return json({ ok: true });
  } catch (err) {
    const msg = String((err as Error)?.message || err).slice(0, 300);
    await admin.from('preinscripciones').update({ drive_error: msg }).eq('id', id);
    return json({ error: msg }, 500);
  }
});
