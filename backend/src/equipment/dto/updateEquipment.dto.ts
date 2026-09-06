import { z } from 'zod';

export const updateEquipmentSchema = z.object({
  equipmentName: z.string().min(1, 'Equipment name cannot be empty').optional(),
  hasSerialNumber: z.boolean().optional(),
  equipmentQuantity: z.number().int().nonnegative().optional(),
  minEquipmentQuantity: z.number().int().nonnegative().optional(),
});

export type UpdateEquipmentDTO = z.infer<typeof updateEquipmentSchema>;
