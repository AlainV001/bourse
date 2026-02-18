export interface Stock {
  id?: number;
  symbol: string;
  created_at?: string;
  important?: number;
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

export interface DailyHistory {
  id?: number;
  symbol: string;
  date: string;
  open_price: number;
  close_price: number;
  currency: string | null;
  day_change_percent: number | null;
}
