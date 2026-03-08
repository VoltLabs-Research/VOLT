import { z } from 'zod';

export interface TeamInviteForm {
    email: string;
};

export const teamInviteSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email address')
}).strict();
