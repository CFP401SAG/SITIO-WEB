-- =====================================================================================
-- PASO 49 — Cambiar el correo de ACCESO desde "Usuarios y Roles" (✏️ Corregir datos)
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
-- Hasta ahora, editar el correo solo cambiaba el dato de contacto (tabla profiles) y la
-- cuenta de acceso seguía siendo DNI@cfp401.ar. Esta función cambia también el correo
-- con el que la persona ingresa (auth.users / auth.identities).
--   * La puede usar la Dirección y Secretaría (es_admin_total).
--   * Una cuenta de Administrador solo la modifica la Dirección.
--   * No permite repetir un correo que ya usa otra cuenta.
-- =====================================================================================

create or replace function public.admin_cambiar_correo_acceso(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_rol   text;
begin
  if not public.es_admin_total() then
    raise exception 'No autorizado';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no es válido';
  end if;

  select lower(coalesce(rol::text, '')) into v_rol from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Usuario no encontrado';
  end if;

  if v_rol in ('admin', 'administrador') and not public.es_director() then
    raise exception 'Solo la Dirección puede modificar una cuenta de administrador';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email and id <> p_user_id) then
    raise exception 'Ese correo ya lo usa otra cuenta';
  end if;

  update auth.users
     set email = v_email,
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', v_email),
         updated_at = now()
   where id = p_user_id;

  update auth.identities
     set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email),
         updated_at = now()
   where user_id = p_user_id and provider = 'email';

  update public.profiles set email = v_email where id = p_user_id;
end;
$$;

revoke all on function public.admin_cambiar_correo_acceso(uuid, text) from public, anon;
grant execute on function public.admin_cambiar_correo_acceso(uuid, text) to authenticated;

-- Verificación: tiene que devolver una fila
select proname from pg_proc where proname = 'admin_cambiar_correo_acceso';
