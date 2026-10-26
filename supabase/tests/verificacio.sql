-- Verificació de permisos (CLAUDE.md §5). S'executa sobre una base de dades
-- local amb totes les migracions aplicades (scripts/prova-sql.sh).
-- Cada bloc falla amb una excepció si el comportament no és l'esperat.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Persones: la primera que es registra és la propietària.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'propietaria@example.org');
-- Invitacions fetes "a mà" per poder registrar la resta.
create temp table ids (nom text primary key, id uuid);
insert into ids values
  ('prop', '00000000-0000-0000-0000-00000000000a'),
  ('super', '00000000-0000-0000-0000-00000000000b'),
  ('vol',   '00000000-0000-0000-0000-00000000000c'),
  ('aliena','00000000-0000-0000-0000-00000000000d');
grant select on ids to authenticated;

create or replace function pg_temp.com(p text) returns void language plpgsql as $$
begin
  if p is null then
    perform set_config('request.jwt.claims', '', false);
    execute 'reset role';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', (select id from ids where nom = p))::text, false);
    execute 'set role authenticated';
  end if;
end $$;

do $$ begin
  assert (select propietari from perfils where email = 'propietaria@example.org'),
    'El primer usuari ha de ser propietari';
end $$;

-- El hook rebutja correus sense invitació.
do $$ begin
  assert hook_abans_crear_usuari('{"user":{"email":"desconegut@example.org"}}') ? 'error',
    'El hook ha de rebutjar correus sense invitació';
end $$;

-- La propietària crea un esdeveniment i en queda superusuària.
\o /dev/null
select pg_temp.com('prop');
\o
insert into esdeveniments (id, nom) values ('10000000-0000-0000-0000-000000000001', 'CMUDE Barcelona');
insert into esdeveniments (id, nom) values ('10000000-0000-0000-0000-000000000002', 'Un altre acte');
do $$ begin
  assert es_super('10000000-0000-0000-0000-000000000001'), 'Creadora ha de ser superusuària';
  assert convida_membre('10000000-0000-0000-0000-000000000001', 'Super@Example.org', 'superusuari') = 'convidat';
  assert convida_membre('10000000-0000-0000-0000-000000000001', 'vol@example.org', 'usuari') = 'convidat';
  -- La mateixa invitació dues vegades no en crea dues.
  assert convida_membre('10000000-0000-0000-0000-000000000001', 'vol@example.org', 'usuari') = 'convidat';
  assert (select count(*) from invitacions where email = 'vol@example.org') = 1;
end $$;
\o /dev/null
select pg_temp.com(null);
\o

do $$ begin
  assert not (hook_abans_crear_usuari('{"user":{"email":"vol@example.org"}}') ? 'error'),
    'El hook ha d''acceptar correus convidats';
end $$;

-- Es registren: la invitació es converteix en membre.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000b', 'super@example.org'),
  ('00000000-0000-0000-0000-00000000000c', 'vol@example.org'),
  ('00000000-0000-0000-0000-00000000000d', 'aliena@example.org');
do $$ begin
  assert (select rol from membres where perfil_id = '00000000-0000-0000-0000-00000000000b') = 'superusuari';
  assert (select rol from membres where perfil_id = '00000000-0000-0000-0000-00000000000c') = 'usuari';
  assert not exists (select 1 from membres where perfil_id = '00000000-0000-0000-0000-00000000000d');
  assert (select count(*) from invitacions where acceptada_el is null) = 0;
  assert not (select propietari from perfils where id = '00000000-0000-0000-0000-00000000000b');
end $$;

-- Algú sense cap esdeveniment no veu res.
\o /dev/null
select pg_temp.com('aliena');
\o
do $$ begin
  assert (select count(*) from esdeveniments) = 0, 'aliena no ha de veure esdeveniments';
  assert (select count(*) from membres) = 0;
  assert (select count(*) from perfils) = 1, 'aliena només veu el seu perfil';
  begin
    insert into esdeveniments (nom) values ('Pirata');
    raise exception 'aliena no hauria de poder crear esdeveniments';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Superusuària: crea àrea i tasques, assigna a la voluntària.
