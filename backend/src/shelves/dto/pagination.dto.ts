import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(500)
    .default(10),
});

export type PaginationDTO = z.infer<typeof paginationSchema>;
