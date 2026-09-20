import { z } from 'zod';

export const countObservationSchema = z.object({
  equipmentId: z.string().optional(),
  shelfId: z.string().optional(),
  serialNumberId: z.string().optional(),
  scannedSerialCode: z.string().optional(),
  observedEquipmentId: z.string().optional(),
  observedShelfId: z.string().optional(),
  quantityCalculated: z.number().int().min(0).default(0),
  isExplicitZero: z.boolean().optional().default(false),
  isUnexpected: z.boolean().optional().default(false),
  notes: z.string().optional(),
  unknownItemEvidence: z.string().optional(),
});

export const submitTaskSchema = z.object({
  isDraft: z.boolean().optional().default(false),
  observations: z.array(countObservationSchema).optional().default([]),
  notes: z.string().optional(),
});

export type SubmitTaskDTO = z.infer<typeof submitTaskSchema>;
export type CountObservationDTO = z.infer<typeof countObservationSchema>;
