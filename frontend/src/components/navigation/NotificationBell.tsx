'use client';

import {
  useState,
} from 'react';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Inbox,
  Loader2,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';

import {
  type AppNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationsCount,
} from '@/hooks/use-notifications';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function notificationDestination(
  notification: AppNotification,
) {
  const taskId =
    notification.payload?.taskId;

  const inventoryId =
    notification.payload?.inventoryId;

  if (taskId) {
    return `/inventory/tasks/${taskId}`;
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

  if (inventoryId) {
    return `/inventory/${inventoryId}/report`;
  }

  return '/inventory/tasks';
}

export function NotificationBell() {
  const router =
    useRouter();

  const [
    open,
    setOpen,
  ] = useState(false);

  const {
    data: notifications,
    isLoading,
  } = useNotifications();

  const {
    data: unreadData,
  } =
    useUnreadNotificationsCount();

  const {
    mutateAsync:
      markRead,
  } =
    useMarkNotificationRead();

  const {
    mutateAsync:
      markAllRead,
    isPending:
      isMarkingAll,
  } =
    useMarkAllNotificationsRead();

  const unreadCount =
    unreadData?.count ??
    0;

  async function handleNotificationClick(
    notification: AppNotification,
  ) {
    try {
      if (!notification.readAt) {
        await markRead(
          notification.notificationId,
        );
      }
    } catch {
      // Navigation must not be blocked by a mark-as-read failure.
    }

    setOpen(false);

    router.push(
      notificationDestination(
        notification,
      ),
    );
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
    >
      <DropdownMenuTrigger
        aria-label="Notifications"
        className="relative rounded border border-transparent p-2 text-[#a1a1aa] outline-none transition-colors hover:border-[#3f3f46] hover:bg-[#27272a] hover:text-[#fafafa]"
      >
        <Bell className="h-4 w-4" />

        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#10b981] px-1 font-mono text-[10px] font-bold text-[#1f1b18]">
            {unreadCount > 9
              ? '9+'
              : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="z-50 w-80 overflow-hidden rounded border border-[#3f3f46] bg-[#26221f] p-0 text-[#fafafa] shadow-xl sm:w-96"
      >
        <div className="flex items-center justify-between border-b border-[#3f3f46] bg-[#27272a] p-3">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-[#10b981]" />

            <span className="text-xs font-semibold uppercase tracking-wider">
              Notifications
            </span>

            {unreadCount > 0 && (
              <span className="rounded border border-[#10b981]/40 bg-[#10b981]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#10b981]">
                {unreadCount} non lue(s)
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              disabled={isMarkingAll}
              onClick={async (event) => {
                event.preventDefault();
                await markAllRead();
              }}
              className="flex items-center gap-1 text-[11px] text-[#a1a1aa] transition-colors hover:text-[#10b981] disabled:opacity-40"
            >
              <CheckCheck className="h-3 w-3" />
              Tout marquer lu
            </button>
          )}
        </div>

        <div className="max-h-80 divide-y divide-[#27272a] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-xs text-[#a1a1aa]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          ) : !notifications?.length ? (
            <div className="space-y-1.5 p-8 text-center">
              <Inbox className="mx-auto h-6 w-6 text-[#5c544d]" />
              <p className="text-xs text-[#a1a1aa]">
                Aucune notification.
              </p>
            </div>
          ) : (
            notifications.map(
              (notification) => {
                const unread =
                  !notification.readAt;

                return (
                  <button
                    type="button"
                    key={notification.notificationId}
                    onClick={() => {
                      void handleNotificationClick(
                        notification,
                      );
                    }}
                    className={`flex w-full items-start gap-2.5 p-3 text-left transition-colors ${
                      unread
                        ? 'bg-[#10b981]/10 hover:bg-[#10b981]/15'
                        : 'hover:bg-[#27272a]'
                    }`}
                  >
                    <span
                      className={`mt-1 block h-2 w-2 shrink-0 rounded-full ${
                        unread
                          ? 'bg-[#10b981]'
                          : 'bg-[#5c544d]'
                      }`}
                    />

                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="block truncate text-xs font-semibold">
                          {notification.payload?.title ??
                            'Notification d’inventaire'}
                        </span>

                        <span className="shrink-0 font-mono text-[10px] text-[#8a8075]">
                          {new Date(
                            notification.createdAt,
                          ).toLocaleTimeString(
                            [],
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </span>
                      </span>

                      <span className="block text-[11px] leading-relaxed text-[#a1a1aa]">
                        {notification.payload?.message ??
                          'Une mise à jour d’inventaire est disponible.'}
                      </span>

                      <span className="flex items-center gap-1 pt-0.5 font-mono text-[10px] text-[#10b981]">
                        Ouvrir
                        <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    </span>
                  </button>
                );
              },
            )
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
