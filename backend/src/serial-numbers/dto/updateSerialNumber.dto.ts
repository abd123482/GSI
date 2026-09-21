import { z } from 'zod';

export const updateSerialNumberSchema = z
  .object({
    serialNumberCode: z
      .string()
      .trim()
      .min(1, 'Serial number code cannot be empty')
      .max(200, 'Serial number code must not exceed 200 characters')
      .optional(),

    serialNumberStatus: z
      .string()
      .trim()
      .min(1, 'Serial number status cannot be empty')
      .max(100, 'Serial number status must not exceed 100 characters')
      .optional(),
  })
  .refine(
    (data) =>
      data.serialNumberCode !== undefined ||
      data.serialNumberStatus !== undefined,
    {
      message: 'At least one editable field is required',
    },
  );

export type UpdateSerialNumberDTO =
  z.infer<typeof updateSerialNumberSchema>;
