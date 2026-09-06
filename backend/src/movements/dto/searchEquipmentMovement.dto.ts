import { z } from 'zod';

export const searchEquipmentMovementSchema = z.object({
  equipmentId: z.string().uuid('Equipment ID must be a valid UUID').optional(),
  serialNumberId: z.string().uuid('Serial number ID must be a valid UUID').optional(),
  sourceShelfId: z.string().uuid('Source shelf ID must be a valid UUID').optional(),
  destinationShelfId: z.string().uuid('Destination shelf ID must be a valid UUID').optional(),
  movementQuantity: z.coerce.number().int().positive().optional(),
  movementType: z.string().min(1).optional(),
});

export type SearchEquipmentMovementDTO = z.infer<typeof searchEquipmentMovementSchema>;
