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

    const quotes: Record<string, { price: number; currency: string; change: number; changePercent: number; refreshed_at: string; dailyTrend: number | null; name: string } | null> = {};

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
          const name = result.longName ?? result.shortName ?? symbol;

          // Récupérer le dernier cours de la veille avant purge
          const yesterdayClose = db.prepare(
            'SELECT price, currency FROM quote_history WHERE symbol = ? AND refreshed_at < ? ORDER BY refreshed_at DESC LIMIT 1'
          ).get(symbol, today + 'T00:00:00') as { price: number; currency: string } | undefined;

          // Purger les entrées antérieures à aujourd'hui (seul le jour courant est conservé)
          db.prepare('DELETE FROM quote_history WHERE symbol = ? AND refreshed_at < ?').run(symbol, today + 'T00:00:00');

          // Insérer le premier point du jour s'il n'existe pas encore
          // Priorité : clôture de la veille > prix d'ouverture Yahoo Finance
          const openPrice = result.regularMarketOpen ?? 0;
          const { cnt } = hasEntry.get(symbol, today + 'T00:00:00') as { cnt: number };
          if (cnt === 0) {
            const firstPrice = yesterdayClose?.price ?? openPrice;
            const firstCurrency = yesterdayClose?.currency ?? currency;
            if (firstPrice > 0) {
              insertHistory.run(symbol, firstPrice, firstCurrency, 0, 0, today + 'T00:00:00');
            }
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

          quotes[symbol] = { price, currency, change, changePercent, refreshed_at: refreshedAt, dailyTrend, name };
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

// GET - Statistiques (MA5, MA20, MA50, high/low)
router.get('/stats/:symbol', (req: Request, res: Response) => {
  try {
    const symbol = (req.params.symbol as string).toUpperCase();
    const entries = db.prepare(
      'SELECT date, close_price, currency FROM daily_history WHERE symbol = ? ORDER BY date DESC LIMIT 50'
    ).all(symbol) as { date: string; close_price: number; currency: string }[];

    if (entries.length === 0) {
      return res.json({ symbol, ma5: null, ma20: null, ma50: null, high: null, low: null, dataPoints: 0 });
    }

    const closes = entries.map(e => e.close_price);
    const currency = entries[0].currency;

    const ma = (n: number): number | null => {
      if (closes.length < n) return null;
      return closes.slice(0, n).reduce((a, b) => a + b, 0) / n;
    };

    const maxClose = Math.max(...closes);
    const minClose = Math.min(...closes);

    res.json({
      symbol,
      currency,
      dataPoints: entries.length,
      ma5: ma(5),
      ma20: ma(20),
      ma50: ma(50),
      high: maxClose,
      low: minClose,
      highDate: entries.find(e => e.close_price === maxClose)?.date ?? null,
      lowDate: entries.find(e => e.close_price === minClose)?.date ?? null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors du calcul des statistiques' });
  }
});

// GET - Recommandations pour toutes les actions (basé sur position prix vs MAs)
router.get('/recommendations', (req: Request, res: Response) => {
  try {
    const stocks = db.prepare('SELECT symbol FROM stocks ORDER BY symbol ASC').all() as { symbol: string }[];

    const results = stocks.map(({ symbol }) => {
      const entries = db.prepare(
        'SELECT date, close_price, currency FROM daily_history WHERE symbol = ? ORDER BY date DESC LIMIT 50'
      ).all(symbol) as { date: string; close_price: number; currency: string }[];

      if (entries.length === 0) {
        return { symbol, dataPoints: 0, currentPrice: null, currency: null, ma5: null, ma20: null, ma50: null, signal: 'insufficient', recommendedMA: null, reason: 'Données insuffisantes' };
      }

      const closes = entries.map(e => e.close_price);
      const currency = entries[0].currency;
      const currentPrice = closes[0];

      const ma = (n: number): number | null => {
        if (closes.length < n) return null;
        return closes.slice(0, n).reduce((a, b) => a + b, 0) / n;
      };

      const ma5 = ma(5);
      const ma20 = ma(20);
      const ma50 = ma(50);

      const aboveMA5 = ma5 !== null ? currentPrice > ma5 : null;
      const aboveMA20 = ma20 !== null ? currentPrice > ma20 : null;
      const aboveMA50 = ma50 !== null ? currentPrice > ma50 : null;

      const validComparisons = [aboveMA5, aboveMA20, aboveMA50].filter(x => x !== null);
      const aboveCount = validComparisons.filter(x => x === true).length;
      const validCount = validComparisons.length;

      const ma5AboveMA20 = ma5 !== null && ma20 !== null ? ma5 > ma20 : null;
      const ma20AboveMA50 = ma20 !== null && ma50 !== null ? ma20 > ma50 : null;

      let signal: string;
      let recommendedMA: string | null;
      let reason: string;

      if (validCount === 0) {
        signal = 'insufficient';
        recommendedMA = null;
        reason = 'Pas assez de données pour calculer les MAs';
      } else if (aboveCount === validCount && ma5AboveMA20 === true && ma20AboveMA50 === true) {
        signal = 'buy';
        recommendedMA = 'MA5';
        reason = 'MAs alignées à la hausse — tendance forte, MA5 idéale pour les entrées court terme';
      } else if (aboveCount === validCount) {
        signal = 'buy';
        recommendedMA = 'MA20';
        reason = 'Prix au-dessus de toutes les MAs mais alignement incomplet — MA20 comme référence';
      } else if (aboveCount === 0 && ma5AboveMA20 === false && ma20AboveMA50 === false) {
        signal = 'sell';
        recommendedMA = 'MA5';
        reason = 'MAs alignées à la baisse — tendance baissière forte, MA5 comme résistance à surveiller';
      } else if (aboveCount === 0 && validCount > 0) {
        signal = 'sell';
        recommendedMA = 'MA20';
        reason = 'Prix sous toutes les MAs calculées — pression vendeuse dominante';
      } else if (aboveCount > validCount / 2) {
        signal = 'caution';
        recommendedMA = 'MA20';
        reason = 'Tendance haussière partielle — MA20 comme support de référence';
      } else {
        signal = 'caution';
        recommendedMA = 'MA20';
        reason = 'Signaux mixtes — consolidation, MA20 comme pivot central';
      }

      return { symbol, currency, dataPoints: entries.length, currentPrice, ma5, ma20, ma50, signal, recommendedMA, reason };
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors du calcul des recommandations' });
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
