export type InventoryStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'THIRD_COUNT_REQUIRED' // legacy read compatibility only
  | 'COMPLETED'
  | 'FINALIZED'
  | 'CANCELLED';

export type InventoryType =
  | 'ByEquipment'
  | 'ByShelf';

export type ReconciliationStatus =
  | 'PENDING'
  | 'PRIMARY_MATCH'
  | 'THIRD_REQUIRED'
  | 'THIRD_RESOLVED';

export type AttemptPurpose =
  | 'PRIMARY_1'
  | 'PRIMARY_2'
  | 'FINAL_RECOUNT';

export type AttemptStatus =
  | 'BLOCKED'
  | 'AVAILABLE'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'SKIPPED'
  | 'CANCELLED';

export type InventoryResponsibility =
  | 'PRIMARY_COUNTER_1'
  | 'PRIMARY_COUNTER_2'
  | 'FINAL_CONTROLLER';

export interface InventoryUserSummary {
  userId: string;
  userName: string | null;
  userEmail: string | null;
}

export interface InventoryParticipant {
  inventoryId: string;
  userId: string;
  sequence: number;
  responsibility: string;
  roleSnapshot?: string | null;
  User?: InventoryUserSummary;
}

export interface InventoryAttempt {
  attemptId: string;
  unitId: string;
  assignedUserId: string;
  sequence: number;
  purpose: AttemptPurpose;
  status: AttemptStatus;
  submittedAt?: string | null;
  draftData?: string | null;
  assignedUser?: InventoryUserSummary | null;
}

export interface InventoryWorkUnit {
  unitId: string;
  inventoryId: string;
  unitOrder: number;
  status: string;
  equipmentId: string | null;
  shelfId: string | null;
  reconciliationStatus: ReconciliationStatus;
  acceptedAttemptId: string | null;
  reconciledAt?: string | null;
  attempts?: InventoryAttempt[];
  acceptedAttempt?: InventoryAttempt | null;
}

export interface Inventory {
  inventoryId: string;
  title: string;
  typeInventory: InventoryType;
  status: InventoryStatus;
  policyVersion?: number;
  createdAt?: string;
  launchedAt?: string | null;
  finalizedAt?: string | null;
  /** Legacy global fields: never authoritative in the new UI. */
  thirdCountRequired?: boolean;
  finalResultSource?: string | null;
  Inventory_User?: InventoryParticipant[];
  workUnits?: InventoryWorkUnit[];
  _count?: {
    investigationIssues?: number;
  };
}

