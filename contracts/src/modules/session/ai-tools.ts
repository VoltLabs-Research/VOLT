import { z } from 'zod';

export const manageSessionsSchema = z.object({
    action: z.enum(['list', 'revoke', 'revoke_others']),
    sessionId: z.string().optional()
});

export type ManageSessionsInput = z.infer<typeof manageSessionsSchema>;
