import { z } from 'zod';

import { createEquipmentSchema } from '../../equipment/dto/createEquipment.dto.js';

const uuid = z.string().trim().uuid().transform((id) => id.toLowerCase());
export const movementTypeSchema = z.enum(['IN', 'OUT', 'TRANSFER']);
export const movementItemSchema = z.object({
  equipmentId: uuid.optional(),
  newEquipment: createEquipmentSchema.optional(),
  movementQuantity: z.number().int().positive().max(2_147_483_647),
  serialNumberId: uuid.nullish(),
  serialNumberCode: z.string().trim().min(1).max(200).optional(),
  sourceShelfId: uuid.nullish(),
  destinationShelfId: uuid.nullish(),
}).strict().superRefine((data, ctx) => {
  if (!data.equipmentId && !data.newEquipment) {
    ctx.addIssue({ code: 'custom', message: 'Either equipmentId or newEquipment must be provided' });
  }
  if (data.equipmentId && data.newEquipment) {
    ctx.addIssue({ code: 'custom', message: 'Provide either equipmentId or newEquipment, not both' });
  }
});

export const createEquipmentMovementSchema = z.object({
  movementType: movementTypeSchema,
  happenedAt: z.string().datetime().optional(),
  items: z.array(movementItemSchema).min(1).max(100),
}).strict().superRefine(({ movementType: type, items, happenedAt }, ctx) => {
  if (happenedAt && new Date(happenedAt) > new Date())
    ctx.addIssue({ code: 'custom', path: ['happenedAt'], message: 'La date du mouvement ne peut pas être dans le futur' });

  const ids = new Set<string>(), codes = new Set<string>();
  items.forEach((item, index) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', path: ['items', index], message });
    const { sourceShelfId: from, destinationShelfId: to, serialNumberId: id, serialNumberCode: code } = item;
    if (!!from !== (type !== 'IN') || !!to !== (type !== 'OUT') || (from && from === to))
      fail('IN needs a destination only; OUT a source only; TRANSFER two different shelves');
    if (code !== undefined && (type !== 'IN' || id)) fail('New serial codes are IN-only; send a code OR an existing ID');
    if ((id || code !== undefined) && item.movementQuantity !== 1) fail('Each serialized line must have quantity 1');
    if (id && ids.has(id)) fail('The same serial ID cannot appear twice');
    if (code !== undefined && codes.has(code)) fail('Duplicate serial code in the request');
    if (id) ids.add(id);
    if (code !== undefined) codes.add(code);
  });
  if (items.reduce((sum, item) => sum + item.movementQuantity, 0) > 2_147_483_647)
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Total quantity exceeds SQL INT capacity' });
});

export type MovementType = z.infer<typeof movementTypeSchema>;
export type CreateEquipmentMovementItemDTO = z.input<typeof movementItemSchema>;
export type CreateEquipmentMovementDTO = z.input<typeof createEquipmentMovementSchema>;
