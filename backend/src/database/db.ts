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
