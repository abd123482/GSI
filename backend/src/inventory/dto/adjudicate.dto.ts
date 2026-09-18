import { z } from 'zod';

export const adjudicateSchema = z.object({
  quantity: z.number().nonnegative(),
  notes: z.string().optional(),
  shelfId: z.string().uuid().optional(),
  serialNumberIds: z.array(z.string().uuid()).optional(),
  observations: z
    .array(
      z.object({
        serialNumberId: z.string().uuid().optional(),
        serialNumberCode: z.string().optional(),
        shelfId: z.string().uuid().optional(),
        quantityCalculated: z.number().default(1),
        notes: z.string().optional(),
      }),
    )
    .optional(),
});

export type AdjudicateDTO = z.infer<typeof adjudicateSchema>;

