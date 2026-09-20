export type InventoryStatus = 'DRAFT' | 'IN_PROGRESS' | 'THIRD_COUNT_REQUIRED' | 'FINALIZED' | 'CANCELLED';
export type WorkUnitStatus = 'DRAFT' | 'IN_PROGRESS' | 'RECONCILED' | 'RESOLVED';
export type AttemptStatus = 'BLOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'SUBMITTED' | 'SKIPPED' | 'CANCELLED';
export type Responsibility = 'COUNT' | 'ADJUDICATE';

export interface InventoryUser {
  inventoryId: string;
  userId: string;
  sequence: number;
  responsibility: Responsibility;
  User?: {
    userName: string;
    userEmail: string;
  };
}

export interface Inventory {
  inventoryId: string;
  title: string;
  typeInventory: 'ByEquipment' | 'ByShelf';
  status: InventoryStatus;
  policyVersion?: number;
  thirdCountRequired?: boolean;
  finalResultSource?: 'PRIMARY_DOUBLE_COUNT_MATCH' | 'THIRD_FULL_RECOUNT_FINAL';
  launchedAt?: string;
  finalizedAt?: string;
  createdAt: string;
  Inventory_User: InventoryUser[];
}

export interface InventoryWorkUnit {
  unitId: string;
  inventoryId: string;
  equipmentId?: string;
  shelfId?: string;
  unitOrder?: number;
  status: WorkUnitStatus;
  equipment?: {
    equipmentId: string;
    equipmentName: string;
    hasSerialNumber: boolean;
  };
  shelf?: {
    shelfId: string;
    shelfName: string;
  };
  inventory?: Inventory;
}

export interface InventoryCountAttempt {
  attemptId: string;
  unitId: string;
  assignedUserId: string;
  sequence: number;
  purpose: string;
  status: AttemptStatus;
  draftData?: string;
  unit?: InventoryWorkUnit;
  orders?: any[];
}

export interface PipelineParticipantProgress {
  role: string;
  sequence: number;
  userId: string;
  userName: string;
  userEmail: string;
  completedUnits: number;
  totalUnits: number;
  status: 'ACTIVE' | 'BLOCKED' | 'COMPLETED' | 'NOT_REQUIRED';
}

export interface InventoryProgress {
  inventoryId: string;
  title: string;
  typeInventory: 'ByEquipment' | 'ByShelf';
  status: InventoryStatus;
  policyVersion: number;
  thirdCountRequired: boolean;
  finalResultSource?: string;
  totalWorkUnits: number;
  participants: PipelineParticipantProgress[];
}

export interface InventoryInvestigationIssue {
  issueId: string;
  inventoryId: string;
  issueType: 'MISSING_SERIAL' | 'MISSING_QUANTITY' | 'UNEXPECTED_ITEM';
  equipmentId: string;
  serialNumberId?: string;
  expectedShelfId?: string;
  expectedQuantity: number;
  finalQuantity: number;
  delta: number;
  movementExplanation?: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  resolutionType?: 'FOUND_IN_ANOTHER_LOCATION' | 'MOVED_WITHOUT_RECORDED_MOVEMENT' | 'LOST';
  resolutionShelfId?: string;
  resolutionNotes?: string;
  resolvedByUserId?: string;
  resolvedAt?: string;
  createdAt: string;
  equipment?: {
    equipmentId: string;
    equipmentName: string;
  };
  serialNumber?: {
    serialNumberId: string;
    serialNumberCode: string;
  };
  expectedShelf?: {
    shelfId: string;
    shelfName: string;
  };
  resolutionShelf?: {
    shelfId: string;
    shelfName: string;
  };
  resolvedByUser?: {
    userName: string;
    userEmail: string;
  };
}

export interface InventoryReportSummary {
  conformes: number;
  quantiteManquante: number;
  quantiteExcedentaire: number;
  changementsEmplacement: number;
  numerosSerieManquants: number;
  numerosSerieDeplaces: number;
  inexpliques: number;
}

export interface InventoryReport {
  inventory: {
    inventoryId: string;
    title: string;
    typeInventory: 'ByEquipment' | 'ByShelf';
    status: InventoryStatus;
    policyVersion: number;
    finalResultSource?: string;
    thirdCountRequired: boolean;
    launchedAt?: string;
    finalizedAt?: string;
    createdAt: string;
  };
  participants: {
    controller1?: { userId: string; userName: string; userEmail: string };
    controller2?: { userId: string; userName: string; userEmail: string };
    finalController?: { userId: string; userName: string; userEmail: string };
  };
  workUnits: any[];
  discrepancyCount: number;
  previousInventory: {
    baselineInventoryId?: string;
    baselineStatus: string;
    comparison: any[];
  };
  movementReconciliation: {
    available: boolean;
    note?: string;
    details: any[];
  };
  issues: InventoryInvestigationIssue[];
  summary: InventoryReportSummary;
}
