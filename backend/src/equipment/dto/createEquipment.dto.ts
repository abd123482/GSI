import { z } from 'zod';

export const createEquipmentSchema = z.object({
  equipmentName: z.string().min(1, 'Equipment name is required'),
  hasSerialNumber: z.boolean(),
  equipmentQuantity: z.number().int().nonnegative(),
  minEquipmentQuantity: z.number().int().nonnegative().optional(),
  equipmentShelfId: z.number().int().positive().optional(),
});

export type CreateEquipmentDTO = z.infer<typeof createEquipmentSchema>;
