# Subida automática de preinscripciones a Drive

Cada preinscripción nueva se guarda como PDF en
`<Preinscripciones> / <ciclo> / <trayecto> / Ficha_inscripcion_<N.º>_<APELLIDO>.pdf`.

Archivos: `plantilla.ts` (el código) → `node tools/armar-funcion-drive.js` → `index.ts` (lo que se pega en Supabase).
Si cambia `js/ficha_inscripcion.js`, volver a correr el script y re-desplegar.

## Puesta en marcha (una sola vez)
1. **Google Cloud** (con la cuenta dueña del Drive): crear proyecto → «API y servicios» → habilitar **Google Drive API**.
2. **Pantalla de consentimiento OAuth**: tipo *Interno* si la cuenta es de Workspace (abc.gob.ar); si no, *Externo* y publicarla («En producción»), si no el permiso vence a los 7 días.
3. **Credenciales → ID de cliente OAuth** tipo *Aplicación web*; agregar como URI de redirección `https://developers.google.com/oauthplayground`. Anotar *Client ID* y *Client secret*.
4. **OAuth Playground** (developers.google.com/oauthplayground): engranaje → *Use your own OAuth credentials* (pegar ID y secreto) → en Scopes escribir `https://www.googleapis.com/auth/drive` → Authorize → *Exchange authorization code for tokens* → copiar el **Refresh token**.
5. **Supabase → Edge Functions → Secrets**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `DRIVE_FOLDER_ID` (id de la carpeta «Preinscripciones»; es lo que va después de `/folders/` en su link), y opcional `SITE_URL`.
6. **Desplegar** la función `subir-preinscripcion-drive` pegando `index.ts`, con **Verify JWT desactivado**.
7. Ejecutar `sql/44_preinscripciones_drive.sql`.
