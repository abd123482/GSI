'use client';

import { useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { useApi } from './use-api';
import {
  REQUIRED_CREATE_PERMISSION,
  REQUIRED_UPDATE_PERMISSION,
  REQUIRED_DELETE_PERMISSION,
} from '@/services/shelf.service';

export interface AuthMeResponse {
  userId: string;
  clerkUserId: string;
  userName: string | null;
  userEmail: string | null;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
  status: string | null;
  isAdmin?: boolean;
}

export const ALL_SYSTEM_PERMISSIONS: string[] = [
  'equipment.read',
  'equipment.create',
  'equipment.update',
  'equipment.delete',
  'serial-number.read',
  'serial-number.create',
  'serial-number.update',
  'serial-number.delete',
  'movement.read',
  'movement.create',
  'shelf.read',
  'shelf.create',
  'shelf.update',
  'shelf.delete',
  'stock.read',
  'stock.create',
  'stock.update',
  'stock.delete',
  'user.manage',
  'role.manage',
];

const EMPTY_PERMISSIONS: string[] = [];

/**
 * Hook for cached, fast authentication & authorization inspection.
 * Fetches user identity, role, and permissions from /auth/me with Clerk session token.
 * Universal bypass for ADMIN role ensures full access everywhere across the UI.
 */
export function usePermissions() {
  const { isSignedIn, isLoaded } = useAuth();
  const api = useApi();

  const { data: authUser, isLoading, error, refetch } = useQuery<AuthMeResponse>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await api.get<AuthMeResponse>('/auth/me');
      return response.data;
    },
    enabled: !!isSignedIn && isLoaded,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    gcTime: 10 * 60 * 1000,
  });

  const isAdmin =
    authUser?.roleName?.trim().toUpperCase() === 'ADMIN' ||
    authUser?.isAdmin === true;

  const permissions = useMemo(() => {
    if (isAdmin) {
      const set = new Set([
        ...ALL_SYSTEM_PERMISSIONS,
        ...(authUser?.permissions ?? []),
      ]);
      return Array.from(set);
    }
    return authUser?.permissions ?? EMPTY_PERMISSIONS;
  }, [authUser?.permissions, isAdmin]);

  const hasPermission = useMemo(() => {
    return (permission: string): boolean => {
      if (isAdmin) return true;
      if (!permissions || permissions.length === 0) return false;
      return permissions.includes(permission);
    };
  }, [permissions, isAdmin]);

  const canCreateShelf = isAdmin || hasPermission(REQUIRED_CREATE_PERMISSION);
  const canUpdateShelf = isAdmin || hasPermission(REQUIRED_UPDATE_PERMISSION);
  const canDeleteShelf = isAdmin || hasPermission(REQUIRED_DELETE_PERMISSION);

  const canCreateStock = isAdmin || hasPermission('stock.create');
  const canUpdateStock = isAdmin || hasPermission('stock.update');
  const canDeleteStock = isAdmin || hasPermission('stock.delete');

  const canCreateEquipment =
    isAdmin ||
    hasPermission('equipment.create') ||
    hasPermission('movement.create');
  const canUpdateEquipment = isAdmin || hasPermission('equipment.update');
  const canDeleteEquipment = isAdmin || hasPermission('equipment.delete');
  const canCreateSerialNumber = isAdmin || hasPermission('serial-number.create');
  const canUpdateSerialNumber = isAdmin || hasPermission('serial-number.update');
  const canDeleteSerialNumber = isAdmin || hasPermission('serial-number.delete');

  const canManageUsers = isAdmin || hasPermission('user.manage');
  const canManageRoles = isAdmin || hasPermission('role.manage');

  return useMemo(
    () => ({
      user: authUser ?? null,
      permissions,
      roleName: authUser?.roleName ?? null,
      isAdmin,
      canCreateShelf,
      canUpdateShelf,
      canDeleteShelf,
      canCreateStock,
      canUpdateStock,
      canDeleteStock,
      canCreateEquipment,
      canUpdateEquipment,
      canDeleteEquipment,
      canCreateSerialNumber,
      canUpdateSerialNumber,
      canDeleteSerialNumber,
      canManageUsers,
      canManageRoles,
      hasPermission,
      isLoading: !isLoaded || (isSignedIn && isLoading),
      error,
      refetch,
    }),
    [
      authUser,
      permissions,
      isAdmin,
      canCreateShelf,
      canUpdateShelf,
      canDeleteShelf,
      canCreateStock,
      canUpdateStock,
      canDeleteStock,
      canCreateEquipment,
      canUpdateEquipment,
      canDeleteEquipment,
      canCreateSerialNumber,
      canUpdateSerialNumber,
      canDeleteSerialNumber,
      canManageUsers,
      canManageRoles,
      hasPermission,
      isLoaded,
      isSignedIn,
      isLoading,
      error,
      refetch,
    ],
  );
}
