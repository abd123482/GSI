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
  shelfCode: z.string().trim().optional(),
});

export type CreateShelfFormValues = z.infer<typeof createShelfSchema>;

/**
 * Zod schema for updating an existing shelf.
 * Only shelf metadata (e.g. name) can be modified. Quantities are managed exclusively via movements.
 */
export const updateShelfSchema = z.object({
  shelfName: z
    .string()
    .trim()
    .min(1, 'Le nom ne peut pas être vide')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .optional(),
  shelfCode: z.string().trim().optional(),
});

export type UpdateShelfFormValues = z.infer<typeof updateShelfSchema>;
