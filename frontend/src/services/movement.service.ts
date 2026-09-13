import { AxiosInstance, isAxiosError } from 'axios';
import {
  Movement,
  CreateEquipmentMovementInput,
  MovementAuditSummary,
  MovementLedgerEntry,
} from '@/types/movement';
import { InsufficientPermissionException } from './shelf.errors';

export const REQUIRED_MOVEMENT_CREATE_PERMISSION = 'movement.create';
export const REQUIRED_MOVEMENT_READ_PERMISSION = 'movement.read';

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

export class MovementService {
  /**
   * Create a new equipment movement (POST /equipment-movement)
   * Supports:
   * - Source shelf -> Destination shelf (Transfer)
   * - NULL -> Destination shelf (Entry / IN)
   * - Source shelf -> NULL (Exit / OUT: Consumable / Disposal)
   * - Standard equipment (full or partial quantity)
   * - Serialized equipment (serialNumberId with quantity 1)
   */
  static async createMovement(
    client: AxiosInstance,
    input: CreateEquipmentMovementInput,
    userPermissions?: string[],
  ): Promise<Movement> {
    if (userPermissions && !userPermissions.includes(REQUIRED_MOVEMENT_CREATE_PERMISSION)) {
      throw new InsufficientPermissionException(
        REQUIRED_MOVEMENT_CREATE_PERMISSION,
        `Permission refusée : Vous n'avez pas le droit '${REQUIRED_MOVEMENT_CREATE_PERMISSION}' pour enregistrer un mouvement.`,
      );
    }

    // Client-side payload validation
    if (!input.equipmentId) {
      throw new MovementServiceException('Identifiant d’équipement requis.', 400);
    }
    if (!input.sourceShelfId && !input.destinationShelfId) {
      throw new MovementServiceException(
        'Au moins une étagère (source ou destination) doit être spécifiée.',
        400,
      );
    }
    if (input.sourceShelfId && input.destinationShelfId && input.sourceShelfId === input.destinationShelfId) {
      throw new MovementServiceException(
        'L’étagère source et l’étagère destination ne peuvent pas être identiques.',
        400,
      );
    }
    if (!input.movementQuantity || input.movementQuantity <= 0) {
      throw new MovementServiceException(
        'La quantité déplacée doit être un entier strictement positif.',
        400,
      );
    }

    try {
      const response = await client.post<Movement>('/equipment-movement', {
        equipmentId: input.equipmentId,
        serialNumberId: input.serialNumberId || undefined,
        sourceShelfId: input.sourceShelfId || undefined,
        destinationShelfId: input.destinationShelfId || undefined,
        movementQuantity: Number(input.movementQuantity),
        movementType: input.movementType,
      });
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new InsufficientPermissionException(
            REQUIRED_MOVEMENT_CREATE_PERMISSION,
            error.response.data?.message || `Permission '${REQUIRED_MOVEMENT_CREATE_PERMISSION}' requise.`,
          );
        }
        const msg = error.response?.data?.message || error.message || 'Erreur lors de la création du mouvement.';
        throw new MovementServiceException(
          Array.isArray(msg) ? msg.join(', ') : msg,
          error.response?.status,
        );
      }
      throw new MovementServiceException(
        error instanceof Error ? error.message : 'Erreur inconnue lors du mouvement.',
      );
    }
  }

  /**
   * Fetch all movements for an equipment (GET /equipment-movement/equipment/:equipmentId)
   */
  static async getMovementsByEquipmentId(
    client: AxiosInstance,
    equipmentId: string,
    pagination: { page?: number; limit?: number } = { page: 1, limit: 100 },
    userPermissions?: string[],
  ): Promise<Movement[]> {
    if (userPermissions && !userPermissions.includes(REQUIRED_MOVEMENT_READ_PERMISSION)) {
      throw new InsufficientPermissionException(
        REQUIRED_MOVEMENT_READ_PERMISSION,
        `Permission refusée : Vous n'avez pas le droit '${REQUIRED_MOVEMENT_READ_PERMISSION}' pour consulter les mouvements.`,
      );
    }

    try {
      const response = await client.get<Movement[]>(
        `/equipment-movement/equipment/${equipmentId}`,
        {
          params: {
            page: pagination.page ?? 1,
            limit: pagination.limit ?? 100,
          },
        },
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new InsufficientPermissionException(
            REQUIRED_MOVEMENT_READ_PERMISSION,
            'Permission refusée pour consulter les mouvements.',
          );
        }
        const msg = error.response?.data?.message || 'Erreur de chargement des mouvements.';
        throw new MovementServiceException(
          Array.isArray(msg) ? msg.join(', ') : msg,
          error.response?.status,
        );
      }
      throw new MovementServiceException('Erreur inconnue lors du chargement des mouvements.');
    }
  }

  /**
   * Calculates dynamic quantity audit from movements:
   * - Total IN (+ sum)
   * - Total OUT (- sum)
   * - Initial quantity = Current Stock - Total IN + Total OUT
   * - Running ledger breakdown
   */
  static calculateMovementAudit(movements: Movement[], currentStock: number): MovementAuditSummary {
    let totalIn = 0;
    let totalOut = 0;

    // Classify movements
    for (const m of movements) {
      const qty = m.mouvementQuantity ?? 1;
      const statusUpper = (m.mouvementStatus ?? '').toUpperCase();
      const isEntry = statusUpper === 'IN' || statusUpper === 'ENTRY' || statusUpper === 'ENTRÉE' || (!m.sourceShelfId && !!m.destinationShelfId);
      const isExit = statusUpper === 'OUT' || statusUpper === 'SORTIE' || (!!m.sourceShelfId && !m.destinationShelfId);

      if (isEntry) {
        totalIn += qty;
      } else if (isExit) {
        totalOut += qty;
      }
    }

    // Baseline initial quantity before movements
    // Current Stock = Initial + totalIn - totalOut => Initial = Current Stock - totalIn + totalOut
    const initialQuantity = Math.max(0, currentStock - totalIn + totalOut);

    // Compute running balance step-by-step
    let running = initialQuantity;
    const ledger: MovementLedgerEntry[] = movements.map((m) => {
      const qty = m.mouvementQuantity ?? 1;
      const statusUpper = (m.mouvementStatus ?? '').toUpperCase();
      const isEntry = statusUpper === 'IN' || statusUpper === 'ENTRY' || statusUpper === 'ENTRÉE' || (!m.sourceShelfId && !!m.destinationShelfId);
      const isExit = statusUpper === 'OUT' || statusUpper === 'SORTIE' || (!!m.sourceShelfId && !m.destinationShelfId);

      let type: 'IN' | 'OUT' | 'TRANSFER' = 'TRANSFER';
      let delta = 0;

      if (isEntry) {
        type = 'IN';
        delta = qty;
        running += qty;
      } else if (isExit) {
        type = 'OUT';
        delta = -qty;
        running -= qty;
      } else {
        type = 'TRANSFER';
        delta = 0; // Intra-warehouse transfer does not alter total equipment count
      }

      return {
        movement: m,
        type,
        delta,
        runningBalance: running,
      };
    });

    return {
      initialQuantity,
      totalIn,
      totalOut,
      currentQuantity: currentStock,
      ledger,
    };
  }
}
