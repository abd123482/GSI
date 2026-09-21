import { z } from 'zod';

export const updateSerialNumberStatusSchema = z.object({
  serialNumberStatus: z
    .string()
    .trim()
    .min(1, 'Serial number status is required')
    .max(100, 'Serial number status must not exceed 100 characters'),
});

export type UpdateSerialNumberStatusDTO =
  z.infer<typeof updateSerialNumberStatusSchema>;
