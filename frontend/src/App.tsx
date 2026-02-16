import { useState, useEffect, useRef, Fragment } from 'react';

interface Stock {
  id?: number;
  symbol: string;
  created_at?: string;
}

interface Quote {
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  refreshed_at: string;
  dailyTrend: number | null;
}

interface QuoteHistoryEntry {
  id: number;
  symbol: string;
  price: number;
  currency: string;
  change: number;
  change_percent: number;
  refreshed_at: string;
}

function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [symbol, setSymbol] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [historySymbol, setHistorySymbol] = useState<string | null>(null);
  const [history, setHistory] = useState<QuoteHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const API_URL = 'http://localhost:3000/api/stocks';

  const fetchQuotes = async () => {
    try {
      setQuotesLoading(true);
      const response = await fetch(`${API_URL}/quotes`);
      const data = await response.json();
      setQuotes(data);
      const firstQuote = Object.values(data).find((q): q is Quote => q !== null);
      if (firstQuote?.refreshed_at) {
        setLastRefresh(firstQuote.refreshed_at);
      }
    } catch {
      // Silently fail - quotes are not critical
    } finally {
      setQuotesLoading(false);
    }
  };

  // Charger les actions au démarrage
  useEffect(() => {
    fetchStocks();
  }, []);

  // Rafraîchir les cours toutes les 10 minutes
  useEffect(() => {
    if (stocks.length > 0) {
      fetchQuotes();
      intervalRef.current = setInterval(fetchQuotes, 600000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stocks]);

  const fetchStocks = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      const data = await response.json();
      setStocks(data);
    } catch (err) {
      setError('Erreur lors du chargement des actions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!symbol.trim()) {
      setError('Le symbole est requis');
      return;
    }

    try {
      if (editingId) {
        const response = await fetch(`${API_URL}/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }
      } else {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }
      }

      setSymbol('');
      setEditingId(null);
      fetchStocks();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleEdit = (stock: Stock) => {
    setSymbol(stock.symbol);
    setEditingId(stock.id || null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette action ?')) {
      return;
    }

    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      fetchStocks();
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const toggleHistory = async (sym: string) => {
    if (historySymbol === sym) {
      setHistorySymbol(null);
      setHistory([]);
      return;
    }
    try {
      setHistoryLoading(true);
      setHistorySymbol(sym);
      const response = await fetch(`${API_URL}/quotes/history/${sym}`);
      const data = await response.json();
      setHistory(data);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCancel = () => {
    setSymbol('');
    setEditingId(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Gestion des Actions Boursières</h1>

        {/* Formulaire */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'Modifier une action' : 'Ajouter une action'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Symbole (ex: AAPL, GOOGL)
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="AAPL"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {editingId ? 'Mettre à jour' : 'Ajouter'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Liste des actions */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Mes Actions</h2>
            {stocks.length > 0 && (
              <div className="flex items-center gap-3">
                {lastRefresh && (
                  <span className="text-xs text-gray-400">
                    Dernier refresh : {new Date(lastRefresh).toLocaleString('fr-FR')}
                  </span>
                )}
                <button
                  onClick={fetchQuotes}
                  disabled={quotesLoading}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {quotesLoading ? 'Chargement...' : 'Rafraîchir les cours'}
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-500">Chargement...</div>
          ) : stocks.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Aucune action enregistrée. Ajoutez-en une ci-dessus !
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symbole
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stocks.map((stock) => (
                  <Fragment key={stock.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-blue-600">
                      {stock.symbol}
                      {quotes[stock.symbol]?.dailyTrend != null && Math.abs(quotes[stock.symbol]!.dailyTrend!) >= 3 && (
                        <span
                          className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded ${
                            quotes[stock.symbol]!.dailyTrend! >= 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {quotes[stock.symbol]!.dailyTrend! >= 0 ? '+' : ''}{quotes[stock.symbol]!.dailyTrend!.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {quotesLoading && !quotes[stock.symbol] ? (
                        <span className="text-gray-400">...</span>
                      ) : quotes[stock.symbol] ? (
                        <div>
                          <span className="font-semibold">
                            {quotes[stock.symbol]!.price.toLocaleString('fr-FR', { style: 'currency', currency: quotes[stock.symbol]!.currency })}
                          </span>
                          <div className={`text-sm ${quotes[stock.symbol]!.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {quotes[stock.symbol]!.change >= 0 ? '+' : ''}
                            {quotes[stock.symbol]!.change.toFixed(2)} ({quotes[stock.symbol]!.changePercent.toFixed(2)}%)
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => toggleHistory(stock.symbol)}
                        className="text-gray-600 hover:text-gray-800 font-medium"
                      >
                        {historySymbol === stock.symbol ? 'Fermer' : 'Historique'}
                      </button>
                      <button
                        onClick={() => handleEdit(stock)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(stock.id!)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                  {historySymbol === stock.symbol && (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 bg-gray-50">
                        {historyLoading ? (
                          <div className="text-center text-gray-500 text-sm">Chargement...</div>
                        ) : history.length === 0 ? (
                          <div className="text-center text-gray-400 text-sm">Aucun historique disponible</div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-gray-500 text-xs uppercase">
                                <th className="py-1 text-left">Date</th>
                                <th className="py-1 text-right">Prix</th>
                                <th className="py-1 text-right">Variation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {history.map((entry) => (
                                <tr key={entry.id}>
                                  <td className="py-1 text-gray-600">
                                    {new Date(entry.refreshed_at).toLocaleString('fr-FR')}
                                  </td>
                                  <td className="py-1 text-right font-medium">
                                    {entry.price.toLocaleString('fr-FR', { style: 'currency', currency: entry.currency || 'USD' })}
                                  </td>
                                  <td className={`py-1 text-right ${entry.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {entry.change >= 0 ? '+' : ''}{entry.change.toFixed(2)} ({entry.change_percent.toFixed(2)}%)
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
