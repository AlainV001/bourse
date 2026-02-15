# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Vue d'ensemble du projet

Application web de gestion d'actions boursières avec une architecture frontend/backend séparée.

**Objectif actuel** : Gérer une liste d'actions (CRUD) avec affichage des cours en temps réel via Yahoo Finance.

## Stack technique

### Frontend
- **React 19** avec **TypeScript**
- **Vite** comme build tool
- **TailwindCSS** pour le styling
- Port par défaut : `5173` (dev)

### Backend
- **Node.js** avec **Express 5** et **TypeScript**
- **SQLite** (better-sqlite3) pour la persistance
- **yahoo-finance2** pour les cours boursiers en temps réel
- **CORS** activé pour les requêtes cross-origin
- Port par défaut : `3000`

### Base de données
- SQLite avec une table `stocks` :
  - `id` : INTEGER PRIMARY KEY AUTOINCREMENT
  - `symbol` : TEXT NOT NULL UNIQUE (symbole boursier en majuscules)
  - `created_at` : DATETIME DEFAULT CURRENT_TIMESTAMP

## Structure du projet

```
Bourse/
├── frontend/                 # Application React
│   ├── src/
│   │   ├── App.tsx          # Composant principal avec gestion CRUD + cours
│   │   ├── index.css        # Styles TailwindCSS
│   │   └── main.tsx         # Point d'entrée
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── backend/                  # API Express
│   ├── src/
│   │   ├── index.ts         # Serveur Express principal
│   │   ├── routes/
│   │   │   └── stocks.ts    # Routes CRUD + endpoint /quotes
│   │   ├── database/
│   │   │   └── db.ts        # Initialisation SQLite + migrations
│   │   └── types/
│   │       └── stock.ts     # Interface TypeScript Stock
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                 # Configuration (PORT=3000)
│
└── database/                 # Données SQLite (stocks.db généré au runtime)
```

## Commandes de développement

### Frontend

```bash
cd frontend
npm install              # Installer les dépendances
npm run dev             # Démarrer le serveur de dev (http://localhost:5173)
npm run build           # Build pour production
npm run preview         # Prévisualiser le build de production
```

### Backend

```bash
cd backend
npm install              # Installer les dépendances
npm run dev             # Démarrer le serveur avec hot-reload (http://localhost:3000)
npm run build           # Compiler TypeScript vers JavaScript
npm start               # Démarrer le serveur en production (nécessite build)
```

### Démarrage complet

Pour lancer l'application complète, ouvrir **2 terminaux** :

**Terminal 1 (Backend)** :
```bash
cd backend && npm run dev
```

**Terminal 2 (Frontend)** :
```bash
cd frontend && npm run dev
```

L'application sera accessible sur `http://localhost:5173`

## API REST

Base URL : `http://localhost:3000/api`

### Endpoints disponibles

- `GET /api/stocks` - Récupérer toutes les actions
- `GET /api/stocks/quotes` - Récupérer les cours de toutes les actions (via Yahoo Finance)
- `GET /api/stocks/:id` - Récupérer une action par ID
- `POST /api/stocks` - Créer une nouvelle action
  - Body : `{ "symbol": "AAPL" }`
- `PUT /api/stocks/:id` - Mettre à jour une action
  - Body : `{ "symbol": "AAPL" }`
- `DELETE /api/stocks/:id` - Supprimer une action
- `GET /api/health` - Health check de l'API

### Exemples de réponses

**GET /api/stocks**
```json
[
  {
    "id": 1,
    "symbol": "AAPL",
    "created_at": "2026-02-15 16:30:00"
  }
]
```

**POST /api/stocks**
```json
{
  "id": 2,
  "symbol": "GOOGL",
  "created_at": "2026-02-15 16:35:00"
}
```

**GET /api/stocks/quotes**
```json
{
  "AAPL": {
    "price": 255.78,
    "currency": "USD",
    "change": -5.95,
    "changePercent": -2.27
  },
  "GOOGL": null
}
```

