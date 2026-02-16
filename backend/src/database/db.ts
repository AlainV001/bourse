import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../../database/stocks.db');
const db = new Database(dbPath);

// Créer la table stocks si elle n'existe pas
db.exec(`
  CREATE TABLE IF NOT EXISTS stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Créer la table quote_history pour stocker l'historique des cours
db.exec(`
  CREATE TABLE IF NOT EXISTS quote_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    price REAL NOT NULL,
    currency TEXT,
    change REAL,
    change_percent REAL,
    refreshed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Créer la table daily_history pour stocker l'historique journalier ouverture/fermeture
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    open_price REAL NOT NULL,
    close_price REAL NOT NULL,
    currency TEXT,
    day_change_percent REAL,
    UNIQUE(symbol, date)
  )
`);

// Migration : supprimer la colonne name si elle existe
try {
  db.prepare('SELECT name FROM stocks LIMIT 1').get();
  // La colonne existe, on migre
  db.exec(`
    CREATE TABLE IF NOT EXISTS stocks_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO stocks_new (id, symbol, created_at) SELECT id, symbol, created_at FROM stocks;
    DROP TABLE stocks;
    ALTER TABLE stocks_new RENAME TO stocks;
  `);
} catch {
  // La colonne n'existe pas, rien à faire
}

export default db;
