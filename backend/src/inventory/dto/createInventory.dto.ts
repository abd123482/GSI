import { z } from 'zod';

const participantSchema = z.object({
  userId: z.string().trim().min(1, 'Identifiant utilisateur requis'),
  responsibility: z.enum([
    'PRIMARY_COUNTER_1',
    'PRIMARY_COUNTER_2',
    'FINAL_CONTROLLER',
    'COUNT',
    'ADJUDICATE',
    'CONTROLLER',
  ]).optional(),
});

export const createInventorySchema = z.object({
  title: z.string().trim().min(1, "Le titre de l'inventaire est requis").max(200),
  typeInventory: z.enum(['ByEquipment', 'ByShelf']),
  policyVersion: z.number().int().positive().optional().default(4),
  users: z.array(participantSchema).min(3, 'Au moins 3 contrôleurs distincts sont requis'),
  equipmentIds: z.array(z.string().trim().min(1)).optional(),
  shelfIds: z.array(z.string().trim().min(1)).optional(),
}).superRefine((data, ctx) => {
  const userIds = data.users.map((item) => item.userId);
  if (new Set(userIds).size !== userIds.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['users'],
      message: 'Tous les contrôleurs assignés doivent être des utilisateurs distincts',
    });
  }

  if (
    data.typeInventory === 'ByEquipment' &&
    (!data.equipmentIds || data.equipmentIds.length === 0)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['equipmentIds'],
      message: "Veuillez sélectionner au moins un article pour l'inventaire par article",
    });
  }

  if (
    data.typeInventory === 'ByShelf' &&
    (!data.shelfIds || data.shelfIds.length === 0)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['shelfIds'],
      message: "Veuillez sélectionner au moins un emplacement pour l'inventaire par emplacement",
    });
  }

  if (data.equipmentIds) {
    const normalized = data.equipmentIds.map((id) => id.toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['equipmentIds'],
        message: 'Un même article ne peut pas apparaître deux fois dans le périmètre.',
      });
    }
  }

  if (data.shelfIds) {
    const normalized = data.shelfIds.map((id) => id.toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['shelfIds'],
        message: 'Un même emplacement ne peut pas apparaître deux fois dans le périmètre.',
      });
    }
  }
});

export type CreateInventoryDTO = z.input<typeof createInventorySchema>;

export const updateRosterSchema = z.object({
  users: z.array(participantSchema).min(3, 'Au moins 3 contrôleurs distincts sont requis'),
}).superRefine((data, ctx) => {
  const userIds = data.users.map((item) => item.userId);
  if (new Set(userIds).size !== userIds.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['users'],
      message: 'Tous les contrôleurs assignés doivent être des utilisateurs distincts',
    });
  }
});

export type UpdateRosterDTO = z.input<typeof updateRosterSchema>;

