import { z } from 'zod';

export const searchStockSchema = z.object({
  stockName: z.string().trim().optional(),
  stockStatus: z.string().trim().optional(),
});

export type SearchStockDTO = z.infer<typeof searchStockSchema>;
