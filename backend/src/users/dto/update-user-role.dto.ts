import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  roleId: z.string().uuid('Invalid role UUID format').nullable(),
});

export type UpdateUserRoleDTO = z.infer<typeof updateUserRoleSchema>;
