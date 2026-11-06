-- =====================================================================================
-- PASO 60 — Rol «Coordinador/a EPS» (coord_eps): ve solo la sección EPS.
-- Ejecutar UNA vez en Supabase → SQL Editor. Requiere el paso 57.
-- =====================================================================================
do $$
declare c record;
begin
  for c in select con.conname from pg_constraint con
     where con.conrelid = 'public.profiles'::regclass and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%rol%' and pg_get_constraintdef(con.oid) ilike '%docente%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
  execute 'alter table public.profiles add constraint profiles_rol_check
           check (lower(rol::text) in (''admin'',''administrador'',''docente'',''estudiante'',''preceptor'',''regente'',''secretaria'',''coord_eps''))';
end $$;

create or replace function public.eps_puede() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin_total()
      or exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.rol::text) = 'coord_eps')
      or exists (select 1 from public.eps_personal e
                 where e.user_id = auth.uid() and e.funcion = 'coordinador' and e.activo);
$$;
