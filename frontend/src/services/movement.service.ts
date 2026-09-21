import type { AxiosInstance } from 'axios';
import { isAxiosError } from 'axios';

import {
  calculateMovementAudit,
} from '@/lib/movement-ledger';
import type {
  CreateMovementInput,
  Movement,
  MovementAuditSummary,
  MovementQuery,
  PaginatedMovementsResponse,
} from '@/types/movement';
import {
  InsufficientPermissionException,
} from './shelf.errors';

export const REQUIRED_MOVEMENT_CREATE_PERMISSION =
  'movement.create';
export const REQUIRED_MOVEMENT_READ_PERMISSION =
  'movement.read';

export class MovementServiceException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'MovementServiceException';
  }
}

function ensurePermission(
  userPermissions: string[] | undefined,
  permission: string,
) {
  if (
    userPermissions &&
    !userPermissions.includes(permission)
  ) {
    throw new InsufficientPermissionException(
      permission,
      `Permission '${permission}' requise.`,
    );
  }
}

function cleanQuery(query: MovementQuery) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => {
      return (
        value !== undefined &&
        value !== null &&
        value !== ''
      );
    }),
  );
}

function throwMovementError(
  error: unknown,
  fallback: string,
  permission?: string,
): never {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const rawMessage =
      error.response?.data?.message;

    const message = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : rawMessage ||
      error.message ||
      fallback;

    if (
      status === 403 &&
      permission
    ) {
      throw new InsufficientPermissionException(
        permission,
        message,
      );
    }

    throw new MovementServiceException(
      message,
      status,
      error.response?.data,
    );
  }

  if (
    error instanceof
    InsufficientPermissionException ||
    error instanceof MovementServiceException
  ) {
    throw error;
  }

  throw new MovementServiceException(
    error instanceof Error
      ? error.message
      : fallback,
  );
}

function validateCreateMovement(
  input: CreateMovementInput,
) {
  if (!input.items.length) {
    throw new MovementServiceException(
      'Ajoutez au moins un article au mouvement.',
      400,
    );
  }

  if (input.items.length > 100) {
    throw new MovementServiceException(
      'Un mouvement ne peut pas contenir plus de 100 lignes.',
      400,
    );
  }

  const source =
    input.sourceShelfId?.trim() || null;
  const destination =
    input.destinationShelfId?.trim() ||
    null;

  if (input.movementType === 'IN') {
    if (source || !destination) {
      throw new MovementServiceException(
        'Une entrée nécessite uniquement un emplacement de destination.',
        400,
      );
    }
  }

  if (input.movementType === 'OUT') {
    if (!source || destination) {
      throw new MovementServiceException(
        'Une sortie nécessite uniquement un emplacement source.',
        400,
      );
    }
  }

  if (
    input.movementType === 'TRANSFER'
  ) {
    if (
      !source ||
      !destination ||
      source.toLowerCase() ===
      destination.toLowerCase()
    ) {
      throw new MovementServiceException(
        'Un transfert nécessite deux emplacements différents.',
        400,
      );
    }
  }

  for (const item of input.items) {
    if (!item.equipmentId) {
      throw new MovementServiceException(
        'Chaque ligne doit contenir un article.',
        400,
      );
    }

    if (
      !Number.isInteger(
        item.movementQuantity,
      ) ||
      item.movementQuantity <= 0
    ) {
      throw new MovementServiceException(
        'La quantité de chaque ligne doit être un entier strictement positif.',
        400,
      );
    }

    if (
      item.serialNumberId &&
      item.movementQuantity !== 1
    ) {
      throw new MovementServiceException(
        'Une ligne sérialisée doit avoir une quantité égale à 1.',
        400,
      );
    }
  }
}

