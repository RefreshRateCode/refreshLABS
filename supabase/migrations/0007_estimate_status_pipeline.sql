-- noalanPRO Ops — Replace the estimate status set with a real quoting pipeline:
--   needs_quote -> in_progress -> sent -> awaiting_approval -> accepted/declined
--   (+ expired)
--
-- Existing rows are mapped: draft -> in_progress (a draft already has content
-- being worked on). sent/accepted/declined keep their meaning.

-- Drop the old default + check so the data migration can run freely.
alter table public.estimates alter column status drop default;
alter table public.estimates drop constraint if exists estimates_status_check;

-- Map legacy values onto the new pipeline.
update public.estimates set status = 'in_progress' where status = 'draft';

-- New constraint + default.
alter table public.estimates
  add constraint estimates_status_check
  check (status in (
    'needs_quote',
    'in_progress',
    'sent',
    'awaiting_approval',
    'accepted',
    'declined',
    'expired'
  ));

alter table public.estimates alter column status set default 'needs_quote';
