import type { Shelf } from './shelf';

export interface Stock {
  stockId: string;
  stockName: string | null;
  status?: boolean;
  shelves?: Shelf[];
  _count?: { shelves: number };
}

export interface CreateStockInput {
  stockName: string;
  status?: boolean;
}

export interface UpdateStockInput {
  stockName?: string;
  status?: boolean;
}

export interface StockPaginationQuery {
  page?: number;
  limit?: number;
}

export interface SearchStockQuery {
  stockName?: string;
  status?: boolean;
}

export interface PaginatedStocksResponse {
  stocks: Stock[];
  totalStocks: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}
