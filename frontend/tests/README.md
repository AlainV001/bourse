# Tests Automatisés - Application Bourse

Tests end-to-end (E2E) automatisés avec **Playwright**.

## 🎯 Tests couverts

### ✅ 40 scénarios de tests automatisés

**Modale d'ajout (Tests 1-5)**
1. Ouverture et fermeture de la modale d'ajout (X, Annuler, backdrop)
2. Création de plusieurs actions via la modale
3. Validation des doublons (symbole unique)
4. Validation du champ vide
5. Conversion automatique en majuscules

**Suppression / Persistance (Tests 6-7)**
6. Suppression d'actions avec confirmation
7. Persistance des données après rechargement

**Interface générale (Tests 8-9)**
8. État vide, boutons présents/absents
9. Colonnes du tableau (Symbole, Cours, Actions)

**Cours en temps réel (Tests 10-15)**
10. Affichage des cours pour un symbole réel (mock)
11. Affichage N/A pour un symbole inexistant
12. Bouton Rafraîchir les cours (icône)
13. Affichage de la date du dernier refresh
14. API /quotes — structure de la réponse
15. API /quotes — dailyTrend après plusieurs refreshs

**Historique intraday (Tests 16-19)**
16. Bouton Historique visible par action
17. Ouverture/fermeture du panneau intraday
18. Affichage des séquences de tendance
19. API /quotes/history/:symbol — structure

**Badge tendance (Tests 20-21)**
20. Pas de badge sans historique suffisant
21. Badge absent pour un symbole inexistant

**Historique journalier (Tests 22-27)**
22. Bouton Historique J visible par action
23. Ouverture/fermeture du panneau journalier
24. API /daily-history/:symbol — structure
25. Données affichées pour un symbole réel
26. Un seul panneau ouvert à la fois
27. Prix d'ouverture = premier point du jour

**News / Étoile / Filtres (Tests 28-30)**
28. Bouton News visible et lien correct
29a. Étoile visible sur chaque ligne
29b. Clic étoile bascule le statut important
29c. Filtre étoile n'affiche que les importantes
30a. Filtre EUR n'affiche que les actions en euros
30b. Filtre USD n'affiche que les actions en dollars

**État vide (Test 31)**
31. Message d'état vide quand aucune action

**Modale Statistiques (Tests 32-35)**
32. Bouton Statistiques visible par action
33. Ouverture/fermeture de la modale (backdrop et bouton X)
34. Contenu : MA5/MA20/MA50, badges Au-dessus/En-dessous, Plus haut/bas, note de données
35. API /stats/:symbol — structure et valeurs nulles sans historique

**Modale Recommandations (Tests 36-40)**
36. Bouton Recommandations visible quand des actions existent
37. Ouverture/fermeture de la modale (backdrop et bouton X)
38. Contenu : bandeau de synthèse, tableau avec signal et MA recommandée
39. API /recommendations — structure et signal `insufficient` sans historique
40. La modale suit le filtre actif de la liste principale (EUR/USD/importantes)

## 🚀 Lancer les tests

### Prérequis

Les serveurs **backend** et **frontend** doivent être démarrés :

**Terminal 1 - Backend** :
```bash
cd backend && npm run dev
```

**Terminal 2 - Frontend** :
```bash
cd frontend && npm run dev
```

### Commandes de test

**Terminal 3 - Tests** :

```bash
cd frontend

# Lancer tous les tests (mode headless)
npm test

# Lancer les tests avec interface UI interactive
npm run test:ui

# Lancer les tests en mode visible (headed)
npm run test:headed

# Voir le rapport des derniers tests
npm run test:report
```

## 📊 Modes de test

### Mode Headless (par défaut)
```bash
npm test
```
- Rapide, idéal pour CI/CD
- Lance les tests en arrière-plan
- Affiche les résultats dans le terminal

### Mode UI Interactive
```bash
npm run test:ui
```
- Interface graphique interactive
- Permet de voir les tests s'exécuter
- Débogage facilité avec timeline et traces

### Mode Headed
```bash
npm run test:headed
```
- Ouvre un navigateur visible
- Voir les tests en temps réel
- Utile pour déboguer

## 📁 Structure des tests

```
frontend/tests/
├── README.md           # Ce fichier
└── stocks.spec.ts      # Tests des fonctionnalités actions
```

## 🔧 Configuration

La configuration se trouve dans `playwright.config.ts` :
- **baseURL** : http://localhost:5174
- **Navigateur** : Chromium
- **Reporter** : HTML (rapport généré automatiquement)

## 🧹 Nettoyage automatique

Les tests nettoient automatiquement les actions TEST* avant chaque suite de tests pour garantir l'isolation et la reproductibilité.

## 📝 Ajouter de nouveaux tests

Pour ajouter des tests, éditez `tests/stocks.spec.ts` :

```typescript
test('Mon nouveau test', async ({ page }) => {
  await page.goto('/');
  // Vos assertions ici
  await expect(page.getByText('...')).toBeVisible();
});
```

## 🐛 Débogage

Si un test échoue :
1. Lancer avec `npm run test:ui` pour voir visuellement
2. Consulter le rapport : `npm run test:report`
3. Vérifier la console du navigateur
4. Vérifier que les serveurs backend/frontend sont actifs

## 📚 Documentation

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-test)
