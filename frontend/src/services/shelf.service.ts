import { AxiosInstance, isAxiosError } from 'axios';
import {
  Shelf,
  CreateShelfInput,
  UpdateShelfInput,
  ShelfPaginationQuery,
  PaginatedShelvesResponse,
} from '@/types/shelf';
import {
  createShelfSchema,
  updateShelfSchema,
} from '@/schemas/shelf.schema';
import {
  InsufficientPermissionException,
  ShelfValidationException,
  ShelfServiceException,
} from './shelf.errors';

export const REQUIRED_CREATE_PERMISSION = 'shelf.create';
export const REQUIRED_READ_PERMISSION = 'shelf.read';
export const REQUIRED_UPDATE_PERMISSION = 'shelf.update';
export const REQUIRED_DELETE_PERMISSION = 'shelf.delete';

/**
 * Frontend service for managing Shelves (emplacements de stockage).
 * Handles token session authorization checks, custom exceptions, and Zod validation.
 */
export class ShelfService {
  /**
   * Fast creation of a new Shelf via POST /shelves.
   * Proactively checks for 'shelf.create' permission and validates payload using Zod.
   * Throws InsufficientPermissionException if authorization check fails.
   */
  static async createShelf(
    client: AxiosInstance,
    input: CreateShelfInput,
    userPermissions?: string[],
  ): Promise<Shelf> {
    // 1. Proactive Security Check: Authorization permission check
    if (userPermissions && !userPermissions.includes(REQUIRED_CREATE_PERMISSION)) {
      throw new InsufficientPermissionException(
        REQUIRED_CREATE_PERMISSION,
        `Permission refusée : Vous n'avez pas l'autorisation '${REQUIRED_CREATE_PERMISSION}' pour créer une étagère.`,
      );
    }

    // 2. High-speed client-side Zod validation
    const validationResult = createShelfSchema.safeParse(input);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      validationResult.error.errors.forEach((err) => {
        const field = err.path.join('.') || 'form';
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(err.message);
      });
      throw new ShelfValidationException(
        'Erreur de validation des données d’étagère',
        fieldErrors,
      );
    }

    // 3. Dispatch authenticated POST request to NestJS /shelves
    try {
      const response = await client.post<Shelf>('/shelves', {
        shelfName: validationResult.data.shelfName,
        shelfCode: validationResult.data.shelfCode,
        ...(validationResult.data.stockId ? { stockId: validationResult.data.stockId } : {}),
      });
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        // Backend 403 Forbidden check (PermissionsGuard / ClerkAuthGuard)
        if (error.response?.status === 403) {
          const backendMsg =
            error.response.data?.message ||
            `Accès refusé : Permission '${REQUIRED_CREATE_PERMISSION}' manquante.`;
          throw new InsufficientPermissionException(
            REQUIRED_CREATE_PERMISSION,
            Array.isArray(backendMsg) ? backendMsg.join(', ') : backendMsg,
          );
        }

        // Backend 400 Bad Request (e.g. Duplicate shelfName)
        if (error.response?.status === 400) {
          const backendMsg =
            error.response.data?.message || 'Données d’étagère invalides ou étagère déjà existante.';
          throw new ShelfServiceException(
            Array.isArray(backendMsg) ? backendMsg.join(', ') : backendMsg,
            400,
            error.response.data,
          );
        }

        // Backend 401 Unauthorized (Token missing or expired)
        if (error.response?.status === 401) {
          throw new ShelfServiceException(
            'Session expirée ou non authentifiée. Veuillez vous reconnecter.',
            401,
          );
        }

        throw new ShelfServiceException(
          error.response?.data?.message || error.message || 'Erreur réseau lors de la création de l’étagère.',
          error.response?.status,
        );
      }

      if (error instanceof InsufficientPermissionException || error instanceof ShelfValidationException) {
        throw error;
      }

