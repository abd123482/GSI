'use client';

import {
  useMemo,
} from 'react';
import {
  useAuth,
} from '@clerk/nextjs';
import {
  useQuery,
} from '@tanstack/react-query';

import {
  useApi,
} from './use-api';
import {
  REQUIRED_CREATE_PERMISSION,
  REQUIRED_DELETE_PERMISSION,
  REQUIRED_UPDATE_PERMISSION,
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

export const ALL_SYSTEM_PERMISSIONS:
  string[] = [
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

    'dashboard.read',

    'inventory.read',
    'inventory.create',
    'inventory.count',
    'inventory.adjudicate',
    'inventory.launch',
    'inventory.finalize',
    'inventory.delete',
  ];

const EMPTY_PERMISSIONS: string[] =
  [];

export function usePermissions() {
  const {
    userId,
    isSignedIn,
    isLoaded,
  } = useAuth();

  const api = useApi();

  const {
    data: authUser,
    isLoading,
    error,
    refetch,
  } = useQuery<AuthMeResponse>({
    queryKey: ['auth', 'me', userId],

    queryFn: async () => {
      const response =
        await api.get<AuthMeResponse>(
          '/auth/me',
        );

      return response.data;
    },

    enabled:
      Boolean(isSignedIn) &&
      isLoaded &&
      Boolean(userId),

    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const isAdmin =
    authUser?.roleName
      ?.trim()
      .toUpperCase() === 'ADMIN' ||
    authUser?.isAdmin === true;

  const permissions = useMemo(() => {
    if (isAdmin) {
      return Array.from(
        new Set([
          ...ALL_SYSTEM_PERMISSIONS,
          ...(authUser?.permissions ??
            []),
        ]),
      );
    }

    return (
      authUser?.permissions ??
      EMPTY_PERMISSIONS
    );
  }, [
    authUser?.permissions,
    isAdmin,
  ]);

  const hasPermission = useMemo(
    () =>
      (
        permission: string,
      ): boolean => {
        if (isAdmin) {
          return true;
        }

        return permissions.includes(
          permission,
        );
      },
    [
      permissions,
      isAdmin,
    ],
  );

  /*
   * Shelves
   */
  const canReadShelf =
    isAdmin ||
    hasPermission('shelf.read');

  const canCreateShelf =
    isAdmin ||
    hasPermission(
      REQUIRED_CREATE_PERMISSION,
    );

  const canUpdateShelf =
    isAdmin ||
    hasPermission(
      REQUIRED_UPDATE_PERMISSION,
    );

  const canDeleteShelf =
    isAdmin ||
    hasPermission(
      REQUIRED_DELETE_PERMISSION,
    );

  /*
   * Stocks
   */
  const canReadStock =
    isAdmin ||
    hasPermission('stock.read');

  const canCreateStock =
    isAdmin ||
    hasPermission('stock.create');

  const canUpdateStock =
    isAdmin ||
    hasPermission('stock.update');

  const canDeleteStock =
    isAdmin ||
    hasPermission('stock.delete');

  /*
   * Equipment metadata
   *
   * IMPORTANT V3:
   * equipment.create does NOT imply movement.create
   * and movement.create does NOT imply equipment.create.
   */
  const canReadEquipment =
    isAdmin ||
    hasPermission('equipment.read');

  const canCreateEquipment =
    isAdmin ||
    hasPermission('equipment.create');

  const canUpdateEquipment =
    isAdmin ||
    hasPermission('equipment.update');

  const canDeleteEquipment =
    isAdmin ||
    hasPermission('equipment.delete');

  /*
   * Serial identities
   */
  const canReadSerialNumber =
    isAdmin ||
    hasPermission(
      'serial-number.read',
    );

  const canCreateSerialNumber =
    isAdmin ||
    hasPermission(
      'serial-number.create',
    );

  const canUpdateSerialNumber =
    isAdmin ||
    hasPermission(
      'serial-number.update',
    );

  const canDeleteSerialNumber =
    isAdmin ||
    hasPermission(
      'serial-number.delete',
    );

  /*
   * Movement = physical stock/location changes.
   */
  const canReadMovement =
    isAdmin ||
    hasPermission('movement.read');

  const canCreateMovement =
    isAdmin ||
    hasPermission('movement.create');

  /*
   * Administration
   */
  const canManageUsers =
    isAdmin ||
    hasPermission('user.manage');

  const canManageRoles =
    isAdmin ||
    hasPermission('role.manage');

  const canReadDashboard =
    isAdmin ||
    hasPermission('dashboard.read');

  /*
   * Inventory
   */
  const canReadInventory =
    isAdmin ||
    hasPermission('inventory.read');

  const canCreateInventory =
    isAdmin ||
    hasPermission('inventory.create');

  const canLaunchInventory =
    isAdmin ||
    hasPermission('inventory.launch');

  const canCountInventory =
    isAdmin ||
    hasPermission('inventory.count');

  const canAdjudicateInventory =
    isAdmin ||
    hasPermission(
      'inventory.adjudicate',
    );

  const canFinalizeInventory =
    isAdmin ||
    hasPermission(
      'inventory.finalize',
    );

  const canDeleteInventory =
    isAdmin ||
    hasPermission('inventory.delete');

  return useMemo(
    () => ({
      user:
        authUser ?? null,

      authUser:
        authUser ?? null,

      permissions,

      roleName:
        authUser?.roleName ??
        null,

      isAdmin,

      canReadDashboard,

      canReadEquipment,
      canCreateEquipment,
      canUpdateEquipment,
      canDeleteEquipment,

      canReadSerialNumber,
      canCreateSerialNumber,
      canUpdateSerialNumber,
      canDeleteSerialNumber,

      canReadMovement,
      canCreateMovement,

      canReadShelf,
      canCreateShelf,
      canUpdateShelf,
      canDeleteShelf,

      canReadStock,
      canCreateStock,
      canUpdateStock,
      canDeleteStock,

      canManageUsers,
      canManageRoles,

      canReadInventory,
      canCreateInventory,
      canLaunchInventory,
      canCountInventory,
      canAdjudicateInventory,
      canFinalizeInventory,
      canDeleteInventory,

      hasPermission,

      isLoading:
        !isLoaded ||
        Boolean(
          isSignedIn &&
          isLoading,
        ),

      error,
      refetch,
    }),
    [
      authUser,
      permissions,
      isAdmin,

      canReadDashboard,

      canReadEquipment,
      canCreateEquipment,
      canUpdateEquipment,
      canDeleteEquipment,

      canReadSerialNumber,
      canCreateSerialNumber,
      canUpdateSerialNumber,
      canDeleteSerialNumber,

      canReadMovement,
      canCreateMovement,

      canReadShelf,
      canCreateShelf,
      canUpdateShelf,
      canDeleteShelf,

      canReadStock,
      canCreateStock,
      canUpdateStock,
      canDeleteStock,

      canManageUsers,
      canManageRoles,

      canReadInventory,
      canCreateInventory,
      canLaunchInventory,
      canCountInventory,
      canAdjudicateInventory,
      canFinalizeInventory,
      canDeleteInventory,

      hasPermission,

      isLoaded,
      isSignedIn,
      isLoading,
      error,
      refetch,
    ],
  );
}
