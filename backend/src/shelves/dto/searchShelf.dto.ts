import { z } from 'zod';
import {
  consistentShelfStatus,
  normalizeShelfStatus,
  shelfStatusFields,
} from './status.dto.js';

export const searchShelfSchema = z
  .object({
    shelfName: z.string().trim().optional(),
    stockId: z.string().uuid('Stock ID must be a valid UUID').optional(),
    ...shelfStatusFields,
  })
  .refine(consistentShelfStatus, 'Conflicting shelf status values')
  .transform(normalizeShelfStatus);

export type SearchShelfDTO = z.input<typeof searchShelfSchema>;
