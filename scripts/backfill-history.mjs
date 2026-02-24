import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../database/stocks.db');
const db = new Database(dbPath);

const YF = (await import('../backend/node_modules/yahoo-finance2/dist/esm/src/index.js')).default;
const yf = new YF({ suppressNotices: ['yahooSurvey'] });

const period1 = new Date(Date.now() - 50 * 24 * 3600 * 1000).toISOString().slice(0, 10);

const stocks = db.prepare('SELECT symbol FROM stocks').all();
const symbols = stocks.map(s => s.symbol);

if (symbols.length === 0) {
  console.log('Aucune action en base.');
  process.exit(0);
}

console.log(`Chargement de 50 jours d'historique pour : ${symbols.join(', ')}\n`);

const upsertBar = db.prepare(
  `INSERT OR REPLACE INTO daily_history (symbol, date, open_price, close_price, currency, day_change_percent, volume)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const upsertSymbol = db.transaction((symbol, bars, currency) => {
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

for (const symbol of symbols) {
  try {
    process.stdout.write(`  ${symbol.padEnd(10)} ... `);

    const currencyRow = db.prepare(
      'SELECT currency FROM daily_history WHERE symbol = ? AND currency IS NOT NULL LIMIT 1'
    ).get(symbol);
    const currency = currencyRow?.currency ?? 'USD';

    const bars = await yf.historical(symbol, { period1, interval: '1d' });
    const count = upsertSymbol(symbol, bars, currency);

    console.log(`${count} jours chargés`);
  } catch (e) {
    console.log(`ERREUR : ${e.message}`);
  }
}

console.log('\nTerminé.');
db.close();
