export type MovementType = 'IN' | 'OUT' | 'TRANSFER';

/**
 * Historical values can still exist in old records after migration.
 * They are READ compatibility only and must never be used when creating V3 movements.
 */
export type MovementStatus =
  | MovementType
  | 'ENTRY'
  | 'EXIT'
  | 'ENTRÉE'
  | 'SORTIE'
  | 'MIXED';

export interface MovementShelf {
  shelfId: string;
  shelfName: string | null;
  shelfQuantity?: number;
}

export interface MovementEquipmentSummary {
  equipmentId: string;
  equipmentName: string | null;
  hasSerialNumber?: boolean;
  equipmentQuantity?: number;
}

export interface MovementSerialSummary {
  serialNumberId: string;
  serialNumberCode: string | null;
  serialNumberStatus?: string | null;
}

export interface MovementUserSummary {
  userId: string;
  userName: string | null;
  userEmail: string | null;
}

export interface MovementItem {
  mouvementEquipmentId: string;
  mouvementId: string;
  rowNum?: number;

  equipmentId: string;
  serialNumberId: string | null;

  sourceShelfId: string | null;
  destinationShelfId: string | null;

  mouvementQuantity: number;
  mouvementStatus: MovementStatus;

  equipment?: MovementEquipmentSummary | null;
  serialNumber?: MovementSerialSummary | null;
  sourceShelf?: MovementShelf | null;
  destinationShelf?: MovementShelf | null;
}

/**
 * V3 movement header.
 *
 * A movement has exactly one type and one shared route.
 * All physical stock/location changes are represented by its items[].
 *
 * equipmentId and serialNumberId remain optional legacy/header mirror fields
 * because historical data may still contain them.
 */
export interface Movement {
  mouvementId: string;
  createdAt?: string | null;
  createdByUserId?: string | null;

  mouvementStatus: MovementStatus | null;
  mouvementQuantity: number | null;

  equipmentId: string | null;
  serialNumberId: string | null;

  sourceShelfId: string | null;
  destinationShelfId: string | null;

  sourceShelf?: MovementShelf | null;
  destinationShelf?: MovementShelf | null;
  createdByUser?: MovementUserSummary | null;

  items?: MovementItem[];

  /**
   * Only present on flattened legacy-compatible movement lines.
   * New V3 headers should use items[] instead.
   */
  mouvementEquipmentId?: string;

  equipment?: MovementEquipmentSummary | null;
  serialNumber?: MovementSerialSummary | null;
}

export interface CreateMovementItemInput {
  equipmentId: string;
  serialNumberId?: string | null;
  movementQuantity: number;
}

export interface CreateMovementInput {
  movementType: MovementType;
  sourceShelfId?: string | null;
  destinationShelfId?: string | null;
  items: CreateMovementItemInput[];
}

export interface MovementQuery {
  page?: number;
  limit?: number;
  movementType?: MovementType;
  equipmentId?: string;
  serialNumberId?: string;
  sourceShelfId?: string;
  destinationShelfId?: string;
}

export interface PaginatedMovementsResponse {
  movements: Movement[];
  totalMovements: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface MovementLedgerEntry {
  movement: Movement;
  type: MovementType;
  delta: number;
  runningBalance: number;
}

export interface MovementAuditSummary {
  initialQuantity: number;
  totalIn: number;
  totalOut: number;
  currentQuantity: number;
  ledger: MovementLedgerEntry[];
}

/**
 * @deprecated
 * Temporary compatibility type for the old movement.service.ts.
 * Do not use this type in new V3 UI code.
 *
 * Remove it when the old movement.service.ts is rewritten/removed.
 */
export interface CreateEquipmentMovementInput {
  equipmentId: string;
  serialNumberId?: string;
  sourceShelfId?: string;
  destinationShelfId?: string;
  movementQuantity: number;
  movementType: string;
}

/**
 * @deprecated
 * Temporary compatibility alias for older frontend code.
 */
export interface MovementHeader extends Movement {
  items: MovementItem[];
}
