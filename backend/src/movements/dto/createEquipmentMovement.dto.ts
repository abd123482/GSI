import { z } from 'zod';

export const createEquipmentMovementSchema = z
  .object({
    equipmentId: z.string().uuid('Equipment ID must be a valid UUID'),
    serialNumberId: z.string().uuid('Serial number ID must be a valid UUID').nullable().optional(),
    sourceShelfId: z.string().uuid('Source shelf ID must be a valid UUID').nullable().optional(),
    destinationShelfId: z.string().uuid('Destination shelf ID must be a valid UUID').nullable().optional(),
    movementQuantity: z.number().int().positive('Movement quantity must be a positive integer'),
    movementType: z.string().min(1, 'Movement type is required'),
  })
  .refine(
    (data) => !!data.sourceShelfId || !!data.destinationShelfId,
    {
      message: 'At least one of sourceShelfId or destinationShelfId must be provided',
      path: ['sourceShelfId'],
    },
  );

export type CreateEquipmentMovementDTO = z.infer<typeof createEquipmentMovementSchema>;

export const createBatchEquipmentMovementSchema = z.object({
  items: z.array(createEquipmentMovementSchema).min(1, 'At least one movement item is required'),
});

export type CreateBatchEquipmentMovementDTO = z.infer<typeof createBatchEquipmentMovementSchema>;

