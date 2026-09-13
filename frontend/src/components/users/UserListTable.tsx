'use client';

import { useState } from 'react';
import {
  AdminUser,
  Role,
  UserStatus,
} from '@/types/user-role';
import {
  UserCheck,
  UserX,
  Clock,
  Shield,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface UserListTableProps {
  users: AdminUser[];
  roles: Role[];
  isLoading: boolean;
  totalUsers: number;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onAssignRole: (userId: string, roleId: string | null) => Promise<void>;
  onUpdateStatus: (userId: string, status: UserStatus) => Promise<void>;
  isAssigningRole?: boolean;
  canManageUsers?: boolean;
  canManageRoles?: boolean;
  currentUserId?: string | null;
}

export function UserListTable({
  users,
  roles,
  isLoading,
  totalUsers,
  totalPages,
  currentPage,
  onPageChange,
  onAssignRole,
  onUpdateStatus,
  canManageUsers = true,
  canManageRoles = true,
  currentUserId,
}: UserListTableProps) {
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRoleId: string) => {
    setUpdatingUserId(userId);
    try {
      await onAssignRole(userId, newRoleId === 'none' ? null : newRoleId);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: UserStatus) => {
    setUpdatingUserId(userId);
    try {
      const nextStatus: UserStatus =
        currentStatus === 'ACTIVE'
          ? 'DISABLED'
          : 'ACTIVE';
      await onUpdateStatus(userId, nextStatus);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const renderStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[#162b22] text-[#10b981] text-[11px] font-mono border border-[#1e3d30]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
            Actif
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[#2d2212] text-[#f59e0b] text-[11px] font-mono border border-[#453316]">
            <Clock className="w-3 h-3 text-[#f59e0b]" />
            En attente
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[#2d1616] text-[#ef4444] text-[11px] font-mono border border-[#451e1e]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
            Désactivé
          </span>
        );
      default:
        return <span className="text-xs font-mono text-[#aea69c]">{status}</span>;
    }
  };

  return (
    <div className="bg-[#383330] rounded-[4px] border border-[#3f3a36] overflow-hidden flex flex-col shadow-xs">
      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#2b2622] border-b border-[#3f3a36] text-[11px] font-mono uppercase tracking-wider text-[#aea69c]">
              <th className="px-5 py-3">Utilisateur</th>
              <th className="px-5 py-3">Statut</th>
              <th className="px-5 py-3">Rôle Assigné</th>
              <th className="px-5 py-3">Permissions Actives</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3f3a36] text-xs">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-[3px] bg-[#2b2622]" />
                      <div className="space-y-1.5">
                        <div className="w-32 h-3.5 bg-[#2b2622] rounded" />
                        <div className="w-48 h-3 bg-[#2b2622] rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="w-16 h-5 bg-[#2b2622] rounded" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="w-28 h-7 bg-[#2b2622] rounded" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="w-20 h-4 bg-[#2b2622] rounded" />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="w-6 h-6 bg-[#2b2622] rounded inline-block" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-[#aea69c]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-9 h-9 rounded-[3px] bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#aea69c]">
                      <Shield className="w-4 h-4" />
                    </div>
                    <p className="font-medium text-sm text-[#f7f5f0]">
                      Aucun utilisateur trouvé
                    </p>
                    <p className="text-xs text-[#aea69c]">
                      Les utilisateurs connectés via Clerk apparaîtront ici.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isCurrentUpdating = updatingUserId === user.userId;
                const permissionsCount = user.role?.permissions?.length ?? 0;
                const initial = (user.userName?.[0] || user.userEmail[0] || 'U').toUpperCase();
                const isSelf = !!currentUserId && user.userId === currentUserId;

                return (
                  <tr
                    key={user.userId}
                    className="hover:bg-[#2b2622]/40 transition-colors"
                  >
                    {/* User Profile */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-[3px] bg-[#2b2622] border border-[#3f3a36] text-[#f7f5f0] font-mono text-xs flex items-center justify-center shrink-0">
                          {initial}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-[#f7f5f0] truncate">
                              {user.userName || 'Sans nom'}
                            </span>
                            {isSelf && (
                              <span className="px-1.5 py-0.2 rounded-[2px] text-[10px] font-mono font-medium bg-[#2b2622] text-[#dad2c1] border border-[#3f3a36]">
                                Vous
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-[#aea69c] truncate">
                            {user.userEmail}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      {renderStatusBadge(user.userStatus)}
                    </td>

                    {/* Assigned Role Dropdown */}
                    <td className="px-5 py-3">
                      {canManageRoles ? (
                        <div className="relative inline-block w-44">
                          <select
                            value={user.roleId ?? 'none'}
                            disabled={isCurrentUpdating}
                            onChange={(e) =>
                              handleRoleChange(user.userId, e.target.value)
                            }
                            className={`w-full text-xs font-mono py-1 px-2 rounded-[3px] border transition-colors appearance-none cursor-pointer focus:outline-none focus:border-[#f7f5f0] ${
                              user.role
                                ? 'bg-[#2b2622] border-[#3f3a36] text-[#f7f5f0]'
                                : 'bg-[#2b2622] border-[#3f3a36] text-[#aea69c]'
                            }`}
                          >
                            <option value="none">-- Aucun rôle --</option>
                            {roles.map((r) => (
                              <option key={r.roleId} value={r.roleId}>
                                {r.roleName}
                              </option>
                            ))}
                          </select>
                          {isCurrentUpdating && (
                            <div className="absolute right-2 top-2">
                              <Loader2 className="w-3.5 h-3.5 text-[#f7f5f0] animate-spin" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <span
                          className={`inline-block text-xs font-mono px-2 py-0.5 rounded-[2px] border ${
                            user.role
                              ? 'bg-[#2b2622] border-[#3f3a36] text-[#f7f5f0]'
                              : 'text-[#aea69c] border-transparent'
                          }`}
                        >
                          {user.role ? user.role.roleName : 'Aucun'}
                        </span>
                      )}
                    </td>

                    {/* Permissions summary */}
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono text-[#c9c0ad]">
                        {permissionsCount > 0 ? (
                          <span className="text-[#f7f5f0]">
                            {permissionsCount} permission
                            {permissionsCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-[#aea69c]">Aucune</span>
                        )}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right">
                      {canManageUsers && (
                        <div className="inline-flex items-center gap-1.5">
                          {isSelf ? (
                            <span className="text-[11px] font-mono text-[#aea69c] px-1">
                              Session active
                            </span>
                          ) : user.userStatus === 'PENDING' ? (
                            <button
                              type="button"
                              onClick={() => handleStatusToggle(user.userId, user.userStatus)}
                              disabled={isCurrentUpdating}
                              title="Activer ce compte"
                              className="px-2.5 py-1 text-xs font-medium text-[#2b2622] bg-[#f7f5f0] hover:bg-[#dad2c1] rounded-[3px] transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>Activer</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStatusToggle(user.userId, user.userStatus)}
                              disabled={isCurrentUpdating}
                              title={
                                user.userStatus === 'ACTIVE'
                                  ? 'Désactiver le compte'
                                  : 'Réactiver le compte'
                              }
                              className={`p-1.5 rounded-[3px] transition-colors cursor-pointer ${
                                user.userStatus === 'ACTIVE'
                                  ? 'text-[#aea69c] hover:text-[#ef4444] hover:bg-[#2b2622]'
                                  : 'text-[#10b981] hover:bg-[#2b2622]'
                              }`}
                            >
                              {user.userStatus === 'ACTIVE' ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-5 py-2.5 border-t border-[#3f3a36] bg-[#2b2622] flex items-center justify-between text-xs text-[#aea69c] font-mono">
        <span>
          Total : <strong className="text-[#f7f5f0]">{totalUsers}</strong>{' '}
          compte{totalUsers > 1 ? 's' : ''}
        </span>

        <div className="flex items-center gap-2">
          <span>
            Page {currentPage} / {totalPages || 1}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
