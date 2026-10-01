import { z } from 'zod';

export const equipmentUuidSchema = z.string().uuid();
