import { z } from 'zod';

export const adjudicateSchema = z.object({
  quantity: z.number().nonnegative(),
  notes: z.string().optional(),
});

export type AdjudicateDTO = z.infer<typeof adjudicateSchema>;
