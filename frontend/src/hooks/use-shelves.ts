'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useApi } from './use-api';
import { useAuthQueryContext } from './use-auth-query-context';
import { usePermissions } from './use-permissions';
import { ShelfService } from '@/services/shelf.service';
import type {
  CreateShelfInput,
  PaginatedShelvesResponse,
  Shelf,
  ShelfPaginationQuery,
  UpdateShelfInput,
} from '@/types/shelf';

interface UseShelvesOptions extends ShelfPaginationQuery {
  initialSearch?: string;
  enabled?: boolean;
}

export function useShelves(options?: UseShelvesOptions) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
  const queryClient = useQueryClient();
  const {
    permissions,
    canCreateShelf,
    canUpdateShelf,
    canDeleteShelf,
  } = usePermissions();

  const [page, setPage] = useState(options?.page ?? 1);
  const [limit, setLimit] = useState(options?.limit ?? 12);
  const [searchTerm, setSearchTerm] = useState(options?.initialSearch ?? '');

  const shelvesQuery = useQuery<PaginatedShelvesResponse>({
    queryKey: ['shelves', { page, limit, search: searchTerm.trim() }, userId],
    queryFn: () =>
      searchTerm.trim()
        ? ShelfService.searchShelves(api, searchTerm.trim(), { page, limit })
        : ShelfService.getAllShelves(api, { page, limit }),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateShelfInput) =>
      ShelfService.createShelf(api, input, permissions),
    onSuccess: async (shelf) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shelves', userId] }),
        queryClient.invalidateQueries({ queryKey: ['stocks', userId] }),
      ]);
      toast.success('Emplacement créé', {
        description: shelf.shelfName ?? 'Nouvel emplacement',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateShelfInput }) =>
      ShelfService.updateShelf(api, id, data, permissions),
    onSuccess: async (shelf) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shelves', userId] }),
        queryClient.invalidateQueries({ queryKey: ['shelf', shelf.shelfId, userId] }),
        queryClient.invalidateQueries({ queryKey: ['shelf-contents', shelf.shelfId, userId] }),
        queryClient.invalidateQueries({ queryKey: ['stocks', userId] }),
      ]);
      toast.success('Emplacement modifié');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ShelfService.deleteShelf(api, id, permissions),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shelves', userId] }),
        queryClient.invalidateQueries({ queryKey: ['stocks', userId] }),
      ]);
      toast.success('Emplacement supprimé');
    },
  });

  const handleSearch = useCallback((query: string) => {
    setSearchTerm(query);
    setPage(1);
  }, []);

  return {
    shelves: shelvesQuery.data?.shelves ?? [],
    totalShelves: shelvesQuery.data?.totalShelves ?? 0,
    totalPages: shelvesQuery.data?.totalPages ?? 1,
    currentPage: page,
    limit,
    searchTerm,
    setSearchTerm: handleSearch,
    setPage,
    setLimit,
    isLoading: shelvesQuery.isLoading,
    isFetching: shelvesQuery.isFetching,
    isError: shelvesQuery.isError,
    error: shelvesQuery.error,
    refetch: shelvesQuery.refetch,
    canCreateShelf,
    canUpdateShelf,
    canDeleteShelf,
    createShelf: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    creationError: createMutation.error,
    updateShelf: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteShelf: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

export function useShelf(id?: string | null) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
  return useQuery<Shelf>({
    queryKey: ['shelf', id, userId],
    queryFn: () => ShelfService.getShelfById(api, id!),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useShelfContents(shelfId?: string | null, enabled = true) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
  const { permissions } = usePermissions();
  return useQuery({
    queryKey: ['shelf-contents', shelfId, userId],
    queryFn: () => ShelfService.getShelfContents(api, shelfId!, permissions),
    enabled: enabled && Boolean(shelfId),
    staleTime: 20_000,
  });
}

export function useShelfEquipment(
  shelfId?: string | null,
  page = 1,
  limit = 100,
  enabled = true,
) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
  const { permissions } = usePermissions();
  return useQuery({
    queryKey: ['shelf-equipment', shelfId, page, limit, userId],
    queryFn: () =>
      ShelfService.getShelfEquipment(api, shelfId!, { page, limit }, permissions),
    enabled: enabled && Boolean(shelfId),
    placeholderData: keepPreviousData,
  });
}

export function useShelfSerialNumbers(
  shelfId?: string | null,
  page = 1,
  limit = 100,
  enabled = true,
) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
  const { permissions } = usePermissions();
  return useQuery({
    queryKey: ['shelf-serial-numbers', shelfId, page, limit, userId],
    queryFn: () =>
      ShelfService.getShelfSerialNumbers(api, shelfId!, { page, limit }, permissions),
    enabled: enabled && Boolean(shelfId),
    placeholderData: keepPreviousData,
  });
}
