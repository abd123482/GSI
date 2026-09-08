import { z } from 'zod';

export const updateShelfSchema = z.object({
  shelfName: z.string().min(1, 'Shelf name cannot be empty').optional(),
  shelfQuantity: z.coerce.number().int().min(0, 'Shelf quantity must be 0 or greater').optional(),
  shelfCode: z.string().optional(),
});

export type UpdateShelfDTO = z.infer<typeof updateShelfSchema>;

