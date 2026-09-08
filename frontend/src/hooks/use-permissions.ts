'use client';

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
}

/**
 * Hook for cached, fast authentication & authorization inspection.
 * Fetches user identity, role, and permissions from /auth/me with Clerk session token.
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

  const permissions = authUser?.permissions ?? [];

  const hasPermission = (permission: string): boolean => {
    if (!permissions || permissions.length === 0) return false;
    return permissions.includes(permission);
  };

  const canCreateShelf = hasPermission(REQUIRED_CREATE_PERMISSION);
  const canUpdateShelf = hasPermission(REQUIRED_UPDATE_PERMISSION);
  const canDeleteShelf = hasPermission(REQUIRED_DELETE_PERMISSION);

  const canCreateEquipment = hasPermission('equipment.create') || hasPermission('movement.create');
  const canUpdateEquipment = hasPermission('equipment.update');
  const canDeleteEquipment = hasPermission('equipment.delete');
  const canUpdateSerialNumber = hasPermission('serial-number.update');
  const canDeleteSerialNumber = hasPermission('serial-number.delete');

  return {
    user: authUser ?? null,
    permissions,
    roleName: authUser?.roleName ?? null,
    canCreateShelf,
    canUpdateShelf,
    canDeleteShelf,
    canCreateEquipment,
    canUpdateEquipment,
    canDeleteEquipment,
    canUpdateSerialNumber,
    canDeleteSerialNumber,
    hasPermission,
    isLoading: !isLoaded || (isSignedIn && isLoading),
    error,
    refetch,
  };
}
