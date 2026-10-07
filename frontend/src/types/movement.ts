export type MovementType = "IN" | "OUT" | "TRANSFER";
export type MovementOrigin = "USER" | "INVENTORY_ADJUSTMENT";

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
  movementEquipmentId: string;
  movementId: string;

  equipmentId: string;
  equipmentTypeSnapshot: "STANDARD" | "SERIALIZED";
  serialNumberId: string | null;

  sourceShelfId: string | null;
  destinationShelfId: string | null;

  equipmentQuantity: number;

  equipment?: MovementEquipmentSummary | null;
  serialNumber?: MovementSerialSummary | null;
  sourceShelf?: MovementShelf | null;
  destinationShelf?: MovementShelf | null;
}

export interface Movement {
  mouvementId: string;
  mouvementStatus: boolean;
  createdAt: string;
  happenedAt: string;
  createdByUserId: string | null;
  origin: boolean;
  inventoryId: string | null;
  reason: string | null;

  createdByUser?: MovementUserSummary | null;
  inventory?: MovementInventorySummary | null;
  items: MovementItem[];
}

export interface CreateMovementItemInput {
  equipmentId: string;
  movementQuantity: number;
  serialNumberId?: string | null;
  serialNumberCode?: string;
  sourceShelfId?: string | null;
  destinationShelfId?: string | null;
}

export interface CreateMovementInput {
  movementType: MovementType;
  happenedAt?: string;
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
  sourceShelfId?: string | null;
  destinationShelfId?: string | null;
  sourceName?: string;
  destinationName?: string;
}

