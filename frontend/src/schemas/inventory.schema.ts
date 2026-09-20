import { z } from 'zod';

export const createInventorySchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  typeInventory: z.enum(["ByEquipment", "ByShelf"]),
  users: z.array(z.object({
    userId: z.string().min(1, "Veuillez sélectionner un utilisateur"),
    responsibility: z.enum(["COUNT", "ADJUDICATE"]),
  }))
  .length(3, "Un inventaire V2 requiert exactement 3 participants (1er Contrôleur, 2ème Contrôleur, Contrôleur Final)")
  .refine((users) => {
    const ids = users.map(u => u.userId).filter(Boolean);
    return ids.length === 3 && new Set(ids).size === 3;
  }, {
    message: "Les 3 participants doivent être des utilisateurs distincts",
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
  message: "Veuillez sélectionner au moins un article ou un emplacement selon le type d'inventaire",
  path: ["equipmentIds"],
});

export const submitCountSchema = z.object({
  observations: z.array(z.object({
    equipmentId: z.string().optional(),
    shelfId: z.string().optional(),
    serialNumberId: z.string().optional(),
    scannedSerialCode: z.string().optional(),
    quantityCalculated: z.number().min(0),
    isExplicitZero: z.boolean().optional(),
    isUnexpected: z.boolean().optional(),
    notes: z.string().optional(),
    unknownItemEvidence: z.string().optional(),
  })),
});

export const resolveIssueSchema = z.object({
  resolutionType: z.enum(['FOUND_IN_ANOTHER_LOCATION', 'MOVED_WITHOUT_RECORDED_MOVEMENT', 'LOST']),
  resolutionShelfId: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.resolutionType === 'FOUND_IN_ANOTHER_LOCATION') {
    return !!data.resolutionShelfId;
  }
  return true;
}, {
  message: "L'emplacement de destination est obligatoire lorsqu'un article est retrouvé",
  path: ["resolutionShelfId"],
});
