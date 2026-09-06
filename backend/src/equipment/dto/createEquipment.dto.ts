import { z } from 'zod';

export const createEquipmentSchema = z.object({
  equipmentName: z
    .string()
    .trim()
    .min(1, 'Equipment name is required'),

  hasSerialNumber: z.boolean(),

  equipmentQuantity: z
    .number()
    .int()
    .nonnegative(),

  minEquipmentQuantity: z
    .number()
    .int()
    .nonnegative()
    .optional(),
});

export type CreateEquipmentDTO = z.infer<typeof createEquipmentSchema>;