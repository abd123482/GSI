import { z } from 'zod';

export const updateSerialNumberSchema =
  z.object({
    serialNumberStatus: z
      .string()
      .trim()
      .min(
        1,
        'Serial number status cannot be empty',
      )
      .max(
        100,
        'Serial number status must not exceed 100 characters',
      ),
  });

export type UpdateSerialNumberDTO =
  z.infer<
    typeof updateSerialNumberSchema
  >;
