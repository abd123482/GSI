'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApi } from './use-api';
import { AdminUsersService } from '@/services/admin-users.service';
import {
  AdminUser,
  Role,
  CreateRoleInput,
  EditRoleInput,
  AssignRoleInput,
  UpdateUserStatusInput,
  UserStatus,
  PaginatedUsersResponse,
} from '@/types/user-role';
import { getErrorMessage } from '@/lib/error-message';

interface UseAdminUsersOptions {
  initialPage?: number;
  initialLimit?: number;
  initialStatus?: UserStatus;
}

export function useAdminUsers(options: UseAdminUsersOptions = {}) {
  const api = useApi();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(options.initialPage ?? 1);
  const [limit, setLimit] = useState(options.initialLimit ?? 10);
  const [statusFilter, setStatusFilter] = useState<UserStatus | undefined>(
    options.initialStatus,
  );
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch Paginated Users
  const {
    data: usersData,
    isLoading: isUsersLoading,
    isFetching: isUsersFetching,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery<PaginatedUsersResponse>({
    queryKey: ['admin', 'users', { page, limit, status: statusFilter }],
    queryFn: () =>
      AdminUsersService.getUsers(api, {
        page,
        limit,
        status: statusFilter,
      }),
    staleTime: 60 * 1000,
  });

  // 2. Fetch Roles
  const {
    data: roles = [],
    isLoading: isRolesLoading,
    error: rolesError,
    refetch: refetchRoles,
  } = useQuery<Role[]>({
    queryKey: ['admin', 'roles'],
    queryFn: () => AdminUsersService.getRoles(api),
    staleTime: 60 * 1000,
  });

  // 3. Fetch Available Permissions
  const {
    data: availablePermissions = [],
    isLoading: isPermissionsLoading,
  } = useQuery<string[]>({
    queryKey: ['admin', 'permissions'],
    queryFn: () => AdminUsersService.getAvailablePermissions(api),
    staleTime: 5 * 60 * 1000,
  });

  // Client-side search filtering across user name, email, or role
  const filteredUsers = useMemo(() => {
    const rawUsers = usersData?.data ?? [];
    if (!searchTerm.trim()) return rawUsers;

    const term = searchTerm.toLowerCase();
    return rawUsers.filter(
      (u) =>
        u.userName?.toLowerCase().includes(term) ||
        u.userEmail.toLowerCase().includes(term) ||
        u.role?.roleName.toLowerCase().includes(term),
    );
  }, [usersData?.data, searchTerm]);

  // Mutation: Create Role
  const createRoleMutation = useMutation({
    mutationFn: (input: CreateRoleInput) =>
      AdminUsersService.createRole(api, input),
    onSuccess: (newRole) => {
      toast.success(`Le rôle '${newRole.roleName}' a été créé avec succès !`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'permissions'] });
    },
    onError: (err) => {
      const msg = getErrorMessage(err, 'Une erreur est survenue lors de la création du rôle.');
      toast.error(`Échec de création du rôle : ${msg}`);
    },
  });

  // Mutation: Edit Role
  const editRoleMutation = useMutation({
    mutationFn: (input: EditRoleInput) =>
      AdminUsersService.editRole(api, input),
    onSuccess: (updatedRole) => {
      toast.success(`Le rôle '${updatedRole.roleName}' a été modifié avec succès !`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => {
      const msg = getErrorMessage(err, 'Une erreur est survenue lors de la modification du rôle.');
      toast.error(`Échec de modification du rôle : ${msg}`);
    },
  });

  // Mutation: Assign Role to User
  const assignRoleMutation = useMutation({
    mutationFn: (input: AssignRoleInput) =>
      AdminUsersService.assignUserRole(api, input),
    onSuccess: (updatedUser) => {
      toast.success(
        `Rôle mis à jour pour ${updatedUser.userName || updatedUser.userEmail} !`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
    onError: (err) => {
      const msg = getErrorMessage(err, "Une erreur est survenue lors de l'assignation du rôle.");
      toast.error(`Impossible d'assigner le rôle : ${msg}`);
    },
  });

  // Mutation: Update User Status
  const updateStatusMutation = useMutation({
    mutationFn: (input: UpdateUserStatusInput) =>
      AdminUsersService.updateUserStatus(api, input),
    onSuccess: (updatedUser) => {
      toast.success(
        `Statut changé pour ${updatedUser.userName || updatedUser.userEmail} (${updatedUser.userStatus}) !`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => {
      const msg = getErrorMessage(err, 'Une erreur est survenue lors de la mise à jour du statut.');
      toast.error(`Impossible de modifier le statut : ${msg}`);
    },
  });

  return {
    users: filteredUsers,
    totalUsers: usersData?.meta.total ?? 0,
    totalPages: usersData?.meta.totalPages ?? 1,
    currentPage: page,
    limit,
    statusFilter,
    searchTerm,
    roles,
    availablePermissions,
    isUsersLoading,
    isUsersFetching,
    isRolesLoading,
    isPermissionsLoading,
    usersError,
    rolesError,
    setPage,
    setLimit,
    setStatusFilter,
    setSearchTerm,
    refetchUsers,
    refetchRoles,
    createRole: createRoleMutation.mutateAsync,
    isCreatingRole: createRoleMutation.isPending,
    editRole: editRoleMutation.mutateAsync,
    isEditingRole: editRoleMutation.isPending,
    assignRole: assignRoleMutation.mutateAsync,
    isAssigningRole: assignRoleMutation.isPending,
    updateStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,
  };
}
