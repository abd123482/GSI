import { z } from 'zod';

export const createSerialNumberSchema = z.object({
  serialNumberCode: z
    .string()
    .trim()
    .min(1, 'Serial number code is required')
    .max(200, 'Serial number code must not exceed 200 characters'),

  equipmentId: z
    .string()
    .uuid('Equipment ID must be a valid UUID'),

  serialNumberStatus: z
    .string()
    .trim()
    .min(1, 'Serial number status cannot be empty')
    .max(100, 'Serial number status must not exceed 100 characters')
    .optional()
    .default('AVAILABLE'),
});

export type CreateSerialNumberDTO =
  z.infer<typeof createSerialNumberSchema>;

export const createBatchSerialNumberSchema = z.object({
  equipmentId: z
    .string()
    .uuid('Equipment ID must be a valid UUID'),

  serialNumberCodes: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Serial number code cannot be empty')
        .max(200, 'Serial number code must not exceed 200 characters'),
    )
    .min(1, 'At least one serial number code is required')
    .max(1000, 'A batch cannot exceed 1000 serial numbers'),

  serialNumberStatus: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .default('AVAILABLE'),
});

export type CreateBatchSerialNumberDTO =
  z.infer<typeof createBatchSerialNumberSchema>;
