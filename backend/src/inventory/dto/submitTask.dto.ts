import { z } from 'zod';

export const countObservationSchema = z.object({
  equipmentId: z.string().trim().optional(),
  shelfId: z.string().trim().optional(),
  serialNumberId: z.string().trim().optional(),
  scannedSerialCode: z.string().trim().max(200).optional(),
  observedEquipmentId: z.string().trim().optional(),
  observedShelfId: z.string().trim().optional(),
  quantityCalculated: z.number().int().min(0).optional().default(0),
  isExplicitZero: z.boolean().optional().default(false),
  isUnexpected: z.boolean().optional().default(false),
  notes: z.string().trim().max(1000).optional(),
  unknownItemEvidence: z.string().trim().optional(),
});

export const submitTaskSchema = z.object({
  isDraft: z.boolean().optional().default(false),
  observations: z.array(countObservationSchema).optional().default([]),
  notes: z.string().trim().max(1000).optional(),
});

export type SubmitTaskDTO = z.input<typeof submitTaskSchema>;
export type CountObservationDTO = z.input<typeof countObservationSchema>;
