import { useState, useEffect, useRef, Fragment } from 'react';

interface Stock {
  id?: number;
  symbol: string;
  created_at?: string;
  important?: number;
}

interface Quote {
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  refreshed_at: string;
  dailyTrend: number | null;
  name: string;
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

interface DailyHistoryEntry {
  id: number;
  symbol: string;
  date: string;
  open_price: number;
  close_price: number;
  currency: string;
  day_change_percent: number;
}

interface Recommendation {
  symbol: string;
  currency: string | null;
  dataPoints: number;
  currentPrice: number | null;
  ma5: number | null;
  ma20: number | null;
  ma50: number | null;
  signal: 'buy' | 'sell' | 'caution' | 'insufficient';
  recommendedMA: 'MA5' | 'MA20' | 'MA50' | null;
  reason: string;
}

interface StockStats {
  symbol: string;
  currency: string;
  dataPoints: number;
  ma5: number | null;
  ma20: number | null;
  ma50: number | null;
  high: number | null;
  low: number | null;
  highDate: string | null;
  lowDate: string | null;
}

interface TrendSequence {
  startDate: string;
  endDate: string;
  startPrice: number;
  endPrice: number;
  currency: string;
  percent: number;
  direction: 'up' | 'down';
}

function buildTrendSequences(entries: QuoteHistoryEntry[]): TrendSequence[] {
  // entries are DESC, reverse to chronological order
  const sorted = [...entries].reverse();
  if (sorted.length < 2) return [];

  const sequences: TrendSequence[] = [];
  let seqStart = 0;
  let currentDir: 'up' | 'down' = sorted[1].price >= sorted[0].price ? 'up' : 'down';

  for (let i = 2; i < sorted.length; i++) {
    const dir = sorted[i].price >= sorted[i - 1].price ? 'up' : 'down';
    if (dir !== currentDir) {
      // Close current sequence
      const s = sorted[seqStart];
      const e = sorted[i - 1];
      sequences.push({
        startDate: s.refreshed_at,
        endDate: e.refreshed_at,
        startPrice: s.price,
        endPrice: e.price,
        currency: e.currency || 'USD',
        percent: s.price > 0 ? ((e.price - s.price) / s.price) * 100 : 0,
        direction: currentDir,
      });
      seqStart = i - 1;
      currentDir = dir;
    }
  }

  // Close last sequence
  const s = sorted[seqStart];
  const e = sorted[sorted.length - 1];
  sequences.push({
    startDate: s.refreshed_at,
    endDate: e.refreshed_at,
    startPrice: s.price,
    endPrice: e.price,
    currency: e.currency || 'USD',
    percent: s.price > 0 ? ((e.price - s.price) / s.price) * 100 : 0,
    direction: currentDir,
  });

  return sequences.reverse(); // most recent first
}

function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [symbol, setSymbol] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [historySymbol, setHistorySymbol] = useState<string | null>(null);
  const [history, setHistory] = useState<QuoteHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dailySymbol, setDailySymbol] = useState<string | null>(null);
  const [dailyHistory, setDailyHistory] = useState<DailyHistoryEntry[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'important' | 'eur' | 'usd'>('all');
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statsSymbol, setStatsSymbol] = useState<string | null>(null);
  const [stats, setStats] = useState<StockStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
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
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      setSymbol('');
      setShowAddModal(false);
      fetchStocks();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement');
    }
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
    // Fermer le panneau daily s'il est ouvert
    setDailySymbol(null);
    setDailyHistory([]);
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

  const toggleImportant = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/${id}/important`, { method: 'PATCH' });
      if (response.ok) {
        fetchStocks();
      }
    } catch {
      // Silently fail
    }
  };

  const filteredStocks = stocks
    .filter((stock) => {
      if (filter === 'important') return stock.important === 1;
      if (filter === 'eur') return quotes[stock.symbol]?.currency === 'EUR';
      if (filter === 'usd') return quotes[stock.symbol]?.currency === 'USD';
      return true;
    })
    .sort((a, b) => {
      if (sortDir === null) return 0;
      const qa = quotes[a.symbol]?.changePercent ?? null;
      const qb = quotes[b.symbol]?.changePercent ?? null;
      if (qa === null && qb === null) return 0;
      if (qa === null) return 1;
      if (qb === null) return -1;
      return sortDir === 'asc' ? qa - qb : qb - qa;
    });

  const toggleDailyHistory = async (sym: string) => {
    if (dailySymbol === sym) {
      setDailySymbol(null);
      setDailyHistory([]);
      return;
    }
    // Fermer le panneau historique s'il est ouvert
    setHistorySymbol(null);
    setHistory([]);
    try {
      setDailyLoading(true);
      setDailySymbol(sym);
      const response = await fetch(`${API_URL}/daily-history/${sym}`);
      const data = await response.json();
      setDailyHistory(data);
    } catch {
      setDailyHistory([]);
    } finally {
      setDailyLoading(false);
    }
  };


  const openStats = async (sym: string) => {
    setStatsLoading(true);
    setStatsSymbol(sym);
    try {
      const response = await fetch(`${API_URL}/stats/${sym}`);
      const data = await response.json();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    setRecommendationsLoading(true);
    setShowRecommendations(true);
    try {
      const response = await fetch(`${API_URL}/recommendations`);
      const data = await response.json();
      setRecommendations(data);
    } catch {
      setRecommendations([]);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-2 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-2">Gestion des Actions Boursières</h1>

        {/* Modale ajout */}
        {showAddModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => { setShowAddModal(false); setError(''); setSymbol(''); }}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Ajouter une action</h2>
                <button
                  onClick={() => { setShowAddModal(false); setError(''); setSymbol(''); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
                    autoFocus
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
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setError(''); setSymbol(''); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modale recommandations */}
        {showRecommendations && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowRecommendations(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Recommandations
                </h2>
                <button onClick={() => setShowRecommendations(false)} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {recommendationsLoading ? (
                <div className="text-center py-12 text-gray-500">Calcul en cours...</div>
              ) : (() => {
                const displayed = filteredStocks
                  .map(s => recommendations.find(r => r.symbol === s.symbol))
                  .filter((r): r is Recommendation => r !== undefined);

                if (displayed.length === 0) return <div className="text-center py-12 text-gray-400">Aucune donnée disponible</div>;

                const actionable = displayed.filter(r => r.signal !== 'insufficient');
                const buys = actionable.filter(r => r.signal === 'buy').length;
                const sells = actionable.filter(r => r.signal === 'sell').length;
                const cautions = actionable.filter(r => r.signal === 'caution').length;

                // Consensus MA
                const maCounts: Record<string, number> = {};
                actionable.forEach(r => { if (r.recommendedMA) maCounts[r.recommendedMA] = (maCounts[r.recommendedMA] ?? 0) + 1; });
                const consensusMA = Object.entries(maCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

                const maDescription: Record<string, string> = {
                  MA5: 'court terme (5 jours) — réactive, idéale en tendance forte',
                  MA20: 'moyen terme (20 jours) — référence équilibrée, tous marchés',
                  MA50: 'long terme (50 jours) — filtre de tendance de fond',
                };

                const fmtPct = (current: number, ma: number) => {
                  const pct = ((current - ma) / ma) * 100;
                  return { pct, label: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', up: pct >= 0 };
                };

                return (
                  <>
                    {/* Bandeau de synthèse */}
                    <div className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-lg flex-shrink-0">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex gap-2">
                          {buys > 0 && <span className="text-sm font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">{buys} achat{buys > 1 ? 's' : ''}</span>}
                          {cautions > 0 && <span className="text-sm font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">{cautions} prudence</span>}
                          {sells > 0 && <span className="text-sm font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">{sells} vente{sells > 1 ? 's' : ''}</span>}
                        </div>
                        {consensusMA && (
                          <div className="text-sm text-violet-800">
                            <span className="font-bold">MA recommandée : {consensusMA}</span>
                            {maDescription[consensusMA] && <span className="text-violet-600 ml-1">— {maDescription[consensusMA]}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tableau */}
                    <div className="overflow-auto flex-1">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr className="text-gray-500 text-xs uppercase border-b">
                            <th className="py-2 text-left">Symbole</th>
                            <th className="py-2 text-right">Prix réf.</th>
                            <th className="py-2 text-right">vs MA5</th>
                            <th className="py-2 text-right">vs MA20</th>
                            <th className="py-2 text-right">vs MA50</th>
                            <th className="py-2 text-center">Signal</th>
                            <th className="py-2 text-center">MA Reco</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {displayed.map((r) => {
                            const cur = r.currentPrice;
                            const ccy = r.currency || 'USD';
                            return (
                              <tr key={r.symbol} className="hover:bg-gray-50" title={r.reason}>
                                <td className="py-2 font-semibold text-blue-600">{r.symbol}</td>
                                <td className="py-2 text-right text-gray-700">
                                  {cur !== null
                                    ? cur.toLocaleString('fr-FR', { style: 'currency', currency: ccy })
                                    : <span className="text-gray-400">—</span>}
                                </td>
                                {([r.ma5, r.ma20, r.ma50] as (number | null)[]).map((ma, i) => {
                                  if (cur === null || ma === null) return <td key={i} className="py-2 text-right text-gray-400">—</td>;
                                  const { label, up } = fmtPct(cur, ma);
                                  return (
                                    <td key={i} className={`py-2 text-right font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
                                      {up ? '↑' : '↓'} {label}
                                    </td>
                                  );
                                })}
                                <td className="py-2 text-center">
                                  {r.signal === 'buy' && <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">ACHAT</span>}
                                  {r.signal === 'sell' && <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">VENTE</span>}
                                  {r.signal === 'caution' && <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">PRUDENCE</span>}
                                  {r.signal === 'insufficient' && <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-400">N/A</span>}
                                </td>
                                <td className="py-2 text-center">
                                  {r.recommendedMA ? (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                      r.recommendedMA === 'MA5' ? 'bg-blue-100 text-blue-700' :
                                      r.recommendedMA === 'MA20' ? 'bg-violet-100 text-violet-700' :
                                      'bg-indigo-100 text-indigo-700'
                                    }`}>{r.recommendedMA}</span>
                                  ) : <span className="text-gray-400">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Légende */}
                    <div className="mt-3 pt-3 border-t flex-shrink-0 text-xs text-gray-400 space-y-0.5">
                      <p><span className="font-semibold text-blue-600">MA5</span> court terme · <span className="font-semibold text-violet-600">MA20</span> moyen terme · <span className="font-semibold text-indigo-600">MA50</span> long terme</p>
                      <p>Le prix de référence est la dernière clôture enregistrée dans l'historique journalier. Survolez une ligne pour voir l'explication du signal.</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Modale statistiques */}
        {statsSymbol && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => { setStatsSymbol(null); setStats(null); }}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  Statistiques — {statsSymbol}
                  {quotes[statsSymbol]?.name && quotes[statsSymbol]!.name !== statsSymbol && (
                    <span className="ml-2 text-sm font-normal text-gray-500">{quotes[statsSymbol]!.name}</span>
                  )}
                </h2>
                <button
                  onClick={() => { setStatsSymbol(null); setStats(null); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {statsLoading ? (
                <div className="text-center py-8 text-gray-500">Chargement...</div>
              ) : !stats || stats.dataPoints === 0 ? (
                <div className="text-center py-8 text-gray-400">Aucune donnée disponible</div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase border-b">
                        <th className="py-2 text-left">Indicateur</th>
                        <th className="py-2 text-right">Valeur</th>
                        <th className="py-2 text-right">Position</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {([['MA5', stats.ma5], ['MA20', stats.ma20], ['MA50', stats.ma50]] as [string, number | null][]).map(([label, value]) => {
                        const currentPrice = quotes[statsSymbol]?.price ?? null;
                        const above = currentPrice !== null && value !== null ? currentPrice > value : null;
                        return (
                          <tr key={label}>
                            <td className="py-2 font-medium text-gray-700">{label}</td>
                            <td className="py-2 text-right">
                              {value !== null
                                ? value.toLocaleString('fr-FR', { style: 'currency', currency: stats.currency || 'USD' })
                                : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="py-2 text-right">
                              {above === null ? (
                                <span className="text-gray-400">—</span>
                              ) : (
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${above ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {above ? 'Au-dessus' : 'En-dessous'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      <tr>
                        <td className="py-2 font-medium text-gray-700">Plus haut</td>
                        <td className="py-2 text-right font-semibold text-green-700">
                          {stats.high !== null
                            ? stats.high.toLocaleString('fr-FR', { style: 'currency', currency: stats.currency || 'USD' })
                            : '—'}
                        </td>
                        <td className="py-2 text-right text-xs text-gray-400">
                          {stats.highDate ? new Date(stats.highDate + 'T00:00:00').toLocaleDateString('fr-FR') : ''}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium text-gray-700">Plus bas</td>
                        <td className="py-2 text-right font-semibold text-red-700">
                          {stats.low !== null
                            ? stats.low.toLocaleString('fr-FR', { style: 'currency', currency: stats.currency || 'USD' })
                            : '—'}
                        </td>
                        <td className="py-2 text-right text-xs text-gray-400">
                          {stats.lowDate ? new Date(stats.lowDate + 'T00:00:00').toLocaleDateString('fr-FR') : ''}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-4 text-xs text-gray-400 text-right">Basé sur {stats.dataPoints} jour{stats.dataPoints > 1 ? 's' : ''} de données</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Liste des actions */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Mes Actions</h2>
              <button
                onClick={() => { setShowAddModal(true); setError(''); }}
                className="w-7 h-7 bg-blue-600 text-white rounded-full hover:bg-blue-700 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Ajouter une action"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              {stocks.length > 0 && (
                <div className="flex gap-1 ml-2">
                  {([['eur', '€ EUR'], ['usd', '$ USD']] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setFilter(filter === value ? 'all' : value)}
                      className={`px-2 py-1 text-xs rounded-md font-medium ${
                        filter === value
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={() => setFilter(filter === 'important' ? 'all' : 'important')}
                    title="Importantes"
                    className={`px-2 py-1 rounded-md border ${
                      filter === 'important'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={filter === 'important' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            {stocks.length > 0 && (
              <div className="flex items-center gap-3">
                {lastRefresh && (
                  <span className="text-xs text-gray-400">
                    Dernier refresh : {new Date(lastRefresh).toLocaleString('fr-FR')}
                  </span>
                )}
                <button
                  onClick={fetchRecommendations}
                  disabled={recommendationsLoading}
                  className="px-3 py-1.5 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500 flex items-center gap-1"
                  title="Recommandations basées sur les moyennes mobiles"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Reco
                </button>
                <button
                  onClick={fetchQuotes}
                  disabled={quotesLoading}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                  title="Rafraîchir les cours"
                >
                  {quotesLoading ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
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
                  <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symbole
                  </th>
                  <th className="px-4 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => setSortDir(d => d === 'desc' ? 'asc' : d === 'asc' ? null : 'desc')}
                      className="inline-flex items-center gap-1 hover:text-gray-800"
                      title="Trier par variation %"
                    >
                      Cours
                      {sortDir === 'desc' && <span>↓</span>}
                      {sortDir === 'asc' && <span>↑</span>}
                      {sortDir === null && <span className="text-gray-300">↕</span>}
                    </button>
                  </th>
                  <th className="px-4 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStocks.map((stock) => (
                  <Fragment key={stock.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-1 whitespace-nowrap font-semibold text-blue-600 text-sm">
                      <button
                        onClick={() => toggleImportant(stock.id!)}
                        className="mr-1 cursor-pointer text-lg"
                        title={stock.important ? 'Retirer des importantes' : 'Marquer comme importante'}
                      >
                        {stock.important ? <span className="text-yellow-500">&#9733;</span> : <span className="text-gray-400">&#9734;</span>}
                      </button>
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
                    <td className="px-4 py-1 text-right text-sm">
                      {quotesLoading && !quotes[stock.symbol] ? (
                        <span className="text-gray-400">...</span>
                      ) : quotes[stock.symbol] ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-semibold">
                            {quotes[stock.symbol]!.price.toLocaleString('fr-FR', { style: 'currency', currency: quotes[stock.symbol]!.currency })}
                          </span>
                          <span className={`${quotes[stock.symbol]!.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {quotes[stock.symbol]!.change >= 0 ? '+' : ''}
                            {quotes[stock.symbol]!.changePercent.toFixed(2)}%
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-1 text-right space-x-2">
                      <button
                        onClick={() => toggleHistory(stock.symbol)}
                        className="text-gray-600 hover:text-gray-800 font-medium inline-flex items-center gap-1"
                        title="Détail des cours du jour"
                      >
                        {historySymbol === stock.symbol ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M3 20h18" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => toggleDailyHistory(stock.symbol)}
                        className="text-purple-600 hover:text-purple-800 font-medium inline-flex items-center gap-1"
                        title="Cours du jour (journalier)"
                      >
                        {dailySymbol === stock.symbol ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => openStats(stock.symbol)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center"
                        title="Statistiques"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </button>
                      <a
                        href={`https://www.bing.com/search?q=${encodeURIComponent((quotes[stock.symbol]?.name ?? stock.symbol) + ' quel marché boursier')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 font-bold inline-flex items-center"
                        title="Bing - Marché boursier"
                      >
                        B
                      </a>
                      <a
                        href={`https://www.google.com/search?q=${stock.symbol}+stock+news&tbm=nws`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-800 font-medium inline-flex items-center"
                        title="News"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h2" />
                        </svg>
                      </a>

                      <button
                        onClick={() => handleDelete(stock.id!)}
                        className="text-red-600 hover:text-red-800 font-medium inline-flex items-center gap-1"
                        title="Supprimer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  {historySymbol === stock.symbol && (
                    <tr>
                      <td colSpan={3} className="px-4 py-2 bg-gray-50">
                        {historyLoading ? (
                          <div className="text-center text-gray-500 text-sm">Chargement...</div>
                        ) : (() => {
                          const sequences = buildTrendSequences(history);
                          return sequences.length === 0 ? (
                            <div className="text-center text-gray-400 text-sm">Historique insuffisant pour détecter des tendances</div>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-gray-500 text-xs uppercase">
                                  <th className="py-1 text-left">Période</th>
                                  <th className="py-1 text-right">Début</th>
                                  <th className="py-1 text-center">→</th>
                                  <th className="py-1 text-right">Fin</th>
                                  <th className="py-1 text-right">Variation</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {sequences.map((seq, i) => (
                                  <tr key={i}>
                                    <td className="py-1 text-gray-600">
                                      {new Date(seq.startDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                                      {' - '}
                                      {new Date(seq.endDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                                    </td>
                                    <td className="py-1 text-right font-medium">
                                      {seq.startPrice.toLocaleString('fr-FR', { style: 'currency', currency: seq.currency })}
                                    </td>
                                    <td className={`py-1 text-center ${seq.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                      {seq.direction === 'up' ? '↗' : '↘'}
                                    </td>
                                    <td className="py-1 text-right font-medium">
                                      {seq.endPrice.toLocaleString('fr-FR', { style: 'currency', currency: seq.currency })}
                                    </td>
                                    <td className={`py-1 text-right font-bold ${seq.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                      {seq.percent >= 0 ? '+' : ''}{seq.percent.toFixed(2)}%
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()}
                      </td>
                    </tr>
                  )}
                  {dailySymbol === stock.symbol && (
                    <tr>
                      <td colSpan={3} className="px-4 py-2 bg-purple-50">
                        {dailyLoading ? (
                          <div className="text-center text-gray-500 text-sm">Chargement...</div>
                        ) : dailyHistory.length === 0 ? (
                          <div className="text-center text-gray-400 text-sm">Aucun historique journalier disponible</div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-gray-500 text-xs uppercase">
                                <th className="py-1 text-left">Date</th>
                                <th className="py-1 text-right">Ouverture</th>
                                <th className="py-1 text-right">Clôture</th>
                                <th className="py-1 text-right">Variation jour</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {dailyHistory.map((entry) => (
                                <tr key={entry.id}>
                                  <td className="py-1 text-gray-600">
                                    {new Date(entry.date + 'T00:00:00').toLocaleDateString('fr-FR')}
                                  </td>
                                  <td className="py-1 text-right font-medium">
                                    {entry.open_price.toLocaleString('fr-FR', { style: 'currency', currency: entry.currency || 'USD' })}
                                  </td>
                                  <td className="py-1 text-right font-medium">
                                    {entry.close_price.toLocaleString('fr-FR', { style: 'currency', currency: entry.currency || 'USD' })}
                                  </td>
                                  <td className={`py-1 text-right font-bold ${entry.day_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {entry.day_change_percent >= 0 ? '+' : ''}{entry.day_change_percent.toFixed(2)}%
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
