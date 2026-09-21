import { z } from 'zod';

/**
 * V3 Equipment creation is metadata-only.
 *
 * Physical quantity and shelf placement MUST NOT be created here.
 * Standard stock enters through Movement IN.
 * Serialized identities may optionally be created after the equipment metadata.
 */
export const createDirectEquipmentSchema = z
  .object({
    equipmentName: z
      .string()
      .trim()
      .min(1, 'Le nom de l’article est requis')
      .max(200, 'Le nom ne peut pas dépasser 200 caractères'),

    hasSerialNumber: z.boolean(),

    // React Hook Form already gives us a number via valueAsNumber.
    // Avoid z.coerce/default here so resolver input/output types stay identical.
    minEquipmentQuantity: z
      .number()
      .int('La quantité minimale doit être un entier')
      .min(0, 'La quantité minimale ne peut pas être négative'),

    serialNumbers: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Le numéro de série est requis')
          .max(200, 'Le numéro de série ne peut pas dépasser 200 caractères'),
      )
      .max(1000, 'Un lot ne peut pas dépasser 1000 numéros de série'),
  })
  .superRefine((data, ctx) => {
    if (!data.hasSerialNumber && data.serialNumbers.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['serialNumbers'],
        message:
          'Les numéros de série sont autorisés uniquement pour un article sérialisé.',
      });
      return;
    }

    if (!data.hasSerialNumber) return;

    const normalized = data.serialNumbers.map((value) =>
      value.trim().toUpperCase(),
    );

    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['serialNumbers'],
        message: 'Certains numéros de série sont en double dans la liste.',
      });
    }
  });

export type CreateDirectEquipmentFormValues = z.infer<
  typeof createDirectEquipmentSchema
>;

/**
 * V3 Equipment update:
 * - name can change
 * - minimum quantity can change
 *
 * Immutable here:
 * - equipmentQuantity
 * - hasSerialNumber
 */
export const updateEquipmentSchema = z
  .object({
    equipmentName: z
      .string()
      .trim()
      .min(1, 'Le nom de l’article est requis')
      .max(200, 'Le nom ne peut pas dépasser 200 caractères')
      .optional(),

    minEquipmentQuantity: z
      .number()
      .int('La quantité minimale doit être un entier')
      .min(0, 'La quantité minimale ne peut pas être négative')
      .optional(),
  })
  .refine(
    (data) =>
      data.equipmentName !== undefined ||
      data.minEquipmentQuantity !== undefined,
    {
      message: 'Aucune modification à enregistrer.',
    },
  );

export type UpdateEquipmentFormValues = z.infer<
  typeof updateEquipmentSchema
>;

export const updateSerialNumberSchema = z.object({
  serialNumberCode: z
    .string()
    .trim()
    .min(1, 'Le code du numéro de série est requis')
    .max(200, 'Le code ne peut pas dépasser 200 caractères'),

  serialNumberStatus: z
    .string()
    .trim()
    .min(1, 'Le statut est requis')
    .max(100, 'Le statut ne peut pas dépasser 100 caractères'),
});

export type UpdateSerialNumberFormValues = z.infer<
  typeof updateSerialNumberSchema
>;
