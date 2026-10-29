# CFP N.º 401 San Andrés de Giles — reglas del proyecto

## Ayuda por rol (js/ayuda.js)
La pestaña **Ayuda** tiene una guía para **estudiantes, docentes y Secretaría** (el Director/administrador no la tiene).
**Cada vez que se cambie, agregue o quite una funcionalidad que vea un rol, hay que actualizar la guía de ese
rol en `js/ayuda.js` y la fecha `AYUDA_ACTUALIZADA`.** También cuando cambien permisos, nombres de botones o pasos.
También hay un botón «?» por pantalla y un recorrido guiado (primera vez que entra cada persona): se alimentan de `PANTALLAS` y `BOTON_TEMA` en el mismo `js/ayuda.js`; si cambia el menú o una pantalla, actualizarlos también (la Dirección no los ve).
El contacto del CFP no está en el código: se edita en Preinscripciones → "Contacto del CFP" (SQL 48).

## Al publicar
- Subir el `?v=` del script/CSS modificado en `index.html` (y en `preinscripcion.html` si es la ficha pública).
- Subir `VERSION` en `sw.js`.
- Si cambia `js/ficha_inscripcion.js`, regenerar la función del Drive: `node tools/armar-funcion-drive.js`
  y avisar que hay que volver a desplegar `subir-preinscripcion-drive`.
- Todo cambio de base va en un archivo nuevo `sql/NN_*.sql`.

## Permisos (Giles)
- Dirección (`admin`) y Secretaría tienen permisos plenos, salvo que solo la Dirección asigna/modifica el rol Administrador.
- Cooperadora y exportación SISGE: solo Dirección y Secretaría.
- No hay preceptores ni regente.
