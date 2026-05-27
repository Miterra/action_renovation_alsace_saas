-- =====================================================================
--  Action Rénovation Alsace — SaaS interne
--  Migration initiale : tables RDV, tâches, push subscriptions
-- =====================================================================

-- ----- appointments (RDV clients) -----
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_name   text        not null,
  address       text        default '',
  phone         text        default '',
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  notes         text        default '',
  reminder_sent boolean     default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_appointments_start_at on public.appointments(start_at);

-- ----- tasks (to-do) -----
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title         text        not null,
  description   text        default '',
  due_at        timestamptz not null,
  priority      text        default 'medium' check (priority in ('low','medium','high')),
  done          boolean     default false,
  reminder_sent boolean     default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_tasks_due_at on public.tasks(due_at) where done = false;

-- ----- push_subscriptions (Web Push VAPID) -----
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint      text        not null unique,
  p256dh        text        not null,
  auth          text        not null,
  user_agent    text        default '',
  device_label  text        default '',
  created_at    timestamptz default now(),
  last_used_at  timestamptz default now()
);

-- ----- Trigger updated_at -----
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ----- RLS (app interne mono-utilisateur, à durcir avec Supabase Auth) -----
alter table public.appointments        enable row level security;
alter table public.tasks               enable row level security;
alter table public.push_subscriptions  enable row level security;

create policy "anon full access appointments"
  on public.appointments for all to anon
  using (true) with check (true);

create policy "anon full access tasks"
  on public.tasks for all to anon
  using (true) with check (true);

create policy "anon full access push_subscriptions"
  on public.push_subscriptions for all to anon
  using (true) with check (true);

-- ----- Realtime -----
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.tasks;
