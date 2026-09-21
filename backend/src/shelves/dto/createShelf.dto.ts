import { z } from 'zod';

export const createShelfSchema = z.object({
  shelfName: z
    .string()
    .trim()
    .min(1, 'Shelf name is required')
    .max(100, 'Shelf name must not exceed 100 characters'),

  stockId: z
    .string()
    .uuid('Stock ID must be a valid UUID')
    .nullable()
    .optional(),
});

export type CreateShelfDTO = z.infer<typeof createShelfSchema>;
