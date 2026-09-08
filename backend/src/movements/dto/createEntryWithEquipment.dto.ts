import { z } from 'zod';

export const createEntryMovementWithEquipmentSchema = z
  .object({
    equipmentName: z
      .string()
      .min(1, 'Le nom de l’équipement est requis')
      .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
    hasSerialNumber: z.boolean().default(false),
    equipmentQuantity: z.coerce
      .number()
      .int('La quantité doit être un entier')
      .min(1, 'La quantité doit être d’au moins 1'),
    minEquipmentQuantity: z.coerce
      .number()
      .int('La quantité minimale doit être un entier')
      .min(0, 'La quantité minimale ne peut pas être négative')
      .default(0),
    destinationShelfId: z
      .string()
      .uuid('L’identifiant de l’étagère de destination doit être un UUID valide')
      .nullable()
      .optional(),
    serialNumbers: z.array(z.string().min(1, 'Le numéro de série ne peut pas être vide')).optional(),
    movementStatus: z.string().optional().default('ENTRY'),
  })
  .superRefine((data, ctx) => {
    if (data.hasSerialNumber) {
      if (!data.serialNumbers || data.serialNumbers.length !== data.equipmentQuantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Exactement ${data.equipmentQuantity} numéro(s) de série requis pour cet équipement`,
          path: ['serialNumbers'],
        });
      } else {
        // Check uniqueness within the provided array
        const uniqueSet = new Set(data.serialNumbers);
        if (uniqueSet.size !== data.serialNumbers.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Les numéros de série fournis contiennent des doublons',
            path: ['serialNumbers'],
          });
        }
      }
    }
  });

export type CreateEntryMovementWithEquipmentDTO = z.infer<
  typeof createEntryMovementWithEquipmentSchema
>;
