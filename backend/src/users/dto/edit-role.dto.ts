import { z } from 'zod';

export const editRoleSchema = z.object({
  roleName: z
    .string()
    .min(2, 'Le nom du rôle doit contenir au moins 2 caractères.')
    .max(50, 'Le nom du rôle ne peut pas dépasser 50 caractères.')
    .regex(/^[a-zA-Z0-9_\- ]+$/, 'Le nom contient des caractères non autorisés.')
    .optional(),
  permissions: z
    .array(z.string())
    .min(1, 'Au moins une permission est requise.')
    .optional(),
});

export type EditRoleDTO = z.infer<typeof editRoleSchema>;
