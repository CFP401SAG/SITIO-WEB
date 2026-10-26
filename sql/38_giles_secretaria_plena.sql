-- =====================================================================================
-- PASO 38 — CFP 401 San Andrés de Giles: Secretaría con permisos PLENOS (igual que Dirección)
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
-- En Giles la conducción es solo Director y Secretaria, y ambos deben tener el MISMO
-- nivel de acceso (a diferencia de Luján, donde Secretaría solo ve/imprime Actas,
-- cifras y Cooperadora). Acá se suma 'secretaria' a la definición de es_admin_total(),
-- que es la base de la que depende es_admin() (dirección en sentido amplio). Como
-- prácticamente todas las políticas de la base usan es_admin() o es_admin_total(),
-- este único cambio le abre a Secretaría exactamente lo mismo que ya tiene Dirección:
-- usuarios y roles, respaldos, cierre de ciclo, certificados, trayectos, etc.
-- =====================================================================================

create or replace function public.es_admin_total()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.rol::text) in ('admin', 'administrador', 'secretaria', 'secretario')
      and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
  );
$$;

-- Verificación: tiene que devolver una fila
select proname, prosecdef as security_definer
from pg_proc
where proname = 'es_admin_total';
