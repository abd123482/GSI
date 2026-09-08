import { z } from 'zod';

export const createEntryMovementWithEquipmentSchema = z
  .object({
    equipmentName: z
      .string()
      .min(1, 'Le nom de l’équipement est requis')
      .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
    hasSerialNumber: z.boolean(),
    equipmentQuantity: z.coerce
      .number()
      .int('La quantité doit être un nombre entier')
      .min(1, 'La quantité doit être supérieure ou égale à 1'),
    minEquipmentQuantity: z.coerce
      .number()
      .int('La quantité minimale doit être un entier')
      .min(0, 'La quantité minimale ne peut pas être négative')
      .optional(),
    destinationShelfId: z.string().optional(),
    serialNumbers: z.array(z.string().min(1, 'Le numéro de série est requis')).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hasSerialNumber) {
      if (!data.serialNumbers || data.serialNumbers.length !== data.equipmentQuantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Vous devez renseigner exactement ${data.equipmentQuantity} numéro(s) de série`,
          path: ['serialNumbers'],
        });
      } else {
        const unique = new Set(data.serialNumbers.map((s) => s.trim().toUpperCase()));
        if (unique.size !== data.serialNumbers.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Certains numéros de série sont en double dans la liste',
            path: ['serialNumbers'],
          });
        }
      }
    }
  });

export type CreateEntryMovementWithEquipmentFormValues = z.infer<
  typeof createEntryMovementWithEquipmentSchema
>;

export const updateEquipmentSchema = z.object({
  equipmentName: z
    .string()
    .min(1, 'Le nom de l’équipement est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .optional(),
  equipmentQuantity: z.coerce
    .number()
    .int('La quantité doit être un nombre entier')
    .min(0, 'La quantité doit être supérieure ou égale à 0')
    .optional(),
  minEquipmentQuantity: z.coerce
    .number()
    .int('La quantité minimale doit être un entier')
    .min(0, 'La quantité minimale ne peut pas être négative')
    .optional(),
  hasSerialNumber: z.boolean().optional(),
});

export type UpdateEquipmentFormValues = z.infer<typeof updateEquipmentSchema>;

export const updateSerialNumberSchema = z.object({
  serialNumberCode: z
    .string()
    .min(1, 'Le code du numéro de série est requis')
    .max(150, 'Le code ne peut pas dépasser 150 caractères'),
  serialNumberStatus: z.string().min(1, 'Le statut est requis'),
  shelfId: z.string().uuid().nullable().optional(),
});

export type UpdateSerialNumberFormValues = z.infer<typeof updateSerialNumberSchema>;


