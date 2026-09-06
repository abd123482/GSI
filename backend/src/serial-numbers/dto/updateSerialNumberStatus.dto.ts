import { z } from 'zod';

export const updateSerialNumberStatusSchema = z.object({
  serialNumberStatus: z.string().min(1, 'Serial number status is required'),
});

export type UpdateSerialNumberStatusDTO = z.infer<typeof updateSerialNumberStatusSchema>;
