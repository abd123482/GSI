import { z } from 'zod';

export const searchSerialNumberSchema = z.object({
    serialNumberCode: z
        .string()
        .trim()
        .optional(),

    serialNumberStatus: z
        .string()
        .trim()
        .optional(),

    equipmentId: z
        .string()
        .uuid()
        .optional(),

    shelfId: z
        .string()
        .uuid()
        .optional(),
});

export type SearchSerialNumberDTO =
    z.infer<typeof searchSerialNumberSchema>;
