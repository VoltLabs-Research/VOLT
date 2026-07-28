import { z } from 'zod';

export const getNotificationsSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(20),
    unreadOnly: z.boolean().optional().describe('When true, return only notifications that have not been read yet.')
});

export type GetNotificationsInput = z.infer<typeof getNotificationsSchema>;
