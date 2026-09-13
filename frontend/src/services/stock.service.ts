import { AxiosInstance, isAxiosError } from 'axios';
import {
  Stock,
  StockStatus,
  CreateStockInput,
  UpdateStockInput,
  StockPaginationQuery,
  PaginatedStocksResponse,
} from '@/types/stock';
import {
  createStockSchema,
  updateStockSchema,
} from '@/schemas/stock.schema';

export const REQUIRED_CREATE_STOCK_PERMISSION = 'stock.create';
export const REQUIRED_READ_STOCK_PERMISSION = 'stock.read';
export const REQUIRED_UPDATE_STOCK_PERMISSION = 'stock.update';
export const REQUIRED_DELETE_STOCK_PERMISSION = 'stock.delete';

export class StockService {
  /**
   * Fetch all stocks with pagination and attached shelf counts.
   */
  static async getAllStocks(
    client: AxiosInstance,
    params?: StockPaginationQuery,
  ): Promise<PaginatedStocksResponse> {
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? 10;
      const response = await client.get<Partial<PaginatedStocksResponse> | Stock[]>('/stocks', {
        params: { page, limit },
      });

      if (response.data && !Array.isArray(response.data) && Array.isArray(response.data.stocks)) {
        return {
          stocks: response.data.stocks,
          totalStocks: Number(response.data.totalStocks ?? response.data.stocks.length),
          totalPages: Number(response.data.totalPages ?? 1),
          currentPage: Number(response.data.currentPage ?? page),
          limit: Number(response.data.limit ?? limit),
        };
      }

      if (Array.isArray(response.data)) {
        return {
          stocks: response.data,
          totalStocks: response.data.length,
          totalPages: 1,
          currentPage: 1,
          limit: response.data.length,
        };
      }

      return {
        stocks: [],
        totalStocks: 0,
        totalPages: 1,
        currentPage: page,
        limit,
      };
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Impossible de récupérer la liste des stocks.');
      }
      throw error;
    }
  }

  /**
   * Search stocks by name or status query.
   */
  static async searchStocks(
    client: AxiosInstance,
    query: { stockName?: string; stockStatus?: string },
    params?: StockPaginationQuery,
  ): Promise<PaginatedStocksResponse> {
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? 10;
      const response = await client.get<Partial<PaginatedStocksResponse> | Stock[]>('/stocks/search', {
        params: {
          stockName: query.stockName,
          stockStatus: query.stockStatus,
          page,
          limit,
        },
      });

      if (response.data && !Array.isArray(response.data) && Array.isArray(response.data.stocks)) {
        return {
          stocks: response.data.stocks,
          totalStocks: Number(response.data.totalStocks ?? response.data.stocks.length),
          totalPages: Number(response.data.totalPages ?? 1),
          currentPage: Number(response.data.currentPage ?? page),
          limit: Number(response.data.limit ?? limit),
        };
      }

      return {
        stocks: [],
        totalStocks: 0,
        totalPages: 1,
        currentPage: page,
        limit,
      };
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Erreur lors de la recherche des stocks.');
      }
      throw error;
    }
  }

  /**
   * Get single stock by ID with attached shelves.
   */
  static async getStockById(
    client: AxiosInstance,
    id: string,
  ): Promise<Stock> {
    try {
      const response = await client.get<Stock>(`/stocks/${id}`);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        throw new Error(error.response?.data?.message || `Stock '${id}' introuvable.`);
      }
      throw error;
    }
  }

  /**
   * Create a new stock tuple.
   */
  static async createStock(
    client: AxiosInstance,
    input: CreateStockInput,
  ): Promise<Stock> {
    const validated = createStockSchema.parse(input);
    try {
      const response = await client.post<Stock>('/stocks', validated);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Erreur lors de la création du stock.');
      }
      throw error;
    }
  }

  /**
   * Update an existing stock.
   */
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
      if (isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Erreur lors de la modification du stock.');
      }
      throw error;
    }
  }

  /**
   * Fetch all available stock statuses.
   */
  static async getAllStockStatuses(
    client: AxiosInstance,
  ): Promise<StockStatus[]> {
    try {
      const response = await client.get<StockStatus[]>('/stocks/statuses');
      return response.data;
    } catch {
      return [
        { stockStatusId: 'active', stockStatusName: 'ACTIVE' },
        { stockStatusId: 'inactive', stockStatusName: 'INACTIVE' },
        { stockStatusId: 'archived', stockStatusName: 'ARCHIVED' },
      ];
    }
  }
}
