-- noalanPRO Ops — Per-line discounts on estimate line items.
--
-- Each line can carry its own discount %. The generated `amount` now reflects
-- it (quantity * unit_price * (1 - discount_pct/100)), so the summary view,
-- customer view, and PDF all stay exact. The app enforces that a line discount
-- and the estimate-level discount are mutually exclusive.
--
-- `amount` is a generated column, so its expression can't be altered in place:
-- drop the dependent view, drop+re-add the column, then recreate the view.

drop view if exists public.estimate_summary;

alter table public.estimate_line_items
  add column if not exists discount_pct numeric(6, 3) not null default 0;
alter table public.estimate_line_items
  add constraint estimate_line_items_discount_pct_check
  check (discount_pct >= 0 and discount_pct <= 100);

alter table public.estimate_line_items drop column amount;
alter table public.estimate_line_items
  add column amount numeric(14, 2)
  generated always as (round(quantity * unit_price * (1 - discount_pct / 100), 2)) stored;

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

grant select on public.estimate_summary to authenticated;
