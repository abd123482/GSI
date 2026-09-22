import { z } from 'zod';

export const resolveIssueSchema = z.object({
  resolutionType: z.enum([
    'FOUND_IN_ANOTHER_LOCATION',
    'MOVED_WITHOUT_RECORDED_MOVEMENT',
    'LOST',
  ]),
  resolutionShelfId: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
}).refine(
  (data) =>
    data.resolutionType !== 'FOUND_IN_ANOTHER_LOCATION' ||
    Boolean(data.resolutionShelfId?.trim()),
  {
    path: ['resolutionShelfId'],
    message: "L'emplacement trouvé est obligatoire lorsque l'élément est trouvé ailleurs.",
  },
);

export type ResolveIssueDTO = z.input<typeof resolveIssueSchema>;
