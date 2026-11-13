/* Service worker de la plataforma (CFP N.º 401).
   Para qué sirve: poder instalar la plataforma como app y abrir la pantalla sin señal.
   Los DATOS nunca pasan por acá: las consultas a Supabase (y cualquier otro sitio) no se tocan ni se guardan.

   Estrategia (a propósito simple y segura):
   - Archivos de la propia plataforma (HTML, JS, CSS, imágenes): primero la red (siempre la versión nueva) y, si no hay
     señal o tarda más de 4 segundos, la última copia guardada.
   - Librerías de CDN conocidas (jsdelivr, unpkg, cdnjs): se guardan al usarlas y se sirven de la copia si no hay señal.
   - Todo lo demás, y todo lo que no sea GET: va directo a la red.

   Al publicar un cambio: subir VERSION. Eso hace que los dispositivos avisen «Hay una versión nueva» (js/app.js). */
const VERSION = '1';
const CACHE = `cfp401-app-v${VERSION}`;
const NAVEGACION = ['./', 'index.html'];
const CDN = ['cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com'];
const ESPERA_RED_MS = 4000;

self.addEventListener('install', (evento) => {
  // Copia inicial de la pantalla principal (si falla algo no se frena la instalación).
  evento.waitUntil(caches.open(CACHE).then((c) => Promise.all(NAVEGACION.map((u) => c.add(u).catch(() => null)))));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('cfp401-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// El botón «Actualizar» de la barra de aviso manda este mensaje.
self.addEventListener('message', (evento) => {
  if (evento.data === 'actualizar') self.skipWaiting();
});

function conLimite(promesa, ms) {
  return new Promise((resolver, rechazar) => {
    const t = setTimeout(() => rechazar(new Error('sin señal')), ms);
    promesa.then((r) => { clearTimeout(t); resolver(r); }, (e) => { clearTimeout(t); rechazar(e); });
  });
}

async function primeroRed(pedido) {
  const cache = await caches.open(CACHE);
  try {
    const respuesta = await conLimite(fetch(pedido), ESPERA_RED_MS);
    if (respuesta && respuesta.ok) cache.put(pedido, respuesta.clone()).catch(() => null);
    return respuesta;
  } catch (e) {
    const guardada = await cache.match(pedido, { ignoreSearch: false }) || await cache.match(pedido, { ignoreSearch: true });
    if (guardada) return guardada;
    if (pedido.mode === 'navigate') {
      const inicio = await cache.match('index.html') || await cache.match('./');
      if (inicio) return inicio;
    }
    throw e;
  }
}

async function primeroCache(pedido) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(pedido);
  if (guardada) return guardada;
  const respuesta = await fetch(pedido);
  // Los scripts de otro sitio llegan como respuesta «opaca» (status 0): se guardan igual.
  if (respuesta && (respuesta.ok || respuesta.type === 'opaque')) cache.put(pedido, respuesta.clone()).catch(() => null);
  return respuesta;
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  let url;
  try { url = new URL(pedido.url); } catch (e) { return; }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') return;

  if (url.origin === self.location.origin) {
    // Los archivos de la plataforma. Nada de esto contiene datos de personas.
    evento.respondWith(primeroRed(pedido));
    return;
  }
  if (CDN.includes(url.hostname)) {
    evento.respondWith(primeroCache(pedido));
  }
  // Supabase, Google Drive, fuentes, etc.: sin intervención.
});
