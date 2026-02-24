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

    const quotes: Record<string, { price: number; currency: string; change: number; changePercent: number; refreshed_at: string; dailyTrend: number | null; name: string; volume: number | null } | null> = {};

    const YF = require('yahoo-finance2').default;
    const yf = new YF({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

    const refreshedAt = new Date().toISOString();
    const today = refreshedAt.slice(0, 10); // YYYY-MM-DD

    const insertHistory = db.prepare(
      'INSERT INTO quote_history (symbol, price, currency, change, change_percent, refreshed_at) VALUES (?, ?, ?, ?, ?, ?)'
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
          const volume = result.regularMarketVolume ?? null;

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

          // Mettre à jour daily_history selon le cas : même jour ou nouveau jour
          const todayEntry = db.prepare(
            'SELECT open_price FROM daily_history WHERE symbol = ? AND date = ?'
          ).get(symbol, today) as { open_price: number } | undefined;

          if (todayEntry) {
            // Même jour : mettre à jour uniquement le cours de clôture courant et le volume
            const dayPct = ((price - todayEntry.open_price) / todayEntry.open_price) * 100;
            db.prepare(
              `UPDATE daily_history SET close_price = ?, volume = ?, day_change_percent = ? WHERE symbol = ? AND date = ?`
            ).run(price, volume, dayPct, symbol, today);
          } else {
            // Nouveau jour :
            // 1. Mettre à jour la veille avec les données définitives (clôture + volume final)
            try {
              const p1 = new Date(Date.now() - 4 * 24 * 3600 * 1000);
              const histBars: any[] = await yf.historical(symbol, { period1: p1, period2: new Date(), interval: '1d' });
              const recentBar = histBars
                .filter(b => (b.date instanceof Date ? b.date : new Date(b.date)).toISOString().slice(0, 10) < today)
                .sort((a, b) => {
                  const da = (a.date instanceof Date ? a.date : new Date(a.date)).toISOString().slice(0, 10);
                  const db2 = (b.date instanceof Date ? b.date : new Date(b.date)).toISOString().slice(0, 10);
                  return db2.localeCompare(da);
                })[0];
              if (recentBar?.close) {
                const prevDate = (recentBar.date instanceof Date ? recentBar.date : new Date(recentBar.date)).toISOString().slice(0, 10);
                const prevPct = recentBar.open ? ((recentBar.close - recentBar.open) / recentBar.open) * 100 : 0;
                db.prepare(
                  `UPDATE daily_history SET close_price = ?, volume = ?, day_change_percent = ? WHERE symbol = ? AND date = ?`
                ).run(recentBar.close, recentBar.volume ?? null, prevPct, symbol, prevDate);
              }
            } catch {
              // non critique
            }

            // 2. Créer l'entrée du jour avec open_price = clôture définitive de la veille
            const prevClose = db.prepare(
              'SELECT close_price FROM daily_history WHERE symbol = ? AND date < ? ORDER BY date DESC LIMIT 1'
            ).get(symbol, today) as { close_price: number } | undefined;

            const todayOpen = prevClose?.close_price ?? (result.regularMarketOpen ?? 0);
            if (todayOpen > 0) {
              const dayPct = ((price - todayOpen) / todayOpen) * 100;
              db.prepare(
                `INSERT INTO daily_history (symbol, date, open_price, close_price, currency, day_change_percent, volume)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
              ).run(symbol, today, todayOpen, price, currency, dayPct, volume);
            }
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

          quotes[symbol] = { price, currency, change, changePercent, refreshed_at: refreshedAt, dailyTrend, name, volume };
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

// GET - Recommandations pour toutes les actions (basé sur position prix vs MAs + RSI)
router.get('/recommendations', (req: Request, res: Response) => {
  try {
    const stocks = db.prepare('SELECT symbol FROM stocks ORDER BY symbol ASC').all() as { symbol: string }[];

    const results = stocks.map(({ symbol }) => {
      const entries = db.prepare(
        'SELECT date, open_price, close_price, currency, volume FROM daily_history WHERE symbol = ? ORDER BY date DESC LIMIT 50'
      ).all(symbol) as { date: string; open_price: number; close_price: number; currency: string; volume: number | null }[];

      if (entries.length === 0) {
        return { symbol, dataPoints: 0, currentPrice: null, currency: null, ma5: null, ma20: null, ma50: null, rsi: null, macdValue: null, macdSignalValue: null, macdHistogram: null, macdTrend: null, signal: 'insufficient', previousSignal: null, signalSince: null, previousSignalSince: null, recommendedMA: null, reason: 'Données insuffisantes', alertLevel: null, confirmLevel: null, currentVolume: null, avgVolume20: null, volumeRatio: null };
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

      // RSI-14 : nécessite au moins 15 points (14 variations)
      const calcRsi14 = (): number | null => {
        if (closes.length < 15) return null;
        const recent = closes.slice(0, 15).reverse(); // chronologique
        let gains = 0, losses = 0;
        for (let i = 1; i < recent.length; i++) {
          const diff = recent[i] - recent[i - 1];
          if (diff > 0) gains += diff; else losses += Math.abs(diff);
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + avgGain / avgLoss));
      };
      const rsi = calcRsi14();

      // MACD(12, 26, 9) — nécessite au moins 35 points
      const calcMACD = (): { macd: number; macdSig: number; histogram: number; trend: 'bullish' | 'bearish' | 'neutral'; crossover: 'bullish' | 'bearish' | null } | null => {
        if (closes.length < 35) return null;
        const chron = [...closes].reverse(); // ordre chronologique
        const ema = (data: number[], p: number): number[] => {
          if (data.length < p) return [];
          const k = 2 / (p + 1);
          const r = [data.slice(0, p).reduce((a, b) => a + b, 0) / p];
          for (let i = p; i < data.length; i++) r.push(data[i] * k + r[r.length - 1] * (1 - k));
          return r;
        };
        const e12 = ema(chron, 12); // e12[i] correspond à chron[11+i]
        const e26 = ema(chron, 26); // e26[i] correspond à chron[25+i]
        if (e26.length === 0) return null;
        const macdLine: number[] = [];
        for (let i = 0; i < e26.length; i++) {
          if (14 + i >= e12.length) break;
          macdLine.push(e12[14 + i] - e26[i]);
        }
        if (macdLine.length < 9) return null;
        const sigLine = ema(macdLine, 9);
        if (sigLine.length < 2) return null;
        const m = macdLine[macdLine.length - 1];
        const s = sigLine[sigLine.length - 1];
        const hist = m - s;
        const prevHist = macdLine[macdLine.length - 2] - sigLine[sigLine.length - 2];
        let crossover: 'bullish' | 'bearish' | null = null;
        if (prevHist <= 0 && hist > 0) crossover = 'bullish';
        else if (prevHist >= 0 && hist < 0) crossover = 'bearish';
        const trend: 'bullish' | 'bearish' | 'neutral' = hist > 0 ? 'bullish' : hist < 0 ? 'bearish' : 'neutral';
        return { macd: m, macdSig: s, histogram: hist, trend, crossover };
      };
      const macdResult = calcMACD();

      const aboveMA5 = ma5 !== null ? currentPrice > ma5 : null;
      const aboveMA20 = ma20 !== null ? currentPrice > ma20 : null;
      const aboveMA50 = ma50 !== null ? currentPrice > ma50 : null;

      const validComparisons = [aboveMA5, aboveMA20, aboveMA50].filter(x => x !== null);
      const aboveCount = validComparisons.filter(x => x === true).length;
      const validCount = validComparisons.length;

      const ma5AboveMA20 = ma5 !== null && ma20 !== null ? ma5 > ma20 : null;
      const ma20AboveMA50 = ma20 !== null && ma50 !== null ? ma20 > ma50 : null;

      // Signal MA brut
      let maSignal: 'buy_strong' | 'buy_medium' | 'sell_strong' | 'sell_medium' | 'caution' | 'insufficient';
      if (validCount === 0) {
        maSignal = 'insufficient';
      } else if (aboveCount === validCount && ma5AboveMA20 === true && ma20AboveMA50 === true) {
        maSignal = 'buy_strong';
      } else if (aboveCount === validCount) {
        maSignal = 'buy_medium';
      } else if (aboveCount === 0 && ma5AboveMA20 === false && ma20AboveMA50 === false) {
        maSignal = 'sell_strong';
      } else if (aboveCount === 0 && validCount > 0) {
        maSignal = 'sell_medium';
      } else {
        maSignal = 'caution';
      }

      let signal: string;
      let recommendedMA: string | null;
      let reason: string;

      const rsiLabel = rsi !== null ? ` (RSI ${rsi.toFixed(0)})` : '';

      if (maSignal === 'insufficient') {
        signal = 'insufficient';
        recommendedMA = null;
        reason = 'Pas assez de données pour calculer les MAs';
      } else if (maSignal === 'buy_strong') {
        if (rsi === null || (rsi >= 50 && rsi <= 70)) {
          signal = 'buy';
          recommendedMA = 'MA5';
          reason = `MAs alignées à la hausse — tendance forte${rsi !== null ? `, RSI sain${rsiLabel}` : ''}, MA5 idéale pour les entrées court terme`;
        } else if (rsi > 70) {
          signal = 'caution';
          recommendedMA = 'MA5';
          reason = `La tendance de fond est haussière : prix au-dessus de toutes les MAs, moyennes mobiles alignées à la hausse. Mais le RSI à ${rsi!.toFixed(0)} indique un surachat — le titre a monté trop vite. Un repli vers la MA5 est probable avant la suite. Attendre ce repli pour entrer à meilleur prix.`;
        } else {
          signal = 'caution';
          recommendedMA = 'MA20';
          reason = `La structure est haussière (MAs alignées, prix au-dessus), mais le RSI à ${rsi!.toFixed(0)} révèle un manque de momentum : les acheteurs ne prennent pas encore clairement le dessus. La hausse n'est pas confirmée en force. Surveiller un retour du RSI au-dessus de 50 avant d'entrer.`;
        }
      } else if (maSignal === 'buy_medium') {
        if (rsi === null || (rsi >= 45 && rsi <= 70)) {
          signal = 'buy';
          recommendedMA = 'MA20';
          reason = `Prix au-dessus des MAs${rsi !== null ? `, RSI sain${rsiLabel}` : ''} — MA20 comme référence`;
        } else if (rsi > 70) {
          signal = 'caution';
          recommendedMA = 'MA20';
          reason = `Le prix est au-dessus des moyennes mobiles (positif), mais le RSI à ${rsi!.toFixed(0)} signale un surachat — le titre a déjà intégré beaucoup de hausse. Un repli technique à court terme est probable. Préférer attendre un retour vers la MA20 pour un meilleur point d'entrée.`;
        } else {
          signal = 'caution';
          recommendedMA = 'MA20';
          reason = `Le prix tient au-dessus des moyennes mobiles, mais le RSI à ${rsi!.toFixed(0)} indique que la dynamique haussière manque d'élan : les acheteurs ne sont pas convaincus. Attendre que le RSI remonte au-dessus de 45 pour confirmer que la hausse reprend de la vigueur.`;
        }
      } else if (maSignal === 'sell_strong') {
        if (rsi === null || (rsi >= 30 && rsi <= 50)) {
          signal = 'sell';
          recommendedMA = 'MA5';
          reason = `MAs alignées à la baisse — tendance baissière forte${rsi !== null ? `, RSI confirme${rsiLabel}` : ''}, MA5 comme résistance`;
        } else if (rsi < 30) {
          signal = 'caution';
          recommendedMA = 'MA20';
          reason = `Les MAs sont alignées à la baisse (tendance baissière structurelle), mais le RSI à ${rsi!.toFixed(0)} indique une survente extrême : le titre a trop baissé trop vite. Un rebond technique est probable à court terme. Ne pas vendre dans la précipitation — attendre la fin du rebond pour réévaluer.`;
        } else {
          signal = 'caution';
          recommendedMA = 'MA20';
          reason = `Les moyennes mobiles indiquent une tendance baissière, mais le RSI à ${rsi!.toFixed(0)} reste élevé : les acheteurs résistent encore et les vendeurs n'ont pas pris le contrôle. Signal contradictoire. Attendre que le RSI passe sous 50 pour confirmer la tendance baissière avant d'agir.`;
        }
      } else if (maSignal === 'sell_medium') {
        if (rsi === null || (rsi >= 30 && rsi <= 60)) {
          signal = 'sell';
          recommendedMA = 'MA20';
          reason = `Prix sous toutes les MAs${rsi !== null ? `, RSI confirme la pression vendeuse${rsiLabel}` : ''} — tendance baissière`;
        } else if (rsi < 30) {
          signal = 'caution';
          recommendedMA = 'MA20';
          reason = `Le prix est passé sous les moyennes mobiles (signal baissier), mais le RSI à ${rsi!.toFixed(0)} signale une survente : une réaction haussière technique est probable à court terme. Ne pas se précipiter à vendre — attendre la fin du rebond pour décider avec plus de visibilité.`;
        } else {
          signal = 'caution';
          recommendedMA = 'MA20';
          reason = `Le prix est sous les moyennes mobiles, mais le RSI à ${rsi!.toFixed(0)} reste fort : les acheteurs n'ont pas encore capitulé. La baisse n'est pas encore confirmée par le momentum. Attendre que le RSI redescende sous 50 avant de conclure à une tendance baissière installée.`;
        }
      } else {
        // caution MA
        if (rsi !== null && rsi > 70) {
          signal = 'caution';
          recommendedMA = 'MA20';
          reason = `Les moyennes mobiles envoient des signaux contradictoires (pas de tendance claire), et le RSI à ${rsi!.toFixed(0)} aggrave la situation en signalant un surachat. Aucun signal d'entrée justifié. Attendre une consolidation et un retour du RSI sous 60 pour y voir plus clair.`;
        } else if (rsi !== null && rsi < 30) {
          signal = 'caution';
          recommendedMA = 'MA20';
          reason = `Les moyennes mobiles sont contradictoires (sans direction définie), mais le RSI à ${rsi!.toFixed(0)} indique une survente : un rebond technique est possible. Surveiller si ce rebond s'accompagne d'un réalignement des MAs pour confirmer un vrai retournement haussier.`;
        } else {
          signal = 'caution';
          recommendedMA = 'MA20';
          reason = `Les moyennes mobiles envoient des signaux mixtes sans direction claire${rsi !== null ? ` et le RSI à ${rsi.toFixed(0)} ne tranche pas` : ''}. Le titre est en phase de consolidation. La MA20 fait office de pivot : une cassure franche au-dessus ou en dessous donnera le prochain signal directionnel.`;
        }
      }

      // MACD — 3ème filtre de confirmation du momentum
      if (macdResult !== null && signal !== 'insufficient') {
        if (signal === 'buy') {
          if (macdResult.trend === 'bearish') {
            signal = 'caution';
            reason = `La structure haussière est en place (MAs alignées, RSI sain), mais le MACD (${macdResult.macd.toFixed(2)}) est sous sa ligne signal (${macdResult.macdSig.toFixed(2)}) : le momentum baissier n'est pas encore inversé. Attendre un croisement haussier du MACD avant d'entrer.`;
          } else {
            const extra = macdResult.crossover === 'bullish' ? ' Croisement haussier du MACD détecté : signal renforcé.' : '';
            reason += ` Le MACD confirme le momentum haussier (${macdResult.macd.toFixed(2)} > ${macdResult.macdSig.toFixed(2)}).${extra}`;
          }
        } else if (signal === 'sell') {
          if (macdResult.trend === 'bullish') {
            signal = 'caution';
            reason = `La structure baissière est en place (MAs alignées, RSI confirme), mais le MACD (${macdResult.macd.toFixed(2)}) est au-dessus de sa ligne signal (${macdResult.macdSig.toFixed(2)}) : le momentum se retourne à la hausse. Ne pas vendre précipitamment — attendre que le MACD repasse sous sa ligne signal.`;
          } else {
            const extra = macdResult.crossover === 'bearish' ? ' Croisement baissier du MACD détecté : signal renforcé.' : '';
            reason += ` Le MACD confirme le momentum baissier (${macdResult.macd.toFixed(2)} < ${macdResult.macdSig.toFixed(2)}).${extra}`;
          }
        } else if (signal === 'caution') {
          if (macdResult.crossover === 'bullish') {
            reason += ` De plus, le MACD vient de croiser sa ligne signal à la hausse (${macdResult.macd.toFixed(2)} > ${macdResult.macdSig.toFixed(2)}) : surveiller un possible retournement haussier.`;
          } else if (macdResult.crossover === 'bearish') {
            reason += ` De plus, le MACD vient de croiser sa ligne signal à la baisse (${macdResult.macd.toFixed(2)} < ${macdResult.macdSig.toFixed(2)}) : surveiller un possible retournement baissier.`;
          } else if (macdResult.trend === 'bullish') {
            reason += ` Le MACD penche haussier (${macdResult.macd.toFixed(2)} > ${macdResult.macdSig.toFixed(2)}), mais ne suffit pas à lever la prudence.`;
          } else if (macdResult.trend === 'bearish') {
            reason += ` Le MACD penche baissier (${macdResult.macd.toFixed(2)} < ${macdResult.macdSig.toFixed(2)}), ce qui renforce la vigilance.`;
          }
        }
      }

      // Volume — 4ème filtre de conviction
      const fmtVol = (v: number): string => {
        if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}G`;
        if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}K`;
        return `${v}`;
      };

      const volEntries = entries.filter(e => e.volume !== null && e.volume! > 0).map(e => e.volume as number);
      let currentVolume: number | null = null;
      let avgVolume20: number | null = null;
      let volumeRatio: number | null = null;

      if (volEntries.length >= 2) {
        currentVolume = volEntries[0];
        const past20 = volEntries.slice(1, 21);
        avgVolume20 = past20.reduce((a, b) => a + b, 0) / past20.length;
        volumeRatio = currentVolume / avgVolume20;
      }

      if (volumeRatio !== null && currentVolume !== null && avgVolume20 !== null && signal !== 'insufficient') {
        const volLabel = `${fmtVol(currentVolume)} vs moy. 20j ${fmtVol(avgVolume20)}`;
        if (signal === 'buy') {
          if (volumeRatio > 1.5) {
            reason += ` Le volume (${volLabel}, ratio ${volumeRatio.toFixed(1)}×) confirme : le mouvement haussier est soutenu par une forte conviction du marché.`;
          } else if (volumeRatio < 0.7) {
            signal = 'caution';
            reason = `Signal haussier (MAs, RSI, MACD) mais volume insuffisant (${volLabel}, ratio ${volumeRatio.toFixed(1)}×) : le mouvement manque de conviction. Attendre un retour du volume avant d'entrer.`;
          }
        } else if (signal === 'sell') {
          if (volumeRatio > 1.5) {
            reason += ` Le volume (${volLabel}, ratio ${volumeRatio.toFixed(1)}×) confirme : la pression vendeuse est massive et convaincante.`;
          } else if (volumeRatio < 0.7) {
            signal = 'caution';
            reason = `Signal baissier (MAs, RSI, MACD) mais volume insuffisant (${volLabel}, ratio ${volumeRatio.toFixed(1)}×) : la baisse manque de conviction, risque de faux signal. Attendre confirmation.`;
          }
        } else if (signal === 'caution') {
          if (volumeRatio > 2.0) {
            const lastEntry = entries[0];
            if (lastEntry.close_price > lastEntry.open_price) {
              reason += ` Volume exceptionnel (${volumeRatio.toFixed(1)}× la moyenne) sur une séance haussière : fort signal d'accumulation, surveiller un retournement à la hausse.`;
            } else {
              reason += ` Volume exceptionnel (${volumeRatio.toFixed(1)}× la moyenne) sur une séance baissière : fort signal de distribution, surveiller une poursuite à la baisse.`;
            }
          } else if (volumeRatio < 0.7) {
            reason += ` Le faible volume (ratio ${volumeRatio.toFixed(1)}×) confirme une consolidation sans conviction : aucune urgence à agir.`;
          }
        }
      }

      // Pallier de rachat : MAs au-dessus du prix actuel, triées par ordre croissant
      type BuyBackLevel = { price: number; maLabel: string } | null;
      let alertLevel: BuyBackLevel = null;
      let confirmLevel: BuyBackLevel = null;

      if (signal === 'sell' || signal === 'caution') {
        const masAbove = ([
          ma5  !== null && ma5  > currentPrice ? { price: ma5,  maLabel: 'MA5'  } : null,
          ma20 !== null && ma20 > currentPrice ? { price: ma20, maLabel: 'MA20' } : null,
          ma50 !== null && ma50 > currentPrice ? { price: ma50, maLabel: 'MA50' } : null,
        ] as ({ price: number; maLabel: string } | null)[])
          .filter((x): x is { price: number; maLabel: string } => x !== null)
          .sort((a, b) => a.price - b.price);

        alertLevel   = masAbove[0] ?? null;
        confirmLevel = masAbove[1] ?? null;
      }

      // Historique des signaux : récupérer le signal de la veille et upsert aujourd'hui
      const today = new Date().toISOString().slice(0, 10);
      const prevSignalRow = db.prepare(
        'SELECT signal FROM signal_history WHERE symbol = ? AND date < ? ORDER BY date DESC LIMIT 1'
      ).get(symbol, today) as { signal: string } | undefined;
      const previousSignal: string | null = prevSignalRow?.signal ?? null;

      const calculatedAt = new Date().toISOString();
      const existingSignalRow = db.prepare(
        'SELECT signal FROM signal_history WHERE symbol = ? AND date = ?'
      ).get(symbol, today) as { signal: string } | undefined;

      if (!existingSignalRow) {
        // Nouvelle entrée du jour
        db.prepare(
          'INSERT INTO signal_history (symbol, date, signal, calculated_at) VALUES (?, ?, ?, ?)'
        ).run(symbol, today, signal, calculatedAt);
      } else if (existingSignalRow.signal !== signal) {
        // Signal changé dans la journée → mettre à jour avec nouvel horodatage
        db.prepare(
          'UPDATE signal_history SET signal = ?, calculated_at = ? WHERE symbol = ? AND date = ?'
        ).run(signal, calculatedAt, symbol, today);
      }
      // Signal identique → ne rien faire, conserver l'horodatage d'origine

      // Date depuis laquelle le signal actuel est actif (début du run consécutif)
      const lastDiffRow = db.prepare(
        'SELECT MAX(date) as d FROM signal_history WHERE symbol = ? AND signal != ? AND date <= ?'
      ).get(symbol, signal, today) as { d: string | null };
      const afterDate = lastDiffRow.d ?? '1970-01-01';
      const signalSinceRow = db.prepare(
        'SELECT MIN(date) as d, calculated_at FROM signal_history WHERE symbol = ? AND signal = ? AND date > ?'
      ).get(symbol, signal, afterDate) as { d: string | null; calculated_at: string | null };
      const signalSince: string | null = signalSinceRow.calculated_at ?? signalSinceRow.d ?? null;

      // Date depuis laquelle le signal PRÉCÉDENT était actif (pour afficher "ACHAT depuis 15/01 → VENTE")
      let previousSignalSince: string | null = null;
      if (previousSignal && previousSignal !== signal) {
        // afterDate = dernier jour du run précédent → chercher le début de ce run
        const prevRunLastDiff = db.prepare(
          'SELECT MAX(date) as d FROM signal_history WHERE symbol = ? AND signal != ? AND date <= ?'
        ).get(symbol, previousSignal, afterDate) as { d: string | null };
        const prevRunAfterDate = prevRunLastDiff.d ?? '1970-01-01';
        const prevSinceRow = db.prepare(
          'SELECT MIN(date) as d FROM signal_history WHERE symbol = ? AND signal = ? AND date > ?'
        ).get(symbol, previousSignal, prevRunAfterDate) as { d: string | null };
        previousSignalSince = prevSinceRow.d ?? null;
      }

      return {
        symbol, currency, dataPoints: entries.length, currentPrice, ma5, ma20, ma50, rsi,
        macdValue: macdResult?.macd ?? null,
        macdSignalValue: macdResult?.macdSig ?? null,
        macdHistogram: macdResult?.histogram ?? null,
        macdTrend: macdResult?.trend ?? null,
        currentVolume, avgVolume20, volumeRatio,
        signal, previousSignal, previousSignalSince, signalSince, recommendedMA, reason, alertLevel, confirmLevel
      };
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors du calcul des recommandations' });
  }
});

