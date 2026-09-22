import { z } from 'zod';

export const createInventorySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Le titre est requis')
      .max(200, 'Le titre ne peut pas dépasser 200 caractères'),

    typeInventory: z.enum([
      'ByEquipment',
      'ByShelf',
    ]),

    users: z
      .array(
        z.object({
          userId: z
            .string()
            .trim()
            .min(1, 'Sélectionnez un contrôleur'),
        }),
      )
      .length(3, 'Sélectionnez exactement 3 contrôleurs distincts')
      .refine(
        (users) =>
          new Set(users.map((user) => user.userId)).size === 3,
        {
          message: 'Les 3 contrôleurs doivent être différents',
        },
      ),

    equipmentIds: z.array(z.string().uuid()).optional(),
    shelfIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.typeInventory === 'ByEquipment' &&
      !data.equipmentIds?.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['equipmentIds'],
        message: 'Sélectionnez au moins un article',
      });
    }

    if (
      data.typeInventory === 'ByShelf' &&
      !data.shelfIds?.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['shelfIds'],
        message: 'Sélectionnez au moins un emplacement',
      });
    }
  });

export type CreateInventoryFormValues =
  z.infer<typeof createInventorySchema>;
