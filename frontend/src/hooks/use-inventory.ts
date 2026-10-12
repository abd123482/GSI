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
import { useAuthQueryContext } from './use-auth-query-context';
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
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<PaginatedInventoriesResponse>({
    queryKey: ['inventories', page, limit, userId],
    enabled: Boolean(authReady && userId),
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
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<Inventory>({
    queryKey: ['inventories', 'detail', inventoryId, userId],
    
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
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<InventoryTask[]>({
    queryKey: ['inventory', 'my-tasks', userId],
    enabled: Boolean(authReady && userId),
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
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<InventoryTask>({
    queryKey: ['inventory', 'task', taskId, userId],
    
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
  const { userId, authReady } = useAuthQueryContext();
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
        queryKey: ['inventories', userId],
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
  const { userId, authReady } = useAuthQueryContext();
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
          queryKey: ['inventories', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventories', 'detail', inventoryId, userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventory', 'my-tasks', userId],
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
  const { userId, authReady } = useAuthQueryContext();
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
        queryKey: ['inventory', 'task', variables.taskId, userId],
      });

      toast.success('Brouillon enregistré');
    },
  });
}

export function useSubmitInventoryTask() {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
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
          queryKey: ['inventory', 'my-tasks', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventories', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventory-progress', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventory-report', userId],
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
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<InventoryProgress>({
    queryKey: ['inventory-progress', inventoryId, userId],
    enabled: authReady && Boolean(inventoryId),
    queryFn: async () => {
      const response =
        await api.get<InventoryProgress>(
          `/inventory/${inventoryId}/progress`,
        );

      return response.data;
    },
    
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
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<InventoryReport>({
    queryKey: ['inventory-report', inventoryId, userId],
    enabled: authReady && Boolean(inventoryId),
    queryFn: async () => {
      const response =
        await api.get<InventoryReport>(
          `/inventory/${inventoryId}/report`,
        );

      return response.data;
    },
    
    refetchInterval: (query) =>
      query.state.data?.inventory?.status === 'IN_PROGRESS'
        ? 3000
        : false,
  });
}

export function useFinalizeInventory() {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
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
          queryKey: ['inventories', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventory-progress', inventoryId, userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventory-report', inventoryId, userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['equipments', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['equipment-allocations'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['equipment-all-serials'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['serial-numbers', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['movements', userId],
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
  const { userId, authReady } = useAuthQueryContext();
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
        queryKey: ['inventories', userId],
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
