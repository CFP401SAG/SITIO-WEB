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
  { pkg: '@supabase/supabase-js', version: 'latest-2', archivo: 'dist/umd/supabase.js', destino: 'supabase.js', url: /https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"']+/ },
  { pkg: 'sweetalert2', version: 'latest-11', archivo: 'dist/sweetalert2.all.min.js', destino: 'sweetalert2.all.min.js', url: /https:\/\/cdn\.jsdelivr\.net\/npm\/sweetalert2@[^"']+/ },
  { pkg: 'canvas-confetti', version: '1.6.0', archivo: 'dist/confetti.browser.min.js', destino: 'confetti.browser.min.js', url: /https:\/\/cdn\.jsdelivr\.net\/npm\/canvas-confetti@[^"']+/ },
  { pkg: 'exceljs', version: '4.3.0', archivo: 'dist/exceljs.min.js', destino: 'exceljs.min.js', url: /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/exceljs\/[^"']+/ },
  { pkg: 'qrcode-generator', version: '1.4.4', archivo: 'qrcode.js', destino: 'qrcode.js', url: /https:\/\/cdn\.jsdelivr\.net\/npm\/qrcode-generator@[^"']+/ }
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
  const reg = [];
  for (const lib of LIBS) {
    const ver = versionExacta(lib.pkg, lib.version);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vend-'));
    const tgz = sh('npm', ['pack', `${lib.pkg}@${ver}`, '--silent'], tmp).split('\n').pop();
    sh('tar', ['-xzf', tgz, `package/${lib.archivo}`], tmp);
    const datos = fs.readFileSync(path.join(tmp, 'package', lib.archivo));
    if (datos.length < 2000) throw new Error(`${lib.pkg}: el archivo ${lib.archivo} es demasiado chico (${datos.length} bytes)`);
    fs.writeFileSync(path.join(DESTINO, lib.destino), datos);
    reg.push(`${lib.destino}  ←  ${lib.pkg}@${ver}/${lib.archivo}  ·  sha384-${crypto.createHash('sha384').update(datos).digest('base64')}`);
    console.log(`✔ ${lib.pkg}@${ver} → js/vendor/${lib.destino} (${datos.length} bytes)`);
  }
  // pdf-lib se copió a mano desde pdf-lib@1.17.1 (dist/pdf-lib.min.js)
  reg.push('pdf-lib.min.js  ←  pdf-lib@1.17.1/dist/pdf-lib.min.js');
  fs.writeFileSync(path.join(DESTINO, 'VERSIONES.txt'), `Librerías propias (generado por tools/vendorizar-librerias.js el ${new Date().toISOString().slice(0, 10)})\n${reg.join('\n')}\n`);

  for (const pag of PAGINAS) {
    const ruta = path.join(RAIZ, pag);
    if (!fs.existsSync(ruta)) continue;
    let html = fs.readFileSync(ruta, 'utf8'), cambios = 0;
    for (const lib of LIBS) {
      html = html.replace(new RegExp(`src="(${lib.url.source})"`, 'g'), () => { cambios++; return `src="js/vendor/${lib.destino}"`; });
    }
    if (cambios) { fs.writeFileSync(ruta, html); console.log(`✔ ${pag}: ${cambios} <script> apuntan a js/vendor/`); }
  }
}

if (require.main === module) main();
module.exports = { LIBS, versionExacta };
