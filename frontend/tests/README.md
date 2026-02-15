# Tests Automatisés - Application Bourse

Tests end-to-end (E2E) automatisés avec **Playwright**.

## 🎯 Tests couverts

### ✅ 10 scénarios de tests automatisés

1. **Création d'actions** - Ajouter des actions TEST* et vérifier leur affichage
2. **Modification d'actions** - Modifier une action et vérifier la mise à jour
3. **Validation des doublons** - Vérifier qu'on ne peut pas créer deux actions avec le même symbole
4. **Validation des champs vides** - Tester la validation des champs obligatoires
5. **Annulation de modification** - Vérifier le bouton "Annuler"
6. **Suppression d'actions** - Supprimer une action avec confirmation
7. **Conversion en majuscules** - Vérifier que les symboles sont automatiquement en CAPS
8. **Persistance des données** - Vérifier que les données survivent au rechargement
9. **Interface responsive** - Vérifier l'affichage des éléments
10. **Affichage vide** - Vérifier le message quand il n'y a pas d'actions

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
