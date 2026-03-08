import { z } from 'zod';

export const teamInviteSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email address')
}).strict();

export type TeamInviteForm = z.infer<typeof teamInviteSchema>;
