import { AxiosInstance } from 'axios';
import {
  AdminUser,
  Role,
  CreateRoleInput,
  AssignRoleInput,
  UpdateUserStatusInput,
  UsersQuery,
  PaginatedUsersResponse,
  EditRoleInput,
} from '@/types/user-role';

export class AdminUsersService {
  /**
   * Fetch paginated registered users.
   */
  static async getUsers(
    client: AxiosInstance,
    params?: UsersQuery,
  ): Promise<PaginatedUsersResponse> {
    const response = await client.get<PaginatedUsersResponse>('/admin/users', {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        status: params?.status || undefined,
      },
    });
    return response.data;
  }

  /**
   * Fetch all roles with their assigned permissions.
   */
  static async getRoles(client: AxiosInstance): Promise<Role[]> {
    const response = await client.get<Role[]>('/admin/roles');
    return response.data;
  }

  /**
   * Fetch all system permissions available for role creation.
   */
  static async getAvailablePermissions(client: AxiosInstance): Promise<string[]> {
    const response = await client.get<string[]>('/admin/permissions');
    return response.data;
  }

  /**
   * Create a new role with assigned permissions.
   */
  static async createRole(
    client: AxiosInstance,
    input: CreateRoleInput,
  ): Promise<Role> {
    const response = await client.post<Role>('/admin/roles', {
      roleName: input.roleName.trim(),
      permissions: input.permissions,
    });
    return response.data;
  }

  /**
   * Edit an existing role.
   */
  static async editRole(
    client: AxiosInstance,
    input: EditRoleInput,
  ): Promise<Role> {
    const { roleId, ...payload } = input;
    const response = await client.patch<Role>(`/admin/roles/${roleId}`, payload);
    return response.data;
  }

  /**
   * Assign a role to a registered user.
   */
  static async assignUserRole(
    client: AxiosInstance,
    input: AssignRoleInput,
  ): Promise<AdminUser> {
    const response = await client.patch<AdminUser>(
      `/admin/users/${input.userId}/role`,
      {
        roleId: input.roleId,
      },
    );
    return response.data;
  }

  /**
   * Update user status (ACTIVE, PENDING, DISABLED).
   */
  static async updateUserStatus(
    client: AxiosInstance,
    input: UpdateUserStatusInput,
  ): Promise<AdminUser> {
    const response = await client.patch<AdminUser>(
      `/admin/users/${input.userId}/status`,
      {
        status: input.status,
      },
    );
    return response.data;
  }
}
