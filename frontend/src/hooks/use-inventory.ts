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
  InventoryRoundSummary,
  InventoryTask,
  PaginatedInventoriesResponse,
  SubmitInventoryTaskInput,
  UpdateRosterInput,
} from '@/types/inventory';

// Authoritative auth-scoped query key factory
export const inventoryKeys = {
  all: (userId?: string | null) => ['inventory', userId ?? 'anonymous'] as const,
  lists: (userId?: string | null) => [...inventoryKeys.all(userId), 'list'] as const,
  list: (userId?: string | null, filters?: { page?: number; limit?: number }) =>
    [...inventoryKeys.lists(userId), filters] as const,
  details: (userId?: string | null) => [...inventoryKeys.all(userId), 'detail'] as const,
  detail: (userId?: string | null, id?: string | null) =>
    [...inventoryKeys.details(userId), id] as const,
  progresses: (userId?: string | null) => [...inventoryKeys.all(userId), 'progress'] as const,
  progress: (userId?: string | null, id?: string | null) =>
    [...inventoryKeys.progresses(userId), id] as const,
  reports: (userId?: string | null) => [...inventoryKeys.all(userId), 'report'] as const,
  report: (userId?: string | null, id?: string | null) =>
    [...inventoryKeys.reports(userId), id] as const,
  rounds: (userId?: string | null, id?: string | null) =>
    [...inventoryKeys.all(userId), 'rounds', id] as const,
  tasks: (userId?: string | null) => [...inventoryKeys.all(userId), 'tasks'] as const,
  task: (userId?: string | null, taskId?: string | null) =>
    [...inventoryKeys.all(userId), 'task', taskId] as const,
};

export function useInventories(
  page = 1,
  limit = 20,
) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<PaginatedInventoriesResponse>({
    queryKey: inventoryKeys.list(userId, { page, limit }),
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
    queryKey: inventoryKeys.detail(userId, inventoryId),
    queryFn: async () => {
      const response =
        await api.get<Inventory>(
          `/inventory/${inventoryId}`,
        );

      return response.data;
    },
    enabled: Boolean(authReady && inventoryId),
  });
}

export function useMyTasks() {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<InventoryTask[]>({
    queryKey: inventoryKeys.tasks(userId),
    enabled: Boolean(authReady && userId),
    queryFn: async () => {
      const response =
        await api.get<InventoryTask[]>(
          '/inventory/my-tasks',
        );

      return response.data;
    },
    refetchInterval: (query) => {
      // Pause polling if document is hidden or inactive
      if (typeof document !== 'undefined' && document.hidden) return false;
      return 5000;
    },
  });
}

export function useInventoryTask(
  taskId?: string | null,
) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<InventoryTask>({
    queryKey: inventoryKeys.task(userId, taskId),
    queryFn: async () => {
      const response =
        await api.get<InventoryTask>(
          `/inventory/tasks/${taskId}`,
        );

      return response.data;
    },
    enabled: Boolean(authReady && taskId),
  });
}

export function useInventoryProgress(
  inventoryId?: string | null,
) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<InventoryProgress>({
    queryKey: inventoryKeys.progress(userId, inventoryId),
    enabled: Boolean(authReady && inventoryId),
    queryFn: async () => {
      const response =
        await api.get<InventoryProgress>(
          `/inventory/${inventoryId}/progress`,
        );

      return response.data;
    },
    refetchInterval: (query) => {
      if (typeof document !== 'undefined' && document.hidden) return false;
      const status = query.state.data?.status;
      return status === 'IN_PROGRESS' ? 3000 : false;
    },
  });
}

export function useInventoryReport(
  inventoryId?: string | null,
) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<InventoryReport>({
    queryKey: inventoryKeys.report(userId, inventoryId),
    enabled: Boolean(authReady && inventoryId),
    queryFn: async () => {
      const response =
        await api.get<InventoryReport>(
          `/inventory/${inventoryId}/report`,
        );

      return response.data;
    },
    refetchInterval: (query) => {
      if (typeof document !== 'undefined' && document.hidden) return false;
      const status = query.state.data?.inventory?.status;
      return status === 'IN_PROGRESS' ? 3000 : false;
    },
  });
}

