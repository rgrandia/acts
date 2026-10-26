-- ============================================================
-- 0001 · Base: perfils, esdeveniments, membres amb rol per
--        esdeveniment, invitacions, àrees, tasques i comentaris
-- ============================================================
-- Principis (CLAUDE.md):
--   * Els rols són PER ESDEVENIMENT (§4.1). Algú pot ser superusuari d'un
--     acte i usuari normal d'un altre. El propietari de plataforma només
--     crea esdeveniments i fa de superusuari de tots (suport).
--   * RLS a totes les taules des del primer dia. Cap política de delete:
--     res no s'esborra, es cancel·la o es desactiva (§5).
--   * La clau service_role no es fa servir: qui pot entrar ho decideix el
--     hook "before user created" (només correus convidats) i el que veu,
--     l'RLS.

alter database postgres set timezone to 'Europe/Madrid';

-- ------------------------------------------------------------
-- TIPUS
-- ------------------------------------------------------------
create type rol_membre         as enum ('superusuari', 'usuari');
create type estat_esdeveniment as enum ('preparacio', 'en_curs', 'tancat', 'cancellat');
create type estat_tasca        as enum ('pendent', 'en_curs', 'feta', 'cancellada');
create type prioritat          as enum ('alta', 'normal', 'baixa');

-- ------------------------------------------------------------
-- PERFILS (1:1 amb auth.users; els crea el trigger de més avall)
-- ------------------------------------------------------------
create table perfils (
  id          uuid primary key references auth.users(id) on delete cascade,
  nom         text not null,
  email       text not null,
  idioma      text not null default 'ca' check (idioma in ('ca', 'es')),
  propietari  boolean not null default false,
  creat_el    timestamptz not null default now()
);
create unique index perfils_email on perfils (lower(email));

-- ------------------------------------------------------------
-- ESDEVENIMENTS
-- ------------------------------------------------------------
create table esdeveniments (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null check (trim(nom) <> ''),
  descripcio  text,
  lloc        text,
  data_inici  date,
  data_fi     date,
  estat       estat_esdeveniment not null default 'preparacio',
  creat_per   uuid references perfils(id) default auth.uid(),
  creat_el    timestamptz not null default now(),
  constraint esdeveniment_dates check (data_fi is null or data_inici is null or data_fi >= data_inici)
);

-- ------------------------------------------------------------
-- ÀREES (logística, acreditació, protocol...)
-- ------------------------------------------------------------
create table arees (
  id               uuid primary key default gen_random_uuid(),
  esdeveniment_id  uuid not null references esdeveniments(id) on delete cascade,
  nom              text not null check (trim(nom) <> ''),
  color            text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  activa           boolean not null default true,
  creat_el         timestamptz not null default now(),
  unique (esdeveniment_id, id)
);
create unique index arees_nom on arees (esdeveniment_id, lower(nom)) where activa;

-- ------------------------------------------------------------
-- MEMBRES (rol per esdeveniment)
-- ------------------------------------------------------------
create table membres (
  esdeveniment_id  uuid not null references esdeveniments(id) on delete cascade,
  perfil_id        uuid not null references perfils(id) on delete cascade,
  rol              rol_membre not null default 'usuari',
  area_id          uuid,
  actiu            boolean not null default true,
  afegit_per       uuid references perfils(id) default auth.uid(),
  creat_el         timestamptz not null default now(),
  primary key (esdeveniment_id, perfil_id),
  foreign key (esdeveniment_id, area_id) references arees(esdeveniment_id, id)
);
create index on membres (perfil_id) where actiu;

-- ------------------------------------------------------------
-- INVITACIONS (correus que encara no tenen compte)
-- ------------------------------------------------------------
create table invitacions (
  id               uuid primary key default gen_random_uuid(),
  esdeveniment_id  uuid not null references esdeveniments(id) on delete cascade,
  email            text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  rol              rol_membre not null default 'usuari',
  convidat_per     uuid references perfils(id) default auth.uid(),
  creat_el         timestamptz not null default now(),
  acceptada_el     timestamptz,
  cancellada_el    timestamptz
);
create unique index invitacions_una_pendent
  on invitacions (esdeveniment_id, lower(email))
  where acceptada_el is null and cancellada_el is null;

