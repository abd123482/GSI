import { z } from 'zod';


export const createDirectEquipmentSchema = z
  .object({
    equipmentName: z
      .string()
      .min(1, 'Le nom de l’équipement est requis')
      .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
    hasSerialNumber: z.boolean(),
    equipmentQuantity: z.coerce
      .number()
      .int('La quantité doit être un nombre entier')
      .min(0, 'La quantité ne peut pas être négative'),
    minEquipmentQuantity: z.coerce
      .number()
      .int('La quantité minimale doit être un entier')
      .min(0, 'La quantité minimale ne peut pas être négative')
      .optional(),
    serialNumbers: z
      .array(z.string().min(1, 'Le numéro de série est requis'))
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hasSerialNumber) {
      if (data.equipmentQuantity < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La quantité doit être supérieure ou égale à 1 pour un équipement avec numéros de série',
          path: ['equipmentQuantity'],
        });
      }
      if (!data.serialNumbers || data.serialNumbers.length !== data.equipmentQuantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Vous devez renseigner exactement ${data.equipmentQuantity} numéro(s) de série`,
          path: ['serialNumbers'],
        });
      } else {
        const trimmed = data.serialNumbers.map((s) => s.trim());
        const hasEmpty = trimmed.some((s) => s.length === 0);
        if (hasEmpty) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Tous les numéros de série doivent être renseignés',
            path: ['serialNumbers'],
          });
        }
        const unique = new Set(trimmed.map((s) => s.toUpperCase()));
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

export type CreateDirectEquipmentFormValues = z.infer<
  typeof createDirectEquipmentSchema
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
});

export type UpdateSerialNumberFormValues = z.infer<typeof updateSerialNumberSchema>;