\o /dev/null
select pg_temp.com('super');
\o
insert into arees (id, esdeveniment_id, nom)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Acreditació');
insert into tasques (id, esdeveniment_id, area_id, titol, assignada_a, creada_per, data_limit)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001', 'Imprimir acreditacions',
        '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b', current_date + 3);
do $$ begin
  assert (select count(*) from esdeveniments) = 1, 'super només veu el seu esdeveniment';
  -- No pot assignar a qui no és de l'acte.
  begin
    insert into tasques (esdeveniment_id, titol, assignada_a, creada_per)
    values ('10000000-0000-0000-0000-000000000001', 'x',
            '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b');
    raise exception 'no s''hauria de poder assignar a una persona aliena';
  exception when raise_exception then
    if sqlerrm not like 'Només es pot assignar%' then raise; end if;
  end;
  -- No pot fer res a l'esdeveniment que no és seu.
  begin
    perform convida_membre('10000000-0000-0000-0000-000000000002', 'x@example.org', 'usuari');
    raise exception 'no hauria de poder convidar a un acte aliè';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Voluntària: veu la tasca, la pot marcar feta, però no editar-la ni crear-ne.
\o /dev/null
select pg_temp.com('vol');
\o
do $$
declare n int;
begin
  assert (select count(*) from tasques) = 1;
  update tasques set estat = 'feta', feta_el = now() where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'la persona assignada ha de poder marcar-la feta';
  begin
    update tasques set titol = 'canviat' where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'un usuari no hauria de poder editar el títol';
  exception when raise_exception then
    if sqlerrm not like 'Només un superusuari%' then raise; end if;
  end;
  begin
    insert into tasques (esdeveniment_id, titol, creada_per)
    values ('10000000-0000-0000-0000-000000000001', 'meva', '00000000-0000-0000-0000-00000000000c');
    raise exception 'un usuari no hauria de poder crear tasques';
  exception when insufficient_privilege then null;
  end;
  begin
    update membres set rol = 'superusuari' where perfil_id = '00000000-0000-0000-0000-00000000000c';
    get diagnostics n = row_count;
    assert n = 0, 'un usuari no s''hauria de poder fer superusuari';
  end;
  -- Marcar feta sense data no es pot.
  begin
    update tasques set estat = 'feta', feta_el = null where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'feta sense data no hauria de passar';
  exception when check_violation then null;
  end;
  insert into comentaris (tasca_id, text) values ('30000000-0000-0000-0000-000000000001', 'Fet, a recepció');
  assert (select count(*) from perfils) = 3, 'veu els perfils de qui comparteix acte';
end $$;

-- Ningú no esborra res.
do $$ begin
  begin
    delete from tasques;
    raise exception 'delete hauria de fallar';
  exception when insufficient_privilege then null;
  end;
end $$;

-- L'esdeveniment no es pot quedar sense superusuari.
\o /dev/null
select pg_temp.com('prop');
\o
update membres set actiu = false
  where perfil_id = '00000000-0000-0000-0000-00000000000a' and esdeveniment_id = '10000000-0000-0000-0000-000000000001';
\o /dev/null
select pg_temp.com('super');
\o
do $$ begin
  begin
    update membres set rol = 'usuari'
      where perfil_id = '00000000-0000-0000-0000-00000000000b' and esdeveniment_id = '10000000-0000-0000-0000-000000000001';
    raise exception 'no s''hauria de poder treure l''últim superusuari';
  exception when raise_exception then
    if sqlerrm not like 'L''esdeveniment ha de tenir%' then raise; end if;
  end;
end $$;

