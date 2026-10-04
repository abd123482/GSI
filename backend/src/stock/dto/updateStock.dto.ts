import { z } from 'zod';

export const updateStockSchema = z.object({
  stockName: z.string().trim().min(1).max(100).optional(),
  status: z.boolean().optional(),
}).strict().refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

export type UpdateStockDTO = z.infer<typeof updateStockSchema>;