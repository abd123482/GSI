'use client';

import { useState } from 'react';
import { Bell, CheckCheck, ExternalLink, Inbox, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useNotifications,
  useUnreadNotificationsCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  AppNotification,
} from '@/hooks/use-notifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { data: notifications, isLoading } = useNotifications();
  const { data: unreadData } = useUnreadNotificationsCount();
  const { mutateAsync: markRead } = useMarkNotificationRead();
  const { mutateAsync: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();

  const unreadCount = unreadData?.count ?? 0;

  const handleNotificationClick = async (notif: AppNotification) => {
    try {
      if (!notif.readAt) {
        await markRead(notif.notificationId);
      }
    } catch {
      // Non-blocking
    }

    setOpen(false);

    const isTask =
      notif.eventType === 'INVENTORY_TASK_AVAILABLE' ||
      notif.eventType === 'INVENTORY_COUNT_REQUIRED' ||
      notif.eventType === 'INVENTORY_THIRD_COUNT_REQUIRED' ||
      notif.eventType === 'TASK';

    const isAdjudication =
      notif.eventType === 'INVENTORY_ADJUDICATION_ASSIGNED' ||
      notif.eventType === 'INVENTORY_ADJUDICATION_REQUIRED';

    if (notif.payload?.taskId) {
      router.push(`/inventory/tasks/${notif.payload.taskId}`);
    } else if (isAdjudication && notif.payload?.unitId) {
      router.push(`/inventory/adjudicate/${notif.payload.unitId}`);
    } else if (isTask) {
      router.push('/inventory/tasks');
    } else if (notif.payload?.unitId) {
      router.push(`/inventory/adjudicate/${notif.payload.unitId}`);
    } else if (notif.payload?.inventoryId) {
      router.push(`/inventory/${notif.payload.inventoryId}`);
    } else {
      router.push('/inventory/tasks');
    }
  };


  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Notifications"
        className="relative p-2 rounded-[3px] text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#383330] border border-transparent hover:border-[#3f3a36] transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-[#10b981]"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-[#10b981] text-[#1f1b18] text-[10px] font-bold rounded-full flex items-center justify-center font-mono shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 bg-[#26221f] border border-[#3f3a36] rounded-[4px] p-0 shadow-xl text-[#f7f5f0] z-50 overflow-hidden"
      >
        {/* Header */}
        <div className="p-3 border-b border-[#3f3a36] flex items-center justify-between bg-[#2f2a26]">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-[#10b981]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#f7f5f0]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
                {unreadCount} non lue(s)
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              disabled={isMarkingAll}
              onClick={async (e) => {
                e.preventDefault();
                await markAllRead();
              }}
              className="text-[11px] text-[#aea69c] hover:text-[#10b981] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <CheckCheck className="w-3 h-3" />
              <span>Tout marquer lu</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-[#383330]">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-[#aea69c] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Chargement des alertes...</span>
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="p-8 text-center space-y-1.5">
              <Inbox className="w-6 h-6 text-[#5c544d] mx-auto" />
              <p className="text-xs text-[#aea69c]">Aucune notification pour le moment.</p>
              <p className="text-[11px] text-[#6a625b]">
                Vous recevrez une alerte dès qu'un autre compteur termine son unité de comptage.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = !n.readAt;
              const hasLink = !!(n.payload?.taskId || n.payload?.inventoryId);

              return (
                <div
                  key={n.notificationId}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 transition-colors cursor-pointer flex items-start gap-2.5 ${
                    isUnread ? 'bg-[#10b981]/10 hover:bg-[#10b981]/15' : 'hover:bg-[#2f2a26]'
                  }`}
                >
                  <div className="mt-1 shrink-0">
                    <span
                      className={`block w-2 h-2 rounded-full ${
                        isUnread ? 'bg-[#10b981]' : 'bg-[#5c544d]'
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-[#f7f5f0] truncate block">
                        {n.payload?.title || 'Notification d’inventaire'}
                      </span>
                      <span className="text-[10px] font-mono text-[#8a8075] shrink-0">
                        {new Date(n.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#aea69c] leading-relaxed">
                      {n.payload?.message}
                    </p>

                    {hasLink && (
                      <div className="pt-0.5 flex items-center gap-1 text-[10px] font-mono text-[#10b981]">
                        <span>Cliquer pour ouvrir la tâche</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
