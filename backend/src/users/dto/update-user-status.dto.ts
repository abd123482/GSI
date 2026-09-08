import { z } from 'zod';

export const allowedUserStatuses = [
  'ACTIVE',
  'PENDING',
  'DISABLED',
  'BLOCKED',
  'INACTIVE',
] as const;

export type UserStatusType = (typeof allowedUserStatuses)[number];

export const updateUserStatusSchema = z.object({
  status: z.enum(allowedUserStatuses, {
    message: `Status must be one of: ${allowedUserStatuses.join(', ')}`,
  }),
});

export type UpdateUserStatusDTO = z.infer<typeof updateUserStatusSchema>;
