import { z } from 'zod';

const requiredStockIdSchema = z
  .string()
  .trim()
  .min(1, 'Vous devez sélectionner un stock actif')
  .uuid('Identifiant de stock invalide');

export const createShelfSchema = z.object({
  shelfName: z
    .string()
    .trim()
    .min(1, 'Le nom de l’emplacement est obligatoire')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  stockId: requiredStockIdSchema,
  status: z.boolean(),
});

export type CreateShelfFormValues = z.infer<typeof createShelfSchema>;

export const updateShelfSchema = z
  .object({
    shelfName: z
      .string()
      .trim()
      .min(1, 'Le nom ne peut pas être vide')
      .max(100, 'Le nom ne peut pas dépasser 100 caractères')
      .optional(),
    stockId: requiredStockIdSchema.optional(),
    status: z.boolean().optional(),
  })
  .refine(
    (data) => data.shelfName !== undefined || data.stockId !== undefined || data.status !== undefined,
    { message: 'Aucune modification à enregistrer.' },
  );

export type UpdateShelfFormValues = z.infer<typeof updateShelfSchema>;
