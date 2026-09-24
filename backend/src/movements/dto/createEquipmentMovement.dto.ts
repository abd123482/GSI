import { z } from 'zod';

const SQL_INT_MAX = 2_147_483_647;

export const movementTypeSchema =
  z.enum(['IN', 'OUT', 'TRANSFER']);

export const movementItemSchema =
  z.object({
    equipmentId: z
      .string()
      .uuid(
        'Equipment ID must be a valid UUID',
      ),

    serialNumberId: z
      .string()
      .uuid(
        'Serial number ID must be a valid UUID',
      )
      .nullable()
      .optional(),

    movementQuantity: z
      .number()
      .int(
        'Movement quantity must be an integer',
      )
      .positive(
        'Movement quantity must be greater than 0',
      )
      .max(
        SQL_INT_MAX,
        'Movement quantity exceeds SQL Server INT capacity',
      ),

    sourceShelfId: z
      .string()
      .uuid(
        'Source shelf ID must be a valid UUID',
      )
      .nullable()
      .optional(),

    destinationShelfId: z
      .string()
      .uuid(
        'Destination shelf ID must be a valid UUID',
      )
      .nullable()
      .optional(),
  });

export const createEquipmentMovementSchema =
  z
    .object({
      movementType:
        movementTypeSchema,



      items: z
        .array(
          movementItemSchema,
        )
        .min(
          1,
          'At least one article is required',
        )
        .max(
          100,
          'A movement can contain at most 100 article lines',
        ),
    })
    ;

export type MovementType =
  z.infer<
    typeof movementTypeSchema
  >;

export type CreateEquipmentMovementItemDTO =
  z.infer<
    typeof movementItemSchema
  >;

export type CreateEquipmentMovementDTO =
  z.infer<
    typeof createEquipmentMovementSchema
  >;
