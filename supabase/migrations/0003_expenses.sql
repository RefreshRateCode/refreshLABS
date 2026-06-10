-- noalanPRO Ops — Expenses (money already spent), distinct from Bills (owed).
-- Supports payment method, customer/project attribution, a tax-deductible
-- flag, and a stored receipt image/PDF.

create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expense_date    date not null default current_date,
  merchant        text not null,                    -- who you paid
  category        text,                             -- QB chart-of-accounts category
  amount          numeric(14, 2) not null check (amount >= 0),
  payment_method  text,                             -- cash / card / check / ach / ...
  customer_id     uuid references public.customers (id) on delete set null,
  project_id      uuid references public.projects (id) on delete set null,
  tax_deductible  boolean not null default false,
  tax_category    text,
  receipt_path    text,                             -- path in the 'receipts' storage bucket
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_expenses_updated before update on public.expenses
  for each row execute function public.set_updated_at();

create index if not exists idx_expenses_customer on public.expenses (customer_id);
create index if not exists idx_expenses_project  on public.expenses (project_id);
create index if not exists idx_expenses_date     on public.expenses (expense_date);

alter table public.expenses enable row level security;

create policy "own rows" on public.expenses
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on public.expenses to authenticated;

-- ---------------------------------------------------------------------------
-- Receipt storage: a private bucket, with each user confined to a folder
-- named after their user id (files are stored as "<uid>/<file>").
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts: read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receipts: upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receipts: update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receipts: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
