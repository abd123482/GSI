'use client';

import { Role } from '@/types/user-role';
import { Shield, Users, Lock, Edit2 } from 'lucide-react';

interface RoleListCardsProps {
  roles: Role[];
  isLoading: boolean;
  onOpenCreateRole: () => void;
  onOpenEditRole?: (role: Role) => void;
  canManageRoles?: boolean;
}

export function RoleListCards({
  roles,
  isLoading,
  onOpenCreateRole,
  onOpenEditRole,
  canManageRoles = true,
}: RoleListCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="p-5 bg-[#27272a] rounded-[4px] border border-[#3f3f46] shadow-xs animate-pulse space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-24 h-4 bg-[#18181b] rounded-[2px]" />
              <div className="w-16 h-3.5 bg-[#18181b] rounded-[2px]" />
            </div>
            <div className="space-y-1.5 pt-2">
              <div className="w-full h-3 bg-[#18181b] rounded-[2px]" />
              <div className="w-4/5 h-3 bg-[#18181b] rounded-[2px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="p-12 text-center bg-[#27272a] rounded-[4px] border border-[#3f3f46] shadow-xs">
        <div className="w-10 h-10 rounded-[3px] bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#a1a1aa] mx-auto mb-3">
          <Shield className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-medium text-[#fafafa]">
          Aucun rôle configuré
        </h3>
        <p className="text-xs text-[#d4d4d8] mt-1 mb-4">
          Créez votre premier rôle pour attribuer des permissions granulaires à l&apos;équipe.
        </p>
        {canManageRoles && (
          <button
            type="button"
            onClick={onOpenCreateRole}
            className="px-4 py-2 bg-[#fafafa] hover:bg-[#f4f4f5] text-[#18181b] text-xs font-medium rounded-[3px] transition-colors cursor-pointer"
          >
            + Créer un rôle
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {roles.map((role) => {
        const userCount = role._count?.users ?? 0;
        const permissionsCount = role.permissions.length;
        const isAdmin = role.roleName.toUpperCase() === 'ADMIN';

        return (
          <div
            key={role.roleId}
            className="bg-[#27272a] rounded-[4px] border border-[#3f3f46] p-5 shadow-xs flex flex-col justify-between hover:border-[#52525b] transition-colors"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-[2px] flex items-center justify-center text-xs font-mono font-bold border ${
                      isAdmin
                        ? 'bg-[#18181b] text-[#fafafa] border-[#fafafa]'
                        : 'bg-[#18181b] text-[#d4d4d8] border-[#3f3f46]'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-medium text-[#fafafa] tracking-tight font-mono">
                    {role.roleName}
                  </h3>
                </div>

                <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#d4d4d8] bg-[#18181b] px-2 py-0.5 rounded-[2px] border border-[#3f3f46]">
                  <Users className="w-3 h-3 text-[#a1a1aa]" />
                  <span>
                    {userCount} membre{userCount > 1 ? 's' : ''}
                  </span>
                </span>
              </div>

              {/* Permissions Header */}
              <div className="flex items-center justify-between text-xs text-[#a1a1aa] mb-2 font-mono">
                <span className="uppercase text-[10px] tracking-wider text-[#a1a1aa]">
                  Permissions ({permissionsCount})
                </span>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {role.permissions.map((p) => (
                  <span
                    key={p.permissionId}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono bg-[#18181b] text-[#f4f4f5] border border-[#3f3f46]"
                  >
                    {p.permissionName}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 mt-4 border-t border-[#3f3f46] flex flex-row-reverse items-center justify-between text-xs text-[#a1a1aa] font-mono">
              
              {canManageRoles && !isAdmin && onOpenEditRole && (
                <button
                  type="button"
                  onClick={() => onOpenEditRole(role)}
                  className="p-1.5 text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] rounded-[3px] transition-colors cursor-pointer"
                  title="Modifier le rôle"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