-- ------------------------------------------------------------
-- TASQUES
-- ------------------------------------------------------------
create table tasques (
  id               uuid primary key default gen_random_uuid(),
  esdeveniment_id  uuid not null references esdeveniments(id) on delete cascade,
  area_id          uuid,
  titol            text not null check (trim(titol) <> ''),
  descripcio       text,
  assignada_a      uuid references perfils(id),
  data_limit       date,
  hora_limit       time,
  estat            estat_tasca not null default 'pendent',
  prioritat        prioritat not null default 'normal',
  feta_el          timestamptz,
  creada_per       uuid references perfils(id) default auth.uid(),
  creat_el         timestamptz not null default now(),
  actualitzat_el   timestamptz not null default now(),
  foreign key (esdeveniment_id, area_id) references arees(esdeveniment_id, id),
  -- Una tasca és feta si i només si té quan s'ha fet.
  constraint tasca_feta_te_data check ((estat = 'feta') = (feta_el is not null)),
  constraint tasca_hora_amb_data check (hora_limit is null or data_limit is not null)
);
create index on tasques (esdeveniment_id, estat);
create index on tasques (assignada_a, estat);

-- ------------------------------------------------------------
-- COMENTARIS DE TASCA (append-only)
-- ------------------------------------------------------------
create table comentaris (
  id        bigserial primary key,
  tasca_id  uuid not null references tasques(id) on delete cascade,
  autor_id  uuid not null references perfils(id) default auth.uid(),
  text      text not null check (trim(text) <> ''),
  creat_el  timestamptz not null default now()
);
create index on comentaris (tasca_id, creat_el);

-- ============================================================
-- FUNCIONS AUXILIARS DE PERMISOS
-- security definer: s'executen sense RLS per no entrar en recursió.
-- ============================================================
create or replace function es_propietari() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select propietari from perfils where id = auth.uid()), false);
$$;

