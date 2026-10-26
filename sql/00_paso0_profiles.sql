-- =============================================================================
-- PASO 0 — Tabla de perfiles de usuario + alta automática desde Auth
-- Ejecutar UNA SOLA VEZ, ANTES del paso 1. Se puede correr de nuevo sin romper
-- nada (usa "if not exists" / "or replace" / "drop ... if exists" en todo).
--
-- Esta tabla no estaba en los 37 archivos de sql/ porque en Luján se había
-- creado a mano en el Table Editor de Supabase, antes de empezar a llevar
-- este historial. Acá se reconstruye con las mismas columnas que usa la
-- plataforma (confirmado revisando el código: js/auth.js, js/usuarios.js,
-- js/cuentas.js, js/auditoria.js, js/trayectos.js, js/cooperadora.js).
-- =============================================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  dni        text,
  nombre     text,
  apellido   text,
  email      text,
  rol        text not null default 'estudiante',
  estado     text not null default 'PENDIENTE',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Al registrarse una cuenta nueva en Auth (botón "Nuevo usuario" del admin,
-- o autoinscripción si está habilitada), se crea automáticamente su fila en
-- profiles, con los datos que mandó el formulario (dni/nombre/apellido van
-- en raw_user_meta_data) y rol "estudiante" / estado "PENDIENTE" por
-- defecto. Después, quien da de alta el usuario la completa (rol real,
-- estado ACTIVO) — eso ya lo hace el js/usuarios.js existente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, dni, nombre, apellido, email, rol, estado)
  values (
    new.id,
    new.raw_user_meta_data->>'dni',
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'apellido',
    new.email,
    'estudiante',
    'PENDIENTE'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Comprobación final: tiene que dar 1 fila con el nombre de la tabla y 1 con el trigger
select 'tabla profiles' as objeto, count(*) from pg_tables where schemaname = 'public' and tablename = 'profiles'
union all select 'trigger on_auth_user_created', count(*) from pg_trigger where tgname = 'on_auth_user_created';
