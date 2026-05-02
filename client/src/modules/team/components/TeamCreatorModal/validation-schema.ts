import { z } from 'zod';

export interface TeamCreatorForm {
    name: string;
    description: string;
}

export const teamCreatorSchema = z.object({
    name: z.string().min(1, 'Team name is required').max(100),
    description: z.string().max(500).optional().default('')
}).strict();
