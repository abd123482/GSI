import { z } from 'zod';

export const createInventorySchema = z.object({
  title: z.string(),
  typeInventory: z.enum(["ByEquipment", "ByShelf"]),
  users: z.array(z.object({
    userId: z.string(),
    responsibility: z.enum(["COUNT", "ADJUDICATE"])
  })).min(2, "Un inventaire doit comporter au moins 2 participants distincts"),
  equipmentIds: z.array(z.string()).optional(),
  shelfIds: z.array(z.string()).optional()
});

export type CreateInventoryDTO = z.infer<typeof createInventorySchema>;
