export interface Stock {
  id?: number;
  symbol: string;
  created_at?: string;
}

export interface QuoteHistory {
  id?: number;
  symbol: string;
  price: number;
  currency: string | null;
  change: number | null;
  change_percent: number | null;
  refreshed_at?: string;
}
