import { z } from 'zod';

export const updateEquipmentSchema = z
  .object({
    equipmentName: z
      .string()
      .trim()
      .min(1, 'Equipment name cannot be empty')
      .max(200, 'Equipment name must not exceed 200 characters')
      .optional(),

    minEquipmentQuantity: z
      .number()
      .int('Minimum quantity must be an integer')
      .nonnegative('Minimum quantity cannot be negative')
      .optional(),
  })
  .refine(
    (data) =>
      data.equipmentName !== undefined ||
      data.minEquipmentQuantity !== undefined,
    {
      message: 'At least one editable field is required',
    },
  );

export type UpdateEquipmentDTO = z.infer<typeof updateEquipmentSchema>;
