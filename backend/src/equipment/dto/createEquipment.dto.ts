import { z } from 'zod';

export const createEquipmentSchema = z.object({
  equipmentName: z
    .string()
    .trim()
    .min(1, 'Le nom de l’équipement est requis')
    .max(200, 'Le nom ne peut pas dépasser 200 caractères'),

  hasSerialNumber: z.boolean(),

  equipmentQuantity: z
    .number()
    .int('La quantité doit être un entier')
    .nonnegative('La quantité ne peut pas être négative'),

  minEquipmentQuantity: z
    .number()
    .int('La quantité minimale doit être un entier')
    .nonnegative('La quantité minimale ne peut pas être négative')
    .optional(),
});

export type CreateEquipmentDTO = z.infer<typeof createEquipmentSchema>;