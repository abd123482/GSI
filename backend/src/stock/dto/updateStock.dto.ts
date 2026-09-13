import { z } from 'zod';

export const updateStockSchema = z.object({
  stockName: z
    .string()
    .trim()
    .min(5, 'Stock name must be at least 5 characters')
    .max(50, 'Stock name must not exceed 50 characters')
    .optional(),
  stockStatus: z
    .string()
    .trim()
    .optional(),
});

export type UpdateStockDTO = z.infer<typeof updateStockSchema>;
