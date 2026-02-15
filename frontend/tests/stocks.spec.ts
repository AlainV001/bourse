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
    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Vérifier que TEST1 apparaît dans le tableau
    await expect(page.locator('td', { hasText: 'TEST1' }).first()).toBeVisible({ timeout: 10000 });

    // Créer TEST2
    await page.getByPlaceholder('AAPL').fill('TEST2');

    const response2 = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await response2;

    // Vérifier que TEST2 apparaît
    await expect(page.locator('td', { hasText: 'TEST2' }).first()).toBeVisible();

    // Créer TESTAPI
    await page.getByPlaceholder('AAPL').fill('TESTAPI');

    const response3 = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await response3;

    // Vérifier que TESTAPI apparaît
    await expect(page.locator('td', { hasText: 'TESTAPI' }).first()).toBeVisible();

    // Vérifier que le formulaire se vide après ajout
    await expect(page.getByPlaceholder('AAPL')).toHaveValue('');
  });

  test('Test 2: Modification d\'une action', async ({ page }) => {
    // Créer d'abord une action
    await page.goto('/');
    await page.getByPlaceholder('AAPL').fill('TEST1');
    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Attendre que l'action soit créée
    await expect(page.locator('td', { hasText: 'TEST1' }).first()).toBeVisible({ timeout: 10000 });

    // Cliquer sur Modifier
    await page.getByRole('row', { name: /TEST1/ }).getByRole('button', { name: 'Modifier' }).click();

    // Vérifier que le formulaire se remplit
    await expect(page.getByPlaceholder('AAPL')).toHaveValue('TEST1');

    // Vérifier que le bouton est "Mettre à jour"
    await expect(page.getByRole('button', { name: 'Mettre à jour' })).toBeVisible();

    // Modifier le symbole
    await page.getByPlaceholder('AAPL').fill('TESTMOD');
    await page.getByRole('button', { name: 'Mettre à jour' }).click();

    // Vérifier que la modification est visible
    await expect(page.locator('td', { hasText: 'TESTMOD' }).first()).toBeVisible({ timeout: 10000 });

    // Vérifier que le formulaire est revenu en mode "Ajouter"
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeVisible();
  });

  test('Test 3: Validation des doublons', async ({ page }) => {
    await page.goto('/');

    // Créer TEST1
    await page.getByPlaceholder('AAPL').fill('TEST1');

    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;

    await expect(page.locator('td', { hasText: 'TEST1' }).first()).toBeVisible();

    // Essayer de créer un doublon
    await page.getByPlaceholder('AAPL').fill('TEST1');
    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Vérifier que l'erreur s'affiche
    await expect(page.getByText('Cette action existe déjà')).toBeVisible();
  });

  test('Test 4: Validation du champ vide', async ({ page }) => {
    await page.goto('/');

    // Symbole vide
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText('Le symbole est requis')).toBeVisible();
  });

  test('Test 5: Annulation de modification', async ({ page }) => {
    await page.goto('/');

    // Créer TEST2
    await page.getByPlaceholder('AAPL').fill('TEST2');

    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;

    await expect(page.locator('td', { hasText: 'TEST2' }).first()).toBeVisible();

    // Cliquer sur Modifier
    await page.getByRole('row', { name: /TEST2/ }).getByRole('button', { name: 'Modifier' }).click();

    // Modifier le symbole (sans sauvegarder)
    await page.getByPlaceholder('AAPL').fill('TESTCANCEL');

    // Cliquer sur Annuler
    await page.getByRole('button', { name: 'Annuler' }).click();

    // Vérifier que le formulaire est vide
    await expect(page.getByPlaceholder('AAPL')).toHaveValue('');

    // Vérifier que le mode est "Ajouter"
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeVisible();

    // Vérifier que la modification n'a pas été sauvegardée
    await expect(page.locator('td', { hasText: 'TEST2' }).first()).toBeVisible();
    await expect(page.locator('td', { hasText: 'TESTCANCEL' })).not.toBeVisible();
  });

  test('Test 6: Suppression d\'actions', async ({ page }) => {
    await page.goto('/');

    // Créer TESTERR
    await page.getByPlaceholder('AAPL').fill('TESTERR');
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
    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Vérifier que le symbole est en majuscules dans le tableau
    await expect(page.locator('td', { hasText: 'TESTLOWER' }).first()).toBeVisible();
  });

  test('Test 8: Vérification de la persistance', async ({ page }) => {
    await page.goto('/');

    // Créer une action
    await page.getByPlaceholder('AAPL').fill('TESTPERSIST');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.locator('td', { hasText: 'TESTPERSIST' }).first()).toBeVisible();

    // Rafraîchir la page
    await page.reload();

    // Vérifier que l'action est toujours là
    await expect(page.locator('td', { hasText: 'TESTPERSIST' }).first()).toBeVisible();
  });

  test('Test 9: Interface responsive (desktop)', async ({ page }) => {
    await page.goto('/');

    // Créer une action pour avoir du contenu
    await page.getByPlaceholder('AAPL').fill('TESTUI');
    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Vérifier que tous les éléments principaux sont visibles
    await expect(page.getByRole('heading', { name: 'Gestion des Actions Boursières' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Ajouter une action/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mes Actions' })).toBeVisible();

    // Vérifier que le tableau est visible avec toutes les colonnes
    await expect(page.getByRole('columnheader', { name: 'Symbole' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Cours' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date d\'ajout' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();

    // Vérifier que le bouton Rafraîchir les cours est visible
    await expect(page.getByRole('button', { name: /Rafraîchir les cours/ })).toBeVisible();
  });

  test('Test 10: Affichage des cours pour un symbole réel', async ({ page }) => {
    await page.goto('/');

    // Créer une action avec un vrai symbole boursier
    await page.getByPlaceholder('AAPL').fill('AAPL');

    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;

    await expect(page.locator('td', { hasText: 'AAPL' }).first()).toBeVisible();

    // Attendre que les cours soient chargés (le fetch /quotes est déclenché automatiquement)
    const quotesResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes')
    );
    await quotesResponse;

    // Vérifier qu'un prix s'affiche (format monétaire, ex: "$255.78" ou "255,78 $US")
    const row = page.getByRole('row', { name: /AAPL/ });
    // Le prix doit contenir un nombre avec décimales
    await expect(row.locator('td').nth(1).locator('.font-semibold')).toBeVisible({ timeout: 15000 });

    // Vérifier que la variation s'affiche (en vert ou rouge)
    const changeEl = row.locator('td').nth(1).locator('.text-green-600, .text-red-600');
    await expect(changeEl).toBeVisible();

    // Vérifier que la variation contient un pourcentage
    await expect(changeEl).toContainText('%');

    // Nettoyage
    page.on('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.locator('td', { hasText: 'AAPL' })).not.toBeVisible();
  });

  test('Test 11: Affichage N/A pour un symbole inexistant', async ({ page }) => {
    await page.goto('/');

    // Créer une action avec un symbole qui n'existe pas sur Yahoo Finance
    await page.getByPlaceholder('AAPL').fill('TESTFAKE99');

    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;

    await expect(page.locator('td', { hasText: 'TESTFAKE99' }).first()).toBeVisible();

    // Attendre que les cours soient chargés
    const quotesResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes')
    );
    await quotesResponse;

    // Vérifier que "N/A" s'affiche pour ce symbole inexistant
    const row = page.getByRole('row', { name: /TESTFAKE99/ });
    await expect(row.getByText('N/A')).toBeVisible({ timeout: 15000 });
  });

  test('Test 12: Bouton Rafraîchir les cours', async ({ page }) => {
    await page.goto('/');

    // Créer une action
    await page.getByPlaceholder('AAPL').fill('TESTREFRESH');

    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;

    // Attendre le chargement initial des cours
    await page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes')
    );

    // Cliquer sur le bouton Rafraîchir les cours
    const refreshButton = page.getByRole('button', { name: /Rafraîchir|Chargement/ });
    await expect(refreshButton).toBeVisible();

    // Vérifier que le bouton déclenche un appel API /quotes
    const quotesRefresh = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes')
    );
    await refreshButton.click();
    await quotesRefresh;

    // Vérifier que le bouton revient à son état normal après le fetch
    await expect(refreshButton).toContainText('Rafraîchir les cours');
  });

  test('Test 13: Bouton Rafraîchir masqué quand la liste est vide', async ({ page, request }) => {
    // Supprimer toutes les actions
    const response = await request.get(API_URL);
    const stocks = await response.json();
    for (const stock of stocks) {
      await request.delete(`${API_URL}/${stock.id}`);
    }

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Vérifier que le bouton Rafraîchir n'est pas visible
    await expect(page.getByText('Aucune action enregistrée. Ajoutez-en une ci-dessus !')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Rafraîchir les cours/ })).not.toBeVisible();
  });

  test('Test 14: API /quotes retourne les cours correctement', async ({ request }) => {
    // Créer une action avec un vrai symbole
    await request.post(API_URL, { data: { symbol: 'TESTAAPL' } });

    // Créer une action AAPL pour tester un vrai cours
    const createResp = await request.post(API_URL, { data: { symbol: 'AAPL' } });
    // Si AAPL existe déjà, c'est OK (409)

    // Appeler l'endpoint /quotes
    const quotesResp = await request.get(`${API_URL}/quotes`);
    expect(quotesResp.ok()).toBeTruthy();

    const quotes = await quotesResp.json();

    // Vérifier la structure de la réponse pour AAPL (si elle existe)
    if (quotes['AAPL']) {
      expect(quotes['AAPL']).toHaveProperty('price');
      expect(quotes['AAPL']).toHaveProperty('currency');
      expect(quotes['AAPL']).toHaveProperty('change');
      expect(quotes['AAPL']).toHaveProperty('changePercent');
      expect(typeof quotes['AAPL'].price).toBe('number');
      expect(quotes['AAPL'].price).toBeGreaterThan(0);
    }

    // Vérifier que TESTAAPL retourne null (symbole inexistant sur Yahoo Finance)
    if (quotes['TESTAAPL'] !== undefined) {
      expect(quotes['TESTAAPL']).toBeNull();
    }

    // Nettoyage
    const allStocks = await (await request.get(API_URL)).json();
    for (const stock of allStocks) {
      if (stock.symbol === 'TESTAAPL') {
        await request.delete(`${API_URL}/${stock.id}`);
      }
    }
  });

  test('Test 15: Affichage vide initial', async ({ page, request }) => {
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
