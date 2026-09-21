import type { AxiosInstance } from 'axios';
import { isAxiosError } from 'axios';

import {
  createDirectEquipmentSchema,
  updateEquipmentSchema,
} from '@/schemas/equipment.schema';
import { SerialNumberService } from '@/services/serial-number.service';
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
  SerialNumber,
} from '@/types/equipment';

export const REQUIRED_EQUIPMENT_READ_PERMISSION =
  'equipment.read';
export const REQUIRED_EQUIPMENT_CREATE_PERMISSION =
  'equipment.create';
export const REQUIRED_EQUIPMENT_UPDATE_PERMISSION =
  'equipment.update';
export const REQUIRED_EQUIPMENT_DELETE_PERMISSION =
  'equipment.delete';

export class EquipmentServiceException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'EquipmentServiceException';
  }
}

export class EquipmentValidationException extends EquipmentServiceException {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message, 400, fieldErrors);
    this.name = 'EquipmentValidationException';
  }
}

function ensurePermission(
  permissions: string[] | undefined,
  permission: string,
) {
  if (permissions && !permissions.includes(permission)) {
    throw new InsufficientPermissionException(
      permission,
      `Permission '${permission}' requise.`,
    );
  }
}

function apiMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const raw = error.response?.data?.message;

    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'string' && raw) return raw;
    if (error.message) return error.message;
  }

  return error instanceof Error && error.message
    ? error.message
    : fallback;
}

function throwEquipmentError(
  error: unknown,
  fallback: string,
  permission?: string,
): never {
  if (isAxiosError(error)) {
    if (error.response?.status === 403 && permission) {
      throw new InsufficientPermissionException(
        permission,
        apiMessage(error, `Permission '${permission}' requise.`),
      );
    }

    throw new EquipmentServiceException(
      apiMessage(error, fallback),
      error.response?.status,
      error.response?.data,
    );
  }

  if (
    error instanceof InsufficientPermissionException ||
    error instanceof EquipmentServiceException
  ) {
    throw error;
  }

  throw new EquipmentServiceException(
    error instanceof Error ? error.message : fallback,
  );
}

