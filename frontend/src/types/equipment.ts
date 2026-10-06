export type EquipmentStatus = boolean;

export interface SerialNumber {
  serialNumberId: string;
  serialNumberCode: string;
  serialNumberStatus: string;
  equipmentId: string;
  shelfId?: string | null;

  equipment?: {
    equipmentId: string;
    equipmentName: string | null;
    hasSerialNumber?: boolean;
    equipmentStatus?: EquipmentStatus;
  } | null;

  shelf?: {
    shelfId: string;
    shelfName: string | null;
    stockId?: string;
  } | null;
}

export interface EquipmentShelfAllocation {
  equipmentShelfId: string;
  equipmentId?: string;
  shelfId: string;
  equipmentQuantity: number;

  shelf?: {
    shelfId: string;
    shelfName: string | null;
    stockId?: string;
  } | null;
}

export interface Equipment {
  equipmentId: string;
  equipmentName: string | null;
  hasSerialNumber: boolean;
  equipmentQuantity?: number;
  minequipmentQuantity: number;
  equipmentStatus: EquipmentStatus;

  serialNumbers?: SerialNumber[];
  equipmentShelfs?: EquipmentShelfAllocation[];

  _count?: {
    serialNumbers: number;
    equipmentShelfs: number;
  };
}

export interface EquipmentWithShelvesResponse extends Equipment {
  totalAllocated: number;
  unallocatedQuantity: number;
  shelvesCount: number;
}

export interface CreateEquipmentDirectInput {
  equipmentName: string;
  hasSerialNumber: boolean;
  minEquipmentQuantity?: number;
  equipmentStatus?: EquipmentStatus;
}

export interface UpdateEquipmentInput {
  equipmentName?: string;
  minEquipmentQuantity?: number;
  equipmentStatus?: EquipmentStatus;
  hasSerialNumber?: true;
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
  equipmentStatus?: EquipmentStatus;
}

