import { z } from 'zod';

export const createSerialNumberSchema = z.object({
  serialNumberCode: z.string().min(1, 'Serial number code is required'),
  equipmentId: z.string().uuid('Equipment ID must be a valid UUID'),
  serialNumberStatus: z.string().min(1, 'Serial number status cannot be empty').optional().default('AVAILABLE'),
});

export type CreateSerialNumberDTO = z.infer<typeof createSerialNumberSchema>;

export const createBatchSerialNumberSchema = z.object({
  equipmentId: z.string().uuid('Equipment ID must be a valid UUID'),
  serialNumberCodes: z
    .array(z.string().min(1, 'Serial number code cannot be empty'))
    .min(1, 'At least one serial number code is required'),
  serialNumberStatus: z.string().min(1).optional().default('AVAILABLE'),
});

export type CreateBatchSerialNumberDTO = z.infer<typeof createBatchSerialNumberSchema>;
