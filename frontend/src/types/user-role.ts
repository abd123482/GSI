/**
 * Types and interfaces for Users, Roles, and Permissions in Somépharm maintenance.
 */

export interface PermissionItem {
  permissionId: string;
  permissionName: string;
}

export interface Role {
  roleId: string;
  roleName: string;
  permissions: PermissionItem[];
  _count?: {
    users: number;
  };
}

export type UserStatus = 'ACTIVE' | 'PENDING' | 'DISABLED';

export interface AdminUser {
  userId: string;
  clerkUserId: string | null;
  userName: string | null;
  userEmail: string;
  roleId: string | null;
  userStatus: UserStatus;
  role: {
    roleId: string;
    roleName: string;
    permissions: PermissionItem[];
  } | null;
}

export interface CreateRoleInput {
  roleName: string;
  permissions: string[];
}

export interface EditRoleInput {
  roleId: string;
  roleName?: string;
  permissions?: string[];
}

export interface AssignRoleInput {
  userId: string;
  roleId: string | null;
}

export interface UpdateUserStatusInput {
  userId: string;
  status: UserStatus;
}

export interface UsersQuery {
  status?: UserStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedUsersResponse {
  data: AdminUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
