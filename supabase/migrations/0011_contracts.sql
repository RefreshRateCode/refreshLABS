-- noalanPRO Ops — Contracts.
--
-- Upload a contract file, assign it to a customer, and capture the agreed
-- services + terms so they can pre-fill that customer's estimates/invoices.
-- File bytes live in a private 'contracts' storage bucket (per-user folder,
-- docs & images), mirroring the customer-files / receipts pattern.

create table if not exists public.contracts (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id         uuid references public.customers (id) on delete set null,
  title               text not null,
  path                text,                          -- path in the 'contracts' bucket
  file_name           text,                          -- original filename for display
  mime                text,
  size_bytes          bigint,
  payment_terms_days  integer not null default 0,    -- pre-fills invoice due date
  notes               text,                          -- pre-fills estimate/invoice notes
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_contracts_updated before update on public.contracts
  for each row execute function public.set_updated_at();

create index if not exists idx_contracts_customer on public.contracts (customer_id);

-- Agreed services & rates (used to pre-fill estimate/invoice line items).
create table if not exists public.contract_line_items (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contract_id  uuid not null references public.contracts (id) on delete cascade,
  description  text not null,
  quantity     numeric(12, 2) not null default 1,
  unit_price   numeric(12, 2) not null default 0,
  amount       numeric(14, 2) generated always as (quantity * unit_price) stored,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_contract_items_contract
  on public.contract_line_items (contract_id);

alter table public.contracts           enable row level security;
alter table public.contract_line_items enable row level security;

create policy "own rows" on public.contracts
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own rows" on public.contract_line_items
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on
  public.contracts, public.contract_line_items to authenticated;

-- ---------------------------------------------------------------------------
-- 'contracts' storage bucket: private, per-user folder, docs & images.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contracts', 'contracts', false, 26214400,  -- 25 MB
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "contracts: read own"
  on storage.objects for select to authenticated
  using (bucket_id = 'contracts'
    and (storage.foldername(name))[1] = auth.uid()::text);

create policy "contracts: upload own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'contracts'
    and (storage.foldername(name))[1] = auth.uid()::text);

create policy "contracts: update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'contracts'
    and (storage.foldername(name))[1] = auth.uid()::text);

create policy "contracts: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'contracts'
    and (storage.foldername(name))[1] = auth.uid()::text);
