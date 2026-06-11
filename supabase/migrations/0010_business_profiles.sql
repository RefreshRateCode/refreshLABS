-- noalanPRO Ops — Business profiles (DBAs).
--
-- Additional "doing business as" identities under the noalanPRO umbrella.
-- Each invoice/estimate can be issued under a chosen profile; when none is set
-- it falls back to the primary business identity in app_settings. The chosen
-- profile's name/address appears on that document's PDF.

create table if not exists public.business_profiles (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null,
  line1           text,
  line2           text,
  city_state_zip  text,
  email           text,
  phone           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_business_profiles_updated before update on public.business_profiles
  for each row execute function public.set_updated_at();

create index if not exists idx_business_profiles_owner
  on public.business_profiles (owner_id);

-- Link estimates and invoices to the issuing profile (null = primary identity).
alter table public.estimates
  add column if not exists business_profile_id uuid
  references public.business_profiles (id) on delete set null;
alter table public.invoices
  add column if not exists business_profile_id uuid
  references public.business_profiles (id) on delete set null;

alter table public.business_profiles enable row level security;

create policy "own rows" on public.business_profiles
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on public.business_profiles to authenticated;
