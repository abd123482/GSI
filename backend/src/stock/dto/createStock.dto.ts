import { z } from 'zod';

export const createStockSchema = z.object({
  stockName: z.string().trim().min(1).max(100),
  status: z.boolean().optional(),
});

export type CreateStockDTO = z.infer<typeof createStockSchema>;