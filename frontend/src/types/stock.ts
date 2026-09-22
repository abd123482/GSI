import type { Shelf } from './shelf';

export type StockStatusName = 'ACTIVE' | 'INACTIVE';

export interface StockStatus {
  stockStatusId: string;
  stockStatusName: StockStatusName;
}

export interface Stock {
  stockId: string;
  stockName: string | null;
  stockStatusId?: string | null;
  stockStatus?: StockStatus | null;
  shelves?: Shelf[];
  _count?: { shelves: number };
}

export interface CreateStockInput {
  stockName: string;
  stockStatus?: StockStatusName;
}

export interface UpdateStockInput {
  stockName?: string;
  stockStatus?: StockStatusName;
}

export interface StockPaginationQuery {
  page?: number;
  limit?: number;
}

export interface SearchStockQuery {
  stockName?: string;
  stockStatus?: StockStatusName;
}

export interface PaginatedStocksResponse {
  stocks: Stock[];
  totalStocks: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}