      throw new ShelfServiceException(
        error instanceof Error ? error.message : 'Erreur inconnue lors de la création de l’étagère.',
      );
    }
  }

  /**
   * Fetch all shelves with pagination support and total counts.
   */
  static async getAllShelves(
    client: AxiosInstance,
    params?: ShelfPaginationQuery,
  ): Promise<PaginatedShelvesResponse> {
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? 10;
      const response = await client.get<Partial<PaginatedShelvesResponse> | Shelf[]>('/shelves', {
        params: {
          page,
          limit,
        },
      });

      if (response.data && !Array.isArray(response.data) && Array.isArray(response.data.shelves)) {
        return {
          shelves: response.data.shelves,
          totalShelves: Number(response.data.totalShelves ?? response.data.shelves.length),
          totalPages: Number(response.data.totalPages ?? 1),
          currentPage: Number(response.data.currentPage ?? page),
          limit: Number(response.data.limit ?? limit),
        };
      }

      if (Array.isArray(response.data)) {
        return {
          shelves: response.data,
          totalShelves: response.data.length,
          totalPages: 1,
          currentPage: 1,
          limit: response.data.length,
        };
      }

      return {
        shelves: [],
        totalShelves: 0,
        totalPages: 1,
        currentPage: page,
        limit,
      };
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 403) {
        throw new InsufficientPermissionException(
          REQUIRED_READ_PERMISSION,
          'Permission refusée pour la consultation des étagères.',
        );
      }
      throw new ShelfServiceException(
        'Impossible de récupérer la liste des étagères.',
      );
    }
  }

  /**
   * Get single shelf by its UUID.
   */
  static async getShelfById(
    client: AxiosInstance,
    id: string,
  ): Promise<Shelf> {
    try {
      const response = await client.get<Shelf>(`/shelves/${id}`);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 403) {
        throw new InsufficientPermissionException(
          REQUIRED_READ_PERMISSION,
          'Permission refusée pour la consultation de cette étagère.',
        );
      }
      throw new ShelfServiceException(
        `Étagère avec l'ID '${id}' introuvable ou inaccessible.`,
      );
    }
  }

  /**
   * Search shelves by name query with pagination support.
   */
  static async searchShelves(
    client: AxiosInstance,
    name: string,
    params?: ShelfPaginationQuery,
  ): Promise<PaginatedShelvesResponse> {
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? 10;
      const response = await client.get<Partial<PaginatedShelvesResponse> | Shelf[]>('/shelves/search', {
        params: {
          shelfName: name,
          page,
          limit,
        },
      });

      if (response.data && !Array.isArray(response.data) && Array.isArray(response.data.shelves)) {
        return {
          shelves: response.data.shelves,
          totalShelves: Number(response.data.totalShelves ?? response.data.shelves.length),
          totalPages: Number(response.data.totalPages ?? 1),
          currentPage: Number(response.data.currentPage ?? page),
          limit: Number(response.data.limit ?? limit),
        };
      }

      if (Array.isArray(response.data)) {
        return {
          shelves: response.data,
          totalShelves: response.data.length,
          totalPages: 1,
          currentPage: 1,
          limit: response.data.length,
        };
      }

      return {
        shelves: [],
        totalShelves: 0,
        totalPages: 1,
        currentPage: page,
        limit,
      };
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 403) {
        throw new InsufficientPermissionException(
          REQUIRED_READ_PERMISSION,
          'Permission refusée pour la recherche d’étagères.',
        );
      }
      throw new ShelfServiceException('Échec de la recherche d’étagères.');
    }
  }

  /**
   * Update an existing shelf.
   */
  static async updateShelf(
    client: AxiosInstance,
    id: string,
    data: UpdateShelfInput,
    userPermissions?: string[],
  ): Promise<Shelf> {
    if (userPermissions && !userPermissions.includes(REQUIRED_UPDATE_PERMISSION)) {
      throw new InsufficientPermissionException(
        REQUIRED_UPDATE_PERMISSION,
        `Permission refusée : Vous n'avez pas le droit '${REQUIRED_UPDATE_PERMISSION}' pour modifier cette étagère.`,
      );
    }

    const validation = updateShelfSchema.safeParse(data);
    if (!validation.success) {
      throw new ShelfValidationException('Données de mise à jour non valides');
    }

    try {
      const response = await client.patch<Shelf>(`/shelves/${id}`, validation.data);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          const backendMsg =
            error.response.data?.message || `Permission '${REQUIRED_UPDATE_PERMISSION}' manquante.`;
          throw new InsufficientPermissionException(
            REQUIRED_UPDATE_PERMISSION,
            Array.isArray(backendMsg) ? backendMsg.join(', ') : backendMsg,
          );
        }

        if (error.response?.status === 401) {
          throw new ShelfServiceException(
            'Session expirée ou non authentifiée. Veuillez vous reconnecter.',
            401,
          );
        }

        const backendMsg =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Erreur lors de la mise à jour de l’étagère.';

        throw new ShelfServiceException(
          Array.isArray(backendMsg) ? backendMsg.join(', ') : backendMsg,
          error.response?.status,
          error.response?.data,
        );
      }

      if (error instanceof InsufficientPermissionException || error instanceof ShelfValidationException) {
        throw error;
      }

      throw new ShelfServiceException(
        error instanceof Error ? error.message : 'Erreur inconnue lors de la mise à jour de l’étagère.',
      );
    }
  }

  /**
   * Delete a shelf by ID.
   */
  static async deleteShelf(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<Shelf> {
    if (userPermissions && !userPermissions.includes(REQUIRED_DELETE_PERMISSION)) {
      throw new InsufficientPermissionException(
        REQUIRED_DELETE_PERMISSION,
        `Permission refusée : Vous n'avez pas le droit '${REQUIRED_DELETE_PERMISSION}' pour supprimer cette étagère.`,
      );
    }

    try {
      const response = await client.delete<Shelf>(`/shelves/${id}`);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          const backendMsg =
            error.response.data?.message || `Permission '${REQUIRED_DELETE_PERMISSION}' manquante.`;
          throw new InsufficientPermissionException(
            REQUIRED_DELETE_PERMISSION,
            Array.isArray(backendMsg) ? backendMsg.join(', ') : backendMsg,
          );
        }

        if (error.response?.status === 401) {
          throw new ShelfServiceException(
            'Session expirée ou non authentifiée. Veuillez vous reconnecter.',
            401,
          );
        }

        const backendMsg =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Erreur lors de la suppression de l’étagère.';

        throw new ShelfServiceException(
          Array.isArray(backendMsg) ? backendMsg.join(', ') : backendMsg,
          error.response?.status,
          error.response?.data,
        );
      }

      if (error instanceof InsufficientPermissionException) {
        throw error;
      }

      throw new ShelfServiceException(
        error instanceof Error ? error.message : 'Erreur inconnue lors de la suppression de l’étagère.',
      );
    }
  }
}
