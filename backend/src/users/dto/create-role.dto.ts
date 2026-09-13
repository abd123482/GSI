import { z } from 'zod';

export const createRoleSchema = z.object({
  roleName: z
    .string()
    .min(1, 'Le nom du rôle est requis')
    .max(100, 'Le nom du rôle ne peut pas dépasser 100 caractères')
    .trim(),
  permissions: z
    .array(z.string().min(1))
    .min(1, 'Au moins une permission doit être sélectionnée'),
});

export type CreateRoleDTO = z.infer<typeof createRoleSchema>;
