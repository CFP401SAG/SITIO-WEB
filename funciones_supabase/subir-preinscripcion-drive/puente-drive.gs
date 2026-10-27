/**
 * Puente de Apps Script: recibe el PDF de la función de Supabase y lo guarda en Drive.
 * Se crea con la cuenta DUEÑA del Drive (el Drive de Giles). No usa Google Cloud ni cuesta nada.
 * Ver LEEME.md para instalarlo.
 */
var CARPETA_RAIZ_ID = '1-nymFK5cE2L9x6Ss5TF-Ymut_9-fWYNx';

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var secreto = PropertiesService.getScriptProperties().getProperty('SECRETO');
    if (!secreto || d.secreto !== secreto) return salida({ error: 'No autorizado' });

    var dirCiclo = subcarpeta(DriveApp.getFolderById(CARPETA_RAIZ_ID), String(d.ciclo));
    var dirTray = subcarpeta(dirCiclo, String(d.trayecto));
    var blob = Utilities.newBlob(Utilities.base64Decode(d.pdf), 'application/pdf', String(d.nombre));

    // si ya había una versión, se manda a la papelera y se guarda la nueva
    if (d.archivo_id) { try { DriveApp.getFileById(d.archivo_id).setTrashed(true); } catch (err) { /* ya no estaba */ } }
    var archivo = dirTray.createFile(blob);
    return salida({ ok: true, archivo_id: archivo.getId() });
  } catch (err) {
    return salida({ error: String(err) });
  }
}

function subcarpeta(padre, nombre) {
  nombre = nombre.replace(/[\\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 120) || 'Sin nombre';
  var it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function salida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
