import type {
  Movement,
  MovementAuditSummary,
  MovementLedgerEntry,
  MovementType,
} from '@/types/movement';

function canonicalType(movement: Movement): MovementType {
  const status = movement.mouvementStatus?.toUpperCase();

  if (
    status === 'IN' ||
    status === 'ENTRY' ||
    status === 'ENTRÉE'
  ) {
    return 'IN';
  }

  if (
    status === 'OUT' ||
    status === 'EXIT' ||
    status === 'SORTIE'
  ) {
    return 'OUT';
  }

  if (status === 'TRANSFER') {
    return 'TRANSFER';
  }

  // Historical fallback only.
  if (!movement.sourceShelfId && movement.destinationShelfId) {
    return 'IN';
  }

  if (movement.sourceShelfId && !movement.destinationShelfId) {
    return 'OUT';
  }

  return 'TRANSFER';
}

/**
 * Flatten V3 movement headers into line-shaped records for equipment history.
 *
 * New creation never uses per-line routes/types, but the backend still mirrors
 * those values on MovementEquipment for traceability. Historical aliases are
 * kept readable here only.
 */
export function flattenMovementLines(
  movements: Movement[],
  equipmentId?: string,
): Movement[] {
  const unique = new Map<string, Movement>();
  const equipmentFilter = equipmentId?.toLowerCase();

  for (const header of movements) {
    if (header.items?.length) {
      for (const item of header.items) {
        if (
          equipmentFilter &&
          item.equipmentId.toLowerCase() !== equipmentFilter
        ) {
          continue;
        }

        const line: Movement = {
          ...header,
          mouvementEquipmentId: item.mouvementEquipmentId,
          equipmentId: item.equipmentId,
          serialNumberId: item.serialNumberId,
          mouvementQuantity: item.mouvementQuantity,
          mouvementStatus:
            item.mouvementStatus ?? header.mouvementStatus,
          sourceShelfId:
            item.sourceShelfId ?? header.sourceShelfId,
          destinationShelfId:
            item.destinationShelfId ?? header.destinationShelfId,
          equipment: item.equipment ?? header.equipment,
          serialNumber: item.serialNumber ?? header.serialNumber,
          sourceShelf: item.sourceShelf ?? header.sourceShelf,
          destinationShelf:
            item.destinationShelf ?? header.destinationShelf,
          items: undefined,
        };

        unique.set(
          item.mouvementEquipmentId.toLowerCase(),
          line,
        );
      }

      continue;
    }

    if (
      equipmentFilter &&
      header.equipmentId?.toLowerCase() !== equipmentFilter
    ) {
      continue;
    }

    unique.set(
      (
        header.mouvementEquipmentId ??
        header.mouvementId
      ).toLowerCase(),
      header,
    );
  }

  const time = (value?: string | null) => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return [...unique.values()].sort(
    (a, b) =>
      time(a.createdAt) -
      time(b.createdAt) ||
      a.mouvementId.localeCompare(b.mouvementId) ||
      (a.mouvementEquipmentId ?? '').localeCompare(
        b.mouvementEquipmentId ?? '',
      ),
  );
}

/**
 * Standard-equipment global stock audit:
 * initial + IN - OUT = current.
 *
 * TRANSFER has zero impact on global equipmentQuantity.
 *
 * Do not use this global-balance formula for serialized equipment because
 * serialized equipmentQuantity is the number of serial identities and is
 * maintained by SerialNumber create/delete, not by movements.
 */
export function calculateMovementAudit(
  movements: Movement[],
  currentStock: number,
  equipmentId?: string,
): MovementAuditSummary {
  const lines = flattenMovementLines(
    movements,
    equipmentId,
  );

  const equipmentIds = new Set(
    lines
      .map((line) => line.equipmentId?.toLowerCase())
      .filter(Boolean),
  );

  if (equipmentIds.size > 1) {
    throw new Error(
      'An equipment ID is required to calculate a multi-equipment ledger',
    );
  }

  let totalIn = 0;
  let totalOut = 0;

  for (const line of lines) {
    const type = canonicalType(line);
    const quantity = line.mouvementQuantity ?? 0;

    if (type === 'IN') totalIn += quantity;
    if (type === 'OUT') totalOut += quantity;
  }

  const initialQuantity = Math.max(
    0,
    currentStock - totalIn + totalOut,
  );

  let runningBalance = initialQuantity;

  const ledger: MovementLedgerEntry[] = lines.map(
    (movement) => {
      const type = canonicalType(movement);
      const quantity = movement.mouvementQuantity ?? 0;

      const delta =
        type === 'IN'
          ? quantity
          : type === 'OUT'
            ? -quantity
            : 0;

      runningBalance += delta;

      return {
        movement,
        type,
        delta,
        runningBalance,
      };
    },
  );

  return {
    initialQuantity,
    totalIn,
    totalOut,
    currentQuantity: currentStock,
    ledger,
  };
}
