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
  SerialNumberService,
  type CreateBatchSerialNumbersInput,
  type CreateSerialNumberInput,
  type SerialNumberQuery,
  type UpdateSerialNumberInput,
} from '@/services/serial-number.service';

export function useSerialNumbers(
  query: SerialNumberQuery = {},
  enabled = true,
) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  const {
    permissions,
  } = usePermissions();

  const normalizedQuery:
    SerialNumberQuery = {
      page:
        query.page ?? 1,
      limit:
        query.limit ?? 20,
      serialNumberCode:
        query.serialNumberCode,
      serialNumberStatus:
        query.serialNumberStatus,
      equipmentId:
        query.equipmentId,
      shelfId:
        query.shelfId,
    };

  return useQuery({
    queryKey: [
      'serial-numbers',
      normalizedQuery, userId],

    queryFn: () =>
      SerialNumberService.getSerialNumbers(
        api,
        normalizedQuery,
        permissions,
      ),

    enabled,

    placeholderData:
      keepPreviousData,

    staleTime: 20_000,
  });
}

export function useCreateSerialNumber() {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
  const queryClient =
    useQueryClient();

  const {
    permissions,
  } = usePermissions();

  return useMutation({
    mutationFn: (
      input: CreateSerialNumberInput,
    ) =>
      SerialNumberService.createSerialNumber(
        api,
        input,
        permissions,
      ),

    onSuccess:
      async (serial) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              'serial-numbers', userId],
          }),
          queryClient.invalidateQueries({
            queryKey: [
              'equipments', userId],
          }),
        ]);

        toast.success(
          'Numéro de série créé',
          {
            description:
              serial.serialNumberCode,
          },
        );
      },

    onError: (
      error: unknown,
    ) => {
      toast.error(
        'Création impossible',
        {
          description:
            getErrorMessage(
              error,
              'Impossible de créer le numéro de série.',
            ),
        },
      );
    },
  });
}

export function useCreateBatchSerialNumbers() {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
  const queryClient =
    useQueryClient();

  const {
    permissions,
  } = usePermissions();

  return useMutation({
    mutationFn: (
      input: CreateBatchSerialNumbersInput,
    ) =>
      SerialNumberService.createBatchSerialNumbers(
        api,
        input,
        permissions,
      ),

    onSuccess:
      async (result) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              'serial-numbers', userId],
          }),
          queryClient.invalidateQueries({
            queryKey: [
              'equipments', userId],
          }),
        ]);

        toast.success(
          'Numéros de série créés',
          {
            description:
              `${result.count} numéro(s) enregistré(s).`,
          },
        );
      },
  });
}

export function useUpdateSerialNumber() {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
  const queryClient =
    useQueryClient();

  const {
    permissions,
  } = usePermissions();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateSerialNumberInput;
    }) =>
      SerialNumberService.updateSerialNumber(
        api,
        id,
        input,
        permissions,
      ),

    onSuccess:
      async (serial) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              'serial-numbers', userId],
          }),
          queryClient.invalidateQueries({
            queryKey: [
              'equipments', userId],
          }),
          queryClient.invalidateQueries({
            queryKey: [
              'shelf-contents', userId],
          }),
        ]);

        toast.success(
          'Statut du numéro de série mis à jour',
          {
            description:
              serial.serialNumberCode,
          },
        );
      },

    onError: (
      error: unknown,
    ) => {
      toast.error(
        'Modification impossible',
        {
          description:
            getErrorMessage(
              error,
              'Impossible de modifier le statut.',
            ),
        },
      );
    },
  });
}

export function useDeleteSerialNumber() {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
  const queryClient =
    useQueryClient();

  const {
    permissions,
  } = usePermissions();

  return useMutation({
    mutationFn: (
      id: string,
    ) =>
      SerialNumberService.deleteSerialNumber(
        api,
        id,
        permissions,
      ),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            'serial-numbers', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'equipments', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'shelf-contents', userId],
        }),
      ]);

      toast.success(
        'Numéro de série supprimé',
      );
    },
  });
}