-- ============================================================
-- SEATING (migració 0002)
-- ============================================================
\o /dev/null
select pg_temp.com('super');
\o
insert into planols (id, esdeveniment_id, nom, dades, creat_per)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        'Cerimònia inaugural', '{"v":1,"els":[],"people":[]}', '00000000-0000-0000-0000-00000000000b');
do $$
declare v int;
begin
  -- Desar amb la versió correcta en dona una de nova i deixa còpia a l'historial.
  v := desa_planol('40000000-0000-0000-0000-000000000001', '{"v":1,"els":[1],"people":[]}', 1);
  assert v = 2, 'la versió ha de pujar a 2';
  assert (select count(*) from planols_historial) = 1, 'ha de quedar una còpia';
  -- Dins dels 15 minuts, no se''n fa cap més.
  v := desa_planol('40000000-0000-0000-0000-000000000001', '{"v":1,"els":[1,2],"people":[]}', 2);
  assert v = 3;
  assert (select count(*) from planols_historial) = 1, 'com a molt una còpia cada 15 minuts';
  -- Amb una versió antiga, conflicte.
  begin
    perform desa_planol('40000000-0000-0000-0000-000000000001', '{"v":1}', 1);
    raise exception 'hauria de donar conflicte';
  exception when raise_exception then
    if sqlerrm not like 'Algú altre ha desat%' then raise; end if;
  end;
  -- Canviar el nom no és un canvi de contingut.
  update planols set nom = 'Inauguració' where id = '40000000-0000-0000-0000-000000000001';
  assert (select versio from planols where id = '40000000-0000-0000-0000-000000000001') = 3;
  -- Les dades han de ser un objecte.
  begin
    perform desa_planol('40000000-0000-0000-0000-000000000001', '[1,2]', 3);
    raise exception 'un array no hauria de passar';
  exception when check_violation then null;
  end;
end $$;

-- La voluntària veu el plànol, no el pot modificar, però marca arribades.
\o /dev/null
select pg_temp.com('vol');
\o
do $$
declare n int;
begin
  assert (select count(*) from planols) = 1, 'la voluntària ha de veure el plànol';
  assert (select count(*) from planols_historial) = 0, 'l''historial és només per a superusuaris';
  begin
    perform desa_planol('40000000-0000-0000-0000-000000000001', '{"v":1}', 3);
    raise exception 'una usuària no hauria de poder desar el plànol';
  exception when insufficient_privilege then null;
  end;
  update planols set nom = 'x' where id = '40000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'una usuària no hauria de poder reanomenar el plànol';
  begin
    insert into planols (esdeveniment_id, nom, creat_per)
    values ('10000000-0000-0000-0000-000000000001', 'meu', '00000000-0000-0000-0000-00000000000c');
    raise exception 'una usuària no hauria de poder crear plànols';
  exception when insufficient_privilege then null;
  end;
  -- Com ho fa l'app: per la RPC (marcar i desmarcar la mateixa persona).
  assert marca_arribades('40000000-0000-0000-0000-000000000001', array['p1', 'p2'], true) = 2;
  assert marca_arribades('40000000-0000-0000-0000-000000000001', array['p1'], false) = 1;
  assert (select marcat_per from arribades where persona = 'p1') = '00000000-0000-0000-0000-00000000000c';
  assert (select arribat from arribades where persona = 'p1') = false;
  -- No pot marcar en nom d'una altra persona.
  begin
    insert into arribades (planol_id, persona, arribat, marcat_per)
    values ('40000000-0000-0000-0000-000000000001', 'p9', true, '00000000-0000-0000-0000-00000000000b');
    raise exception 'no hauria de poder marcar en nom d''algú altre';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from arribades;
    raise exception 'delete d''arribades hauria de fallar';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Algú de fora no veu ni plànols ni arribades.
\o /dev/null
select pg_temp.com('aliena');
\o
do $$ begin
  assert (select count(*) from planols) = 0;
  assert (select count(*) from arribades) = 0;
  begin
    perform marca_arribades('40000000-0000-0000-0000-000000000001', array['p3'], true);
    raise exception 'aliena no hauria de poder marcar arribades';
  exception when insufficient_privilege then null;
  end;
end $$;

-- anon no veu res.
reset role;
set role anon;
do $$ begin
  begin
    perform 1 from tasques;
    raise exception 'anon no hauria de llegir tasques';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\echo 'verificacio.sql: tot correcte'
