-- noalanPRO Ops — Estimator: reusable service presets, estimates (one-time
-- quotes and monthly plans), and a computed totals view.

-- ---------------------------------------------------------------------------
-- service_presets: reusable line items with default qty + rate
-- ---------------------------------------------------------------------------
create table if not exists public.service_presets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  description  text,
  unit         text not null default 'hour',   -- hour / item / flat / month
  default_qty  numeric(12, 2) not null default 1,
  default_rate numeric(12, 2) not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_service_presets_updated before update on public.service_presets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- estimates: a quote (one-time) or a recurring plan (monthly)
-- ---------------------------------------------------------------------------
create table if not exists public.estimates (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id          uuid references public.customers (id) on delete set null,
  title                text not null,
  kind                 text not null default 'one_time'
                       check (kind in ('one_time', 'monthly')),
  status               text not null default 'draft'
                       check (status in ('draft', 'sent', 'accepted', 'declined')),
  tax_rate             numeric(6, 3) not null default 0,
  discount_pct         numeric(6, 3) not null default 0,
  notes                text,
  converted_invoice_id uuid references public.invoices (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_estimates_updated before update on public.estimates
  for each row execute function public.set_updated_at();

create table if not exists public.estimate_line_items (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  estimate_id  uuid not null references public.estimates (id) on delete cascade,
  description  text not null,
  quantity     numeric(12, 2) not null default 1,
  unit_price   numeric(12, 2) not null default 0,
  amount       numeric(14, 2) generated always as (quantity * unit_price) stored,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_estimates_customer  on public.estimates (customer_id);
create index if not exists idx_estimates_kind       on public.estimates (kind);
create index if not exists idx_est_items_estimate   on public.estimate_line_items (estimate_id);

-- ---------------------------------------------------------------------------
-- estimate_summary: subtotal / discount / tax / total
-- ---------------------------------------------------------------------------
create or replace view public.estimate_summary
with (security_invoker = on) as
select
  e.id,
  e.owner_id,
  e.customer_id,
  e.title,
  e.kind,
  e.status,
  e.tax_rate,
  e.discount_pct,
  e.notes,
  e.converted_invoice_id,
  e.created_at,
  coalesce(li.subtotal, 0) as subtotal,
  round(coalesce(li.subtotal, 0) * coalesce(e.discount_pct, 0) / 100, 2) as discount_amount,
  coalesce(li.subtotal, 0)
    - round(coalesce(li.subtotal, 0) * coalesce(e.discount_pct, 0) / 100, 2) as net,
  round(
    (coalesce(li.subtotal, 0)
      - round(coalesce(li.subtotal, 0) * coalesce(e.discount_pct, 0) / 100, 2))
    * coalesce(e.tax_rate, 0) / 100, 2) as tax_amount,
  (coalesce(li.subtotal, 0)
    - round(coalesce(li.subtotal, 0) * coalesce(e.discount_pct, 0) / 100, 2))
    + round(
        (coalesce(li.subtotal, 0)
          - round(coalesce(li.subtotal, 0) * coalesce(e.discount_pct, 0) / 100, 2))
        * coalesce(e.tax_rate, 0) / 100, 2) as total
from public.estimates e
left join (
  select estimate_id, sum(amount) as subtotal
  from public.estimate_line_items
  group by estimate_id
) li on li.estimate_id = e.id;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.service_presets     enable row level security;
alter table public.estimates           enable row level security;
alter table public.estimate_line_items enable row level security;

create policy "own rows" on public.service_presets
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own rows" on public.estimates
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own rows" on public.estimate_line_items
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on
  public.service_presets,
  public.estimates,
  public.estimate_line_items
to authenticated;

grant select on public.estimate_summary to authenticated;
