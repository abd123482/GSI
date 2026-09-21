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
import { usePermissions } from './use-permissions';
import {
  EquipmentService,
  REQUIRED_EQUIPMENT_READ_PERMISSION,
} from '@/services/equipment.service';
import type {
  Equipment,
  EquipmentPaginationQuery,
  EquipmentWithShelvesResponse,
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
  const queryClient = useQueryClient();
  const { permissions, hasPermission } =
    usePermissions();

  const [page, setPage] = useState<number>(
    options?.page ?? 1,
  );
  const [limit, setLimit] = useState<number>(
    options?.limit ?? 10,
  );
  const [searchTerm, setSearchTerm] =
    useState<string>(
      options?.initialSearch ?? '',
    );

  const canReadEquipment = hasPermission(
    REQUIRED_EQUIPMENT_READ_PERMISSION,
  );

  const equipmentsQuery = useQuery({
    queryKey: [
      'equipments',
      {
        page,
        limit,
        searchTerm,
      },
    ],
    queryFn: async () => {
      if (searchTerm.trim()) {
        return EquipmentService.searchEquipments(
          api,
          searchTerm.trim(),
          {
            page,
            limit,
          },
        );
      }

      return EquipmentService.getAllEquipments(
        api,
        {
          page,
          limit,
        },
      );
    },
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const fetchEquipmentById = async (
    id: string,
  ): Promise<Equipment> => {
    return EquipmentService.getEquipmentById(
      api,
      id,
    );
  };

  const fetchEquipmentShelves = async (
    id: string,
  ): Promise<EquipmentWithShelvesResponse> => {
    return EquipmentService.getEquipmentShelves(
      api,
      id,
      permissions,
    );
  };

  const updateEquipmentMutation = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: {
        equipmentName?: string;
        equipmentQuantity?: number;
        minEquipmentQuantity?: number;
        hasSerialNumber?: boolean;
      };
    }) => {
      /*
       * This compatibility shape is intentionally kept until
       * EditEquipmentModal is simplified in the next frontend step.
       *
       * Backend V3 only applies equipmentName/minEquipmentQuantity.
       */
      return EquipmentService.updateEquipment(
        api,
        id,
        input,
        permissions,
      );
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['equipments'],
      });
      queryClient.invalidateQueries({
        queryKey: ['shelves'],
      });

      toast.success('Article mis à jour', {
        description: `L'article "${data.equipmentName}" a été actualisé.`,
      });
    },

    onError: (error: Error) => {
      toast.error('Erreur de mise à jour', {
        description:
          error?.message ||
          'Impossible de modifier cet article.',
      });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return EquipmentService.deleteEquipment(
        api,
        id,
        permissions,
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['equipments'],
      });
      queryClient.invalidateQueries({
        queryKey: ['shelves'],
      });

      toast.success('Article supprimé');
    },

    onError: (error: Error) => {
      toast.error('Erreur de suppression', {
        description:
          error?.message ||
          'Impossible de supprimer cet article.',
      });
    },
  });

  /**
   * Kept temporarily because the current Equipment page still uses
   * these actions. They will move fully to use-serial-numbers.ts later.
   */
  const updateSerialNumberMutation =
    useMutation({
      mutationFn: async ({
        id,
        input,
      }: {
        id: string;
        input: {
          serialNumberCode?: string;
          serialNumberStatus?: string;
        };
      }) => {
        return EquipmentService.updateSerialNumber(
          api,
          id,
          input,
          permissions,
        );
      },

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['equipments'],
        });
        queryClient.invalidateQueries({
          queryKey: ['serial-numbers'],
        });

        toast.success(
          'Numéro de série mis à jour',
        );
      },

      onError: (error: Error) => {
        toast.error('Erreur de mise à jour', {
          description:
            error?.message ||
            'Impossible de modifier le numéro de série.',
        });
      },
    });

  const deleteSerialNumberMutation =
    useMutation({
      mutationFn: async (id: string) => {
        return EquipmentService.deleteSerialNumber(
          api,
          id,
          permissions,
        );
      },

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['equipments'],
        });
        queryClient.invalidateQueries({
          queryKey: ['serial-numbers'],
        });
        queryClient.invalidateQueries({
          queryKey: ['shelves'],
        });

        toast.success(
          'Numéro de série supprimé',
        );
      },

      onError: (error: Error) => {
        toast.error('Erreur de suppression', {
          description:
            error?.message ||
            'Impossible de supprimer le numéro de série.',
        });
      },
    });

  const createEquipmentMutation = useMutation({
    mutationFn: async (
      input: import('@/types/equipment').CreateEquipmentDirectInput,
    ) => {
      return EquipmentService.createEquipmentDirect(
        api,
        input,
        permissions,
      );
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['equipments'],
      });
      queryClient.invalidateQueries({
        queryKey: ['serial-numbers'],
      });

      toast.success(
        'Article créé avec succès !',
        {
          description: `L'article "${data.equipmentName}" a été créé.`,
        },
      );
    },

    onError: (error: Error) => {
      toast.error(
        'Erreur lors de la création',
        {
          description:
            error?.message ||
            'Impossible de créer l’article.',
        },
      );
    },
  });

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchTerm(query);
      setPage(1);
    },
    [],
  );

  return {
    equipments:
      equipmentsQuery.data?.equipments ?? [],
    totalEquipments:
      equipmentsQuery.data?.totalEquipments ??
      0,
    totalPages:
      equipmentsQuery.data?.totalPages ?? 1,
    currentPage: page,
    limit,
    searchTerm,

    setSearchTerm: handleSearchChange,
    setPage,
    setLimit,

    isLoading: equipmentsQuery.isLoading,
    isFetching:
      equipmentsQuery.isFetching,
    isError: equipmentsQuery.isError,
    error: equipmentsQuery.error,
    refetch: equipmentsQuery.refetch,

    getEquipmentById: fetchEquipmentById,
    getEquipmentShelves:
      fetchEquipmentShelves,

    canReadEquipment,

    createEquipment:
      createEquipmentMutation.mutateAsync,
    isCreatingEquipment:
      createEquipmentMutation.isPending,

    updateEquipment:
      updateEquipmentMutation.mutateAsync,
    isUpdating:
      updateEquipmentMutation.isPending,

    deleteEquipment:
      deleteEquipmentMutation.mutateAsync,
    isDeleting:
      deleteEquipmentMutation.isPending,

    updateSerialNumber:
      updateSerialNumberMutation.mutateAsync,
    isUpdatingSerialNumber:
      updateSerialNumberMutation.isPending,

    deleteSerialNumber:
      deleteSerialNumberMutation.mutateAsync,
    isDeletingSerialNumber:
      deleteSerialNumberMutation.isPending,
  };
}