## Architecture et patterns

### Frontend (App.tsx)
- **State management** : useState hooks pour l'état local
- **Fetching** : Fetch API native (pas de bibliothèque externe pour le moment)
- **Formulaire** : Champ symbole uniquement, gère création et modification (état `editingId`)
- **Cours en temps réel** : Rafraîchissement automatique toutes les 60 secondes + bouton "Rafraîchir les cours"
- **Affichage des cours** : Prix formaté avec devise, variation en vert (hausse) / rouge (baisse)
- **UI** : Interface responsive avec TailwindCSS

### Backend
- **Routes RESTful** : Organisation par ressource dans `src/routes/`
- **Base de données** : Connexion SQLite synchrone avec better-sqlite3
- **Yahoo Finance** : `yahoo-finance2` chargé en lazy (require dans le handler) pour compatibilité avec tsx/CJS
- **Validation** : Validation basique des champs requis
- **Gestion d'erreurs** :
  - 400 : Mauvaise requête (champs manquants)
  - 404 : Ressource non trouvée
  - 409 : Conflit (symbole déjà existant)
  - 500 : Erreur serveur

### Conventions de code
- **TypeScript strict mode** activé sur frontend et backend
- **Symboles boursiers** : Toujours en MAJUSCULES (conversion automatique)
- **Interface Stock** : Définie dans `backend/src/types/stock.ts` (id, symbol, created_at)
- **Nommage** : camelCase pour variables/fonctions, PascalCase pour composants/types

### Notes techniques
- **yahoo-finance2 v3** : Nécessite `new YahooFinance()` (instanciation). L'import ESM ne fonctionne pas avec tsx en mode CJS, utiliser `require('yahoo-finance2').default` à la place.
- **Express 5** : La route `/quotes` doit être déclarée **avant** `/:id` dans le router pour éviter que le paramètre `:id` ne capture "quotes".
- **Redémarrage backend** : Bien vérifier qu'aucun ancien processus ne reste accroché au port 3000 (`netstat -ano | grep 3000`).

## Tests automatisés

### Framework de test
- **Playwright** pour les tests E2E (end-to-end)
- Tests situés dans `frontend/tests/`
- Configuration dans `frontend/playwright.config.ts`

### Lancer les tests

**Prérequis** : Backend et frontend doivent être démarrés

```bash
cd frontend

# Lancer tous les tests (mode headless)
npm test

# Interface UI interactive (recommandé pour développement)
npm run test:ui

# Mode visible pour voir les tests s'exécuter
npm run test:headed

# Voir le rapport des derniers tests
npm run test:report
```

### Tests couverts

Les tests automatisés couvrent :
- ✅ Création d'actions (avec symboles TEST*)
- ✅ Modification d'actions
- ✅ Suppression d'actions
- ✅ Validation des doublons (symbole unique)
- ✅ Validation des champs obligatoires
- ✅ Annulation de modification
- ✅ Conversion automatique en majuscules
- ✅ Persistance des données (rechargement page)
- ✅ Interface responsive
- ✅ Affichage état vide

### Notes sur les tests
- Les tests nettoient automatiquement les actions TEST* avant chaque exécution
- Les rapports HTML sont générés automatiquement dans `frontend/playwright-report/`
- Pour plus de détails, voir `frontend/tests/README.md`

## Évolutions futures prévues

L'architecture permet d'ajouter facilement :
- Écrans personnalisables (widgets drag & drop)
- Graphiques et visualisations
- Alertes de prix
- Authentification utilisateur
- Watchlists multiples

## Notes importantes

- Le fichier de base de données `database/stocks.db` est créé automatiquement au premier lancement du backend
- La migration dans `db.ts` supprime automatiquement la colonne `name` si elle existe (migration one-shot)
- Le backend doit être démarré **avant** le frontend pour que l'API soit disponible
- CORS est configuré pour accepter toutes les origines en développement
- Les symboles boursiers sont stockés en majuscules pour garantir l'unicité
