-- noalanPRO Ops — per-user settings (business info shown on invoices,
-- plus invoice defaults). One row per owner.

create table if not exists public.app_settings (
  owner_id                 uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  business_name            text not null default 'noalanPRO',
  business_line1           text,
  business_line2           text,
  business_city_state_zip  text,
  business_email           text,
  business_phone           text,
  invoice_prefix           text not null default 'INV-',
  default_tax_rate         numeric(6, 3) not null default 0,
  updated_at               timestamptz not null default now()
);

create trigger trg_app_settings_updated before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

create policy "own row" on public.app_settings
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on public.app_settings to authenticated;
