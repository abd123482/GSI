import type {
  AxiosInstance,
} from 'axios';
import {
  isAxiosError,
} from 'axios';

import {
  createDirectEquipmentSchema,
  updateEquipmentSchema,
} from '@/schemas/equipment.schema';

import {
  SerialNumberService,
} from '@/services/serial-number.service';

import {
  InsufficientPermissionException,
} from './shelf.errors';

import type {
  CreateEquipmentDirectInput,
  Equipment,
  EquipmentPaginationQuery,
  EquipmentWithShelvesResponse,
  PaginatedEquipmentsResponse,
  PaginatedSerialNumbersResponse,
  UpdateEquipmentInput,
} from '@/types/equipment';

export const REQUIRED_EQUIPMENT_READ_PERMISSION =
  'equipment.read';
export const REQUIRED_EQUIPMENT_CREATE_PERMISSION =
  'equipment.create';
export const REQUIRED_EQUIPMENT_UPDATE_PERMISSION =
  'equipment.update';
export const REQUIRED_EQUIPMENT_DELETE_PERMISSION =
  'equipment.delete';

function ensurePermission(
  permissions:
    | string[]
    | undefined,
  permission: string,
) {
  if (
    permissions &&
    !permissions.includes(
      permission,
    )
  ) {
    throw new InsufficientPermissionException(
      permission,
      `Permission '${permission}' requise.`,
    );
  }
}

function equipmentError(
  error: unknown,
  fallback: string,
): never {
  if (isAxiosError(error)) {
    const message =
      error.response?.data
        ?.message;

    if (
      Array.isArray(
        message,
      )
    ) {
      throw new Error(
        message.join(', '),
      );
    }

    throw new Error(
      typeof message ===
        'string' &&
        message
        ? message
        : error.message ||
          fallback,
    );
  }

  if (
    error instanceof Error
  ) {
    throw error;
  }

  throw new Error(fallback);
}

