import { z } from 'zod';

export const searchShelfSchema = z.object({
  shelfName: z
    .string()
    .trim()
    .optional(),

  stockId: z
    .string()
    .uuid('Stock ID must be a valid UUID')
    .optional(),
    
  shelfStatus: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type SearchShelfDTO = z.infer<typeof searchShelfSchema>;
