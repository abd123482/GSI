import { z } from 'zod';

const SQL_INT_MAX = 2_147_483_647;

export const movementTypeSchema = z.enum(['IN', 'OUT', 'TRANSFER']);

export const movementItemSchema = z.object({
  equipmentId: z.string().uuid('Equipment ID must be a valid UUID'),
  serialNumberId: z
    .string()
    .uuid('Serial number ID must be a valid UUID')
    .nullable()
    .optional(),
  movementQuantity: z
    .number()
    .int('Movement quantity must be an integer')
    .positive('Movement quantity must be greater than 0')
    .max(SQL_INT_MAX),
});

export const createEquipmentMovementSchema = z
  .object({
    movementType: movementTypeSchema,
    sourceShelfId: z
      .string()
      .uuid('Source shelf ID must be a valid UUID')
      .nullable()
      .optional(),
    destinationShelfId: z
      .string()
      .uuid('Destination shelf ID must be a valid UUID')
      .nullable()
      .optional(),
    items: z
      .array(movementItemSchema)
      .min(1, 'At least one article is required')
      .max(100, 'A movement can contain at most 100 article lines'),
  })
  .superRefine((data, ctx) => {
    const source = data.sourceShelfId ?? null;
    const destination = data.destinationShelfId ?? null;

    if (data.movementType === 'IN') {
      if (source !== null || destination === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['movementType'],
          message: 'IN requires no source shelf and one destination shelf',
        });
      }
    }

    if (data.movementType === 'OUT') {
      if (source === null || destination !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['movementType'],
          message: 'OUT requires one source shelf and no destination shelf',
        });
      }
    }

    if (data.movementType === 'TRANSFER') {
      if (
        source === null ||
        destination === null ||
        source.toLowerCase() === destination.toLowerCase()
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['movementType'],
          message: 'TRANSFER requires two different shelves',
        });
      }
    }

    const total = data.items.reduce(
      (sum, item) => sum + item.movementQuantity,
      0,
    );

    if (total > SQL_INT_MAX) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Total movement quantity exceeds SQL Server INT capacity',
      });
    }
  });

export type MovementType = z.infer<typeof movementTypeSchema>;
export type CreateEquipmentMovementItemDTO = z.infer<
  typeof movementItemSchema
>;
export type CreateEquipmentMovementDTO = z.infer<
  typeof createEquipmentMovementSchema
>;
