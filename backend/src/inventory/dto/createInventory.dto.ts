import { z } from 'zod';


export const createInventorySchema = z.object({
    typeInventory: z.enum(["ByEquipment", "ByShelf"]),
    roles: z.string(),
    users: z.array(z.string()),
    shelfs: z.array(z.string()),
    equipments: z.array(z.string())
});

export type CreateInventoryDTO = z.infer<typeof createInventorySchema>;
