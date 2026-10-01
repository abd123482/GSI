import { z } from 'zod';
import {
  consistentShelfStatus,
  normalizeShelfStatus,
  shelfStatusFields,
} from './status.dto.js';

export const updateShelfSchema = z
  .object({
    shelfName: z
      .string()
      .trim()
      .min(1, 'Shelf name is required')
      .max(100)
      .optional(),
    stockId: z.string().uuid('Stock ID must be a valid UUID').optional(),
    ...shelfStatusFields,
  })
  .refine(consistentShelfStatus, 'Conflicting shelf status values')
  .transform(normalizeShelfStatus)
  .refine(
    (data) =>
      data.shelfName !== undefined ||
      data.stockId !== undefined ||
      data.status !== undefined,
    'At least one editable field is required',
  );

export type UpdateShelfDTO = z.input<typeof updateShelfSchema>;
