-- noalanPRO Ops — Seed service presets matching the website's Services page
-- (noalanpro.com/services). Prices are the published "starting" rates, used as
-- editable defaults when the preset is added to an estimate.
--
-- Seeds for every existing user and is idempotent (skips presets that already
-- exist by name for that owner), so it is safe to re-run.

insert into public.service_presets (owner_id, name, description, unit, default_qty, default_rate)
select u.id, p.name, p.description, p.unit, 1, p.rate
from auth.users u
cross join (values
  ('Software Development',
   'Custom application development, API integration, database design, 3 months support',
   'flat', 5000),
  ('Web Development Setup',
   'Responsive website design, SEO optimization, mobile optimization, 2 months support',
   'flat', 2500),
  ('Website Maintenance',
   'Ongoing monthly website maintenance',
   'month', 200),
  ('Graphic Design',
   'Logo design, brand identity, marketing materials, 3 revision rounds',
   'flat', 500),
  ('Cloud Services',
   'Cloud hosting & deployment, server management, automated backups, 24/7 monitoring',
   'month', 300),
  ('Gaming PC Build',
   'Custom gaming PC build, premium component selection, OS installation & setup, 1-year craftsmanship warranty',
   'flat', 1200),
  ('Workstation System',
   'Professional-grade hardware, optimized for creative workflows, software configuration, 1-year craftsmanship warranty',
   'flat', 2000)
) as p(name, description, unit, rate)
where not exists (
  select 1 from public.service_presets sp
  where sp.owner_id = u.id and sp.name = p.name
);
