export interface SerialNumber {
  serialNumberId: string;
  serialNumberCode: string | null;
  serialNumberStatus: string | null;
  equipmentId: string | null;
  shelfId: string | null;
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
  equipmentQuantity: number;
  minequipmentQuantity: number;
  serialNumbers?: SerialNumber[];
  equipmentShelfs?: EquipmentShelfAllocation[];
}

export interface EquipmentWithShelvesResponse extends Equipment {
  totalAllocated?: number;
  unallocatedQuantity?: number;
  shelvesCount?: number;
}

export interface CreateEquipmentDirectInput {
  equipmentName: string;
  hasSerialNumber: boolean;
  equipmentQuantity: number;
  minEquipmentQuantity?: number;
  serialNumbers?: string[];
}

export interface CreateBatchSerialNumberInput {
  equipmentId: string;
  serialNumberCodes: string[];
  serialNumberStatus?: string;
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
}