export class EquipmentService {
  static async getAllEquipments(
    client: AxiosInstance,
    params: EquipmentPaginationQuery = {},
  ): Promise<PaginatedEquipmentsResponse> {
    try {
      const response =
        await client.get<PaginatedEquipmentsResponse>(
          '/equipment',
          {
            params: {
              page:
                params.page ?? 1,
              limit:
                params.limit ?? 20,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      equipmentError(
        error,
        'Impossible de charger les articles.',
      );
    }
  }

  static async searchEquipments(
    client: AxiosInstance,
    query: EquipmentPaginationQuery,
  ): Promise<PaginatedEquipmentsResponse> {
    try {
      const response =
        await client.get<PaginatedEquipmentsResponse>(
          '/equipment/search',
          {
            params: {
              page:
                query.page ?? 1,
              limit:
                query.limit ?? 20,
              equipmentName:
                query.equipmentName,
              hasSerialNumber:
                query.hasSerialNumber,
              equipmentStatus:
                query.equipmentStatus,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      equipmentError(
        error,
        'Impossible de rechercher les articles.',
      );
    }
  }

  static async getEquipmentById(
    client: AxiosInstance,
    id: string,
  ): Promise<Equipment> {
    try {
      const response =
        await client.get<Equipment>(
          `/equipment/${id}`,
        );

      return response.data;
    } catch (error: unknown) {
      equipmentError(
        error,
        'Article introuvable.',
      );
    }
  }

  static async getEquipmentShelves(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<EquipmentWithShelvesResponse> {
    if (
      userPermissions &&
      !userPermissions.includes(REQUIRED_EQUIPMENT_READ_PERMISSION) &&
      !userPermissions.includes('inventory.count') &&
      !userPermissions.includes('inventory.read')
    ) {
      ensurePermission(
        userPermissions,
        REQUIRED_EQUIPMENT_READ_PERMISSION,
      );
    }

    try {
      const response =
        await client.get<EquipmentWithShelvesResponse>(
          `/equipment/${id}/shelves`,
        );

      return response.data;
    } catch (error: unknown) {
      equipmentError(
        error,
        'Impossible de charger les allocations de cet article.',
      );
    }
  }

  static async getSerialNumbersByEquipmentId(
    client: AxiosInstance,
    id: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedSerialNumbersResponse> {
    try {
      const response =
        await client.get<PaginatedSerialNumbersResponse>(
          `/equipment/${id}/serial-numbers`,
          {
            params: {
              page,
              limit,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      equipmentError(
        error,
        'Impossible de charger les numéros de série.',
      );
    }
  }

  static async createEquipmentDirect(
    client: AxiosInstance,
    input: CreateEquipmentDirectInput,
    userPermissions?: string[],
  ): Promise<Equipment> {
    ensurePermission(
      userPermissions,
      REQUIRED_EQUIPMENT_CREATE_PERMISSION,
    );

    const validated =
      createDirectEquipmentSchema.parse({
        equipmentName:
          input.equipmentName,
        hasSerialNumber:
          input.hasSerialNumber,
        minEquipmentQuantity:
          input.minEquipmentQuantity ??
          0,
        equipmentStatus:
          input.equipmentStatus ??
          'ACTIVE',
        serialNumbers:
          input.serialNumbers ??
          [],
      });

    try {
      const response =
        await client.post<Equipment>(
          '/equipment',
          {
            equipmentName:
              validated.equipmentName,
            hasSerialNumber:
              validated.hasSerialNumber,
            minEquipmentQuantity:
              validated.minEquipmentQuantity,
            equipmentStatus:
              validated.equipmentStatus,
          },
        );

      const created =
        response.data;

      if (
        validated.hasSerialNumber &&
        validated.serialNumbers.length
      ) {
        await SerialNumberService.createBatchSerialNumbers(
          client,
          {
            equipmentId:
              created.equipmentId,
            serialNumberCodes:
              validated.serialNumbers,
            serialNumberStatus:
              'AVAILABLE',
          },
          userPermissions,
        );
      }

      return created;
    } catch (error: unknown) {
      equipmentError(
        error,
        'Impossible de créer l’article.',
      );
    }
  }

  static async updateEquipment(
    client: AxiosInstance,
    id: string,
    input: UpdateEquipmentInput,
    userPermissions?: string[],
  ): Promise<Equipment> {
    ensurePermission(
      userPermissions,
      REQUIRED_EQUIPMENT_UPDATE_PERMISSION,
    );

    const validated =
      updateEquipmentSchema.parse(
        input,
      );

    try {
      const response =
        await client.patch<Equipment>(
          `/equipment/${id}`,
          validated,
        );

      return response.data;
    } catch (error: unknown) {
      equipmentError(
        error,
        'Impossible de modifier l’article.',
      );
    }
  }

  static async deleteEquipment(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<Equipment> {
    ensurePermission(
      userPermissions,
      REQUIRED_EQUIPMENT_DELETE_PERMISSION,
    );

    try {
      const response =
        await client.delete<Equipment>(
          `/equipment/${id}`,
        );

      return response.data;
    } catch (error: unknown) {
      equipmentError(
        error,
        'Impossible de supprimer l’article.',
      );
    }
  }

  /**
   * Compatibility wrappers retained for old imports.
   * Serial editing sends status only.
   */
  static async updateSerialNumber(
    client: AxiosInstance,
    id: string,
    input: {
      serialNumberStatus?: string;
    },
    userPermissions?: string[],
  ) {
    if (
      !input.serialNumberStatus
    ) {
      throw new Error(
        'Le statut du numéro de série est requis.',
      );
    }

    return SerialNumberService.updateSerialNumber(
      client,
      id,
      {
        serialNumberStatus:
          input.serialNumberStatus,
      },
      userPermissions,
    );
  }

  static async deleteSerialNumber(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ) {
    return SerialNumberService.deleteSerialNumber(
      client,
      id,
      userPermissions,
    );
  }
}
