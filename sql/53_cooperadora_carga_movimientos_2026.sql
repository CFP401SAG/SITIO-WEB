-- =====================================================================================
-- PASO 53 — Cooperadora: carga de ingresos y egresos del ejercicio 2026/2027
-- Fuente: planilla «CUOTAS, INGRESOS Y EGRESOS» (mayo a septiembre de 2026).
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede repetir: si ya hay movimientos con
-- N.º de comprobante «PLN26-…», no vuelve a cargarlos.
--
-- · Crea (o completa) el ejercicio 2026/2027 con el saldo del ejercicio anterior
--   ($926.483,29 al 01/05/2026) en Banco cuenta corriente.
-- · Carga 81 movimientos: ingresos $578,000.00 y egresos $759,037.05 (todos como Banco cuenta corriente).
-- · Agrega a VIGIL AMULET, Ignacio (DNI 41953723) como socio N.º 76, que figuraba en la
--   planilla de socios con un DNI repetido y paga cuota en esta planilla.
-- · No se carga la fila «SALDO ULTIMO DIA AGOSTO $987.748,92»: es un control, no un movimiento.
-- =====================================================================================

insert into public.cooperadora_ejercicios (ciclo_desde, ciclo_hasta, distrito, escuela_nro, localidad, saldo_inicial_banco_cc)
values (2026, 2027, 'San Andrés de Giles', '401', 'San Andrés de Giles', 926483.29)
on conflict (ciclo_desde, ciclo_hasta) do update set saldo_inicial_banco_cc = 926483.29;

insert into public.cooperadora_socios (numero, dni, apellido, nombre)
values (76, '41953723', 'VIGIL AMULET', 'Ignacio')
on conflict (dni) do nothing;

insert into public.cooperadora_movimientos
  (fecha, tipo, seccion, rubro_codigo, rubro_nombre, descripcion, monto, medio, socio_id, periodo, nro_comprobante)
