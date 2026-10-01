import { z } from 'zod';

export const updateSerialNumberSchema =
  z.object({
    serialNumberStatus: z.boolean().optional(),
  });

export type UpdateSerialNumberDTO =
  z.infer<
    typeof updateSerialNumberSchema
  >;
