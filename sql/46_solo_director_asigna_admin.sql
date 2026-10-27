-- =====================================================================================
-- PASO 46 — CFP 401 Giles: solo la DIRECCIÓN (rol admin) maneja cuentas de Administrador
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
-- Antes, Secretaría tenía permisos plenos y por eso podía cambiarle el rol al Director o
-- nombrar administradores. Desde ahora:
--   * Secretaría NO puede dar ni quitar el rol de administrador.
--   * Secretaría NO puede cambiar rol/estado, restablecer la clave ni eliminar a un
--     administrador.
--   * Todo lo demás de Secretaría queda igual (docentes, estudiantes, secretarías, etc.).
-- Se aplica en la base, así que no se puede saltear desde el navegador.
-- =====================================================================================

create or replace function public.es_director()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.rol::text) in ('admin', 'administrador')
      and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
  );
$$;

create or replace function public.profiles_proteger_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rol_viejo text;
  rol_nuevo text;
begin
  -- Sin sesión (SQL Editor, service role, alta por trigger de Auth): no se restringe
  if auth.uid() is null or public.es_director() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    rol_viejo := '';
    rol_nuevo := lower(coalesce(new.rol::text, ''));
  elsif tg_op = 'UPDATE' then
    rol_viejo := lower(coalesce(old.rol::text, ''));
    rol_nuevo := lower(coalesce(new.rol::text, ''));
  else
    rol_viejo := lower(coalesce(old.rol::text, ''));
    rol_nuevo := '';
  end if;

  if rol_nuevo in ('admin', 'administrador') and rol_viejo is distinct from rol_nuevo then
    raise exception 'Solo la Dirección puede asignar el rol de administrador';
  end if;

  if rol_viejo in ('admin', 'administrador') then
    if tg_op = 'DELETE' then
      raise exception 'Solo la Dirección puede eliminar una cuenta de administrador';
    end if;
    if tg_op = 'UPDATE' and (
         rol_nuevo is distinct from rol_viejo
         or new.estado is distinct from old.estado
       ) then
      raise exception 'Solo la Dirección puede modificar el rol o el estado de un administrador';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists profiles_proteger_admin on public.profiles;
create trigger profiles_proteger_admin
before insert or update or delete on public.profiles
for each row execute function public.profiles_proteger_admin();

-- Restablecer clave: Secretaría no puede hacerlo sobre una cuenta de administrador
create or replace function public.admin_restablecer_clave(p_user_id uuid, p_nueva text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;

  if not public.es_director() and exists (
    select 1 from public.profiles p
    where p.id = p_user_id and lower(p.rol::text) in ('admin', 'administrador')
  ) then
    raise exception 'Solo la Dirección puede restablecer la clave de un administrador';
  end if;

  if p_nueva is null or length(p_nueva) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;

  update auth.users
     set encrypted_password = crypt(p_nueva, gen_salt('bf', 10)),
         updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;

  begin
    delete from auth.sessions where user_id = p_user_id;
  exception when others then
    null;
  end;
end;
$$;

revoke all on function public.admin_restablecer_clave(uuid, text) from public, anon;
grant execute on function public.admin_restablecer_clave(uuid, text) to authenticated;

-- Verificación: tiene que devolver 3 filas
select proname from pg_proc
where proname in ('es_director', 'profiles_proteger_admin', 'admin_restablecer_clave');
