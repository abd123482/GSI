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

import { useApi } from './use-api';
import { getErrorMessage } from '@/lib/error-message';

import type {
  CreateInventoryInput,
  Inventory,
  InventoryProgress,
  InventoryReport,
  InventoryTask,
  PaginatedInventoriesResponse,
  SubmitInventoryTaskInput,
} from '@/types/inventory';

export function useInventories(
  page = 1,
  limit = 20,
) {
  const api = useApi();

  return useQuery<PaginatedInventoriesResponse>({
    queryKey: ['inventories', page, limit],
    queryFn: async () => {
      const response =
        await api.get<PaginatedInventoriesResponse>(
          '/inventory',
          {
            params: { page, limit },
          },
        );

      return response.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useInventoryById(
  inventoryId?: string | null,
) {
  const api = useApi();

  return useQuery<Inventory>({
    queryKey: ['inventories', 'detail', inventoryId],
    queryFn: async () => {
      const response =
        await api.get<Inventory>(
          `/inventory/${inventoryId}`,
        );

      return response.data;
    },
    enabled: Boolean(inventoryId),
  });
}

export function useMyTasks() {
  const api = useApi();

  return useQuery<InventoryTask[]>({
    queryKey: ['inventory', 'my-tasks'],
    queryFn: async () => {
      const response =
        await api.get<InventoryTask[]>(
          '/inventory/my-tasks',
        );

      return response.data;
    },
    refetchInterval: 5000,
  });
}

export function useInventoryTask(
  taskId?: string | null,
) {
  const api = useApi();

  return useQuery<InventoryTask>({
    queryKey: ['inventory', 'task', taskId],
    queryFn: async () => {
      const response =
        await api.get<InventoryTask>(
          `/inventory/tasks/${taskId}`,
        );

      return response.data;
    },
    enabled: Boolean(taskId),
  });
}

export function useCreateInventory() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: CreateInventoryInput,
    ) => {
      const response =
        await api.post<Inventory>(
          '/inventory',
          data,
        );

      return response.data;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['inventories'],
      });

      toast.success('Inventaire créé');
    },

    onError: (error: unknown) => {
      toast.error('Création impossible', {
        description: getErrorMessage(
          error,
          'Impossible de créer l’inventaire.',
        ),
      });
    },
  });
}

export function useLaunchInventory() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      inventoryId: string,
    ) => {
      const response =
        await api.post(
          `/inventory/${inventoryId}/launch`,
        );

      return response.data;
    },

    onSuccess: async (_, inventoryId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['inventories'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventories', 'detail', inventoryId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventory', 'my-tasks'],
        }),
      ]);

      toast.success('Inventaire lancé');
    },

    onError: (error: unknown) => {
      toast.error('Lancement impossible', {
        description: getErrorMessage(
          error,
          'Le périmètre est peut-être occupé par une autre opération.',
        ),
      });
    },
  });
}

export function useSaveInventoryTaskDraft() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      data,
    }: {
      taskId: string;
      data: SubmitInventoryTaskInput;
    }) => {
      const response =
        await api.patch(
          `/inventory/tasks/${taskId}/draft`,
          {
            ...data,
            isDraft: true,
          },
        );

      return response.data;
    },

    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['inventory', 'task', variables.taskId],
      });

      toast.success('Brouillon enregistré');
    },
  });
}

export function useSubmitInventoryTask() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      data,
    }: {
      taskId: string;
      data: SubmitInventoryTaskInput;
    }) => {
      const response =
        await api.post(
          `/inventory/tasks/${taskId}/submit`,
          {
            ...data,
            isDraft: false,
          },
        );

      return response.data;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['inventory', 'my-tasks'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventories'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventory-progress'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventory-report'],
        }),
      ]);

      toast.success('Comptage soumis');
    },

    onError: (error: unknown) => {
      toast.error('Soumission impossible', {
        description: getErrorMessage(
          error,
          'Impossible de soumettre ce comptage.',
        ),
      });
    },
  });
}

export function useInventoryProgress(
  inventoryId?: string | null,
) {
  const api = useApi();

  return useQuery<InventoryProgress>({
    queryKey: ['inventory-progress', inventoryId],
    queryFn: async () => {
      const response =
        await api.get<InventoryProgress>(
          `/inventory/${inventoryId}/progress`,
        );

      return response.data;
    },
    enabled: Boolean(inventoryId),
    refetchInterval: (query) =>
      query.state.data?.status === 'IN_PROGRESS'
        ? 3000
        : false,
  });
}

export function useInventoryReport(
  inventoryId?: string | null,
) {
  const api = useApi();

  return useQuery<InventoryReport>({
    queryKey: ['inventory-report', inventoryId],
    queryFn: async () => {
      const response =
        await api.get<InventoryReport>(
          `/inventory/${inventoryId}/report`,
        );

      return response.data;
    },
    enabled: Boolean(inventoryId),
    refetchInterval: (query) =>
      query.state.data?.inventory?.status === 'IN_PROGRESS'
        ? 3000
        : false,
  });
}

export function useFinalizeInventory() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      inventoryId: string,
    ) => {
      const response =
        await api.post(
          `/inventory/${inventoryId}/finalize`,
        );

      return response.data;
    },

    onSuccess: async (_, inventoryId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['inventories'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventory-progress', inventoryId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventory-report', inventoryId],
        }),
      ]);

      toast.success('Inventaire finalisé');
    },

    onError: (error: unknown) => {
      toast.error('Finalisation impossible', {
        description: getErrorMessage(
          error,
          'Toutes les unités doivent être réconciliées avant la finalisation.',
        ),
      });
    },
  });
}

export function useDeleteInventory() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      inventoryId: string,
    ) => {
      const response =
        await api.delete(
          `/inventory/${inventoryId}`,
        );

      return response.data;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['inventories'],
      });

      toast.success('Inventaire supprimé');
    },

    onError: (error: unknown) => {
      toast.error('Suppression impossible', {
        description: getErrorMessage(
          error,
          'Seul un inventaire DRAFT peut être supprimé.',
        ),
      });
    },
  });
}
