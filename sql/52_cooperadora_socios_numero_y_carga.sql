-- =====================================================================================
-- PASO 52 — Cooperadora: N.º de socio y domicilio + carga del padrón 2026-2027
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin duplicar: si el DNI ya
-- existe, solo completa el N.º y el domicilio y no toca el resto de sus datos).
--
-- 1) Agrega a cooperadora_socios las columnas «numero» (N.º de socio) y «domicilio».
-- 2) Carga los 104 socios de la planilla «Planilla Cooperadora 2026-2027».
--
-- NO se cargaron dos filas de la planilla, que hay que resolver a mano:
--   · N.º 76 (VIGIL AMULET IGNACIO): tiene el mismo DNI (40804376) que el N.º 57 (ECHEVERRIA TOMAS).
--   · N.º 82 (HEBER ADRIAN): mismo DNI (23045708) que el N.º 54 (SIBILIA HEBER ADRIAN).
-- Donde la planilla decía «NO ENCONTRADO CARGAR EN BASE ADMIN», el domicilio queda vacío.
-- El apellido y el nombre se separaron automáticamente: revisá los que figuren raros con ✏️.
-- =====================================================================================

alter table public.cooperadora_socios add column if not exists numero integer;
alter table public.cooperadora_socios add column if not exists domicilio text;
create unique index if not exists cooperadora_socios_numero_uk on public.cooperadora_socios (numero) where numero is not null;

