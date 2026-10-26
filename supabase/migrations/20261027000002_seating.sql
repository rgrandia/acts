-- ============================================================
-- 0002 · Seating: plànols d'acte i arribades
-- ============================================================
-- Un plànol és el document de l'antic seating.html (elements, seients,
-- zones i convidats) desat com a jsonb. L'estructura interna la coneix
-- l'app (src/lib/seating/model.ts); la base de dades només n'exigeix que sigui
-- un objecte i que no sigui desmesurat.
--
-- Les arribades del dia de l'acte NO van dins del plànol: les marquen
-- diverses persones alhora i cada marca no pot reescriure el document sencer.
--
-- Concurrència: cada canvi de `dades` incrementa `versio`. desa_planol()
-- només desa si la versió que l'app tenia és l'actual; si no, algú altre hi
-- ha desat al mig i l'app ho diu en lloc de trepitjar-ho.

create table planols (
  id                uuid primary key default gen_random_uuid(),
  esdeveniment_id   uuid not null references esdeveniments(id) on delete cascade,
  nom               text not null check (trim(nom) <> ''),
  dades             jsonb not null default '{}'::jsonb,
  versio            int not null default 1,
  actiu             boolean not null default true,
  creat_per         uuid references perfils(id) default auth.uid(),
  creat_el          timestamptz not null default now(),
  actualitzat_per   uuid references perfils(id) default auth.uid(),
  actualitzat_el    timestamptz not null default now(),
  constraint planol_dades_objecte check (jsonb_typeof(dades) = 'object'),
  constraint planol_dades_mida check (pg_column_size(dades) < 4000000)
);
create index on planols (esdeveniment_id) where actiu;

-- Còpies anteriors (append-only). Com a molt una cada 15 minuts per plànol,
-- perquè el desat automàtic no ompli la base de dades.
create table planols_historial (
  id          bigserial primary key,
  planol_id   uuid not null references planols(id) on delete cascade,
  versio      int not null,
  dades       jsonb not null,
  desat_per   uuid references perfils(id),
  desat_el    timestamptz not null
);
create index on planols_historial (planol_id, desat_el desc);

create table arribades (
  planol_id   uuid not null references planols(id) on delete cascade,
  persona     text not null check (length(persona) between 1 and 64),
  arribat     boolean not null,
  marcat_per  uuid references perfils(id) default auth.uid(),
  marcat_el   timestamptz not null default now(),
  primary key (planol_id, persona)
);

