-- =====================================================================
--  Ajoute reminder_at aux RDV (rappel à une date/heure spécifique)
--  Par défaut : veille à 20h (heure Europe/Paris)
--  Triggers : reset reminder_sent à false si la date du rappel change
-- =====================================================================

alter table public.appointments
  add column if not exists reminder_at timestamptz;

-- Initialisation : pour les RDV existants, calcul du rappel = veille 20h Paris
update public.appointments
set reminder_at = (
  date_trunc('day', start_at at time zone 'Europe/Paris')
    - interval '1 day'
    + interval '20 hours'
) at time zone 'Europe/Paris'
where reminder_at is null;

create index if not exists idx_appointments_reminder_at
  on public.appointments(reminder_at)
  where reminder_sent = false;

-- Trigger : reset reminder_sent quand start_at ou reminder_at change
create or replace function public.reset_reminder_sent_appointments()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.reminder_at is distinct from old.reminder_at
     or new.start_at is distinct from old.start_at then
    new.reminder_sent = false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reset_reminder_appointments on public.appointments;
create trigger trg_reset_reminder_appointments
  before update on public.appointments
  for each row execute function public.reset_reminder_sent_appointments();

-- Pareil pour tasks : reset reminder_sent si due_at change
create or replace function public.reset_reminder_sent_tasks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.due_at is distinct from old.due_at then
    new.reminder_sent = false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reset_reminder_tasks on public.tasks;
create trigger trg_reset_reminder_tasks
  before update on public.tasks
  for each row execute function public.reset_reminder_sent_tasks();
