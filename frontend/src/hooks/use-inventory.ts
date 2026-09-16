import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api';

// Types can be imported from our definitions
// For simplicity, we assume `api` throws on error and returns data.

export function useInventories() {
  return useQuery({
    queryKey: ['inventories'],
    queryFn: async () => {
      const res = await api.get('/inventory');
      return res.data;
    },
  });
}

export function useInventoryById(id: string) {
  return useQuery({
    queryKey: ['inventories', id],
    queryFn: async () => {
      const res = await api.get(`/inventory/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useInventoryTask(taskId: string) {
  return useQuery({
    queryKey: ['inventory-tasks', taskId],
    queryFn: async () => {
      const res = await api.get(`/inventory/tasks/${taskId}`);
      return res.data;
    },
    enabled: !!taskId,
  });
}

export function useAdjudicationUnit(unitId: string) {
  return useQuery({
    queryKey: ['inventory-adjudicate', unitId],
    queryFn: async () => {
      const res = await api.get(`/inventory/adjudicate/${unitId}`);
      return res.data;
    },
    enabled: !!unitId,
  });
}

export function usePreviewAdjustments(inventoryId: string) {
  return useQuery({
    queryKey: ['inventory-preview', inventoryId],
    queryFn: async () => {
      const res = await api.get(`/inventory/${inventoryId}/adjustments/preview`);
      return res.data;
    },
    enabled: !!inventoryId,
  });
}

export function useCreateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/inventory', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] });
    },
  });
}

export function useLaunchInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inventoryId: string) => {
      const res = await api.post(`/inventory/${inventoryId}/launch`);
      return res.data;
    },
    onSuccess: (_, inventoryId) => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] });
      queryClient.invalidateQueries({ queryKey: ['inventories', inventoryId] });
    },
  });
}

export function useSubmitTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: any }) => {
      const res = await api.post(`/inventory/tasks/${taskId}/submit`, data);
      return res.data;
    },
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-tasks', taskId] });
      queryClient.invalidateQueries({ queryKey: ['inventories'] }); // Potentially update counts
    },
  });
}

export function useAdjudicate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inventoryId, unitId, data }: { inventoryId: string, unitId: string; data: any }) => {
      const res = await api.post(`/inventory/${inventoryId}/work-units/${unitId}/adjudicate`, data);
      return res.data;
    },
    onSuccess: (_, { inventoryId, unitId }) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-adjudicate', unitId] });
      queryClient.invalidateQueries({ queryKey: ['inventories', inventoryId] });
    },
  });
}

export function useFinalizeInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inventoryId: string) => {
      const res = await api.post(`/inventory/${inventoryId}/finalize`);
      return res.data;
    },
    onSuccess: (_, inventoryId) => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] });
      queryClient.invalidateQueries({ queryKey: ['inventories', inventoryId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-preview', inventoryId] });
    },
  });
}
