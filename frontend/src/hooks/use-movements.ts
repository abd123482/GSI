'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  toast,
} from 'sonner';

import {
  useApi,
} from '@/hooks/use-api';

import {
  useAuthQueryContext,
} from '@/hooks/use-auth-query-context';

import {
  usePermissions,
} from '@/hooks/use-permissions';

import {
  getErrorMessage,
} from '@/lib/error-message';

import {
  MovementService,
} from '@/services/movement.service';

import type {
  CreateMovementInput,
  MovementQuery,
} from '@/types/movement';

export function useMovements(
  query: MovementQuery = {},
  enabled = true,
) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  const {
    permissions,
  } = usePermissions();

  const normalized: MovementQuery = {
    page:
      query.page ?? 1,
    limit:
      query.limit ?? 20,
    movementType:
      query.movementType,
    origin:
      query.origin,
    inventoryId:
      query.inventoryId,
    equipmentId:
      query.equipmentId,
    serialNumberId:
      query.serialNumberId,
    sourceShelfId:
      query.sourceShelfId,
    destinationShelfId:
      query.destinationShelfId,
  };

  return useQuery({
    queryKey: [
      'movements',
      normalized, userId],

    queryFn: () =>
      MovementService.getMovements(
        api,
        normalized,
        permissions,
      ),

    enabled,

    placeholderData:
      keepPreviousData,

    staleTime: 20_000,
  });
}

export function useMovement(
  movementId?: string | null,
  enabled = true,
) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  const {
    permissions,
  } = usePermissions();

  return useQuery({
    queryKey: [
      'movements',
      'detail',
      movementId, userId],

    queryFn: () =>
      MovementService.getMovementById(
        api,
        movementId!,
        permissions,
      ),

    enabled:
      enabled &&
      Boolean(
        movementId,
      ),

    staleTime: 30_000,
  });
}

export function useCreateMovement() {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  const queryClient =
    useQueryClient();

  const {
    permissions,
  } = usePermissions();

  return useMutation({
    mutationFn: (
      input: CreateMovementInput,
    ) =>
      MovementService.createMovement(
        api,
        input,
        permissions,
      ),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            'movements', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'equipments', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'serial-numbers', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'shelves', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'shelf-contents', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'dashboard', userId],
        }),
      ]);

      toast.success(
        'Mouvement enregistré',
      );
    },

    onError: (
      error: unknown,
    ) => {
      toast.error(
        'Mouvement impossible',
        {
          description:
            getErrorMessage(
              error,
              'Le mouvement a été refusé.',
            ),
        },
      );
    },
  });
}

export type MovementTypeV3 =
  'IN' | 'OUT' | 'TRANSFER';
