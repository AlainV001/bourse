import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../../database/stocks.db');
const db = new Database(dbPath);

// Créer la table stocks si elle n'existe pas
db.exec(`
  CREATE TABLE IF NOT EXISTS stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export default db;
