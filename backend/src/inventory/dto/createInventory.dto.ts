import { string, z } from 'zod';
import type { Equipment, SerialNumber } from '../../generated/prisma/client.js';


export const createInventorySchema = z.object({
    typeInventory: z
        .string()
        .trim()
        .min(1, 'Le type d’inventaire est requis')
        .max(50, 'Le type d’inventaire ne peut pas dépasser 50 caractères'),

    equipments: z.array(z.string()).default([]),
    shelfs: z.array(z.string()).default([]),

    amount: z
        .int()
        .positive()
        .optional(),
    serialNumbers: z.array(z.string()).default([]),
});

export type CreateInventoryDTO = z.infer<typeof createInventorySchema>;
