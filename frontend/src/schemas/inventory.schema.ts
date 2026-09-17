import { z } from 'zod';

export const createInventorySchema = z.object({
  title: z.string().min(1, "Title is required"),
  typeInventory: z.enum(["ByEquipment", "ByShelf"]),
  users: z.array(z.object({
    userId: z.string().min(1, "Veuillez sélectionner un utilisateur"),
    responsibility: z.enum(["COUNT", "ADJUDICATE"]),
  }))
  .min(2, "Un inventaire doit comporter au moins 2 participants distincts")
  .refine((users) => {
    const ids = users.map(u => u.userId).filter(Boolean);
    return new Set(ids).size === ids.length;
  }, {
    message: "Les participants doivent être des utilisateurs différents",
  }),
  equipmentIds: z.array(z.string()).optional(),
  shelfIds: z.array(z.string()).optional(),
}).refine((data) => {
  if (data.typeInventory === 'ByEquipment') {
    return data.equipmentIds && data.equipmentIds.length > 0;
  }
  if (data.typeInventory === 'ByShelf') {
    return data.shelfIds && data.shelfIds.length > 0;
  }
  return false;
}, {
  message: "Must select at least one item based on inventory type",
  path: ["equipmentIds"], // Attach error to equipmentIds or shelfIds based on UI
});

export const submitCountSchema = z.object({
  observations: z.array(z.object({
    equipmentId: z.string().optional(),
    shelfId: z.string().optional(),
    serialNumberId: z.string().optional(),
    quantityCalculated: z.number().min(0),
    notes: z.string().optional(),
    unknownItemEvidence: z.string().optional(),
  })),
});
