import { z } from 'zod';

export const updateShelfSchema = z.object({
  shelfName: z.string().min(1, 'Shelf name cannot be empty').optional(),
});

export type UpdateShelfDTO = z.infer<typeof updateShelfSchema>;

