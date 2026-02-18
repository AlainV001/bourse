import { Router, Request, Response } from 'express';
import db from '../database/db';
import { Stock } from '../types/stock';

const router = Router();

// GET - Récupérer les cours de toutes les actions
router.get('/quotes', async (req: Request, res: Response) => {
  try {
    const stocks = db.prepare('SELECT symbol FROM stocks').all() as Stock[];
    const symbols = stocks.map(s => s.symbol);

    if (symbols.length === 0) {
      return res.json({});
    }

    const quotes: Record<string, { price: number; currency: string; change: number; changePercent: number; refreshed_at: string; dailyTrend: number | null } | null> = {};

    const YF = require('yahoo-finance2').default;
    const yf = new YF({ suppressNotices: ['yahooSurvey'] });

    const refreshedAt = new Date().toISOString();
    const today = refreshedAt.slice(0, 10); // YYYY-MM-DD

    const insertHistory = db.prepare(
      'INSERT INTO quote_history (symbol, price, currency, change, change_percent, refreshed_at) VALUES (?, ?, ?, ?, ?, ?)'
    );

    const insertDailyHistory = db.prepare(
      `INSERT OR REPLACE INTO daily_history (symbol, date, open_price, close_price, currency, day_change_percent)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const getPricesToday = db.prepare(
      'SELECT price FROM quote_history WHERE symbol = ? AND refreshed_at >= ? ORDER BY refreshed_at ASC'
    );

    const hasEntry = db.prepare(
      'SELECT COUNT(*) as cnt FROM quote_history WHERE symbol = ? AND refreshed_at = ?'
    );


    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const result: any = await yf.quote(symbol);
          const price = result.regularMarketPrice ?? 0;
          const currency = result.currency ?? 'USD';
          const change = result.regularMarketChange ?? 0;
          const changePercent = result.regularMarketChangePercent ?? 0;

          // Purger les entrées antérieures à aujourd'hui (seul le jour courant est conservé)
          db.prepare('DELETE FROM quote_history WHERE symbol = ? AND refreshed_at < ?').run(symbol, today + 'T00:00:00');

          // Insérer le prix d'ouverture comme premier point du jour s'il n'existe pas encore
          const openPrice = result.regularMarketOpen ?? 0;
          const { cnt } = hasEntry.get(symbol, today + 'T00:00:00') as { cnt: number };
          if (cnt === 0 && openPrice > 0) {
            insertHistory.run(symbol, openPrice, currency, 0, 0, today + 'T00:00:00');
          }

          insertHistory.run(symbol, price, currency, change, changePercent, refreshedAt);

          // Insérer/mettre à jour l'historique journalier
          if (openPrice > 0) {
            const dayChangePercent = ((price - openPrice) / openPrice) * 100;
            insertDailyHistory.run(symbol, today, openPrice, price, currency, dayChangePercent);
          }

          // Calculer la tendance : plus longue séquence consécutive de hausses ou baisses du jour
          let dailyTrend: number | null = null;
          const pricesToday = getPricesToday.all(symbol, today + 'T00:00:00') as { price: number }[];

          if (pricesToday.length >= 2) {
            // Trouver la séquence consécutive la plus significative (qui se termine au prix actuel)
            let currentStart = pricesToday.length - 2;
            const lastPrice = pricesToday[pricesToday.length - 1].price;
            const prevPrice = pricesToday[pricesToday.length - 2].price;
            const currentDirection = lastPrice >= prevPrice ? 1 : -1;

            // Remonter tant que la direction est la même
            for (let i = pricesToday.length - 2; i >= 1; i--) {
              const dir = pricesToday[i].price >= pricesToday[i - 1].price ? 1 : -1;
              if (dir === currentDirection) {
                currentStart = i - 1;
              } else {
                break;
              }
            }

            const startPrice = pricesToday[currentStart].price;
            if (startPrice > 0) {
              dailyTrend = ((lastPrice - startPrice) / startPrice) * 100;
            }
          }

          quotes[symbol] = { price, currency, change, changePercent, refreshed_at: refreshedAt, dailyTrend };
        } catch {
          quotes[symbol] = null;
        }
      })
    );

    res.json(quotes);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des cours' });
  }
});

// GET - Récupérer l'historique des cours pour un symbole
router.get('/quotes/history/:symbol', (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    const history = db.prepare(
      'SELECT * FROM quote_history WHERE symbol = ? ORDER BY refreshed_at DESC'
    ).all(symbol.toUpperCase());
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
});

// GET - Récupérer l'historique journalier ouverture/fermeture pour un symbole
router.get('/daily-history/:symbol', (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    const history = db.prepare(
      'SELECT * FROM daily_history WHERE symbol = ? ORDER BY date DESC'
    ).all(symbol.toUpperCase());
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique journalier' });
  }
});

// GET - Récupérer toutes les actions
router.get('/', (req: Request, res: Response) => {
  try {
    const stocks = db.prepare('SELECT * FROM stocks ORDER BY symbol ASC').all();
    res.json(stocks);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des actions' });
  }
});

// GET - Récupérer une action par ID
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stock = db.prepare('SELECT * FROM stocks WHERE id = ?').get(id);

    if (!stock) {
      return res.status(404).json({ error: 'Action non trouvée' });
    }

    res.json(stock);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'action' });
  }
});

// PATCH - Basculer le flag important
router.patch('/:id/important', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stock = db.prepare('SELECT * FROM stocks WHERE id = ?').get(id) as Stock | undefined;

    if (!stock) {
      return res.status(404).json({ error: 'Action non trouvée' });
    }

    const newValue = stock.important ? 0 : 1;
    db.prepare('UPDATE stocks SET important = ? WHERE id = ?').run(newValue, id);

    const updatedStock = db.prepare('SELECT * FROM stocks WHERE id = ?').get(id);
    res.json(updatedStock);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du flag important' });
  }
});

// POST - Créer une nouvelle action
router.post('/', (req: Request, res: Response) => {
  try {
    const { symbol } = req.body as Stock;

    if (!symbol) {
      return res.status(400).json({ error: 'Le symbole est requis' });
    }

    const stmt = db.prepare('INSERT INTO stocks (symbol) VALUES (?)');
    const result = stmt.run(symbol.toUpperCase());

    const newStock = db.prepare('SELECT * FROM stocks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newStock);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Cette action existe déjà' });
    }
    res.status(500).json({ error: 'Erreur lors de la création de l\'action' });
  }
});

// PUT - Mettre à jour une action
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { symbol } = req.body as Stock;

    if (!symbol) {
      return res.status(400).json({ error: 'Le symbole est requis' });
    }

    const stmt = db.prepare('UPDATE stocks SET symbol = ? WHERE id = ?');
    const result = stmt.run(symbol.toUpperCase(), id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Action non trouvée' });
    }

    const updatedStock = db.prepare('SELECT * FROM stocks WHERE id = ?').get(id);
    res.json(updatedStock);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Cette action existe déjà' });
    }
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'action' });
  }
});

// DELETE - Supprimer une action
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM stocks WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Action non trouvée' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'action' });
  }
});

export default router;
