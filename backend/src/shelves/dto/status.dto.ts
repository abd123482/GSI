import { z } from 'zod';

// Explicit parsing avoids treating the query string 'false' as true.
export const shelfStatusSchema = z.union([
  z.boolean(),
  z
    .enum(['ACTIVE', 'INACTIVE', 'true', 'false'])
    .transform((status) => status === 'ACTIVE' || status === 'true'),
]);

export const shelfStatusFields = {
  status: shelfStatusSchema.optional(),
  shelfStatus: shelfStatusSchema.optional(),
};

export function consistentShelfStatus(data: {
  status?: boolean;
  shelfStatus?: boolean;
}) {
  return (
    data.status === undefined ||
    data.shelfStatus === undefined ||
    data.status === data.shelfStatus
  );
}

export function normalizeShelfStatus<
  T extends { status?: boolean; shelfStatus?: boolean },
>(data: T) {
  const { shelfStatus, ...fields } = data;
  return { ...fields, status: data.status ?? shelfStatus };
}