export class MovementService {
  /**
   * Canonical V3 create endpoint.
   *
   * One header:
   * - one movementType
   * - one source/destination route
   *
   * Many lines:
   * - equipmentId
   * - optional serialNumberId
   * - movementQuantity
   *
   * POST /movements
   */
  static async createMovement(
    client: AxiosInstance,
    input: CreateMovementInput,
    userPermissions?: string[],
  ): Promise<Movement> {
    ensurePermission(
      userPermissions,
      REQUIRED_MOVEMENT_CREATE_PERMISSION,
    );

    validateCreateMovement(input);

    try {
      const response =
        await client.post<Movement>(
          '/movements',
          {
            movementType:
              input.movementType,

            sourceShelfId:
              input.sourceShelfId?.trim() ||
              null,

            destinationShelfId:
              input.destinationShelfId?.trim() ||
              null,

            items: input.items.map(
              (item) => ({
                equipmentId:
                  item.equipmentId,

                serialNumberId:
                  item.serialNumberId ??
                  null,

                movementQuantity:
                  Number(
                    item.movementQuantity,
                  ),
              }),
            ),
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwMovementError(
        error,
        'Erreur lors de la création du mouvement.',
        REQUIRED_MOVEMENT_CREATE_PERMISSION,
      );
    }
  }

  /**
   * Canonical paginated movement history.
   *
   * GET /movements
   */
  static async getMovements(
    client: AxiosInstance,
    query: MovementQuery = {},
    userPermissions?: string[],
  ): Promise<PaginatedMovementsResponse> {
    ensurePermission(
      userPermissions,
      REQUIRED_MOVEMENT_READ_PERMISSION,
    );

    try {
      const normalizedQuery: MovementQuery =
      {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        movementType:
          query.movementType,
        equipmentId:
          query.equipmentId,
        serialNumberId:
          query.serialNumberId,
        sourceShelfId:
          query.sourceShelfId,
        destinationShelfId:
          query.destinationShelfId,
      };

      const response =
        await client.get<PaginatedMovementsResponse>(
          '/movements',
          {
            params:
              cleanQuery(
                normalizedQuery,
              ),
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwMovementError(
        error,
        'Erreur de chargement des mouvements.',
        REQUIRED_MOVEMENT_READ_PERMISSION,
      );
    }
  }

  /**
   * GET /movements/:id
   */
  static async getMovementById(
    client: AxiosInstance,
    movementId: string,
    userPermissions?: string[],
  ): Promise<Movement> {
    ensurePermission(
      userPermissions,
      REQUIRED_MOVEMENT_READ_PERMISSION,
    );

    if (!movementId?.trim()) {
      throw new MovementServiceException(
        'Identifiant du mouvement requis.',
        400,
      );
    }

    try {
      const response =
        await client.get<Movement>(
          `/movements/${movementId.trim()}`,
        );

      return response.data;
    } catch (error: unknown) {
      throwMovementError(
        error,
        'Mouvement introuvable.',
        REQUIRED_MOVEMENT_READ_PERMISSION,
      );
    }
  }

  /**
   * Compatibility helper used by EquipmentDetailModal.
   *
   * It now uses the canonical V3 route:
   * GET /movements?equipmentId=<uuid>
   */
  static async getMovementsByEquipmentId(
    client: AxiosInstance,
    equipmentId: string,
    pagination: {
      page?: number;
      limit?: number;
    } = {
        page: 1,
        limit: 100,
      },
    userPermissions?: string[],
  ): Promise<Movement[]> {
    if (!equipmentId?.trim()) {
      throw new MovementServiceException(
        'Identifiant article requis.',
        400,
      );
    }

    const response =
      await this.getMovements(
        client,
        {
          page:
            pagination.page ?? 1,
          limit:
            pagination.limit ?? 100,
          equipmentId:
            equipmentId.trim(),
        },
        userPermissions,
      );

    return response.movements;
  }

  /**
   * Loads all movement headers containing an equipment.
   *
   * Kept for the existing EquipmentDetailModal.
   * The backend limit is max 100.
   */
  static async getAllMovementsByEquipmentId(
    client: AxiosInstance,
    equipmentId: string,
    userPermissions?: string[],
  ): Promise<Movement[]> {
    const movements: Movement[] = [];
    const limit = 100;

    for (let page = 1; ; page += 1) {
      const response =
        await this.getMovements(
          client,
          {
            page,
            limit,
            equipmentId,
          },
          userPermissions,
        );

      movements.push(
        ...response.movements,
      );

      if (
        page >=
        response.totalPages
      ) {
        break;
      }
    }

    return movements;
  }

  /**
   * Pure frontend audit helper.
   */
  static calculateMovementAudit(
    movements: Movement[],
    currentStock: number,
    equipmentId?: string,
  ): MovementAuditSummary {
    return calculateMovementAudit(
      movements,
      currentStock,
      equipmentId,
    );
  }
}
