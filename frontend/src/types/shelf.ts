import type {
  SerialNumber,
} from './equipment';

export interface Shelf {
  shelfId: string;
  shelfName: string | null;

  /**
   * Aggregate physical units currently stored on this shelf.
   * Read-only from Shelf CRUD. MovementService owns physical changes.
   */
  shelfQuantity: number;

  stockId?: string | null;

  stock?: {
    stockId: string;
    stockName: string | null;
  } | null;
}

export interface CreateShelfInput {
  shelfName: string;
  stockId?: string | null;
}

export interface UpdateShelfInput {
  shelfName?: string;
  stockId?: string | null;
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
  equipmentId: string | null;
  shelfId: string | null;
  equipmentQuantity: number;

  equipment?: {
    equipmentId: string;
    equipmentName: string | null;
    hasSerialNumber: boolean;
    equipmentQuantity: number;
    minequipmentQuantity: number;
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
