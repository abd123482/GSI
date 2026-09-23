import type {
  AxiosInstance,
} from 'axios';
import {
  isAxiosError,
} from 'axios';

import type {
  Equipment,
  EquipmentWithShelvesResponse,
  SerialNumber,
} from '@/types/equipment';

import type {
  CreateMovementInput,
  Movement,
  MovementQuery,
  PaginatedMovementsResponse,
} from '@/types/movement';

import type {
  Shelf,
} from '@/types/shelf';

import {
  EquipmentService,
} from '@/services/equipment.service';

import {
  SerialNumberService,
} from '@/services/serial-number.service';

import {
  ShelfService,
} from '@/services/shelf.service';

import {
  InsufficientPermissionException,
} from './shelf.errors';

export const REQUIRED_MOVEMENT_CREATE_PERMISSION =
  'movement.create';

export const REQUIRED_MOVEMENT_READ_PERMISSION =
  'movement.read';

function ensurePermission(
  permissions: string[] | undefined,
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

function throwMovementError(
  error: unknown,
  fallback: string,
): never {
  if (isAxiosError(error)) {
    const message =
      error.response?.data?.message;

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

function validateMovement(
  input: CreateMovementInput,
) {
  if (
    input.items.length < 1
  ) {
    throw new Error(
      'Ajoutez au moins une ligne au mouvement.',
    );
  }

  if (
    input.items.length > 100
  ) {
    throw new Error(
      'Un mouvement ne peut pas dépasser 100 lignes.',
    );
  }

  if (
    input.movementType ===
    'IN'
  ) {
    if (
      input.sourceShelfId ||
      !input.destinationShelfId
    ) {
      throw new Error(
        'Une entrée nécessite uniquement un emplacement destination.',
      );
    }
  }

  if (
    input.movementType ===
    'OUT'
  ) {
    if (
      !input.sourceShelfId ||
      input.destinationShelfId
    ) {
      throw new Error(
        'Une sortie nécessite uniquement un emplacement source.',
      );
    }
  }

  if (
    input.movementType ===
    'TRANSFER'
  ) {
    if (
      !input.sourceShelfId ||
      !input.destinationShelfId ||
      input.sourceShelfId ===
        input.destinationShelfId
    ) {
      throw new Error(
        'Un transfert nécessite deux emplacements différents.',
      );
    }
  }

  for (
    const item of
    input.items
  ) {
    if (
      !item.equipmentId
    ) {
      throw new Error(
        'Article manquant dans une ligne.',
      );
    }

    if (
      !Number.isInteger(
        item.movementQuantity,
      ) ||
      item.movementQuantity <=
        0
    ) {
      throw new Error(
        'La quantité doit être un entier strictement positif.',
      );
    }

    if (
      item.serialNumberId &&
      item.movementQuantity !==
        1
    ) {
      throw new Error(
        'Une ligne sérialisée doit avoir une quantité égale à 1.',
      );
    }
  }
}

export class MovementService {
  static async createMovement(
    client: AxiosInstance,
    input: CreateMovementInput,
    userPermissions?: string[],
  ): Promise<Movement> {
    ensurePermission(
      userPermissions,
      REQUIRED_MOVEMENT_CREATE_PERMISSION,
    );

    validateMovement(
      input,
    );

    try {
      const response =
        await client.post<Movement>(
          '/movements',
          {
            movementType:
              input.movementType,

            sourceShelfId:
              input.sourceShelfId ??
              null,

            destinationShelfId:
              input.destinationShelfId ??
              null,

            items:
              input.items.map(
                (item) => ({
                  equipmentId:
                    item.equipmentId,
                  serialNumberId:
                    item.serialNumberId ??
                    null,
                  movementQuantity:
                    item.movementQuantity,
                }),
              ),
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwMovementError(
        error,
        'Impossible d’enregistrer le mouvement.',
      );
    }
  }

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
      const response =
        await client.get<PaginatedMovementsResponse>(
          '/movements',
          {
            params: {
              page:
                query.page ?? 1,
              limit:
                query.limit ??
                20,
              movementType:
                query.movementType,
              origin:
                query.origin,
              inventoryId:
                query.inventoryId,
              equipmentId:
                query.equipmentId,
              serialNumberId:
                query.serialNumberId,
              sourceShelfId:
                query.sourceShelfId,
              destinationShelfId:
                query.destinationShelfId,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwMovementError(
        error,
        'Impossible de charger les mouvements.',
      );
    }
  }

  static async getMovementById(
    client: AxiosInstance,
    movementId: string,
    userPermissions?: string[],
  ): Promise<Movement> {
    ensurePermission(
      userPermissions,
      REQUIRED_MOVEMENT_READ_PERMISSION,
    );

    try {
      const response =
        await client.get<Movement>(
          `/movements/${movementId}`,
        );

      return response.data;
    } catch (error: unknown) {
      throwMovementError(
        error,
        'Mouvement introuvable.',
      );
    }
  }

  static async getAllActiveEquipments(
    client: AxiosInstance,
  ): Promise<Equipment[]> {
    const equipments:
      Equipment[] = [];

    const limit = 100;

    for (
      let page = 1;
      ;
      page += 1
    ) {
      const result =
        await EquipmentService.searchEquipments(
          client,
          {
            page,
            limit,
            equipmentStatus:
              'ACTIVE',
          },
        );

      equipments.push(
        ...result.equipments,
      );

      if (
        page >=
        result.totalPages
      ) {
        break;
      }
    }

    return equipments;
  }

  static async getAllActiveShelves(
    client: AxiosInstance,
  ): Promise<Shelf[]> {
    const shelves:
      Shelf[] = [];

    const limit = 100;

    for (
      let page = 1;
      ;
      page += 1
    ) {
      const result =
        await ShelfService.getAllShelves(
          client,
          {
            page,
            limit,
          },
        );

      shelves.push(
        ...result.shelves.filter(
          (shelf) =>
            shelf.stock?.stockStatus?.stockStatusName === 'ACTIVE' &&
            shelf.shelfStatus?.shelfStatusName !== 'INACTIVE',
        ),
      );

      if (
        page >=
        result.totalPages
      ) {
        break;
      }
    }

    return shelves;
  }

  static async getEquipmentAllocations(
    client: AxiosInstance,
    equipmentId: string,
    userPermissions?: string[],
  ): Promise<EquipmentWithShelvesResponse> {
    return EquipmentService.getEquipmentShelves(
      client,
      equipmentId,
      userPermissions,
    );
  }

  static async getAllEquipmentSerials(
    client: AxiosInstance,
    equipmentId: string,
    userPermissions?: string[],
  ): Promise<SerialNumber[]> {
    const serialNumbers:
      SerialNumber[] = [];

    const limit = 100;

    for (
      let page = 1;
      ;
      page += 1
    ) {
      const result =
        await SerialNumberService.getSerialNumbers(
          client,
          {
            page,
            limit,
            equipmentId,
          },
          userPermissions,
        );

      serialNumbers.push(
        ...result.serialNumbers,
      );

      if (
        page >=
        result.totalPages
      ) {
        break;
      }
    }

    return serialNumbers;
  }
}
