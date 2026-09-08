'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useApi } from './use-api';
import { usePermissions } from './use-permissions';
import {
  EquipmentService,
  REQUIRED_MOVEMENT_CREATE_PERMISSION,
  REQUIRED_EQUIPMENT_READ_PERMISSION,
} from '@/services/equipment.service';
import {
  Equipment,
  CreateEntryWithEquipmentInput,
  EquipmentPaginationQuery,
} from '@/types/equipment';
import { toast } from 'sonner';

interface UseEquipmentsOptions extends EquipmentPaginationQuery {
  initialSearch?: string;
}

export function useEquipments(options?: UseEquipmentsOptions) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { permissions, hasPermission } = usePermissions();

  const [page, setPage] = useState<number>(options?.page ?? 1);
  const [limit, setLimit] = useState<number>(options?.limit ?? 10);
  const [searchTerm, setSearchTerm] = useState<string>(options?.initialSearch ?? '');

  const canCreateMovement = hasPermission(REQUIRED_MOVEMENT_CREATE_PERMISSION);
  const canReadEquipment = hasPermission(REQUIRED_EQUIPMENT_READ_PERMISSION);

  // Query: Paginated equipments list (or search by name)
  const equipmentsQuery = useQuery({
    queryKey: ['equipments', { page, limit, searchTerm }],
    queryFn: async () => {
      if (searchTerm.trim()) {
        return EquipmentService.searchEquipments(api, searchTerm.trim(), { page, limit });
      }
      return EquipmentService.getAllEquipments(api, { page, limit });
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

  // Query helper for a single equipment
  const fetchEquipmentById = async (id: string): Promise<Equipment> => {
    return EquipmentService.getEquipmentById(api, id);
  };

  // Mutation: Create equipment in entry movement
  const createEntryMutation = useMutation({
    mutationFn: async (input: CreateEntryWithEquipmentInput) => {
      return EquipmentService.createEntryMovementWithEquipment(api, input, permissions);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] });
      queryClient.invalidateQueries({ queryKey: ['shelves'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      toast.success('Mouvement d’entrée enregistré !', {
        description: `L'équipement "${data.equipment.equipmentName}" a été ajouté au stock avec succès.`,
      });
    },
    onError: (error: any) => {
      const msg = error?.message || 'Impossible d’enregistrer le mouvement.';
      toast.error('Erreur lors de la création', {
        description: msg,
      });
    },
  });

  // Mutation: Update equipment
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
      return EquipmentService.updateEquipment(api, id, input, permissions);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] });
      queryClient.invalidateQueries({ queryKey: ['shelves'] });
      toast.success('Équipement mis à jour', {
        description: `L'équipement "${data.equipmentName}" a été actualisé.`,
      });
    },
    onError: (error: any) => {
      toast.error('Erreur de mise à jour', {
        description: error?.message || 'Impossible de modifier cet équipement.',
      });
    },
  });

  // Mutation: Delete equipment
  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return EquipmentService.deleteEquipment(api, id, permissions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] });
      queryClient.invalidateQueries({ queryKey: ['shelves'] });
      toast.success('Équipement supprimé', {
        description: 'L’équipement et ses éléments associés ont été supprimés.',
      });
    },
    onError: (error: any) => {
      toast.error('Erreur de suppression', {
        description: error?.message || 'Impossible de supprimer cet équipement.',
      });
    },
  });

  // Mutation: Update serial number
  const updateSerialNumberMutation = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: {
        serialNumberCode?: string;
        serialNumberStatus?: string;
        shelfId?: string | null;
      };
    }) => {
      return EquipmentService.updateSerialNumber(api, id, input, permissions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] });
      toast.success('Numéro de série mis à jour');
    },
    onError: (error: any) => {
      toast.error('Erreur de mise à jour', {
        description: error?.message || 'Impossible de modifier le numéro de série.',
      });
    },
  });

  // Mutation: Delete serial number
  const deleteSerialNumberMutation = useMutation({
    mutationFn: async (id: string) => {
      return EquipmentService.deleteSerialNumber(api, id, permissions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] });
      toast.success('Numéro de série supprimé', {
        description: 'Le numéro de série a été retiré et la quantité ajustée.',
      });
    },
    onError: (error: any) => {
      toast.error('Erreur de suppression', {
        description: error?.message || 'Impossible de supprimer le numéro de série.',
      });
    },
  });

  const handleSearchChange = (query: string) => {
    setSearchTerm(query);
    setPage(1);
  };

  return {
    equipments: equipmentsQuery.data?.equipments ?? [],
    totalEquipments: equipmentsQuery.data?.totalEquipments ?? 0,
    totalPages: equipmentsQuery.data?.totalPages ?? 1,
    currentPage: page,
    limit,
    searchTerm,
    setSearchTerm: handleSearchChange,
    setPage,
    setLimit,
    isLoading: equipmentsQuery.isLoading,
    isFetching: equipmentsQuery.isFetching,
    isError: equipmentsQuery.isError,
    error: equipmentsQuery.error,
    refetch: equipmentsQuery.refetch,
    getEquipmentById: fetchEquipmentById,
    canCreateMovement,
    canReadEquipment,
    createEntryMovement: createEntryMutation.mutateAsync,
    isCreating: createEntryMutation.isPending,
    updateEquipment: updateEquipmentMutation.mutateAsync,
    isUpdating: updateEquipmentMutation.isPending,
    deleteEquipment: deleteEquipmentMutation.mutateAsync,
    isDeleting: deleteEquipmentMutation.isPending,
    updateSerialNumber: updateSerialNumberMutation.mutateAsync,
    isUpdatingSerialNumber: updateSerialNumberMutation.isPending,
    deleteSerialNumber: deleteSerialNumberMutation.mutateAsync,
    isDeletingSerialNumber: deleteSerialNumberMutation.isPending,
  };
}
