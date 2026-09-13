import { z } from 'zod';

export const createShelfSchema = z.object({
  shelfName: z.string().min(1, 'Shelf name is required'),
  shelfCode: z.string().optional(),
});

export type CreateShelfDTO = z.infer<typeof createShelfSchema>;

