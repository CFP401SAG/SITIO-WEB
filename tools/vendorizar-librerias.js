#!/usr/bin/env node
/* Baja las librerías externas desde npm (versión exacta) y las guarda en js/vendor/, y cambia los <script> de
   index.html y preinscripcion.html para que usen esas copias en vez de un CDN.
   Por qué: si un CDN es comprometido, un script ajeno podría robar sesiones. Con copias propias en el repositorio
   eso no puede pasar, y además la plataforma carga sin señal.
   Se ejecuta con el workflow «Librerías propias» (GitHub → Actions → Run workflow) o a mano:  node tools/vendorizar-librerias.js
   Necesita internet y npm. Es repetible: para actualizar una librería, cambiá su versión acá y volvé a ejecutarlo. */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const RAIZ = path.resolve(__dirname, '..');
const DESTINO = path.join(RAIZ, 'js', 'vendor');
const PAGINAS = ['index.html', 'preinscripcion.html'];

// version: 'latest-2' = la última 2.x al momento de ejecutar (queda registrada en VERSIONES.txt)
const LIBS = [
  { pkg: '@supabase/supabase-js', version: 'latest-2', archivos: ['dist/umd/supabase.js', 'dist/umd/supabase.min.js'], destino: 'supabase.js', url: /https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"']+/ },
  { pkg: 'sweetalert2', version: 'latest-11', archivos: ['dist/sweetalert2.all.min.js', 'dist/sweetalert2.all.js'], destino: 'sweetalert2.all.min.js', url: /https:\/\/cdn\.jsdelivr\.net\/npm\/sweetalert2@[^"']+/ },
  { pkg: 'canvas-confetti', version: '1.6.0', archivos: ['dist/confetti.browser.min.js', 'dist/confetti.browser.js'], destino: 'confetti.browser.min.js', url: /https:\/\/cdn\.jsdelivr\.net\/npm\/canvas-confetti@[^"']+/ },
  { pkg: 'exceljs', version: '4.3.0', archivos: ['dist/exceljs.min.js'], destino: 'exceljs.min.js', url: /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/exceljs\/[^"']+/ },
  { pkg: 'qrcode-generator', version: '1.4.4', archivos: ['qrcode.min.js', 'qrcode.js', 'dist/qrcode.min.js', 'dist/qrcode.js'], destino: 'qrcode.js', url: /https:\/\/cdn\.jsdelivr\.net\/npm\/qrcode-generator@[^"']+/ }
];

function sh(cmd, args, cwd) { return cp.execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim(); }

function versionExacta(pkg, pedida) {
  if (!pedida.startsWith('latest-')) return pedida;
  const mayor = pedida.slice(7);
  const lista = JSON.parse(sh('npm', ['view', pkg, 'versions', '--json']));
  const ok = lista.filter(v => new RegExp(`^${mayor}\\.\\d+\\.\\d+$`).test(v));
  if (!ok.length) throw new Error(`No hay versión ${mayor}.x de ${pkg}`);
  ok.sort((a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
  return ok[ok.length - 1];
}

function main() {
  fs.mkdirSync(DESTINO, { recursive: true });
  const reg = [], fallaron = [], listas = [];
  for (const lib of LIBS) {
    try {
      const ver = versionExacta(lib.pkg, lib.version);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vend-'));
      const tgz = sh('npm', ['pack', `${lib.pkg}@${ver}`, '--silent'], tmp).split('\n').pop();
      const contenido = sh('tar', ['-tzf', tgz], tmp).split('\n').map(x => x.trim());
      const elegido = lib.archivos.find(a => contenido.includes(`package/${a}`));
      if (!elegido) {
        const js = contenido.filter(x => /\.js$/.test(x)).slice(0, 40).join('\n   ');
        throw new Error(`ninguno de ${lib.archivos.join(', ')} está en ${lib.pkg}@${ver}. Archivos .js del paquete:\n   ${js}`);
      }
      sh('tar', ['-xzf', tgz, `package/${elegido}`], tmp);
      const datos = fs.readFileSync(path.join(tmp, 'package', elegido));
      if (datos.length < 2000) throw new Error(`${elegido} es demasiado chico (${datos.length} bytes)`);
      fs.writeFileSync(path.join(DESTINO, lib.destino), datos);
      reg.push(`${lib.destino}  ←  ${lib.pkg}@${ver}/${elegido}  ·  sha384-${crypto.createHash('sha384').update(datos).digest('base64')}`);
      listas.push(lib);
      console.log(`✔ ${lib.pkg}@${ver} (${elegido}) → js/vendor/${lib.destino} (${datos.length} bytes)`);
    } catch (e) {
      fallaron.push(lib.pkg);
      console.error(`✖ ${lib.pkg}: ${e.message}`);
    }
  }
  // pdf-lib se copió a mano desde pdf-lib@1.17.1 (dist/pdf-lib.min.js)
  reg.push('pdf-lib.min.js  ←  pdf-lib@1.17.1/dist/pdf-lib.min.js');
  fs.writeFileSync(path.join(DESTINO, 'VERSIONES.txt'), `Librerías propias (generado por tools/vendorizar-librerias.js el ${new Date().toISOString().slice(0, 10)})\n${reg.join('\n')}\n`);

  // Solo se cambian los <script> de las librerías que se bajaron bien
  for (const pag of PAGINAS) {
    const ruta = path.join(RAIZ, pag);
    if (!fs.existsSync(ruta)) continue;
    let html = fs.readFileSync(ruta, 'utf8'), cambios = 0;
    for (const lib of listas) {
      html = html.replace(new RegExp(`src="(${lib.url.source})"`, 'g'), () => { cambios++; return `src="js/vendor/${lib.destino}"`; });
    }
    if (cambios) { fs.writeFileSync(ruta, html); console.log(`✔ ${pag}: ${cambios} <script> apuntan a js/vendor/`); }
  }
  if (fallaron.length) { console.error(`\nFallaron: ${fallaron.join(', ')} (siguen cargándose desde el CDN)`); process.exitCode = 1; }
}

if (require.main === module) main();
module.exports = { LIBS, versionExacta };
