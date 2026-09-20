import { z } from 'zod';

export const resolveIssueSchema = z.object({
  resolutionType: z.enum([
    'FOUND_IN_ANOTHER_LOCATION',
    'MOVED_WITHOUT_RECORDED_MOVEMENT',
    'LOST',
  ]),
  resolutionShelfId: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => {
    if (data.resolutionType === 'FOUND_IN_ANOTHER_LOCATION') {
      return !!data.resolutionShelfId && data.resolutionShelfId.trim().length > 0;
    }
    return true;
  },
  {
    message: "L'emplacement trouvé (resolutionShelfId) est obligatoire lorsque l'élément est trouvé ailleurs.",
    path: ['resolutionShelfId'],
  }
);

export type ResolveIssueDTO = z.infer<typeof resolveIssueSchema>;
