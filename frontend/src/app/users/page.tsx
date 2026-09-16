'use client';

import { useState } from 'react';
import { useAuth, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Search,
  RefreshCw,
} from 'lucide-react';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { usePermissions } from '@/hooks/use-permissions';
import { UserListTable } from '@/components/users/UserListTable';
import { RoleListCards } from '@/components/users/RoleListCards';
import { CreateRoleModal } from '@/components/users/CreateRoleModal';
import { EditRoleModal } from '@/components/users/EditRoleModal';
import { UserStatus, Role } from '@/types/user-role';

export default function UsersAndRolesPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { canManageUsers, canManageRoles, roleName, user: currentAuthUser, isAdmin } =
    usePermissions();

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);

  const {
    users,
    totalUsers,
    totalPages,
    currentPage,
    statusFilter,
    searchTerm,
    roles,
    availablePermissions,
    isUsersLoading,
    isUsersFetching,
    isRolesLoading,
    isCreatingRole,
    setPage,
    setStatusFilter,
    setSearchTerm,
    refetchUsers,
    refetchRoles,
    createRole,
    editRole,
    isEditingRole,
    assignRole,
    updateStatus,
  } = useAdminUsers({ initialLimit: 10 });

  // Unauthenticated screen
  if (isLoaded && !isSignedIn) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-[#383330] rounded-[4px] border border-[#3f3a36] max-w-md mx-auto space-y-4 shadow-xl">
          <div className="w-10 h-10 rounded-[3px] bg-[#2b2622] text-[#f7f5f0] border border-[#3f3a36] flex items-center justify-center mx-auto">
            <Users className="w-5 h-5" />
          </div>
          <h2 className="text-base font-medium text-[#f7f5f0]">Connexion requise</h2>
          <p className="text-xs text-[#c9c0ad]">
            Veuillez vous authentifier pour accéder au panneau de gestion des utilisateurs et des rôles.
          </p>
          <div className="pt-2">
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full py-2 px-4 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] transition-colors cursor-pointer"
              >
                Se connecter
              </button>
            </SignInButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] py-8 text-[#f7f5f0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#aea69c] mb-1 font-mono">
              <Link href="/" className="hover:text-[#f7f5f0] transition-colors">
                somepharm
              </Link>
              <span>/</span>
              <span className="text-[#dad2c1]">admin</span>
              <span>/</span>
              <span className="text-[#f7f5f0]">users-and-roles</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[3px] bg-[#383330] text-[#f7f5f0] border border-[#3f3a36] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-[#f7f5f0]">
                  Gouvernance des Utilisateurs & Rôles
                </h1>
                <p className="text-xs text-[#c9c0ad]">
                  Attribution de rôles RBAC, configuration des permissions et supervision des comptes.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                refetchUsers();
                refetchRoles();
              }}
              disabled={isUsersFetching}
              title="Rafraîchir les données"
              className="p-2 bg-[#383330] hover:bg-[#3f3a36] border border-[#3f3a36] text-[#c9c0ad] hover:text-[#f7f5f0] rounded-[3px] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isUsersFetching ? 'animate-spin text-[#f7f5f0]' : ''}`}
              />
            </button>

            {canManageRoles && (
              <button
                type="button"
                onClick={() => setIsCreateRoleModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouveau Rôle</span>
              </button>
            )}
          </div>
        </div>

        {/* Access Status Banner */}
        {isSignedIn && !isAdmin && !canManageRoles && !canManageUsers && (
          <div className="p-3 bg-[#383330] border border-[#453316] rounded-[4px] text-xs text-[#f59e0b] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-[#f59e0b]" />
            <span>
              Mode lecture seule : Votre profil actuel ({roleName || 'Sans rôle'})
              ne possède pas les privilèges requis pour modifier les rôles ou statuts.
            </span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="border-b border-[#3f3a36] flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`pb-2.5 text-xs font-medium transition-colors relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'users'
                ? 'text-[#f7f5f0]'
                : 'text-[#aea69c] hover:text-[#f7f5f0]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Utilisateurs Enregistrés</span>
            <span
              className={`px-1.5 py-0.5 rounded-[2px] font-mono text-[10px] border ${
                activeTab === 'users'
                  ? 'bg-[#f7f5f0] text-[#2b2622] border-[#f7f5f0]'
                  : 'bg-[#383330] text-[#dad2c1] border-[#3f3a36]'
              }`}
            >
              {totalUsers}
            </span>
            {activeTab === 'users' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#f7f5f0]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`pb-2.5 text-xs font-medium transition-colors relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'roles'
                ? 'text-[#f7f5f0]'
                : 'text-[#aea69c] hover:text-[#f7f5f0]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Rôles & Permissions</span>
            <span
              className={`px-1.5 py-0.5 rounded-[2px] font-mono text-[10px] border ${
                activeTab === 'roles'
                  ? 'bg-[#f7f5f0] text-[#2b2622] border-[#f7f5f0]'
                  : 'bg-[#383330] text-[#dad2c1] border-[#3f3a36]'
              }`}
            >
              {roles.length}
            </span>
            {activeTab === 'roles' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#f7f5f0]" />
            )}
          </button>
        </div>

        {/* Tab 1: Users View */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#383330] p-3 rounded-[4px] border border-[#3f3a36]">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#aea69c]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher par identifiant, nom, email ou rôle..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#2b2622] text-[#f7f5f0] border border-[#3f3a36] rounded-[3px] focus:outline-none focus:border-[#f7f5f0] placeholder:text-[#aea69c] transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#3f3a36]">
                <span className="text-xs text-[#c9c0ad] whitespace-nowrap font-mono text-[11px]">
                  Filtre :
                </span>
                <select
                  value={statusFilter ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStatusFilter(val ? (val as UserStatus) : undefined);
                    setPage(1);
                  }}
                  className="text-xs font-medium py-1.5 px-2.5 rounded-[3px] border border-[#3f3a36] bg-[#2b2622] text-[#f7f5f0] focus:outline-none focus:border-[#f7f5f0] cursor-pointer"
                >
                  <option value="">Tous les statuts</option>
                  <option value="ACTIVE">Actif uniquement</option>
                  <option value="PENDING">En attente uniquement</option>
                  <option value="DISABLED">Désactivé uniquement</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <UserListTable
              users={users}
              roles={roles}
              isLoading={isUsersLoading}
              totalUsers={totalUsers}
              totalPages={totalPages}
              currentPage={currentPage}
              onPageChange={setPage}
              onAssignRole={async (userId, roleId) => {
                await assignRole({ userId, roleId });
              }}
              onUpdateStatus={async (userId, status) => {
                await updateStatus({ userId, status });
              }}
              canManageUsers={canManageUsers}
              canManageRoles={canManageRoles}
              currentUserId={currentAuthUser?.userId}
            />
          </div>
        )}

        {/* Tab 2: Roles View */}
        {activeTab === 'roles' && (
          <div className="space-y-4">
            <RoleListCards
              roles={roles}
              isLoading={isRolesLoading}
              onOpenCreateRole={() => setIsCreateRoleModalOpen(true)}
              onOpenEditRole={(role) => {
                setRoleToEdit(role);
                setIsEditRoleModalOpen(true);
              }}
              canManageRoles={canManageRoles}
            />
          </div>
        )}

        {/* Modal: Create Role */}
        <CreateRoleModal
          isOpen={isCreateRoleModalOpen}
          onClose={() => setIsCreateRoleModalOpen(false)}
          availablePermissions={availablePermissions}
          onSubmitRole={async (input) => {
            await createRole(input);
          }}
          isSubmitting={isCreatingRole}
        />

        {/* Modal: Edit Role */}
        <EditRoleModal
          isOpen={isEditRoleModalOpen}
          onClose={() => {
            setIsEditRoleModalOpen(false);
            setRoleToEdit(null);
          }}
          availablePermissions={availablePermissions}
          roleToEdit={roleToEdit}
          onSubmitRole={async (input) => {
            await editRole(input);
          }}
          isSubmitting={isEditingRole}
        />
      </div>
    </div>
  );
}
