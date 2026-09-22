import type { SerialNumber } from './equipment';

export interface Shelf {
  shelfId: string;
  shelfName: string | null;
  shelfQuantity: number;
  stockId: string;
  stock?: {
    stockId: string;
    stockName: string | null;
    stockStatus?: {
      stockStatusName: 'ACTIVE' | 'INACTIVE';
    } | null;
  } | null;
}

export interface CreateShelfInput {
  shelfName: string;
  stockId: string;
}

export interface UpdateShelfInput {
  shelfName?: string;
  stockId?: string;
}

export interface ShelfPaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedShelvesResponse {
  shelves: Shelf[];
  totalShelves: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface ShelfEquipmentAllocation {
  equipmentShelfId: string;
  equipmentId: string;
  shelfId: string;
  equipmentQuantity: number;
  equipment?: {
    equipmentId: string;
    equipmentName: string | null;
    hasSerialNumber: boolean;
    equipmentQuantity: number;
    minequipmentQuantity: number;
    equipmentStatus?: string;
  } | null;
}

export interface PaginatedShelfEquipmentResponse {
  allocations: ShelfEquipmentAllocation[];
  totalAllocations: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface PaginatedShelfSerialNumbersResponse {
  serialNumbers: SerialNumber[];
  totalSerialNumbers: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface ShelfContents {
  allocations: ShelfEquipmentAllocation[];
  serialNumbers: SerialNumber[];
}
