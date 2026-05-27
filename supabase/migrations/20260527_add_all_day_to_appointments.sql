-- =====================================================================
--  Ajoute la notion "période multi-jours" aux RDV
--  Les RDV deviennent des périodes de chantier qui peuvent s'étaler sur
--  plusieurs jours en mode "toute la journée".
-- =====================================================================
alter table public.appointments
  add column if not exists all_day boolean default true;

-- Les RDV existants de durée < 12h sont considérés comme RDV ponctuels
update public.appointments
set all_day = false
where (end_at - start_at) < interval '12 hours'
  and all_day is null;

-- Par défaut, tout nouveau RDV est une période (chantier)
alter table public.appointments
  alter column all_day set default true;