export function useInventoryRounds(
  inventoryId?: string | null,
) {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<InventoryRoundSummary[]>({
    queryKey: inventoryKeys.rounds(userId, inventoryId),
    enabled: Boolean(authReady && inventoryId),
    queryFn: async () => {
      const response =
        await api.get<InventoryRoundSummary[]>(
          `/inventory/${inventoryId}/rounds`,
        );

      return response.data;
    },
  });
}

export function useCreateInventory() {
  const api = useApi();
  const { userId } = useAuthQueryContext();
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
        queryKey: inventoryKeys.lists(userId),
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

export function useUpdateDraftRoster() {
  const api = useApi();
  const { userId } = useAuthQueryContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inventoryId,
      data,
    }: {
      inventoryId: string;
      data: UpdateRosterInput;
    }) => {
      const response = await api.put(
        `/inventory/${inventoryId}/roster`,
        data,
      );
      return response.data;
    },

    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.detail(userId, variables.inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.rounds(userId, variables.inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.lists(userId),
        }),
      ]);

      toast.success('Équipe mise à jour');
    },

    onError: (error: unknown) => {
      toast.error('Modification impossible', {
        description: getErrorMessage(
          error,
          'Impossible de modifier la liste des contrôleurs.',
        ),
      });
    },
  });
}

export function useLaunchInventory() {
  const api = useApi();
  const { userId } = useAuthQueryContext();
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
          queryKey: inventoryKeys.lists(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.detail(userId, inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.progress(userId, inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.report(userId, inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.rounds(userId, inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.tasks(userId),
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
  const { userId } = useAuthQueryContext();
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
        queryKey: inventoryKeys.task(userId, variables.taskId),
      });

      toast.success('Brouillon enregistré');
    },
  });
}

export function useSubmitInventoryTask() {
  const api = useApi();
  const { userId } = useAuthQueryContext();
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

    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.tasks(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.task(userId, variables.taskId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.progresses(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.reports(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.lists(userId),
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

export function useFinalizeInventory() {
  const api = useApi();
  const { userId } = useAuthQueryContext();
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
          queryKey: inventoryKeys.lists(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.detail(userId, inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.progress(userId, inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.report(userId, inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.rounds(userId, inventoryId),
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

      toast.success('Inventaire finalisé et ajustements appliqués');
    },

    onError: (error: unknown) => {
      toast.error('Finalisation impossible', {
        description: getErrorMessage(
          error,
          'Toutes les unités doivent converger et les anomalies bloquantes doivent être résolues.',
        ),
      });
    },
  });
}

export function useCancelInventory() {
  const api = useApi();
  const { userId } = useAuthQueryContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inventoryId,
      reason,
    }: {
      inventoryId: string;
      reason?: string;
    }) => {
      const response = await api.post(
        `/inventory/${inventoryId}/cancel`,
        { reason },
      );
      return response.data;
    },

    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.lists(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.detail(userId, variables.inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.progress(userId, variables.inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.rounds(userId, variables.inventoryId),
        }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.tasks(userId),
        }),
      ]);

      toast.success('Inventaire annulé');
    },

    onError: (error: unknown) => {
      toast.error('Annulation impossible', {
        description: getErrorMessage(
          error,
          'Impossible d’annuler cet inventaire.',
        ),
      });
    },
  });
}

export function useDeleteInventory() {
  const api = useApi();
  const { userId } = useAuthQueryContext();
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
        queryKey: inventoryKeys.lists(userId),
      });

      toast.success('Inventaire supprimé');
    },

    onError: (error: unknown) => {
      toast.error('Suppression impossible', {
        description: getErrorMessage(
          error,
          'Seul un inventaire DRAFT sans mouvements enregistrés peut être supprimé.',
        ),
      });
    },
  });
}
