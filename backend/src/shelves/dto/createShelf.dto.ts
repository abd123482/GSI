import { z } from 'zod';

export const createShelfSchema = z.object({
  shelfName: z.string().min(1, 'Shelf name is required'),
  shelfQuantity: z.coerce.number().int().min(0, 'Shelf quantity must be 0 or greater').default(0).optional(),
  shelfCode: z.string().optional(),
});

export type CreateShelfDTO = z.infer<typeof createShelfSchema>;

