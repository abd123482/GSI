export interface SerialNumber {
  serialNumberId: string;
  serialNumberCode: string | null;
  serialNumberStatus: string | null;

  equipmentId: string | null;
  shelfId: string | null;

  equipment?: {
    equipmentId: string;
    equipmentName: string | null;
    hasSerialNumber?: boolean;
  } | null;

  shelf?: {
    shelfId: string;
    shelfName: string | null;
  } | null;
}

export interface EquipmentShelfAllocation {
  equipmentShelfId: string;
  equipmentId: string;
  shelfId: string;
  equipmentQuantity: number;

  shelf?: {
    shelfId: string;
    shelfName: string | null;
  } | null;
}

export interface Equipment {
  equipmentId: string;
  equipmentName: string | null;
  hasSerialNumber: boolean;

  /**
   * Standard equipment:
   * physical global stock.
   *
   * Serialized equipment:
   * number of registered serial identities.
   */
  equipmentQuantity: number;

  minequipmentQuantity: number;

  /**
   * Lightweight list responses do NOT embed all serials.
   * Load serials with the paginated serial-number API.
   */
  serialNumbers?: SerialNumber[];

  /**
   * Backend list responses include positive allocations only.
   */
  equipmentShelfs?: EquipmentShelfAllocation[];

  /**
   * Lightweight relation counts returned by Equipment list/detail.
   */
  _count?: {
    serialNumbers: number;
    equipmentShelfs: number;
  };
}

export interface EquipmentWithShelvesResponse
  extends Equipment {
  totalAllocated?: number;
  unallocatedQuantity?: number;
  shelvesCount?: number;
}

/**
 * V3 equipment creation is metadata-only.
 *
 * The backend creates equipmentQuantity = 0.
 * Physical stock enters through POST /movements with movementType = IN.
 *
 * serialNumbers is a frontend convenience:
 * EquipmentService may create these identities in a second request
 * after equipment metadata has been created.
 */
export interface CreateEquipmentDirectInput {
  equipmentName: string;
  hasSerialNumber: boolean;
  minEquipmentQuantity?: number;
  serialNumbers?: string[];

  /**
   * @deprecated
   * Temporary compatibility fields for the still-old
   * CreateEquipmentModal / EquipmentService.
   *
   * They will be removed in the next frontend step.
   * Backend V3 ignores direct initial physical stock placement.
   */
  equipmentQuantity?: number;
  shelfId?: string | null;
}

export interface CreateBatchSerialNumberInput {
  equipmentId: string;
  serialNumberCodes: string[];
  serialNumberStatus?: string;

  /**
   * @deprecated
   * Serial creation must not assign a shelf.
   * Location changes only through Movement.
   */
  shelfId?: string | null;
}

export interface PaginatedSerialNumbersResponse {
  serialNumbers: SerialNumber[];
  totalSerialNumbers: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface PaginatedEquipmentsResponse {
  equipments: Equipment[];
  totalEquipments: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface EquipmentPaginationQuery {
  page?: number;
  limit?: number;
  equipmentName?: string;
  hasSerialNumber?: boolean;
  shelfId?: string;
}
