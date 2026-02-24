import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:3000/api/stocks';

// Nettoyer les actions TEST* avant chaque test
test.beforeEach(async ({ request }) => {
  const response = await request.get(API_URL);
  const stocks = await response.json();
  for (const stock of stocks) {
    if (stock.symbol.startsWith('TEST')) {
      await request.delete(`${API_URL}/${stock.id}`);
    }
  }
});

// Helper : ouvrir la modale et ajouter une action
async function addStock(page: Page, symbol: string) {
  await page.locator('button[title="Ajouter une action"]').click();
  await page.getByPlaceholder('AAPL').fill(symbol);
  const createResponse = page.waitForResponse(r =>
    r.url().includes('/api/stocks') && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await createResponse;
}

test.describe('Tests d\'interface - Gestion des actions boursières', () => {

  // ─── Modale d'ajout ────────────────────────────────────────────────────────

  test('Test 1: Ouverture et fermeture de la modale d\'ajout', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Gestion des Actions Boursières' })).toBeVisible();

    // La modale ne doit pas être visible au départ
    await expect(page.getByRole('heading', { name: 'Ajouter une action' })).not.toBeVisible();

    // Ouvrir via le bouton +
    await page.locator('button[title="Ajouter une action"]').click();
    await expect(page.getByRole('heading', { name: 'Ajouter une action' })).toBeVisible();

    // Fermer via le bouton X (croix dans le header de la modale)
    await page.locator('.fixed.inset-0 .bg-white button').first().click();
    await expect(page.getByRole('heading', { name: 'Ajouter une action' })).not.toBeVisible();

    // Fermer via Annuler
    await page.locator('button[title="Ajouter une action"]').click();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('heading', { name: 'Ajouter une action' })).not.toBeVisible();

    // Fermer via le fond (backdrop)
    await page.locator('button[title="Ajouter une action"]').click();
    await page.mouse.click(10, 10);
    await expect(page.getByRole('heading', { name: 'Ajouter une action' })).not.toBeVisible();
  });

  test('Test 2: Création d\'actions via la modale', async ({ page }) => {
    await page.goto('/');

    // Créer TEST1
    await addStock(page, 'TEST1');
    await expect(page.locator('td', { hasText: 'TEST1' }).first()).toBeVisible({ timeout: 10000 });

    // Vérifier que la modale se ferme après ajout
    await expect(page.getByRole('heading', { name: 'Ajouter une action' })).not.toBeVisible();

    // Créer TEST2
    await addStock(page, 'TEST2');
    await expect(page.locator('td', { hasText: 'TEST2' }).first()).toBeVisible();

    // Créer TESTAPI
    await addStock(page, 'TESTAPI');
    await expect(page.locator('td', { hasText: 'TESTAPI' }).first()).toBeVisible();
  });

  test('Test 3: Validation des doublons', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TEST1');
    await expect(page.locator('td', { hasText: 'TEST1' }).first()).toBeVisible();

    // Essayer de créer un doublon
    await page.locator('button[title="Ajouter une action"]').click();
    await page.getByPlaceholder('AAPL').fill('TEST1');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();

    await expect(page.getByText('Cette action existe déjà')).toBeVisible();
  });

  test('Test 4: Validation du champ vide', async ({ page }) => {
    await page.goto('/');

    await page.locator('button[title="Ajouter une action"]').click();
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByText('Le symbole est requis')).toBeVisible();
  });

  test('Test 5: Conversion automatique en majuscules', async ({ page }) => {
    await page.goto('/');

    await page.locator('button[title="Ajouter une action"]').click();
    const symbolInput = page.getByPlaceholder('AAPL');
    await symbolInput.fill('testlower');
    await expect(symbolInput).toHaveValue('TESTLOWER');

    const createResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await createResponse;

    await expect(page.locator('td', { hasText: 'TESTLOWER' }).first()).toBeVisible();
  });

  // ─── Suppression ───────────────────────────────────────────────────────────

  test('Test 6: Suppression d\'actions', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTERR');
    await expect(page.locator('td', { hasText: 'TESTERR' }).first()).toBeVisible();

    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('row', { name: /TESTERR/ }).locator('button[title="Supprimer"]').click();
    await expect(page.locator('td', { hasText: 'TESTERR' })).not.toBeVisible();
  });

  // ─── Persistance ───────────────────────────────────────────────────────────

  test('Test 7: Vérification de la persistance', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTPERSIST');
    await expect(page.locator('td', { hasText: 'TESTPERSIST' }).first()).toBeVisible();

    await page.reload();
    await expect(page.locator('td', { hasText: 'TESTPERSIST' }).first()).toBeVisible();
  });

  // ─── Interface ─────────────────────────────────────────────────────────────

  test('Test 8: Interface générale (colonnes, boutons, état vide)', async ({ page, request }) => {
    const response = await request.get(API_URL);
    const allStocks = await response.json();
    const userStocks = allStocks.filter((s: any) => !s.symbol.startsWith('TEST'));

    for (const stock of allStocks) {
      await request.delete(`${API_URL}/${stock.id}`);
    }

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Aucune action enregistrée. Ajoutez-en une ci-dessus !')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button[title="Rafraîchir les cours"]')).not.toBeVisible();
    await expect(page.locator('button[title="Ajouter une action"]')).toBeVisible();

    for (const stock of userStocks) {
      await request.post(API_URL, { data: { symbol: stock.symbol } });
    }
  });

  test('Test 9: Interface desktop - colonnes du tableau', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTUI');
    await expect(page.locator('td', { hasText: 'TESTUI' }).first()).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Gestion des Actions Boursières' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mes Actions' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Symbole' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Cours' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    await expect(page.locator('button[title="Rafraîchir les cours"]')).toBeVisible();
  });

  // ─── Cours ─────────────────────────────────────────────────────────────────

  test('Test 10: Affichage des cours pour un symbole réel', async ({ page, request }) => {
    await request.post(API_URL, { data: { symbol: 'TESTREAL' } });

    // Mocker les quotes pour ne pas dépendre de Yahoo Finance
    await page.route('**/api/stocks/quotes', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        TESTREAL: { price: 255.78, currency: 'USD', change: -5.95, changePercent: -2.27, refreshed_at: new Date().toISOString(), dailyTrend: null }
      })
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTREAL' }).first()).toBeVisible({ timeout: 10000 });

    const row = page.getByRole('row', { name: /TESTREAL/ });
    await expect(row.locator('td').nth(1).locator('span.font-semibold')).toBeVisible({ timeout: 10000 });

    const changeEl = row.locator('td').nth(1).locator('.text-green-600, .text-red-600');
    await expect(changeEl).toBeVisible();
    await expect(changeEl).toContainText('%');

    page.on('dialog', dialog => dialog.accept());
    await row.locator('button[title="Supprimer"]').click();
    await expect(page.locator('td', { hasText: 'TESTREAL' })).not.toBeVisible();
  });

  test('Test 11: Affichage N/A pour un symbole inexistant', async ({ page }) => {
    await page.goto('/');

    await page.locator('button[title="Ajouter une action"]').click();
    await page.getByPlaceholder('AAPL').fill('TESTFAKE99');

    const quotesResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/quotes') && !r.url().includes('history')
    );
    const createResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTFAKE99' }).first()).toBeVisible();
    const row = page.getByRole('row', { name: /TESTFAKE99/ });
    await expect(row.getByText('N/A')).toBeVisible({ timeout: 15000 });
  });

  test('Test 12: Bouton Rafraîchir les cours (icône)', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTREFRESH');

    await page.waitForResponse(r => r.url().includes('/api/stocks/quotes'));

    const refreshButton = page.locator('button[title="Rafraîchir les cours"]');
    await expect(refreshButton).toBeVisible();

    const quotesRefresh = page.waitForResponse(r => r.url().includes('/api/stocks/quotes'));
    await refreshButton.click();
    await quotesRefresh;

    // Le bouton doit rester visible après le refresh
    await expect(refreshButton).toBeVisible();
  });

  test('Test 13: Dernier refresh affiché près du bouton', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTREFDT');

    // Mocker les quotes pour avoir un refreshed_at valide (TESTREFDT est un faux symbole → null sans mock)
    await page.route('**/api/stocks/quotes', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        TESTREFDT: { price: 100, currency: 'USD', change: 1, changePercent: 1, refreshed_at: new Date().toISOString(), dailyTrend: null }
      })
    }));

    // Déclencher un refresh pour que le mock soit utilisé
    await page.locator('button[title="Rafraîchir les cours"]').click();
    await expect(page.getByText(/Dernier refresh/)).toBeVisible({ timeout: 10000 });
  });

  // ─── API ───────────────────────────────────────────────────────────────────

  test('Test 14: API /quotes retourne les cours correctement', async ({ request }) => {
    await request.post(API_URL, { data: { symbol: 'TESTAAPL' } });
    await request.post(API_URL, { data: { symbol: 'AAPL' } });

    const quotesResp = await request.get(`${API_URL}/quotes`);
    expect(quotesResp.ok()).toBeTruthy();

    const quotes = await quotesResp.json();

    if (quotes['AAPL']) {
      expect(quotes['AAPL']).toHaveProperty('price');
      expect(quotes['AAPL']).toHaveProperty('currency');
      expect(quotes['AAPL']).toHaveProperty('change');
      expect(quotes['AAPL']).toHaveProperty('changePercent');
      expect(quotes['AAPL']).toHaveProperty('refreshed_at');
      expect(quotes['AAPL']).toHaveProperty('dailyTrend');
      expect(typeof quotes['AAPL'].price).toBe('number');
      expect(quotes['AAPL'].price).toBeGreaterThan(0);
      expect(quotes['AAPL'].dailyTrend === null || typeof quotes['AAPL'].dailyTrend === 'number').toBeTruthy();
    }

    if (quotes['TESTAAPL'] !== undefined) {
      expect(quotes['TESTAAPL']).toBeNull();
    }

    const allStocks = await (await request.get(API_URL)).json();
    for (const stock of allStocks) {
      if (stock.symbol === 'TESTAAPL') await request.delete(`${API_URL}/${stock.id}`);
    }
  });

  test('Test 15: API /quotes retourne dailyTrend après plusieurs refreshs', async ({ request }) => {
    await request.post(API_URL, { data: { symbol: 'AAPL' } });
    await request.get(`${API_URL}/quotes`);
    const quotesResp = await request.get(`${API_URL}/quotes`);
    expect(quotesResp.ok()).toBeTruthy();

    const quotes = await quotesResp.json();
    if (quotes['AAPL']) {
      expect(typeof quotes['AAPL'].dailyTrend).toBe('number');
    }
  });

  // ─── Historique intraday ────────────────────────────────────────────────────

  test('Test 16: Bouton Historique (icône) visible pour chaque action', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTHIST1');
    await expect(page.locator('td', { hasText: 'TESTHIST1' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTHIST1/ });
    await expect(row.locator('button[title="Détail des cours du jour"]')).toBeVisible();
  });

  test('Test 17: Ouvrir et fermer le panneau historique intraday', async ({ page }) => {
    await page.goto('/');

    await page.locator('button[title="Ajouter une action"]').click();
    await page.getByPlaceholder('AAPL').fill('TESTHIST2');

    const quotesResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/quotes') && !r.url().includes('history')
    );
    const createResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTHIST2' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTHIST2/ });
    const historyResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/quotes/history/TESTHIST2')
    );
    await row.locator('button[title="Détail des cours du jour"]').click();
    await historyResponse;

    const historyPanel = page.locator('td[colspan="3"]');
    await expect(historyPanel).toBeVisible();

    // Cliquer à nouveau pour fermer
    await row.locator('button[title="Détail des cours du jour"]').click();
    await expect(historyPanel).not.toBeVisible();
  });

  test('Test 18: Historique intraday affiche les séquences de tendance', async ({ page, request }) => {
    await request.post(API_URL, { data: { symbol: 'AAPL' } });
    await request.get(`${API_URL}/quotes`);
    await request.get(`${API_URL}/quotes`);

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'AAPL' }).first()).toBeVisible({ timeout: 10000 });

    const row = page.getByRole('row', { name: /AAPL/ }).first();
    const historyResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/quotes/history/AAPL')
    );
    await row.locator('button[title="Détail des cours du jour"]').click();
    await historyResponse;

    const historyPanel = page.locator('td[colspan="3"]');
    await expect(historyPanel.getByText('Période')).toBeVisible({ timeout: 10000 });
    await expect(historyPanel.getByText('Début')).toBeVisible();
    await expect(historyPanel.getByText('Fin')).toBeVisible();
    await expect(historyPanel.getByText('Variation')).toBeVisible();
    await expect(historyPanel.locator('tbody tr').first()).toContainText('%');

    // Fermer
    await row.locator('button[title="Détail des cours du jour"]').click();
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('row', { name: /AAPL/ }).first().locator('button[title="Supprimer"]').click();
    await expect(page.locator('td', { hasText: 'AAPL' })).not.toBeVisible();
  });

  test('Test 19: API /quotes/history/:symbol retourne l\'historique', async ({ request }) => {
    await request.post(API_URL, { data: { symbol: 'TESTHAPI' } });
    await request.get(`${API_URL}/quotes`);

    const histResp = await request.get(`${API_URL}/quotes/history/TESTHAPI`);
    expect(histResp.ok()).toBeTruthy();

    const history = await histResp.json();
    expect(Array.isArray(history)).toBeTruthy();
    expect(history.length).toBe(0);

    const allStocks = await (await request.get(API_URL)).json();
    for (const stock of allStocks) {
      if (stock.symbol === 'TESTHAPI') await request.delete(`${API_URL}/${stock.id}`);
    }
  });

  // ─── Badge tendance ─────────────────────────────────────────────────────────

  test('Test 20: Pas de badge tendance sans historique suffisant', async ({ page }) => {
    await page.goto('/');

    await page.locator('button[title="Ajouter une action"]').click();
    await page.getByPlaceholder('AAPL').fill('TESTTREND');

    const quotesResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/quotes') && !r.url().includes('history')
    );
    const createResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTTREND' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTTREND/ });
    const badge = row.locator('td').first().locator('span.rounded');
    await expect(badge).not.toBeVisible();
  });

  test('Test 21: Badge tendance absent pour un symbole inexistant', async ({ page }) => {
    await page.goto('/');

    await page.locator('button[title="Ajouter une action"]').click();
    await page.getByPlaceholder('AAPL').fill('TESTNOQT');

    const quotesResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/quotes') && !r.url().includes('history')
    );
    const createResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTNOQT' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTNOQT/ });
    const badge = row.locator('td').first().locator('span.rounded');
    await expect(badge).not.toBeVisible();
  });

  // ─── Historique journalier ──────────────────────────────────────────────────

  test('Test 22: Bouton Historique J (icône) visible pour chaque action', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTDAILY1');
    await expect(page.locator('td', { hasText: 'TESTDAILY1' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTDAILY1/ });
    await expect(row.locator('button[title="Cours du jour (journalier)"]')).toBeVisible();
  });

  test('Test 23: Ouvrir et fermer le panneau Historique J', async ({ page }) => {
    await page.goto('/');

    await page.locator('button[title="Ajouter une action"]').click();
    await page.getByPlaceholder('AAPL').fill('TESTDAILY2');

    const quotesResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/quotes') && !r.url().includes('history')
    );
    const createResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTDAILY2' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTDAILY2/ });
    const dailyResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/daily-history/TESTDAILY2')
    );
    await row.locator('button[title="Cours du jour (journalier)"]').click();
    await dailyResponse;

    const dailyPanel = page.locator('td[colspan="3"]');
    await expect(dailyPanel).toBeVisible();

    // Cliquer à nouveau pour fermer
    await row.locator('button[title="Cours du jour (journalier)"]').click();
    await expect(dailyPanel).not.toBeVisible();
  });

  test('Test 24: API /daily-history/:symbol retourne l\'historique journalier', async ({ request }) => {
    await request.post(API_URL, { data: { symbol: 'TESTDAPI' } });
    await request.get(`${API_URL}/quotes`);

    const histResp = await request.get(`${API_URL}/daily-history/TESTDAPI`);
    expect(histResp.ok()).toBeTruthy();

    const history = await histResp.json();
    expect(Array.isArray(history)).toBeTruthy();
    expect(history.length).toBe(0);

    const allStocks = await (await request.get(API_URL)).json();
    for (const stock of allStocks) {
      if (stock.symbol === 'TESTDAPI') await request.delete(`${API_URL}/${stock.id}`);
    }
  });

  test('Test 25: Historique J affiche les données pour un symbole réel', async ({ page, request }) => {
    await request.post(API_URL, { data: { symbol: 'AAPL' } });
    await request.get(`${API_URL}/quotes`);

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'AAPL' }).first()).toBeVisible({ timeout: 10000 });

    const row = page.getByRole('row', { name: /AAPL/ }).first();
    const dailyResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/daily-history/AAPL')
    );
    await row.locator('button[title="Cours du jour (journalier)"]').click();
    await dailyResponse;

    const dailyPanel = page.locator('td[colspan="3"]');
    await expect(dailyPanel.getByText('Date')).toBeVisible({ timeout: 10000 });
    await expect(dailyPanel.getByText('Ouverture')).toBeVisible();
    await expect(dailyPanel.getByText('Clôture')).toBeVisible();
    await expect(dailyPanel.getByText('Variation jour')).toBeVisible();
    await expect(dailyPanel.locator('tbody tr').first()).toContainText('%');

    // Fermer
    await row.locator('button[title="Cours du jour (journalier)"]').click();
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('row', { name: /AAPL/ }).first().locator('button[title="Supprimer"]').click();
    await expect(page.locator('td', { hasText: 'AAPL' })).not.toBeVisible();
  });

  test('Test 26: Un seul panneau ouvert à la fois', async ({ page }) => {
    await page.goto('/');

    await page.locator('button[title="Ajouter une action"]').click();
    await page.getByPlaceholder('AAPL').fill('TESTPANEL');

    const quotesResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/quotes') && !r.url().includes('history')
    );
    const createResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await createResponse;
    await quotesResponse;

    await expect(page.locator('td', { hasText: 'TESTPANEL' }).first()).toBeVisible();
    const row = page.getByRole('row', { name: /TESTPANEL/ });

    // Ouvrir Historique intraday
    const historyResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/quotes/history/TESTPANEL')
    );
    await row.locator('button[title="Détail des cours du jour"]').click();
    await historyResponse;
    await expect(page.locator('td[colspan="3"]')).toBeVisible();

    // Ouvrir Historique J (doit fermer le premier)
    const dailyResponse = page.waitForResponse(r =>
      r.url().includes('/api/stocks/daily-history/TESTPANEL')
    );
    await row.locator('button[title="Cours du jour (journalier)"]').click();
    await dailyResponse;

    // Un seul panneau ouvert
    await expect(page.locator('td[colspan="3"]')).toHaveCount(1);
  });

  // ─── Prix d'ouverture ───────────────────────────────────────────────────────

  test('Test 27: Le prix d\'ouverture est le premier point de l\'historique du jour', async ({ request }) => {
    await request.post(API_URL, { data: { symbol: 'AAPL' } });
    await request.get(`${API_URL}/quotes`);

    const histResp = await request.get(`${API_URL}/quotes/history/AAPL`);
    expect(histResp.ok()).toBeTruthy();

    const history = await histResp.json();
    expect(history.length).toBeGreaterThanOrEqual(2);

    const today = new Date().toISOString().slice(0, 10);
    const todayEntries = history.filter((e: any) => e.refreshed_at.startsWith(today));
    expect(todayEntries.length).toBeGreaterThanOrEqual(2);

    const firstEntry = todayEntries[todayEntries.length - 1];
    expect(firstEntry.refreshed_at).toBe(today + 'T00:00:00');
    expect(firstEntry.price).toBeGreaterThan(0);
  });

  // ─── News ───────────────────────────────────────────────────────────────────

  test('Test 28: Bouton News (icône) visible pour chaque action', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTNEWS1');
    await expect(page.locator('td', { hasText: 'TESTNEWS1' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTNEWS1/ });
    const newsLink = row.locator('a[title="News"]');
    await expect(newsLink).toBeVisible();
    await expect(newsLink).toHaveAttribute('href', /google\.com\/search\?q=TESTNEWS1\+stock\+news&tbm=nws/);
    await expect(newsLink).toHaveAttribute('target', '_blank');
  });

  // ─── Étoile / Important ─────────────────────────────────────────────────────

  test('Test 29a: Étoile visible sur chaque ligne', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTSTAR1');
    await expect(page.locator('td', { hasText: 'TESTSTAR1' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTSTAR1/ });
    await expect(row.locator('button').filter({ hasText: /[★☆]/ })).toBeVisible();
  });

  test('Test 29b: Clic sur l\'étoile bascule le statut important', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTSTAR2');
    await expect(page.locator('td', { hasText: 'TESTSTAR2' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTSTAR2/ });
    const starButton = row.locator('button').filter({ hasText: /[★☆]/ });

    await expect(starButton.locator('span.text-gray-400')).toBeVisible();

    const patchResponse = page.waitForResponse(r =>
      r.url().includes('/important') && r.request().method() === 'PATCH'
    );
    await starButton.click();
    await patchResponse;

    await expect(row.locator('button').filter({ hasText: /[★☆]/ }).locator('span.text-yellow-500')).toBeVisible({ timeout: 10000 });

    const patchResponse2 = page.waitForResponse(r =>
      r.url().includes('/important') && r.request().method() === 'PATCH'
    );
    await row.locator('button').filter({ hasText: /[★☆]/ }).click();
    await patchResponse2;

    await expect(row.locator('button').filter({ hasText: /[★☆]/ }).locator('span.text-gray-400')).toBeVisible({ timeout: 10000 });
  });

  test('Test 29c: Filtre étoile n\'affiche que les actions importantes', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTFILT1');
    await expect(page.locator('td', { hasText: 'TESTFILT1' }).first()).toBeVisible({ timeout: 10000 });

    await addStock(page, 'TESTFILT2');
    await expect(page.locator('td', { hasText: 'TESTFILT2' }).first()).toBeVisible();

    // Marquer TESTFILT1 comme importante
    const row1 = page.getByRole('row', { name: /TESTFILT1/ });
    const patchResp = page.waitForResponse(r =>
      r.url().includes('/important') && r.request().method() === 'PATCH'
    );
    await row1.locator('button').filter({ hasText: /[★☆]/ }).click();
    await patchResp;
    await page.waitForResponse(r =>
      r.url().endsWith('/api/stocks') && r.request().method() === 'GET'
    );

    // Activer le filtre étoile
    await page.locator('button[title="Importantes"]').click();

    await expect(page.locator('td', { hasText: 'TESTFILT1' }).first()).toBeVisible();
    await expect(page.locator('td', { hasText: 'TESTFILT2' })).not.toBeVisible();

    // Désactiver le filtre (clic à nouveau)
    await page.locator('button[title="Importantes"]').click();
    await expect(page.locator('td', { hasText: 'TESTFILT2' }).first()).toBeVisible();
  });

  // ─── Filtres EUR / USD ──────────────────────────────────────────────────────

  test('Test 30a: Filtre EUR n\'affiche que les actions en euros', async ({ page, request }) => {
    // Créer les deux actions
    const existing = await (await request.get(API_URL)).json();
    for (const s of existing) {
      if (s.symbol === 'TESTUSD' || s.symbol === 'TESTEUR') await request.delete(`${API_URL}/${s.id}`);
    }
    await request.post(API_URL, { data: { symbol: 'TESTUSD' } });
    await request.post(API_URL, { data: { symbol: 'TESTEUR' } });

    // Mocker la réponse /quotes pour contrôler les devises sans dépendre de Yahoo Finance
    await page.route('**/api/stocks/quotes', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        TESTUSD: { price: 150, currency: 'USD', change: 1, changePercent: 0.67, refreshed_at: new Date().toISOString(), dailyTrend: null },
        TESTEUR: { price: 130, currency: 'EUR', change: -0.5, changePercent: -0.38, refreshed_at: new Date().toISOString(), dailyTrend: null },
      })
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTUSD' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('td', { hasText: 'TESTEUR' }).first()).toBeVisible({ timeout: 10000 });
    // Attendre que les prix mockés soient chargés
    await expect(page.getByRole('row', { name: /TESTUSD/ }).locator('span.font-semibold')).toBeVisible({ timeout: 10000 });

    // Appliquer le filtre EUR
    await page.getByRole('button', { name: '€ EUR' }).click();
    await expect(page.locator('td', { hasText: 'TESTUSD' })).not.toBeVisible();
    await expect(page.locator('td', { hasText: 'TESTEUR' }).first()).toBeVisible();

    // Désactiver le filtre
    await page.getByRole('button', { name: '€ EUR' }).click();
    await expect(page.locator('td', { hasText: 'TESTUSD' }).first()).toBeVisible();
  });

  test('Test 30b: Filtre USD n\'affiche que les actions en dollars', async ({ page, request }) => {
    // Créer les deux actions
    const existing = await (await request.get(API_URL)).json();
    for (const s of existing) {
      if (s.symbol === 'TESTUSD' || s.symbol === 'TESTEUR') await request.delete(`${API_URL}/${s.id}`);
    }
    await request.post(API_URL, { data: { symbol: 'TESTUSD' } });
    await request.post(API_URL, { data: { symbol: 'TESTEUR' } });

    // Mocker la réponse /quotes
    await page.route('**/api/stocks/quotes', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        TESTUSD: { price: 150, currency: 'USD', change: 1, changePercent: 0.67, refreshed_at: new Date().toISOString(), dailyTrend: null },
        TESTEUR: { price: 130, currency: 'EUR', change: -0.5, changePercent: -0.38, refreshed_at: new Date().toISOString(), dailyTrend: null },
      })
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTUSD' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('td', { hasText: 'TESTEUR' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('row', { name: /TESTUSD/ }).locator('span.font-semibold')).toBeVisible({ timeout: 10000 });

    // Appliquer le filtre USD
    await page.getByRole('button', { name: '$ USD' }).click();
    await expect(page.locator('td', { hasText: 'TESTUSD' }).first()).toBeVisible();
    await expect(page.locator('td', { hasText: 'TESTEUR' })).not.toBeVisible();

    // Désactiver le filtre
    await page.getByRole('button', { name: '$ USD' }).click();
    await expect(page.locator('td', { hasText: 'TESTEUR' }).first()).toBeVisible();
  });

  // ─── État vide ──────────────────────────────────────────────────────────────

  test('Test 31: Affichage état vide initial', async ({ page, request }) => {
    const response = await request.get(API_URL);
    const allStocks = await response.json();
    const userStocks = allStocks.filter((s: any) => !s.symbol.startsWith('TEST'));

    for (const stock of allStocks) {
      await request.delete(`${API_URL}/${stock.id}`);
    }

    await page.waitForTimeout(500);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Aucune action enregistrée. Ajoutez-en une ci-dessus !')).toBeVisible({ timeout: 15000 });

    for (const stock of userStocks) {
      await request.post(API_URL, { data: { symbol: stock.symbol } });
    }
  });

  // ─── Modale Statistiques ────────────────────────────────────────────────────

  test('Test 32: Bouton Statistiques visible pour chaque action', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTSTAT1');
    await expect(page.locator('td', { hasText: 'TESTSTAT1' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTSTAT1/ });
    await expect(row.locator('button[title="Statistiques"]')).toBeVisible();
  });

  test('Test 33: Ouverture et fermeture de la modale Statistiques', async ({ page, request }) => {
    await request.post(API_URL, { data: { symbol: 'TESTSTAT2' } });

    await page.route('**/api/stocks/stats/TESTSTAT2', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ symbol: 'TESTSTAT2', dataPoints: 0, currency: null, ma5: null, ma20: null, ma50: null, high: null, low: null, highDate: null, lowDate: null })
    }));
    await page.route('**/api/stocks/quotes/history/TESTSTAT2', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([])
    }));
    await page.route('**/api/stocks/daily-history/TESTSTAT2', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([])
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTSTAT2' }).first()).toBeVisible({ timeout: 10000 });

    const row = page.getByRole('row', { name: /TESTSTAT2/ });

    // Ouvrir la modale
    const statsResp1 = page.waitForResponse(r => r.url().includes('/stats/TESTSTAT2'));
    await row.locator('button[title="Statistiques"]').click();
    await statsResp1;
    await expect(page.locator('h2').filter({ hasText: /Statistiques/ })).toBeVisible();

    // Fermer via le backdrop
    await page.mouse.click(5, 5);
    await expect(page.locator('h2').filter({ hasText: /Statistiques/ })).not.toBeVisible();

    // Rouvrir et fermer via le bouton X
    const statsResp2 = page.waitForResponse(r => r.url().includes('/stats/TESTSTAT2'));
    await row.locator('button[title="Statistiques"]').click();
    await statsResp2;
    await expect(page.locator('h2').filter({ hasText: /Statistiques/ })).toBeVisible();

    await page.locator('.fixed.inset-0 .bg-white').locator('button.text-gray-400').click();
    await expect(page.locator('h2').filter({ hasText: /Statistiques/ })).not.toBeVisible();
  });

  test('Test 34: Modale Statistiques affiche MA, haut/bas et badge Au-dessus/En-dessous', async ({ page, request }) => {
    await request.post(API_URL, { data: { symbol: 'TESTSTAT3' } });

    // Mock quotes avant le goto pour que le prix soit disponible dans la modale
    await page.route('**/api/stocks/quotes', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        TESTSTAT3: { price: 102, currency: 'USD', change: 1, changePercent: 0.99, refreshed_at: new Date().toISOString(), dailyTrend: null, name: 'TESTSTAT3' }
      })
    }));

    await page.route('**/api/stocks/stats/TESTSTAT3', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        symbol: 'TESTSTAT3', currency: 'USD', dataPoints: 10,
        ma5: 100.5, ma20: 98.2, ma50: null,
        high: 110.0, highDate: '2026-01-15',
        low: 85.0, lowDate: '2026-01-05',
      })
    }));
    await page.route('**/api/stocks/quotes/history/TESTSTAT3', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([])
    }));
    await page.route('**/api/stocks/daily-history/TESTSTAT3', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([])
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTSTAT3' }).first()).toBeVisible({ timeout: 10000 });

    const row = page.getByRole('row', { name: /TESTSTAT3/ });
    const statsResp = page.waitForResponse(r => r.url().includes('/stats/TESTSTAT3'));
    await row.locator('button[title="Statistiques"]').click();
    await statsResp;

    const modal = page.locator('.fixed.inset-0 .bg-white').filter({ hasText: /Statistiques/ });
    await expect(modal).toBeVisible();

    // Lignes MA présentes
    await expect(modal.getByText('MA5', { exact: true })).toBeVisible();
    await expect(modal.getByText('MA20', { exact: true })).toBeVisible();
    await expect(modal.getByText('MA50', { exact: true })).toBeVisible();

    // Au moins un badge Au-dessus ou En-dessous (MA5 = 100.5 < prix 102 → Au-dessus)
    await expect(modal.locator('span').filter({ hasText: /Au-dessus|En-dessous/ }).first()).toBeVisible();

    // Plus haut et plus bas
    await expect(modal.getByText('Plus haut')).toBeVisible();
    await expect(modal.getByText('Plus bas')).toBeVisible();

    // Note de bas de modale
    await expect(modal.getByText(/Basé sur 10 jours/)).toBeVisible();
  });

  test('Test 35: API /stats/:symbol retourne la structure correcte', async ({ request }) => {
    await request.post(API_URL, { data: { symbol: 'TESTSTAT4' } });

    const statsResp = await request.get(`${API_URL}/stats/TESTSTAT4`);
    expect(statsResp.ok()).toBeTruthy();

    const stats = await statsResp.json();
    expect(stats).toHaveProperty('symbol', 'TESTSTAT4');
    expect(stats).toHaveProperty('dataPoints');
    expect(stats).toHaveProperty('ma5');
    expect(stats).toHaveProperty('ma20');
    expect(stats).toHaveProperty('ma50');
    expect(stats).toHaveProperty('high');
    expect(stats).toHaveProperty('low');
    // Symbole fictif sans historique → dataPoints = 0, toutes les MAs null
    expect(stats.dataPoints).toBe(0);
    expect(stats.ma5).toBeNull();
    expect(stats.ma20).toBeNull();
    expect(stats.ma50).toBeNull();

    const allStocks = await (await request.get(API_URL)).json();
    for (const stock of allStocks) {
      if (stock.symbol === 'TESTSTAT4') await request.delete(`${API_URL}/${stock.id}`);
    }
  });

  // ─── Modale Recommandations ──────────────────────────────────────────────────

  test('Test 36: Bouton Recommandations visible quand des actions existent', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTRECO1');
    await expect(page.locator('td', { hasText: 'TESTRECO1' }).first()).toBeVisible();

    await expect(page.locator('button[title="Recommandations basées sur les moyennes mobiles"]')).toBeVisible();
  });

  test('Test 37: Ouverture et fermeture de la modale Recommandations', async ({ page, request }) => {
    await request.post(API_URL, { data: { symbol: 'TESTRECO2' } });

    await page.route('**/api/stocks/recommendations', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { symbol: 'TESTRECO2', currency: null, dataPoints: 0, currentPrice: null, ma5: null, ma20: null, ma50: null, rsi: null, macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null, signal: 'insufficient', previousSignal: null, recommendedMA: null, reason: 'Données insuffisantes', alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null }
      ])
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTRECO2' }).first()).toBeVisible({ timeout: 10000 });

    const recoBtn = page.locator('button[title="Recommandations basées sur les moyennes mobiles"]');

    // Ouvrir via le bouton Reco
    const recoResp1 = page.waitForResponse(r => r.url().includes('/recommendations'));
    await recoBtn.click();
    await recoResp1;
    await expect(page.locator('h2').filter({ hasText: 'Recommandations' })).toBeVisible();

    // Fermer via le backdrop
    await page.mouse.click(5, 5);
    await expect(page.locator('h2').filter({ hasText: 'Recommandations' })).not.toBeVisible();

    // Rouvrir et fermer via le bouton X
    const recoResp2 = page.waitForResponse(r => r.url().includes('/recommendations'));
    await recoBtn.click();
    await recoResp2;
    await expect(page.locator('h2').filter({ hasText: 'Recommandations' })).toBeVisible();

    await page.locator('.fixed.inset-0 .bg-white').filter({ hasText: 'Recommandations' }).locator('button.text-gray-400').first().click();
    await expect(page.locator('h2').filter({ hasText: 'Recommandations' })).not.toBeVisible();
  });

  test('Test 38: Modale Recommandations affiche bandeau de synthèse et tableau', async ({ page, request }) => {
    await request.post(API_URL, { data: { symbol: 'TESTRECO3' } });

    await page.route('**/api/stocks/recommendations', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          symbol: 'TESTRECO3', currency: 'USD', dataPoints: 20, currentPrice: 105.0,
          ma5: 100.0, ma20: 95.0, ma50: 90.0, rsi: 65,
          macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null,
          signal: 'buy', previousSignal: null, recommendedMA: 'MA5',
          reason: 'MAs alignées à la hausse — tendance forte',
          alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null
        }
      ])
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTRECO3' }).first()).toBeVisible({ timeout: 10000 });

    const recoBtn = page.locator('button[title="Recommandations basées sur les moyennes mobiles"]');
    const recoResp = page.waitForResponse(r => r.url().includes('/recommendations'));
    await recoBtn.click();
    await recoResp;

    const modal = page.locator('.fixed.inset-0 .bg-white').filter({ hasText: 'Recommandations' });
    await expect(modal).toBeVisible();

    // Bandeau de synthèse : "1 achat" visible (bouton cliquable)
    await expect(modal.locator('button').filter({ hasText: /achat/ })).toBeVisible();

    // En-têtes du tableau
    await expect(modal.getByRole('columnheader', { name: 'Signal' })).toBeVisible();
    await expect(modal.getByRole('columnheader', { name: 'MA Reco' })).toBeVisible();

    // Ligne TESTRECO3 dans le tableau avec signal ACHAT et MA5
    await expect(modal.locator('td').filter({ hasText: 'TESTRECO3' })).toBeVisible();
    await expect(modal.getByRole('row', { name: /TESTRECO3/ }).getByText('ACHAT', { exact: true })).toBeVisible();
    // MA5 dans la colonne MA Reco de la ligne TESTRECO3 (badge bleu)
    // Colonnes : 0=Symbole 1=Prix 2=Var.jour 3=vsMA5 4=vsMA20 5=vsMA50 6=RSI 7=Vol 8=Signal 9=MAReco 10=Pallier 11=icône
    const recoRow = modal.getByRole('row', { name: /TESTRECO3/ });
    await expect(recoRow.locator('td').nth(9).locator('span')).toContainText('MA5');

    // Colonne "vs MA" avec flèches et pourcentages (prix 105 > ma5 100 → ↑ +5.0%)
    await expect(modal.locator('td').filter({ hasText: /↑|↓/ }).first()).toBeVisible();
  });

  test('Test 39: API /recommendations retourne un tableau correctement structuré', async ({ request }) => {
    await request.post(API_URL, { data: { symbol: 'TESTRECAPI' } });

    const recoResp = await request.get(`${API_URL}/recommendations`);
    expect(recoResp.ok()).toBeTruthy();

    const recs = await recoResp.json();
    expect(Array.isArray(recs)).toBeTruthy();

    const rec = recs.find((r: any) => r.symbol === 'TESTRECAPI');
    expect(rec).toBeDefined();
    expect(rec).toHaveProperty('symbol', 'TESTRECAPI');
    expect(rec).toHaveProperty('dataPoints');
    expect(rec).toHaveProperty('currentPrice');
    expect(rec).toHaveProperty('ma5');
    expect(rec).toHaveProperty('ma20');
    expect(rec).toHaveProperty('ma50');
    expect(rec).toHaveProperty('signal');
    expect(rec).toHaveProperty('recommendedMA');
    expect(rec).toHaveProperty('reason');
    expect(rec).toHaveProperty('rsi');
    expect(rec).toHaveProperty('previousSignal');
    expect(rec).toHaveProperty('signalSince');
    expect(rec).toHaveProperty('previousSignalSince');
    expect(rec).toHaveProperty('alertLevel');
    expect(rec).toHaveProperty('confirmLevel');
    // Symbole fictif sans historique
    expect(rec.signal).toBe('insufficient');
    expect(rec.previousSignal).toBeNull();
    expect(rec.signalSince).toBeNull();
    expect(rec.previousSignalSince).toBeNull();
    expect(rec.dataPoints).toBe(0);
    expect(rec.currentPrice).toBeNull();
    expect(rec.rsi).toBeNull();

    const allStocks = await (await request.get(API_URL)).json();
    for (const stock of allStocks) {
      if (stock.symbol === 'TESTRECAPI') await request.delete(`${API_URL}/${stock.id}`);
    }
  });

  test('Test 40: Modale Recommandations suit le filtre actif de la liste principale', async ({ page, request }) => {
    const existing = await (await request.get(API_URL)).json();
    for (const s of existing) {
      if (s.symbol === 'TESTRECEUR' || s.symbol === 'TESTRECUSD') await request.delete(`${API_URL}/${s.id}`);
    }
    await request.post(API_URL, { data: { symbol: 'TESTRECEUR' } });
    await request.post(API_URL, { data: { symbol: 'TESTRECUSD' } });

    // Mock quotes : TESTRECEUR en EUR, TESTRECUSD en USD
    await page.route('**/api/stocks/quotes', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        TESTRECEUR: { price: 130, currency: 'EUR', change: 0, changePercent: 0, refreshed_at: new Date().toISOString(), dailyTrend: null, name: 'TESTRECEUR' },
        TESTRECUSD: { price: 150, currency: 'USD', change: 0, changePercent: 0, refreshed_at: new Date().toISOString(), dailyTrend: null, name: 'TESTRECUSD' },
      })
    }));

    // Mock recommendations : retourne les deux actions
    await page.route('**/api/stocks/recommendations', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { symbol: 'TESTRECEUR', currency: 'EUR', dataPoints: 0, currentPrice: null, ma5: null, ma20: null, ma50: null, rsi: null, macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null, signal: 'insufficient', previousSignal: null, recommendedMA: null, reason: 'Données insuffisantes', alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null },
        { symbol: 'TESTRECUSD', currency: 'USD', dataPoints: 0, currentPrice: null, ma5: null, ma20: null, ma50: null, rsi: null, macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null, signal: 'insufficient', previousSignal: null, recommendedMA: null, reason: 'Données insuffisantes', alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null },
      ])
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTRECEUR' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('td', { hasText: 'TESTRECUSD' }).first()).toBeVisible({ timeout: 10000 });
    // Attendre que les prix mockés soient chargés (nécessaire pour que le filtre EUR fonctionne)
    await expect(page.getByRole('row', { name: /TESTRECEUR/ }).locator('span.font-semibold')).toBeVisible({ timeout: 10000 });

    // Appliquer le filtre EUR → TESTRECUSD disparaît de la liste
    await page.getByRole('button', { name: '€ EUR' }).click();
    await expect(page.locator('td', { hasText: 'TESTRECUSD' })).not.toBeVisible();

    // Ouvrir la modale Recommandations
    const recoResp = page.waitForResponse(r => r.url().includes('/recommendations'));
    await page.locator('button[title="Recommandations basées sur les moyennes mobiles"]').click();
    await recoResp;

    const modal = page.locator('.fixed.inset-0 .bg-white').filter({ hasText: 'Recommandations' });
    await expect(modal).toBeVisible();

    // Seul TESTRECEUR doit apparaître dans le tableau de la modale
    await expect(modal.locator('td').filter({ hasText: 'TESTRECEUR' })).toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTRECUSD' })).not.toBeVisible();
  });

  // ─── Positions / Portefeuille ────────────────────────────────────────────────

  test('Test 41: Bouton Portefeuille visible dans le bandeau principal', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTPF1');
    await expect(page.locator('td', { hasText: 'TESTPF1' }).first()).toBeVisible();

    await expect(page.locator('button[title="Portefeuille — vue des gains/pertes"]')).toBeVisible();
  });

  test('Test 42: Bouton Positions visible sur chaque ligne d\'action', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTPOS1');
    await expect(page.locator('td', { hasText: 'TESTPOS1' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTPOS1/ });
    await expect(row.locator('button[title="Positions / Portefeuille"]')).toBeVisible();
  });

  test('Test 43: Ouverture et fermeture de la modale Positions par action', async ({ page }) => {
    await page.goto('/');

    await addStock(page, 'TESTPOS2');
    await expect(page.locator('td', { hasText: 'TESTPOS2' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTPOS2/ });

    // Ouvrir via le bouton Positions
    await row.locator('button[title="Positions / Portefeuille"]').click();
    await expect(page.locator('h2').filter({ hasText: /Positions/ })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: /TESTPOS2/ })).toBeVisible();

    // Fermer via le backdrop
    await page.mouse.click(5, 5);
    await expect(page.locator('h2').filter({ hasText: /Positions/ })).not.toBeVisible();

    // Rouvrir et fermer via le bouton X
    await row.locator('button[title="Positions / Portefeuille"]').click();
    await expect(page.locator('h2').filter({ hasText: /Positions/ })).toBeVisible();
    await page.locator('.fixed.inset-0 .bg-white').filter({ hasText: /Positions/ }).locator('button.text-gray-400').click();
    await expect(page.locator('h2').filter({ hasText: /Positions/ })).not.toBeVisible();
  });

  test('Test 44: Ajout d\'une position depuis la modale par action', async ({ page, request }) => {
    const POSITIONS_URL = 'http://localhost:3000/api/stocks/positions';

    await page.goto('/');
    await addStock(page, 'TESTPOS3');
    await expect(page.locator('td', { hasText: 'TESTPOS3' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTPOS3/ });
    await row.locator('button[title="Positions / Portefeuille"]').click();
    await expect(page.locator('h2').filter({ hasText: /Positions/ })).toBeVisible();

    await page.getByPlaceholder('ex: 10').fill('5');
    await page.getByPlaceholder('ex: 264.50').fill('100.00');
    await page.getByRole('button', { name: 'Fictif' }).click();

    const postResp = page.waitForResponse(r =>
      r.url().includes('/api/stocks/positions') && r.request().method() === 'POST'
    );
    await page.locator('.fixed.inset-0 .bg-white').filter({ hasText: /Positions/ })
      .getByRole('button', { name: 'Ajouter' }).click();
    await postResp;

    await expect(page.getByText('Positions fictives')).toBeVisible();

    // Nettoyage
    const all = await (await request.get(POSITIONS_URL)).json();
    for (const p of all) {
      if (p.symbol === 'TESTPOS3') await request.delete(`${POSITIONS_URL}/${p.id}`);
    }
  });

  test('Test 45: Suppression d\'une position depuis la modale par action', async ({ page, request }) => {
    const POSITIONS_URL = 'http://localhost:3000/api/stocks/positions';

    await request.post(`http://localhost:3000/api/stocks`, { data: { symbol: 'TESTDEL1' } });
    await request.post(POSITIONS_URL, {
      data: { symbol: 'TESTDEL1', quantity: 3, purchase_price: 50, type: 'real' }
    });

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTDEL1' }).first()).toBeVisible();

    const row = page.getByRole('row', { name: /TESTDEL1/ });
    await row.locator('button[title="Positions / Portefeuille"]').click();
    await expect(page.locator('h2').filter({ hasText: /Positions/ })).toBeVisible();
    await expect(page.getByText('Positions réelles')).toBeVisible();

    const deleteResp = page.waitForResponse(r =>
      r.url().includes('/api/stocks/positions/') && r.request().method() === 'DELETE'
    );
    await page.locator('.fixed.inset-0 .bg-white').filter({ hasText: /Positions/ })
      .locator('tbody button').first().click();
    await deleteResp;

    await expect(page.getByText('Aucune position enregistrée')).toBeVisible();
  });

  test('Test 46: Ouverture et fermeture de la modale Portefeuille global', async ({ page, request }) => {
    const POSITIONS_URL = 'http://localhost:3000/api/stocks/positions';

    await request.post(`http://localhost:3000/api/stocks`, { data: { symbol: 'TESTGPF1' } });
    await request.post(POSITIONS_URL, {
      data: { symbol: 'TESTGPF1', quantity: 2, purchase_price: 80, type: 'fictive' }
    });

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTGPF1' }).first()).toBeVisible();

    await page.locator('button[title="Portefeuille — vue des gains/pertes"]').click();
    await expect(page.locator('h2').filter({ hasText: 'Portefeuille' })).toBeVisible();

    await expect(page.locator('.fixed.inset-0').filter({ hasText: 'Portefeuille' })
      .locator('td').filter({ hasText: 'TESTGPF1' })).toBeVisible();

    // Fermer via le backdrop
    await page.mouse.click(5, 5);
    await expect(page.locator('h2').filter({ hasText: 'Portefeuille' })).not.toBeVisible();

    // Nettoyage
    const allPos = await (await request.get(POSITIONS_URL)).json();
    for (const p of allPos) {
      if (p.symbol === 'TESTGPF1') await request.delete(`${POSITIONS_URL}/${p.id}`);
    }
  });

  test('Test 47: Bouton portefeuille dans la fenêtre Reco ouvre la modale Positions', async ({ page, request }) => {
    await request.post(`http://localhost:3000/api/stocks`, { data: { symbol: 'TESTRECPF' } });

    await page.route('**/api/stocks/recommendations', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { symbol: 'TESTRECPF', currency: null, dataPoints: 0, currentPrice: null, ma5: null, ma20: null, ma50: null, rsi: null, macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null, signal: 'insufficient', previousSignal: null, signalSince: null, previousSignalSince: null, recommendedMA: null, reason: 'Données insuffisantes', alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null }
      ])
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTRECPF' }).first()).toBeVisible({ timeout: 10000 });

    const recoResp = page.waitForResponse(r => r.url().includes('/recommendations'));
    await page.locator('button[title="Recommandations basées sur les moyennes mobiles"]').click();
    await recoResp;
    await expect(page.locator('h2').filter({ hasText: 'Recommandations' })).toBeVisible();

    const recoModal = page.locator('.fixed.inset-0 .bg-white').filter({ hasText: 'Recommandations' });
    await recoModal.locator('button[title="Ajouter une position sur TESTRECPF"]').click();

    await expect(page.locator('h2').filter({ hasText: 'Recommandations' })).not.toBeVisible();
    await expect(page.locator('h2').filter({ hasText: /Positions/ })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: /TESTRECPF/ })).toBeVisible();
  });

  test('Test 49: Filtre par signal dans la fenêtre Recommandations', async ({ page, request }) => {
    for (const sym of ['TESTRF1', 'TESTRF2', 'TESTRF3']) {
      const existing = await (await request.get(API_URL)).json();
      for (const s of existing) {
        if (s.symbol === sym) await request.delete(`${API_URL}/${s.id}`);
      }
      await request.post(API_URL, { data: { symbol: sym } });
    }

    await page.route('**/api/stocks/recommendations', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { symbol: 'TESTRF1', currency: 'USD', dataPoints: 20, currentPrice: 105, ma5: 100, ma20: 95, ma50: 90, rsi: 60, macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null, signal: 'buy', previousSignal: null, signalSince: null, previousSignalSince: null, recommendedMA: 'MA5', reason: 'Tendance haussière', alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null },
        { symbol: 'TESTRF2', currency: 'USD', dataPoints: 20, currentPrice: 80, ma5: 90, ma20: 95, ma50: 100, rsi: 35, macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null, signal: 'sell', previousSignal: null, signalSince: null, previousSignalSince: null, recommendedMA: 'MA20', reason: 'Tendance baissière', alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null },
        { symbol: 'TESTRF3', currency: 'USD', dataPoints: 20, currentPrice: 95, ma5: 90, ma20: 98, ma50: 100, rsi: 50, macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null, signal: 'caution', previousSignal: null, signalSince: null, previousSignalSince: null, recommendedMA: 'MA20', reason: 'Signal mixte', alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null },
      ])
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTRF1' }).first()).toBeVisible({ timeout: 10000 });

    const recoResp = page.waitForResponse(r => r.url().includes('/recommendations'));
    await page.locator('button[title="Recommandations basées sur les moyennes mobiles"]').click();
    await recoResp;

    const modal = page.locator('.fixed.inset-0 .bg-white').filter({ hasText: 'Recommandations' });
    await expect(modal).toBeVisible();

    // Les 3 actions visibles au départ
    await expect(modal.locator('td').filter({ hasText: 'TESTRF1' })).toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTRF2' })).toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTRF3' })).toBeVisible();

    // Clic sur "1 vente" → seul TESTRF2 visible
    await modal.locator('button').filter({ hasText: /vente/ }).click();
    await expect(modal.locator('td').filter({ hasText: 'TESTRF1' })).not.toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTRF2' })).toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTRF3' })).not.toBeVisible();

    // Re-clic (toggle) → tout s'affiche à nouveau
    await modal.locator('button').filter({ hasText: /vente/ }).click();
    await expect(modal.locator('td').filter({ hasText: 'TESTRF1' })).toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTRF3' })).toBeVisible();

    // Clic sur "1 achat" → seul TESTRF1 visible
    await modal.locator('button').filter({ hasText: /achat/ }).click();
    await expect(modal.locator('td').filter({ hasText: 'TESTRF1' })).toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTRF2' })).not.toBeVisible();

    // Bouton "Effacer tous les filtres" efface le filtre
    await modal.locator('button').filter({ hasText: /Effacer tous les filtres/ }).click();
    await expect(modal.locator('td').filter({ hasText: 'TESTRF2' })).toBeVisible();
  });

  test('Test 50: Icône portefeuille bleue (fictif), rouge (réel), grise (aucun)', async ({ page, request }) => {
    const POSITIONS_URL = 'http://localhost:3000/api/stocks/positions';

    for (const sym of ['TESTPFBLUE', 'TESTPFRED', 'TESTPFGREEN']) {
      const existing = await (await request.get(API_URL)).json();
      for (const s of existing) {
        if (s.symbol === sym) await request.delete(`${API_URL}/${s.id}`);
      }
      await request.post(API_URL, { data: { symbol: sym } });
    }

    const posBlue = await (await request.post(POSITIONS_URL, {
      data: { symbol: 'TESTPFBLUE', quantity: 5, purchase_price: 100, type: 'fictive' }
    })).json();
    const posRed = await (await request.post(POSITIONS_URL, {
      data: { symbol: 'TESTPFRED', quantity: 5, purchase_price: 100, type: 'real' }
    })).json();

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTPFBLUE' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('td', { hasText: 'TESTPFRED' }).first()).toBeVisible();
    await expect(page.locator('td', { hasText: 'TESTPFGREEN' }).first()).toBeVisible();

    // Fictif → bleu
    const rowBlue = page.getByRole('row', { name: /TESTPFBLUE/ });
    await expect(rowBlue.locator('button[title="Positions / Portefeuille"]')).toHaveClass(/text-blue-500/);

    // Réel → rouge
    const rowRed = page.getByRole('row', { name: /TESTPFRED/ });
    await expect(rowRed.locator('button[title="Positions / Portefeuille"]')).toHaveClass(/text-red-500/);

    // Aucun → gris
    const rowGreen = page.getByRole('row', { name: /TESTPFGREEN/ });
    await expect(rowGreen.locator('button[title="Positions / Portefeuille"]')).toHaveClass(/text-gray-400/);

    // Nettoyage
    await request.delete(`${POSITIONS_URL}/${posBlue.id}`);
    await request.delete(`${POSITIONS_URL}/${posRed.id}`);
  });

  test('Test 51: Changement de signal affiché dans la fenêtre Recommandations', async ({ page, request }) => {
    const existing = await (await request.get(API_URL)).json();
    for (const s of existing) {
      if (s.symbol === 'TESTSCHANGE') await request.delete(`${API_URL}/${s.id}`);
    }
    await request.post(API_URL, { data: { symbol: 'TESTSCHANGE' } });

    await page.route('**/api/stocks/recommendations', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          symbol: 'TESTSCHANGE', currency: 'USD', dataPoints: 20, currentPrice: 105,
          ma5: 100, ma20: 95, ma50: 90, rsi: 75,
          signal: 'caution', previousSignal: 'buy',
          signalSince: '2026-01-17T14:32:00', previousSignalSince: '2026-01-15',
          recommendedMA: 'MA5', reason: 'RSI en surachat',
          alertLevel: null, confirmLevel: null,
          macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null,
          currentVolume: null, avgVolume20: null, volumeRatio: null
        }
      ])
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTSCHANGE' }).first()).toBeVisible({ timeout: 10000 });

    const recoResp = page.waitForResponse(r => r.url().includes('/recommendations'));
    await page.locator('button[title="Recommandations basées sur les moyennes mobiles"]').click();
    await recoResp;

    const modal = page.locator('.fixed.inset-0 .bg-white').filter({ hasText: 'Recommandations' });
    await expect(modal).toBeVisible();

    // La ligne TESTSCHANGE doit montrer PRUDENCE (actuel) et ACHAT (précédent)
    const recoRow = modal.getByRole('row', { name: /TESTSCHANGE/ });
    await expect(recoRow.getByText('PRUDENCE', { exact: true })).toBeVisible();
    await expect(recoRow.getByText('ACHAT', { exact: true })).toBeVisible();

    // La popup de détail doit aussi montrer le changement : ACHAT → PRUDENCE
    await recoRow.getByText('PRUDENCE', { exact: true }).click();
    const popup = page.locator('.fixed.inset-0').filter({ hasText: 'RSI en surachat' });
    await expect(popup.getByText('ACHAT', { exact: true })).toBeVisible();
    await expect(popup.getByText('PRUDENCE', { exact: true })).toBeVisible();
  });

  test('Test 48: API /positions — création, lecture et suppression', async ({ request }) => {
    const POSITIONS_URL = 'http://localhost:3000/api/stocks/positions';

    await request.post(`http://localhost:3000/api/stocks`, { data: { symbol: 'TESTPOSAPI' } });
    const postResp = await request.post(POSITIONS_URL, {
      data: { symbol: 'TESTPOSAPI', quantity: 10, purchase_price: 120.5, type: 'real' }
    });
    expect(postResp.ok()).toBeTruthy();
    const created = await postResp.json();
    expect(created).toHaveProperty('id');
    expect(created).toHaveProperty('symbol', 'TESTPOSAPI');
    expect(created).toHaveProperty('quantity', 10);
    expect(created).toHaveProperty('purchase_price', 120.5);
    expect(created).toHaveProperty('type', 'real');

    // GET /positions
    const getResp = await request.get(POSITIONS_URL);
    expect(getResp.ok()).toBeTruthy();
    const all = await getResp.json();
    expect(Array.isArray(all)).toBeTruthy();
    expect(all.find((p: any) => p.symbol === 'TESTPOSAPI')).toBeDefined();

    // GET /positions?symbol=TESTPOSAPI
    const filtResp = await request.get(`${POSITIONS_URL}?symbol=TESTPOSAPI`);
    expect(filtResp.ok()).toBeTruthy();
    const filtered = await filtResp.json();
    expect(filtered.every((p: any) => p.symbol === 'TESTPOSAPI')).toBeTruthy();

    // DELETE
    const delResp = await request.delete(`${POSITIONS_URL}/${created.id}`);
    expect(delResp.ok()).toBeTruthy();

    const afterDel = await (await request.get(POSITIONS_URL)).json();
    expect(afterDel.find((p: any) => p.id === created.id)).toBeUndefined();

    // Nettoyage stock
    const stocks = await (await request.get('http://localhost:3000/api/stocks')).json();
    for (const s of stocks) {
      if (s.symbol === 'TESTPOSAPI') await request.delete(`http://localhost:3000/api/stocks/${s.id}`);
    }
  });

  // ─── Filtre position dans Reco ───────────────────────────────────────────────

  test('Test 52: Filtre par position (réel/fictif/non acheté) dans la fenêtre Recommandations', async ({ page, request }) => {
    const POSITIONS_URL = 'http://localhost:3000/api/stocks/positions';
    const syms = ['TESTPFR1', 'TESTPFR2', 'TESTPFR3'];

    for (const sym of syms) {
      const existing = await (await request.get(API_URL)).json();
      for (const s of existing) {
        if (s.symbol === sym) await request.delete(`${API_URL}/${s.id}`);
      }
      await request.post(API_URL, { data: { symbol: sym } });
    }

    // TESTPFR1 → position réelle, TESTPFR2 → fictive, TESTPFR3 → aucune
    const posReal = await (await request.post(POSITIONS_URL, {
      data: { symbol: 'TESTPFR1', quantity: 5, purchase_price: 100, type: 'real' }
    })).json();
    const posFict = await (await request.post(POSITIONS_URL, {
      data: { symbol: 'TESTPFR2', quantity: 3, purchase_price: 90, type: 'fictive' }
    })).json();

    await page.route('**/api/stocks/recommendations', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { symbol: 'TESTPFR1', currency: 'USD', dataPoints: 0, currentPrice: null, ma5: null, ma20: null, ma50: null, rsi: null, macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null, signal: 'insufficient', previousSignal: null, signalSince: null, previousSignalSince: null, recommendedMA: null, reason: 'Données insuffisantes', alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null },
        { symbol: 'TESTPFR2', currency: 'USD', dataPoints: 0, currentPrice: null, ma5: null, ma20: null, ma50: null, rsi: null, macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null, signal: 'insufficient', previousSignal: null, signalSince: null, previousSignalSince: null, recommendedMA: null, reason: 'Données insuffisantes', alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null },
        { symbol: 'TESTPFR3', currency: 'USD', dataPoints: 0, currentPrice: null, ma5: null, ma20: null, ma50: null, rsi: null, macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null, signal: 'insufficient', previousSignal: null, signalSince: null, previousSignalSince: null, recommendedMA: null, reason: 'Données insuffisantes', alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null },
      ])
    }));

    await page.goto('/');
    await expect(page.locator('td', { hasText: 'TESTPFR1' }).first()).toBeVisible({ timeout: 10000 });

    const recoResp = page.waitForResponse(r => r.url().includes('/recommendations'));
    await page.locator('button[title="Recommandations basées sur les moyennes mobiles"]').click();
    await recoResp;

    const modal = page.locator('.fixed.inset-0 .bg-white').filter({ hasText: 'Recommandations' });
    await expect(modal).toBeVisible();

    // Les 3 actions visibles au départ
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR1' })).toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR2' })).toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR3' })).toBeVisible();

    // Filtre "Réel" → seul TESTPFR1 visible
    await modal.locator('button').filter({ hasText: /Réel/ }).click();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR1' })).toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR2' })).not.toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR3' })).not.toBeVisible();

    // Effacer les filtres
    await modal.locator('button').filter({ hasText: /Effacer tous les filtres/ }).click();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR2' })).toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR3' })).toBeVisible();

    // Filtre "Fictif" → seul TESTPFR2 visible
    await modal.locator('button').filter({ hasText: /Fictif/ }).click();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR1' })).not.toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR2' })).toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR3' })).not.toBeVisible();

    // Effacer les filtres
    await modal.locator('button').filter({ hasText: /Effacer tous les filtres/ }).click();

    // Filtre "Non acheté" → seul TESTPFR3 visible
    await modal.locator('button').filter({ hasText: /Non acheté/ }).click();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR1' })).not.toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR2' })).not.toBeVisible();
    await expect(modal.locator('td').filter({ hasText: 'TESTPFR3' })).toBeVisible();

    // Nettoyage
    await request.delete(`${POSITIONS_URL}/${posReal.id}`);
    await request.delete(`${POSITIONS_URL}/${posFict.id}`);
  });

});
