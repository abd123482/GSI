export type InventoryStatus = 'DRAFT' | 'IN_PROGRESS' | 'FINALIZED' | 'CANCELLED';
export type WorkUnitStatus = 'DRAFT' | 'IN_PROGRESS' | 'RECONCILED' | 'RESOLVED';
export type AttemptStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'SUBMITTED' | 'SKIPPED' | 'CANCELLED';
export type Responsibility = 'COUNT' | 'ADJUDICATE';

export interface InventoryUser {
  inventoryId: string;
  userId: string;
  sequence: number;
  responsibility: Responsibility;
}

export interface Inventory {
  inventoryId: string;
  title: string;
  typeInventory: 'ByEquipment' | 'ByShelf';
  status: InventoryStatus;
  createdAt: string;
  finalizedAt?: string;
  Inventory_User: InventoryUser[];
}

export interface InventoryWorkUnit {
  unitId: string;
  inventoryId: string;
  equipmentId?: string;
  shelfId?: string;
  status: WorkUnitStatus;
  inventory?: Inventory;
}

export interface InventoryCountAttempt {
  attemptId: string;
  unitId: string;
  assignedUserId: string;
  sequence: number;
  purpose: string;
  status: AttemptStatus;
  unit?: InventoryWorkUnit;
}
