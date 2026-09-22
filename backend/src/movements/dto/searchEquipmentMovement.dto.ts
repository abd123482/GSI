import { z } from 'zod';

import {
  paginationSchema,
} from './pagination.dto.js';

import {
  movementTypeSchema,
} from './createEquipmentMovement.dto.js';

export const movementOriginSchema =
  z.enum([
    'USER',
    'INVENTORY_ADJUSTMENT',
  ]);

export const searchEquipmentMovementSchema =
  paginationSchema.extend({
    movementType:
      movementTypeSchema.optional(),

    origin:
      movementOriginSchema.optional(),

    inventoryId: z
      .string()
      .uuid(
        'Inventory ID must be a valid UUID',
      )
      .optional(),

    equipmentId: z
      .string()
      .uuid(
        'Equipment ID must be a valid UUID',
      )
      .optional(),

    serialNumberId: z
      .string()
      .uuid(
        'Serial number ID must be a valid UUID',
      )
      .optional(),

    sourceShelfId: z
      .string()
      .uuid(
        'Source shelf ID must be a valid UUID',
      )
      .optional(),

    destinationShelfId: z
      .string()
      .uuid(
        'Destination shelf ID must be a valid UUID',
      )
      .optional(),
  });

export type MovementOrigin =
  z.infer<
    typeof movementOriginSchema
  >;

export type SearchEquipmentMovementDTO =
  z.infer<
    typeof searchEquipmentMovementSchema
  >;