// GET - Backfill historique OHLCV + volume (2 ans) pour toutes les actions
router.get('/backfill-history', async (req: Request, res: Response) => {
  try {
    const stocks = db.prepare('SELECT symbol FROM stocks').all() as Stock[];
    const symbols = stocks.map(s => s.symbol);

    if (symbols.length === 0) {
      return res.json({ message: 'Aucune action à traiter', results: [] });
    }

    const YF = require('yahoo-finance2').default;
    const yf = new YF({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

    const period1 = new Date(Date.now() - 50 * 24 * 3600 * 1000);

    const upsertBar = db.prepare(
      `INSERT OR REPLACE INTO daily_history (symbol, date, open_price, close_price, currency, day_change_percent, volume)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const upsertSymbol = db.transaction((symbol: string, bars: any[], currency: string) => {
      let count = 0;
      for (const bar of bars) {
        if (!bar.open || !bar.close) continue;
        const dateStr = (bar.date instanceof Date ? bar.date : new Date(bar.date)).toISOString().slice(0, 10);
        const dayPct = ((bar.close - bar.open) / bar.open) * 100;
        upsertBar.run(symbol, dateStr, bar.open, bar.close, currency, dayPct, bar.volume ?? null);
        count++;
      }
      return count;
    });

    const results: { symbol: string; days: number; error?: string }[] = [];

    for (const symbol of symbols) {
      try {
        // Récupérer la devise depuis l'historique existant
        const currencyRow = db.prepare(
          'SELECT currency FROM daily_history WHERE symbol = ? AND currency IS NOT NULL LIMIT 1'
        ).get(symbol) as { currency: string } | undefined;
        const currency = currencyRow?.currency ?? 'USD';

        const bars: any[] = await yf.historical(symbol, { period1, period2: new Date(), interval: '1d' });
        const count = upsertSymbol(symbol, bars, currency);
        results.push({ symbol, days: count });
      } catch (e: any) {
        results.push({ symbol, days: 0, error: e.message });
      }
    }

    res.json({ message: 'Backfill terminé', results });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors du backfill historique' });
  }
});

// GET - Récupérer les positions (toutes ou filtrées par symbole)
router.get('/positions', (req: Request, res: Response) => {
  try {
    const { symbol } = req.query;
    const positions = symbol
      ? db.prepare('SELECT * FROM positions WHERE symbol = ? ORDER BY created_at DESC').all(symbol)
      : db.prepare('SELECT * FROM positions ORDER BY symbol ASC, created_at DESC').all();
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des positions' });
  }
});

// POST - Ajouter une position
router.post('/positions', (req: Request, res: Response) => {
  try {
    const { symbol, quantity, purchase_price, type } = req.body;
    if (!symbol || quantity == null || purchase_price == null) {
      return res.status(400).json({ error: 'symbol, quantity et purchase_price sont requis' });
    }
    const result = db.prepare(
      'INSERT INTO positions (symbol, quantity, purchase_price, type) VALUES (?, ?, ?, ?)'
    ).run(String(symbol).toUpperCase(), Number(quantity), Number(purchase_price), type || 'real');
    const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(position);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la création de la position' });
  }
});

// DELETE - Supprimer une position
router.delete('/positions/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM positions WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Position non trouvée' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression de la position' });
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
