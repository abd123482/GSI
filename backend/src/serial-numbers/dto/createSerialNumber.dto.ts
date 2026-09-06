import { z } from 'zod';

export const createSerialNumberSchema = z.object({
  serialNumberCode: z.string().min(1, 'Serial number code is required'),
  equipmentId: z.string().uuid('Equipment ID must be a valid UUID'),
  serialNumberStatus: z.string().min(1, 'Serial number status cannot be empty').optional(),
});

export type CreateSerialNumberDTO = z.infer<typeof createSerialNumberSchema>;
