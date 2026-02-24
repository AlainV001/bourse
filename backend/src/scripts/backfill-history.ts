import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../../database/stocks.db');
const db = new Database(dbPath);

async function main() {
  const YF = require('yahoo-finance2').default;
  const yf = new YF({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

  const period1 = new Date(Date.now() - 50 * 24 * 3600 * 1000);
  const period2 = new Date();

  const stocks = db.prepare('SELECT symbol FROM stocks').all() as { symbol: string }[];
  const symbols = stocks.map(s => s.symbol);

  if (symbols.length === 0) {
    console.log('Aucune action en base.');
    return;
  }

  console.log(`\nChargement de 50 jours d'historique pour : ${symbols.join(', ')}`);
  console.log(`Période : ${period1.toISOString().slice(0, 10)} → aujourd'hui\n`);

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

  let totalDays = 0;
  let errors = 0;

  for (const symbol of symbols) {
    try {
      process.stdout.write(`  ${symbol.padEnd(12)}`);

      const currencyRow = db.prepare(
        'SELECT currency FROM daily_history WHERE symbol = ? AND currency IS NOT NULL LIMIT 1'
      ).get(symbol) as { currency: string } | undefined;
      const currency = currencyRow?.currency ?? 'USD';

      const bars: any[] = await yf.historical(symbol, { period1, period2, interval: '1d' });
      const count = upsertSymbol(symbol, bars, currency);
      totalDays += count;

      console.log(`✓  ${count} jours  (${currency})`);
    } catch (e: any) {
      errors++;
      console.log(`✗  ERREUR : ${e.message}`);
    }
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Total : ${totalDays} entrées insérées / mises à jour`);
  if (errors > 0) console.log(`Erreurs : ${errors}`);
  console.log('Terminé.\n');

  db.close();
}

main().catch(e => {
  console.error('Erreur fatale :', e.message);
  process.exit(1);
});
