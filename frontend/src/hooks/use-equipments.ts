'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  useCallback,
  useState,
} from 'react';
import {
  toast,
} from 'sonner';

import {
  useApi,
} from './use-api';
import {
  usePermissions,
} from './use-permissions';

import {
  EquipmentService,
} from '@/services/equipment.service';

import type {
  CreateEquipmentDirectInput,
  EquipmentPaginationQuery,
  UpdateEquipmentInput,
} from '@/types/equipment';

interface UseEquipmentsOptions
  extends EquipmentPaginationQuery {
  initialSearch?: string;
  enabled?: boolean;
}

export function useEquipments(
  options?: UseEquipmentsOptions,
) {
  const api = useApi();
  const queryClient =
    useQueryClient();

  const {
    permissions,
  } = usePermissions();

  const [
    page,
    setPage,
  ] = useState(
    options?.page ?? 1,
  );

  const [
    limit,
    setLimit,
  ] = useState(
    options?.limit ?? 10,
  );

  const [
    searchTerm,
    setSearchTerm,
  ] = useState(
    options?.initialSearch ??
      '',
  );

  const [
    equipmentStatus,
    setEquipmentStatus,
  ] = useState(
    options?.equipmentStatus,
  );

  const [
    hasSerialNumber,
    setHasSerialNumber,
  ] = useState<
    boolean | undefined
  >(
    options?.hasSerialNumber,
  );

  const equipmentsQuery =
    useQuery({
      queryKey: [
        'equipments',
        {
          page,
          limit,
          searchTerm,
          equipmentStatus,
          hasSerialNumber,
        },
      ],

      queryFn: () => {
        const filtered =
          Boolean(
            searchTerm.trim(),
          ) ||
          equipmentStatus !==
            undefined ||
          hasSerialNumber !==
            undefined;

        return filtered
          ? EquipmentService.searchEquipments(
              api,
              {
                page,
                limit,
                equipmentName:
                  searchTerm.trim() ||
                  undefined,
                equipmentStatus,
                hasSerialNumber,
              },
            )
          : EquipmentService.getAllEquipments(
              api,
              {
                page,
                limit,
              },
            );
      },

      enabled:
        options?.enabled ??
        true,

      placeholderData:
        keepPreviousData,

      staleTime: 20_000,
    });

  const createMutation =
    useMutation({
      mutationFn: (
        input: CreateEquipmentDirectInput,
      ) =>
        EquipmentService.createEquipmentDirect(
          api,
          input,
          permissions,
        ),

      onSuccess:
        async (equipment) => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: [
                'equipments',
              ],
            }),
            queryClient.invalidateQueries({
              queryKey: [
                'serial-numbers',
              ],
            }),
          ]);

          toast.success(
            'Article créé',
            {
              description:
                equipment.equipmentName ??
                'Nouvel article',
            },
          );
        },
    });

  const updateMutation =
    useMutation({
      mutationFn: ({
        id,
        input,
      }: {
        id: string;
        input: UpdateEquipmentInput;
      }) =>
        EquipmentService.updateEquipment(
          api,
          id,
          input,
          permissions,
        ),

      onSuccess:
        async (equipment) => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: [
                'equipments',
              ],
            }),
            queryClient.invalidateQueries({
              queryKey: [
                'equipment',
                equipment.equipmentId,
              ],
            }),
            queryClient.invalidateQueries({
              queryKey: [
                'serial-numbers',
              ],
            }),
          ]);

          toast.success(
            'Article modifié',
          );
        },
    });

  const deleteMutation =
    useMutation({
      mutationFn: (
        id: string,
      ) =>
        EquipmentService.deleteEquipment(
          api,
          id,
          permissions,
        ),

      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: [
            'equipments',
          ],
        });

        toast.success(
          'Article supprimé',
        );
      },
    });

  const handleSearch =
    useCallback(
      (value: string) => {
        setSearchTerm(
          value,
        );
        setPage(1);
      },
      [],
    );

  return {
    equipments:
      equipmentsQuery.data
        ?.equipments ?? [],

    totalEquipments:
      equipmentsQuery.data
        ?.totalEquipments ?? 0,

    totalPages:
      equipmentsQuery.data
        ?.totalPages ?? 1,

    currentPage: page,
    limit,
    searchTerm,
    equipmentStatus,
    hasSerialNumber,

    setSearchTerm:
      handleSearch,

    setEquipmentStatus: (
      value:
        | 'ACTIVE'
        | 'INACTIVE'
        | undefined,
    ) => {
      setEquipmentStatus(
        value,
      );
      setPage(1);
    },

    setHasSerialNumber: (
      value:
        | boolean
        | undefined,
    ) => {
      setHasSerialNumber(
        value,
      );
      setPage(1);
    },

    setPage,
    setLimit,

    isLoading:
      equipmentsQuery.isLoading,
    isFetching:
      equipmentsQuery.isFetching,
    isError:
      equipmentsQuery.isError,
    error:
      equipmentsQuery.error,
    refetch:
      equipmentsQuery.refetch,

    getEquipmentById:
      (
        id: string,
      ) =>
        EquipmentService.getEquipmentById(
          api,
          id,
        ),

    getEquipmentShelves:
      (
        id: string,
      ) =>
        EquipmentService.getEquipmentShelves(
          api,
          id,
          permissions,
        ),

    createEquipment:
      createMutation.mutateAsync,
    isCreatingEquipment:
      createMutation.isPending,

    updateEquipment:
      updateMutation.mutateAsync,
    isUpdating:
      updateMutation.isPending,

    deleteEquipment:
      deleteMutation.mutateAsync,
    isDeleting:
      deleteMutation.isPending,
  };
}
