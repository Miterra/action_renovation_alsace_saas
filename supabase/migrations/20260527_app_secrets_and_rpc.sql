-- =====================================================================
--  Stockage sécurisé des clés VAPID + RPC d'exposition au service_role
--
--  Le schéma `private` n'est pas exposé par PostgREST, donc on ne peut
--  pas lire la table directement depuis l'Edge Function. On passe par
--  une fonction RPC SECURITY DEFINER qui retourne uniquement les 3 clés.
-- =====================================================================

create schema if not exists private;

create table if not exists private.app_secrets (
  key   text primary key,
  value text not null
);

-- RLS strict (aucune policy → seul service_role bypass)
alter table private.app_secrets enable row level security;

-- Fonction RPC pour lire les secrets depuis l'Edge Function
create or replace function public.get_vapid_config()
returns table (key text, value text)
language sql
security definer
set search_path = ''
as $$
  select key, value
  from private.app_secrets
  where key in ('vapid_public', 'vapid_private', 'vapid_subject');
$$;

-- N'autoriser que service_role à appeler cette fonction
revoke all on function public.get_vapid_config() from public;
revoke all on function public.get_vapid_config() from anon;
revoke all on function public.get_vapid_config() from authenticated;
grant execute on function public.get_vapid_config() to service_role;

-- Les 3 valeurs VAPID doivent être insérées manuellement (jamais commit) :
-- insert into private.app_secrets (key, value) values
--   ('vapid_public',  '<clé publique base64url>'),
--   ('vapid_private', '<clé privée base64url>'),
--   ('vapid_subject', 'mailto:contact@example.com');
