import { z } from 'zod';

export const stockStatusSchema = z.preprocess(
  (val) => (val === 'true' ? true : val === 'false' ? false : val),
  z.boolean(),
) as z.ZodType<boolean, z.ZodTypeDef, boolean>;

export const createStockSchema = z.object({
  stockName: z
    .string()
    .trim()
    .min(5, 'Le nom du stock doit comporter au moins 5 caractères')
    .max(50, 'Le nom du stock ne peut pas dépasser 50 caractères'),
  stockStatus: stockStatusSchema,
});

export type CreateStockFormValues = z.infer<typeof createStockSchema>;

export const updateStockSchema = z
  .object({
    stockName: z
      .string()
      .trim()
      .min(1, 'Le nom du stock est requis')
      .max(50, 'Le nom du stock ne peut pas dépasser 50 caractères')
      .optional(),
    stockStatus: stockStatusSchema.optional(),
  })
  .refine(
    (data) => data.stockName !== undefined || data.stockStatus !== undefined,
    { message: 'Aucune modification à enregistrer.' },
  );

export type UpdateStockFormValues = z.infer<typeof updateStockSchema>;
