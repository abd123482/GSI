import type {
  AxiosInstance,
} from 'axios';
import {
  isAxiosError,
} from 'axios';

import {
  createShelfSchema,
  updateShelfSchema,
} from '@/schemas/shelf.schema';
import type {
  CreateShelfInput,
  PaginatedShelfEquipmentResponse,
  PaginatedShelfSerialNumbersResponse,
  PaginatedShelvesResponse,
  Shelf,
  ShelfPaginationQuery,
  UpdateShelfInput,
} from '@/types/shelf';
import {
  InsufficientPermissionException,
  ShelfServiceException,
  ShelfValidationException,
} from './shelf.errors';

export const REQUIRED_CREATE_PERMISSION =
  'shelf.create';
export const REQUIRED_READ_PERMISSION =
  'shelf.read';
export const REQUIRED_UPDATE_PERMISSION =
  'shelf.update';
export const REQUIRED_DELETE_PERMISSION =
  'shelf.delete';

function ensurePermission(
  permissions: string[] | undefined,
  permission: string,
) {
  if (
    permissions &&
    !permissions.includes(permission)
  ) {
    throw new InsufficientPermissionException(
      permission,
      `Permission '${permission}' requise.`,
    );
  }
}

function messageFrom(
  error: unknown,
  fallback: string,
) {
  if (
    isAxiosError(error)
  ) {
    const message =
      error.response?.data?.message;

    if (
      Array.isArray(message)
    ) {
      return message.join(', ');
    }

    if (
      typeof message ===
      'string' &&
      message
    ) {
      return message;
    }

    return (
      error.message ||
      fallback
    );
  }

  return error instanceof Error
    ? error.message
    : fallback;
}

function throwShelfError(
  error: unknown,
  fallback: string,
  permission?: string,
): never {
  if (isAxiosError(error)) {
    if (
      error.response?.status ===
      403 &&
      permission
    ) {
      throw new InsufficientPermissionException(
        permission,
        messageFrom(
          error,
          `Permission '${permission}' requise.`,
        ),
      );
    }

    throw new ShelfServiceException(
      messageFrom(
        error,
        fallback,
      ),
      error.response?.status,
      error.response?.data,
    );
  }

  if (
    error instanceof
    InsufficientPermissionException ||
    error instanceof
    ShelfValidationException ||
    error instanceof
    ShelfServiceException
  ) {
    throw error;
  }

  throw new ShelfServiceException(
    messageFrom(
      error,
      fallback,
    ),
  );
}