export interface PaginatedInventoriesResponse {
  inventories: Inventory[];
  totalInventories: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface CreateInventoryInput {
  title: string;
  typeInventory: InventoryType;
  policyVersion?: number;
  users: Array<{
    userId: string;
    responsibility?: InventoryResponsibility;
  }>;
  equipmentIds?: string[];
  shelfIds?: string[];
}

export interface CountObservationInput {
  equipmentId?: string;
  shelfId?: string;
  serialNumberId?: string;
  scannedSerialCode?: string;
  observedEquipmentId?: string;
  observedShelfId?: string;
  quantityCalculated?: number;
  isExplicitZero?: boolean;
  isUnexpected?: boolean;
  notes?: string;
  unknownItemEvidence?: string;
}

export interface SubmitInventoryTaskInput {
  isDraft?: boolean;
  observations: CountObservationInput[];
  notes?: string;
}

export interface ExpectedShelf {
  shelfId: string;
  shelfName: string;
  quantity?: number;
}

export interface InventoryTask {
  attemptId: string;
  unitId: string;
  assignedUserId: string;
  sequence: number;
  purpose: AttemptPurpose;
  status: AttemptStatus;
  submittedAt?: string | null;
  draftData?: string | null;
  scopeLabel?: string;
  isSerialized?: boolean;
  expectedShelves?: ExpectedShelf[];
  unit: InventoryWorkUnit & {
    inventory: Inventory;
  };
}

export interface ControllerProgress {
  user: InventoryUserSummary | null;
  responsibility: InventoryResponsibility;
  completedUnits: number;
  totalUnits?: number;
  requiredUnits?: number;
  isActive?: boolean;
  isFinished: boolean;
}

export interface InventoryProgressWorkUnit {
  unitId: string;
  unitOrder: number;
  equipmentId: string | null;
  shelfId: string | null;
  status: string;
  reconciliationStatus: ReconciliationStatus;
  acceptedAttemptId: string | null;
  reconciledAt?: string | null;
  c1Status: AttemptStatus | 'BLOCKED';
  c2Status: AttemptStatus | 'BLOCKED';
  c3Status: AttemptStatus | 'NOT_REQUIRED';
}

export interface InventoryProgress {
  inventoryId: string;
  title: string;
  typeInventory: InventoryType;
  status: InventoryStatus;
  policyVersion: number;
  totalUnits: number;
  reconciledUnits: number;
  controllers: {
    controller1: ControllerProgress;
    controller2: ControllerProgress;
    controller3: ControllerProgress;
  };
  workUnits: InventoryProgressWorkUnit[];
}

export type InventoryComparisonStatus =
  | 'CONFORME'
  | 'MANQUE'
  | 'SURPLUS'
  | 'MAUVAISE_POSITION'
  | 'MAUVAIS_ARTICLE'
  | 'PENDING'
  | 'ECART';

export interface InventoryReportCell {
  quantity: number;
  serialNumberCode: string | null;
  serialNumberId: string | null;
  equipmentId: string | null;
  equipmentName: string | null;
  shelfId: string | null;
  shelfName: string | null;
  isUnexpected: boolean;
  notes: string[];
}

export interface InventoryComparisonResult {
  status: InventoryComparisonStatus;
  delta: number | null;
  missing: number;
  surplus: number;
}

export interface InventoryReportRow {
  key: string;
  kind: 'STANDARD' | 'SERIALIZED' | 'UNKNOWN';
  equipmentId: string | null;
  equipmentName: string | null;
  shelfId: string | null;
  shelfName: string | null;
  serialNumberCode: string | null;
  controller1: InventoryReportCell | null;
  controller2: InventoryReportCell | null;
  controller3: InventoryReportCell | null;
  accepted: InventoryReportCell | null;
  controller1VsAccepted: InventoryComparisonResult;
  controller2VsAccepted: InventoryComparisonResult;
}

export interface InventoryReportUnit {
  unitId: string;
  unitOrder: number;
  equipmentId: string | null;
  shelfId: string | null;
  status: string;
  reconciliationStatus: ReconciliationStatus;
  acceptedAttemptId: string | null;
  acceptedPurpose: AttemptPurpose | null;
  attempts: {
    controller1: { attemptId: string; user?: InventoryUserSummary | null; submittedAt?: string | null } | null;
    controller2: { attemptId: string; user?: InventoryUserSummary | null; submittedAt?: string | null } | null;
    controller3: { attemptId: string; user?: InventoryUserSummary | null; submittedAt?: string | null } | null;
  };
  rows: InventoryReportRow[];
}

export interface InventoryReportSummary {
  totalUnits: number;
  primaryMatchUnits: number;
  thirdRequiredUnits: number;
  thirdResolvedUnits: number;
  compliantRows: number;
  controller1: {
    missing: number;
    surplus: number;
  };
  controller2: {
    missing: number;
    surplus: number;
  };
  locationMismatches: number;
}

export interface InventoryInvestigationIssue {
  issueId: string;
  inventoryId: string;
  issueType: string;
  status: string;
  serialNumberCode?: string | null;
  expectedQuantity?: number | null;
  finalQuantity?: number | null;
  deltaQuantity?: number | null;
  movementExplanation?: string | null;
  equipment?: {
    equipmentId: string;
    equipmentName: string | null;
  } | null;
  serialNumber?: {
    serialNumberId: string;
    serialNumberCode: string;
  } | null;
  expectedShelf?: {
    shelfId: string;
    shelfName: string | null;
  } | null;
  finalObservedShelf?: {
    shelfId: string;
    shelfName: string | null;
  } | null;
}

export interface InventoryReport {
  inventory: {
    inventoryId: string;
    title: string;
    typeInventory: InventoryType;
    status: InventoryStatus;
    createdAt?: string;
    launchedAt?: string | null;
    finalizedAt?: string | null;
    policyVersion: number;
  };
  controllers: Array<{
    sequence: number;
    responsibility: string;
    user: InventoryUserSummary;
  }>;
  units: InventoryReportUnit[];
  summary: InventoryReportSummary;
  baselineLaunch: {
    quantities: unknown[];
    serials: unknown[];
  };
  physicalTruth: {
    quantities: unknown[];
    serials: unknown[];
  };
  investigationIssues: InventoryInvestigationIssue[];
  adjustmentMovements: unknown[];
}
