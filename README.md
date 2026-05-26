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
- **Firebase** (Firestore + Cloud Messaging) — préparé via variables d'env
- **Gmail API** (OAuth 2.0) — UI prête + mock en mode démo

## Fonctionnalités

| Onglet | Description |
| --- | --- |
| Tableau de bord | RDV du jour, prochain rendez-vous, tâches en attente, raccourci boîte mail |
| Calendrier & RDV | Vue mois / semaine / jour / agenda, création d'un RDV client (Nom, Adresse, Téléphone, Date, Heure, Notes) |
| Tâches | To-do filtrable (À faire / En retard / Terminées), priorités, rappel local 15 min avant |
| Boîte de réception | Connexion OAuth Gmail (`gmail.readonly`) + mock pour la démo |

## Démarrage

```bash
npm install
npm run dev
```

L'app s'ouvre sur [http://localhost:5173](http://localhost:5173). En mode dev le Service Worker est actif.

### Production

```bash
npm run build
npm run preview
```

## Variables d'environnement

Copie `.env.example` en `.env.local` puis renseigne :

- **Firebase** : `VITE_FIREBASE_*` + `VITE_FIREBASE_VAPID_KEY` (Cloud Messaging > Paramètres)
- **Google Gmail** : `VITE_GOOGLE_CLIENT_ID` + `VITE_GOOGLE_API_KEY` (Google Cloud Console — activer **Gmail API**)

Sans ces clés, l'app fonctionne en **mode démo** (données simulées + messages d'aide).

## Notifications iOS (important)

Depuis iOS 16.4, les Web Push fonctionnent **uniquement** si l'app est installée sur l'écran d'accueil :

1. Ouvrir l'app dans **Safari**
2. Bouton **Partager** → **Sur l'écran d'accueil**
3. Lancer l'app depuis l'icône — elle s'ouvre en mode **standalone**
4. Cliquer sur **Activer notifs** dans la top bar

Le Service Worker (`public/sw.js`) reçoit les événements `push` côté FCM et affiche la notification même app fermée.

## Structure

```
src/
├── App.jsx              # Routes
├── main.jsx             # Bootstrap + enregistrement SW
├── index.css            # Tailwind + overrides RBC
├── components/          # Layout, Sidebar, TopBar, MobileTabBar
├── pages/               # Dashboard, Calendar, Tasks, Inbox
├── context/AppContext   # State global (RDV + tâches) avec persistance localStorage
└── lib/
    ├── firebase.js      # Init Firebase + Messaging
    ├── notifications.js # Permission + token FCM + rappels locaux
    ├── gmail.js         # OAuth + lecture mails (gapi + GIS)
    └── storage.js       # Wrapper localStorage

public/
├── logo.png             # Logo Action Rénovation Alsace
├── manifest.webmanifest # Manifest PWA
└── sw.js                # Service Worker (push + clic + précaching)
```

## Prochaines étapes

- [ ] Migration du state `localStorage` → Firestore pour la synchronisation multi-device
- [ ] Cloud Function planifiée pour envoyer un push FCM aux rappels de tâche / RDV
- [ ] Connexion réelle Gmail OAuth (clés Google Cloud)
- [ ] Authentification interne (Firebase Auth) pour ouvrir le SaaS aux collaborateurs
