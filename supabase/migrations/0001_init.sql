-- noalanPRO Ops — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Every table is owner-scoped and protected by Row Level Security so that
-- a signed-in user can only ever see/modify their own rows. Field names are
-- chosen to map cleanly onto QuickBooks import columns for a later export step.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Auto-maintain updated_at on row updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name  text not null,                 -- QB: "Customer"
  company       text,
  email         text,
  phone         text,
  -- Billing address (kept as discrete fields for QB import)
  bill_line1    text,
  bill_line2    text,
  bill_city     text,
  bill_state    text,
  bill_postal   text,
  bill_country  text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- projects (optional grouping to "keep tabs on" ongoing work)
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  name        text not null,
  status      text not null default 'active'
              check (status in ('active', 'on_hold', 'done', 'cancelled')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id     uuid not null references public.customers (id) on delete restrict,
  project_id      uuid references public.projects (id) on delete set null,
  invoice_number  text not null,               -- QB: "Invoice No"
  status          text not null default 'draft'
                  check (status in ('draft', 'sent', 'partial', 'paid', 'overdue', 'void')),
  issue_date      date not null default current_date,
  due_date        date,
  tax_rate        numeric(6, 3) not null default 0,   -- percent, e.g. 8.250
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, invoice_number)
);

-- ---------------------------------------------------------------------------
-- invoice_line_items  (amount is auto-computed from qty * unit_price)
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_line_items (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  description  text not null,
  quantity     numeric(12, 2) not null default 1,
  unit_price   numeric(12, 2) not null default 0,
  amount       numeric(14, 2) generated always as (quantity * unit_price) stored,
  position     integer not null default 0,     -- display order
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- payments  (money received against an invoice)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  customer_id  uuid references public.customers (id) on delete set null,
  amount       numeric(14, 2) not null check (amount >= 0),
  paid_on      date not null default current_date,
  method       text,                            -- cash / check / card / ach / zelle / venmo / other
  reference    text,                            -- check #, txn id, etc.
  notes        text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- bills  (your own business expenses / bills to pay)
-- ---------------------------------------------------------------------------
create table if not exists public.bills (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vendor       text not null,
  category     text,                            -- QB chart-of-accounts category
  amount       numeric(14, 2) not null check (amount >= 0),
  bill_date    date not null default current_date,
  due_date     date,
  status       text not null default 'unpaid'
               check (status in ('unpaid', 'paid')),
  paid_on      date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger trg_bills_updated before update on public.bills
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes (foreign keys + common lookups)
-- ---------------------------------------------------------------------------
create index if not exists idx_projects_customer    on public.projects (customer_id);
create index if not exists idx_invoices_customer     on public.invoices (customer_id);
create index if not exists idx_invoices_project      on public.invoices (project_id);
create index if not exists idx_invoices_status       on public.invoices (status);
create index if not exists idx_line_items_invoice    on public.invoice_line_items (invoice_id);
create index if not exists idx_payments_invoice      on public.payments (invoice_id);
create index if not exists idx_payments_customer     on public.payments (customer_id);
create index if not exists idx_bills_status          on public.bills (status);

-- ---------------------------------------------------------------------------
-- invoice_summary view  (live subtotal / tax / total / paid / balance)
-- security_invoker = on  ->  the querying user's RLS still applies.
-- ---------------------------------------------------------------------------
create or replace view public.invoice_summary
with (security_invoker = on) as
select
  i.id,
  i.owner_id,
  i.customer_id,
  i.project_id,
  i.invoice_number,
  i.status,
  i.issue_date,
  i.due_date,
  i.tax_rate,
  i.notes,
  i.created_at,
  coalesce(li.subtotal, 0)                                                          as subtotal,
  round(coalesce(li.subtotal, 0) * coalesce(i.tax_rate, 0) / 100, 2)               as tax_amount,
  coalesce(li.subtotal, 0)
    + round(coalesce(li.subtotal, 0) * coalesce(i.tax_rate, 0) / 100, 2)           as total,
  coalesce(p.amount_paid, 0)                                                        as amount_paid,
  (coalesce(li.subtotal, 0)
    + round(coalesce(li.subtotal, 0) * coalesce(i.tax_rate, 0) / 100, 2))
    - coalesce(p.amount_paid, 0)                                                    as balance_due
from public.invoices i
left join (
  select invoice_id, sum(amount) as subtotal
  from public.invoice_line_items
  group by invoice_id
) li on li.invoice_id = i.id
left join (
  select invoice_id, sum(amount) as amount_paid
  from public.payments
  group by invoice_id
) p on p.invoice_id = i.id;

-- ---------------------------------------------------------------------------
-- Row Level Security: every row is private to its owner.
-- ---------------------------------------------------------------------------
alter table public.customers          enable row level security;
alter table public.projects           enable row level security;
alter table public.invoices           enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.payments           enable row level security;
alter table public.bills              enable row level security;

create policy "own rows" on public.customers
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own rows" on public.projects
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own rows" on public.invoices
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own rows" on public.invoice_line_items
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own rows" on public.payments
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own rows" on public.bills
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- API grants (RLS still gates which rows are visible)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on
  public.customers,
  public.projects,
  public.invoices,
  public.invoice_line_items,
  public.payments,
  public.bills
to authenticated;

grant select on public.invoice_summary to authenticated;
