import type { AxiosInstance } from 'axios';
import { isAxiosError } from 'axios';
import { createShelfSchema, updateShelfSchema } from '@/schemas/shelf.schema';
import type {
  CreateShelfInput,
  PaginatedShelfSerialNumbersResponse,
  PaginatedShelvesResponse,
  SearchShelfQuery,
  Shelf,
  ShelfPaginationQuery,
  UpdateShelfInput,
} from '@/types/shelf';
import { ShelfServiceException } from './shelf.errors';

export const REQUIRED_CREATE_PERMISSION = 'shelf.create';
export const REQUIRED_READ_PERMISSION = 'shelf.read';
export const REQUIRED_UPDATE_PERMISSION = 'shelf.update';
export const REQUIRED_DELETE_PERMISSION = 'shelf.delete';

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message) return message;
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function throwError(error: unknown, fallback: string): never {
  throw new ShelfServiceException(getErrorMessage(error, fallback));
}

export class ShelfService {
  static async createShelf(client: AxiosInstance, input: CreateShelfInput): Promise<Shelf> {
    const validation = createShelfSchema.safeParse(input);
    if (!validation.success) {
      throw new ShelfServiceException('Données d’emplacement invalides.');
    }
    try {
      const response = await client.post<Shelf>('/shelves', validation.data);
      return response.data;
    } catch (error: unknown) {
      throwError(error, 'Erreur lors de la création de l’emplacement.');
    }
  }

  static async getAllShelves(client: AxiosInstance, params?: ShelfPaginationQuery): Promise<PaginatedShelvesResponse> {
    try {
      const response = await client.get<PaginatedShelvesResponse>('/shelves', {
        params: { page: params?.page ?? 1, limit: params?.limit ?? 12 },
      });
      return response.data;
    } catch (error: unknown) {
      throwError(error, 'Impossible de récupérer les emplacements.');
    }
  }

  static async searchShelves(
    client: AxiosInstance,
    query: SearchShelfQuery,
    params?: ShelfPaginationQuery,
  ): Promise<PaginatedShelvesResponse> {
    try {
      const response = await client.get<PaginatedShelvesResponse>('/shelves/search', {
        params: {
          shelfName: query.shelfName || undefined,
          stockId: query.stockId || undefined,
          status: query.status !== undefined ? query.status : undefined,
          page: params?.page ?? 1,
          limit: params?.limit ?? 12,
        },
      });
      return response.data;
    } catch (error: unknown) {
      throwError(error, 'Échec de la recherche d’emplacements.');
    }
  }

  static async getShelfById(client: AxiosInstance, id: string): Promise<Shelf> {
    try {
      const response = await client.get<Shelf>(`/shelves/${id}`);
      return response.data;
    } catch (error: unknown) {
      throwError(error, 'Emplacement introuvable ou inaccessible.');
    }
  }

  static async updateShelf(client: AxiosInstance, id: string, data: UpdateShelfInput): Promise<Shelf> {
    const validation = updateShelfSchema.safeParse(data);
    if (!validation.success) {
      throw new ShelfServiceException('Données de mise à jour non valides.');
    }
    try {
      const response = await client.patch<Shelf>(`/shelves/${id}`, validation.data);
      return response.data;
    } catch (error: unknown) {
      throwError(error, 'Erreur lors de la mise à jour de l’emplacement.');
    }
  }

  static async deleteShelf(client: AxiosInstance, id: string): Promise<Shelf> {
    try {
      const response = await client.delete<Shelf>(`/shelves/${id}`);
      return response.data;
    } catch (error: unknown) {
      throwError(error, 'Erreur lors de la suppression de l’emplacement.');
    }
  }

  static async getShelfSerialNumbers(
    client: AxiosInstance,
    id: string,
    pagination: ShelfPaginationQuery = {},
  ): Promise<PaginatedShelfSerialNumbersResponse> {
    try {
      const response = await client.get<PaginatedShelfSerialNumbersResponse>(
        `/shelves/${id}/serial-numbers`,
        { params: { page: pagination.page ?? 1, limit: pagination.limit ?? 100 } },
      );
      return response.data;
    } catch (error: unknown) {
      throwError(error, 'Impossible de charger les numéros de série de cet emplacement.');
    }
  }
}
