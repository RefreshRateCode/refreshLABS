-- noalanPRO Ops — Brand scoping.
--
-- Lets invoices, estimates, expenses, and projects be filtered by the issuing
-- brand/DBA (business_profiles; null = the primary noalanPRO identity).
--   • Add business_profile_id to expenses and projects (invoices/estimates
--     already have it).
--   • Surface business_profile_id on the invoice_summary / estimate_summary
--     views so the list pages can filter server-side.

alter table public.expenses
  add column if not exists business_profile_id uuid
  references public.business_profiles (id) on delete set null;

alter table public.projects
  add column if not exists business_profile_id uuid
  references public.business_profiles (id) on delete set null;

alter table public.bills
  add column if not exists business_profile_id uuid
  references public.business_profiles (id) on delete set null;

alter table public.customers
  add column if not exists business_profile_id uuid
  references public.business_profiles (id) on delete set null;

alter table public.contracts
  add column if not exists business_profile_id uuid
  references public.business_profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- invoice_summary: same as before + business_profile_id
-- ---------------------------------------------------------------------------
create or replace view public.invoice_summary
with (security_invoker = on) as
-- NOTE: business_profile_id is appended LAST. CREATE OR REPLACE VIEW can only
-- add columns at the end of the list — inserting mid-list is read as a rename.
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
    - coalesce(p.amount_paid, 0)                                                    as balance_due,
  i.business_profile_id
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

grant select on public.invoice_summary to authenticated;

-- ---------------------------------------------------------------------------
-- estimate_summary: same as before + business_profile_id
-- ---------------------------------------------------------------------------
create or replace view public.estimate_summary
with (security_invoker = on) as
-- business_profile_id appended LAST (see invoice_summary note above).
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
        * coalesce(e.tax_rate, 0) / 100, 2) as total,
  e.business_profile_id
from public.estimates e
left join (
  select estimate_id, sum(amount) as subtotal
  from public.estimate_line_items
  group by estimate_id
) li on li.estimate_id = e.id;

grant select on public.estimate_summary to authenticated;
