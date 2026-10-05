import type { SerialNumber } from './equipment';

export interface Shelf {
  shelfId: string;
  shelfName: string | null;
  stockId: string;
  status: boolean;
  stock?: {
    stockId: string;
    stockName: string | null;
    status: boolean;
  } | null;
}

export interface CreateShelfInput {
  shelfName: string;
  stockId: string;
  status?: boolean;
}

export interface UpdateShelfInput {
  shelfName?: string;
  stockId?: string;
  status?: boolean;
}

export interface ShelfPaginationQuery {
  page?: number;
  limit?: number;
}

export interface SearchShelfQuery {
  shelfName?: string;
  stockId?: string;
  status?: boolean;
}

export interface PaginatedShelvesResponse {
  shelves: Shelf[];
  totalShelves: number;
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
