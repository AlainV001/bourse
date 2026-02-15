import { Router, Request, Response } from 'express';
import db from '../database/db';
import { Stock } from '../types/stock';

const router = Router();

// GET - Récupérer toutes les actions
router.get('/', (req: Request, res: Response) => {
  try {
    const stocks = db.prepare('SELECT * FROM stocks ORDER BY created_at DESC').all();
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

// POST - Créer une nouvelle action
router.post('/', (req: Request, res: Response) => {
  try {
    const { symbol, name } = req.body as Stock;

    if (!symbol || !name) {
      return res.status(400).json({ error: 'Le symbole et le nom sont requis' });
    }

    const stmt = db.prepare('INSERT INTO stocks (symbol, name) VALUES (?, ?)');
    const result = stmt.run(symbol.toUpperCase(), name);

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
    const { symbol, name } = req.body as Stock;

    if (!symbol || !name) {
      return res.status(400).json({ error: 'Le symbole et le nom sont requis' });
    }

    const stmt = db.prepare('UPDATE stocks SET symbol = ?, name = ? WHERE id = ?');
    const result = stmt.run(symbol.toUpperCase(), name, id);

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
