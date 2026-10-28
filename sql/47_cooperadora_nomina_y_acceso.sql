-- =====================================================================================
-- PASO 47 — CFP 401 Giles: Cooperadora (nómina oficial + acceso solo Dirección y Secretaría)
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
-- 1) La nómina de la Comisión Directiva (formulario oficial) pide domicilio y localidad.
-- 2) Todo lo de Cooperadora queda accesible SOLO para Dirección (admin) y Secretaría.
--    es_admin_total() ya incluye a Secretaría en Giles (paso 38). Se sacan Regencia,
--    Preceptoría y cualquier otro rol: docentes y estudiantes nunca tuvieron acceso.
-- =====================================================================================

alter table public.cooperadora_comision add column if not exists domicilio text;
alter table public.cooperadora_comision add column if not exists localidad text;

drop policy if exists coop_socios_select on public.cooperadora_socios;
create policy coop_socios_select on public.cooperadora_socios for select to authenticated
  using (public.es_admin_total());
drop policy if exists coop_ejer_select on public.cooperadora_ejercicios;
create policy coop_ejer_select on public.cooperadora_ejercicios for select to authenticated
  using (public.es_admin_total());
drop policy if exists coop_com_select on public.cooperadora_comision;
create policy coop_com_select on public.cooperadora_comision for select to authenticated
  using (public.es_admin_total());
drop policy if exists coop_mov_select on public.cooperadora_movimientos;
create policy coop_mov_select on public.cooperadora_movimientos for select to authenticated
  using (public.es_admin_total());

drop policy if exists coop_socios_write on public.cooperadora_socios;
create policy coop_socios_write on public.cooperadora_socios for all to authenticated
  using (public.es_admin_total()) with check (public.es_admin_total());
drop policy if exists coop_ejer_write on public.cooperadora_ejercicios;
create policy coop_ejer_write on public.cooperadora_ejercicios for all to authenticated
  using (public.es_admin_total()) with check (public.es_admin_total());
drop policy if exists coop_com_write on public.cooperadora_comision;
create policy coop_com_write on public.cooperadora_comision for all to authenticated
  using (public.es_admin_total()) with check (public.es_admin_total());
drop policy if exists coop_mov_write on public.cooperadora_movimientos;
create policy coop_mov_write on public.cooperadora_movimientos for all to authenticated
  using (public.es_admin_total()) with check (public.es_admin_total());

-- Verificación: 8 políticas, todas con es_admin_total
select tablename, policyname from pg_policies
where tablename like 'cooperadora_%' order by 1, 2;
