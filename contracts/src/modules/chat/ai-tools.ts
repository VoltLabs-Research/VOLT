import { z } from 'zod';

export const chatCollaborationSchema = z.object({
    action: z.enum(['list', 'summarize', 'post', 'create']),
    chatId: z.string().optional(),
    text: z.string().optional(),
    memberIds: z.array(z.string()).optional(),
    name: z.string().optional()
});

export type ChatCollaborationInput = z.infer<typeof chatCollaborationSchema>;
