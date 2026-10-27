// Genera funciones_supabase/subir-preinscripcion-drive/index.ts con el generador de PDF de
// js/ficha_inscripcion.js incluido (así el PDF de Drive es idéntico al de la plataforma).
// Uso:  node tools/armar-funcion-drive.js     (volver a correrlo si cambia ficha_inscripcion.js)
const fs = require('fs');
const fuente = fs.readFileSync(__dirname + '/../js/ficha_inscripcion.js', 'utf8');
const plantilla = fs.readFileSync(__dirname + '/../funciones_supabase/subir-preinscripcion-drive/plantilla.ts', 'utf8');
const salida = plantilla.replace('__FICHA_JS__', () => JSON.stringify(fuente));
fs.writeFileSync(__dirname + '/../funciones_supabase/subir-preinscripcion-drive/index.ts', salida);
console.log('index.ts generado (' + Math.round(salida.length / 1024) + ' KB)');
