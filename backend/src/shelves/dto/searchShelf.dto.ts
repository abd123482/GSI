import { z } from 'zod';

export const searchShelfSchema = z.object({
  shelfName: z.string().optional(),
  shelfCode: z.string().optional(),
});

export type SearchShelfDTO = z.infer<typeof searchShelfSchema>;