create or replace function esdeveniment_del_planol(p_planol uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select esdeveniment_id from planols where id = p_planol;
$$;
revoke all on function esdeveniment_del_planol(uuid) from public, anon;
grant execute on function esdeveniment_del_planol(uuid) to authenticated;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table planols           enable row level security;
alter table planols_historial enable row level security;
alter table arribades         enable row level security;

revoke all on planols, planols_historial, arribades from anon, authenticated;
revoke all on sequence planols_historial_id_seq from anon, authenticated;

grant select, insert on planols to authenticated;
grant update (nom, dades, actiu) on planols to authenticated;
grant select on planols_historial to authenticated;
grant select, insert on arribades to authenticated;
grant update (arribat, marcat_per, marcat_el) on arribades to authenticated;

-- Plànols: els veu tot l'equip (el dia de l'acte cal per a l'accés); els
-- crea i modifica un superusuari.
create policy llegir on planols for select to authenticated
  using (es_membre(esdeveniment_id));
create policy crear on planols for insert to authenticated
  with check (es_super(esdeveniment_id) and creat_per = auth.uid());
create policy modificar on planols for update to authenticated
  using (es_super(esdeveniment_id)) with check (es_super(esdeveniment_id));

create policy llegir on planols_historial for select to authenticated
  using (es_super(esdeveniment_del_planol(planol_id)));

-- Arribades: qualsevol membre de l'equip les marca (voluntariat a la porta).
create policy llegir on arribades for select to authenticated
  using (es_membre(esdeveniment_del_planol(planol_id)));
create policy marcar on arribades for insert to authenticated
  with check (es_membre(esdeveniment_del_planol(planol_id)) and marcat_per = auth.uid());
create policy remarcar on arribades for update to authenticated
  using (es_membre(esdeveniment_del_planol(planol_id)))
  with check (es_membre(esdeveniment_del_planol(planol_id)) and marcat_per = auth.uid());

-- ------------------------------------------------------------
-- TRIGGERS
-- ------------------------------------------------------------
create or replace function versio_planol() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.esdeveniment_id <> old.esdeveniment_id then
    raise exception 'Un plànol no es pot moure d''esdeveniment.' using errcode = 'P0001';
  end if;
  if new.dades is distinct from old.dades then
    new.versio := old.versio + 1;
    new.actualitzat_per := auth.uid();
    new.actualitzat_el := now();
    if not exists (
      select 1 from planols_historial
      where planol_id = old.id and desat_el > now() - interval '15 minutes')
    then
      insert into planols_historial (planol_id, versio, dades, desat_per, desat_el)
      values (old.id, old.versio, old.dades, old.actualitzat_per, old.actualitzat_el);
    end if;
  else
    new.versio := old.versio;
  end if;
  return new;
end;
$$;
create trigger trg_versio_planol before update on planols
  for each row execute function versio_planol();

-- ------------------------------------------------------------
-- RPC
-- ------------------------------------------------------------

-- Desa el contingut si ningú no hi ha desat des de `p_versio`. Torna la
-- versió nova. Si hi ha conflicte, error amb hint 'conflicte_versio'.
create or replace function desa_planol(p_planol uuid, p_dades jsonb, p_versio int) returns int
language plpgsql security invoker set search_path = public as $$
declare
  nova int;
begin
  update planols set dades = p_dades
  where id = p_planol and versio = p_versio
  returning versio into nova;
  if nova is null then
    if exists (select 1 from planols where id = p_planol) and es_super(esdeveniment_del_planol(p_planol)) then
      raise exception 'Algú altre ha desat aquest plànol mentrestant.'
        using errcode = 'P0001', hint = 'conflicte_versio';
    end if;
    raise exception 'No tens permís per desar aquest plànol.' using errcode = '42501';
  end if;
  return nova;
end;
$$;
revoke all on function desa_planol(uuid, jsonb, int) from public, anon;
grant execute on function desa_planol(uuid, jsonb, int) to authenticated;


-- Llista de plànols amb comptes, sense baixar els documents (poden ser grans).
create or replace function resum_planols(p_esdeveniment uuid)
returns table (id uuid, nom text, actualitzat_el timestamptz, seients int, convidats int)
language sql stable security invoker set search_path = public as $$
  select p.id, p.nom, p.actualitzat_el,
         coalesce((select sum(jsonb_array_length(coalesce(e -> 'seats', '[]'::jsonb)))::int
                   from jsonb_array_elements(coalesce(p.dades -> 'els', '[]'::jsonb)) e), 0),
         coalesce(jsonb_array_length(p.dades -> 'people'), 0)
  from planols p
  where p.esdeveniment_id = p_esdeveniment and p.actiu
  order by p.creat_el;
$$;
revoke all on function resum_planols(uuid) from public, anon;
grant execute on function resum_planols(uuid) to authenticated;

-- Marca o desmarca arribades de cop (una persona o tot el plànol). Amb
-- security invoker: les polítiques d'arribades decideixen qui pot.
create or replace function marca_arribades(p_planol uuid, p_persones text[], p_arribat boolean) returns int
language sql security invoker set search_path = public as $$
  with fetes as (
    insert into arribades (planol_id, persona, arribat, marcat_per, marcat_el)
    select p_planol, persona, p_arribat, auth.uid(), now()
    from unnest(p_persones) as persona
    on conflict (planol_id, persona) do update
      set arribat = excluded.arribat, marcat_per = excluded.marcat_per, marcat_el = excluded.marcat_el
    returning 1
  )
  select count(*)::int from fetes;
$$;
revoke all on function marca_arribades(uuid, text[], boolean) from public, anon;
grant execute on function marca_arribades(uuid, text[], boolean) to authenticated;

insert into migracions_aplicades (nom) values ('20261027000002_seating') on conflict do nothing;
