import { useState, useEffect } from 'react';

interface Stock {
  id?: number;
  symbol: string;
  name: string;
  created_at?: string;
}

function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_URL = 'http://localhost:3000/api/stocks';

  // Charger les actions au démarrage
  useEffect(() => {
    fetchStocks();
  }, []);

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

    if (!symbol.trim() || !name.trim()) {
      setError('Le symbole et le nom sont requis');
      return;
    }

    try {
      if (editingId) {
        // Mise à jour
        const response = await fetch(`${API_URL}/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, name }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }
      } else {
        // Création
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, name }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }
      }

      setSymbol('');
      setName('');
      setEditingId(null);
      fetchStocks();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleEdit = (stock: Stock) => {
    setSymbol(stock.symbol);
    setName(stock.name);
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

  const handleCancel = () => {
    setSymbol('');
    setName('');
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l'entreprise
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Apple Inc."
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
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Mes Actions</h2>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date d'ajout
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stocks.map((stock) => (
                  <tr key={stock.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-blue-600">
                      {stock.symbol}
                    </td>
                    <td className="px-6 py-4">{stock.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {stock.created_at ? new Date(stock.created_at).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
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
