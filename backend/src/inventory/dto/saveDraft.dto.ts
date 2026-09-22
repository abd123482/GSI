import { z } from 'zod';
import { submitTaskSchema } from './submitTask.dto.js';

export const saveDraftSchema = submitTaskSchema;
export type SaveDraftDTO = z.input<typeof saveDraftSchema>;
