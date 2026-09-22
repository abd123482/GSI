import type { AxiosInstance } from 'axios';
import { isAxiosError } from 'axios';

import { createStockSchema, updateStockSchema } from '@/schemas/stock.schema';
import type {
  CreateStockInput,
  PaginatedStocksResponse,
  SearchStockQuery,
  Stock,
  StockPaginationQuery,
  StockStatus,
  UpdateStockInput,
} from '@/types/stock';

export const REQUIRED_CREATE_STOCK_PERMISSION = 'stock.create';
export const REQUIRED_READ_STOCK_PERMISSION = 'stock.read';
export const REQUIRED_UPDATE_STOCK_PERMISSION = 'stock.update';
export const REQUIRED_DELETE_STOCK_PERMISSION = 'stock.delete';

function normalizePage(
  data: Partial<PaginatedStocksResponse> | Stock[],
  page: number,
  limit: number,
): PaginatedStocksResponse {
  if (Array.isArray(data)) {
    return {
      stocks: data,
      totalStocks: data.length,
      totalPages: 1,
      currentPage: 1,
      limit: data.length || limit,
    };
  }

  const stocks = Array.isArray(data?.stocks) ? data.stocks : [];
  return {
    stocks,
    totalStocks: Number(data?.totalStocks ?? stocks.length),
    totalPages: Number(data?.totalPages ?? 1) || 1,
    currentPage: Number(data?.currentPage ?? page),
    limit: Number(data?.limit ?? limit),
  };
}

function throwStockError(error: unknown, fallback: string): never {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) throw new Error(message.join(', '));
    throw new Error(
      typeof message === 'string' && message ? message : error.message || fallback,
    );
  }
  if (error instanceof Error) throw error;
  throw new Error(fallback);
}

export class StockService {
  static async getAllStocks(
    client: AxiosInstance,
    params?: StockPaginationQuery,
  ): Promise<PaginatedStocksResponse> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    try {
      const response = await client.get<Partial<PaginatedStocksResponse> | Stock[]>(
        '/stocks',
        { params: { page, limit } },
      );
      return normalizePage(response.data, page, limit);
    } catch (error: unknown) {
      throwStockError(error, 'Impossible de récupérer la liste des stocks.');
    }
  }

  static async searchStocks(
    client: AxiosInstance,
    query: SearchStockQuery,
    params?: StockPaginationQuery,
  ): Promise<PaginatedStocksResponse> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    try {
      const response = await client.get<Partial<PaginatedStocksResponse> | Stock[]>(
        '/stocks/search',
        {
          params: {
            stockName: query.stockName || undefined,
            stockStatus: query.stockStatus || undefined,
            page,
            limit,
          },
        },
      );
      return normalizePage(response.data, page, limit);
    } catch (error: unknown) {
      throwStockError(error, 'Erreur lors de la recherche des stocks.');
    }
  }

  static async getActiveStocks(
    client: AxiosInstance,
    params: StockPaginationQuery = { page: 1, limit: 100 },
  ): Promise<PaginatedStocksResponse> {
    return this.searchStocks(client, { stockStatus: 'ACTIVE' }, params);
  }

  static async getStockById(client: AxiosInstance, id: string): Promise<Stock> {
    try {
      const response = await client.get<Stock>(`/stocks/${id}`);
      return response.data;
    } catch (error: unknown) {
      throwStockError(error, 'Stock introuvable ou inaccessible.');
    }
  }

  static async createStock(
    client: AxiosInstance,
    input: CreateStockInput,
  ): Promise<Stock> {
    const validated = createStockSchema.parse({
      ...input,
      stockStatus:
        input.stockStatus ??
        'ACTIVE',
    });
    try {
      const response = await client.post<Stock>('/stocks', validated);
      return response.data;
    } catch (error: unknown) {
      throwStockError(error, 'Erreur lors de la création du stock.');
    }
  }

  static async updateStock(
    client: AxiosInstance,
    id: string,
    input: UpdateStockInput,
  ): Promise<Stock> {
    const validated = updateStockSchema.parse(input);
    try {
      const response = await client.patch<Stock>(`/stocks/${id}`, validated);
      return response.data;
    } catch (error: unknown) {
      throwStockError(error, 'Erreur lors de la modification du stock.');
    }
  }

  static async getAllStockStatuses(client: AxiosInstance): Promise<StockStatus[]> {
    try {
      const response = await client.get<StockStatus[]>('/stocks/statuses');
      return response.data.filter(
        (status) =>
          status.stockStatusName === 'ACTIVE' ||
          status.stockStatusName === 'INACTIVE',
      );
    } catch {
      return [
        { stockStatusId: 'active', stockStatusName: 'ACTIVE' },
        { stockStatusId: 'inactive', stockStatusName: 'INACTIVE' },
      ];
    }
  }
}