export class EquipmentService {
  static async getAllEquipments(
    client: AxiosInstance,
    params?: EquipmentPaginationQuery,
  ): Promise<PaginatedEquipmentsResponse> {
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? 10;

      const response =
        await client.get<PaginatedEquipmentsResponse>(
          '/equipment',
          {
            params: {
              page,
              limit,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwEquipmentError(
        error,
        'Échec du chargement des articles.',
        REQUIRED_EQUIPMENT_READ_PERMISSION,
      );
    }
  }

  static async searchEquipments(
    client: AxiosInstance,
    name: string,
    params?: EquipmentPaginationQuery,
  ): Promise<PaginatedEquipmentsResponse> {
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? 10;

      const response =
        await client.get<PaginatedEquipmentsResponse>(
          '/equipment/search',
          {
            params: {
              equipmentName: name.trim(),
              page,
              limit,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwEquipmentError(
        error,
        'Échec de la recherche d’articles.',
        REQUIRED_EQUIPMENT_READ_PERMISSION,
      );
    }
  }

  /**
   * Backend V3 returns the same lightweight equipment shape here:
   * positive EquipmentShelfs + relation counts, but not every serial record.
   */
  static async getEquipmentById(
    client: AxiosInstance,
    id: string,
  ): Promise<Equipment> {
    try {
      const response = await client.get<Equipment>(
        `/equipment/${id}`,
      );

      return response.data;
    } catch (error: unknown) {
      throwEquipmentError(
        error,
        `L’article '${id}' est introuvable ou inaccessible.`,
        REQUIRED_EQUIPMENT_READ_PERMISSION,
      );
    }
  }

  static async getEquipmentShelves(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<EquipmentWithShelvesResponse> {
    ensurePermission(
      userPermissions,
      REQUIRED_EQUIPMENT_READ_PERMISSION,
    );

    try {
      const response =
        await client.get<EquipmentWithShelvesResponse>(
          `/equipment/${id}/shelves`,
        );

      return response.data;
    } catch (error: unknown) {
      throwEquipmentError(
        error,
        'Échec de la récupération des emplacements.',
        REQUIRED_EQUIPMENT_READ_PERMISSION,
      );
    }
  }

  /**
   * Lazy paginated serial list for Equipment detail screens.
   *
   * GET /equipment/:id/serial-numbers
   */
  static async getEquipmentSerialNumbers(
    client: AxiosInstance,
    id: string,
    pagination: {
      page?: number;
      limit?: number;
    } = {},
    userPermissions?: string[],
  ): Promise<PaginatedSerialNumbersResponse> {
    ensurePermission(
      userPermissions,
      REQUIRED_EQUIPMENT_READ_PERMISSION,
    );

    try {
      const response =
        await client.get<PaginatedSerialNumbersResponse>(
          `/equipment/${id}/serial-numbers`,
          {
            params: {
              page: pagination.page ?? 1,
              limit: pagination.limit ?? 20,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwEquipmentError(
        error,
        'Échec du chargement des numéros de série.',
        REQUIRED_EQUIPMENT_READ_PERMISSION,
      );
    }
  }

  /**
   * V3 editable metadata only.
   *
   * PATCH /equipment/:id
   *
   * equipmentQuantity and hasSerialNumber are deliberately ignored even if
   * an older caller still sends them.
   */
  static async updateEquipment(
    client: AxiosInstance,
    id: string,
    input: {
      equipmentName?: string;
      minEquipmentQuantity?: number;

      // Temporary caller compatibility. Never sent to backend.
      equipmentQuantity?: number;
      hasSerialNumber?: boolean;
    },
    userPermissions?: string[],
  ): Promise<Equipment> {
    ensurePermission(
      userPermissions,
      REQUIRED_EQUIPMENT_UPDATE_PERMISSION,
    );

    const validation = updateEquipmentSchema.safeParse({
      equipmentName: input.equipmentName,
      minEquipmentQuantity: input.minEquipmentQuantity,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};

      for (const issue of validation.error.issues) {
        const field = issue.path.join('.') || 'form';
        (fieldErrors[field] ??= []).push(issue.message);
      }

      throw new EquipmentValidationException(
        'Données de modification invalides.',
        fieldErrors,
      );
    }

    try {
      const response = await client.patch<Equipment>(
        `/equipment/${id}`,
        validation.data,
      );

      return response.data;
    } catch (error: unknown) {
      throwEquipmentError(
        error,
        'Erreur lors de la mise à jour de l’article.',
        REQUIRED_EQUIPMENT_UPDATE_PERMISSION,
      );
    }
  }

  /**
   * Backend refuses deletion when movement history, serial identities,
   * or positive allocation prevents a safe delete.
   */
  static async deleteEquipment(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<void> {
    ensurePermission(
      userPermissions,
      REQUIRED_EQUIPMENT_DELETE_PERMISSION,
    );

    try {
      await client.delete(`/equipment/${id}`);
    } catch (error: unknown) {
      throwEquipmentError(
        error,
        'Erreur lors de la suppression de l’article.',
        REQUIRED_EQUIPMENT_DELETE_PERMISSION,
      );
    }
  }

  /**
   * Temporary compatibility wrappers for existing Equipment UI.
   * Canonical serial API is owned by SerialNumberService.
   */
  static async updateSerialNumber(
    client: AxiosInstance,
    id: string,
    input: {
      serialNumberCode?: string;
      serialNumberStatus?: string;
    },
    userPermissions?: string[],
  ): Promise<SerialNumber> {
    return SerialNumberService.updateSerialNumber(
      client,
      id,
      input,
      userPermissions,
    );
  }

  static async deleteSerialNumber(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<void> {
    await SerialNumberService.deleteSerialNumber(
      client,
      id,
      userPermissions,
    );
  }

  /**
   * Create equipment metadata.
   *
   * Backend always starts equipmentQuantity at 0.
   *
   * Optional serial codes are created as identities in a second request.
   * No shelfId is sent. Physical location comes later through Movement IN.
   */
  static async createEquipmentDirect(
    client: AxiosInstance,
    input: CreateEquipmentDirectInput,
    userPermissions?: string[],
  ): Promise<Equipment> {
    ensurePermission(
      userPermissions,
      REQUIRED_EQUIPMENT_CREATE_PERMISSION,
    );

    const validation = createDirectEquipmentSchema.safeParse({
      equipmentName: input.equipmentName,
      hasSerialNumber: input.hasSerialNumber,
      minEquipmentQuantity:
        input.minEquipmentQuantity ?? 0,
      serialNumbers: input.serialNumbers ?? [],
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      const messages: string[] = [];

      for (const issue of validation.error.issues) {
        const field = issue.path.join('.') || 'form';
        (fieldErrors[field] ??= []).push(issue.message);
        messages.push(issue.message);
      }

      throw new EquipmentValidationException(
        messages.length
          ? messages.join(', ')
          : 'Données d’article invalides.',
        fieldErrors,
      );
    }

    const data = validation.data;

    try {
      const equipmentResponse =
        await client.post<Equipment>('/equipment', {
          equipmentName: data.equipmentName,
          hasSerialNumber: data.hasSerialNumber,
          minEquipmentQuantity:
            data.minEquipmentQuantity,
        });

      const created = equipmentResponse.data;

      if (
        data.hasSerialNumber &&
        data.serialNumbers.length > 0
      ) {
        try {
          await SerialNumberService.createBatchSerialNumbers(
            client,
            {
              equipmentId: created.equipmentId,
              serialNumberCodes: data.serialNumbers.map((code) =>
                code.trim().toUpperCase(),
              ),
              serialNumberStatus: 'AVAILABLE',
            },
            userPermissions,
          );
        } catch (serialError: unknown) {
          /*
           * The metadata record already exists at this point.
           * Report this explicitly so the UI/user does not assume the
           * entire operation rolled back and accidentally recreate it.
           */
          throw new EquipmentServiceException(
            `L’article "${created.equipmentName ?? created.equipmentId}" a été créé, mais les numéros de série n’ont pas tous pu être enregistrés : ${apiMessage(
              serialError,
              'erreur de création des numéros de série',
            )}`,
            409,
            {
              equipmentId: created.equipmentId,
              equipmentCreated: true,
            },
          );
        }
      }

      return await this.getEquipmentById(
        client,
        created.equipmentId,
      );
    } catch (error: unknown) {
      if (
        error instanceof EquipmentServiceException ||
        error instanceof InsufficientPermissionException
      ) {
        throw error;
      }

      throwEquipmentError(
        error,
        'Erreur lors de la création de l’article.',
        REQUIRED_EQUIPMENT_CREATE_PERMISSION,
      );
    }
  }
}