export class ShelfService {
  static async createShelf(
    client: AxiosInstance,
    input: CreateShelfInput,
    userPermissions?: string[],
  ): Promise<Shelf> {
    ensurePermission(
      userPermissions,
      REQUIRED_CREATE_PERMISSION,
    );

    const validation =
      createShelfSchema.safeParse(
        input,
      );

    if (!validation.success) {
      const fields:
        Record<
          string,
          string[]
        > = {};

      for (
        const issue of
        validation.error.issues
      ) {
        const field =
          issue.path.join('.') ||
          'form';

        (
          fields[field] ??= []
        ).push(issue.message);
      }

      throw new ShelfValidationException(
        'Données d’emplacement invalides.',
        fields,
      );
    }

    try {
      const response =
        await client.post<Shelf>(
          '/shelves',
          {
            shelfName:
              validation.data
                .shelfName,

            stockId:
              validation.data.stockId === ''
                ? null
                : validation.data.stockId ?? null,
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwShelfError(
        error,
        'Erreur lors de la création de l’emplacement.',
        REQUIRED_CREATE_PERMISSION,
      );
    }
  }

  static async getAllShelves(
    client: AxiosInstance,
    params?: ShelfPaginationQuery,
  ): Promise<PaginatedShelvesResponse> {
    try {
      const response =
        await client.get<PaginatedShelvesResponse>(
          '/shelves',
          {
            params: {
              page:
                params?.page ??
                1,

              limit:
                params?.limit ??
                10,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwShelfError(
        error,
        'Impossible de récupérer les emplacements.',
        REQUIRED_READ_PERMISSION,
      );
    }
  }

  static async searchShelves(
    client: AxiosInstance,
    name: string,
    params?: ShelfPaginationQuery,
  ): Promise<PaginatedShelvesResponse> {
    try {
      const response =
        await client.get<PaginatedShelvesResponse>(
          '/shelves/search',
          {
            params: {
              shelfName:
                name.trim(),
              page:
                params?.page ??
                1,
              limit:
                params?.limit ??
                10,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwShelfError(
        error,
        'Échec de la recherche d’emplacements.',
        REQUIRED_READ_PERMISSION,
      );
    }
  }

  static async getShelfById(
    client: AxiosInstance,
    id: string,
  ): Promise<Shelf> {
    try {
      const response =
        await client.get<Shelf>(
          `/shelves/${id}`,
        );

      return response.data;
    } catch (error: unknown) {
      throwShelfError(
        error,
        `Emplacement '${id}' introuvable ou inaccessible.`,
        REQUIRED_READ_PERMISSION,
      );
    }
  }

  static async updateShelf(
    client: AxiosInstance,
    id: string,
    data: UpdateShelfInput,
    userPermissions?: string[],
  ): Promise<Shelf> {
    ensurePermission(
      userPermissions,
      REQUIRED_UPDATE_PERMISSION,
    );

    const validation =
      updateShelfSchema.safeParse(
        data,
      );

    if (!validation.success) {
      throw new ShelfValidationException(
        'Données de mise à jour non valides.',
      );
    }

    try {
      const payload = {
        ...validation.data,
        ...(validation.data.stockId !== undefined && {
          stockId:
            validation.data.stockId === ''
              ? null
              : validation.data.stockId,
        }),
      };

      const response =
        await client.patch<Shelf>(
          `/shelves/${id}`,
          payload,
        );

      return response.data;
    } catch (error: unknown) {
      throwShelfError(
        error,
        'Erreur lors de la mise à jour de l’emplacement.',
        REQUIRED_UPDATE_PERMISSION,
      );
    }
  }

  static async deleteShelf(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<Shelf> {
    ensurePermission(
      userPermissions,
      REQUIRED_DELETE_PERMISSION,
    );

    try {
      const response =
        await client.delete<Shelf>(
          `/shelves/${id}`,
        );

      return response.data;
    } catch (error: unknown) {
      throwShelfError(
        error,
        'Erreur lors de la suppression de l’emplacement.',
        REQUIRED_DELETE_PERMISSION,
      );
    }
  }

  static async getShelfEquipment(
    client: AxiosInstance,
    id: string,
    pagination: ShelfPaginationQuery = {},
    userPermissions?: string[],
  ): Promise<PaginatedShelfEquipmentResponse> {
    ensurePermission(
      userPermissions,
      REQUIRED_READ_PERMISSION,
    );

    try {
      const response =
        await client.get<PaginatedShelfEquipmentResponse>(
          `/shelves/${id}/equipment`,
          {
            params: {
              page:
                pagination.page ??
                1,
              limit:
                pagination.limit ??
                20,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwShelfError(
        error,
        'Impossible de charger les articles de cet emplacement.',
        REQUIRED_READ_PERMISSION,
      );
    }
  }

  static async getShelfSerialNumbers(
    client: AxiosInstance,
    id: string,
    pagination: ShelfPaginationQuery = {},
    userPermissions?: string[],
  ): Promise<PaginatedShelfSerialNumbersResponse> {
    ensurePermission(
      userPermissions,
      REQUIRED_READ_PERMISSION,
    );

    try {
      const response =
        await client.get<PaginatedShelfSerialNumbersResponse>(
          `/shelves/${id}/serial-numbers`,
          {
            params: {
              page:
                pagination.page ??
                1,
              limit:
                pagination.limit ??
                20,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwShelfError(
        error,
        'Impossible de charger les numéros de série de cet emplacement.',
        REQUIRED_READ_PERMISSION,
      );
    }
  }
}
