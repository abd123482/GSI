import { z } from 'zod';

export const assignThirdUserSchema = z.object({
  thirdUserId: z.string().uuid('Identifiant utilisateur invalide'),
  notes: z.string().optional(),
});

export type AssignThirdUserDTO = z.infer<typeof assignThirdUserSchema>;
