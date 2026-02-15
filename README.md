# Application de Gestion d'Actions Boursières

Application web simple pour gérer une liste d'actions boursières.

## Fonctionnalités

- ✅ Ajouter une action (symbole + nom)
- ✅ Afficher la liste des actions
- ✅ Modifier une action
- ✅ Supprimer une action

## Technologies

- **Frontend** : React + TypeScript + Vite + TailwindCSS
- **Backend** : Node.js + Express + TypeScript
- **Base de données** : SQLite

## Installation

### 1. Installer les dépendances

**Frontend** :
```bash
cd frontend
npm install
```

**Backend** :
```bash
cd backend
npm install
```

### 2. Démarrer l'application

Ouvrir **2 terminaux** :

**Terminal 1 - Backend** :
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend** :
```bash
cd frontend
npm run dev
```

L'application sera accessible sur **http://localhost:5173**

## Structure du projet

```
Bourse/
├── frontend/     # Application React
├── backend/      # API Express
├── database/     # Fichiers SQLite (générés automatiquement)
└── CLAUDE.md     # Documentation pour Claude Code
```

## API

- `GET /api/stocks` - Liste toutes les actions
- `POST /api/stocks` - Créer une action
- `PUT /api/stocks/:id` - Modifier une action
- `DELETE /api/stocks/:id` - Supprimer une action

Voir [CLAUDE.md](CLAUDE.md) pour plus de détails.
