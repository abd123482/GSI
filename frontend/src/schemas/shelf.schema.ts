import { z } from 'zod';

const requiredStockIdSchema = z
  .string()
  .trim()
  .min(1, 'Vous devez sélectionner un stock actif')
  .uuid('Identifiant de stock invalide');

const shelfStatusSchema = z.preprocess(
  (val) => (val === true || val === 'true' ? true : val === false || val === 'false' ? false : val),
  z.boolean(),
) as z.ZodType<boolean, z.ZodTypeDef, boolean>;

export const createShelfSchema = z.object({
  shelfName: z
    .string()
    .trim()
    .min(1, 'Le nom de l’emplacement est obligatoire')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  stockId: requiredStockIdSchema,
  status: shelfStatusSchema,
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
    status: shelfStatusSchema.optional(),
  })
  .refine(
    (data) => data.shelfName !== undefined || data.stockId !== undefined || data.status !== undefined,
    { message: 'Aucune modification à enregistrer.' },
  );

export type UpdateShelfFormValues = z.infer<typeof updateShelfSchema>;
