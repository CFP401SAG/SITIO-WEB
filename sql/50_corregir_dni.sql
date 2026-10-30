-- =====================================================================================
-- PASO 50 — Corregir el DNI de una persona desde "Usuarios y Roles" (✏️ Corregir datos)
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
-- El DNI es el usuario de ingreso y el vínculo de inscripciones, asistencias, notas, etc.
-- Esta función lo cambia en TODOS esos lugares a la vez (todo o nada):
--   * profiles.dni, datos_estudiante, padron_estudiantes, preinscripciones
--   * toda columna estudiante_user / docente_user (inscripciones, notas, asistencias,
--     entregas, observaciones, suplentes, trayectos del docente…)
--   * el correo de ingreso, si era el automático DNI@cfp401.ar
-- No cambia la contraseña. La auditoría histórica no se toca (queda como estaba).
-- La pueden usar la Dirección y Secretaría; una cuenta de Administrador, solo la Dirección.
-- Si el DNI nuevo ya existe en otra cuenta, se rechaza y no se cambia nada.
-- =====================================================================================

create or replace function public.admin_corregir_dni(p_user_id uuid, p_dni_nuevo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_nuevo text := regexp_replace(coalesce(p_dni_nuevo, ''), '\D', '', 'g');
  v_viejo text;
  v_rol   text;
  v_mail  text;
  v_res   jsonb := '{}'::jsonb;
  v_yo    uuid := auth.uid();
  r       record;
  n       bigint;
begin
  if not public.es_admin_total() then
    raise exception 'No autorizado';
  end if;

  if v_nuevo !~ '^[0-9]{6,9}$' then
    raise exception 'El DNI debe tener entre 6 y 9 números, sin puntos';
  end if;

  select trim(dni), lower(coalesce(rol::text, '')) into v_viejo, v_rol from public.profiles where id = p_user_id;
  if not found then raise exception 'Usuario no encontrado'; end if;

  if v_rol in ('admin', 'administrador') and not public.es_director() then
    raise exception 'Solo la Dirección puede modificar una cuenta de administrador';
  end if;

  if v_viejo = v_nuevo then raise exception 'El DNI nuevo es igual al actual'; end if;

  if exists (select 1 from public.profiles where trim(dni) = v_nuevo and id <> p_user_id) then
    raise exception 'Ya existe otra cuenta con ese DNI';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_nuevo || '@cfp401.ar' and id <> p_user_id) then
    raise exception 'Ya existe otra cuenta de ingreso con ese DNI';
  end if;
  if to_regclass('public.datos_estudiante') is not null
     and exists (select 1 from public.datos_estudiante where dni = v_nuevo) then
    raise exception 'Ya existe una ficha de estudiante con ese DNI';
  end if;
  if to_regclass('public.padron_estudiantes') is not null
     and exists (select 1 from public.padron_estudiantes where dni = v_nuevo) then
    raise exception 'Ya existe un registro del padrón con ese DNI';
  end if;

  -- 1) Cuenta de ingreso: solo si el correo era el automático DNI@cfp401.ar
  select lower(email) into v_mail from auth.users where id = p_user_id;
  if v_mail = v_viejo || '@cfp401.ar' then
    update auth.users
       set email = v_nuevo || '@cfp401.ar',
           raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', v_nuevo || '@cfp401.ar'),
           updated_at = now()
     where id = p_user_id;
    update auth.identities
       set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_nuevo || '@cfp401.ar'),
           provider_id = case when lower(provider_id) = v_viejo || '@cfp401.ar' then v_nuevo || '@cfp401.ar' else provider_id end,
           updated_at = now()
     where user_id = p_user_id and provider = 'email';
    v_res := v_res || jsonb_build_object('acceso', v_nuevo || '@cfp401.ar');
  end if;

  -- 2) Tablas que guardan el DNI como dato propio
  update public.profiles set dni = v_nuevo where id = p_user_id;
  v_res := v_res || jsonb_build_object('profiles', 1);

  if to_regclass('public.datos_estudiante') is not null then
    update public.datos_estudiante set dni = v_nuevo where dni = v_viejo;
    get diagnostics n = row_count; if n > 0 then v_res := v_res || jsonb_build_object('datos_estudiante', n); end if;
  end if;
  if to_regclass('public.padron_estudiantes') is not null then
    update public.padron_estudiantes set dni = v_nuevo where dni = v_viejo;
    get diagnostics n = row_count; if n > 0 then v_res := v_res || jsonb_build_object('padron_estudiantes', n); end if;
  end if;
  if to_regclass('public.preinscripciones') is not null then
    update public.preinscripciones set dni = v_nuevo where dni = v_viejo;
    get diagnostics n = row_count; if n > 0 then v_res := v_res || jsonb_build_object('preinscripciones', n); end if;
  end if;

  -- 3) Todo lo que se vincula por DNI (inscripciones, notas, asistencias, trayectos del docente, etc.)
  for r in
    select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
       and c.column_name in ('estudiante_user', 'docente_user')
       and c.data_type in ('text', 'character varying')
  loop
    execute format('update public.%I set %I = $1 where %I = $2', r.table_name, r.column_name, r.column_name)
      using v_nuevo, v_viejo;
    get diagnostics n = row_count;
    if n > 0 then v_res := v_res || jsonb_build_object(r.table_name || '.' || r.column_name, n); end if;
  end loop;

  -- 4) Registro en la auditoría
  begin
    insert into public.auditoria (usuario_id, usuario_dni, usuario_rol, tabla, operacion, registro_id, datos_anteriores, datos_nuevos)
    select v_yo, p.dni, p.rol::text, 'profiles', 'CORREGIR_DNI', p_user_id::text,
           jsonb_build_object('dni', v_viejo), jsonb_build_object('dni', v_nuevo, 'cambios', v_res)
      from public.profiles p where p.id = v_yo;
  exception when others then null;
  end;

  return v_res;
end;
$$;

revoke all on function public.admin_corregir_dni(uuid, text) from public, anon;
grant execute on function public.admin_corregir_dni(uuid, text) to authenticated;

-- Verificación: tiene que devolver una fila
select proname from pg_proc where proname = 'admin_corregir_dni';
