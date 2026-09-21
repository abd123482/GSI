import { z } from 'zod';

const optionalQueryBoolean = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return value;
}, z.boolean().optional());

export const searchEquipmentSchema = z.object({
  equipmentName: z.string().trim().optional(),

  hasSerialNumber: optionalQueryBoolean,

  equipmentQuantity: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional(),

  minEquipmentQuantity: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional(),

  // Preferred filter: actual shelf ID.
  shelfId: z.string().uuid().optional(),

  // Backward-compatible filter for an EquipmentShelfs row ID.
  equipmentShelfId: z.string().uuid().optional(),
});

export type SearchEquipmentDTO = z.infer<typeof searchEquipmentSchema>;
