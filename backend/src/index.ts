import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import stocksRouter from './routes/stocks';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/stocks', stocksRouter);

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Bourse en cours d\'exécution' });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
