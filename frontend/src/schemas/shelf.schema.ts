import { z } from 'zod';

/**
 * Zod validation schema for creating a new shelf.
 * Matches backend validation rules for maximum consistency.
 */
export const createShelfSchema = z.object({
  shelfName: z
    .string()
    .trim()
    .min(1, 'Le nom de l’étagère est obligatoire')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  shelfQuantity: z.coerce
    .number({
      required_error: 'La quantité est requise',
      invalid_type_error: 'La quantité doit être un nombre valide',
    })
    .int('La quantité doit être un nombre entier')
    .min(0, 'La quantité ne peut pas être négative'),
  shelfCode: z.string().trim().optional(),
});

export type CreateShelfFormValues = z.infer<typeof createShelfSchema>;

/**
 * Zod schema for updating an existing shelf.
 */
export const updateShelfSchema = z.object({
  shelfName: z
    .string()
    .trim()
    .min(1, 'Le nom ne peut pas être vide')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .optional(),
  shelfQuantity: z.coerce
    .number({
      invalid_type_error: 'La quantité doit être un nombre valide',
    })
    .int('La quantité doit être un nombre entier')
    .min(0, 'La quantité ne peut pas être négative')
    .optional(),
  shelfCode: z.string().trim().optional(),
});

export type UpdateShelfFormValues = z.infer<typeof updateShelfSchema>;
