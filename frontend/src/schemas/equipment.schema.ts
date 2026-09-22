import { z } from 'zod';

export const equipmentStatusSchema =
  z.enum(['ACTIVE', 'INACTIVE']);

const serialCodeSchema = z
  .string()
  .trim()
  .min(
    1,
    'Le numéro de série est requis',
  )
  .max(
    200,
    'Le numéro de série ne peut pas dépasser 200 caractères',
  );

export const createDirectEquipmentSchema = z
  .object({
    equipmentName: z
      .string()
      .trim()
      .min(
        1,
        'Le nom de l’article est requis',
      )
      .max(
        200,
        'Le nom ne peut pas dépasser 200 caractères',
      ),

    hasSerialNumber:
      z.boolean(),

    minEquipmentQuantity: z
      .number()
      .int(
        'La quantité minimale doit être un entier',
      )
      .min(
        0,
        'La quantité minimale ne peut pas être négative',
      ),

    equipmentStatus:
      equipmentStatusSchema,

    serialNumbers: z
      .array(
        serialCodeSchema,
      )
      .max(
        1000,
        'Un lot ne peut pas dépasser 1000 numéros de série',
      ),
  })
  .superRefine(
    (data, ctx) => {
      if (
        !data.hasSerialNumber &&
        data.serialNumbers.length
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [
            'serialNumbers',
          ],
          message:
            'Les numéros de série sont autorisés uniquement pour un article sérialisé.',
        });
      }

      const normalized =
        data.serialNumbers.map(
          (value) =>
            value
              .trim()
              .toUpperCase(),
        );

      if (
        new Set(
          normalized,
        ).size !==
        normalized.length
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [
            'serialNumbers',
          ],
          message:
            'Certains numéros de série sont en double.',
        });
      }
    },
  );

export type CreateDirectEquipmentFormValues =
  z.infer<
    typeof createDirectEquipmentSchema
  >;

export const equipmentConversionSerialSchema =
  z.object({
    serialNumberCode:
      serialCodeSchema,

    shelfId: z
      .string()
      .uuid(
        'Emplacement invalide',
      ),
  });

export const updateEquipmentSchema =
  z
    .object({
      equipmentName: z
        .string()
        .trim()
        .min(
          1,
          'Le nom de l’article est requis',
        )
        .max(
          200,
          'Le nom ne peut pas dépasser 200 caractères',
        )
        .optional(),

      minEquipmentQuantity: z
        .number()
        .int(
          'La quantité minimale doit être un entier',
        )
        .min(
          0,
          'La quantité minimale ne peut pas être négative',
        )
        .optional(),

      equipmentStatus:
        equipmentStatusSchema.optional(),

      hasSerialNumber:
        z.literal(true).optional(),

      conversionSerials: z
        .array(
          equipmentConversionSerialSchema,
        )
        .optional(),
    })
    .superRefine(
      (data, ctx) => {
        const editable =
          data.equipmentName !==
            undefined ||
          data.minEquipmentQuantity !==
            undefined ||
          data.equipmentStatus !==
            undefined ||
          data.hasSerialNumber !==
            undefined;

        if (!editable) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Aucune modification à enregistrer.',
          });
        }

        if (
          data.conversionSerials !==
            undefined &&
          data.hasSerialNumber !==
            true
        ) {
          ctx.addIssue({
            code: 'custom',
            path: [
              'conversionSerials',
            ],
            message:
              'Les séries de conversion sont autorisées uniquement pendant la conversion Standard → Sérialisé.',
          });
        }

        if (
          data.conversionSerials
            ?.length
        ) {
          const normalized =
            data.conversionSerials.map(
              (item) =>
                item.serialNumberCode
                  .trim()
                  .toUpperCase(),
            );

          if (
            new Set(
              normalized,
            ).size !==
            normalized.length
          ) {
            ctx.addIssue({
              code: 'custom',
              path: [
                'conversionSerials',
              ],
              message:
                'Les numéros de série de conversion doivent être uniques.',
            });
          }
        }
      },
    );

export type UpdateEquipmentFormValues =
  z.infer<
    typeof updateEquipmentSchema
  >;

/**
 * Serial code is immutable after creation.
 * Only the status can be edited.
 */
export const updateSerialNumberSchema =
  z.object({
    serialNumberStatus: z
      .string()
      .trim()
      .min(
        1,
        'Le statut est requis',
      )
      .max(
        100,
        'Le statut ne peut pas dépasser 100 caractères',
      ),
  });

export type UpdateSerialNumberFormValues =
  z.infer<
    typeof updateSerialNumberSchema
  >;
