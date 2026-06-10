-- noalanPRO Ops — invoice defaults (payment terms + standing notes) and a link
-- from generated invoices back to the monthly plan they came from.

alter table public.app_settings
  add column if not exists default_payment_terms_days integer not null default 0,
  add column if not exists default_invoice_notes text;

alter table public.invoices
  add column if not exists source_estimate_id uuid
    references public.estimates (id) on delete set null;

create index if not exists idx_invoices_source_estimate
  on public.invoices (source_estimate_id);
