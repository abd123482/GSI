import { z } from 'zod';

const equipmentStatusSchema = z.boolean();

export const equipmentConversionSerialSchema =
  z.object({
    serialNumberCode: z
      .string()
      .trim()
      .min(
        1,
        'Serial number code is required',
      )
      .max(
        200,
        'Serial number code must not exceed 200 characters',
      ),

    shelfId: z
      .string()
      .uuid(
        'Shelf ID must be a valid UUID',
      ),
  });

export const updateEquipmentSchema = z
  .object({
    equipmentName: z
      .string()
      .trim()
      .min(
        1,
        'Equipment name cannot be empty',
      )
      .max(
        200,
        'Equipment name must not exceed 200 characters',
      )
      .optional(),

    minEquipmentQuantity: z
      .number()
      .int(
        'Minimum quantity must be an integer',
      )
      .nonnegative(
        'Minimum quantity cannot be negative',
      )
      .optional(),

    equipmentStatus:
      equipmentStatusSchema.optional(),

    hasSerialNumber:
      z.boolean().optional(),

    conversionSerials: z
      .array(
        equipmentConversionSerialSchema,
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasEditableField =
      data.equipmentName !== undefined ||
      data.minEquipmentQuantity !==
        undefined ||
      data.equipmentStatus !==
        undefined ||
      data.hasSerialNumber !==
        undefined;

    if (!hasEditableField) {
      ctx.addIssue({
        code: 'custom',
        message:
          'At least one editable field is required',
      });
    }

    if (
      data.conversionSerials !==
        undefined &&
      data.hasSerialNumber !== true
    ) {
      ctx.addIssue({
        code: 'custom',
        path: [
          'conversionSerials',
        ],
        message:
          'conversionSerials can only be used when converting equipment to serialized mode',
      });
    }
  });

export type UpdateEquipmentDTO =
  z.input<typeof updateEquipmentSchema>;
