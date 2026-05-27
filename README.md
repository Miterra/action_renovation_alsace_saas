# Action Rénovation Alsace — SaaS interne

Application **PWA Mobile-First** pour la gestion d'**Action Rénovation Alsace**.
Conçue pour être installée sur l'écran d'accueil d'un iPhone et fonctionner comme une app native.

## Stack

- **React 18** + **Vite 5**
- **Tailwind CSS** (charte navy / accent orange alignée avec le site client)
- **Lucide React** pour l'iconographie
- **React Router** pour la navigation
- **react-big-calendar** + **date-fns** (locale FR) pour le planning
- **vite-plugin-pwa** + Workbox pour le Service Worker
- **Supabase** (Postgres + Realtime + Edge Functions) — backend
- **Web Push API native** (VAPID) — notifications iOS/Android sans Firebase
- **Gmail API** (OAuth 2.0) — lecture des mails

## Backend Supabase (déjà opérationnel)

- **Projet** : `action-renovation-alsace` ([dashboard](https://supabase.com/dashboard/project/zajztmzsiadllirdmlvj))
- **URL** : `https://zajztmzsiadllirdmlvj.supabase.co`
- **Region** : Frankfurt (`eu-central-1`)

### Schéma (4 tables)

- `public.appointments` — RDV clients (start_at, end_at, reminder_sent)
- `public.tasks` — to-do (due_at, priority, done, reminder_sent)
- `public.push_subscriptions` — abonnements Web Push (endpoint + clés)
- `private.app_secrets` — clés VAPID privées (RLS strict, accessible uniquement par service_role)

### Edge Function

`send-reminders` est appelée toutes les minutes par `pg_cron` :
1. Cherche les RDV/tâches dont l'échéance est dans les 15 prochaines minutes
2. Envoie un Web Push à chaque navigateur abonné (lib `web-push` côté Deno)
3. Marque `reminder_sent = true` pour éviter les doublons
4. Nettoie automatiquement les subscriptions invalides (410/404)

### Realtime

Les tables `appointments` et `tasks` sont en Realtime → modification sur un device → sync instantanée sur les autres.

## Fonctionnalités

| Onglet | Description |
| --- | --- |
| Tableau de bord | RDV du jour, prochain rendez-vous, tâches en attente, raccourci boîte mail |
| Calendrier & RDV | Vue mois / semaine / jour / agenda, création d'un RDV client (Nom, Adresse, Téléphone, Date, Heure, Notes) |
| Tâches | To-do filtrable (À faire / En retard / Terminées), priorités, rappel automatique 15 min avant |
| Boîte de réception | Connexion OAuth Gmail (`gmail.readonly`) + mock pour la démo |

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs
npm run dev
```

L'app s'ouvre sur [http://localhost:5173](http://localhost:5173). Le Service Worker est actif en dev.

### Production

```bash
npm run build
npm run preview
```

## Variables d'environnement

Voir `.env.example` pour la liste complète. Les valeurs Supabase et VAPID publique sont déjà connues et préremplies. Il reste à configurer :

- `VITE_GOOGLE_CLIENT_ID` + `VITE_GOOGLE_API_KEY` → [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=action-renovation-alsace)

⚠️ **Important** : les clés API/OAuth créées peuvent mettre **jusqu'à plusieurs heures** à être pleinement propagées côté Google avant que la connexion Gmail fonctionne en live.

## Notifications iOS (important)

Depuis iOS 16.4, les Web Push fonctionnent **uniquement** si l'app est installée sur l'écran d'accueil :

1. Ouvrir l'app dans **Safari**
2. Bouton **Partager** → **Sur l'écran d'accueil**
3. Lancer l'app depuis l'icône — elle s'ouvre en mode **standalone**
4. Cliquer sur **Activer notifs** dans la top bar

Le Service Worker (`public/sw.js`) reçoit les événements `push` envoyés par l'Edge Function et affiche la notification même app fermée.

## Structure

```
src/
├── App.jsx              # Routes
├── main.jsx             # Bootstrap + enregistrement SW
├── index.css            # Tailwind + overrides RBC
├── components/          # Layout, Sidebar, TopBar, MobileTabBar
├── pages/               # Dashboard, Calendar, Tasks, Inbox
├── context/AppContext   # State global async (Supabase + localStorage fallback)
└── lib/
    ├── supabase.js      # Client Supabase + détection config
    ├── repository.js    # CRUD RDV + tâches (Supabase ou localStorage)
    ├── notifications.js # Web Push natif (VAPID)
    ├── gmail.js         # OAuth + lecture mails (gapi + GIS)
    └── storage.js       # Wrapper localStorage

public/
├── logo.png             # Logo Action Rénovation Alsace
├── manifest.webmanifest # Manifest PWA
└── sw.js                # Service Worker (push + clic + précaching)

scripts/
└── gen-vapid.cjs        # Régénération de la paire VAPID si besoin
```

## Sécurité

- **Clé VAPID privée** : stockée dans `private.app_secrets` (RLS strict — service_role uniquement). Jamais exposée côté client.
- **Clé Supabase publishable** : conçue pour être exposée côté navigateur, ne contourne pas RLS.
- **Client Secret OAuth Google** : non nécessaire côté front (flow GIS implicit/PKCE), gardé en référence si backend ajouté plus tard.

## Prochaines étapes

- [ ] Ajouter Supabase Auth (login interne) → durcir les policies RLS (remplacer `anon = true` par `auth.uid() = ...`)
- [ ] Domaine de prod → ajouter dans les origines autorisées du Client OAuth + restrictions de la clé API
- [ ] Publier l'app OAuth (passer de "Test" à "Production") pour ne plus avoir l'écran de consentement "App non vérifiée"
- [ ] Splitter le bundle (firebase est out, mais react-big-calendar reste lourd → lazy load possible)
