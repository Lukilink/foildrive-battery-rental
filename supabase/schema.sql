-- Foil Assist Battery Rental: Datenbank für Supabase (Postgres), Version 3
--
-- Ausführen: Supabase-Dashboard → SQL Editor → New query → alles einfügen → Run.
-- Das Skript kann mehrfach laufen (idempotent).
--
-- Rollen
--   Besucher (nicht angemeldet): sehen freigegebene Angebote OHNE Kontaktdaten.
--   Mitglieder (angemeldet, E-Mail bestätigt): sehen zusätzlich WhatsApp/E-Mail der freigegebenen Angebote.
--   Anbieter: Privatpersonen ('private') oder Schulen/Rentals ('pro'). Jeder stellt genau EIN Angebot ein (Antrag).
--             Es ist erst nach Freigabe öffentlich.
--   Admin: prüft Anträge, gibt frei oder lehnt ab, sieht Nachweise.
--
-- Geschrieben wird NUR über die Funktionen weiter unten (save_my_listing, admin_decide …).
-- So kann niemand seinen eigenen Status auf "approved" setzen.

-- 1. Prüffunktion für das Batterie-Feld ---------------------------------------
-- Jede Batterie: {brand, model, [name], [label], priceDay, priceWeek}
-- Marke und Modell werden nur auf das Format geprüft. Die Auswahlliste steht in assets/js/catalog.js.
create or replace function public.batteries_valid(b jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  e jsonb;
  k text;
begin
  if jsonb_typeof(b) is distinct from 'array' then return false; end if;
  if jsonb_array_length(b) < 1 or jsonb_array_length(b) > 20 then return false; end if;

  for e in select * from jsonb_array_elements(b) loop
    if jsonb_typeof(e) <> 'object' then return false; end if;
    if coalesce(e->>'brand', '') !~ '^[a-z0-9-]{1,40}$' then return false; end if;
    if coalesce(e->>'model', '') !~ '^[a-z0-9-]{1,40}$' then return false; end if;
    foreach k in array array['name','label'] loop
      if e ? k and (jsonb_typeof(e->k) <> 'string' or char_length(e->>k) > 80) then return false; end if;
    end loop;
    if (e->>'brand' = 'other' or e->>'model' = 'other') and char_length(coalesce(e->>'name', '')) < 2 then return false; end if;
    foreach k in array array['priceDay','priceWeek'] loop
      if e ? k then
        if jsonb_typeof(e->k) not in ('number','null') then return false; end if;
        if jsonb_typeof(e->k) = 'number' and ((e->>k)::numeric < 0 or (e->>k)::numeric > 9999.99) then return false; end if;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

-- 2. Tabellen -----------------------------------------------------------------
create table if not exists public.listings (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null unique references auth.users (id) on delete cascade,

  -- öffentlich sichtbar (nach Freigabe)
  kind           text not null default 'private' check (kind in ('private','pro')),  -- Privat oder Schule/Rental
  website        text check (website is null or (char_length(website) <= 300 and website ~* '^https://.+')),
  opening_hours  text not null default '' check (char_length(opening_hours) <= 300),
  display_name   text not null check (char_length(display_name) between 2 and 60),
  place_label    text not null default '' check (char_length(place_label) <= 120),
  lat            double precision not null check (lat between -90 and 90),
  lng            double precision not null check (lng between -180 and 180),
  approximate    boolean not null default true,
  batteries      jsonb not null,
  currency       text not null default 'EUR' check (currency in ('EUR','CHF','GBP','USD','NOK','SEK','DKK','PLN')),
  deposit_amount numeric(8,2) check (deposit_amount is null or deposit_amount between 0 and 99999),
  id_check       boolean not null default false,     -- "Ausweis wird vorgezeigt"
  notes          text not null default '' check (char_length(notes) <= 600),
  active         boolean not null default true,      -- Verleiher kann pausieren

  -- nur für Mitglieder sichtbar
  whatsapp       text check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  email          text check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),

  -- nur für den Verleiher selbst und den Admin sichtbar
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  proof_url      text not null check (char_length(proof_url) <= 300 and proof_url ~* '^https://.+'),
  proof_file     text check (proof_file ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  reject_reason  text check (char_length(reject_reason) <= 500),
  lang           text not null default 'en' check (lang in ('de','en')),  -- Sprache für Mails an den Verleiher
  notify_pending boolean not null default true,      -- true = Admin wurde noch nicht per Mail informiert
  reviewed_at    timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint listings_contact_required check (whatsapp is not null or email is not null),
  constraint listings_batteries_valid  check (public.batteries_valid(batteries))
);

-- Upgrade einer älteren Version (Version 2 → 3): fehlende Spalten und Regeln nachziehen.
alter table public.listings add column if not exists kind text not null default 'private';
alter table public.listings add column if not exists website text;
alter table public.listings add column if not exists opening_hours text not null default '';
alter table public.listings drop constraint if exists listings_proof_url_check;
alter table public.listings drop constraint if exists listings_kind_check;
alter table public.listings drop constraint if exists listings_website_check;
alter table public.listings drop constraint if exists listings_opening_hours_check;
alter table public.listings drop constraint if exists listings_pro_fields;
alter table public.listings drop constraint if exists listings_proof_social;
alter table public.listings drop constraint if exists listings_proof_url_https;
alter table public.listings add constraint listings_kind_check check (kind in ('private','pro'));
alter table public.listings add constraint listings_website_check
  check (website is null or (char_length(website) <= 300 and website ~* '^https://.+'));
alter table public.listings add constraint listings_opening_hours_check check (char_length(opening_hours) <= 300);
alter table public.listings add constraint listings_proof_url_https check (char_length(proof_url) <= 300 and proof_url ~* '^https://.+');
-- Privat: Instagram/Facebook-Profil ist Pflicht. Schule/Rental: Website und Öffnungszeiten sind Pflicht.
alter table public.listings add constraint listings_proof_social
  check (kind = 'pro' or proof_url ~* '^https://([a-z0-9-]+\.)*(instagram\.com|facebook\.com|fb\.com|fb\.me)/.+');
alter table public.listings add constraint listings_pro_fields
  check (kind = 'private' or (website is not null and char_length(btrim(opening_hours)) >= 2));

-- Alte Batterie-Einträge hatten keine Marke: Das waren alles Foil Drive.
update public.listings
   set batteries = (
     select jsonb_agg(case when e ? 'brand' then e else e || '{"brand":"foil-drive"}'::jsonb end order by ord)
       from jsonb_array_elements(batteries) with ordinality as t(e, ord))
 where exists (select 1 from jsonb_array_elements(batteries) e where not (e ? 'brand'));

create index if not exists listings_visible_idx on public.listings (status, active);

-- Admins: trägst du selbst ein (siehe README). Niemand außer den Funktionen unten kann die Tabelle lesen.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- updated_at automatisch pflegen
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- 3. Rechte und Zeilenregeln ----------------------------------------------------
alter table public.listings enable row level security;
alter table public.admins   enable row level security;

revoke all on public.listings from anon, authenticated;
revoke all on public.admins   from anon, authenticated;

-- Besucher ohne Login: nur öffentliche Spalten
grant select (id, kind, website, opening_hours, display_name, place_label, lat, lng, approximate, batteries, currency,
              deposit_amount, id_check, notes, active, updated_at)
  on public.listings to anon;

-- Angemeldete Mitglieder: zusätzlich Kontaktdaten. Kein Schreibzugriff, kein Zugriff auf Status und Nachweise.
grant select (id, kind, website, opening_hours, display_name, place_label, lat, lng, approximate, batteries, currency,
              deposit_amount, id_check, notes, active, updated_at, whatsapp, email)
  on public.listings to authenticated;

drop policy if exists "Freigegebene Angebote lesen" on public.listings;
create policy "Freigegebene Angebote lesen"
  on public.listings for select
  to anon, authenticated
  using (active and status = 'approved');

-- 4. Funktionen ---------------------------------------------------------------
-- Alle laufen mit erhöhten Rechten (security definer), prüfen aber selbst, wer aufruft.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Eigenes Angebot komplett lesen (inkl. Status und Nachweise)
create or replace function public.my_listing()
returns setof public.listings
language sql
security definer
stable
set search_path = ''
as $$
  select * from public.listings where owner_id = (select auth.uid());
$$;

-- Eigenes Angebot anlegen oder ändern. Neuer Antrag → "pending". Abgelehnter Antrag, der neu
-- gespeichert wird → wieder "pending". Freigegebene Angebote bleiben freigegeben.
create or replace function public.save_my_listing(p jsonb)
returns public.listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pf  text := nullif(p->>'proof_file', '');
  r   public.listings;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if pf is not null and not starts_with(pf, uid::text || '/') then
    raise exception 'invalid proof_file' using errcode = '22023';
  end if;

  insert into public.listings as l
    (owner_id, kind, website, opening_hours, display_name, place_label, lat, lng, approximate, batteries, currency,
     deposit_amount, id_check, whatsapp, email, notes, active, proof_url, proof_file, lang)
  values
    (uid,
     coalesce(nullif(p->>'kind', ''), 'private'),
     nullif(p->>'website', ''),
     coalesce(p->>'opening_hours', ''),
     p->>'display_name',
     coalesce(p->>'place_label', ''),
     (p->>'lat')::double precision,
     (p->>'lng')::double precision,
     coalesce((p->>'approximate')::boolean, true),
     p->'batteries',
     coalesce(nullif(p->>'currency', ''), 'EUR'),
     nullif(p->>'deposit_amount', '')::numeric,
     coalesce((p->>'id_check')::boolean, false),
     nullif(p->>'whatsapp', ''),
     nullif(p->>'email', ''),
     coalesce(p->>'notes', ''),
     coalesce((p->>'active')::boolean, true),
     p->>'proof_url',
     pf,
     coalesce(nullif(p->>'lang', ''), 'en'))
  on conflict (owner_id) do update set
    kind           = excluded.kind,
    website        = excluded.website,
    opening_hours  = excluded.opening_hours,
    display_name   = excluded.display_name,
    place_label    = excluded.place_label,
    lat            = excluded.lat,
    lng            = excluded.lng,
    approximate    = excluded.approximate,
    batteries      = excluded.batteries,
    currency       = excluded.currency,
    deposit_amount = excluded.deposit_amount,
    id_check       = excluded.id_check,
    whatsapp       = excluded.whatsapp,
    email          = excluded.email,
    notes          = excluded.notes,
    active         = excluded.active,
    proof_url      = excluded.proof_url,
    proof_file     = excluded.proof_file,
    lang           = excluded.lang,
    status         = case when l.status = 'rejected' then 'pending' else l.status end,
    notify_pending = case when l.status = 'rejected' then true else l.notify_pending end,
    reject_reason  = case when l.status = 'rejected' then null else l.reject_reason end
  returning * into r;

  return r;
end;
$$;

create or replace function public.delete_my_listing()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.listings where owner_id = (select auth.uid());
$$;

-- Edge Function ruft das nach dem Speichern auf: liefert die Daten für die Admin-Mail, aber nur EINMAL
-- pro Antrag (verhindert Mail-Flut durch wiederholtes Speichern).
create or replace function public.claim_notification()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.listings;
begin
  update public.listings
     set notify_pending = false
   where owner_id = (select auth.uid()) and status = 'pending' and notify_pending
  returning * into r;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', r.id, 'name', r.display_name, 'place', r.place_label, 'batteries', r.batteries,
    'kind', r.kind, 'website', r.website, 'opening_hours', r.opening_hours,
    'whatsapp', r.whatsapp, 'email', r.email, 'proof_url', r.proof_url,
    'has_file', r.proof_file is not null, 'lang', r.lang,
    'applicant_email', (select u.email from auth.users u where u.id = r.owner_id));
