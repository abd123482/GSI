import { z } from 'zod';

const stockIdSchema = z
  .union([
    z.string().uuid('Identifiant de stock invalide'),
    z.literal(''),
    z.null(),
  ])
  .optional();

export const createShelfSchema = z.object({
  shelfName: z
    .string()
    .trim()
    .min(1, 'Le nom de l’emplacement est obligatoire')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),

  stockId: stockIdSchema,
});

export type CreateShelfFormValues = z.infer<
  typeof createShelfSchema
>;

export const updateShelfSchema = z
  .object({
    shelfName: z
      .string()
      .trim()
      .min(1, 'Le nom ne peut pas être vide')
      .max(100, 'Le nom ne peut pas dépasser 100 caractères')
      .optional(),

    stockId: stockIdSchema,
  })
  .refine(
    (data) =>
      data.shelfName !== undefined ||
      data.stockId !== undefined,
    {
      message: 'Aucune modification à enregistrer.',
    },
  );

export type UpdateShelfFormValues = z.infer<
  typeof updateShelfSchema
>;
