import { test, expect } from '@playwright/test';

// URL de base de l'API
const API_URL = 'http://localhost:3000/api/stocks';

// Helper pour nettoyer les actions de test avant chaque suite
test.beforeEach(async ({ request }) => {
  // Récupérer toutes les actions
  const response = await request.get(API_URL);
  const stocks = await response.json();

  // Supprimer toutes les actions TEST*
  for (const stock of stocks) {
    if (stock.symbol.startsWith('TEST')) {
      await request.delete(`${API_URL}/${stock.id}`);
    }
  }
});

test.describe('Tests d\'interface - Gestion des actions boursières', () => {

  test('Test 1: Création d\'actions de test', async ({ page }) => {
    await page.goto('/');

    // Vérifier que la page est chargée
    await expect(page.getByRole('heading', { name: 'Gestion des Actions Boursières' })).toBeVisible();

    // Créer TEST1
    await page.getByPlaceholder('AAPL').fill('TEST1');
    await page.getByPlaceholder('Apple Inc.').fill('Test Company One');

    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Vérifier que TEST1 apparaît dans le tableau
    await expect(page.locator('td', { hasText: 'TEST1' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('td', { hasText: 'Test Company One' })).toBeVisible();

    // Créer TEST2
    await page.getByPlaceholder('AAPL').fill('TEST2');
    await page.getByPlaceholder('Apple Inc.').fill('Test Company Two');

    const response2 = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await response2;

    // Vérifier que TEST2 apparaît
    await expect(page.locator('td', { hasText: 'TEST2' }).first()).toBeVisible();

    // Créer TESTAPI
    await page.getByPlaceholder('AAPL').fill('TESTAPI');
    await page.getByPlaceholder('Apple Inc.').fill('Test API Integration');

    const response3 = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await response3;

    // Vérifier que TESTAPI apparaît
    await expect(page.locator('td', { hasText: 'TESTAPI' }).first()).toBeVisible();

    // Vérifier que le formulaire se vide après ajout
    await expect(page.getByPlaceholder('AAPL')).toHaveValue('');
    await expect(page.getByPlaceholder('Apple Inc.')).toHaveValue('');
  });

  test('Test 2: Modification d\'une action', async ({ page }) => {
    // Créer d'abord une action
    await page.goto('/');
    await page.getByPlaceholder('AAPL').fill('TEST1');
    await page.getByPlaceholder('Apple Inc.').fill('Test Company One');

    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Attendre que l'action soit créée
    await expect(page.locator('td', { hasText: 'TEST1' }).first()).toBeVisible({ timeout: 10000 });

    // Cliquer sur Modifier
    await page.getByRole('row', { name: /TEST1/ }).getByRole('button', { name: 'Modifier' }).click();

    // Vérifier que le formulaire se remplit
    await expect(page.getByPlaceholder('AAPL')).toHaveValue('TEST1');
    await expect(page.getByPlaceholder('Apple Inc.')).toHaveValue('Test Company One');

    // Vérifier que le bouton est "Mettre à jour"
    await expect(page.getByRole('button', { name: 'Mettre à jour' })).toBeVisible();

    // Modifier le nom
    await page.getByPlaceholder('Apple Inc.').fill('Test Company One - UPDATED');

    await page.getByRole('button', { name: 'Mettre à jour' }).click();

    // Vérifier que la modification est visible
    await expect(page.locator('td', { hasText: 'Test Company One - UPDATED' })).toBeVisible({ timeout: 10000 });

    // Vérifier que le formulaire est revenu en mode "Ajouter"
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeVisible();
  });

  test('Test 3: Validation des doublons', async ({ page }) => {
    await page.goto('/');

    // Créer TEST1
    await page.getByPlaceholder('AAPL').fill('TEST1');
    await page.getByPlaceholder('Apple Inc.').fill('Test Company One');

    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;

    await expect(page.locator('td', { hasText: 'TEST1' }).first()).toBeVisible();

    // Essayer de créer un doublon
    await page.getByPlaceholder('AAPL').fill('TEST1');
    await page.getByPlaceholder('Apple Inc.').fill('Test Duplicate');
    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Vérifier que l'erreur s'affiche
    await expect(page.getByText('Cette action existe déjà')).toBeVisible();
  });

  test('Test 4: Validation des champs vides', async ({ page }) => {
    await page.goto('/');

    // Test 4a: Symbole vide
    await page.getByPlaceholder('Apple Inc.').fill('Test Empty Symbol');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText('Le symbole et le nom sont requis')).toBeVisible();

    // Nettoyer
    await page.reload();

    // Test 4b: Nom vide
    await page.getByPlaceholder('AAPL').fill('TESTEMPTY');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText('Le symbole et le nom sont requis')).toBeVisible();
  });

  test('Test 5: Annulation de modification', async ({ page }) => {
    await page.goto('/');

    // Créer TEST2
    await page.getByPlaceholder('AAPL').fill('TEST2');
    await page.getByPlaceholder('Apple Inc.').fill('Test Company Two');

    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;

    await expect(page.locator('td', { hasText: 'TEST2' }).first()).toBeVisible();

    // Cliquer sur Modifier
    await page.getByRole('row', { name: /TEST2/ }).getByRole('button', { name: 'Modifier' }).click();

    // Modifier le nom (sans sauvegarder)
    await page.getByPlaceholder('Apple Inc.').fill('Test Modified But Cancelled');

    // Cliquer sur Annuler
    await page.getByRole('button', { name: 'Annuler' }).click();

    // Vérifier que le formulaire est vide
    await expect(page.getByPlaceholder('AAPL')).toHaveValue('');
    await expect(page.getByPlaceholder('Apple Inc.')).toHaveValue('');

    // Vérifier que le mode est "Ajouter"
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeVisible();

    // Vérifier que la modification n'a pas été sauvegardée
    await expect(page.getByText('Test Company Two')).toBeVisible();
    await expect(page.getByText('Test Modified But Cancelled')).not.toBeVisible();
  });

  test('Test 6: Suppression d\'actions', async ({ page }) => {
    await page.goto('/');

    // Créer TESTERR
    await page.getByPlaceholder('AAPL').fill('TESTERR');
    await page.getByPlaceholder('Apple Inc.').fill('Test Error Handling');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText('TESTERR')).toBeVisible();

    // Intercepter la boîte de dialogue de confirmation
    page.on('dialog', dialog => dialog.accept());

    // Cliquer sur Supprimer
    await page.getByRole('row', { name: /TESTERR/ }).getByRole('button', { name: 'Supprimer' }).click();

    // Attendre que l'action disparaisse
    await expect(page.getByText('TESTERR')).not.toBeVisible();
  });

  test('Test 7: Conversion automatique en majuscules', async ({ page }) => {
    await page.goto('/');

    // Taper en minuscules
    const symbolInput = page.getByPlaceholder('AAPL');
    await symbolInput.fill('testlower');

    // Vérifier que la conversion se fait pendant la saisie
    await expect(symbolInput).toHaveValue('TESTLOWER');

    // Créer l'action
    await page.getByPlaceholder('Apple Inc.').fill('Test Lowercase Symbol');
    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Vérifier que le symbole est en majuscules dans le tableau
    await expect(page.getByText('TESTLOWER')).toBeVisible();
  });

  test('Test 8: Vérification de la persistance', async ({ page }) => {
    await page.goto('/');

    // Créer une action
    await page.getByPlaceholder('AAPL').fill('TESTPERSIST');
    await page.getByPlaceholder('Apple Inc.').fill('Test Persistence');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText('TESTPERSIST')).toBeVisible();

    // Rafraîchir la page
    await page.reload();

    // Vérifier que l'action est toujours là
    await expect(page.getByText('TESTPERSIST')).toBeVisible();
    await expect(page.getByText('Test Persistence')).toBeVisible();
  });

  test('Test 9: Interface responsive (desktop)', async ({ page }) => {
    await page.goto('/');

    // Créer une action pour avoir du contenu
    await page.getByPlaceholder('AAPL').fill('TESTUI');
    await page.getByPlaceholder('Apple Inc.').fill('Test User Interface');
    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Vérifier que tous les éléments principaux sont visibles
    await expect(page.getByRole('heading', { name: 'Gestion des Actions Boursières' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Ajouter une action/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mes Actions' })).toBeVisible();

    // Vérifier que le tableau est visible avec toutes les colonnes
    await expect(page.getByRole('columnheader', { name: 'Symbole' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Nom' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date d\'ajout' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  });

  test('Test 10: Affichage vide initial', async ({ page, request }) => {
    // Supprimer toutes les actions (pas seulement TEST*)
    const response = await request.get(API_URL);
    const stocks = await response.json();
    for (const stock of stocks) {
      await request.delete(`${API_URL}/${stock.id}`);
    }

    // Attendre que les suppressions soient bien effectuées
    await page.waitForTimeout(500);

    // Charger la page
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Vérifier le message quand il n'y a pas d'actions
    await expect(page.getByText('Aucune action enregistrée. Ajoutez-en une ci-dessus !')).toBeVisible({ timeout: 15000 });
  });
});
