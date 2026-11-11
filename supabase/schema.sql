-- Foil Drive Battery Rental: Datenbank für Supabase (Postgres)
--
-- Ausführen: Supabase-Dashboard → SQL Editor → New query → alles einfügen → Run.
-- Das Skript kann mehrfach laufen (idempotent).
--
-- Sicherheitsmodell:
--   * Jeder angemeldete Nutzer hat höchstens EIN Angebot (owner_id ist unique).
--   * Nicht angemeldete Besucher sehen aktive Angebote, aber OHNE WhatsApp/E-Mail
--     (Spalten-Rechte weiter unten).
--   * Angemeldete Mitglieder sehen die Kontaktdaten aller aktiven Angebote.
--   * Schreiben, Ändern und Löschen darf nur der Besitzer des Angebots.

-- 1. Prüffunktion für das Batterie-Feld ---------------------------------------
-- Erlaubte Modelle: Liste anpassen, wenn du in assets/js/app.js (MODELS) etwas änderst.
create or replace function public.batteries_valid(b jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  e jsonb;
  allowed text[] := array['max-hp','max-power','max-sport','max-sport-396','fm650','fm450','f860'];
  k text;
begin
  if jsonb_typeof(b) is distinct from 'array' then return false; end if;
  if jsonb_array_length(b) < 1 or jsonb_array_length(b) > 7 then return false; end if;

  for e in select * from jsonb_array_elements(b) loop
    if jsonb_typeof(e) <> 'object' then return false; end if;
    if not ((e->>'model') = any (allowed)) then return false; end if;
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

-- 2. Tabelle ------------------------------------------------------------------
create table if not exists public.listings (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() unique references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  place_label  text not null default '' check (char_length(place_label) <= 120),
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  approximate  boolean not null default true,
  batteries    jsonb not null,
  currency     text not null default 'EUR' check (currency in ('EUR','CHF','GBP','USD','NOK','SEK','DKK','PLN')),
  whatsapp     text check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  email        text check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  notes        text not null default '' check (char_length(notes) <= 600),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint listings_contact_required check (whatsapp is not null or email is not null),
  constraint listings_batteries_valid  check (public.batteries_valid(batteries))
);

create index if not exists listings_active_idx on public.listings (active);

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

-- 3. Rechte auf Spalten-Ebene ---------------------------------------------------
alter table public.listings enable row level security;

revoke all on public.listings from anon, authenticated;

-- Besucher ohne Login: alles außer Kontaktdaten und owner_id
grant select (id, display_name, place_label, lat, lng, approximate, batteries, currency, notes, active, updated_at)
  on public.listings to anon;

-- Angemeldete Mitglieder: alles (inkl. Kontaktdaten), Schreibrechte werden unten per Policy auf den Besitzer begrenzt
grant select, insert, update, delete on public.listings to authenticated;

-- 4. Zeilenregeln (Row Level Security) -----------------------------------------
drop policy if exists "Aktive Angebote lesen"   on public.listings;
drop policy if exists "Eigenes Angebot lesen"   on public.listings;
drop policy if exists "Eigenes Angebot anlegen" on public.listings;
drop policy if exists "Eigenes Angebot ändern"  on public.listings;
drop policy if exists "Eigenes Angebot löschen" on public.listings;

create policy "Aktive Angebote lesen"
  on public.listings for select
  to anon, authenticated
  using (active);

create policy "Eigenes Angebot lesen"
  on public.listings for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Eigenes Angebot anlegen"
  on public.listings for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Eigenes Angebot ändern"
  on public.listings for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Eigenes Angebot löschen"
  on public.listings for delete
  to authenticated
  using (owner_id = (select auth.uid()));
