export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ENTRY';

export interface Movement {
  mouvementId: string;
  mouvementStatus: string | null;
  mouvementQuantity: number | null;
  equipmentId: string | null;
  serialNumberId: string | null;
  sourceShelfId: string | null;
  destinationShelfId: string | null;
  equipment?: {
    equipmentId: string;
    equipmentName: string | null;
    hasSerialNumber?: boolean;
    equipmentQuantity?: number;
  } | null;
  serialNumber?: {
    serialNumberId: string;
    serialNumberCode: string | null;
    serialNumberStatus?: string | null;
  } | null;
  sourceShelf?: {
    shelfId: string;
    shelfName: string | null;
    shelfQuantity?: number;
  } | null;
  destinationShelf?: {
    shelfId: string;
    shelfName: string | null;
    shelfQuantity?: number;
  } | null;
}

export interface CreateEquipmentMovementInput {
  equipmentId: string;
  serialNumberId?: string;
  sourceShelfId?: string;
  destinationShelfId?: string;
  movementQuantity: number;
  movementType: string;
}

export interface MovementLedgerEntry {
  movement: Movement;
  type: 'IN' | 'OUT' | 'TRANSFER';
  delta: number; // +N, -N, or 0
  runningBalance: number;
}

export interface MovementAuditSummary {
  initialQuantity: number;
  totalIn: number;
  totalOut: number;
  currentQuantity: number;
  ledger: MovementLedgerEntry[];
}
