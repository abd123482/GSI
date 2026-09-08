/**
 * Types and interfaces for Shelves in the Somépharm maintenance platform.
 * Directly maps to the SQL Server Shelf tuple schema.
 */

export interface Shelf {
  shelfId: string;
  shelfName: string | null;
  shelfQuantity: number;
}

export interface CreateShelfInput {
  shelfName: string;
  shelfQuantity?: number;
  shelfCode?: string;
}

export interface UpdateShelfInput {
  shelfName?: string;
  shelfQuantity?: number;
  shelfCode?: string;
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

