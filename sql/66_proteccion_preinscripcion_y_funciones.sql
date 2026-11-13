-- =====================================================================================
-- PASO 66 — PROTECCIÓN DE LA PREINSCRIPCIÓN PÚBLICA Y DE LAS FUNCIONES AUTOMÁTICAS (sin servicios externos)
-- Ejecutar UNA vez en Supabase → SQL Editor, ANTES de volver a desplegar las funciones
-- «resguardo-semanal» y «subir-preinscripcion-drive» (se puede repetir sin romper nada).
--
-- 1. Un secreto interno guardado en la base (tabla secretos_internos: nadie puede leerla desde la web).
--    La base lo manda en una cabecera cuando avisa a las funciones; las funciones lo verifican.
--    Así solo la base (o una persona de Dirección/Secretaría con sesión) puede dispararlas.
-- 2. Preinscripción: tope de 30 por hora por conexión (huella de la IP, no la IP). Se suma al tope por DNI.
-- =====================================================================================

create table if not exists public.secretos_internos (
  nombre text primary key,
  valor  text not null
);
alter table public.secretos_internos enable row level security;      -- sin políticas: nadie la lee desde la web
revoke all on public.secretos_internos from anon, authenticated;

insert into public.secretos_internos (nombre, valor)
values ('interno', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (nombre) do nothing;

alter table public.preinscripciones add column if not exists ip_hash text;
create index if not exists preinscripciones_ip_hash_idx on public.preinscripciones (ip_hash, created_at);

-- El aviso a Drive ahora lleva el secreto
create or replace function public.preinscripciones_avisar_drive()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare v_secreto text;
begin
  begin
    select valor into v_secreto from public.secretos_internos where nombre = 'interno';
    perform net.http_post(
      url     := 'https://smheqlbhwiybhjdsjxzw.supabase.co/functions/v1/subir-preinscripcion-drive',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-interno', coalesce(v_secreto, '')),
      body    := jsonb_build_object('id', new.id)
    );
  exception when others then
    null;   -- nunca debe impedir que la preinscripción se guarde
  end;
  return new;
end $$;

-- El resguardo semanal de la auditoría (domingo 03:00 hora de Argentina) también lleva el secreto
do $$ begin perform cron.unschedule('resguardo-auditoria'); exception when others then null; end $$;
do $$
declare v_secreto text;
begin
  select valor into v_secreto from public.secretos_internos where nombre = 'interno';
  perform cron.schedule(
    'resguardo-auditoria',
    '0 6 * * 0',
    format($c$
      select net.http_post(
        url     := 'https://smheqlbhwiybhjdsjxzw.supabase.co/functions/v1/resguardo-semanal',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-interno', %L),
        body    := '{}'::jsonb
      );
    $c$, v_secreto)
  );
end $$;

-- preinscribir: igual que en el paso 44, más el tope por conexión
create or replace function public.preinscribir(p_trayecto bigint, p_datos jsonb, p_web text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg   public.inscripcion_config;
  dni_  text;
  ape   text;
  nom   text;
  mail  text;
  nuevo bigint;
  num   text;
  v_ip   text;
  v_hash text;
begin
  if coalesce(p_web, '') <> '' then raise exception 'No se pudo enviar la preinscripción'; end if;

  -- Tope por conexión: una misma conexión no puede mandar más de 30 preinscripciones por hora.
  -- (Se guarda una huella irreversible de la IP, nunca la IP.) La oficina del CFP, que carga varias seguidas, entra holgada.
  begin
    v_ip := trim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
                                      nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1));
  exception when others then v_ip := '';
  end;
  if coalesce(v_ip, '') <> '' then
    v_hash := md5(v_ip || coalesce((select valor from public.secretos_internos where nombre = 'interno'), ''));
    if (select count(*) from public.preinscripciones where ip_hash = v_hash and created_at > now() - interval '1 hour') >= 30 then
      raise exception 'Se enviaron demasiadas solicitudes desde esta conexión. Probá de nuevo más tarde o consultá en el CFP';
    end if;
  end if;

  select * into cfg from public.inscripcion_config where id = 1;
  if not found or not cfg.abierta then raise exception 'La inscripción está cerrada por el momento'; end if;

  if not exists (select 1 from public.trayectos t
                  where t.id = p_trayecto and nullif(to_jsonb(t)->>'ciclo_lectivo', '')::integer = cfg.ciclo) then
    raise exception 'El trayecto elegido no está disponible para este ciclo';
  end if;

  if p_datos is null or jsonb_typeof(p_datos) <> 'object' or length(p_datos::text) > 40000 then
    raise exception 'Datos inválidos';
  end if;

  dni_ := regexp_replace(coalesce(p_datos->>'dni', ''), '\D', '', 'g');
  ape  := upper(trim(coalesce(p_datos->>'apellido', '')));
  nom  := trim(coalesce(p_datos->>'nombre', ''));
  mail := nullif(lower(trim(coalesce(p_datos->>'email', ''))), '');
  if dni_ !~ '^[0-9]{6,9}$' then raise exception 'El DNI debe tener entre 6 y 9 números, sin puntos'; end if;
  if ape = '' or nom = '' then raise exception 'Completá apellido y nombre'; end if;
  if mail is not null and mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'El correo electrónico no es válido'; end if;

  if (select count(*) from public.preinscripciones where created_at > now() - interval '10 minutes') > 150 then
    raise exception 'Hay demasiadas solicitudes en este momento. Probá de nuevo en unos minutos';
  end if;

  if exists (select 1 from public.preinscripciones
              where trayecto_id = p_trayecto and dni = dni_ and estado <> 'rechazada') then
    raise exception 'Ya existe una preinscripción con ese DNI para este trayecto';
  end if;

  if (select count(*) from public.preinscripciones
       where ciclo = cfg.ciclo and dni = dni_ and estado <> 'rechazada') >= 5 then
    raise exception 'Este DNI ya tiene 5 preinscripciones en este ciclo. Consultá en el CFP si necesitás cambiar alguna';
  end if;

  insert into public.preinscripciones (ciclo, trayecto_id, dni, apellido, nombre, email, datos, ip_hash)
  values (cfg.ciclo, p_trayecto, dni_, left(ape, 80), left(nom, 80), mail, p_datos, nullif(v_hash, ''))
  returning id into nuevo;

  num := 'P' || cfg.ciclo || '-' || lpad(nuevo::text, 4, '0');
  update public.preinscripciones set numero = num where id = nuevo;
  return jsonb_build_object('numero', num);
end $$;
revoke all on function public.preinscribir(bigint, jsonb, text) from public;
grant execute on function public.preinscribir(bigint, jsonb, text) to anon, authenticated;

-- Verificación: tiene que aparecer 1 fila con el secreto cargado (no se muestra), el cron y la columna
select 'secreto' as tipo, (length(valor) = 48)::text as estado from public.secretos_internos where nombre = 'interno'
union all select 'cron', jobname from cron.job where jobname = 'resguardo-auditoria'
union all select 'columna', column_name::text from information_schema.columns where table_name = 'preinscripciones' and column_name = 'ip_hash';
