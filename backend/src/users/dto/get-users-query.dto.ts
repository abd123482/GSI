import { z } from 'zod';
import { allowedUserStatuses } from './update-user-status.dto.js';

export const getUsersQuerySchema = z.object({
  status: z.enum(allowedUserStatuses).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export type GetUsersQueryDTO = z.infer<typeof getUsersQuerySchema>;
