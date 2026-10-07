import { z } from "zod";

export const equipmentStatusSchema = z.boolean();

export const createDirectEquipmentSchema = z.object({
  equipmentName: z
    .string()
    .trim()
    .min(1, "Le nom de l'article est requis")
    .max(200, "Le nom ne peut pas dépasser 200 caractères"),

  hasSerialNumber: z.boolean(),

  minEquipmentQuantity: z
    .number()
    .int("La quantité minimale doit être un entier")
    .min(0, "La quantité minimale ne peut pas être négative"),

  equipmentStatus: equipmentStatusSchema,
});

export type CreateDirectEquipmentFormValues = z.infer<
  typeof createDirectEquipmentSchema
>;

export const updateEquipmentSchema = z
  .object({
    equipmentName: z
      .string()
      .trim()
      .min(1, "Le nom de l'article est requis")
      .max(200, "Le nom ne peut pas dépasser 200 caractères")
      .optional(),

    minEquipmentQuantity: z
      .number()
      .int("La quantité minimale doit être un entier")
      .min(0, "La quantité minimale ne peut pas être négative")
      .optional(),

    equipmentStatus: equipmentStatusSchema.optional(),

    hasSerialNumber: z.literal(true).optional(),
  })
  .superRefine((data, ctx) => {
    const editable =
      data.equipmentName !== undefined ||
      data.minEquipmentQuantity !== undefined ||
      data.equipmentStatus !== undefined ||
      data.hasSerialNumber !== undefined;

    if (!editable) {
      ctx.addIssue({
        code: "custom",
        message: "Aucune modification à enregistrer.",
      });
    }
  });

export type UpdateEquipmentFormValues = z.infer<
  typeof updateEquipmentSchema
>;

export const updateSerialNumberSchema = z.object({
  serialNumberStatus: z
    .string()
    .trim()
    .min(1, "Le statut est requis")
    .max(100, "Le statut ne peut pas dépasser 100 caractères"),
});

export type UpdateSerialNumberFormValues = z.infer<
  typeof updateSerialNumberSchema
>;
