import { z } from 'zod';

export const createInventorySchema = z.object({
  title: z.string().min(1, "Le titre de l'inventaire est requis"),
  typeInventory: z.enum(["ByEquipment", "ByShelf"]),
  policyVersion: z.number().int().optional().default(2),
  users: z.array(z.object({
    userId: z.string().min(1, "Identifiant utilisateur requis"),
    responsibility: z.enum([
      "PRIMARY_COUNTER_1",
      "PRIMARY_COUNTER_2",
      "FINAL_CONTROLLER",
      "COUNT",
      "ADJUDICATE",
      "CONTROLLER"
    ]).optional(),
  }))
  .refine((users) => {
    const ids = users.map(u => u.userId).filter(Boolean);
    return new Set(ids).size === ids.length;
  }, {
    message: "Tous les contrôleurs assignés doivent être des utilisateurs distincts",
  }),
  equipmentIds: z.array(z.string()).optional(),
  shelfIds: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  const version = data.policyVersion ?? 2;
  if (version >= 2) {
    if (data.users.length !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "L'architecture V2 requiert exactement 3 participants ordonnés distincts (Contrôleur 1, Contrôleur 2, Contrôleur final)",
        path: ['users'],
      });
    }
  } else {
    if (data.users.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Un inventaire hérité requiert au moins 2 participants distincts",
        path: ['users'],
      });
    }
  }

  if (data.typeInventory === 'ByEquipment' && (!data.equipmentIds || data.equipmentIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Veuillez sélectionner au moins un article pour l'inventaire par article",
      path: ['equipmentIds'],
    });
  }

  if (data.typeInventory === 'ByShelf' && (!data.shelfIds || data.shelfIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Veuillez sélectionner au moins un emplacement pour l'inventaire par emplacement",
      path: ['shelfIds'],
    });
  }
});

export type CreateInventoryDTO = z.infer<typeof createInventorySchema>;
