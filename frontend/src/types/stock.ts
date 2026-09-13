import { Shelf } from './shelf';

export interface StockStatus {
  stockStatusId: string;
  stockStatusName: string;
}

export interface Stock {
  stockId: string;
  stockName: string;
  stockStatusId?: string | null;
  stockStatus?: StockStatus | null;
  shelves?: Shelf[];
  _count?: {
    shelves: number;
  };
}

export interface CreateStockInput {
  stockName: string;
  stockStatus?: string;
}

export interface UpdateStockInput {
  stockName?: string;
  stockStatus?: string;
}

export interface StockPaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedStocksResponse {
  stocks: Stock[];
  totalStocks: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}
