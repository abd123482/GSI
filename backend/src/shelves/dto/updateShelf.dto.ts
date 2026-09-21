import { z } from 'zod';

export const updateShelfSchema = z
  .object({
    shelfName: z
      .string()
      .trim()
      .min(1, 'Shelf name cannot be empty')
      .max(100, 'Shelf name must not exceed 100 characters')
      .optional(),

    stockId: z
      .string()
      .uuid('Stock ID must be a valid UUID')
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.shelfName !== undefined ||
      data.stockId !== undefined,
    {
      message: 'At least one editable field is required',
    },
  );

export type UpdateShelfDTO = z.infer<typeof updateShelfSchema>;
