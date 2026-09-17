import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './use-api';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export interface AppNotification {
  notificationId: string;
  recipientId: string;
  eventType: string;
  payload: {
    title?: string;
    message?: string;
    taskId?: string;
    unitId?: string;
    inventoryId?: string;
    inventoryTitle?: string;
    equipmentName?: string;
    submittedBy?: string;
    createdAt?: string;
  };
  createdAt: string;
  readAt: string | null;
}

export function useNotifications() {
  const api = useApi();
  const router = useRouter();
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  const query = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data;
    },
    refetchInterval: 5000, // Poll every 5 seconds for live notification delivery
    staleTime: 4000,
  });

  // Watch for new notifications to trigger live toast
  useEffect(() => {
    if (!query.data) return;

    if (isInitialLoadRef.current) {
      // First load: just record existing IDs
      query.data.forEach((n) => knownIdsRef.current.add(n.notificationId));
      isInitialLoadRef.current = false;
      return;
    }

    // Subsequent polls: check for newly arrived unread notifications
    for (const n of query.data) {
      if (!knownIdsRef.current.has(n.notificationId)) {
        knownIdsRef.current.add(n.notificationId);

        if (!n.readAt) {
          const title = n.payload?.title || 'Nouvelle tâche d’inventaire';
          const msg = n.payload?.message || 'Une nouvelle notification vous est parvenue.';
          const taskId = n.payload?.taskId;

          toast.info(title, {
            description: msg,
            duration: 8000,
            action: taskId
              ? {
                  label: 'Ouvrir la tâche',
                  onClick: () => router.push(`/inventory/tasks/${taskId}`),
                }
              : undefined,
          });
        }
      }
    }
  }, [query.data, router]);

  return query;
}

export function useUnreadNotificationsCount() {
  const api = useApi();
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count');
      return res.data;
    },
    refetchInterval: 5000,
    staleTime: 4000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await api.patch(`/notifications/${notificationId}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation({
    mutationFn: async () => {
      const res = await api.patch('/notifications/mark-all-read');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
