-- noalanPRO Ops — Customer contacts + file attachments.
--
-- Three changes:
--   1. Company is now required (the customer's primary identity). display_name
--      is kept in sync with company by the app so existing readers (invoices,
--      PDFs, QuickBooks export, lists) keep labeling by company unchanged.
--   2. Multiple contacts per customer (customer_contacts). The customer's
--      email/phone columns become an auto-maintained cache of the PRIMARY
--      contact, so downstream consumers need no changes.
--   3. File attachments per customer (customer_files) backed by a private
--      'customer-files' storage bucket, scoped per-user like 'receipts'.

-- ---------------------------------------------------------------------------
-- 1. Company required
-- ---------------------------------------------------------------------------
-- Backfill any rows missing a company before adding the NOT NULL constraint.
update public.customers set company = display_name
  where company is null or btrim(company) = '';

alter table public.customers alter column company set not null;

-- ---------------------------------------------------------------------------
-- 2. customer_contacts
-- ---------------------------------------------------------------------------
create table if not exists public.customer_contacts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id  uuid not null references public.customers (id) on delete cascade,
  name         text not null,
  role         text,                              -- e.g. "Owner", "Billing", "Site contact"
  email        text,
  phone        text,
  is_primary   boolean not null default false,
  position     integer not null default 0,        -- display order
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_customer_contacts_updated before update on public.customer_contacts
  for each row execute function public.set_updated_at();

create index if not exists idx_customer_contacts_customer
  on public.customer_contacts (customer_id);

-- At most one primary contact per customer.
create unique index if not exists uq_customer_contacts_primary
  on public.customer_contacts (customer_id) where is_primary;

-- Keep customers.email / customers.phone mirrored to the primary contact
-- (falling back to the earliest contact when none is flagged primary).
create or replace function public.sync_customer_primary_contact()
returns trigger
language plpgsql
as $$
declare
  cust uuid := coalesce(new.customer_id, old.customer_id);
  c_email text;
  c_phone text;
begin
  select email, phone into c_email, c_phone
  from public.customer_contacts
  where customer_id = cust
  order by is_primary desc, position asc, created_at asc
  limit 1;

  update public.customers
    set email = c_email, phone = c_phone
    where id = cust;

  return null;  -- AFTER trigger; return value ignored
end;
$$;

create trigger trg_customer_contacts_sync
  after insert or update or delete on public.customer_contacts
  for each row execute function public.sync_customer_primary_contact();

-- Seed contacts from existing customer email/phone so no data is lost.
insert into public.customer_contacts (owner_id, customer_id, name, email, phone, is_primary, position)
select c.owner_id, c.id, c.display_name, c.email, c.phone, true, 0
from public.customers c
where (c.email is not null or c.phone is not null)
  and not exists (
    select 1 from public.customer_contacts cc where cc.customer_id = c.id
  );

alter table public.customer_contacts enable row level security;

create policy "own rows" on public.customer_contacts
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on public.customer_contacts to authenticated;

-- ---------------------------------------------------------------------------
-- 3. customer_files  (metadata; bytes live in the 'customer-files' bucket)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_files (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id  uuid not null references public.customers (id) on delete cascade,
  path         text not null,                     -- path in the 'customer-files' bucket
  name         text not null,                     -- original filename for display
  mime         text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

create index if not exists idx_customer_files_customer
  on public.customer_files (customer_id);

alter table public.customer_files enable row level security;

create policy "own rows" on public.customer_files
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on public.customer_files to authenticated;

-- ---------------------------------------------------------------------------
-- 'customer-files' storage bucket: private, per-user folder, docs & images.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-files',
  'customer-files',
  false,
  26214400,  -- 25 MB
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

create policy "customer-files: read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "customer-files: upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'customer-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "customer-files: update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'customer-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "customer-files: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'customer-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
