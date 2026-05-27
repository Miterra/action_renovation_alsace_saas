-- =====================================================================
--  Planifie l'appel à l'Edge Function send-reminders toutes les minutes
--  via pg_cron + pg_net.
-- =====================================================================
select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://zajztmzsiadllirdmlvj.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
