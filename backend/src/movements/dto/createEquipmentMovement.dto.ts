import { z } from 'zod';

export const createEquipmentMovementSchema = z
  .object({
    equipmentId: z.string().uuid('Equipment ID must be a valid UUID'),
    serialNumberId: z.string().uuid('Serial number ID must be a valid UUID').optional(),
    sourceShelfId: z.string().uuid('Source shelf ID must be a valid UUID').optional(),
    destinationShelfId: z.string().uuid('Destination shelf ID must be a valid UUID').optional(),
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

