import type { Equipment } from '@/types/equipment';
import type {
  CreateMovementInput,
  CreateMovementItemInput,
  MovementType,
} from '@/types/movement';

const SQL_INT_MAX = 2_147_483_647;
const MAX_MOVEMENT_LINES = 100;

export interface MovementDraft {
  id: string;
  equipment: Equipment;

  /**
   * Used only for standard/non-serialized equipment.
   */
  quantity: number;

  /**
   * Used only for serialized equipment.
   * One selected serial becomes one movement item with quantity = 1.
   */
  serialNumberIds: string[];
}

export interface BuildMovementPayloadArgs {
  movementType: MovementType;
  sourceShelfId?: string | null;
  destinationShelfId?: string | null;
  drafts: MovementDraft[];
}

export function createMovementDraft(
  equipment: Equipment,
  id = equipment.equipmentId,
): MovementDraft {
  return {
    id,
    equipment,
    quantity: 1,
    serialNumberIds: [],
  };
}

function normalizeShelfId(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getStandardAvailableQuantity(
  equipment: Equipment,
  shelfId: string,
): number {
  return (
    equipment.equipmentShelfs
      ?.filter(
        (row) =>
          row.shelfId.toLowerCase() === shelfId.toLowerCase(),
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.equipmentQuantity || 0),
        0,
      ) ?? 0
  );
}

/**
 * Builds one canonical V3 movement document.
 *
 * V3 invariant:
 * - movement type is selected ONCE
 * - source is selected ONCE
 * - destination is selected ONCE
 * - child items contain only equipment/serial/quantity
 */
export function buildMovementPayload({
  movementType,
  sourceShelfId,
  destinationShelfId,
  drafts,
}: BuildMovementPayloadArgs): CreateMovementInput {
  if (!drafts.length) {
    throw new Error('Sélectionnez au moins un article.');
  }

  const source = normalizeShelfId(sourceShelfId);
  const destination = normalizeShelfId(destinationShelfId);

  if (movementType === 'IN') {
    if (source) {
      throw new Error(
        'Une entrée ne doit pas avoir d’emplacement source.',
      );
    }

    if (!destination) {
      throw new Error(
        'Choisissez un emplacement de destination.',
      );
    }
  }

  if (movementType === 'OUT') {
    if (!source) {
      throw new Error(
        'Choisissez un emplacement source.',
      );
    }

    if (destination) {
      throw new Error(
        'Une sortie ne doit pas avoir d’emplacement de destination.',
      );
    }
  }

  if (movementType === 'TRANSFER') {
    if (!source || !destination) {
      throw new Error(
        'Choisissez un emplacement source et un emplacement de destination.',
      );
    }

    if (source.toLowerCase() === destination.toLowerCase()) {
      throw new Error(
        'La source et la destination doivent être différentes.',
      );
    }
  }

  const items: CreateMovementItemInput[] = [];
  const selectedSerialIds = new Set<string>();
  const selectedStandardEquipmentIds = new Set<string>();

  for (const draft of drafts) {
    const equipment = draft.equipment;
    const equipmentId = equipment.equipmentId;
    const equipmentName =
      equipment.equipmentName ?? equipment.equipmentId;

    const fail = (message: string): never => {
      throw new Error(`${equipmentName} : ${message}`);
    };

    if (!equipmentId) {
      fail('identifiant article manquant.');
    }

    if (equipment.hasSerialNumber) {
      if (!draft.serialNumberIds.length) {
        fail('sélectionnez au moins un numéro de série.');
      }

      for (const serialNumberId of draft.serialNumberIds) {
        const normalizedSerialId =
          serialNumberId.trim().toLowerCase();

        if (!normalizedSerialId) {
          fail('numéro de série invalide.');
        }

        if (selectedSerialIds.has(normalizedSerialId)) {
          fail(
            'un numéro de série est sélectionné plusieurs fois.',
          );
        }

        selectedSerialIds.add(normalizedSerialId);

        items.push({
          equipmentId,
          serialNumberId,
          movementQuantity: 1,
        });
      }

      continue;
    }

    const normalizedEquipmentId =
      equipmentId.toLowerCase();

    if (
      selectedStandardEquipmentIds.has(
        normalizedEquipmentId,
      )
    ) {
      fail(
        'un article standard ne peut apparaître qu’une seule fois dans le même mouvement.',
      );
    }

    selectedStandardEquipmentIds.add(
      normalizedEquipmentId,
    );

    if (
      !Number.isInteger(draft.quantity) ||
      draft.quantity <= 0
    ) {
      fail(
        'la quantité doit être un entier strictement positif.',
      );
    }

    if (draft.quantity > SQL_INT_MAX) {
      fail('la quantité est trop élevée.');
    }

    if (
      (movementType === 'OUT' ||
        movementType === 'TRANSFER') &&
      source
    ) {
      const available =
        getStandardAvailableQuantity(
          equipment,
          source,
        );

      if (draft.quantity > available) {
        fail(
          `stock insuffisant sur la source (${available} disponible(s)).`,
        );
      }
    }

    items.push({
      equipmentId,
      movementQuantity: draft.quantity,
    });
  }

  if (items.length > MAX_MOVEMENT_LINES) {
    throw new Error(
      `Un mouvement accepte au maximum ${MAX_MOVEMENT_LINES} lignes.`,
    );
  }

  const total = items.reduce(
    (sum, item) =>
      sum + item.movementQuantity,
    0,
  );

  if (total > SQL_INT_MAX) {
    throw new Error(
      'La quantité totale du mouvement est trop élevée.',
    );
  }

  return {
    movementType,
    
    
    items,
  };
}
