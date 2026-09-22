export type MovementType =
  | 'IN'
  | 'OUT'
  | 'TRANSFER';

export type MovementOrigin =
  | 'USER'
  | 'INVENTORY_ADJUSTMENT';

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
  stockId?: string;
}

export interface MovementEquipmentSummary {
  equipmentId: string;
  equipmentName: string | null;
  hasSerialNumber?: boolean;
  equipmentStatus?: string;
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

export interface MovementInventorySummary {
  inventoryId: string;
  title: string | null;
  status: string;
}

export interface MovementItem {
  mouvementEquipmentId: string;
  mouvementId?: string;
  rowNum?: number;

  equipmentId: string;
  equipmentTypeSnapshot?: 'STANDARD' | 'SERIALIZED';
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

export interface Movement {
  mouvementId: string;
  createdAt?: string | null;
  createdByUserId?: string | null;

  mouvementStatus: MovementStatus | null;
  mouvementQuantity: number | null;

  equipmentId?: string | null;
  serialNumberId?: string | null;

  /**
   * Present on legacy/flattened line reads. New movement headers use items[].
   */
  mouvementEquipmentId?: string;

  equipment?: MovementEquipmentSummary | null;
  serialNumber?: MovementSerialSummary | null;

  sourceShelfId: string | null;
  destinationShelfId: string | null;

  origin?: MovementOrigin | string;
  inventoryId?: string | null;
  reason?: string | null;

  sourceShelf?: MovementShelf | null;
  destinationShelf?: MovementShelf | null;
  createdByUser?: MovementUserSummary | null;
  inventory?: MovementInventorySummary | null;

  items?: MovementItem[];
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
  origin?: MovementOrigin;
  inventoryId?: string;
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

export interface MovementDraftLine {
  clientId: string;
  equipmentId: string;
  equipmentName: string;
  hasSerialNumber: boolean;
  serialNumberId: string | null;
  serialNumberCode: string | null;
  movementQuantity: number;
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
