-- =====================================================================================
-- PASO 55 — Licencias: período de Calificación Anual Docente (CAD) y total oficial de días
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
-- Fuente: «Pautas de Orientación para la Calificación Anual Docente 2026» (DGAD / Inspección
-- General): docentes con continuidad del 15/11/2025 al 16/11/2026, total de días de asistencia 248;
-- titulares interinos del 01/03/2026 al 16/11/2026.
-- =====================================================================================
alter table public.licencias_ciclo
  add column if not exists cad_desde date,
  add column if not exists cad_hasta date,
  add column if not exists cad_total integer,          -- total oficial de días de asistencia del período CAD
  add column if not exists cad_interino_desde date;    -- inicio del período de titulares interinos

-- Si el ciclo 2026 ya está guardado, le completa el período CAD y el total oficial.
-- (Si no está guardado, la pantalla usa esos mismos valores por defecto.)
update public.licencias_ciclo set
  cad_desde = coalesce(cad_desde, '2025-11-15'), cad_hasta = coalesce(cad_hasta, '2026-11-16'),
  cad_total = coalesce(cad_total, 248), cad_interino_desde = coalesce(cad_interino_desde, '2026-03-01')
where ciclo = 2026;
