-- =====================================================================================
-- PASO 48 — CFP 401 Giles: contacto del CFP editable para la pestaña "Ayuda"
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
-- El texto de contacto (teléfono, WhatsApp, mail, dirección y horarios) se carga en
-- Preinscripciones → "Contacto del CFP" y se muestra en la Ayuda de estudiantes,
-- docentes y Secretaría. Lo edita Dirección o Secretaría (ya tienen permiso sobre
-- inscripcion_config); cualquier persona con sesión lo puede leer.
-- =====================================================================================

alter table public.inscripcion_config add column if not exists ayuda_contacto text
  check (ayuda_contacto is null or char_length(ayuda_contacto) <= 600);

create or replace function public.ayuda_contacto()
returns text language sql stable security definer set search_path = public as $$
  select ayuda_contacto from public.inscripcion_config where id = 1;
$$;

revoke all on function public.ayuda_contacto() from public, anon;
grant execute on function public.ayuda_contacto() to authenticated;

-- Verificación: tiene que devolver 1 fila (el valor puede ser null hasta que lo cargues)
select ayuda_contacto from public.inscripcion_config where id = 1;
