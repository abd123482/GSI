'use client';

import {
  useEffect,
  useRef,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  useRouter,
} from 'next/navigation';
import {
  toast,
} from 'sonner';

import {
  useApi,
} from './use-api';
import { useAuthQueryContext } from './use-auth-query-context';

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

function notificationDestination(
  notification: AppNotification,
) {
  if (
    notification.payload?.taskId
  ) {
    return `/inventory/tasks/${notification.payload.taskId}`;
  }

  const taskLikeEvents =
    new Set([
      'INVENTORY_TASK_AVAILABLE',
      'INVENTORY_COUNT_REQUIRED',
      'INVENTORY_THIRD_COUNT_REQUIRED',
      'INVENTORY_TASK_REMINDER',
      'TASK',
      'INVENTORY_ADJUDICATION_ASSIGNED',
      'INVENTORY_ADJUDICATION_REQUIRED',
    ]);

  if (
    taskLikeEvents.has(
      notification.eventType,
    )
  ) {
    return '/inventory/tasks';
  }

  if (
    notification.payload?.inventoryId
  ) {
    return `/inventory/${notification.payload.inventoryId}/report`;
  }

  return '/inventory/tasks';
}

export function useNotifications() {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
  const router = useRouter();

  const knownIdsRef =
    useRef<Set<string>>(
      new Set(),
    );

  const isInitialLoadRef =
    useRef(true);

  const query =
    useQuery<AppNotification[]>({
      queryKey: [
        'notifications', userId],

      enabled: authReady && authReady,
    queryFn: async () => {
        const response =
          await api.get<AppNotification[]>(
            '/notifications',
          );

        return response.data;
      },

      refetchInterval:
        5_000,

      staleTime:
        4_000,
    });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    if (
      isInitialLoadRef.current
    ) {
      for (
        const notification of
        query.data
      ) {
        knownIdsRef.current.add(
          notification.notificationId,
        );
      }

      isInitialLoadRef.current =
        false;

      return;
    }

    for (
      const notification of
      query.data
    ) {
      if (
        knownIdsRef.current.has(
          notification.notificationId,
        )
      ) {
        continue;
      }

      knownIdsRef.current.add(
        notification.notificationId,
      );

      if (
        notification.readAt
      ) {
        continue;
      }

      const destination =
        notificationDestination(
          notification,
        );

      toast.info(
        notification.payload?.title ??
          'Nouvelle tâche d’inventaire',
        {
          description:
            notification.payload?.message ??
            'Une nouvelle notification vous est parvenue.',

          duration: 8_000,

          action: {
            label: 'Ouvrir',
            onClick: () =>
              router.push(
                destination,
              ),
          },
        },
      );
    }
  }, [
    query.data,
    router,
  ]);

  return query;
}

export function useUnreadNotificationsCount() {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  return useQuery<{
    count: number;
  }>({
    queryKey: [
      'notifications',
      'unread-count', userId],

    
    queryFn: async () => {
      const response =
        await api.get<{
          count: number;
        }>(
          '/notifications/unread-count',
        );

      return response.data;
    },

    refetchInterval:
      5_000,

    staleTime:
      4_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient =
    useQueryClient();

  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  return useMutation({
    mutationFn: async (
      notificationId: string,
    ) => {
      const response =
        await api.patch(
          `/notifications/${notificationId}/read`,
        );

      return response.data;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          'notifications', userId],
      });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient =
    useQueryClient();

  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();

  return useMutation({
    mutationFn:
      async () => {
        const response =
          await api.patch(
            '/notifications/mark-all-read',
          );

        return response.data;
      },

    onSuccess:
      async () => {
        await queryClient.invalidateQueries({
          queryKey: [
            'notifications', userId],
        });
      },
  });
}
