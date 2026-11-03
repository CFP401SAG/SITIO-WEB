-- =====================================================================================
-- PASO 51 — Recuperatorio / Trabajo de refuerzo en las publicaciones de los trayectos
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
-- Agrega a "clases" una clasificación opcional para marcar una publicación como
-- 'recuperatorio' o 'refuerzo' (queda vacía en las publicaciones comunes).
-- Sin esta columna la plataforma funciona igual: el envío a varios estudiantes se
-- hace, y la clasificación se escribe delante del título.
-- =====================================================================================
alter table public.clases add column if not exists categoria text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clases_categoria_chk') then
    alter table public.clases add constraint clases_categoria_chk
      check (categoria is null or categoria in ('recuperatorio', 'refuerzo'));
  end if;
end $$;

select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'clases' and column_name = 'categoria';
