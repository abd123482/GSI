import { z } from 'zod';

export const updateSerialNumberSchema = z.object({
  serialNumberCode: z.string().min(1, 'Serial number code cannot be empty').optional(),
  equipmentId: z.string().uuid('Equipment ID must be a valid UUID').optional(),
  serialNumberStatus: z.string().min(1, 'Serial number status cannot be empty').optional(),
});

export type UpdateSerialNumberDTO = z.infer<typeof updateSerialNumberSchema>;