create or replace function es_membre(p_esdeveniment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select es_propietari() or exists (
    select 1 from membres
    where esdeveniment_id = p_esdeveniment and perfil_id = auth.uid() and actiu
  );
$$;

create or replace function es_super(p_esdeveniment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select es_propietari() or exists (
    select 1 from membres
    where esdeveniment_id = p_esdeveniment and perfil_id = auth.uid()
      and actiu and rol = 'superusuari'
  );
$$;

-- Comparteixo algun esdeveniment amb aquesta persona? (per veure'n el perfil)
create or replace function comparteix_esdeveniment(p_perfil uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membres a join membres b using (esdeveniment_id)
    where a.perfil_id = auth.uid() and a.actiu and b.perfil_id = p_perfil
  );
$$;

revoke all on function es_propietari(), es_membre(uuid), es_super(uuid), comparteix_esdeveniment(uuid) from public, anon;
grant execute on function es_propietari(), es_membre(uuid), es_super(uuid), comparteix_esdeveniment(uuid) to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table perfils       enable row level security;
alter table esdeveniments enable row level security;
alter table arees         enable row level security;
alter table membres       enable row level security;
alter table invitacions   enable row level security;
alter table tasques       enable row level security;
alter table comentaris    enable row level security;

-- Supabase dona per defecte tots els privilegis a anon i authenticated.
-- Els traiem i donem només els que calen. Cap delete enlloc.
revoke all on perfils, esdeveniments, arees, membres, invitacions, tasques, comentaris from anon, authenticated;
revoke all on sequence comentaris_id_seq from anon, authenticated;

grant select on perfils to authenticated;
grant update (nom, idioma) on perfils to authenticated;

grant select, insert on esdeveniments to authenticated;
grant update (nom, descripcio, lloc, data_inici, data_fi, estat) on esdeveniments to authenticated;

grant select, insert on arees to authenticated;
grant update (nom, color, activa) on arees to authenticated;

grant select on membres to authenticated;
grant update (rol, area_id, actiu) on membres to authenticated;

grant select on invitacions to authenticated;
grant update (cancellada_el) on invitacions to authenticated;

grant select, insert on tasques to authenticated;
grant update (area_id, titol, descripcio, assignada_a, data_limit, hora_limit, estat, prioritat, feta_el)
  on tasques to authenticated;

grant select, insert on comentaris to authenticated;
grant usage on sequence comentaris_id_seq to authenticated;

-- PERFILS: el meu, els de qui comparteix esdeveniment amb mi, o tots si soc propietari.
create policy llegir on perfils for select to authenticated
  using (id = auth.uid() or es_propietari() or comparteix_esdeveniment(id));
create policy editar_propi on perfils for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ESDEVENIMENTS: els veu qui n'és membre; els crea el propietari; els edita un superusuari.
create policy llegir on esdeveniments for select to authenticated
  using (es_membre(id));
create policy crear on esdeveniments for insert to authenticated
  with check (es_propietari() and creat_per = auth.uid());
create policy modificar on esdeveniments for update to authenticated
  using (es_super(id)) with check (es_super(id));

-- ÀREES
create policy llegir on arees for select to authenticated
  using (es_membre(esdeveniment_id));
create policy crear on arees for insert to authenticated
  with check (es_super(esdeveniment_id));
create policy modificar on arees for update to authenticated
  using (es_super(esdeveniment_id)) with check (es_super(esdeveniment_id));

-- MEMBRES: s'hi entra per convida_membre() o acceptant una invitació (security definer).
create policy llegir on membres for select to authenticated
  using (es_membre(esdeveniment_id));
create policy modificar on membres for update to authenticated
  using (es_super(esdeveniment_id)) with check (es_super(esdeveniment_id));

-- INVITACIONS: només els superusuaris (hi ha correus de gent sense compte).
create policy llegir on invitacions for select to authenticated
  using (es_super(esdeveniment_id));
create policy cancellar on invitacions for update to authenticated
  using (es_super(esdeveniment_id) and acceptada_el is null)
  with check (es_super(esdeveniment_id));

-- TASQUES: les veu tot l'equip de l'acte. Les crea un superusuari. Les modifica
-- un superusuari o la persona assignada (aquesta, només l'estat: trigger).
create policy llegir on tasques for select to authenticated
  using (es_membre(esdeveniment_id));
create policy crear on tasques for insert to authenticated
  with check (es_super(esdeveniment_id) and creada_per = auth.uid());
create policy modificar on tasques for update to authenticated
  using (es_super(esdeveniment_id) or (assignada_a = auth.uid() and es_membre(esdeveniment_id)))
  with check (es_membre(esdeveniment_id));

-- COMENTARIS: qualsevol membre de l'acte, en nom propi.
create policy llegir on comentaris for select to authenticated
  using (exists (select 1 from tasques t where t.id = tasca_id and es_membre(t.esdeveniment_id)));
create policy crear on comentaris for insert to authenticated
  with check (autor_id = auth.uid()
              and exists (select 1 from tasques t where t.id = tasca_id and es_membre(t.esdeveniment_id)));

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Alta d'usuari a auth -> perfil. El primer usuari de tota la plataforma
-- n'és el propietari (arrencada). Després, s'apliquen les seves invitacions.
create or replace function crea_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  primer boolean;
begin
  select not exists (select 1 from perfils) into primer;
  insert into perfils (id, nom, email, propietari)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nom'), ''), split_part(new.email, '@', 1)),
    new.email,
    primer
  );
  perform accepta_invitacions(new.id, new.email);
  return new;
end;
$$;

create or replace function accepta_invitacions(p_perfil uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  i record;
begin
  for i in
    select * from invitacions
    where lower(email) = lower(p_email) and acceptada_el is null and cancellada_el is null
    for update
  loop
    insert into membres (esdeveniment_id, perfil_id, rol, afegit_per)
    values (i.esdeveniment_id, p_perfil, i.rol, i.convidat_per)
    on conflict (esdeveniment_id, perfil_id) do update set actiu = true, rol = excluded.rol;
    update invitacions set acceptada_el = now() where id = i.id;
  end loop;
end;
$$;
revoke all on function accepta_invitacions(uuid, text) from public, anon, authenticated;

create trigger trg_crea_perfil after insert on auth.users
  for each row execute function crea_perfil();

-- Qui crea un esdeveniment n'és superusuari.
create or replace function creador_es_super() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into membres (esdeveniment_id, perfil_id, rol, afegit_per)
  values (new.id, new.creat_per, 'superusuari', new.creat_per);
  return new;
end;
$$;
create trigger trg_creador_es_super after insert on esdeveniments
  for each row execute function creador_es_super();

-- Un esdeveniment no es pot quedar sense cap superusuari actiu.
create or replace function mante_un_super() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.rol = 'superusuari' and old.actiu
     and (new.rol <> 'superusuari' or not new.actiu)
     and not exists (
       select 1 from membres
       where esdeveniment_id = old.esdeveniment_id and perfil_id <> old.perfil_id
         and rol = 'superusuari' and actiu)
  then
    raise exception 'L''esdeveniment ha de tenir almenys un superusuari actiu.'
      using errcode = 'P0001', hint = 'ultim_super';
  end if;
  return new;
end;
$$;
create trigger trg_mante_un_super before update on membres
  for each row execute function mante_un_super();

-- Tasques: coherència i permisos per columna.
create or replace function valida_tasca() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  -- La persona assignada ha de ser membre actiu d'aquest esdeveniment.
  if new.assignada_a is not null
     and (tg_op = 'INSERT' or new.assignada_a is distinct from old.assignada_a)
     and not exists (
       select 1 from membres
       where esdeveniment_id = new.esdeveniment_id and perfil_id = new.assignada_a and actiu)
  then
    raise exception 'Només es pot assignar a membres actius de l''esdeveniment.'
      using errcode = 'P0001', hint = 'assignat_no_membre';
  end if;

  if tg_op = 'UPDATE' then
    if new.esdeveniment_id <> old.esdeveniment_id then
      raise exception 'Una tasca no es pot moure d''esdeveniment.' using errcode = 'P0001';
    end if;
    -- Qui no és superusuari (la persona assignada) només en canvia l'estat.
    if not es_super(old.esdeveniment_id) and (
         new.titol        is distinct from old.titol or
         new.descripcio   is distinct from old.descripcio or
         new.area_id      is distinct from old.area_id or
         new.assignada_a  is distinct from old.assignada_a or
         new.data_limit   is distinct from old.data_limit or
         new.hora_limit   is distinct from old.hora_limit or
         new.prioritat    is distinct from old.prioritat)
    then
      raise exception 'Només un superusuari pot editar o reassignar la tasca.'
        using errcode = 'P0001', hint = 'nomes_super';
    end if;
    new.actualitzat_el := now();
  end if;
  return new;
end;
$$;
create trigger trg_valida_tasca before insert or update on tasques
  for each row execute function valida_tasca();

-- ============================================================
-- RPC
-- ============================================================

-- Afegeix algú a l'equip d'un esdeveniment. Si ja té compte, entra
-- directament; si no, queda una invitació que s'aplica quan s'hi registri.
-- Torna 'afegit', 'reactivat', 'ja_hi_era' o 'convidat'.
create or replace function convida_membre(p_esdeveniment uuid, p_email text, p_rol rol_membre)
returns text
language plpgsql security definer set search_path = public as $$
declare
  correu text := lower(trim(p_email));
  persona uuid;
  actual record;
begin
  if not es_super(p_esdeveniment) then
    raise exception 'Només un superusuari pot convidar.' using errcode = '42501';
  end if;
  if correu !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Correu no vàlid.' using errcode = 'P0001', hint = 'correu_invalid';
  end if;

  select id into persona from perfils where lower(email) = correu;
  if persona is null then
    insert into invitacions (esdeveniment_id, email, rol)
    values (p_esdeveniment, correu, p_rol)
    on conflict (esdeveniment_id, lower(email)) where acceptada_el is null and cancellada_el is null
    do update set rol = excluded.rol;
    return 'convidat';
  end if;

  select * into actual from membres where esdeveniment_id = p_esdeveniment and perfil_id = persona;
  if not found then
    insert into membres (esdeveniment_id, perfil_id, rol) values (p_esdeveniment, persona, p_rol);
    return 'afegit';
  elsif not actual.actiu then
    update membres set actiu = true, rol = p_rol
    where esdeveniment_id = p_esdeveniment and perfil_id = persona;
    return 'reactivat';
  end if;
  return 'ja_hi_era';
end;
$$;
revoke all on function convida_membre(uuid, text, rol_membre) from public, anon;
grant execute on function convida_membre(uuid, text, rol_membre) to authenticated;

-- ============================================================
-- HOOK D'AUTH: "Before User Created"
-- ============================================================
-- S'activa a Supabase: Authentication → Hooks → Before User Created →
-- Postgres → public.hook_abans_crear_usuari. Sense el hook, qualsevol pot
-- crear-se un compte amb el codi per correu (no veuria res, per l'RLS,
-- però ocuparia una fila a auth.users). Amb el hook, només entren:
--   * el primer usuari de la plataforma (el propietari);
--   * correus amb una invitació pendent.
create or replace function hook_abans_crear_usuari(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  correu text := lower(event -> 'user' ->> 'email');
begin
  if not exists (select 1 from perfils)
     or exists (
       select 1 from invitacions
       where lower(email) = correu and acceptada_el is null and cancellada_el is null)
  then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Aquest correu no té cap invitació. / Este correo no tiene ninguna invitación.'));
end;
$$;
revoke all on function hook_abans_crear_usuari(jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant execute on function hook_abans_crear_usuari(jsonb) to supabase_auth_admin;
  end if;
end $$;

-- ============================================================
-- REGISTRE DE MIGRACIONS
-- ============================================================
create table migracions_aplicades (
  nom          text primary key,
  aplicada_el  timestamptz not null default now()
);
alter table migracions_aplicades enable row level security;
revoke all on migracions_aplicades from anon, authenticated;

create or replace function versio_esquema() returns text
language sql stable security definer set search_path = public as $$
  select max(nom) from migracions_aplicades;
$$;
revoke all on function versio_esquema() from public, anon;
grant execute on function versio_esquema() to authenticated;

insert into migracions_aplicades (nom) values ('20261026000001_base') on conflict do nothing;
