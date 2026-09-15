import { z } from 'zod';

export const createOrderSchema = z.object({
  inventoryId: z.string().uuid('inventoryId must be a valid UUID').nullable().optional(),
  serialNumberId: z.string().uuid('serialNumberId must be a valid UUID').nullable().optional(),
  equipmentId: z.string().uuid('equipmentId must be a valid UUID').nullable().optional(),
  shelfId: z.string().uuid('shelfId must be a valid UUID').nullable().optional(),
  roleId: z.string().uuid('roleId must be a valid UUID').nullable().optional(),
  userId: z.string().uuid('userId must be a valid UUID').nullable().optional(),
  quantityCalculated: z.number().int('quantityCalculated must be an integer').nullable().optional(),
});

export type CreateOrderDTO = z.infer<typeof createOrderSchema>;