end;
$$;

-- Admin: Anträge nach Status auflisten
create or replace function public.admin_applications(p_status text default 'pending')
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.updated_at desc)
    from (
      select l.id, l.kind, l.website, l.opening_hours, l.display_name, l.place_label, l.lat, l.lng, l.batteries, l.currency,
             l.deposit_amount, l.id_check, l.whatsapp, l.email, l.notes, l.active, l.status,
             l.proof_url, l.proof_file, l.reject_reason, l.lang,
             l.created_at, l.updated_at, l.reviewed_at,
             u.email as applicant_email
        from public.listings l
        join auth.users u on u.id = l.owner_id
       where l.status = p_status
    ) x
  ), '[]'::jsonb);
end;
$$;

-- Admin: freigeben ("approve") oder ablehnen/sperren ("reject"). Der Nachweis (Rechnung) wird dabei
-- aus dem Datensatz entfernt und der Dateipfad zurückgegeben, damit die Datei gelöscht werden kann.
create or replace function public.admin_decide(p_id uuid, p_decision text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_file text;
  r public.listings;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;

  select proof_file into old_file from public.listings where id = p_id for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  update public.listings
     set status         = case when p_decision = 'approve' then 'approved' else 'rejected' end,
         reject_reason  = case when p_decision = 'reject' then nullif(left(p_reason, 500), '') else null end,
         reviewed_at    = now(),
         notify_pending = false,
         proof_file     = null
   where id = p_id
  returning * into r;

  return jsonb_build_object(
    'id', r.id, 'name', r.display_name, 'status', r.status, 'reason', r.reject_reason,
    'lang', r.lang, 'proof_file', old_file,
    'applicant_email', (select u.email from auth.users u where u.id = r.owner_id));
end;
$$;

-- Nur angemeldete Nutzer dürfen die Funktionen aufrufen (nicht anonym, nicht "public")
revoke all on function public.is_admin()                           from public, anon;
revoke all on function public.my_listing()                         from public, anon;
revoke all on function public.save_my_listing(jsonb)               from public, anon;
revoke all on function public.delete_my_listing()                  from public, anon;
revoke all on function public.claim_notification()                 from public, anon;
revoke all on function public.admin_applications(text)             from public, anon;
revoke all on function public.admin_decide(uuid, text, text)       from public, anon;

grant execute on function public.is_admin()                        to authenticated;
grant execute on function public.my_listing()                      to authenticated;
grant execute on function public.save_my_listing(jsonb)            to authenticated;
grant execute on function public.delete_my_listing()               to authenticated;
grant execute on function public.claim_notification()              to authenticated;
grant execute on function public.admin_applications(text)          to authenticated;
grant execute on function public.admin_decide(uuid, text, text)    to authenticated;

-- 5. Speicher für Nachweise (Rechnungen) -------------------------------------------
-- Privater Bucket: nur der Besitzer (Ordner = seine User-ID) und der Admin kommen ran.
-- PDF/JPG/PNG, höchstens 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Nachweis hochladen (eigener Ordner)"    on storage.objects;
drop policy if exists "Nachweis lesen (eigener Ordner, Admin)" on storage.objects;
drop policy if exists "Nachweis löschen (eigener Ordner, Admin)" on storage.objects;

create policy "Nachweis hochladen (eigener Ordner)"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Nachweis lesen (eigener Ordner, Admin)"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'proofs'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

create policy "Nachweis löschen (eigener Ordner, Admin)"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'proofs'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
