-- =====================================================================================
-- PASO 56 — Licencias por cargo / trayecto
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
-- Permite indicar a qué cargo/trayecto del docente corresponde cada licencia o paro, para
-- evaluar cada cargo por separado. Vacío (null) = corresponde a todos sus cargos/trayectos.
-- =====================================================================================
alter table public.licencias_docentes add column if not exists trayecto_ids bigint[];
