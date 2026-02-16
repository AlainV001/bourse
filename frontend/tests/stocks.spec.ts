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
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();

    // Vérifier que la colonne "Date d'ajout" n'existe plus
    await expect(page.getByRole('columnheader', { name: 'Date d\'ajout' })).not.toBeVisible();

    // Vérifier que le bouton Rafraîchir les cours est visible
    await expect(page.getByRole('button', { name: /Rafraîchir les cours/ })).toBeVisible();
  });

  test('Test 10: Affichage des cours pour un symbole réel', async ({ page }) => {
    await page.goto('/');

    // Créer une action avec un vrai symbole boursier
    await page.getByPlaceholder('AAPL').fill('AAPL');

    // Poser les listeners AVANT le click qui déclenche le fetch
    const quotesResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes') && !response.url().includes('history')
    );
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'AAPL' }).first()).toBeVisible();

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

    // Poser les listeners AVANT le click
    const quotesResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes') && !response.url().includes('history')
    );
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTFAKE99' }).first()).toBeVisible();

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
    // Sauvegarder les actions existantes (non-TEST)
    const response = await request.get(API_URL);
    const allStocks = await response.json();
    const userStocks = allStocks.filter((s: any) => !s.symbol.startsWith('TEST'));

    // Supprimer temporairement toutes les actions
    for (const stock of allStocks) {
      await request.delete(`${API_URL}/${stock.id}`);
    }

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Vérifier que le bouton Rafraîchir n'est pas visible
    await expect(page.getByText('Aucune action enregistrée. Ajoutez-en une ci-dessus !')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Rafraîchir les cours/ })).not.toBeVisible();

    // Restaurer les actions utilisateur
    for (const stock of userStocks) {
      await request.post(API_URL, { data: { symbol: stock.symbol } });
    }
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
      expect(quotes['AAPL']).toHaveProperty('refreshed_at');
      expect(quotes['AAPL']).toHaveProperty('dailyTrend');
      expect(typeof quotes['AAPL'].price).toBe('number');
      expect(quotes['AAPL'].price).toBeGreaterThan(0);
      expect(typeof quotes['AAPL'].refreshed_at).toBe('string');
      // dailyTrend est un nombre ou null
      expect(quotes['AAPL'].dailyTrend === null || typeof quotes['AAPL'].dailyTrend === 'number').toBeTruthy();
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

  test('Test 15: Affichage du dernier refresh près du bouton', async ({ page }) => {
    await page.goto('/');

    // Créer une action
    await page.getByPlaceholder('AAPL').fill('TESTREFDT');
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;

    // Attendre le chargement initial des cours
    await page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes')
    );

    // Vérifier que le texte "Dernier refresh" apparaît près du bouton
    await expect(page.getByText(/Dernier refresh/)).toBeVisible({ timeout: 15000 });
  });

  test('Test 16: Bouton Historique visible pour chaque action', async ({ page }) => {
    await page.goto('/');

    // Créer une action
    await page.getByPlaceholder('AAPL').fill('TESTHIST1');
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;

    await expect(page.locator('td', { hasText: 'TESTHIST1' }).first()).toBeVisible();

    // Vérifier qu'un bouton Historique est présent sur la ligne
    const row = page.getByRole('row', { name: /TESTHIST1/ });
    await expect(row.getByRole('button', { name: 'Historique', exact: true })).toBeVisible();
  });

  test('Test 17: Ouvrir et fermer le panneau historique', async ({ page }) => {
    await page.goto('/');

    // Créer une action
    await page.getByPlaceholder('AAPL').fill('TESTHIST2');
    // Poser le listener quotes AVANT le click qui déclenche le fetch
    const quotesResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes') && !response.url().includes('history')
    );
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTHIST2' }).first()).toBeVisible();

    // Cliquer sur Historique et attendre la réponse API
    const row = page.getByRole('row', { name: /TESTHIST2/ });
    const historyResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes/history/TESTHIST2')
    );
    await row.getByRole('button', { name: 'Historique', exact: true }).click();
    await historyResponse;

    // Le bouton doit maintenant afficher "Fermer"
    await expect(row.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();

    // Un panneau d'historique doit s'afficher (sous-tableau ou message "Aucun historique")
    const historyPanel = page.locator('td[colspan="3"]');
    await expect(historyPanel).toBeVisible();

    // Cliquer sur Fermer pour refermer le panneau
    await row.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(historyPanel).not.toBeVisible();

    // Le bouton doit revenir à "Historique"
    await expect(row.getByRole('button', { name: 'Historique', exact: true })).toBeVisible();
  });

  test('Test 18: Historique affiche les séquences de tendance après plusieurs refreshs', async ({ page, request }) => {
    // Créer AAPL via API
    await request.post(API_URL, { data: { symbol: 'AAPL' } });

    // Faire 2 refreshs via API pour générer au moins 2 points d'historique
    await request.get(`${API_URL}/quotes`);
    await request.get(`${API_URL}/quotes`);

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'AAPL' }).first()).toBeVisible({ timeout: 10000 });

    // Ouvrir l'historique d'AAPL
    const row = page.getByRole('row', { name: /AAPL/ }).first();
    const historyResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes/history/AAPL')
    );
    await row.getByRole('button', { name: 'Historique', exact: true }).click();
    await historyResponse;

    // Vérifier que le sous-tableau contient les colonnes de séquences
    const historyPanel = page.locator('td[colspan="3"]');
    await expect(historyPanel.getByText('Période')).toBeVisible({ timeout: 10000 });
    await expect(historyPanel.getByText('Début')).toBeVisible();
    await expect(historyPanel.getByText('Fin')).toBeVisible();
    await expect(historyPanel.getByText('Variation')).toBeVisible();

    // Vérifier qu'au moins une séquence existe (avec un %)
    await expect(historyPanel.locator('tbody tr').first()).toBeVisible();
    await expect(historyPanel.locator('tbody tr').first()).toContainText('%');

    // Nettoyage
    await row.getByRole('button', { name: 'Fermer', exact: true }).click();
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('row', { name: /AAPL/ }).first().getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.locator('td', { hasText: 'AAPL' })).not.toBeVisible();
  });

  test('Test 19: API /quotes/history/:symbol retourne l\'historique', async ({ request }) => {
    // Créer une action
    await request.post(API_URL, { data: { symbol: 'TESTHAPI' } });

    // Déclencher un refresh des cours pour générer de l'historique
    await request.get(`${API_URL}/quotes`);

    // Appeler l'endpoint historique
    const histResp = await request.get(`${API_URL}/quotes/history/TESTHAPI`);
    expect(histResp.ok()).toBeTruthy();

    const history = await histResp.json();
    expect(Array.isArray(history)).toBeTruthy();

    // TESTHAPI est un faux symbole, donc pas d'entrée d'historique (null dans quotes)
    // Vérifier que le endpoint retourne un tableau (vide pour un faux symbole)
    expect(history.length).toBe(0);

    // Nettoyage
    const allStocks = await (await request.get(API_URL)).json();
    for (const stock of allStocks) {
      if (stock.symbol === 'TESTHAPI') {
        await request.delete(`${API_URL}/${stock.id}`);
      }
    }
  });

  test('Test 20: API /quotes retourne dailyTrend après plusieurs refreshs', async ({ request }) => {
    // Créer une action avec un vrai symbole
    await request.post(API_URL, { data: { symbol: 'AAPL' } });

    // Faire deux appels /quotes pour avoir au moins 2 points d'historique dans la journée
    await request.get(`${API_URL}/quotes`);
    const quotesResp = await request.get(`${API_URL}/quotes`);
    expect(quotesResp.ok()).toBeTruthy();

    const quotes = await quotesResp.json();

    if (quotes['AAPL']) {
      // Après 2 refreshs, dailyTrend doit être un nombre (pas null)
      expect(typeof quotes['AAPL'].dailyTrend).toBe('number');
    }

    // Nettoyage : supprimer AAPL seulement si c'est un symbole de test
    // (on ne supprime pas AAPL car l'utilisateur peut l'avoir)
  });

  test('Test 21: Pas de badge tendance pour un symbole sans historique suffisant', async ({ page }) => {
    await page.goto('/');

    // Créer une action fraîche
    await page.getByPlaceholder('AAPL').fill('TESTTREND');
    const quotesResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes') && !response.url().includes('history')
    );
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTTREND' }).first()).toBeVisible();

    // Avec un seul refresh, pas de séquence possible → pas de badge
    // Le badge a la classe .rounded et contient un %
    const row = page.getByRole('row', { name: /TESTTREND/ });
    const badge = row.locator('td').first().locator('span.rounded');
    await expect(badge).not.toBeVisible();
  });

  test('Test 22: Badge tendance absent pour un symbole TEST inexistant (quote null)', async ({ page }) => {
    await page.goto('/');

    // Créer un symbole bidon
    await page.getByPlaceholder('AAPL').fill('TESTNOQT');
    const quotesResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes') && !response.url().includes('history')
    );
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTNOQT' }).first()).toBeVisible();

    // Symbole inexistant → quote null → aucun badge
    const row = page.getByRole('row', { name: /TESTNOQT/ });
    const badge = row.locator('td').first().locator('span.rounded');
    await expect(badge).not.toBeVisible();
  });

  test('Test 23: Bouton Historique J visible pour chaque action', async ({ page }) => {
    await page.goto('/');

    // Créer une action
    await page.getByPlaceholder('AAPL').fill('TESTDAILY1');
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;

    await expect(page.locator('td', { hasText: 'TESTDAILY1' }).first()).toBeVisible();

    // Vérifier qu'un bouton Historique J est présent sur la ligne
    const row = page.getByRole('row', { name: /TESTDAILY1/ });
    await expect(row.getByRole('button', { name: 'Historique J' })).toBeVisible();
  });

  test('Test 24: Ouvrir et fermer le panneau Historique J', async ({ page }) => {
    await page.goto('/');

    // Créer une action
    await page.getByPlaceholder('AAPL').fill('TESTDAILY2');
    const quotesResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes') && !response.url().includes('history')
    );
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTDAILY2' }).first()).toBeVisible();

    // Cliquer sur Historique J et attendre la réponse API
    const row = page.getByRole('row', { name: /TESTDAILY2/ });
    const dailyResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/daily-history/TESTDAILY2')
    );
    await row.getByRole('button', { name: 'Historique J' }).click();
    await dailyResponse;

    // Le bouton doit maintenant afficher "Fermer J"
    await expect(row.getByRole('button', { name: 'Fermer J' })).toBeVisible();

    // Un panneau d'historique journalier doit s'afficher
    const dailyPanel = page.locator('td[colspan="3"]');
    await expect(dailyPanel).toBeVisible();

    // Cliquer sur Fermer J pour refermer le panneau
    await row.getByRole('button', { name: 'Fermer J' }).click();
    await expect(dailyPanel).not.toBeVisible();

    // Le bouton doit revenir à "Historique J"
    await expect(row.getByRole('button', { name: 'Historique J' })).toBeVisible();
  });

  test('Test 25: API /daily-history/:symbol retourne l\'historique journalier', async ({ request }) => {
    // Créer une action
    await request.post(API_URL, { data: { symbol: 'TESTDAPI' } });

    // Déclencher un refresh des cours pour générer de l'historique journalier
    await request.get(`${API_URL}/quotes`);

    // Appeler l'endpoint historique journalier
    const histResp = await request.get(`${API_URL}/daily-history/TESTDAPI`);
    expect(histResp.ok()).toBeTruthy();

    const history = await histResp.json();
    expect(Array.isArray(history)).toBeTruthy();

    // TESTDAPI est un faux symbole, pas d'entrée (quote null)
    expect(history.length).toBe(0);

    // Nettoyage
    const allStocks = await (await request.get(API_URL)).json();
    for (const stock of allStocks) {
      if (stock.symbol === 'TESTDAPI') {
        await request.delete(`${API_URL}/${stock.id}`);
      }
    }
  });

  test('Test 26: Historique J affiche les données pour un symbole réel', async ({ page, request }) => {
    // Créer AAPL via API
    await request.post(API_URL, { data: { symbol: 'AAPL' } });

    // Faire un refresh pour générer l'historique journalier
    await request.get(`${API_URL}/quotes`);

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'AAPL' }).first()).toBeVisible({ timeout: 10000 });

    // Ouvrir l'historique journalier d'AAPL
    const row = page.getByRole('row', { name: /AAPL/ }).first();
    const dailyResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/daily-history/AAPL')
    );
    await row.getByRole('button', { name: 'Historique J' }).click();
    await dailyResponse;

    // Vérifier que le sous-tableau contient les colonnes journalières
    const dailyPanel = page.locator('td[colspan="3"]');
    await expect(dailyPanel.getByText('Date')).toBeVisible({ timeout: 10000 });
    await expect(dailyPanel.getByText('Ouverture')).toBeVisible();
    await expect(dailyPanel.getByText('Clôture')).toBeVisible();
    await expect(dailyPanel.getByText('Variation jour')).toBeVisible();

    // Vérifier qu'au moins une ligne existe avec un %
    await expect(dailyPanel.locator('tbody tr').first()).toBeVisible();
    await expect(dailyPanel.locator('tbody tr').first()).toContainText('%');

    // Nettoyage
    await row.getByRole('button', { name: 'Fermer J' }).click();
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('row', { name: /AAPL/ }).first().getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.locator('td', { hasText: 'AAPL' })).not.toBeVisible();
  });

  test('Test 27: Un seul panneau ouvert à la fois (Historique et Historique J)', async ({ page }) => {
    await page.goto('/');

    // Créer une action
    await page.getByPlaceholder('AAPL').fill('TESTPANEL');
    const quotesResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes') && !response.url().includes('history')
    );
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTPANEL' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTPANEL/ });

    // Ouvrir Historique
    const historyResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/quotes/history/TESTPANEL')
    );
    await row.getByRole('button', { name: 'Historique', exact: true }).click();
    await historyResponse;

    // Vérifier que le panneau est ouvert
    await expect(page.locator('td[colspan="3"]')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();

    // Ouvrir Historique J (doit fermer Historique)
    const dailyResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks/daily-history/TESTPANEL')
    );
    await row.getByRole('button', { name: 'Historique J' }).click();
    await dailyResponse;

    // Le bouton Historique doit revenir (plus "Fermer")
    await expect(row.getByRole('button', { name: 'Historique', exact: true })).toBeVisible();
    // Le bouton Historique J doit montrer "Fermer J"
    await expect(row.getByRole('button', { name: 'Fermer J' })).toBeVisible();

    // Il ne doit y avoir qu'un seul panneau ouvert
    await expect(page.locator('td[colspan="3"]')).toHaveCount(1);
  });

  test('Test 28: Bouton News visible pour chaque action', async ({ page }) => {
    await page.goto('/');

    // Créer une action
    await page.getByPlaceholder('AAPL').fill('TESTNEWS1');
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/stocks') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await createResponse;

    await expect(page.locator('td', { hasText: 'TESTNEWS1' }).first()).toBeVisible();

    // Vérifier qu'un lien News est présent sur la ligne
    const row = page.getByRole('row', { name: /TESTNEWS1/ });
    const newsLink = row.getByRole('link', { name: 'News' });
    await expect(newsLink).toBeVisible();

    // Vérifier que le lien pointe vers Google News avec le bon symbole
    await expect(newsLink).toHaveAttribute('href', /google\.com\/search\?q=TESTNEWS1\+stock\+news&tbm=nws/);
    await expect(newsLink).toHaveAttribute('target', '_blank');
  });

  test('Test 29: Affichage vide initial', async ({ page, request }) => {
    // Sauvegarder les actions existantes (non-TEST)
    const response = await request.get(API_URL);
    const allStocks = await response.json();
    const userStocks = allStocks.filter((s: any) => !s.symbol.startsWith('TEST'));

    // Supprimer temporairement toutes les actions
    for (const stock of allStocks) {
      await request.delete(`${API_URL}/${stock.id}`);
    }

    // Attendre que les suppressions soient bien effectuées
    await page.waitForTimeout(500);

    // Charger la page
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Vérifier le message quand il n'y a pas d'actions
    await expect(page.getByText('Aucune action enregistrée. Ajoutez-en une ci-dessus !')).toBeVisible({ timeout: 15000 });

    // Restaurer les actions utilisateur
    for (const stock of userStocks) {
      await request.post(API_URL, { data: { symbol: stock.symbol } });
    }
  });

  test('Test 30: Le prix d\'ouverture est le premier point de l\'historique du jour', async ({ request }) => {
    // Créer AAPL si nécessaire
    await request.post(API_URL, { data: { symbol: 'AAPL' } });

    // Rafraîchir les cours pour déclencher l'insertion du prix d'ouverture
    await request.get(`${API_URL}/quotes`);

    // Récupérer l'historique
    const histResp = await request.get(`${API_URL}/quotes/history/AAPL`);
    expect(histResp.ok()).toBeTruthy();

    const history = await histResp.json();
    expect(history.length).toBeGreaterThanOrEqual(2);

    // L'historique est trié DESC, le dernier élément est le plus ancien = le prix d'ouverture
    const today = new Date().toISOString().slice(0, 10);
    const todayEntries = history.filter((e: any) => e.refreshed_at.startsWith(today));
    expect(todayEntries.length).toBeGreaterThanOrEqual(2);

    // Le premier point chronologique du jour (dernier dans l'ordre DESC) doit être à T00:00:00
    const firstEntry = todayEntries[todayEntries.length - 1];
    expect(firstEntry.refreshed_at).toBe(today + 'T00:00:00');
    expect(firstEntry.price).toBeGreaterThan(0);

    // Nettoyage : supprimer AAPL seulement si c'est un test
    // (on ne supprime pas AAPL car l'utilisateur peut l'avoir)
  });
});