select v.fecha::date, v.tipo, v.seccion::smallint, v.rubro_codigo, v.rubro_nombre, v.descripcion, v.monto::numeric, v.medio, v.socio_id::bigint, v.periodo, v.nro_comprobante from (values
  ('2026-09-24','entrada',1,'a','Cuota Social','SEPTIEMBRE AUX SANITARIAS Y DE GAS · VERA IRIS MARIBEL',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='94567333'),'2026-09','PLN26-001'),
  ('2026-09-24','entrada',1,'a','Cuota Social','SEPTIEMBRE AUX SANITARIAS Y DE GAS · GUILLET RIOS WALTER EZEQUIEL',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='31168898'),'2026-09','PLN26-002'),
  ('2026-09-22','entrada',1,'a','Cuota Social','SEPTIEMBRE ORG DE EVENTOS · CASCO MONICA FABIANA',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='25348287'),'2026-09','PLN26-003'),
  ('2026-09-21','entrada',1,'a','Cuota Social','EPTIEMBRE AUX. SANITARIAS Y DE GA · SALTEÑO LEANDRO AGUSTIN',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='43733034'),'2026-09','PLN26-004'),
  ('2026-09-22','salida',4,'1','Servicio de internet','INTERNET AGOSTO',65000.00,'banco_cc',null,null,'PLN26-005'),
  ('2026-08-31','salida',4,'1','Servicio de internet','INTERNET JULIO',65000.00,'banco_cc',null,null,'PLN26-006'),
  ('2026-09-09','entrada',1,'a','Cuota Social','ROSELLO KARINA MABEL',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='23725675'),null,'PLN26-007'),
  ('2026-09-09','entrada',1,'a','Cuota Social','CORIA JAVIER ANIBAL',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='38820202'),null,'PLN26-008'),
  ('2026-08-31','entrada',1,'a','Cuota Social','ECHEVERRIA TOMAS',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='40804376'),null,'PLN26-009'),
  ('2026-08-31','entrada',1,'a','Cuota Social','VIGIL AMULET IGNACIO',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='41953723'),null,'PLN26-010'),
  ('2026-08-31','entrada',1,'a','Cuota Social','FIGUEROA KAREN',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='38932554'),null,'PLN26-011'),
  ('2026-08-31','entrada',1,'a','Cuota Social','ROSSI GRISELDA',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='5603701'),null,'PLN26-012'),
  ('2026-08-31','entrada',1,'a','Cuota Social','ALVAREZ MARIA',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='11230491'),null,'PLN26-013'),
  ('2026-08-31','entrada',1,'a','Cuota Social','ROLDAN LETICIA',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='22257657'),null,'PLN26-014'),
  ('2026-08-14','entrada',1,'a','Cuota Social','CUOTA ALFAJORES · GORMAN VIVIANA',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='21483303'),null,'PLN26-015'),
  ('2026-08-13','entrada',1,'a','Cuota Social','CUOTA ALFAJORES · ANTONIASSI NANCY',48000.00,'banco_cc',(select id from public.cooperadora_socios where dni='21016211'),null,'PLN26-016'),
  ('2026-08-06','entrada',1,'a','Cuota Social','CACERES ELBA · CACERES, ELBA CRISTINA',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='14658870'),null,'PLN26-017'),
  ('2026-08-31','salida',3,'d','Débitos bancarios',null,8537.08,'banco_cc',null,null,'PLN26-018'),
  ('2026-09-07','salida',4,'2','Otros gastos (pilas y resma de oficina)','PILA 2032 Y RESMA OFICIO',12000.00,'banco_cc',null,null,'PLN26-019'),
  ('2026-09-02','salida',2,'a','Material didáctico','discos de corte x 50 unidades',45000.00,'banco_cc',null,null,'PLN26-020'),
  ('2026-08-20','salida',2,'c','Mant. y mejoras con fondos propios','Disco solido y mem ram para notebook',123000.00,'banco_cc',null,null,'PLN26-021'),
  ('2026-08-14','salida',2,'f','Librería','Libro de Firmas del Personal',14300.00,'banco_cc',null,null,'PLN26-022'),
  ('2026-08-04','entrada',1,'a','Cuota Social','CUOTA SOCIAL ROBOTICA · ZAPATA RIPA SANTIAGO LUCAS',40000.00,'banco_cc',(select id from public.cooperadora_socios where dni='49164950'),null,'PLN26-023'),
  ('2026-08-04','entrada',1,'a','Cuota Social','CUOTA SOCIAL ALFAJORES · DOMENICCI MARTA YOLANDA',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='16527468'),null,'PLN26-024'),
  ('2026-05-22','entrada',1,'c','Rifas','RIFA · RIENZI · DNI 27224004',35000.00,'banco_cc',null,null,'PLN26-025'),
  ('2026-05-30','entrada',1,'a','Cuota Social','CUOTA SOCIAL SOLDADURA · RIENZI',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='27224004'),null,'PLN26-026'),
  ('2026-08-10','entrada',1,'a','Cuota Social','CUOTA SOCIAL INDUSTRIAL · MONSALVO HILDA',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='42630822'),null,'PLN26-027'),
  ('2026-08-10','entrada',1,'a','Cuota Social','CUOTA SOCIAL HERRERO · SIBILIA HEBER ADRIAN',10000.00,'banco_cc',(select id from public.cooperadora_socios where dni='23045708'),null,'PLN26-028'),
  ('2026-08-12','salida',4,'1','Servicio de internet','INTERNET JUNIO',65000.00,'banco_cc',null,null,'PLN26-029'),
  ('2026-08-12','salida',4,'1','Servicio de internet','INTERNET MAYO',57000.00,'banco_cc',null,null,'PLN26-030'),
  ('2026-08-12','salida',2,'a','Material didáctico','ELECTRODOS 4KG',51546.24,'banco_cc',null,null,'PLN26-031'),
  ('2026-08-03','salida',2,'a','Material didáctico','DISCO DE CORTE, FLAPP, CEPILLO ACER',69500.00,'banco_cc',null,null,'PLN26-032'),
  ('2026-08-03','salida',2,'a','Material didáctico','OXIGENO INDUSTRIAL GASEOSO',17947.03,'banco_cc',null,null,'PLN26-033'),
  ('2026-07-01','salida',2,'f','Librería','Toner alternativo HP',10000.00,'banco_cc',null,null,'PLN26-034'),
  ('2026-06-29','salida',2,'f','Librería','Libro de Acta',7400.00,'banco_cc',null,null,'PLN26-035'),
  ('2026-06-30','salida',2,'f','Librería','Resma A4',6500.00,'banco_cc',null,null,'PLN26-036'),
  ('2026-05-28','entrada',1,'c','Rifas','LETICIA ITATI AVANC',5000.00,'banco_cc',null,null,'PLN26-037'),
  ('2026-05-28','entrada',1,'c','Rifas','O DEBIN CR.DEBIN 27/05-S.269886 C:2720',3000.00,'banco_cc',null,null,'PLN26-038'),
  ('2026-05-28','entrada',1,'c','Rifas','MARENGO, ANA',5000.00,'banco_cc',null,null,'PLN26-039'),
  ('2026-05-28','entrada',1,'c','Rifas','HUGO WALTER SARLENG',5000.00,'banco_cc',null,null,'PLN26-040'),
  ('2026-05-28','entrada',1,'c','Rifas','HUGO WALTER SARLENG',5000.00,'banco_cc',null,null,'PLN26-041'),
  ('2026-05-28','entrada',1,'c','Rifas','RICARDO MARCELO PASC',5000.00,'banco_cc',null,null,'PLN26-042'),
  ('2026-05-28','entrada',1,'c','Rifas','MULVIHILL, JUAN',5000.00,'banco_cc',null,null,'PLN26-043'),
  ('2026-05-28','entrada',1,'c','Rifas','JUAN MANUEL CORDOBA',5000.00,'banco_cc',null,null,'PLN26-044'),
  ('2026-05-28','entrada',1,'c','Rifas','ALEJANDRA RAQUEL IRA',13000.00,'banco_cc',null,null,'PLN26-045'),
  ('2026-05-28','entrada',1,'c','Rifas','OJEDA, RENSO EMMANUE',10000.00,'banco_cc',null,null,'PLN26-046'),
  ('2026-05-28','entrada',1,'c','Rifas','CAMILA PAOLA COSTURI',5000.00,'banco_cc',null,null,'PLN26-047'),
  ('2026-05-28','entrada',1,'c','Rifas','SERGIO WALTER VANIN',5000.00,'banco_cc',null,null,'PLN26-048'),
  ('2026-05-28','entrada',1,'c','Rifas','GUILLET,MARIA CECIL',5000.00,'banco_cc',null,null,'PLN26-049'),
  ('2026-05-28','entrada',1,'c','Rifas','ALEXANDRO JOAQUIN',3000.00,'banco_cc',null,null,'PLN26-050'),
  ('2026-05-28','entrada',1,'c','Rifas','ALFREDO JAVIER LA RE',5000.00,'banco_cc',null,null,'PLN26-051'),
  ('2026-05-28','entrada',1,'c','Rifas','VELAZQUEZ, MARTINIAN',5000.00,'banco_cc',null,null,'PLN26-052'),
  ('2026-05-28','entrada',1,'c','Rifas','ELSO, ERICA MARIA',5000.00,'banco_cc',null,null,'PLN26-053'),
  ('2026-05-28','entrada',1,'c','Rifas','RIENZI, MONICA BEATR',5000.00,'banco_cc',null,null,'PLN26-054'),
  ('2026-05-21','entrada',1,'c','Rifas','GOMEZ MONZON, MARIA',5000.00,'banco_cc',null,null,'PLN26-055'),
  ('2026-05-21','entrada',1,'c','Rifas','GALESIO, MARIA EUGEN',5000.00,'banco_cc',null,null,'PLN26-056'),
  ('2026-05-21','entrada',1,'c','Rifas','LENNARD/FRANCISCO',10000.00,'banco_cc',null,null,'PLN26-057'),
  ('2026-05-21','entrada',1,'c','Rifas','RIENZI, MONICA BEATR',5000.00,'banco_cc',null,null,'PLN26-058'),
  ('2026-05-21','entrada',1,'c','Rifas','DINOVA NICOLAS',10000.00,'banco_cc',null,null,'PLN26-059'),
  ('2026-05-21','entrada',1,'c','Rifas','MARIA CRISTINA VIDEL',5000.00,'banco_cc',null,null,'PLN26-060'),
  ('2026-05-21','entrada',1,'c','Rifas','ALEJANDRA RAQUEL IRA',5000.00,'banco_cc',null,null,'PLN26-061'),
  ('2026-05-21','entrada',1,'c','Rifas','MUNCHARAZ, MARIA EUG',5000.00,'banco_cc',null,null,'PLN26-062'),
  ('2026-05-21','entrada',1,'c','Rifas','GALESIO, MARIANGELES',5000.00,'banco_cc',null,null,'PLN26-063'),
  ('2026-05-21','entrada',1,'c','Rifas','MARIA LAURA ALBORNOZ',10000.00,'banco_cc',null,null,'PLN26-064'),
  ('2026-05-21','entrada',1,'c','Rifas','CABELLO,MARIA ELENA',5000.00,'banco_cc',null,null,'PLN26-065'),
  ('2026-05-21','entrada',1,'c','Rifas','ANDREA GISELA MALDON',5000.00,'banco_cc',null,null,'PLN26-066'),
  ('2026-05-21','entrada',1,'c','Rifas','JOSE ANTONIO ARAMEND',10000.00,'banco_cc',null,null,'PLN26-067'),
  ('2026-05-21','entrada',1,'c','Rifas','FLORENCIA ANAHI ZANA',3000.00,'banco_cc',null,null,'PLN26-068'),
  ('2026-05-21','entrada',1,'c','Rifas','FAIAD, JULIETA',5000.00,'banco_cc',null,null,'PLN26-069'),
  ('2026-05-21','entrada',1,'c','Rifas','OJEDA, CLAUDIA',10000.00,'banco_cc',null,null,'PLN26-070'),
  ('2026-05-21','entrada',1,'c','Rifas','MAXIMILIANO ALFREDO',15000.00,'banco_cc',null,null,'PLN26-071'),
  ('2026-05-21','entrada',1,'c','Rifas','CLAUDIA MONSA',5000.00,'banco_cc',null,null,'PLN26-072'),
  ('2026-05-21','entrada',1,'c','Rifas','BATTI',3000.00,'banco_cc',null,null,'PLN26-073'),
  ('2026-05-21','entrada',1,'a','Cuota Social','CUOTA MAYO · COSTURI CAMILA',8000.00,'banco_cc',(select id from public.cooperadora_socios where dni='25525090'),'2026-05','PLN26-074'),
  ('2026-05-04','entrada',1,'a','Cuota Social','CUOTA MAYO · SIBILIA HEBER ADRIAN',8000.00,'banco_cc',(select id from public.cooperadora_socios where dni='23045708'),'2026-05','PLN26-075'),
  ('2026-05-04','entrada',1,'c','Rifas','ELBA CACERES',10000.00,'banco_cc',null,null,'PLN26-076'),
  ('2026-05-04','salida',4,'1','Servicio de internet','SERVICIO INTERNET ABRIL',57000.00,'banco_cc',null,null,'PLN26-077'),
  ('2026-05-04','entrada',1,'a','Cuota Social','AVANCINI LETICIA',24000.00,'banco_cc',(select id from public.cooperadora_socios where dni='21363295'),null,'PLN26-078'),
  ('2026-05-31','salida',3,'d','Débitos bancarios',null,5500.00,'banco_cc',null,null,'PLN26-079'),
  ('2026-05-31','salida',3,'d','Débitos bancarios',null,2781.00,'banco_cc',null,null,'PLN26-080'),
  ('2026-05-20','salida',2,'a','Material didáctico','ELECTRODOS CONARCO 2,5MM',76025.70,'banco_cc',null,null,'PLN26-081')
) as v(fecha, tipo, seccion, rubro_codigo, rubro_nombre, descripcion, monto, medio, socio_id, periodo, nro_comprobante)
where not exists (select 1 from public.cooperadora_movimientos where nro_comprobante like 'PLN26-%');
