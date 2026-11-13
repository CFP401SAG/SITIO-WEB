-- 65. Claves temporales aleatorias para cuentas con acceso ampliado
-- Problema: la clave inicial CFP401_<DNI> es predecible (el DNI no es secreto). En estudiantes el daño es acotado
-- (ven solo lo suyo), pero en docentes, Secretaría y coordinación EPS dan acceso a datos de muchas personas.
-- Desde acá:
--   · Estudiantes: sin cambios (siguen con CFP401_<DNI>).
--   · Docente, Secretaría, coord. EPS, administración: la clave inicial / restablecida es ALEATORIA, se muestra una
--     sola vez y la persona debe elegir una propia al primer ingreso (marca user_metadata.must_change_password).
-- Se puede ejecutar más de una vez. Ejecutar completo en Supabase > SQL Editor.

-- 1) Generador de claves temporales (10 caracteres sin letras confusas, ej. «Kp7mX-4tRzW»)
create or replace function public.clave_temporal_aleatoria()
returns text
language plpgsql volatile
set search_path = public, extensions as $fn$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  b bytea := gen_random_bytes(10);
  r text := '';
  i int;
begin
  for i in 0..9 loop
    r := r || substr(alfabeto, (get_byte(b, i) % length(alfabeto)) + 1, 1);
    if i = 4 then r := r || '-'; end if;
  end loop;
  return r;
end $fn$;
revoke all on function public.clave_temporal_aleatoria() from public, anon, authenticated;

-- 2) Restablecer con clave temporal (Dirección y Secretaría = es_admin). Devuelve la clave para mostrarla una vez.
create or replace function public.admin_restablecer_clave_temporal(p_user_id uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_clave text;
  v_rol   text;
  v_yo    uuid := auth.uid();
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;

  select lower(p.rol::text) into v_rol from public.profiles p where p.id = p_user_id;
  if not found then raise exception 'Usuario no encontrado'; end if;
  if v_rol in ('admin', 'administrador') and not public.es_director() then
    raise exception 'Solo la Dirección puede restablecer la clave de un administrador';
  end if;

  v_clave := public.clave_temporal_aleatoria();
  update auth.users
     set encrypted_password = crypt(v_clave, gen_salt('bf', 10)),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('must_change_password', true),
         updated_at = now()
   where id = p_user_id;
  if not found then raise exception 'Usuario no encontrado'; end if;

  begin delete from auth.sessions where user_id = p_user_id; exception when others then null; end;

  insert into public.auditoria (usuario_id, usuario_dni, usuario_rol, tabla, operacion, registro_id, datos_anteriores, datos_nuevos)
  select v_yo, p.dni, p.rol::text, 'auth.users', 'RESTABLECER_CLAVE_TEMPORAL', p_user_id::text, null,
         jsonb_build_object('rol', v_rol)
    from public.profiles p where p.id = v_yo;

  return v_clave;
end $fn$;
revoke all on function public.admin_restablecer_clave_temporal(uuid) from public, anon;
grant execute on function public.admin_restablecer_clave_temporal(uuid) to authenticated;

-- 3) restablecer_clave_basica (la usan Cuentas / regencia): estudiante = CFP401_<DNI> como antes;
--    docente = clave temporal aleatoria con cambio obligatorio.
create or replace function public.restablecer_clave_basica(p_user_id uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_rol   text;
  v_dni   text;
  v_clave text;
  v_obliga boolean;
  v_yo    uuid := auth.uid();
begin
  if not (public.es_admin() or public.es_preceptor()) then
    raise exception 'No autorizado';
  end if;

  select lower(p.rol::text), p.dni into v_rol, v_dni from public.profiles p where p.id = p_user_id;
  if not found then raise exception 'Usuario no encontrado'; end if;
  if v_rol not in ('estudiante', 'docente') then
    raise exception 'Solo se pueden restablecer claves de estudiantes y docentes. Para otras cuentas, consultá a administración.';
  end if;
  if v_dni is null or length(trim(v_dni)) = 0 then raise exception 'La cuenta no tiene DNI cargado'; end if;

  v_obliga := (v_rol <> 'estudiante');
  v_clave := case when v_obliga then public.clave_temporal_aleatoria() else 'CFP401_' || trim(v_dni) end;

  update auth.users
     set encrypted_password = crypt(v_clave, gen_salt('bf', 10)),
         raw_user_meta_data = case when v_obliga
                                   then coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('must_change_password', true)
                                   else raw_user_meta_data end,
         updated_at = now()
   where id = p_user_id;
  if not found then raise exception 'Usuario no encontrado'; end if;

  begin delete from auth.sessions where user_id = p_user_id; exception when others then null; end;

  insert into public.auditoria (usuario_id, usuario_dni, usuario_rol, tabla, operacion, registro_id, datos_anteriores, datos_nuevos)
  select v_yo, p.dni, p.rol::text, 'auth.users', 'RESTABLECER_CLAVE', p_user_id::text, null,
         jsonb_build_object('dni', v_dni, 'rol', v_rol)
    from public.profiles p where p.id = v_yo;

  return v_clave;
end $fn$;
revoke all on function public.restablecer_clave_basica(uuid) from public, anon;
grant execute on function public.restablecer_clave_basica(uuid) to authenticated;

-- 4) Una sola vez: las cuentas que YA existen con rol distinto de estudiante deberán elegir una clave propia
--    en su próximo ingreso (hoy podrían seguir con CFP401_<DNI>).
update auth.users u
   set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('must_change_password', true)
  from public.profiles p
 where p.id = u.id
   and lower(p.rol::text) <> 'estudiante'
   and coalesce((u.raw_user_meta_data ->> 'must_change_password')::boolean, false) = false;

-- Verificación: tienen que aparecer las tres funciones
select proname from pg_proc
 where proname in ('clave_temporal_aleatoria', 'admin_restablecer_clave_temporal', 'restablecer_clave_basica');
