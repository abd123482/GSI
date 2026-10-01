import { z } from 'zod';
import {
  consistentShelfStatus,
  normalizeShelfStatus,
  shelfStatusFields,
} from './status.dto.js';

export const createShelfSchema = z
  .object({
    shelfName: z.string().trim().min(1, 'Shelf name is required').max(100),
    stockId: z.string().uuid('Stock ID must be a valid UUID'),
    ...shelfStatusFields,
  })
  .refine(consistentShelfStatus, 'Conflicting shelf status values')
  .transform(normalizeShelfStatus);

export type CreateShelfDTO = z.input<typeof createShelfSchema>;
