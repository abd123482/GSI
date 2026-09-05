import { z } from 'zod';

export const searchEquipmentSchema = z.object({
  equipmentName: z.string().optional(),
  hasSerialNumber: z.boolean().optional(),
  equipmentQuantity: z.number().int().nonnegative().optional(),
  minEquipmentQuantity: z.number().int().nonnegative().optional(),
  equipmentShelfId: z.number().int().positive().optional(),
});

export type SearchEquipmentDTO = z.infer<typeof searchEquipmentSchema>;
