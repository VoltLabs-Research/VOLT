import { z } from 'zod';

export const teamCreatorSchema = z.object({
    name: z.string().min(1, 'Team name is required').max(100),
    description: z.string().max(500).optional().default('')
}).strict();

export type TeamCreatorForm = z.infer<typeof teamCreatorSchema>;
