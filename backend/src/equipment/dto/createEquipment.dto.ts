import { z } from 'zod';

export const equipmentStatusSchema =
  z.enum(['ACTIVE', 'INACTIVE']);

export const createEquipmentSchema = z.object({
  equipmentName: z
    .string()
    .trim()
    .min(1, 'Equipment name is required')
    .max(
      200,
      'Equipment name must not exceed 200 characters',
    ),

  hasSerialNumber: z.boolean(),

  minEquipmentQuantity: z
    .number()
    .int(
      'Minimum quantity must be an integer',
    )
    .nonnegative(
      'Minimum quantity cannot be negative',
    )
    .optional()
    .default(0),

  equipmentStatus:
    equipmentStatusSchema
      .optional()
      .default('ACTIVE'),
});

export type CreateEquipmentDTO =
  z.input<typeof createEquipmentSchema>;
