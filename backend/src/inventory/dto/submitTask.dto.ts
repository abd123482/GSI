import { z } from 'zod';

export const submitTaskSchema = z.object({
  isDraft: z.boolean().optional(),
  observations: z.array(z.object({
    equipmentId: z.string().optional(),
    shelfId: z.string().optional(),
    serialNumberId: z.string().optional(),
    observedEquipmentId: z.string().optional(),
    observedShelfId: z.string().optional(),
    quantityCalculated: z.number().nonnegative(),
    notes: z.string().optional(),
    unknownItemEvidence: z.string().optional(),
  })).optional(),
});

export type SubmitTaskDTO = z.infer<typeof submitTaskSchema>;
