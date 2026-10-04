import { z } from 'zod';

export const searchStockSchema = z.object({
  stockName: z.string().trim().optional(),
  status: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
});

export type SearchStockDTO = z.infer<typeof searchStockSchema>;