insert into public.cooperadora_socios (numero, dni, apellido, nombre, domicilio)
values
  (1, '44929863', 'CUEVAS', 'Joaquin Facundo', 'Urquiza N°2177'),
  (2, '37366792', 'GUAGLIARDI', 'Oscar', 'Mendez N°2535'),
  (3, '45201175', 'BALDERRAMA', 'Jose Ariel', '9 de Julio y Moreno'),
  (4, '20597383', 'VEGA', 'Claudia Marcela', '507 N° 1426'),
  (5, '38859745', 'MANILDO', 'Matias Nicolas', 'Acc 9 de Julio'),
  (6, '11421436', 'ESTUDIES', 'Ruben', 'Maipú N° 1144'),
  (7, '35654895', 'LUCENA', 'Leonardo Ariel', 'Guevara N° 921'),
  (8, '21016323', 'DIAZ', 'Alicia', 'Manchi N° 2530'),
  (9, '38932527', 'MEDA', 'Matias', '511 N° 446'),
  (10, '94293228', 'CESPEDES SULCA', 'Angela Elvira Lourdes', 'Psj Puerto Argentino'),
  (11, '48363703', 'PONCHIONE', 'Melina', 'Malvinas Argentinas N°121'),
  (12, '22894240', 'GOMEZ DOVA', 'Sandra Karina', 'Manchi N°1060'),
  (13, '39985157', 'OBERTI GENTILE', 'Micaela Soledad', 'Lavalle N°975'),
  (14, '39293109', 'LLADO VIDAL', 'Luana Belen', 'San Lorenzo N°942'),
  (15, '36798505', 'GOMEZ', 'Rocio Macarena', '41 N° 1250'),
  (16, '13705019', 'MULLVIHILL', 'Raul Horacio', 'Quintana N° 778'),
  (17, '36165076', 'PERTOSSI', 'Renata Micaela', null),
  (18, '36023423', 'MINO', 'Nicolas', null),
  (19, '16527461', 'LESPADE', 'Maria Cecilia', null),
  (20, '35654889', 'SABIÑO ROSSI', 'Marianela', null),
  (21, '30272472', 'MILLA', 'Fernando', null),
  (22, '31168858', 'BREST', 'Patricia Noemi', null),
  (23, '36798639', 'ARZANI DIXON', 'Ann Marie', null),
  (24, '25525049', 'CARNEVALE', 'Gerardo', null),
  (25, '32449352', 'EVARISTO', 'Emmanuel', null),
  (26, '26419611', 'MASSA', 'Melisa Marta', null),
  (27, '43260502', 'RIOS ROCA', 'Mirko Nahuel', null),
  (28, '23273219', 'NIVEIRO', 'Cinthia Andrea', null),
  (29, '22823287', 'LOIACONO', 'Santiago Javier', null),
  (30, '39985117', 'PRIETO', 'Paola Elizabeth', null),
  (31, '17489416', 'VENERONI', 'Oscar', null),
  (32, '26059108', 'BARTOLO', 'Laura Evangelina', null),
  (33, '13705172', 'CERIANI', 'Margarita Fatima', null),
  (34, '36640983', 'BUSTAMANTE', 'Gabriel Alejandro', null),
  (35, '36117366', 'ARANDA', 'Diego Rolando', null),
  (36, '34412316', 'DIAZ', 'Pamela', null),
  (37, '29178199', 'LEZCANO', 'Ramon Antonio', null),
  (38, '42841931', 'LOPEZ', 'Ramiro Bruno', null),
  (39, '25043814', 'GALLO', 'Martin', null),
  (40, '29725137', 'RODRIGUEZ', 'Estela Noemi', null),
  (41, '33331730', 'ALBORNOZ', 'Maria Laura', null),
  (42, '40377309', 'MANION', 'Tomás', null),
  (43, '33640277', 'AQUINO DIAZ', 'Mariela Yesica', null),
  (44, '40454977', 'AQUINO', 'Rocio Belen', null),
  (45, '14658870', 'CACERES', 'Elba Cristina', null),
  (46, '33640324', 'MIGHETTO', 'Angel Manuel', null),
  (47, '40343598', 'GARCIA', 'Viviana Griselda', null),
  (48, '32449336', 'RIOS', 'Ximena', null),
  (49, '18795592', 'DE LA ROSA AYALA', 'Jose Jacinto', null),
  (50, '13443256', 'MONZON', 'Amado', null),
  (51, '23725824', 'MAYDU', 'Gladys Noemi', null),
  (52, '41074568', 'MENDEZ', 'Elias Mauricio', null),
  (53, '32223053', 'DE LA ROSA DIAZ', 'Virna Maria', null),
  (54, '23045708', 'SIBILIA', 'Heber Adrian', null),
  (55, '42630822', 'MONSALVO', 'Hilda', null),
  (56, '32449264', 'ROGOUSKI', '', null),
  (57, '40804376', 'ECHEVERRIA', 'Tomas', null),
  (58, '40336471', 'MICA', 'Daiana', null),
  (59, '35330482', 'ISBER', 'Lucas', null),
  (60, '40540950', 'ROJAS', 'Gustavo', null),
  (61, '39963399', 'GOMEZ', 'Mauro Ezequiel', null),
  (62, '33208838', 'FELIX', 'Emmanuel', null),
  (63, '25043742', 'JUAN', 'Manuel', null),
  (64, '34832398', 'ORTIZ', 'Romina', null),
  (65, '46101819', 'RAMOS', 'Javier', null),
  (66, '35225264', 'GONZALEZ', 'Maria Laura', null),
  (67, '45806435', 'MIRKO', '', null),
  (68, '29407319', 'IRASTORZA', 'Alejandra', null),
  (69, '40455882', 'CABRAL', 'Jorge', null),
  (70, '27050198', 'CUCCI', 'Mauricio', null),
  (71, '27224004', 'RIENZI', '', null),
  (72, '14107360', 'SARLENGO', 'Hugo', null),
  (73, '25094712', 'CARBON', 'Pablo', null),
  (74, '45293978', 'LACANETTE', 'Jeremias', null),
  (75, '43733064', 'VIGIL AMULET', 'Augusto', null),
  (77, '36045746', 'HERRERA', 'Marcelo Alejandro', null),
  (78, '45806416', 'DENISE', 'Itati', null),
  (79, '33640292', 'PARADIS', 'Leila', null),
  (80, '30206235', 'SOTO', 'Noelia Mariela', null),
  (81, '35329034', 'ALEXANDRO', 'Joaquin', null),
  (83, '28171630', 'GOMEZ', 'Juan Carlos', null),
  (84, '18183973', 'ROSANA', 'Irene', null),
  (85, '33397371', 'MIRALLES', 'Marina', null),
  (86, '17230280', 'AMULET', 'Ivana', null),
  (87, '20967536', 'PEREZ', 'Marcela', null),
  (88, '38932554', 'FIGUEROA', 'Karen', null),
  (89, '16825693', 'SILLITTI', 'Nora', null),
  (90, '28171642', 'RAMIREZ', 'Jose', null),
  (91, '23725504', 'OJEDA', 'German Andres', null),
  (92, '21363295', 'AVANCINI', 'Leticia', null),
  (93, '25525090', 'COSTURI', 'Camila', null),
  (94, '16527468', 'DOMENICCI', 'Marta Yolanda', null),
  (95, '49164950', 'ZAPATA RIPA', 'Santiago Lucas', null),
  (96, '21016211', 'ANTONIASSI', 'Nancy', null),
  (97, '21483303', 'GORMAN', 'Viviana', null),
  (98, '22257657', 'ROLDAN', 'Leticia', null),
  (99, '11230491', 'ALVAREZ', 'Maria', null),
  (100, '5603701', 'ROSSI', 'Griselda', null),
  (101, '38820202', 'CORIA', 'Javier Anibal', null),
  (102, '23725675', 'ROSELLO', 'Karina Mabel', null),
  (103, '43733034', 'SALTEÑO', 'Leandro Agustin', null),
  (104, '25348287', 'CASCO', 'Monica Fabiana', null),
  (105, '31168898', 'GUILLET RIOS', 'Walter Ezequiel', null),
  (106, '94567333', 'VERA', 'Iris Maribel', null)
on conflict (dni) do update
   set numero    = coalesce(public.cooperadora_socios.numero, excluded.numero),
       domicilio = coalesce(nullif(public.cooperadora_socios.domicilio, ''), excluded.domicilio);

-- Verificación: tiene que decir 104 (más los socios que ya hubiera)
select count(*) as socios_con_numero from public.cooperadora_socios where numero is not null;
