'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useApi } from './use-api';
import { usePermissions } from './use-permissions';
import { ShelfService } from '@/services/shelf.service';
import {
  Shelf,
  CreateShelfInput,
  UpdateShelfInput,
  ShelfPaginationQuery,
  PaginatedShelvesResponse,
} from '@/types/shelf';
import { toast } from 'sonner';

interface UseShelvesOptions extends ShelfPaginationQuery {
  initialSearch?: string;
  enabled?: boolean;
}

/**
 * Hook for managing shelves state, caching, search with pagination, and mutations.
 */
export function useShelves(options?: UseShelvesOptions) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { permissions, canCreateShelf } = usePermissions();

  const [page, setPage] = useState<number>(options?.page ?? 1);
  const [limit, setLimit] = useState<number>(options?.limit ?? 10);
  const [searchTerm, setSearchTerm] = useState<string>(options?.initialSearch ?? '');

  // Query: Fetch shelves list with server-side search and pagination
  const shelvesQuery = useQuery<PaginatedShelvesResponse>({
    queryKey: ['shelves', searchTerm.trim(), page, limit],
    queryFn: () => {
      const cleanSearch = searchTerm.trim();
      if (cleanSearch.length > 0) {
        return ShelfService.searchShelves(api, cleanSearch, { page, limit });
      }
      return ShelfService.getAllShelves(api, { page, limit });
    },
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

  // Fetch single shelf by ID
  const fetchShelfById = async (id: string): Promise<Shelf> => {
    return ShelfService.getShelfById(api, id);
  };

  // Mutation: Create a new shelf with immediate cache invalidation
  const createShelfMutation = useMutation({
    mutationFn: async (input: CreateShelfInput) => {
      return ShelfService.createShelf(api, input, permissions);
    },
    onSuccess: (newShelf) => {
      queryClient.invalidateQueries({ queryKey: ['shelves'] });
      toast.success('Emplacement créé avec succès !', {
        description: `L'emplacement "${newShelf.shelfName}" a été enregistré avec succès.`,
      });
    },
    onError: (error) => {
      const msg = error?.message || 'Impossible de créer l’emplacement.';
      toast.error('Erreur lors de la création', {
        description: msg,
      });
    },
  });

  // Mutation: Update an existing shelf
  const updateShelfMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateShelfInput }) => {
      return ShelfService.updateShelf(api, id, data, permissions);
    },
    onSuccess: (updatedShelf) => {
      queryClient.invalidateQueries({ queryKey: ['shelves'] });
      queryClient.invalidateQueries({ queryKey: ['shelf', updatedShelf.shelfId] });
      toast.success('Emplacement modifié avec succès !', {
        description: `L'emplacement "${updatedShelf.shelfName}" a été mis à jour avec succès.`,
      });
    },
    onError: (error) => {
      const msg = error?.message || 'Impossible de mettre à jour l’emplacement.';
      toast.error('Erreur lors de la modification', {
        description: msg,
      });
    },
  });

  // Mutation: Delete an existing shelf
  const deleteShelfMutation = useMutation({
    mutationFn: async (id: string) => {
      return ShelfService.deleteShelf(api, id, permissions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelves'] });
      toast.success('Emplacement supprimé avec succès !', {
        description: "L'emplacement a été supprimé définitivement.",
      });
    },
    onError: (error) => {
      const msg = error?.message || 'Impossible de supprimer cet emplacement.';
      toast.error('Erreur lors de la suppression', {
        description: msg,
      });
    },
  });

  const handleSearchChange = useCallback((query: string) => {
    setSearchTerm(query);
    setPage(1); // Reset to page 1 whenever search query changes
  }, []);

  const { canUpdateShelf, canDeleteShelf } = usePermissions();

  return {
    shelves: shelvesQuery.data?.shelves ?? [],
    totalShelves: shelvesQuery.data?.totalShelves ?? 0,
    totalPages: shelvesQuery.data?.totalPages ?? 1,
    currentPage: page,
    limit,
    searchTerm,
    setSearchTerm: handleSearchChange,
    setPage,
    setLimit,
    isLoading: shelvesQuery.isLoading,
    isFetching: shelvesQuery.isFetching,
    isError: shelvesQuery.isError,
    error: shelvesQuery.error,
    refetch: shelvesQuery.refetch,
    getShelfById: fetchShelfById,
    canCreateShelf,
    canUpdateShelf,
    canDeleteShelf,
    createShelf: createShelfMutation.mutateAsync,
    isCreating: createShelfMutation.isPending,
    creationError: createShelfMutation.error,
    updateShelf: updateShelfMutation.mutateAsync,
    isUpdating: updateShelfMutation.isPending,
    deleteShelf: deleteShelfMutation.mutateAsync,
    isDeleting: deleteShelfMutation.isPending,
  };
}

/**
 * Hook for fetching a single shelf by ID using Notion design principles.
 */
export function useShelf(id?: string | null) {
  const api = useApi();

  return useQuery<Shelf>({
    queryKey: ['shelf', id],
    queryFn: () => ShelfService.getShelfById(api, id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}
