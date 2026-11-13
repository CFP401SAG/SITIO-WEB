# Guía de protección de la plataforma (CFP 401)

Cinco cosas para proteger lo que ya funciona. Cada sección dice **qué hacer una sola vez**.

## 0. Antes que nada: subir los archivos a GitHub
Subí **toda la carpeta**. Los dos archivos de `workflows_para_github` tienen que quedar en GitHub dentro de `.github/workflows/`: en GitHub usá *Add file → Create new file*, escribí `.github/workflows/backup-semanal.yml` como nombre, pegá el contenido y *Commit*; repetí con `mantener-activo.yml`. Después recargá la plataforma con **Ctrl + F5**.

## 1. Backups automáticos (cada domingo)
El archivo `.github/workflows/backup-semanal.yml` copia la base de datos y la guarda **cifrada** durante 90 días.

1. En Supabase: botón **Connect** (arriba) → pestaña **Session pooler** → copiá la cadena `postgresql://postgres.xxxx:[YOUR-PASSWORD]@...:5432/postgres` y reemplazá `[YOUR-PASSWORD]` por la contraseña de la base (*Project Settings → Database → Reset database password* si no la recordás).
2. En GitHub: repositorio → **Settings → Secrets and variables → Actions → New repository secret**. Creá dos:
   - `SUPABASE_DB_URL` → la cadena del paso 1.
   - `BACKUP_PASSPHRASE` → una frase **aleatoria de 24 o más caracteres** (generala con el administrador de contraseñas del navegador, o con `openssl rand -base64 32`; no una frase inventada). **Es lo único que protege el backup**: el repositorio es público y cualquiera con cuenta de GitHub puede bajar el archivo cifrado, que incluye las cuentas de acceso. El workflow falla si la frase tiene menos de 24 caracteres. **Guardala en un lugar seguro: sin ella no se puede abrir ningún backup.** Si algún día la cambiás, los respaldos anteriores se siguen abriendo con la frase vieja.
3. Pestaña **Actions → Backup semanal de la base de datos → Run workflow** para probar. Tiene que quedar en verde.
4. Para bajar un backup: Actions → la ejecución → *Artifacts* → `respaldo-cifrado`. Para abrirlo (en una PC con GnuPG): `gpg -o respaldo.tar.gz -d respaldo-AAAA-MM-DD.tar.gz.gpg`.
5. **Restaurar** (solo ante un problema grave, idealmente con ayuda técnica y en un proyecto nuevo de Supabase): descomprimir (`tar xzf respaldo.tar.gz`) y ejecutar con `psql "URI_DEL_PROYECTO"` primero `respaldo_auth.sql` (cuentas) y después `respaldo_public.sql` (plataforma). Luego volver a desplegar las funciones de `funciones_supabase/` y, si el proyecto es nuevo, actualizar `js/supabase-config.js`.

Además existe el **respaldo manual**: Base de Datos → *Descargar Backup* baja todas las tablas de la plataforma en un archivo JSON (sin contraseñas). Tiene datos personales: guardalo en un lugar seguro.

Importante: el repositorio es público, por eso el backup va cifrado. Nunca subas un backup sin cifrar.

## 2. Entorno de pruebas (para probar sin tocar datos reales)
1. Supabase → **New project** (gratis). Nombre sugerido: `cfp403-pruebas`.
2. En el SQL Editor del proyecto nuevo, ejecutá en orden `sql/01…`, `02…`, `03…` y `04…`.
3. Desplegá las dos funciones (`importar-estudiantes`, `eliminar-usuario`) igual que en el proyecto real.
4. Abrí `js/entorno-prueba.js` y completá `url` y `anonKey` con los del proyecto nuevo (*Project Settings → API*).
5. Para usarlo, abrí la plataforma con `?entorno=prueba` al final de la dirección (aparece un cartel naranja). Para volver al real: `?entorno=produccion`.

Regla de oro: cualquier cambio nuevo se prueba primero ahí.

## 3. Evitar que Supabase pause el proyecto
`.github/workflows/mantener-activo.yml` hace una consulta mínima cada 3 días. No requiere configuración. Comprobá en **Actions** que figure y esté en verde. Aviso: GitHub desactiva las tareas programadas si el repositorio pasa 60 días sin ningún cambio; si pasa, entrá a Actions y presioná *Enable*.

## 4. Auditoría de cambios
1. Ejecutá `sql/04_auditoria_y_bajas.sql` en el SQL Editor. Al final tiene que listar las tablas con su disparador.
2. En la plataforma, como administrador: menú **🕵️ Auditoría**. Muestra quién cambió notas, roles, inscripciones, asistencias, clases, trayectos y módulos, con el valor anterior y el nuevo.

## 5. Contraseñas iniciales, bajas y eliminación
- Las cuentas de **estudiantes** (importación CSV, preinscripción o alta manual) se crean con la contraseña inicial **`CFP401_` + DNI** (por ejemplo `CFP401_30123456`). Las cuentas de **docentes, Secretaría, coordinación EPS y administración** reciben una **clave temporal aleatoria** que se muestra una sola vez y deben cambiarla al primer ingreso (`sql/65_claves_temporales.sql`). Conviene pedir a cada persona que la cambie con **Cambiar mi contraseña** la primera vez que entra.
- **Inhabilitar** (recomendado): la persona no puede ingresar y conserva su historial; se puede **Reactivar**.
- **Eliminar definitivamente**: requiere la función `eliminar-usuario` desplegada en Supabase. Si la persona tiene historial pide confirmación extra, y lo borrado queda copiado en la Auditoría.

## 6. Seguridad del texto
Los títulos, comentarios y nombres que se escriben en la plataforma ahora se muestran como texto (no pueden ejecutar código), y los links de entrega solo se aceptan si empiezan con `http://` o `https://`.

## 7. Tablas viejas (archivo)
`sql/13_revision_y_limpieza.sql` mueve las tablas que la plataforma ya no usa (`usuarios_legacy`, `profiles_respaldo_20261021`, `notas_modulares`, `contenidos`, `entregas`, `actividades`, `excepciones_modulos`) a un esquema aparte llamado **archivo**: no se borran, pero dejan de estar al alcance de internet. Al final muestra una lista de controles de seguridad que tienen que decir **OK**. Para volver a traer una tabla: `alter table archivo.NOMBRE set schema public;`.

## 8. Funciones automáticas y preinscripción pública (sql/66)
- **Orden:** 1) ejecutar `sql/66_proteccion_preinscripcion_y_funciones.sql` en el SQL Editor; 2) volver a desplegar las funciones `resguardo-semanal` y `subir-preinscripcion-drive` (pegar su `index.ts`, con «Verify JWT» desactivado, como siempre); 3) probar: Preinscripciones → reintentar una subida a Drive, y en Supabase → Edge Functions → `resguardo-semanal` → Test con el cuerpo `{}` (tiene que devolver «No autorizado»; la ejecución del domingo sí funciona porque la base manda el secreto).
- **Qué hace:** la base guarda un secreto interno (tabla `secretos_internos`, ilegible desde la web) y lo manda al avisar a las funciones. Las funciones solo obedecen a la base o a una persona de Dirección/Secretaría con sesión. Si ejecutás las funciones nuevas **antes** del SQL, dejan de funcionar hasta que lo ejecutes.
- **Preinscripción:** tope de 30 por hora por conexión (se guarda una huella irreversible de la IP) además del tope de 5 por DNI y ciclo y del campo trampa para robots. No frena a un ataque desde muchas conexiones distintas; para eso existe el tope general de 150 cada 10 minutos, que protege la base pero puede frenar inscripciones reales mientras dure el ataque.

