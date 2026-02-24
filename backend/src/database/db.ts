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

// Créer la table positions pour le suivi de portefeuille
db.exec(`
  CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    quantity REAL NOT NULL,
    purchase_price REAL NOT NULL,
    type TEXT NOT NULL DEFAULT 'real',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

// Migration : ajouter la colonne important si elle n'existe pas
try {
  db.prepare('SELECT important FROM stocks LIMIT 1').get();
} catch {
  db.exec('ALTER TABLE stocks ADD COLUMN important INTEGER DEFAULT 0');
}

// Migration : ajouter la colonne volume à daily_history si elle n'existe pas
try {
  db.prepare('SELECT volume FROM daily_history LIMIT 1').get();
} catch {
  db.exec('ALTER TABLE daily_history ADD COLUMN volume INTEGER');
}

// Table historique des signaux journaliers
db.exec(`
  CREATE TABLE IF NOT EXISTS signal_history (
    symbol        TEXT NOT NULL,
    date          TEXT NOT NULL,
    signal        TEXT NOT NULL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (symbol, date)
  )
`);

// Migration : ajouter calculated_at à signal_history si elle n'existe pas
try {
  db.prepare('SELECT calculated_at FROM signal_history LIMIT 1').get();
} catch {
  db.exec('ALTER TABLE signal_history ADD COLUMN calculated_at DATETIME');
}

export default db;
