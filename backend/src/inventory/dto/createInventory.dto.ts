import { z } from 'zod';
import type { Equipment, SerialNumber } from '../../generated/prisma/client.js';

export const equipmentSchema = z
    .object({
        equipmentId: z.string().uuid('L’ID de l’équipement doit être un UUID valide'),
        equipmentName: z.string().optional(),
        hasSerialNumber: z.boolean().optional(),
        equipmentQuantity: z.number().int('La quantité doit être un entier').optional(),
        minequipmentQuantity: z.number().int('La quantité minimale doit être un entier').optional(),
        equipmentShelfId: z.string().uuid().nullable().optional(),
    })
    .passthrough() as unknown as z.ZodType<Equipment>;

export const serialNumberSchema = z
    .object({
        serialNumberId: z.string().uuid('L’ID du numéro de série doit être un UUID valide'),
        serialNumberCode: z.string().nullable().optional(),
        serialNumberStatus: z.string().nullable().optional(),
        equipmentId: z.string().uuid().nullable().optional(),
        shelfId: z.string().uuid().nullable().optional(),
    })
    .passthrough() as unknown as z.ZodType<SerialNumber>;

export const createInventorySchema = z.object({
    typeInventory: z
        .string()
        .trim()
        .min(1, 'Le type d’inventaire est requis')
        .max(50, 'Le type d’inventaire ne peut pas dépasser 50 caractères'),

    parentInventoryId: z
        .string()
        .uuid('L’ID de l’inventaire parent doit être un UUID valide')
        .nullable()
        .optional(),

    equipment: z.array(equipmentSchema).default([]),

    serialNumber: z.array(serialNumberSchema).default([]),
});

export type CreateInventoryDTO = z.infer<typeof createInventorySchema>;
