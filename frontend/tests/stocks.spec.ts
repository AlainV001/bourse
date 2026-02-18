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
    await page.waitForResponse(r =>
      r.url().endsWith('/api/stocks') && r.request().method() === 'GET'
    );

    await expect(row.locator('button').filter({ hasText: /[★☆]/ }).locator('span.text-yellow-500')).toBeVisible();

    const patchResponse2 = page.waitForResponse(r =>
      r.url().includes('/important') && r.request().method() === 'PATCH'
    );
    await row.locator('button').filter({ hasText: /[★☆]/ }).click();
    await patchResponse2;
    await page.waitForResponse(r =>
      r.url().endsWith('/api/stocks') && r.request().method() === 'GET'
    );

    await expect(row.locator('button').filter({ hasText: /[★☆]/ }).locator('span.text-gray-400')).toBeVisible();
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

});
