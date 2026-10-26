-- 25. clases.contenido debe ser jsonb (en producción estaba como text y la plataforma
--     no leía los criterios de la lista de cotejo, las preguntas, etc. al reabrir una actividad).
-- Ya aplicado en producción; este archivo es el registro. Se protege el cambio de tipo
-- por si la columna ya se creó directamente como jsonb (instalación nueva).
do $$ begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'clases' and column_name = 'contenido') = 'text' then
    alter table public.clases alter column contenido type jsonb using nullif(btrim(contenido), '')::jsonb;
  end if;
end $$;
alter table public.clases drop constraint if exists clases_contenido_tamano;
alter table public.clases add constraint clases_contenido_tamano check (contenido is null or octet_length(contenido::text) <= 200000);
